"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import type { Json } from "@/lib/supabase/database.types";

type ScoutContext = {
  userId: string;
  institutionId: string;
};

/** Every scout action resolves through here: flag on + institution member. */
async function requireScout(): Promise<ScoutContext | { error: string }> {
  if (!(await getFlag("scout_portal"))) return { error: "Not available." };
  const user = await requireUser();
  const { data: membership } = await createAdminClient()
    .from("institution_members")
    .select("institution_id, institutions!inner(approved)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    !membership ||
    !(membership.institutions as unknown as { approved: boolean }).approved
  ) {
    return { error: "Not an approved institution account." };
  }
  return { userId: user.id, institutionId: membership.institution_id };
}

async function audit(
  institutionId: string,
  actorId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await createAdminClient().from("institution_audit_log").insert({
    institution_id: institutionId,
    actor_id: actorId,
    action,
    details: details as Json,
  });
}

const searchSchema = z.object({
  subjectId: z.string().uuid().optional(),
  minRating: z.number().min(0).max(100).default(0),
  trajectory: z.enum(["improving", "stable", "declining"]).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
});

export type ScoutHit = {
  userId: string;
  displayName: string;
  subjectName: string;
  rating: number;
  confidence: number;
  sampleSize: number;
  trajectory: string;
  tier: string;
  country: string | null;
  contactStatus: string | null;
};

/**
 * Searches opted-in public Signal profiles only. Results are pseudonymous;
 * identity is only ever revealed by an approved contact request. Every
 * search is written to the immutable audit log.
 */
export async function scoutSearch(
  input: z.infer<typeof searchSchema>,
): Promise<{ hits?: ScoutHit[]; error?: string }> {
  const scout = await requireScout();
  if ("error" in scout) return { error: scout.error };
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the search filters." };
  const admin = createAdminClient();

  let query = admin
    .from("signal_ratings")
    .select(
      "user_id, subject_id, rating, confidence, sample_size, trajectory, verification_tier, subjects(name), signal_profiles!inner(public, show_country, subject_ids), profiles!inner(display_name, country)",
    )
    .eq("signal_profiles.public", true)
    .gte("rating", parsed.data.minRating)
    .order("rating", { ascending: false })
    .limit(50);
  if (parsed.data.subjectId) query = query.eq("subject_id", parsed.data.subjectId);
  if (parsed.data.trajectory) query = query.eq("trajectory", parsed.data.trajectory);
  if (parsed.data.country) query = query.eq("profiles.country", parsed.data.country);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const { data: requests } = await admin
    .from("contact_requests")
    .select("student_id, status")
    .eq("institution_id", scout.institutionId);
  const statusByStudent = new Map(
    (requests ?? []).map((r) => [r.student_id, r.status]),
  );

  const hits: ScoutHit[] = (data ?? [])
    .filter((row) => {
      const profile = row.signal_profiles as unknown as {
        subject_ids: string[];
      };
      return (
        profile.subject_ids.length === 0 ||
        profile.subject_ids.includes(row.subject_id)
      );
    })
    .map((row) => {
      const profile = row.signal_profiles as unknown as {
        show_country: boolean;
      };
      const person = row.profiles as unknown as {
        display_name: string;
        country: string | null;
      };
      return {
        userId: row.user_id,
        displayName: person.display_name,
        subjectName:
          (row.subjects as unknown as { name?: string })?.name ?? "—",
        rating: Number(row.rating),
        confidence: Number(row.confidence),
        sampleSize: row.sample_size,
        trajectory: row.trajectory,
        tier: row.verification_tier,
        country: profile.show_country ? person.country : null,
        contactStatus: statusByStudent.get(row.user_id) ?? null,
      };
    });

  await audit(scout.institutionId, scout.userId, "search", {
    filters: parsed.data,
    results: hits.length,
  });
  return { hits };
}

/** Contact request: the student must approve before any identity moves. */
export async function requestContact(studentId: string, message: string) {
  const scout = await requireScout();
  if ("error" in scout) return { error: scout.error };
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("contact_requests")
    .select("id, status")
    .eq("institution_id", scout.institutionId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) return { error: "A request to this student already exists." };

  const { error } = await admin.from("contact_requests").insert({
    institution_id: scout.institutionId,
    student_id: studentId,
    message: message.slice(0, 500) || null,
  });
  if (error) return { error: error.message };

  const { data: institution } = await admin
    .from("institutions")
    .select("name")
    .eq("id", scout.institutionId)
    .single();
  await admin.from("notifications").insert({
    user_id: studentId,
    category: "system",
    title: `${institution?.name ?? "An institution"} wants to connect`,
    body: "Review the request on your Signal page. Nothing is shared unless you approve.",
    href: "/signal",
  });
  await audit(scout.institutionId, scout.userId, "contact_request", {
    studentId,
  });
  revalidatePath("/scout");
  return { ok: true };
}

/** Student's answer. Approval reveals name and email to that institution only. */
export async function respondToContact(requestId: string, approve: boolean) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("contact_requests")
    .select("id, institution_id, student_id, status")
    .eq("id", requestId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!request || request.status !== "pending") {
    return { error: "Request not found." };
  }
  await admin
    .from("contact_requests")
    .update({
      status: approve ? "approved" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  await audit(request.institution_id, user.id, "contact_response", {
    requestId,
    approved: approve,
  });
  revalidatePath("/signal");
  return { ok: true };
}

const institutionSchema = z.object({
  name: z.string().min(3).max(160),
  kind: z.enum(["scholarship", "university", "other"]),
  memberEmail: z.string().email(),
});

/** Admin: create an approved institution and attach its first scout. */
export async function createInstitution(
  input: z.infer<typeof institutionSchema>,
) {
  await requireAdmin();
  const parsed = institutionSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the institution details." };
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("profiles")
    .select("id")
    .in(
      "id",
      (
        await admin.auth.admin.listUsers()
      ).data.users
        .filter((u) => u.email === parsed.data.memberEmail)
        .map((u) => u.id),
    )
    .maybeSingle();
  if (!member) return { error: "No account with that email." };

  const { data: institution, error } = await admin
    .from("institutions")
    .insert({ name: parsed.data.name, kind: parsed.data.kind, approved: true })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await admin
    .from("institution_members")
    .upsert({ user_id: member.id, institution_id: institution.id });
  revalidatePath("/admin/institutions");
  return { ok: true };
}
