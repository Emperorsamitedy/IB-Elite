"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Radio, School, Settings, Shield } from "lucide-react";
import { Logo } from "@/components/logo";
import { NAV_ITEMS } from "@/lib/constants";
import { ICONS } from "@/components/app/nav-icons";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Active items are marked with a red margin rule, like an examiner's tick. */
function itemClass(active: boolean) {
  return cn(
    "group flex items-center gap-3 border-l-2 py-2 pl-4 pr-3 text-sm transition-colors",
    active
      ? "border-accent bg-surface-2/70 font-semibold text-foreground"
      : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
  );
}

export function AppSidebar({
  isAdmin,
  mockEnabled,
  schoolsEnabled,
  signalEnabled,
}: {
  isAdmin: boolean;
  mockEnabled?: boolean;
  schoolsEnabled?: boolean;
  signalEnabled?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/app">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 py-3">
        {mockEnabled && (
          <Link href="/mock" className={itemClass(isActive(pathname, "/mock"))}>
            <Globe
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                isActive(pathname, "/mock")
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            />
            World Mock
          </Link>
        )}
        {schoolsEnabled && (
          <Link
            href="/schools"
            className={itemClass(isActive(pathname, "/schools"))}
          >
            <School
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                isActive(pathname, "/schools")
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            />
            School Wars
          </Link>
        )}
        {signalEnabled && (
          <Link href="/signal" className={itemClass(isActive(pathname, "/signal"))}>
            <Radio
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                isActive(pathname, "/signal")
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            />
            The Signal
          </Link>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={itemClass(active)}
            >
              <Icon
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border py-3">
        {isAdmin && (
          <Link href="/admin" className={itemClass(isActive(pathname, "/admin"))}>
            <Shield className="h-[1.15rem] w-[1.15rem]" />
            Admin
          </Link>
        )}
        <Link
          href="/settings"
          className={itemClass(isActive(pathname, "/settings"))}
        >
          <Settings className="h-[1.15rem] w-[1.15rem]" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
