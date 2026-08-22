"use client";

/**
 * Upload a khasra copy (PDF or photo); the extractor reads the number and
 * village off it and fills the search form. Nothing is stored — the point is
 * to spare owners the खसरा/खाता confusion by reading their own paper for them.
 */
import { useRef, useState } from "react";
import { Loader2, ScanLine, Upload } from "lucide-react";
import { useAuth } from "@/components/auth-context";

interface Extraction {
  khasraNumber?: string;
  village?: string;
  bhuswamiId?: string;
}

export function KhasraScan({ onExtract }: { onExtract: (x: Extraction) => void }) {
  const { user, openLogin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function scan(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/land-records/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that file.");
      const x = data.extraction ?? {};
      const filled: string[] = [];
      if (x.khasraNumber) filled.push(`khasra ${x.khasraNumber}`);
      if (x.village) filled.push(`village ${x.village}`);
      onExtract(x);
      setNote(
        filled.length
          ? `Read from your document: ${filled.join(", ")}. Check it, then search.`
          : (data.note ?? "Could not find a khasra number in that document."),
      );
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="card p-5">
      <p className="eyebrow flex items-center gap-1.5">
        <ScanLine className="h-3.5 w-3.5" aria-hidden /> खसरा कॉपी है?
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Upload the khasra copy (PDF or photo) and we read the details off it. The copy itself is
        not stored.
      </p>
      <label className="btn btn-ghost mt-3.5 w-full cursor-pointer py-2.5">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="h-4 w-4" aria-hidden />
        )}
        {busy ? "Reading…" : "Upload khasra copy"}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              openLogin();
            }
          }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void scan(f);
          }}
        />
      </label>
      {note && (
        <p className="mt-3 text-xs leading-relaxed text-ink-muted" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
