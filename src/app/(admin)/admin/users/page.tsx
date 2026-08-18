import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, onboarded, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  const emailById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]),
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">User directory</h1>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Signed up</th>
                <th className="px-4 py-2.5">Role</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-4 py-2.5">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {emailById.get(p.id) ?? "—"}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={p.role === "admin" ? "accent" : "outline"}
                      className="capitalize"
                    >
                      {p.role}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
