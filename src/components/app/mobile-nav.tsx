"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";
import { ICONS } from "@/components/app/nav-icons";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-lg md:hidden">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 border-t-2 py-2.5 text-[0.65rem] font-medium transition-colors",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
