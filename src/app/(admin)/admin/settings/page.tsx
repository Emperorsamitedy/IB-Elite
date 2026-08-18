import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Admin settings" };

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Admin access is granted directly in Supabase by setting
          <code className="mx-1 font-mono text-xs">profiles.role</code>
          to <code className="font-mono text-xs">admin</code>. There is
          deliberately no UI for it.
        </CardContent>
      </Card>
    </div>
  );
}
