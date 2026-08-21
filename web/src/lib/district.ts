/**
 * जबलपुर जिला रजिस्ट्री — the Jabalpur district reference registry.
 *
 * Administrative structure (tehsils, villages, halka numbers), mandi price
 * board and farmer-scheme directory for the pilot district, as supplied by
 * the FarmKaro Lease Desk. Bilingual where the UI needs it.
 *
 * Provenance, stated once and honestly:
 *  - The tehsil list and portal links are public administrative facts.
 *  - Village centroids are gazetteer positions, VILLAGE precision — they
 *    anchor a record's map pin at the right village, never at a guessed
 *    parcel boundary. Parcel-level geometry only ever comes from Bhu-Naksha
 *    verification at onboarding.
 *  - Mandi rates are the Lease Desk's indicative board, stamped `asOf`; the
 *    MSP column is the government's published support price.
 *  - The source dataset also carried per-halka patwari mobile numbers. They
 *    are deliberately NOT included: the numbers ran sequentially, which marks
 *    them as placeholders, and publishing wrong personal phone numbers as
 *    government contacts misdials real strangers.
 */
import type { Position } from "./geo";

/* ---------- administrative structure -------------------------------------- */

export interface Tehsil {
  code: string;      // e.g. "JBL-02"
  name: string;      // English
  nameHi: string;    // Devanagari
}

export interface RegistryVillage {
  name: string;      // English, as used in records and the UI
  nameHi: string;
  tehsilCode: string;
  halka: string;     // पटवारी हल्का नं.
  /** Gazetteer centroid, [lng, lat]. VILLAGE precision — see file header. */
  at: Position;
}

export const DISTRICT = {
  name: "Jabalpur",
  nameHi: "जबलपुर",
  state: "Madhya Pradesh",
  stateHi: "मध्य प्रदेश",
  division: "Jabalpur Division",
} as const;

export const TEHSILS: Tehsil[] = [
  { code: "JBL-01", name: "Jabalpur", nameHi: "जबलपुर नगर/ग्रामीण" },
  { code: "JBL-02", name: "Panagar", nameHi: "पनागर" },
  { code: "JBL-03", name: "Sihora", nameHi: "सिहोरा" },
  { code: "JBL-04", name: "Patan", nameHi: "पाटन" },
  { code: "JBL-05", name: "Kundam", nameHi: "कुंडम" },
  { code: "JBL-06", name: "Majholi", nameHi: "मझौली" },
  { code: "JBL-07", name: "Shahpura", nameHi: "शाहपुरा" },
];

/**
 * Villages that carry pilot land records. Centroids are village-level
 * gazetteer positions (see the provenance note in the file header).
 */
