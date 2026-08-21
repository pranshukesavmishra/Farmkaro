import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/records", label: "Find my land" },
  { href: "/list-land", label: "List your land" },
  { href: "/dashboard/owner", label: "Landowners" },
  { href: "/dashboard/farmer", label: "Cultivators" },
];

/** Survey-mark monogram: a plot outline with a centre registration point. */
function Mark() {
  return (
    <span
      aria-hidden
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand text-brand-ink"
    >
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 6.5 10.5 3l6.5 4v7.5L9.5 18 3 14Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeDasharray="2.6 2"
          opacity="0.95"
        />
        <circle cx="10" cy="10.5" r="2.1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--canvas)_86%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-7 px-4 sm:px-6">
        <Link href="/" className="focus-ring group flex items-center gap-2.5">
          <Mark />
          <span className="flex flex-col leading-none">
            <span className="display text-[17px] font-semibold tracking-tight">FarmKaro</span>
            <span className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              Jabalpur pilot
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="focus-ring rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
          <Link href="/discover" className="btn btn-primary hidden sm:inline-flex">
            Find farmland
          </Link>
        </div>
      </div>
    </header>
  );
}
