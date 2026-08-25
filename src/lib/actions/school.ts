"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateRegionalTeam } from "@/lib/school/service";
import { BANNER_PRESETS } from "@/lib/school/rivalry";
import { normalizeCity } from "@/lib/school/city";
import { logEvent } from "@/lib/actions/analytics";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Joins a school (affiliation is opt-in, single, and reversible). */
export async function joinSchool(schoolId: string, inviterId?: string | null) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: school } = await admin
    .from("schools")
    .select("id, slug")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return { error: "School not found." };

  const { error } = await admin
    .from("school_members")
    .upsert({ user_id: user.id, school_id: school.id });
  if (error) return { error: error.message };

  await logEvent("school_joined", {
    schoolId: school.id,
    invitedBy: inviterId ?? null,
  });
  revalidatePath("/schools");
  return { ok: true, slug: school.slug };
}

export async function leaveSchool() {
  const user = await requireUser();
  await createAdminClient().from("school_members").delete().eq("user_id", user.id);
  revalidatePath("/schools");
  return { ok: true };
}

/** Falls back to the country team so nobody is locked out of School Wars. */
export async function joinRegionalTeam(country: string) {
  const user = await requireUser();
  if (!/^[A-Z]{2}$/.test(country)) return { error: "Pick a country first." };
  const schoolId = await getOrCreateRegionalTeam(country);
  // Remember the country for mock percentiles too.
  await createAdminClient()
    .from("profiles")
    .update({ country })
    .eq("id", user.id);
  return joinSchool(schoolId);
}

const requestSchema = z.object({
  name: z.string().min(3).max(120),
  city: z.string().max(80).optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
});

export async function requestSchool(input: z.infer<typeof requestSchema>) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the school details." };
  const admin = createAdminClient();

  const { count } = await admin
    .from("school_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .eq("status", "pending");
  if ((count ?? 0) >= 3) {
    return { error: "You already have pending school requests." };
  }

  const { error } = await admin.from("school_requests").insert({
    name: parsed.data.name.trim(),
    city: normalizeCity(parsed.data.city),
    country: parsed.data.country,
    requested_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/schools");
  return { ok: true };
}

/** Admin verification: approving creates the school and joins the requester. */
export async function reviewSchoolRequest(id: string, approve: boolean) {
  const { user } = await requireAdminUser();
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("school_requests")
    .select("id, name, city, country, requested_by, status")
    .eq("id", id)
    .maybeSingle();
  if (!request || request.status !== "pending") {
    return { error: "Request not found or already reviewed." };
  }

  let schoolId: string | null = null;
  if (approve) {
    const base = slugify(request.name);
    const slug = `${base}-${request.country?.toLowerCase() ?? "xx"}`;
    const { data: school, error } = await admin
      .from("schools")
      .upsert(
        {
          slug,
          name: request.name,
          city: normalizeCity(request.city),
          country: request.country,
          verified: true,
          created_by: request.requested_by,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) return { error: error.message };
    schoolId = school.id;
    await admin
      .from("school_members")
      .upsert({ user_id: request.requested_by, school_id: school.id });
    await admin.from("notifications").insert({
      user_id: request.requested_by,
      category: "school",
      title: `${request.name} is on the ladder — you're in`,
      href: "/schools",
    });
  }

  await admin
    .from("school_requests")
    .update({
      status: approve ? "approved" : "rejected",
      school_id: schoolId,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/schools");
  return { ok: true };
}

async function requireAdminUser() {
  const user = await requireUser();
  await requireAdmin();
  return { user };
}

/** Preset-only inter-school banner; free text can never cross school lines. */
export async function sendRivalryBanner(rivalryId: string, presetKey: string) {
  const user = await requireUser();
  if (!(presetKey in BANNER_PRESETS)) return { error: "Unknown banner." };
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Join a school first." };

  const { data: rivalry } = await admin
    .from("rivalries")
    .select("id, school_a, school_b, status")
    .eq("id", rivalryId)
    .maybeSingle();
  if (
    !rivalry ||
    rivalry.status !== "active" ||
    ![rivalry.school_a, rivalry.school_b].includes(membership.school_id)
  ) {
    return { error: "No active rivalry to post into." };
  }

  const { error } = await admin.from("rivalry_banners").insert({
    rivalry_id: rivalryId,
    school_id: membership.school_id,
    user_id: user.id,
    preset_key: presetKey,
  });
  if (error) return { error: error.message };
  revalidatePath("/schools");
  return { ok: true };
}
