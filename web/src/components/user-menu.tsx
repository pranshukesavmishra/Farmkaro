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
  if (!ready) return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--line)]/60" />;

  if (!user) {
    return (
      <button
        type="button"
        onClick={openLogin}
        className="focus-ring rounded-full border hairline px-4 py-2 text-[13px] font-semibold hover:bg-[var(--surface)]"
      >
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
        className="focus-ring relative grid h-9 w-9 place-items-center rounded-full border hairline text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-forest-500 px-1 font-mono text-[9.5px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <span
        className="hidden items-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-[12.5px] font-medium sm:flex"
        title={user.fullName ?? user.phone}
      >
        <UserRound className="h-3.5 w-3.5 text-forest-500 dark:text-forest-300" />
        {user.fullName ?? `+91 ${user.phone.slice(0, 5)}…`}
      </span>

      <button
        type="button"
        onClick={() => void logout()}
        aria-label="Sign out"
        title="Sign out"
        className="focus-ring grid h-9 w-9 place-items-center rounded-full border hairline text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <LogOut className="h-4 w-4" />
      </button>

      {open && (
        <div className="surface absolute right-0 top-11 z-50 max-h-[70vh] w-[320px] overflow-y-auto rounded-xl border p-2 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.09em] muted">
            Notifications
          </p>
          {notifs.length === 0 ? (
            <p className="px-2 pb-3 text-[13px] muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {notifs.slice(0, 15).map((n) => (
                <li key={n.id}>
                  <a
                    href={n.link ?? "#"}
                    className={cn(
                      "focus-ring block rounded-lg px-2 py-2 hover:bg-[var(--bg)]",
                      !n.read_at && "bg-forest-500/8",
                    )}
                  >
                    <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] muted">{n.body}</p>}
                    <p className="mt-0.5 font-mono text-[10.5px] muted">
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
