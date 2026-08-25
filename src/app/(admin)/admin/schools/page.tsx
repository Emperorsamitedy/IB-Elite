import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SchoolRequests,
  type RequestRow,
} from "@/components/admin/school-requests";

export const metadata = { title: "School requests" };

export default async function AdminSchoolsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("school_requests")
    .select("id, name, city, country, created_at, profiles:requested_by(display_name)")
    .eq("status", "pending")
    .order("created_at");

  const requests: RequestRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    requester:
      (r.profiles as unknown as { display_name?: string })?.display_name ??
      "student",
    created_at: r.created_at,
  }));

  return <SchoolRequests requests={requests} />;
}
