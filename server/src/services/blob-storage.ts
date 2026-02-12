import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.BLOB_STORAGE_PATH ?? "./blobs";
const publicBase = process.env.BLOB_STORAGE_URL;

export async function persistDataUrl(dataUrl: string, id: string): Promise<string> {
  const [meta, body] = dataUrl.split(",");
  const ext = meta.includes("image/png") ? "png" : "bin";
  await mkdir(root, { recursive: true });
  const filename = `${id}.${ext}`;
  const filepath = join(root, filename);
  await writeFile(filepath, Buffer.from(body, "base64"));
  if (publicBase) {
    return `${publicBase.replace(/\\/$/, "")}/${filename}`;
  }
  return filepath;
}
