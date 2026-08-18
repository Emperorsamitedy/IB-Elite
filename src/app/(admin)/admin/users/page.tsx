import { Suspense } from "react";
import { listAdminUsers } from "@/lib/admin/users";
import { UserDirectory } from "@/components/admin/user-directory";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const search = sp.q ?? "";

  const { rows, total } = await listAdminUsers({ page, search });

  return (
    <Suspense>
      <UserDirectory rows={rows} total={total} page={page} search={search} />
    </Suspense>
  );
}
