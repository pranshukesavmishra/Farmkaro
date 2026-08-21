/**
 * The pilot land-record set — जबलपुर भू-अभिलेख (pilot dataset).
 *
 * Seven khasra/khatauni records supplied by the FarmKaro Lease Desk for the
 * Jabalpur pilot, served through the consent-gated land-records connector
 * exactly as an authorised government feed would be. Marked non-authoritative
 * everywhere: live verification against MP Bhulekh happens at onboarding,
 * and until then every surface says so.
 *
 * Location honesty: records carry no cadastral geometry, so each is anchored
 * at its village's gazetteer centroid (VILLAGE precision). We never draw an
 * invented parcel boundary; the map shows a pin at the right village with the
 * precision stated. चौहद्दी (the four abutting plots) is carried as text from
 * the record itself.
 *
 * Personal data: owner names, shares and encumbrance status are shown ONLY to
 * the person who looked the record up by its own identifier, behind the
 * consent gate. Nothing here feeds any browse, search-by-name or listing
 * surface.
 */
import { HECTARE_TO_ACRE, BIGHA_PER_ACRE } from "./district";

export interface RecordOwner {
  name: string;
  nameHi: string;
  /** "S/o …" / "W/o …" as printed on the record. */
  relation: string;
  sharePercent: number;
  aadhaarVerified: boolean;
}

export interface CropEntry {
  season: "rabi" | "kharif" | "annual";
  crop: string;
  areaHectares: number;
  irrigated: boolean;
}

export type EncumbranceStatus = "clean" | "mortgaged" | "protected_tenure";

export interface OfficialLandRecord {
  /** Pilot land id as printed on the record (not a live ULPIN). */
  landId: string;
  khasraNumber: string;
  khataNumber: string;
  village: string;       // registry village name (English)
  tehsilCode: string;
  halka: string;
  owners: RecordOwner[];
  areaHectares: number;
  landUse: string;
  soil: string;
  soilHi: string;
  irrigation: string;
  /** Annual land revenue (लगान), ₹/year. */
  revenuePerYear: number;
  crops: CropEntry[];
  /** चौहद्दी — the four abutting plots, as printed. */
  boundaries: { north: string; south: string; east: string; west: string };
  encumbrance: { status: EncumbranceStatus; detail: string };
  mutation: { orderNo: string; date: string; note: string };
}

export const derivedAcres = (r: OfficialLandRecord) => r.areaHectares * HECTARE_TO_ACRE;
export const derivedBigha = (r: OfficialLandRecord) => derivedAcres(r) * BIGHA_PER_ACRE;