export const REGISTRY_VILLAGES: RegistryVillage[] = [
  // JBL-01 Jabalpur
  { name: "Gorakhpur", nameHi: "गोरखपुर", tehsilCode: "JBL-01", halka: "12/A", at: [79.9339, 23.1508] },
  { name: "Adhartal", nameHi: "अधारताल", tehsilCode: "JBL-01", halka: "08/B", at: [79.9576, 23.2093] },
  { name: "Garha", nameHi: "गढ़ा", tehsilCode: "JBL-01", halka: "04/C", at: [79.8946, 23.1522] },
  { name: "Ranjhi", nameHi: "रांझी", tehsilCode: "JBL-01", halka: "19/A", at: [79.9989, 23.2131] },
  { name: "Bargi", nameHi: "बरगी", tehsilCode: "JBL-01", halka: "33/D", at: [79.9312, 23.0489] },
  { name: "Maharajpur", nameHi: "महाराजपुर", tehsilCode: "JBL-01", halka: "15/B", at: [79.9018, 23.2246] },
  // JBL-02 Panagar
  { name: "Panagar", nameHi: "पनागर खास", tehsilCode: "JBL-02", halka: "01/A", at: [79.9944, 23.2884] },
  { name: "Singod", nameHi: "सिंगोद", tehsilCode: "JBL-02", halka: "05/C", at: [80.0331, 23.3208] },
  { name: "Umariya", nameHi: "उमरिया", tehsilCode: "JBL-02", halka: "09/B", at: [80.0212, 23.2653] },
  { name: "Nunhsar", nameHi: "नूनसर", tehsilCode: "JBL-02", halka: "14/A", at: [79.9612, 23.3311] },
  { name: "Padwar", nameHi: "पडवार", tehsilCode: "JBL-02", halka: "22/D", at: [80.0653, 23.2989] },
  // JBL-03 Sihora
  { name: "Sihora", nameHi: "सिहोरा खास", tehsilCode: "JBL-03", halka: "02/A", at: [80.1046, 23.4869] },
  { name: "Gosalpur", nameHi: "गोसलपुर", tehsilCode: "JBL-03", halka: "11/B", at: [80.0512, 23.3866] },
  { name: "Khitola", nameHi: "खितौला", tehsilCode: "JBL-03", halka: "07/A", at: [80.0779, 23.4402] },
  { name: "Majgawan", nameHi: "मझगवां", tehsilCode: "JBL-03", halka: "18/C", at: [80.1421, 23.5219] },
  { name: "Darshani", nameHi: "दर्शनी", tehsilCode: "JBL-03", halka: "25/B", at: [80.1618, 23.4633] },
  // JBL-04 Patan
  { name: "Patan", nameHi: "पाटन खास", tehsilCode: "JBL-04", halka: "03/A", at: [79.6889, 23.2833] },
  { name: "Belkheda", nameHi: "बेलखेड़ा", tehsilCode: "JBL-04", halka: "16/C", at: [79.6581, 23.0619] },
  { name: "Katangi", nameHi: "कटंगी", tehsilCode: "JBL-04", halka: "21/D", at: [79.7969, 23.4364] },
  { name: "Nunsar Patan", nameHi: "नूनसार पाटन", tehsilCode: "JBL-04", halka: "10/B", at: [79.7124, 23.3187] },
  // JBL-05 Kundam
  { name: "Kundam", nameHi: "कुंडम खास", tehsilCode: "JBL-05", halka: "06/A", at: [80.3234, 23.4211] },
  { name: "Baghraji", nameHi: "बघराजी", tehsilCode: "JBL-05", halka: "13/C", at: [80.2224, 23.2633] },
  { name: "Hardua", nameHi: "हरदुआ", tehsilCode: "JBL-05", halka: "20/B", at: [80.2716, 23.3391] },
  // JBL-06 Majholi
  { name: "Majholi", nameHi: "मझौली खास", tehsilCode: "JBL-06", halka: "04/B", at: [79.9045, 23.4998] },
  { name: "Indrana", nameHi: "इंद्राना", tehsilCode: "JBL-06", halka: "17/A", at: [79.9861, 23.4269] },
  { name: "Pariat", nameHi: "परियट", tehsilCode: "JBL-06", halka: "29/C", at: [79.9722, 23.3742] },
  // JBL-07 Shahpura
  { name: "Shahpura", nameHi: "शाहपुरा खास", tehsilCode: "JBL-07", halka: "02/C", at: [79.6512, 23.1608] },
  { name: "Bhitoni", nameHi: "भिटौनी", tehsilCode: "JBL-07", halka: "15/D", at: [79.7381, 23.0752] },
  { name: "Chargawan", nameHi: "चरगवां", tehsilCode: "JBL-07", halka: "23/B", at: [79.7783, 23.1401] },
];

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

/** "१०४ / 1-A" -> "104/1a": one canonical key for khasra-ish identifiers. */
export function normalizeKhasra(v: string): string {
  return v
    .trim()
    .replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d)
    .replace(/[ \t]+/g, "")
    .replace(/-/g, "/")
    .toLowerCase();
}

/** Village-name matching across scripts and the "Khas" suffix. */
export function normalizeVillage(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/\s*(khas|खास)\s*$/i, "")
    .replace(/\s+/g, " ");
}

export function findVillage(name: string): RegistryVillage | undefined {
  const n = normalizeVillage(name);
  return REGISTRY_VILLAGES.find(
    (v) => normalizeVillage(v.name) === n || normalizeVillage(v.nameHi) === n,
  );
}

export function tehsilOf(v: RegistryVillage): Tehsil {
  return TEHSILS.find((t) => t.code === v.tehsilCode)!;
}

/* ---------- units ---------------------------------------------------------- */

export const HECTARE_TO_ACRE = 2.4710538;
/** MP pakka bigha: the source records use exactly 1.6 bigha per acre. */
export const BIGHA_PER_ACRE = 1.6;

