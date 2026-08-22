"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { BrandMark } from "./brand-mark";
import { HeaderNav } from "./header-nav";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/records", label: "Find my land" },
  { href: "/list-land", label: "List your land" },
  { href: "/dashboard/owner", label: "Landowners" },
  { href: "/dashboard/farmer", label: "Cultivators" },
  { href: "/about", label: "About" },
];

/** The brand's wheat spike, on its badge. */
function Mark() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand text-brand-ink transition-transform duration-200 group-hover:-translate-y-px"
    >
      <BrandMark className="h-[19px] w-[16px]" />
    </span>
  );
}

export function SiteHeader() {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--canvas)_86%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-7 px-4 sm:px-6">
        <Link href="/" className="focus-ring group flex items-center gap-2.5">
          <Mark />
          <span className="flex flex-col leading-none">
            <span translate="no" className="notranslate display text-[17px] font-semibold tracking-tight">
              FarmKaro
            </span>
            <span className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              {t("Jabalpur pilot")}
            </span>
          </span>
        </Link>

        <HeaderNav items={NAV.map((n) => ({ ...n, label: t(n.label) }))} />

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
          <Link href="/discover" className="btn btn-primary hidden sm:inline-flex">
            {t("Find farmland")}
          </Link>
        </div>
      </div>
    </header>
  );
}
