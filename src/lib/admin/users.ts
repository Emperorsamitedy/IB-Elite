import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeFromAccuracy } from "@/lib/utils";

export type AdminUserSubject = {
  subjectId: string;
  name: string;
  level: string | null;
  grade: number;
  attempts: number;
};

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  signedUpAt: string;
  plan: string;
  lastActiveAt: string | null;
  subjects: AdminUserSubject[];
};

export type AdminUsersPage = {
  rows: AdminUserRow[];
  total: number;
};

const PAGE_SIZE = 25;

/**
 * Read-only directory. Standings reuse `gradeFromAccuracy` — the same 1–7
 * banding the student dashboard's 7-gauge uses — over each user's attempts.
 */
export async function listAdminUsers({
  page = 1,
  search = "",
  pageSize = PAGE_SIZE,
}: {
  page?: number;
  search?: string;
  pageSize?: number;
}): Promise<AdminUsersPage> {
  const supabase = createAdminClient();

  const { data: authUsers } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .order("created_at", { ascending: false });

  const needle = search.trim().toLowerCase();
  const matched = (profiles ?? []).filter((p) => {
    if (!needle) return true;
    const email = emailById.get(p.id) ?? "";
    return (
      (p.full_name ?? "").toLowerCase().includes(needle) ||
      email.toLowerCase().includes(needle)
    );
  });

  const total = matched.length;
  const slice = matched.slice((page - 1) * pageSize, page * pageSize);
  const ids = slice.map((p) => p.id);
  if (ids.length === 0) return { rows: [], total };

  const [subs, userSubjects, attempts] = await Promise.all([
    supabase.from("subscriptions").select("user_id, status").in("user_id", ids),
    supabase
      .from("user_subjects")
      .select("user_id, subject_id, subjects(name), levels(code)")
      .in("user_id", ids),
    supabase
      .from("question_attempts")
      .select("user_id, is_correct, created_at, questions(subject_id)")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const planByUser = new Map(
    (subs.data ?? []).map((s) => [s.user_id, s.status]),
  );

  const statsByUser = new Map<
    string,
    { lastActiveAt: string | null; bySubject: Map<string, { a: number; c: number }> }
  >();
  for (const a of attempts.data ?? []) {
    const subjectId = (a.questions as { subject_id: string } | null)?.subject_id;
    const entry = statsByUser.get(a.user_id) ?? {
      lastActiveAt: null,
      bySubject: new Map(),
    };
    if (!entry.lastActiveAt || a.created_at > entry.lastActiveAt) {
      entry.lastActiveAt = a.created_at;
    }
    if (subjectId) {
      const s = entry.bySubject.get(subjectId) ?? { a: 0, c: 0 };
      s.a += 1;
      if (a.is_correct) s.c += 1;
      entry.bySubject.set(subjectId, s);
    }
    statsByUser.set(a.user_id, entry);
  }

  const rows: AdminUserRow[] = slice.map((p) => {
    const stats = statsByUser.get(p.id);
    const subjects = (userSubjects.data ?? [])
      .filter((r) => r.user_id === p.id)
      .map((r) => {
        const counts = stats?.bySubject.get(r.subject_id) ?? { a: 0, c: 0 };
        const accuracy = counts.a ? counts.c / counts.a : 0;
        return {
          subjectId: r.subject_id,
          name: (r.subjects as { name: string } | null)?.name ?? "—",
          level: (r.levels as { code: string } | null)?.code ?? null,
          attempts: counts.a,
          grade: counts.a ? gradeFromAccuracy(accuracy) : 0,
        };
      });

    return {
      id: p.id,
      name: p.full_name,
      email: emailById.get(p.id) ?? "—",
      signedUpAt: p.created_at,
      plan: planByUser.get(p.id) ?? "free",
      lastActiveAt: stats?.lastActiveAt ?? null,
      subjects,
    };
  });

  return { rows, total };
}
