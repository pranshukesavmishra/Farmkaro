/**
 * Khasra document reader tests.
 *
 * Uses realistic Hindi (Devanagari) and English khasra/khatauni text, since
 * that is what MP Bhulekh copies actually look like. The reader must pull the
 * right fields out, convert hectares correctly, report per-field confidence,
 * and — crucially — never invent a field it could not find.
 */
import { describe, expect, it } from "vitest";
import { extractFromText, normaliseText } from "@/server/connectors/khasra-extract";

const HINDI_COPY = `
मध्य प्रदेश शासन
भू-अभिलेख प्रतिलिपि (खसरा)
जिला : जबलपुर
तहसील : पनागर
ग्राम का नाम : बेलखेड़ा
खसरा क्रमांक : २१४/३
खाता क्रमांक : ११७
भू-स्वामी का नाम : रमेश पटेल
रकबा : 1.2340 हेक्टेयर
भू-स्वामी कोड : BS-MP-9931245
`;

const ENGLISH_COPY = `
GOVERNMENT OF MADHYA PRADESH
Land Record Copy (Khasra)
District: Jabalpur
Tehsil: Sihora
Village: Gosalpur
Khasra No.: 77/1
Khata No.: 402
Owner Name: Sunita Yadav
Area: 0.8090 ha
`;

describe("text normalisation", () => {
  it("converts Devanagari digits to Latin", () => {
    expect(normaliseText("खसरा २१४/३")).toContain("214/3");
  });
  it("collapses runs of spaces without destroying lines", () => {
    const out = normaliseText("जिला  :   जबलपुर\nतहसील : पनागर");
    expect(out).toContain("जिला : जबलपुर");
    expect(out.split("\n")).toHaveLength(2);
  });
});

describe("Hindi khasra copy", () => {
  const r = extractFromText(HINDI_COPY, "pdf_text");

  it("reads the khasra number, converting Devanagari digits", () => {
    expect(r.khasraNumber).toBe("214/3");
    expect(r.confidence.khasraNumber).toBeGreaterThan(0.8);
  });

  it("reads khata number and Bhu-Swami code", () => {
    expect(r.khataNumber).toBe("117");
    expect(r.bhuswamiId).toBe("BS-MP-9931245");
  });

  it("reads the place hierarchy", () => {
    expect(r.village).toBe("बेलखेड़ा");
    expect(r.tehsil).toBe("पनागर");
    expect(r.district).toBe("जबलपुर");
    expect(r.state).toBe("Madhya Pradesh");
  });

  it("reads the owner name", () => {
    expect(r.ownerName).toBe("रमेश पटेल");
  });

  it("converts hectares to acres", () => {
    expect(r.areaHectares).toBeCloseTo(1.234, 3);
    expect(r.areaAcres).toBeCloseTo(3.049, 2); // 1.234 ha * 2.47105
    expect(r.confidence.area).toBeGreaterThan(0.8);
  });

  it("reports nothing missing for a complete copy", () => {
    expect(r.missing).toEqual([]);
  });
});

describe("English khasra copy", () => {
  const r = extractFromText(ENGLISH_COPY, "pdf_text");

  it("reads the same fields from English labels", () => {
    expect(r.khasraNumber).toBe("77/1");
    expect(r.khataNumber).toBe("402");
    expect(r.village).toBe("Gosalpur");
    expect(r.tehsil).toBe("Sihora");
    expect(r.district).toBe("Jabalpur");
    expect(r.ownerName).toBe("Sunita Yadav");
  });

  it("converts 0.809 ha to about 2 acres", () => {
    expect(r.areaAcres).toBeCloseTo(2.0, 1);
  });
});

describe("never invents data", () => {
  it("returns no fields for unrelated text, and names what is missing", () => {
    const r = extractFromText("This is a rent agreement between two parties.", "pdf_text");
    expect(r.khasraNumber).toBeUndefined();
    expect(r.village).toBeUndefined();
    expect(r.areaAcres).toBeUndefined();
    expect(r.missing).toEqual(["khasraNumber", "village", "district"]);
  });

  it("flags a bare unlabelled area as low confidence rather than trusting it", () => {
    const r = extractFromText("ग्राम : पनागर\nरकबा : 2.5", "pdf_text");
    expect(r.areaHectares).toBe(2.5);
    expect(r.confidence.area).toBeLessThan(0.6);
  });

  it("does not report a confidence for a field it did not find", () => {
    const r = extractFromText("Khasra No.: 12/4", "pdf_text");
    expect(r.confidence.khasraNumber).toBeGreaterThan(0);
    expect(r.confidence.village).toBeUndefined();
    expect(r.confidence.area).toBeUndefined();
  });

  it("stops a place name at the next field when a copy puts them on one line", () => {
    const r = extractFromText(
      "Khasra No.: 722/7  Village: Panagar  Area: 4.690 hectare  Tehsil: Panagar",
      "pdf_text",
    );
    expect(r.village).toBe("Panagar");
    expect(r.khasraNumber).toBe("722/7");
    expect(r.areaHectares).toBe(4.69);
  });

  it("keeps a place name whose own words look like labels", () => {
    const r = extractFromText("ग्राम : पनागर खुर्द\nजिला : जबलपुर", "pdf_text");
    expect(r.village).toBe("पनागर खुर्द");
    expect(r.district).toBe("जबलपुर");
  });

  it("marks the source so the UI can say how the details were read", () => {
    expect(extractFromText(ENGLISH_COPY, "ocr").source).toBe("ocr");
    expect(extractFromText(ENGLISH_COPY, "pdf_text").source).toBe("pdf_text");
  });
});
