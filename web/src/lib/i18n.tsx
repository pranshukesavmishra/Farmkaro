"use client";

/**
 * Bilingual UI — English ⇄ हिन्दी — behind one header toggle, in two layers.
 *
 * Layer 1 (instant, ours): a hand-written dictionary for the chrome and the
 * whole drawing experience. `t()` falls back to the English string it was
 * given, so nothing ever renders blank.
 *
 * Layer 2 (full coverage, Google): switching to Hindi also engages Google's
 * page-translation engine via the standard `googtrans` cookie + widget
 * script, which machine-translates every remaining text node on the page.
 * Strings the dictionary already turned into Hindi are left as they are, so
 * the two layers compose instead of fighting. If the Google script cannot
 * load (offline, blocked), layer 1 still applies — the toggle never breaks.
 * Text drawn on map canvases (MapLibre) is imagery, not DOM, and is outside
 * any translator's reach.
 *
 * The choice persists in localStorage and flips <html lang> so screen
 * readers switch voices with the text.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const HI: Record<string, string> = {
  // Chrome
  Discover: "खोजें",
  "Find my land": "मेरी ज़मीन",
  "List your land": "ज़मीन दर्ज करें",
  Landowners: "भूस्वामी",
  Cultivators: "किसान",
  "Find farmland": "खेत खोजें",
  About: "हमारे बारे में",
  "Jabalpur pilot": "जबलपुर पायलट",
  Home: "होम",
  "My land": "मेरी ज़मीन",
  "List land": "ज़मीन जोड़ें",
  Dashboard: "डैशबोर्ड",
  "Sign in": "साइन इन",
  "Sign out": "साइन आउट",

  // Listing wizard
  "Where is the land?": "ज़मीन कहाँ है?",
  "Draw the boundary": "सीमा बनाएं",
  "Land details": "ज़मीन का विवरण",
  "Water, power & access": "पानी, बिजली और रास्ता",
  "Soil & crops": "मिट्टी और फ़सलें",
  "Documents & contact": "दस्तावेज़ और संपर्क",
  Continue: "आगे बढ़ें",
  Back: "पीछे",
  Step: "चरण",
  Locate: "स्थान",
  Boundary: "सीमा",
  Details: "विवरण",
  Infrastructure: "सुविधाएं",
  Agriculture: "खेती",
  Documents: "दस्तावेज़",
  "Review & send": "जाँचें और भेजें",
  "Place at least 3 corners to continue": "आगे बढ़ने के लिए कम से कम 3 कोने रखें",
  "Fill the required fields": "ज़रूरी जानकारी भरें",

  // Boundary drawing + FarmSelect AI
  "Tap the corners of your field": "अपने खेत के कोनों पर टैप करें",
  "Estimated area": "अनुमानित क्षेत्रफल",
  acres: "एकड़",
  "point placed": "बिंदु रखा गया",
  "points placed": "बिंदु रखे गए",
  "Tap the map once to start moving and marking":
    "शुरू करने के लिए नक़्शे पर एक बार टैप करें",
  "Boundary crosses itself": "सीमा खुद को काट रही है",
  "Drag the dots apart": "बिंदुओं को खींचकर सुलझाएं",
  "Right-click or tap the gold first dot to finish":
    "पूरा करने के लिए राइट-क्लिक करें या सुनहरे पहले बिंदु पर टैप करें",
  "Undo last point": "पिछला बिंदु हटाएं",
  Redo: "फिर से करें",
  "Clear boundary": "सीमा साफ़ करें",
  "Tap once inside your field and FarmSelect AI will mark it for you, point by point.":
    "अपने खेत के अंदर एक बार टैप करें — FarmSelect AI उसे बिंदु-दर-बिंदु चिह्नित कर देगा।",
  "FarmSelect AI traced your field from the imagery — drag any dot to fine-tune it. It stays owner-drawn until FarmKaro walks the boundary.":
    "FarmSelect AI ने तस्वीर से आपके खेत की सीमा खींची है — किसी भी बिंदु को खींचकर ठीक करें। FarmKaro द्वारा ज़मीन पर सीमा नापे जाने तक यह स्वामी-द्वारा-बनाई सीमा ही रहेगी।",
  "Couldn't read a clear field there — tap nearer the middle of your field, or keep drawing by hand.":
    "वहाँ खेत साफ़ नहीं दिखा — खेत के बीच के पास टैप करें, या हाथ से बनाते रहें।",
  "Could not read the imagery here. Please draw the corners by hand.":
    "यहाँ की तस्वीर पढ़ी नहीं जा सकी। कृपया कोने हाथ से बनाएं।",
  "Zoom in until your field fills the view — FarmSelect AI reads the imagery on screen, and from this height one field is only a few pixels.":
    "इतना ज़ूम करें कि आपका खेत पूरी स्क्रीन पर दिखे — इस ऊँचाई से एक खेत केवल कुछ पिक्सेल का होता है।",
};

type Lang = "en" | "hi";

interface LangCtx {
  lang: Lang;
  toggle: () => void;
  t: (s: string) => string;
}

const Ctx = createContext<LangCtx>({ lang: "en", toggle: () => {}, t: (s) => s });

/* ── Google page translation (layer 2) ────────────────────────────────────── */

