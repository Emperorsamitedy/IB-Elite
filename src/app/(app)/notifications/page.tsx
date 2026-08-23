import { revalidatePath } from "next/cache";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: messages.notifications.title };

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, category, title, body, href, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  async function markAllRead() {
    "use server";
    const user = await requireUser();
    const supabase = await createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    revalidatePath("/notifications");
  }

  const list = rows ?? [];
  const hasUnread = list.some((n) => n.read_at === null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Bell className="h-5 w-5" /> {messages.notifications.title}
        </h1>
        {hasUnread && (
          <form action={markAllRead}>
            <Button variant="secondary" size="sm" type="submit">
              {messages.notifications.markAllRead}
            </Button>
          </form>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={messages.notifications.title}
          description={messages.notifications.empty}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul>
              {list.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "border-b border-border px-5 py-3.5 last:border-0",
                    n.read_at === null && "bg-surface-2/60",
                  )}
                >
                  {n.href ? (
                    <Link href={n.href} className="block hover:text-accent">
                      <NotificationBody n={n} />
                    </Link>
                  ) : (
                    <NotificationBody n={n} />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NotificationBody({
  n,
}: {
  n: { title: string; body: string | null; category: string; created_at: string };
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{n.title}</span>
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
    </div>
  );
}
