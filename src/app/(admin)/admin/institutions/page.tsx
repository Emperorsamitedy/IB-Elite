import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InstitutionManager } from "@/components/admin/institution-manager";

export const metadata = { title: "Institutions" };

export default async function AdminInstitutionsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("institutions")
    .select("id, name, kind, approved, institution_members(user_id), institution_audit_log(id)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    approved: i.approved,
    members: (i.institution_members ?? []).length,
    auditEntries: (i.institution_audit_log ?? []).length,
  }));

  return <InstitutionManager institutions={rows} />;
}
