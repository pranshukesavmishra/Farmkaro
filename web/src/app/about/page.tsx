import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { FounderPhoto } from "@/components/founder-photo";
import { Tilt } from "@/components/tilt";
import { Github, Mail, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "About us · FarmKaro",
  description:
    "The two founders, the story, and the mission: making it safe to lease out farmland — and making leased-in land bankable.",
};

/**
 * About FarmKaro — the people and the why.
 *
 * Founder portraits load from /founders/aryan.jpg and /founders/pranshu.jpg
 * in web/public; until those files exist the initials monogram shows instead
 * (object-fail hiding needs no JS — the img simply sits above the monogram).
 *
 * Social links live in SOCIALS below. Only real, confirmed profiles belong
 * here — a guessed handle would point at a stranger — so Instagram/Facebook/X
 * ship empty until the founders supply them.
 */

const FOUNDERS = [
  {
    name: "Aryan Singh",
    role: "Co-founder",
    photo: "/founders/aryan.jpg",
    initials: "AS",
    line: "Leads FarmKaro's direction, partnerships and the Jabalpur pilot's field operations — the on-the-ground half of a trust business.",
  },
  {
    name: "Pranshu Kesav Mishra",
    role: "Co-founder",
    photo: "/founders/pranshu.jpg",
    initials: "PM",
    line: "Leads product and technology — the platform, FarmSelect AI and the verification rails that keep every parcel honest.",
  },
];

const SOCIALS: Array<{ label: string; href: string; icon: "wa" | "mail" | "gh" }> = [
  { label: "WhatsApp", href: "https://wa.me/919467871448", icon: "wa" },
  { label: "Email", href: "mailto:nextgradeinfo@gmail.com", icon: "mail" },
  { label: "GitHub", href: "https://github.com/pranshukesavmishra/Farmkaro", icon: "gh" },
  // Instagram / Facebook / X join this row the moment the real handles are
  // confirmed — never guessed.
];

const MILESTONES = [
  {
    k: "The observation",
    v: "Across Madhya Pradesh, good farmland sits fallow beside farmers who want more land — because leasing it out feels like risking the land itself.",
  },
  {
    k: "The start",
    v: "farmkaro.in began as a simple listings site. It taught us the real problem was never discovery — it was trust: verified ownership, walked boundaries, and a lease that creates no tenancy rights.",
  },
  {
    k: "The rebuild",
    v: "FarmKaro was rebuilt from the ground up as a verification-first platform: khasra-anchored parcels, a document-and-boundary ladder, FarmSelect AI marking, and registered fixed-term leases under MP's framework.",
  },
  {
    k: "Now",
    v: "The Jabalpur pilot: first verified listings, first registered lease concluded through the platform, first district at operational break-even.",
  },
];

const WORKING_ON = [
  "Onboarding the first verified landowners across Jabalpur's seven tehsils",
  "Field-executive playbook: documents checked, boundary walked, parcel marked verified",
  "Lease documentation vetted by local advocates under MP's land-leasing framework",
  "Land-records cooperation with the revenue department (MoU drafted)",
  "Credit-linkage groundwork so a registered lease opens bank and insurance doors",
];

const NEEDS = [
  { k: "Landowners", v: "with idle or under-used farmland in Jabalpur district" },
  { k: "Cultivators", v: "looking for verified land with a lease that protects both sides" },
  { k: "Field executives", v: "village-level partners who walk boundaries and build trust" },
  { k: "Advocates & surveyors", v: "local professionals for documentation and verification" },
];

const ACHIEVEMENTS = [
  "A complete working platform — live, public, and bilingual (English · हिन्दी)",
  "FarmSelect AI: one tap traces a field's boundary from satellite imagery, on any phone",
  "100+ automated tests and a 13-check browser suite guarding functionality, security and honesty",
  "Pilot groundwork codified: verification playbook, advocate brief, land-records MoU draft",
];

function SocialIcon({ icon }: { icon: "wa" | "mail" | "gh" }) {
  const cls = "h-4 w-4";
  if (icon === "wa") return <MessageCircle className={cls} aria-hidden />;
  if (icon === "mail") return <Mail className={cls} aria-hidden />;
  return <Github className={cls} aria-hidden />;
}

