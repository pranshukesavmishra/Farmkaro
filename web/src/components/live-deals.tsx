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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileSignature,
  Inbox,
  Landmark,
  Loader2,
  MessagesSquare,
  Send,
  Tag,
  X,
} from "lucide-react";
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
  conversationId: string | null;
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
  const [countering, setCountering] = useState<OfferDto | null>(null);
  const [thread, setThread] = useState<EnquiryDto | null>(null);

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
    if (user && !IS_STATIC) {
      void load();
      return;
    }
    // Signed out (or a different account signed in): drop the previous
    // account's activity and any dialog opened on it.
    setEnquiries({ asLessee: [], asOwner: [] });
    setOffers([]);
    setLeases([]);
    setThread(null);
    setCountering(null);
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, load]);

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
                    {e.conversationId && (
                      <button
                        type="button"
                        onClick={() => setThread(e)}
                        className={cn(ROW_BTN, "btn-ghost mt-2.5")}
                      >
                        <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
                        {mode === "owner" ? "Reply" : "Open conversation"}
                      </button>
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
                          onClick={() => setCountering(o)}
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
                        {/* Registration is recorded by the landowner's side
                            only — the cultivator sees the status, never the
                            control. */}
                        {mode === "owner" && nextReg && l.status !== "draft" && (
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

      {thread?.conversationId && (
        <MessageThread
          enquiry={thread}
          meId={user.id}
          onClose={() => setThread(null)}
        />
      )}

      {countering && (
        <CounterDialog
          offer={countering}
          onClose={() => setCountering(null)}
          onSubmit={(rentAnnual, leaseYears) => {
            const id = countering.id;
            setCountering(null);
            void act(
              `/api/offers/${id}/respond`,
              { action: "counter", counter: { rentAnnual, leaseYears } },
              id,
            );
          }}
        />
      )}
    </section>
  );
}

interface MessageDto {
  id: string;
  sender_id: string | null;
  body: string | null;
  system_event: string | null;
  created_at: string;
}

/**
 * The conversation an enquiry opens.
 *
 * Every enquiry has always created a thread server-side and recorded both
 * sides' messages against it, but nothing in the UI could reach it: you could
 * send one enquiry and then had no way to say anything further. This is that
 * thread — the same messages, the same authorisation, now readable and
 * answerable by the two parties to it.
 */
function MessageThread({
  enquiry,
  meId,
  onClose,
}: {
  enquiry: EnquiryDto;
  meId: string;
  onClose: () => void;
}) {
  const id = enquiry.conversationId!;
  const [messages, setMessages] = useState<MessageDto[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const foot = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the conversation.");
      setMessages(data.messages ?? []);
    } catch (e) {
      setError((e as Error).message);
      setMessages([]);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send that message.");
      setDraft("");
      await load();
      box.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fade-in fixed inset-0 z-50 grid place-items-center bg-forest-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation about ${enquiry.parcel.village}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card ticks rise flex max-h-[85vh] w-full max-w-lg flex-col p-6 shadow-lg sm:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="display text-lg">Conversation</h2>
            <p className="mt-1.5 truncate text-sm text-ink-muted">
              {enquiry.parcel.village} · <span className="readout">{enquiry.parcelRef}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -m-1.5 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          className="thin-scroll min-h-[9rem] flex-1 space-y-2.5 overflow-y-auto border-y border-line py-4"
          aria-live="polite"
        >
          {messages === null ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">No messages yet.</p>
          ) : (
            messages.map((m) =>
              m.system_event ? (
                <p key={m.id} className="eyebrow py-1 text-center">
                  {m.system_event.replace(/_/g, " ")}
                </p>
              ) : (
                <div
                  key={m.id}
                  className={cn("flex", m.sender_id === meId ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-[14px] border px-3.5 py-2.5",
                      m.sender_id === meId
                        ? "border-transparent bg-brand text-brand-ink"
                        : "border-line bg-surface-2 text-ink",
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                    <p
                      className={cn(
                        "readout mt-1 text-[10.5px]",
                        m.sender_id === meId ? "opacity-70" : "text-ink-faint",
                      )}
                    >
                      {new Date(m.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ),
            )
          )}
          <div ref={foot} />
        </div>

        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="msg-body" className="sr-only">
            Your message
          </label>
          <textarea
            id="msg-body"
            ref={box}
            rows={2}
            className="field resize-none leading-relaxed"
            placeholder="Write a reply…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter starts a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="btn btn-primary shrink-0 py-3"
            aria-label="Send message"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-xs leading-relaxed text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Countering is a priced decision, so it gets a real form: the offer restated,
 * the rent editable and validated, and the term changeable — not a browser
 * prompt that shows no context and accepts any string.
 */
function CounterDialog({
  offer,
  onClose,
  onSubmit,
}: {
  offer: OfferDto;
  onClose: () => void;
  onSubmit: (rentAnnual: number, leaseYears: number) => void;
}) {
  const [rent, setRent] = useState(String(offer.rentAnnual));
  const [years, setYears] = useState(String(offer.leaseYears));
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    first.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const value = Number(rent);
  const valid = Number.isFinite(value) && value >= 1000;
  const perAcre = valid && offer.areaAcres > 0 ? Math.round(value / offer.areaAcres) : null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 grid place-items-center bg-forest-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Counter this offer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card ticks rise w-full max-w-md p-6 shadow-lg sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="display text-lg">Counter this offer</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {offer.village} · <span className="readout">{offer.parcelRef}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -m-1.5 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <p className="flex gap-2 border-y border-line py-3 text-xs leading-relaxed text-ink-muted">
          <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
          <span>
            They offered <span className="readout text-ink">{formatINR(offer.rentAnnual)}</span>/year
            for {offer.leaseYears} year{offer.leaseYears === 1 ? "" : "s"}. Your counter replaces it
            and goes back to them to accept or decline.
          </span>
        </p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(value, Number(years));
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="counter-rent" className="eyebrow mb-2 block">
                Your rent (₹/year)
              </label>
              <input
                id="counter-rent"
                ref={first}
                type="number"
                min={1000}
                step={500}
                className="field readout"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="counter-years" className="eyebrow mb-2 block">
                Lease term
              </label>
              <select
                id="counter-years"
                className="field"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              >
                {["1", "2", "3", "5", "7", "9"].map((y) => (
                  <option key={y} value={y}>
                    {y} year{y === "1" ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-ink-muted" aria-live="polite">
            {valid ? (
              perAcre !== null ? (
                <>
                  That is <span className="readout text-ink">{formatINR(perAcre)}</span>/acre/year
                  across {offer.areaAcres.toFixed(2)} acres.
                </>
              ) : (
                <>Your counter: <span className="readout text-ink">{formatINR(value)}</span>/year.</>
              )
            ) : (
              "Enter a rent of at least ₹1,000 per year."
            )}
          </p>

          <button type="submit" disabled={!valid} className="btn btn-primary w-full py-3">
            Send counter
          </button>
        </form>
      </div>
    </div>
  );
}