const GT_SCRIPT_ID = "fk-google-translate";

declare global {
  interface Window {
    fkGoogleTranslateInit?: () => void;
  }
}

/** The widget's constructor, reached through a cast — `window.google` is
 *  already globally declared (as any) by the Maps integration. */
type TranslateElementCtor = new (
  opts: { pageLanguage: string; autoDisplay: boolean },
  el: string,
) => unknown;

function setGtCookie(value: string | null) {
  const host = window.location.hostname;
  const kill = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  if (value === null) {
    document.cookie = `googtrans=;path=/;${kill}`;
    document.cookie = `googtrans=;path=/;domain=${host};${kill}`;
    document.cookie = `googtrans=;path=/;domain=.${host};${kill}`;
  } else {
    document.cookie = `googtrans=${value};path=/`;
    document.cookie = `googtrans=${value};path=/;domain=${host}`;
  }
}

/** Engage Google's translator for this page (idempotent). The widget reads
 *  the `googtrans` cookie at init and translates in place — no banner, no
 *  dropdown (its host element is hidden by CSS). */
function engageGoogleHindi(opts: { reloadIfLoaded: boolean }) {
  setGtCookie("/en/hi");
  if (document.getElementById(GT_SCRIPT_ID)) {
    // Script already on the page. From a fresh toggle a reload lets it
    // re-read the cookie; from mount (incl. React's double-run of effects
    // in dev) we're already engaged and must NOT reload — that would loop.
    if (opts.reloadIfLoaded) window.location.reload();
    return;
  }
  window.fkGoogleTranslateInit = () => {
    try {
      const TE = (window as unknown as { google?: { translate?: { TranslateElement?: TranslateElementCtor } } })
        .google?.translate?.TranslateElement;
      if (TE) new TE({ pageLanguage: "en", autoDisplay: false }, "fk-gt-host");
    } catch {
      /* widget refused — dictionary layer already applied */
    }
  };
  const s = document.createElement("script");
  s.id = GT_SCRIPT_ID;
  s.src = "https://translate.google.com/translate_a/element.js?cb=fkGoogleTranslateInit";
  s.async = true;
  // Unreachable (offline/blocked network)? Layer 1 has already switched the
  // chrome to Hindi; the page simply stays partially translated.
  s.onerror = () => {};
  document.head.appendChild(s);
}

/** Disengage: clear the cookie and reload — the only reliable way to strip
 *  Google's in-place DOM rewrites. */
function disengageGoogle() {
  setGtCookie(null);
  window.location.reload();
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  // English first for the server-rendered HTML; the stored choice applies
  // right after mount (same pattern as the theme, no hydration mismatch).
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      if (localStorage.getItem("fk-lang") === "hi") {
        setLang("hi");
        // Re-engage full-page translation on every visit while Hindi is on.
        engageGoogleHindi({ reloadIfLoaded: false });
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Side effects live OUTSIDE the state updater: React deliberately runs
  // updaters twice in dev to flush out impurity, and a doubled engage() saw
  // its own script tag and reloaded the page.
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;
  const toggle = useCallback(() => {
    const next: Lang = langRef.current === "en" ? "hi" : "en";
    try {
      localStorage.setItem("fk-lang", next);
    } catch {}
    if (next === "hi") engageGoogleHindi({ reloadIfLoaded: true });
    else disengageGoogle();
    setLang(next);
  }, []);

  const t = useCallback((s: string) => (lang === "hi" ? (HI[s] ?? s) : s), [lang]);

  return (
    <Ctx.Provider value={{ lang, toggle, t }}>
      {children}
      {/* Hidden host for Google's widget — it needs a mount point even
          though its UI is never shown. */}
      <div id="fk-gt-host" aria-hidden className="hidden" />
    </Ctx.Provider>
  );
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}
