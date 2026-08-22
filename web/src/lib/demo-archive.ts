/**
 * डेमो संग्रह — the synthetic demonstration archive.
 *
 * 15,000 deterministic, openly FICTIONAL khasra records spread across the
 * registry's villages, generated so the platform can demonstrate
 * district-scale search, filtering and pagination without inventing claims
 * about real people. Every surface that shows a row says "synthetic".
 *
 * Two rules from the same principle as the pilot record set:
 *  - The 7 pilot records describe real people, so they resolve only by their
 *    own identifier behind the consent gate. THIS archive is fiction — no one
 *    exists to be harmed — so it may be freely searched, name included. The
 *    UI explains the asymmetry rather than hiding it.
 *  - No fabricated authority: no patwari names or phone numbers, no invented
 *    land valuations (the product refuses invented estimates everywhere
 *    else), no government emblem, and generic institution names for the
 *    fictional mortgages instead of real banks.
 */
import {
  BIGHA_PER_ACRE,
  HECTARE_TO_ACRE,
  REGISTRY_VILLAGES,
  TEHSILS,
  type RegistryVillage,
} from "./district";

export interface ArchiveRecord {
  id: string;
  landId: string;
  khasraNumber: string;
  khataNumber: string;
  village: string;
  villageHi: string;
  tehsil: string;
  tehsilHi: string;
  halka: string;
  owner: { name: string; nameHi: string; relation: string; relationHi: string };
  areaHectares: number;
  areaAcres: number;
  areaBigha: number;
  soil: string;
  soilHi: string;
  irrigated: boolean;
  waterSource: string;
  cropKharif: string;
  cropRabi: string;
  mortgage: { isMortgaged: boolean; lender: string | null; amountINR: number | null };
  boundaries: { north: string; south: string; east: string; west: string };
  /** Always "synthetic_demo" — the honest stamp every consumer must carry. */
  dataset: "synthetic_demo";
}

/* Fictional name pools — common MP name components, combined mechanically. */
const FIRST: Array<[string, string]> = [
  ["Ramesh", "रमेश"], ["Suresh", "सुरेश"], ["Dinesh", "दिनेश"], ["Mahesh", "महेश"],
  ["Rajesh", "राजेश"], ["Kamlesh", "कमलेश"], ["Santosh", "संतोष"], ["Manoj", "मनोज"],
  ["Anil", "अनिल"], ["Sunil", "सुनील"], ["Vinod", "विनोद"], ["Ashok", "अशोक"],
  ["Prakash", "प्रकाश"], ["Omprakash", "ओमप्रकाश"], ["Devendra", "देवेंद्र"], ["Mahendra", "महेंद्र"],
  ["Narendra", "नरेंद्र"], ["Virendra", "वीरेंद्र"], ["Savitri", "सावित्री"], ["Kamla", "कमला"],
  ["Geeta", "गीता"], ["Sunita", "सुनीता"], ["Rekha", "रेखा"], ["Pushpa", "पुष्पा"],
];
const LAST: Array<[string, string]> = [
  ["Patel", "पटेल"], ["Lodhi", "लोधी"], ["Kushwaha", "कुशवाहा"], ["Yadav", "यादव"],
  ["Kurmi", "कुर्मी"], ["Sahu", "साहू"], ["Verma", "वर्मा"], ["Sharma", "शर्मा"],
  ["Tiwari", "तिवारी"], ["Dubey", "दुबे"], ["Thakur", "ठाकुर"], ["Rajput", "राजपूत"],
  ["Dhurve", "धुर्वे"], ["Markam", "मरकाम"], ["Netam", "नेताम"], ["Jain", "जैन"],
];
/** Female first-name indices (for पत्नी/पुत्री vs पुत्र in the relation). */
const FEMALE = new Set([18, 19, 20, 21, 22, 23]);

const SOILS: Array<[string, string]> = [
  ["Deep black cotton", "गहरी काली कपासी"],
  ["Medium black", "मध्यम काली"],
  ["Clay loam", "दोमट"],
  ["Alluvial", "कछारी"],
  ["Red sandy loam", "लाल रेतीली दोमट"],
];
const WATER = [
  "Borewell", "Tubewell + farm pond", "Canal (Bargi network)", "Open well",
  "Rainfed + check dam", "River lift (Hiran/Pariat)",
];
const KHARIF = ["Soybean (JS-2034)", "Paddy (Kranti)", "Urad (JU-3)", "Maize", "Kodo-kutki millets", "Arhar (tur)"];
const RABI = ["Wheat (Sharbati)", "Wheat (GW-322)", "Gram (JG-14)", "Green peas (AP-3)", "Mustard (Pusa Bold)", "Lentil (JL-3)", "Berseem"];
/** Generic lender names — fictional loans never borrow a real bank's brand. */
const LENDERS = ["जिला सहकारी केन्द्रीय बैंक", "क्षेत्रीय ग्रामीण बैंक", "प्राथमिक कृषि साख समिति (PACS)"];

export const ARCHIVE_SIZE = 15000;

