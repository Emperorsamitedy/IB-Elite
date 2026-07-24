"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Shield } from "lucide-react";
import { Logo } from "@/components/logo";
import { NAV_ITEMS } from "@/lib/constants";
import { ICONS } from "@/components/app/nav-icons";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface/60 md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/app">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  active
                    ? "text-accent"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(pathname, "/admin")
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Shield className="h-[1.15rem] w-[1.15rem]" />
            Admin
          </Link>
        )}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, "/settings")
              ? "bg-accent-soft text-accent"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <Settings className="h-[1.15rem] w-[1.15rem]" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
