"use client";

/**
 * Session context + login dialog.
 *
 * Phone -> OTP, two steps in one small sheet. While no SMS provider is
 * configured the server echoes the code (`devOtp`) and the dialog shows it
 * inline, clearly labelled — the flow is identical to production, only the
 * delivery channel differs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, LockKeyhole, Phone, X } from "lucide-react";
import { IS_STATIC } from "@/lib/flags";
import { cn } from "@/lib/cn";

export interface SessionUser {
  id: string;
  phone: string;
  fullName: string | null;
  roles: string[];
  seedOwnerId: string | null;
}

interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  openLogin: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: IS_STATIC,
  openLogin: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(IS_STATIC);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (IS_STATIC) return;
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, ready, openLogin: () => setOpen(true), logout, refresh }}>
      {children}
      {open && !IS_STATIC && (
        <LoginDialog
          onClose={() => setOpen(false)}
          onSuccess={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function LoginDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Could not send the code.");
      setDevOtp(data.devOtp ?? null);
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Could not verify the code.");
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "surface focus-ring w-full rounded-lg border px-3 py-2.5 text-[15px] font-mono tracking-wide placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--fg-muted)]";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to FarmKaro"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">Sign in</h2>
            <p className="mt-0.5 text-[13px] muted">
              {step === "phone" ? "We send a one-time code to your phone." : `Code sent to ${phone}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -m-1 rounded-md p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <X className="h-4.5 w-4.5 h-5 w-5" />
          </button>
        </div>

        {step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestCode();
            }}
            className="space-y-3"
          >
            <label htmlFor="login-phone" className="flex items-center gap-1.5 text-[12.5px] font-medium muted">
              <Phone className="h-3.5 w-3.5" /> Mobile number
            </label>
            <input
              id="login-phone"
              ref={firstField}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile"
              className={inputCls}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || phone.replace(/\D/g, "").length < 10}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send code
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="space-y-3"
          >
            <label htmlFor="login-code" className="flex items-center gap-1.5 text-[12.5px] font-medium muted">
              <LockKeyhole className="h-3.5 w-3.5" /> One-time code
            </label>
            <input
              id="login-code"
              ref={firstField}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className={cn(inputCls, "text-center text-[19px]")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {devOtp && (
              <p className="rounded-lg bg-gold/12 px-3 py-2 text-[12.5px] leading-snug text-[#8a6b22] dark:text-gold">
                No SMS provider is connected in this environment, so your code is{" "}
                <strong className="font-mono text-[14px]">{devOtp}</strong>. In production this
                arrives by SMS only.
              </p>
            )}
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify &amp; sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="focus-ring w-full rounded-full py-1.5 text-[12.5px] font-medium muted hover:text-[var(--fg)]"
            >
              Use a different number
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
