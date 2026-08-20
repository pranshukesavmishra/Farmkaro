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
import { cn } from "@/lib/cn";

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
      <p className="text-center text-[12px] leading-snug muted">
        Enquiries, offers and digital leases run in the pilot app — this public demo is read-only.
      </p>
    );
  }

  const gate = (d: Dialog) => (user ? setDialog(d) : openLogin());

  return (
    <>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => gate("enquiry")}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 dark:bg-forest-500"
        >
          <MessageSquare className="h-4 w-4" /> Send enquiry
        </button>
        <button
          type="button"
          onClick={() => gate("offer")}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full border hairline px-4 py-2.5 text-[14px] font-semibold hover:bg-[var(--bg)]"
        >
          <Tag className="h-4 w-4" /> Make an offer
        </button>
        {done && (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-forest-500/10 px-3 py-2 text-[12.5px] font-medium text-forest-500 dark:text-forest-300">
            <Check className="h-3.5 w-3.5" /> {done}
          </p>
        )}
        <p className="text-center text-[12px] muted">
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface w-full max-w-md rounded-2xl border p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -m-1 rounded-md p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "surface focus-ring w-full rounded-lg border px-3 py-2.5 text-[14px] placeholder:text-[var(--fg-muted)]";
const labelCls = "mb-1.5 block text-[12.5px] font-medium muted";

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
        className="space-y-3"
      >
        <div>
          <label htmlFor="enq-msg" className={labelCls}>
            Your message to the owner
          </label>
          <textarea
            id="enq-msg"
            rows={4}
            className={cn(inputCls, "resize-none leading-relaxed")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || message.trim().length < 3}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send enquiry
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
        className="space-y-3"
      >
        <p className="flex items-center gap-1.5 text-[12.5px] muted">
          <CalendarClock className="h-3.5 w-3.5" />
          Asking rent: {formatINR(askingRent)}/year. Your offer goes to the owner for
          acceptance, rejection or counter.
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
              className={inputCls}
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
              className={inputCls}
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
            className={inputCls}
            placeholder="e.g. can pay half-yearly in advance"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !Number(rent) || Number(rent) < 1000}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send offer
        </button>
      </form>
    </Shell>
  );
}
