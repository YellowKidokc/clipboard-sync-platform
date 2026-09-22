import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.BLOB_STORAGE_PATH ?? "./blobs";
const publicBase = process.env.BLOB_STORAGE_URL;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/x-icon": "ico",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",
  "text/plain": "txt",
  "text/html": "html",
  "text/csv": "csv",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

/** `data:image/jpeg;base64` -> `image/jpeg`. Returns null for a malformed header. */
function parseMimeType(meta: string): string | null {
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)/i.exec(meta);
  return match ? match[1].toLowerCase() : null;
}

export function extensionForMimeType(mimeType: string | null): string {
  if (!mimeType) return "bin";
  const known = EXTENSIONS[mimeType];
  if (known) return known;
  // Fall back to the subtype when it is a plausible extension
  // (image/avif -> avif), rather than labelling every non-PNG a .bin.
  const subtype = mimeType.split("/")[1]?.split("+")[0] ?? "";
  return /^[a-z0-9]{1,8}$/.test(subtype) ? subtype : "bin";
}

export async function persistDataUrl(dataUrl: string, id: string): Promise<string> {
  const separator = dataUrl.indexOf(",");
  if (separator === -1) {
    throw Object.assign(new Error("Malformed data URL"), { status: 400 });
  }
  const meta = dataUrl.slice(0, separator);
  const body = dataUrl.slice(separator + 1);
  if (!meta.includes(";base64")) {
    throw Object.assign(new Error("Only base64 data URLs are supported"), { status: 400 });
  }
  const ext = extensionForMimeType(parseMimeType(meta));
  await mkdir(root, { recursive: true });
  const filename = `${id}.${ext}`;
  const filepath = join(root, filename);
  await writeFile(filepath, Buffer.from(body, "base64"));
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${filename}`;
  }
  return filepath;
}