export const hectaresToAcres = (ha: number) => ha * HECTARE_TO_ACRE;
export const acresToBigha = (ac: number) => ac * BIGHA_PER_ACRE;

/* ---------- mandi board ---------------------------------------------------- */

export interface MandiRate {
  crop: string;
  cropHi: string;
  varieties: string;
  mandi: string;
  /** ₹/quintal */
  min: number;
  max: number;
  modal: number;
  /** Government MSP ₹/quintal; null where the crop is market-driven. */
  msp: number | null;
  /** Day-on-day change in the modal price, ₹/quintal. */
  trend: number;
}

/** Indicative board supplied by the Lease Desk — not a live market feed. */
export const MANDI_RATES_AS_OF = "2026-08-21";

export const MANDI_RATES: MandiRate[] = [
  { crop: "Wheat", cropHi: "गेहूँ", varieties: "Sharbati, GW-322, GW-273", mandi: "Krishi Upaj Mandi, Vijay Nagar", min: 2425, max: 3250, modal: 2680, msp: 2425, trend: 45 },
  { crop: "Gram", cropHi: "चना", varieties: "JG-14, Dollar chana", mandi: "Sihora Mandi", min: 5600, max: 7100, modal: 6250, msp: 5650, trend: 120 },
  { crop: "Soybean", cropHi: "सोयाबीन", varieties: "JS-2034, JS-9560", mandi: "Patan Mandi", min: 4350, max: 5120, modal: 4780, msp: 4892, trend: -30 },
  { crop: "Paddy", cropHi: "धान", varieties: "Kranti, Pusa 1121 Basmati", mandi: "Panagar Sub-Mandi", min: 2320, max: 3650, modal: 2850, msp: 2300, trend: 80 },
  { crop: "Green peas", cropHi: "हरा मटर", varieties: "AP-3, Golden Pea", mandi: "Shahpura Mandi", min: 3200, max: 4800, modal: 3950, msp: null, trend: 150 },
    // Mustard MSP corrected from the source table's 5650 (which duplicated the
  // gram line — RMS 2024-25's figure): the 2025-26 rabi MSP for
  // rapeseed-mustard is 5950.
  { crop: "Mustard", cropHi: "सरसों", varieties: "Pusa Bold, Kranti", mandi: "Kundam Kray Kendra", min: 5400, max: 6150, modal: 5820, msp: 5950, trend: 60 },
];

/* ---------- farmer schemes ------------------------------------------------- */

export interface FarmerScheme {
  name: string;
  nameHi: string;
  benefit: string;
  eligibility: string;
  portal: string;
  portalLabel: string;
}

export const FARMER_SCHEMES: FarmerScheme[] = [
  {
    name: "PM Kisan Samman Nidhi",
    nameHi: "पीएम किसान सम्मान निधि",
    benefit: "₹6,000/year in three instalments of ₹2,000",
    eligibility: "Khasra/khatauni, Aadhaar-linked bank account, e-KYC",
    portal: "https://pmkisan.gov.in",
    portalLabel: "pmkisan.gov.in",
  },
  {
    name: "MP Mukhyamantri Kisan Kalyan",
    nameHi: "मुख्यमंत्री किसान कल्याण योजना",
    benefit: "₹6,000/year from the MP government — ₹12,000/year with PM-Kisan",
    eligibility: "Landholder farmer registered in MP Bhulekh (Jabalpur)",
    portal: "https://saara.mp.gov.in",
    portalLabel: "saara.mp.gov.in",
  },
  {
    name: "PM Fasal Bima Yojana",
    nameHi: "प्रधानमंत्री फसल बीमा योजना",
    benefit: "Compensation up to 100% for natural calamity, hail and pest loss",
    eligibility: "Farmers of notified rabi and kharif crops, loanee or not",
    portal: "https://pmfby.gov.in",
    portalLabel: "pmfby.gov.in",
  },
  {
    name: "PM-KUSUM Solar Pump",
    nameHi: "पीएम कुसुम सोलर पंप",
    benefit: "Up to 90% subsidy on 3–7.5 HP solar agricultural pumps",
    eligibility: "Farm khasra, a water source, and an unelectrified or low-supply area",
    portal: "https://urja.mp.gov.in",
    portalLabel: "urja.mp.gov.in",
  },
];

