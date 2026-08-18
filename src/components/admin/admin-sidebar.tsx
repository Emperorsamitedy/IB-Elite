"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileQuestion,
  FolderTree,
  Users,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const SECTIONS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/questions", label: "Questions", icon: FileQuestion },
  { href: "/admin/syllabus", label: "Curriculum", icon: FolderTree },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-border bg-surface lg:w-56">
      <div className="flex h-14 items-center gap-2 px-3 lg:px-4">
        <Logo showWordmark={false} />
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground lg:inline">
          Admin
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {SECTIONS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/app"
        title="Back to app"
        className="m-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">Back to app</span>
      </Link>
    </aside>
  );
}