export const OFFICIAL_RECORDS: OfficialLandRecord[] = [
  {
    landId: "MP-JBL-PAN-10401",
    khasraNumber: "104/1",
    khataNumber: "34",
    village: "Panagar",
    tehsilCode: "JBL-02",
    halka: "01/A",
    owners: [
      { name: "Ramkumar Patel", nameHi: "रामकुमार पटेल", relation: "S/o late Babulal Patel", sharePercent: 50, aadhaarVerified: true },
      { name: "Suresh Patel", nameHi: "सुरेश पटेल", relation: "S/o late Babulal Patel", sharePercent: 50, aadhaarVerified: true },
    ],
    areaHectares: 1.842,
    landUse: "Agriculture (canal irrigated)",
    soil: "Deep black cotton soil",
    soilHi: "गहरी काली कपासी मिट्टी",
    irrigation: "3 HP borewell + Bargi right-bank main canal",
    revenuePerYear: 148.5,
    crops: [
      { season: "rabi", crop: "Wheat (Sharbati GW-322)", areaHectares: 1.2, irrigated: true },
      { season: "rabi", crop: "Gram (desi JG-14)", areaHectares: 0.642, irrigated: true },
      { season: "kharif", crop: "Soybean (JS-2034)", areaHectares: 1.842, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 103 (canal road)",
      south: "Khasra 105 (Mahendra Lodhi)",
      east: "Khasra 104/2 (gram panchayat chak marg)",
      west: "Khasra 98 (Rajendra Shukla)",
    },
    encumbrance: { status: "clean", detail: "Clean title — no bank mortgage recorded" },
    mutation: { orderNo: "RCMS/2022/9841", date: "2022-08-14", note: "Inheritance (fauti) mutation — Tehsildar Panagar" },
  },
  {
    landId: "MP-JBL-SIH-21502",
    khasraNumber: "215/2",
    khataNumber: "88",
    village: "Gosalpur",
    tehsilCode: "JBL-03",
    halka: "11/B",
    owners: [
      { name: "Smt. Geeta Bai", nameHi: "श्रीमती गीता बाई", relation: "W/o late Madanlal Kurmi", sharePercent: 100, aadhaarVerified: true },
    ],
    areaHectares: 2.45,
    landUse: "Agriculture (well/pond irrigated)",
    soil: "Medium clay loam",
    soilHi: "मध्यम दोमट मिट्टी",
    irrigation: "Tubewell + PMKSY farm pond",
    revenuePerYear: 196,
    crops: [
      { season: "rabi", crop: "Green peas (AP-3)", areaHectares: 1.5, irrigated: true },
      { season: "rabi", crop: "Mustard (Pusa Bold)", areaHectares: 0.95, irrigated: true },
      { season: "kharif", crop: "Paddy (Kranti)", areaHectares: 2.45, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 214 (Gosalpur main pucca road)",
      south: "Khasra 216 (Dinesh Kushwaha)",
      east: "Khasra 215/1 (government nala)",
      west: "Khasra 212 (Kailash Singh)",
    },
    encumbrance: {
      status: "mortgaged",
      detail: "Mortgage recorded — Central Bank of India, Sihora branch (KCC loan ₹3,50,000)",
    },
    mutation: { orderNo: "RCMS/2021/3421", date: "2021-02-09", note: "Fauti mutation — Tehsildar Sihora" },
  },
  {
    landId: "MP-JBL-PAT-04803",
    khasraNumber: "48/3",
    khataNumber: "12",
    village: "Belkheda",
    tehsilCode: "JBL-04",
    halka: "16/C",
    owners: [
      { name: "Rajesh Sharma", nameHi: "राजेश शर्मा", relation: "S/o Shri Vidyadhar Sharma", sharePercent: 100, aadhaarVerified: true },
    ],
    areaHectares: 3.12,
    landUse: "Agriculture (tubewell irrigated)",
    soil: "Fertile alluvial soil (Hiran river belt)",
    soilHi: "उपजाऊ कछारी मिट्टी",
    irrigation: "5 HP PM-KUSUM solar pump",
    revenuePerYear: 248,
    crops: [
      { season: "rabi", crop: "Wheat (JW-3288)", areaHectares: 2.0, irrigated: true },
      { season: "rabi", crop: "Kabuli (dollar) gram", areaHectares: 1.12, irrigated: true },
      { season: "kharif", crop: "Urad (JU-3)", areaHectares: 3.12, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 47 (Hiran river embankment)",
      south: "Khasra 49 (Omprakash Chaurasia)",
      east: "Khasra 52 (public chak marg)",
      west: "Khasra 46 (forest department boundary)",
    },
    encumbrance: { status: "clean", detail: "Clean title" },
    mutation: { orderNo: "RCMS/2023/1102", date: "2023-11-18", note: "Registered sale mutation — Tehsildar Patan" },
  },
  {
    landId: "MP-JBL-URB-08901",
    khasraNumber: "89/1",
    khataNumber: "56",
    village: "Bargi",
    tehsilCode: "JBL-01",
    halka: "33/D",
    owners: [
      { name: "Vikram Singh Thakur", nameHi: "विक्रम सिंह ठाकुर", relation: "S/o Shri Mansingh Thakur", sharePercent: 70, aadhaarVerified: true },
      { name: "Amarjeet Singh Thakur", nameHi: "अमरजीत सिंह ठाकुर", relation: "S/o Shri Mansingh Thakur", sharePercent: 30, aadhaarVerified: true },
    ],
    areaHectares: 4.8,
    landUse: "Agro-horticulture",
    soil: "Black loam",
    soilHi: "काली दोमट मिट्टी",
    irrigation: "Bargi dam backwater micro-drip",
    revenuePerYear: 384,
    crops: [
      { season: "annual", crop: "VNR Bihi guava orchard (drip)", areaHectares: 2.0, irrigated: true },
      { season: "rabi", crop: "Wheat (GW-273)", areaHectares: 2.8, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 88 (Narmada backwater zone)",
      south: "Khasra 90 (NH-30 service road, Jabalpur–Mandla)",
      east: "Khasra 92 (Devendra Patel)",
      west: "Khasra 85 (government grazing land)",
    },
    encumbrance: {
      status: "mortgaged",
      detail: "Mortgage recorded — SBI Bargi Nagar branch (horticulture loan ₹6,00,000)",
    },
    mutation: { orderNo: "RCMS/2019/7612", date: "2019-06-04", note: "Family partition — Tehsildar Jabalpur" },
  },
  {
    landId: "MP-JBL-SHA-31200",
    khasraNumber: "312",
    khataNumber: "104",
    village: "Bhitoni",
    tehsilCode: "JBL-07",
    halka: "15/D",
    owners: [
      { name: "Satish Kumar Sharma", nameHi: "सतीश कुमार शर्मा", relation: "S/o Shri Premnarayan Sharma", sharePercent: 100, aadhaarVerified: true },
    ],
    areaHectares: 1.25,
    landUse: "Agriculture (canal irrigated)",
    soil: "Heavy clay soil",
    soilHi: "भारी चिकनी मिट्टी",
    irrigation: "Narmada minor canal + open well",
    revenuePerYear: 100,
    crops: [
      { season: "rabi", crop: "Wheat (HI-1544 Purna)", areaHectares: 1.25, irrigated: true },
      { season: "kharif", crop: "Soybean (RVS 2001-4)", areaHectares: 1.25, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 311 (Bhitoni railway siding)",
      south: "Khasra 313 (Prakash Netam)",
      east: "Khasra 315 (government footpath)",
      west: "Khasra 308 (Narmada minor canal)",
    },
    encumbrance: { status: "clean", detail: "Clean title" },
    mutation: { orderNo: "RCMS/2024/0411", date: "2024-01-15", note: "Sale-deed mutation — Tehsildar Shahpura" },
  },
  {
    landId: "MP-JBL-KUN-14502",
    khasraNumber: "145/2",
    khataNumber: "41",
    village: "Baghraji",
    tehsilCode: "JBL-05",
    halka: "13/C",
    owners: [
      { name: "Santosh Dhurve", nameHi: "संतोष धुर्वे", relation: "S/o Shri Sukhdev Dhurve", sharePercent: 100, aadhaarVerified: true },
    ],
    areaHectares: 2.1,
    landUse: "Agriculture — Forest Rights Act 2006 patta",
    soil: "Red sandy loam",
    soilHi: "लाल रेतीली दोमट",
    irrigation: "Rainfed + check dam",
    revenuePerYear: 168,
    crops: [
      { season: "rabi", crop: "Gram and linseed", areaHectares: 1.5, irrigated: false },
      { season: "kharif", crop: "Kodo-kutki millets", areaHectares: 2.1, irrigated: false },
    ],
    boundaries: {
      north: "Khasra 144 (village forest boundary)",
      south: "Khasra 146 (Ganesh Markam)",
      east: "Khasra 150 (nala)",
      west: "Khasra 141 (Kundam–Baghraji main road)",
    },
    encumbrance: {
      status: "protected_tenure",
      detail: "Non-transferable FRA 2006 patta (tribal protected title — clean)",
    },
    mutation: { orderNo: "FRA/JBL/KND/2018", date: "2018-10-12", note: "SDO (Revenue), Kundam" },
  },
  {
    landId: "MP-JBL-MAJ-07704",
    khasraNumber: "77/4",
    khataNumber: "63",
    village: "Indrana",
    tehsilCode: "JBL-06",
    halka: "17/A",
    owners: [
      { name: "Neeraj Sahu", nameHi: "नीरज साहू", relation: "S/o Shri Ramkishore Sahu", sharePercent: 50, aadhaarVerified: true },
      { name: "Kamlesh Patel", nameHi: "कमलेश पटेल", relation: "S/o Shri Shivcharan Patel", sharePercent: 50, aadhaarVerified: true },
    ],
    areaHectares: 1.65,
    landUse: "Agriculture (tubewell irrigated)",
    soil: "Medium black soil",
    soilHi: "मध्यम काली मिट्टी",
    irrigation: "5 HP tubewell",
    revenuePerYear: 132,
    crops: [
      { season: "rabi", crop: "Wheat (GW-366)", areaHectares: 1.2, irrigated: true },
      { season: "rabi", crop: "Lentil (JL-3)", areaHectares: 0.45, irrigated: true },
    ],
    boundaries: {
      north: "Khasra 76 (Pariat river course)",
      south: "Khasra 78 (Indrana bazaar road)",
      east: "Khasra 80 (Heeralal Gontiya)",
      west: "Khasra 75 (government gochar)",
    },
    encumbrance: { status: "clean", detail: "Clean title" },
    mutation: { orderNo: "RCMS/2023/5549", date: "2023-07-22", note: "Tehsildar Majholi" },
  },
];
