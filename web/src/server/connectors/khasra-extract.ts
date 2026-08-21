/**
 * Khasra / khatauni document reader.
 *
 * Many owners do not know their Bhu-Swami ID and get confused by record
 * numbers — but they all have the paper. So: upload the khasra copy, and the
 * system reads the details off it and drops a pin on the map.
 *
 * How it reads:
 *  1. Most MP Bhulekh / Bhu-Naksha copies are digitally generated PDFs with a
 *     real text layer, so the text comes straight out — no OCR, no API key,
 *     no network. This is the default path and it works offline.
 *  2. Scanned photos need OCR. That is a pluggable provider (`OcrProvider`)
 *     so a local Tesseract or a cloud OCR can be dropped in without touching
 *     any call site.
 *
 * Honesty rule, same as AI boundaries: everything extracted here is a
 * SUGGESTION shown back to the owner for confirmation. Nothing is written to
 * a parcel without the owner accepting it, and confidence is reported per
 * field so a shaky read is visible rather than silently trusted.
 */

export interface KhasraExtraction {
  khasraNumber?: string;
  khataNumber?: string;
  bhuswamiId?: string;
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  areaHectares?: number;
  areaAcres?: number;
  ownerName?: string;
  /** 0..1 per field, so the UI can flag low-confidence reads. */
  confidence: Record<string, number>;
  /** Fields we could not find, named for the UI to ask about. */
  missing: string[];
  /** Which reader produced this. */
  source: "pdf_text" | "ocr" | "none";
  /** Trimmed raw text, kept only for the user to eyeball. Never stored. */
  textPreview?: string;
}

export interface OcrProvider {
  readonly id: string;
  isConfigured(): boolean;
  recognise(file: Buffer, mime: string): Promise<string>;
}

/** No OCR wired by default: scanned images ask the owner to type the details. */
export const nullOcrProvider: OcrProvider = {
  id: "none",
  isConfigured: () => false,
  async recognise() {
    throw new Error("No OCR provider configured.");
  },
};

let ocrProvider: OcrProvider = nullOcrProvider;
export const setOcrProvider = (p: OcrProvider) => (ocrProvider = p);
export const getOcrProvider = () => ocrProvider;

