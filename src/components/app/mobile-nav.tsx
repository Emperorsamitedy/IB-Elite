"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarRange,
  Globe,
  Menu,
  Radio,
  School,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";
import { ICONS } from "@/components/app/nav-icons";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Bar shows the four core tabs; everything else lives in the More sheet. */
const BAR_ITEMS = MOBILE_NAV_ITEMS.filter((item) =>
  ["/app", "/practice", "/subjects", "/tutor"].includes(item.href),
);

export function MobileNav({
  mockEnabled,
  schoolsEnabled,
  signalEnabled,
}: {
  mockEnabled?: boolean;
  schoolsEnabled?: boolean;
  signalEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const moreItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/ladder", label: "Ranked Duels", icon: ICONS.Swords },
    ...(mockEnabled ? [{ href: "/mock", label: "World Mock", icon: Globe }] : []),
    ...(schoolsEnabled
      ? [{ href: "/schools", label: "School Wars", icon: School }]
      : []),
    ...(signalEnabled
      ? [{ href: "/signal", label: "The Signal", icon: Radio }]
      : []),
    { href: "/mistakes", label: "Mistakes", icon: ICONS.AlertCircle },
    { href: "/bookmarks", label: "Bookmarks", icon: ICONS.Bookmark },
    { href: "/whiteboard", label: "Whiteboard", icon: ICONS.PencilRuler },
    { href: "/scans/upload", label: "Scan work", icon: ICONS.ScanLine },
    { href: "/plan", label: "Study Plan", icon: CalendarRange },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-lg md:hidden">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {BAR_ITEMS.map((item) => {
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

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center gap-1 border-t-2 py-2.5 text-[0.65rem] font-medium transition-colors",
                moreActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <Menu className="h-5 w-5" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-0">
            <div className="flex flex-col gap-0.5 p-3 pt-12">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted-foreground hover:bg-surface-2",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[1.15rem] w-[1.15rem]",
                        active ? "text-accent" : "text-muted-foreground",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