/** Deterministic PRNG (mulberry32): the archive is identical on every boot. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tehsilOfVillage(v: RegistryVillage) {
  return TEHSILS.find((t) => t.code === v.tehsilCode)!;
}

function makeRecord(i: number): ArchiveRecord {
  const r = rng(i * 2654435761);
  const v = REGISTRY_VILLAGES[i % REGISTRY_VILLAGES.length];
  const t = tehsilOfVillage(v);

  const fi = Math.floor(r() * FIRST.length);
  const li = Math.floor(r() * LAST.length);
  const pi = Math.floor(r() * 18); // fathers/husbands drawn from male pool
  const [fn, fnHi] = FIRST[fi];
  const [ln, lnHi] = LAST[li];
  const [pf, pfHi] = FIRST[pi];
  const female = FEMALE.has(fi);

  const khasraMain = 1 + Math.floor(r() * 460);
  const khasraSub = r() < 0.62 ? `/${1 + Math.floor(r() * 6)}` : "";
  const khasraNumber = `${khasraMain}${khasraSub}`;
  const khataNumber = String(1 + Math.floor(r() * 240));

  const areaHectares = +(0.18 + r() * 4.6).toFixed(3);
  const areaAcres = +(areaHectares * HECTARE_TO_ACRE).toFixed(2);
  const areaBigha = +(areaAcres * BIGHA_PER_ACRE).toFixed(2);

  const si = Math.floor(r() * SOILS.length);
  const irrigated = r() < (t.code === "JBL-05" ? 0.35 : 0.78);
  const isMortgaged = r() < 0.24;

  return {
    id: `demo_${String(i).padStart(5, "0")}`,
    // The DEMO- prefix keeps these ids visibly apart from the pilot set's.
    landId: `DEMO-${t.code}-${String(i).padStart(5, "0")}`,
    khasraNumber,
    khataNumber,
    village: v.name,
    villageHi: v.nameHi,
    tehsil: t.name,
    tehsilHi: t.nameHi,
    halka: v.halka,
    owner: {
      name: `${fn} ${ln}`,
      nameHi: `${fnHi} ${lnHi}`,
      relation: `${female ? "W/o" : "S/o"} ${pf} ${ln}`,
      relationHi: `${female ? "पत्नी" : "पुत्र"} ${pfHi} ${lnHi}`,
    },
    areaHectares,
    areaAcres,
    areaBigha,
    soil: SOILS[si][0],
    soilHi: SOILS[si][1],
    irrigated,
    // Irrigated land draws from every irrigated source, river lift included;
    // rainfed stays rainfed.
    waterSource: irrigated ? [WATER[0], WATER[1], WATER[2], WATER[3], WATER[5]][Math.floor(r() * 5)] : WATER[4],
    cropKharif: KHARIF[Math.floor(r() * KHARIF.length)],
    cropRabi: RABI[Math.floor(r() * RABI.length)],
    mortgage: isMortgaged
      ? {
          isMortgaged: true,
          lender: `${LENDERS[Math.floor(r() * LENDERS.length)]}, ${v.nameHi}`,
          amountINR: 100000 + Math.floor(r() * 12) * 50000,
        }
      : { isMortgaged: false, lender: null, amountINR: null },
    boundaries: {
      north: `खसरा ${khasraMain > 1 ? khasraMain - 1 : khasraMain + 9}`,
      south: `खसरा ${khasraMain + 1}`,
      east: r() < 0.5 ? `${v.nameHi} मुख्य मार्ग` : `खसरा ${khasraMain + 2}`,
      west: r() < 0.5 ? "चकमार्ग" : "सरकारी नाला",
    },
    dataset: "synthetic_demo",
  };
}

let cache: ArchiveRecord[] | null = null;

/** The full archive, generated once per process. ~15k small objects. */
export function demoArchive(): ArchiveRecord[] {
  if (!cache) cache = Array.from({ length: ARCHIVE_SIZE }, (_, i) => makeRecord(i + 1));
  return cache;
}

export interface ArchiveQuery {
  q?: string;
  tehsilCode?: string;
  village?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Multi-field search: khasra, khata, land id, owner name (both scripts),
 * village, tehsil. Free name search is fine here and only here — every row
 * is fiction. Deterministic order, stable pagination.
 */
export function searchArchive(query: ArchiveQuery) {
  const q = (query.q ?? "").trim().toLowerCase();
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50);
  const page = Math.max(query.page ?? 1, 1);

  let rows = demoArchive();
  if (query.tehsilCode) rows = rows.filter((r) => r.landId.includes(`-${query.tehsilCode}-`));
  if (query.village) {
    const v = query.village.toLowerCase();
    rows = rows.filter((r) => r.village.toLowerCase() === v || r.villageHi === query.village);
  }
  if (q) {
    rows = rows.filter(
      (r) =>
        r.khasraNumber.toLowerCase().includes(q) ||
        r.khataNumber === q ||
        r.landId.toLowerCase().includes(q) ||
        r.owner.name.toLowerCase().includes(q) ||
        r.owner.nameHi.includes(query.q!.trim()) ||
        r.village.toLowerCase().includes(q) ||
        r.villageHi.includes(query.q!.trim()) ||
        r.tehsil.toLowerCase().includes(q) ||
        r.tehsilHi.includes(query.q!.trim()),
    );
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    rows: rows.slice(start, start + pageSize),
  };
}
