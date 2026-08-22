"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Desktop navigation with a live "you are here": the current section's link
 * holds full ink and carries a small brand underline. Client-side only for
 * the pathname — everything else in the header stays server-rendered.
 */
export function HeaderNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const raw = usePathname() ?? "";
  const path = raw.replace(/\/$/, "") || "/";
  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {items.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {n.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3.5 bottom-0.5 h-[2px] rounded-full bg-brand"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
