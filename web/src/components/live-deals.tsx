"use client";

/**
 * The signed-in deal desk, shared by both dashboards.
 *
 * Shows the viewer's real enquiries, offers and leases from the database and
 * exposes exactly the actions the backend allows: respond to open offers
 * authored by the other side, advance a lease along its lifecycle, move
 * registration forward. Renders nothing when signed out (the dashboards'
 * sample content stands in) and nothing on the static demo build.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FileSignature, Inbox, Landmark, Loader2, Tag } from "lucide-react";
import { useAuth } from "./auth-context";
import { Badge } from "./ui";
import { IS_STATIC } from "@/lib/flags";
import { formatINR } from "@/lib/geo";
import { REGISTRATION_LABEL, type RegistrationStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

interface EnquiryDto {
  id: string;
  parcelId: string;
  parcelRef: string;
  status: string;
  message: string | null;
  createdAt: string;
  parcel: { village: string; areaAcres: number; rentAnnual: number };
}
interface OfferDto {
  id: string;
  parcelId: string;
  parcelRef: string;
  village: string;
  areaAcres: number;
  status: string;
  rentAnnual: number;
  leaseYears: number;
  note: string | null;
  createdAt: string;
  viewerIsOwner: boolean;
  actorRole: string;
  canAct: boolean;
}
interface LeaseDto {
  id: string;
  ref: string;
  parcelId: string;
  parcelRef: string;
  village: string;
  areaAcres: number;
  status: string;
  registrationStatus: RegistrationStatus;
  rentAnnual: number;
  startDate: string | null;
  endDate: string | null;
  role: "lessee" | "lessor";
  nextTransitions: string[];
}

const LEASE_STEP_LABEL: Record<string, string> = {
  terms_agreed: "Agree terms",
  agreement_generated: "Generate agreement",
  signed: "Mark signed",
  active: "Activate lease",
  completed: "Complete",
  terminated: "Terminate",
};

const NEXT_REGISTRATION: Partial<Record<RegistrationStatus, RegistrationStatus>> = {
  unregistered: "stamped",
  stamped: "submitted_for_registration",
  submitted_for_registration: "registered",
};

/** Row actions sit below the .btn default size — these are inline, not primary. */
const ROW_BTN = "btn px-3.5 py-1.5 text-xs";

