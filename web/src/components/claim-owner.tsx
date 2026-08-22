"use client";

/**
 * Pilot affordance: link the signed-in account to one of the sample owners
 * so their parcels, enquiries and offers flow to this account's dashboard.
 * Real onboarding replaces this with the Lease Desk's KYC flow.
 */
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "./auth-context";
import { IS_STATIC } from "@/lib/flags";

const SAMPLE_OWNERS = [
  { id: "own-1", name: "Ramesh Patel" },
  { id: "own-2", name: "Sunita Yadav" },
  { id: "own-3", name: "Devendra Singh Thakur" },
  { id: "own-4", name: "Kamla Bai Lodhi" },
  { id: "own-5", name: "Mohan Lal Kushwaha" },
  { id: "own-6", name: "Anil Jain" },
  { id: "own-7", name: "Shivkumar Patel" },
  { id: "own-8", name: "Rekha Verma" },
];

export function ClaimOwner() {
  const { user, ready, refresh, openLogin } = useAuth();
  const [choice, setChoice] = useState("own-1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (IS_STATIC || !ready) return null;
  if (user?.seedOwnerId) return null;

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/claim-owner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seedOwnerId: choice }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Could not claim.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card mb-8 p-5"
      style={{
        background: "var(--gold-soft)",
        borderColor: "color-mix(in srgb, var(--gold) 38%, transparent)",
      }}
    >
      <p className="eyebrow flex items-center gap-2" style={{ color: "var(--gold)" }}>
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        Pilot mode: act as a sample landowner
      </p>
      <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-ink-muted">
        Link your account to one of the sample owners to receive their enquiries and offers and
        manage their parcels here. In the real pilot this is replaced by identity onboarding.
      </p>
      {user ? (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Sample owner"
            className="field w-auto text-sm"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {SAMPLE_OWNERS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void claim()}
            className="btn btn-primary px-4 py-2 text-xs"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Claim parcels
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          className="btn btn-primary mt-4 px-4 py-2 text-xs"
        >
          Sign in to try it
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
