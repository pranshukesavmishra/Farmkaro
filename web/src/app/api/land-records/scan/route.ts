import { NextResponse } from "next/server";
import { limited, ok, requireSession, route } from "@/server/api";
import { audit } from "@/server/db";
import { AuthError } from "@/server/core";
import { extractKhasraDocument } from "@/server/connectors/khasra-extract";

/**
 * Scan an uploaded khasra / khatauni copy and return the details found on it.
 *
 * The file is parsed in memory and never written to disk or object storage:
 * this endpoint reads a document the owner is holding, it does not archive it.
 * Everything returned is a SUGGESTION for the owner to confirm.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Magic-byte check: never trust a client-declared content type. */
function sniff(buf: Buffer): string | null {
  if (buf.length > 4 && buf.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.length > 12 && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export const POST = route(async (req) => {
  const user = await requireSession();
  await limited("khasra-scan", 20, 60 * 60 * 1000);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AuthError(400, "Attach your khasra copy as 'file'.");
  if (file.size === 0) throw new AuthError(400, "That file is empty.");
  if (file.size > MAX_BYTES) throw new AuthError(413, "File is larger than 8 MB.");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !ALLOWED.has(mime)) {
    throw new AuthError(415, "Upload a PDF or a photo (JPG, PNG or WebP) of the khasra copy.");
  }

  const extraction = await extractKhasraDocument(buf, mime);

  audit({
    actorId: user.id,
    action: "khasra_document_scanned",
    targetType: "document",
    targetId: extraction.khasraNumber ?? "unknown",
    detail: {
      source: extraction.source,
      fields: Object.keys(extraction.confidence),
      missing: extraction.missing,
      bytes: buf.length,
    },
  });

  if (extraction.source === "none") {
    return ok({
      found: false,
      source: "none",
      note:
        "This looks like a scanned photo and no text reader is connected yet. " +
        "Please type the details from the copy — it takes a moment and stays accurate.",
      extraction,
    });
  }

  return ok({
    found: Boolean(extraction.khasraNumber || extraction.village),
    source: extraction.source,
    extraction,
    note:
      "Details read from your document. Please check them — they are not added " +
      "until you confirm, and the copy itself is not stored.",
  });
});

export const GET = route(async () =>
  NextResponse.json({ error: "Use POST with a file." }, { status: 405 }),
);