/* ---------- district context figures ---------------------------------------- */

/**
 * Approximate public administrative figures for the district — context, not
 * claims. Rounded deliberately; the authority on all of them is the revenue
 * department and mpbhulekh.gov.in.
 */
export const DISTRICT_STATS = [
  { label: "Tehsils", labelHi: "तहसीलें", value: "7" },
  { label: "Revenue villages", labelHi: "राजस्व ग्राम", value: "~1,400" },
  { label: "Patwari halkas", labelHi: "पटवारी हल्के", value: "~510" },
  { label: "Digitised khasras", labelHi: "डिजिटाइज़्ड खसरे", value: "~9 lakh" },
  { label: "District area", labelHi: "क्षेत्रफल", value: "5,197 km²" },
] as const;

/* ---------- pan-India Bhulekh portals --------------------------------------- */

/**
 * Official state land-record portals — only entries we are confident are the
 * real government gateways are listed; a state absent here simply has not
 * been verified yet, which beats publishing a guessed URL as official.
 */
export const STATE_PORTALS = [
  { state: "Madhya Pradesh", stateHi: "मध्य प्रदेश", url: "https://mpbhulekh.gov.in", label: "MP Bhulekh" },
  { state: "Uttar Pradesh", stateHi: "उत्तर प्रदेश", url: "https://upbhulekh.gov.in", label: "UP Bhulekh" },
  { state: "Rajasthan", stateHi: "राजस्थान", url: "https://apnakhata.rajasthan.gov.in", label: "Apna Khata" },
  { state: "Maharashtra", stateHi: "महाराष्ट्र", url: "https://bhulekh.mahabhumi.gov.in", label: "MahaBhulekh" },
  { state: "Bihar", stateHi: "बिहार", url: "https://biharbhumi.bihar.gov.in", label: "Bihar Bhumi" },
  { state: "Chhattisgarh", stateHi: "छत्तीसगढ़", url: "https://bhuiyan.cg.nic.in", label: "Bhuiyan" },
  { state: "West Bengal", stateHi: "पश्चिम बंगाल", url: "https://banglarbhumi.gov.in", label: "Banglarbhumi" },
  { state: "Karnataka", stateHi: "कर्नाटक", url: "https://landrecords.karnataka.gov.in", label: "Bhoomi" },
  { state: "Telangana", stateHi: "तेलंगाना", url: "https://dharani.telangana.gov.in", label: "Dharani" },
  { state: "Andhra Pradesh", stateHi: "आंध्र प्रदेश", url: "https://meebhoomi.ap.gov.in", label: "MeeBhoomi" },
  { state: "Haryana", stateHi: "हरियाणा", url: "https://jamabandi.nic.in", label: "Jamabandi" },
  { state: "Punjab", stateHi: "पंजाब", url: "https://jamabandi.punjab.gov.in", label: "Punjab Jamabandi" },
  { state: "Gujarat", stateHi: "गुजरात", url: "https://anyror.gujarat.gov.in", label: "AnyRoR" },
  { state: "Jharkhand", stateHi: "झारखंड", url: "https://jharbhoomi.jharkhand.gov.in", label: "JharBhoomi" },
  { state: "Uttarakhand", stateHi: "उत्तराखंड", url: "https://bhulekh.uk.gov.in", label: "UK Bhulekh" },
  { state: "Odisha", stateHi: "ओडिशा", url: "https://bhulekh.ori.nic.in", label: "Odisha Bhulekh" },
] as const;

/* ---------- official portals ----------------------------------------------- */

export const OFFICIAL_PORTALS = [
  { label: "MP Bhulekh", url: "https://mpbhulekh.gov.in", note: "भू-अभिलेख मुख्य पोर्टल" },
  { label: "MP Bhu-Naksha", url: "https://mpbhunaksha.gov.in", note: "भू-नक्शा (cadastral maps)" },
  { label: "RCMS MP", url: "https://rcms.mp.gov.in", note: "राजस्व न्यायालय प्रबंधन" },
  { label: "MPIGR", url: "https://mpigr.gov.in", note: "पंजीयन एवं मुद्रांक विभाग" },
  { label: "Jabalpur District", url: "https://jabalpur.nic.in", note: "जिला प्रशासन पोर्टल" },
] as const;
