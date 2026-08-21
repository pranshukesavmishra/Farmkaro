"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, UserRound } from "lucide-react";
import { useAuth } from "./auth-context";
import { IS_STATIC } from "@/lib/flags";
import { cn } from "@/lib/cn";

interface Notification {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Header chrome stays quiet: hairline circles, ink-muted glyphs. */
const ICON_BTN =
  "focus-ring grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink";

export function UserMenu() {
  const { user, ready, openLogin, logout } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || IS_STATIC) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (!stop) setNotifs(data.notifications ?? []);
      } catch {}
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (IS_STATIC) return null;
  if (!ready) return <div className="h-9 w-24 animate-pulse rounded-full bg-surface-2" />;

  if (!user) {
    return (
      <button type="button" onClick={openLogin} className="btn btn-ghost">
        Sign in
      </button>
    );
  }

  const unread = notifs.filter((n) => !n.read_at).length;

  async function markAllRead() {
    const ids = notifs.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
    setNotifs((ns) => ns.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  return (
    <div className="relative flex items-center gap-1.5" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void markAllRead();
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={cn(ICON_BTN, "relative")}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="readout absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9.5px] font-semibold text-brand-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <span
        className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted sm:flex"
        title={user.fullName ?? user.phone}
      >
        <UserRound className="h-3.5 w-3.5 text-brand" aria-hidden />
        {user.fullName ?? (
          <span className="readout">{`+91 ${user.phone.slice(0, 5)}…`}</span>
        )}
      </span>

      <button
        type="button"
        onClick={() => void logout()}
        aria-label="Sign out"
        title="Sign out"
        className={ICON_BTN}
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div className="card thin-scroll absolute right-0 top-12 z-50 max-h-[70vh] w-[320px] overflow-y-auto p-2 shadow-lg">
          <p className="eyebrow px-2 pb-2 pt-1.5">Notifications</p>
          {notifs.length === 0 ? (
            <p className="px-2 pb-3 text-sm text-ink-muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {notifs.slice(0, 15).map((n) => (
                <li key={n.id}>
                  <a
                    href={n.link ?? "#"}
                    className="focus-ring block rounded-[10px] px-2.5 py-2 transition-colors hover:bg-surface-2"
                  >
                    <p
                      className={cn(
                        "flex items-baseline gap-1.5 text-sm leading-snug",
                        n.read_at ? "text-ink-muted" : "font-medium text-ink",
                      )}
                    >
                      {!n.read_at && (
                        <span
                          aria-hidden
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                        />
                      )}
                      <span className="min-w-0">
                        {n.title}
                        {!n.read_at && <span className="sr-only"> (unread)</span>}
                      </span>
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {n.body}
                      </p>
                    )}
                    <p className="readout mt-1 text-[10.5px] text-ink-faint">
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
