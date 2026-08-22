"use client";

/**
 * The transactional panel on a parcel page: send an enquiry, make an offer.
 * On the static demo build these degrade to an honest notice instead of
 * dead buttons.
 */
import { useState } from "react";
import { CalendarClock, Check, Loader2, MessageSquare, Tag, X } from "lucide-react";
import { useAuth } from "./auth-context";
import { IS_STATIC } from "@/lib/flags";
import { formatINR } from "@/lib/geo";

interface Props {
  parcelId: string;
  rentAnnual: number;
  village: string;
}

type Dialog = "none" | "enquiry" | "offer";

export function ParcelActions({ parcelId, rentAnnual, village }: Props) {
  const { user, openLogin } = useAuth();
  const [dialog, setDialog] = useState<Dialog>("none");
  const [done, setDone] = useState<string | null>(null);

  if (IS_STATIC) {
    return (
      <p className="text-center text-xs leading-relaxed text-ink-muted">
        Enquiries, offers and digital leases run in the pilot app — this public demo is read-only.
      </p>
    );
  }

  const gate = (d: Dialog) => (user ? setDialog(d) : openLogin());

  return (
    <>
      <div className="space-y-2.5">
        <button type="button" onClick={() => gate("enquiry")} className="btn btn-primary w-full py-3">
          <MessageSquare className="h-4 w-4" aria-hidden /> Send enquiry
        </button>
        <button type="button" onClick={() => gate("offer")} className="btn btn-ghost w-full py-3">
          <Tag className="h-4 w-4" aria-hidden /> Make an offer
        </button>
        {done && (
          <p
            className="flex items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-medium text-positive"
            style={{
              background: "color-mix(in srgb, var(--positive) 10%, transparent)",
              borderColor: "color-mix(in srgb, var(--positive) 30%, transparent)",
            }}
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> {done}
          </p>
        )}
        <p className="text-center text-xs text-ink-faint">
          {user ? "The owner is notified instantly." : "You'll be asked to sign in first."}
        </p>
      </div>

      {dialog === "enquiry" && (
        <EnquiryDialog
          parcelId={parcelId}
          village={village}
          onClose={() => setDialog("none")}
          onDone={() => {
            setDialog("none");
            setDone("Enquiry sent to the owner.");
          }}
        />
      )}
      {dialog === "offer" && (
        <OfferDialog
          parcelId={parcelId}
          askingRent={rentAnnual}
          onClose={() => setDialog("none")}
          onDone={() => {
            setDialog("none");
            setDone("Offer sent to the owner.");
          }}
        />
      )}
    </>
  );
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fade-in fixed inset-0 z-50 grid place-items-center bg-forest-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card ticks rise w-full max-w-md p-6 shadow-lg sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="display text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -m-1.5 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const labelCls = "eyebrow mb-2 block";
const errorCls = "rounded-[10px] border px-3 py-2 text-xs leading-relaxed text-danger";
const errorStyle = {
  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
  borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)",
};

function EnquiryDialog({
  parcelId,
  village,
  onClose,
  onDone,
}: {
  parcelId: string;
  village: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState(
    `Namaste, I am interested in leasing your land in ${village}. Is it still available?`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parcelId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the enquiry.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Send an enquiry" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="enq-msg" className={labelCls}>
            Your message to the owner
          </label>
          <textarea
            id="enq-msg"
            rows={4}
            className="field resize-none leading-relaxed"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className={errorCls} style={errorStyle}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || message.trim().length < 3}
          className="btn btn-primary w-full py-3"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send enquiry
        </button>
      </form>
    </Shell>
  );
}

function OfferDialog({
  parcelId,
  askingRent,
  onClose,
  onDone,
}: {
  parcelId: string;
  askingRent: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rent, setRent] = useState(String(askingRent));
  const [years, setYears] = useState("3");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parcelId,
          rentAnnual: Number(rent),
          leaseYears: Number(years),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the offer.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Make an offer" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <p className="flex gap-2 border-y border-line py-3 text-xs leading-relaxed text-ink-muted">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
          <span>
            Asking rent: <span className="readout text-ink">{formatINR(askingRent)}</span>/year. Your
            offer goes to the owner for acceptance, rejection or counter.
          </span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="offer-rent" className={labelCls}>
              Rent (₹/year)
            </label>
            <input
              id="offer-rent"
              type="number"
              min={1000}
              step={500}
              className="field readout"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="offer-years" className={labelCls}>
              Lease term
            </label>
            <select
              id="offer-years"
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
        <div>
          <label htmlFor="offer-note" className={labelCls}>
            Note (optional)
          </label>
          <input
            id="offer-note"
            className="field"
            placeholder="e.g. can pay half-yearly in advance"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className={errorCls} style={errorStyle}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !Number(rent) || Number(rent) < 1000}
          className="btn btn-primary w-full py-3"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send offer
        </button>
      </form>
    </Shell>
  );
}
