import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Sprout } from "lucide-react";

const NAV = [
  { href: "/discover", label: "Discover land" },
  { href: "/dashboard/owner", label: "For landowners" },
  { href: "/dashboard/farmer", label: "For cultivators" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-md">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-forest-900 text-forest-100">
            <Sprout className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">FarmKaro</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="focus-ring rounded-md px-3 py-1.5 text-[13.5px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/discover"
            className="focus-ring rounded-full bg-forest-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-forest-700 dark:bg-forest-500 dark:hover:bg-forest-300 dark:hover:text-forest-950"
          >
            Find farmland
          </Link>
        </div>
      </div>
    </header>
  );
}
