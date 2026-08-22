"use client";

/**
 * Built-in bilingual UI — English ⇄ हिन्दी — behind one header toggle.
 *
 * The dictionary is hand-written, not machine-translated, and lives in the
 * bundle: no external translation service, no network call, no third party
 * reading page content (which matters on pages that show land records).
 * `t()` falls back to the English string it was given, so an untranslated
 * corner of the product degrades to English — never to a blank.
 *
 * The choice persists in localStorage and flips <html lang> so screen
 * readers switch voices with the text.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const HI: Record<string, string> = {
  // Chrome
  Discover: "खोजें",
  "Find my land": "मेरी ज़मीन",
  "List your land": "ज़मीन दर्ज करें",
  Landowners: "भूस्वामी",
  Cultivators: "किसान",
  "Find farmland": "खेत खोजें",
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

export function LangProvider({ children }: { children: React.ReactNode }) {
  // English first for the server-rendered HTML; the stored choice applies
  // right after mount (same pattern as the theme, no hydration mismatch).
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      if (localStorage.getItem("fk-lang") === "hi") setLang("hi");
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toggle = useCallback(() => {
    setLang((l) => {
      const next: Lang = l === "en" ? "hi" : "en";
      try {
        localStorage.setItem("fk-lang", next);
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback((s: string) => (lang === "hi" ? (HI[s] ?? s) : s), [lang]);

  return <Ctx.Provider value={{ lang, toggle, t }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}