/* ---------------------------------------------------------------------------
 * Field patterns.
 *
 * Indian land-record copies are printed in Hindi (Devanagari) and/or English,
 * with inconsistent spacing and punctuation, so each field has several
 * spellings. Devanagari digits are normalised before matching.
 * ------------------------------------------------------------------------- */

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export function normaliseText(raw: string): string {
  return raw
    .replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d)
    // Collapse whitespace but keep line structure, which carries meaning.
    .replace(/[ \t ]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

/** Labels that introduce a field, in Hindi and English. */
const LABELS = {
  khasra: ["खसरा क्रमांक", "खसरा नं", "खसरा नम्बर", "खसरा", "khasra no", "khasra number", "khasra"],
  khata: ["खाता क्रमांक", "खाता नं", "खाता", "khata no", "khata number", "khatauni no", "khata"],
  bhuswami: ["भू-स्वामी कोड", "भूस्वामी कोड", "भू स्वामी आईडी", "bhuswami id", "bhu-swami id", "bhuswami code"],
  village: ["ग्राम का नाम", "ग्राम", "गांव", "village name", "village"],
  tehsil: ["तहसील", "tehsil", "tahsil"],
  district: ["जिला", "ज़िला", "district"],
  owner: ["भू-स्वामी का नाम", "भूमिस्वामी", "भू-स्वामी", "कृषक का नाम", "owner name", "bhumiswami", "owner"],
  area: ["रकबा", "क्षेत्रफल", "कुल रकबा", "area", "rakba"],
} as const;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Value that follows a label on the same line (after :, -, = or spaces). */
function afterLabel(text: string, labels: readonly string[], valuePattern: string): string | null {
  for (const label of labels) {
    // Separator may be ".", ":", "-", "=" or a run of them ("No.:").
    const re = new RegExp(`${esc(label)}[ \\t]*[.:\\-=]*[ \\t]*(${valuePattern})`, "i");
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

const NUMBERISH = "[0-9]+(?:[ \\t]*[\\/\\-][ \\t]*[0-9]+)*[क-हa-zA-Z]?";
const WORDISH = "[^\\n:,;|]{2,40}";

/** Hectares -> acres. Indian records usually print hectares. */
const HECTARE_TO_ACRE = 2.4710538;

function parseArea(text: string): { hectares?: number; acres?: number; confidence: number } {
  // "रकबा 1.2340 हेक्टेयर" / "Area : 1.234 ha" / "0.809 hectare"
  const haRe =
    /(?:रकबा|क्षेत्रफल|area|rakba)[ \t]*[.:\-=]*[ \t]*([0-9]+(?:\.[0-9]+)?)[ \t]*(?:हे\.?|हेक्टेयर|hectare?s?|ha\b)/i;
  const ha = text.match(haRe);
  if (ha) {
    const h = Number(ha[1]);
    if (Number.isFinite(h) && h > 0 && h < 10000) {
      return { hectares: h, acres: +(h * HECTARE_TO_ACRE).toFixed(4), confidence: 0.9 };
    }
  }
  const acRe = /(?:रकबा|क्षेत्रफल|area|rakba)[ \t]*[.:\-=]*[ \t]*([0-9]+(?:\.[0-9]+)?)[ \t]*(?:एकड़|acres?|ac\b)/i;
  const ac = text.match(acRe);
  if (ac) {
    const a = Number(ac[1]);
    if (Number.isFinite(a) && a > 0 && a < 100000) {
      return { acres: a, hectares: +(a / HECTARE_TO_ACRE).toFixed(4), confidence: 0.9 };
    }
  }
  // A bare number after the label: plausible but weaker, assume hectares.
  const bare = afterLabel(text, LABELS.area, "[0-9]+(?:\\.[0-9]+)?");
  if (bare) {
    const h = Number(bare);
    if (Number.isFinite(h) && h > 0 && h < 10000) {
      return { hectares: h, acres: +(h * HECTARE_TO_ACRE).toFixed(4), confidence: 0.45 };
    }
  }
  return { confidence: 0 };
}

/** Pull structured fields out of the text of a khasra/khatauni copy. */
export function extractFromText(rawText: string, source: KhasraExtraction["source"]): KhasraExtraction {
  const text = normaliseText(rawText);
  const confidence: Record<string, number> = {};
  const out: KhasraExtraction = { confidence, missing: [], source };

  const khasra = afterLabel(text, LABELS.khasra, NUMBERISH);
  if (khasra) {
    out.khasraNumber = khasra.replace(/\s+/g, "");
    confidence.khasraNumber = 0.9;
  }

  const khata = afterLabel(text, LABELS.khata, NUMBERISH);
  if (khata) {
    out.khataNumber = khata.replace(/\s+/g, "");
    confidence.khataNumber = 0.85;
  }

  const bhuswami = afterLabel(text, LABELS.bhuswami, "[A-Za-z0-9\\-\\/]{4,30}");
  if (bhuswami) {
    out.bhuswamiId = bhuswami.replace(/\s+/g, "");
    confidence.bhuswamiId = 0.85;
  }

  const village = afterLabel(text, LABELS.village, WORDISH);
  if (village) {
    out.village = cleanPlace(village);
    confidence.village = 0.8;
  }

  const tehsil = afterLabel(text, LABELS.tehsil, WORDISH);
  if (tehsil) {
    out.tehsil = cleanPlace(tehsil);
    confidence.tehsil = 0.8;
  }

  const district = afterLabel(text, LABELS.district, WORDISH);
  if (district) {
    out.district = cleanPlace(district);
    confidence.district = 0.8;
  }

  const owner = afterLabel(text, LABELS.owner, WORDISH);
  if (owner) {
    out.ownerName = cleanPlace(owner);
    confidence.ownerName = 0.7;
  }

  if (/मध्य\s*प्रदेश|madhya\s*pradesh/i.test(text)) {
    out.state = "Madhya Pradesh";
    confidence.state = 0.95;
  }

  const area = parseArea(text);
  if (area.hectares || area.acres) {
    out.areaHectares = area.hectares;
    out.areaAcres = area.acres;
    confidence.area = area.confidence;
  }

  for (const key of ["khasraNumber", "village", "district"] as const) {
    if (!out[key]) out.missing.push(key);
  }

  out.textPreview = text.slice(0, 1200);
  return out;
}

/**
 * Where a khasra copy sets its fields on one line — "Village: Panagar Area:
 * 4.690 hectare" — a place capture runs straight into the next field's label.
 * The capture already stops at that field's separator, so the stray text is
 * always a label term sitting at the end: cut it there.
 */
const NEXT_LABEL = new RegExp(
  `[\\s.,;|-]+(?:${[...new Set(Object.values(LABELS).flat())]
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join("|")})[ \\t]*(?:[.:\\-=].*)?$`,
  "i",
);

function cleanPlace(v: string): string {
  return v
    .replace(NEXT_LABEL, "")
    .replace(/\s*[|:;,]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Read a khasra copy: PDF text layer first, OCR only if needed. */
export async function extractKhasraDocument(
  file: Buffer,
  mime: string,
): Promise<KhasraExtraction> {
  if (mime === "application/pdf") {
    let parser: { getText(): Promise<{ text?: string }>; destroy?: () => Promise<void> } | null = null;
    try {
      // Lazy import: keeps the PDF reader out of every other server bundle.
      const { PDFParse } = (await import("pdf-parse")) as unknown as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getText(): Promise<{ text?: string }>;
          destroy?: () => Promise<void>;
        };
      };
      parser = new PDFParse({ data: new Uint8Array(file) });
      const text = (await parser.getText())?.text ?? "";
      if (text.trim().length >= 30) return extractFromText(text, "pdf_text");
      // A PDF with no usable text layer is a scan: fall through to OCR.
    } catch {
      // Unreadable PDF: fall through and let OCR or the owner handle it.
    } finally {
      await parser?.destroy?.().catch(() => {});
    }
  }

  const ocr = getOcrProvider();
  if (ocr.isConfigured()) {
    const text = await ocr.recognise(file, mime);
    return extractFromText(text, "ocr");
  }

  return {
    confidence: {},
    missing: ["khasraNumber", "village", "district"],
    source: "none",
  };
}
