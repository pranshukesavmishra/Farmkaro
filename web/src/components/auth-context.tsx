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

  return (
    <div
      className="fade-in fixed inset-0 z-50 grid place-items-center bg-forest-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to FarmKaro"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card ticks rise w-full max-w-sm p-6 shadow-lg sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="display text-lg">Sign in</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {step === "phone" ? (
                "We send a one-time code to your phone."
              ) : (
                <>
                  Code sent to <span className="readout text-ink">{phone}</span>
                </>
              )}
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

        {step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestCode();
            }}
            className="space-y-3"
          >
            <label htmlFor="login-phone" className="eyebrow mb-2 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" aria-hidden /> Mobile number
            </label>
            <input
              id="login-phone"
              ref={firstField}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile"
              className="field readout placeholder:font-sans placeholder:tracking-normal"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || phone.replace(/\D/g, "").length < 10}
              className="btn btn-primary w-full py-3"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send code
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
            <label htmlFor="login-code" className="eyebrow mb-2 flex items-center gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> One-time code
            </label>
            <input
              id="login-code"
              ref={firstField}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className={cn(
                "field readout placeholder:font-sans placeholder:tracking-normal",
                "text-center text-md",
              )}
              // .readout sets a tight letter-spacing; the code wants the opposite,
              // so it is set inline where it can win.
              style={{ letterSpacing: "0.3em" }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {devOtp && (
              <p
                className="rounded-[10px] border px-3 py-2.5 text-xs leading-relaxed text-ink-muted"
                style={{
                  background: "var(--gold-soft)",
                  borderColor: "color-mix(in srgb, var(--gold) 34%, transparent)",
                }}
              >
                No SMS provider is connected in this environment, so your code is{" "}
                <strong className="readout text-sm font-semibold" style={{ color: "var(--gold)" }}>
                  {devOtp}
                </strong>
                . In production this arrives by SMS only.
              </p>
            )}
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="btn btn-primary w-full py-3"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Verify &amp; sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="btn btn-quiet w-full py-2 text-xs"
            >
              Use a different number
            </button>
          </form>
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
      </div>
    </div>
  );
}
