"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Compass, House, LayoutDashboard, ScrollText } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/records", label: "My land", icon: ScrollText },
  { href: "/list-land", label: "List land", icon: CirclePlus },
  { href: "/dashboard/owner", label: "Dashboard", icon: LayoutDashboard },
] as const;

/**
 * The phone experience's spine: a floating glass tab bar, app-grade.
 * Five thumb-first destinations, a sprung active state, safe-area aware.
 * Desktop never sees it (md:hidden) — the header nav owns that width.
 */
export function MobileTabBar() {
  const raw = usePathname() ?? "";
  const path = raw.replace(/\/$/, "") || "/";
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <nav
        aria-label="Primary"
        className="mx-auto mb-0 flex w-[min(94%,26rem)] items-stretch justify-between rounded-2xl border border-line px-1.5 py-1.5 shadow-[0_10px_34px_rgba(0,10,6,0.35)] backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}
      >
        {TABS.map((t) => {
          const active =
            t.href === "/" ? path === "/" : path === t.href || path.startsWith(t.href + "/");
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring relative flex min-w-14 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200 active:scale-90",
                active ? "text-brand" : "text-ink-faint hover:text-ink",
              )}
            >
              <span
                className="grid h-7 w-11 place-items-center rounded-full transition-all duration-200"
                style={{
                  background: active ? "color-mix(in srgb, var(--brand) 14%, transparent)" : undefined,
                }}
              >
                <Icon
                  className={cn("h-[19px] w-[19px] transition-transform duration-200", active && "-translate-y-px")}
                  strokeWidth={active ? 2.3 : 1.9}
                  aria-hidden
                />
              </span>
              <span className={cn("text-[9.5px] leading-none tracking-wide", active ? "font-semibold" : "font-medium")}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