export function LiveDeals({ mode }: { mode: "owner" | "farmer" }) {
  const { user, ready } = useAuth();
  const [enquiries, setEnquiries] = useState<{ asLessee: EnquiryDto[]; asOwner: EnquiryDto[] }>({
    asLessee: [],
    asOwner: [],
  });
  const [offers, setOffers] = useState<OfferDto[]>([]);
  const [leases, setLeases] = useState<LeaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, o, l] = await Promise.all([
        fetch("/api/enquiries").then((r) => r.json()),
        fetch("/api/offers").then((r) => r.json()),
        fetch("/api/leases").then((r) => r.json()),
      ]);
      setEnquiries({ asLessee: e.asLessee ?? [], asOwner: e.asOwner ?? [] });
      setOffers(o.offers ?? []);
      setLeases(l.leases ?? []);
    } catch {
      setError("Could not load your activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !IS_STATIC) void load();
  }, [user, load]);

  if (IS_STATIC || !ready || !user) return null;

  async function act(url: string, body: unknown, id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const myEnquiries = mode === "owner" ? enquiries.asOwner : enquiries.asLessee;
  const relevantOffers = offers.filter((o) => (mode === "owner" ? o.viewerIsOwner : !o.viewerIsOwner));
  const relevantLeases = leases.filter((l) => (mode === "owner" ? l.role === "lessor" : l.role === "lessee"));

  const empty = !loading && myEnquiries.length === 0 && relevantOffers.length === 0 && relevantLeases.length === 0;

  return (
    <section
      className="card ticks mb-10 p-5 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--brand) 5%, var(--surface))",
        borderColor: "color-mix(in srgb, var(--brand) 26%, var(--line))",
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display flex items-center gap-2.5 text-lg">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand text-brand-ink">
            <Inbox className="h-4 w-4" aria-hidden />
          </span>
          Your live activity
        </h2>
        <Badge tone="good">Signed in · real data</Badge>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your activity…
        </p>
      ) : empty ? (
        <p className="max-w-prose py-2 text-sm leading-relaxed text-ink-muted">
          {mode === "farmer"
            ? "No activity yet — open a parcel and send an enquiry or an offer."
            : "No activity yet on your parcels. Claim a sample owner below to see incoming enquiries, or wait for the first enquiry."}
        </p>
      ) : (
        <div className="space-y-7">
          {myEnquiries.length > 0 && (
            <div>
              <h3 className="eyebrow mb-2.5 border-b border-line pb-2">
                Enquiries {mode === "owner" ? "received" : "sent"}
              </h3>
              <ul className="space-y-2">
                {myEnquiries.map((e) => (
                  <li key={e.id} className="card px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <a
                        href={`/parcel/${e.parcelId}`}
                        className="focus-ring rounded text-sm font-semibold text-ink hover:text-brand"
                      >
                        {e.parcel.village} ·{" "}
                        <span className="readout">{e.parcel.areaAcres.toFixed(1)} ac</span>
                      </a>
                      <span className="readout text-xs text-ink-faint">{e.parcelRef}</span>
                    </div>
                    {e.message && (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">“{e.message}”</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {relevantOffers.length > 0 && (
            <div>
              <h3 className="eyebrow mb-2.5 flex items-center gap-1.5 border-b border-line pb-2">
                <Tag className="h-3.5 w-3.5" aria-hidden /> Offers
              </h3>
              <ul className="space-y-2">
                {relevantOffers.map((o) => (
                  <li key={o.id} className="card px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a
                          href={`/parcel/${o.parcelId}`}
                          className="focus-ring rounded text-sm font-semibold text-ink hover:text-brand"
                        >
                          {o.village} · <span className="readout">{o.areaAcres.toFixed(1)} ac</span>
                        </a>
                        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                          <span className="readout font-semibold text-ink">
                            {formatINR(o.rentAnnual)}
                          </span>
                          /yr · <span className="readout">{o.leaseYears}</span> yrs
                          {o.note ? ` · “${o.note}”` : ""}
                          {o.actorRole === "owner" ? " · counter-offer from owner" : ""}
                        </p>
                      </div>
                      <Badge
                        tone={o.status === "accepted" ? "good" : o.status === "open" ? "pending" : "muted"}
                      >
                        {o.status}
                      </Badge>
                    </div>
                    {o.canAct && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => act(`/api/offers/${o.id}/respond`, { action: "accept" }, o.id)}
                          className={cn(ROW_BTN, "btn-primary")}
                        >
                          Accept → draft lease
                        </button>
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => {
                            const rent = window.prompt("Counter rent (₹/year):", String(o.rentAnnual));
                            if (!rent) return;
                            act(
                              `/api/offers/${o.id}/respond`,
                              { action: "counter", counter: { rentAnnual: Number(rent), leaseYears: o.leaseYears } },
                              o.id,
                            );
                          }}
                          className={cn(ROW_BTN, "btn-ghost")}
                        >
                          Counter
                        </button>
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => act(`/api/offers/${o.id}/respond`, { action: "reject" }, o.id)}
                          className={cn(ROW_BTN, "btn-ghost text-danger")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {relevantLeases.length > 0 && (
            <div>
              <h3 className="eyebrow mb-2.5 flex items-center gap-1.5 border-b border-line pb-2">
                <FileSignature className="h-3.5 w-3.5" aria-hidden /> Leases
              </h3>
              <ul className="space-y-2">
                {relevantLeases.map((l) => {
                  const nextReg = NEXT_REGISTRATION[l.registrationStatus];
                  return (
                    <li key={l.id} className="card px-4 py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {l.village} · <span className="readout">{l.areaAcres.toFixed(1)} ac</span>
                            <span className="readout ml-2 text-xs font-normal text-ink-faint">
                              {l.ref}
                            </span>
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                            <span className="readout font-semibold text-ink">
                              {formatINR(l.rentAnnual)}
                            </span>
                            /yr · <span className="readout">{l.startDate}</span> →{" "}
                            <span className="readout">{l.endDate}</span> · you are the{" "}
                            {l.role === "lessor" ? "owner" : "cultivator"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={l.status === "active" ? "good" : "pending"}>{l.status.replace(/_/g, " ")}</Badge>
                          <Badge tone={l.registrationStatus === "registered" ? "good" : "neutral"}>
                            <Landmark className="h-3 w-3" aria-hidden />
                            {REGISTRATION_LABEL[l.registrationStatus]}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {l.nextTransitions
                          .filter((t) => t !== "terminated")
                          .map((t) => (
                            <button
                              key={t}
                              type="button"
                              disabled={busyId === l.id}
                              onClick={() => act(`/api/leases/${l.id}/advance`, { to: t }, l.id)}
                              className={cn(ROW_BTN, t === "completed" ? "btn-ghost" : "btn-primary")}
                            >
                              {LEASE_STEP_LABEL[t] ?? t} <ArrowRight className="h-3 w-3" aria-hidden />
                            </button>
                          ))}
                        {nextReg && l.status !== "draft" && (
                          <button
                            type="button"
                            disabled={busyId === l.id}
                            onClick={() => act(`/api/leases/${l.id}/registration`, { to: nextReg }, l.id)}
                            className={cn(ROW_BTN, "btn-ghost")}
                          >
                            Registration → {REGISTRATION_LABEL[nextReg]}
                          </button>
                        )}
                      </div>
                      <p className="mt-3 border-t border-line pt-2.5 text-xs leading-relaxed text-ink-faint">
                        This lease creates no tenancy or occupancy rights; possession reverts on expiry.
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[10px] border px-3 py-2 text-xs leading-relaxed text-danger"
          style={{
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)",
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
