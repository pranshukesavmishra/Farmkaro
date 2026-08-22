"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * One tap: the interface switches to हिन्दी; tap again, back to English.
 * Sits beside the theme toggle and mirrors its shape.
 */
export function LanguageToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "en" ? "हिन्दी में देखें" : "Switch to English"}
      title={lang === "en" ? "हिन्दी" : "English"}
      className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
    >
      <Languages className="h-4 w-4" aria-hidden />
    </button>
  );
}
