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
    <div className="mb-8 rounded-xl border border-gold/35 bg-gold/[0.06] px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <KeyRound className="h-3.5 w-3.5 text-[#8a6b22] dark:text-gold" />
        Pilot mode: act as a sample landowner
      </p>
      <p className="mt-1 text-[12.5px] muted">
        Link your account to one of the sample owners to receive their enquiries and offers and
        manage their parcels here. In the real pilot this is replaced by identity onboarding.
      </p>
      {user ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <select
            aria-label="Sample owner"
            className="surface focus-ring rounded-lg border px-2.5 py-1.5 text-[13px]"
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
            className="focus-ring flex items-center gap-1.5 rounded-full bg-forest-900 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Claim parcels
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          className="focus-ring mt-2.5 rounded-full bg-forest-900 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-forest-700 dark:bg-forest-500"
        >
          Sign in to try it
        </button>
      )}
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