export default function AboutPage() {
  return (
    <div className="pb-24">
      {/* The wordmark, full lockup — with floating depth behind it */}
      <section className="relative overflow-hidden border-b border-line bg-canvas-2">
        <div
          aria-hidden
          className="fk-orb h-[420px] w-[420px] bg-brand"
          style={{ top: "-160px", right: "-90px", opacity: 0.28 }}
        />
        <div
          aria-hidden
          className="fk-orb h-[360px] w-[360px]"
          style={{ bottom: "-200px", left: "8%", background: "var(--gold)", opacity: 0.16, animationDelay: "-8s" }}
        />
        <div className="relative mx-auto max-w-shell px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
          <Tilt max={4} glare={false} className="inline-block rounded-2xl">
            <div className="flex items-center gap-4">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink"
                style={{ transform: "translateZ(26px)", boxShadow: "0 18px 40px -18px rgba(0,0,0,.6)" }}
              >
                <BrandMark className="h-9 w-7" />
              </span>
              <div className="leading-none" style={{ transform: "translateZ(14px)" }}>
                <p className="display text-3xl font-semibold tracking-[0.08em] sm:text-4xl">
                  FARM KARO
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.34em] text-ink-faint">
                  Agriculture&nbsp;Modernization
                </p>
              </div>
            </div>
          </Tilt>
          <h1 className="display mt-10 max-w-3xl text-2xl leading-snug sm:text-3xl">
            Making it safe to lease out farmland — and making leased-in land bankable.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            FarmKaro exists so a landowner never has to choose between fallow land and losing it,
            and a cultivator never has to farm on a handshake.
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6">
        <p className="eyebrow">The founders</p>
        <h2 className="display mt-2 text-xl">Two people, one promise</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {FOUNDERS.map((f) => (
            <Tilt key={f.name} max={6} className="rounded-2xl">
              <article className="card overflow-hidden p-0">
              <div className="relative aspect-[5/4] w-full overflow-hidden bg-surface-2">
                <span
                  aria-hidden
                  className="display absolute inset-0 grid place-items-center text-5xl font-semibold text-ink-faint"
                >
                  {f.initials}
                </span>
                <FounderPhoto src={f.photo} alt={`${f.name}, ${f.role} of FarmKaro`} />
              </div>
              <div className="p-5">
                <h3 className="display text-lg">{f.name}</h3>
                <p className="eyebrow mt-1">{f.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{f.line}</p>
              </div>
              </article>
            </Tilt>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="border-y border-line bg-canvas-2">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6">
          <p className="eyebrow">Our story</p>
          <h2 className="display mt-2 text-xl">From a listings page to a trust platform</h2>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {MILESTONES.map((m) => (
              <div key={m.k} className="bg-surface p-6">
                <dt className="eyebrow">{m.k}</dt>
                <dd className="mt-3 text-sm leading-relaxed text-ink-muted">{m.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Vision + working on + needs */}
      <section className="mx-auto max-w-shell grid gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
        <div>
          <p className="eyebrow">Our vision</p>
          <h2 className="display mt-2 text-lg leading-snug">
            Every acre working. Every lease on paper. Every farmer bankable.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            A rural land market where trust is infrastructure, not luck — starting in Jabalpur,
            then district by district, each one standing on its own economics before the next.
          </p>
        </div>
        <div>
          <p className="eyebrow">What we are working on</p>
          <ul className="mt-4 space-y-3">
            {WORKING_ON.map((w) => (
              <li key={w} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">What we need</p>
          <dl className="mt-4 space-y-4">
            {NEEDS.map((n) => (
              <div key={n.k}>
                <dt className="text-sm font-semibold">{n.k}</dt>
                <dd className="text-sm leading-relaxed text-ink-muted">{n.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Achievements */}
      <section className="border-y border-line bg-canvas-2">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6">
          <p className="eyebrow">Achievements so far</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => (
              <li key={a} className="card flex gap-3 p-5 text-sm leading-relaxed text-ink-muted">
                <BrandMark className="mt-0.5 h-5 w-4 shrink-0 text-brand" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Connect */}
      <section className="mx-auto max-w-shell px-4 pt-16 sm:px-6">
        <p className="eyebrow">Connect with us</p>
        <h2 className="display mt-2 text-xl">Talk to the founders directly</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="btn btn-ghost gap-2 px-4 py-2.5"
            >
              <SocialIcon icon={s.icon} />
              {s.label}
            </a>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-faint">
          Instagram, Facebook and X are coming online with the pilot&rsquo;s launch — until the
          official profiles are live, WhatsApp is the fastest way to reach us.
        </p>
        <div className="mt-10">
          <Link href="/list-land" className="btn btn-primary px-6 py-3">
            List your land
          </Link>
        </div>
      </section>
    </div>
  );
}
