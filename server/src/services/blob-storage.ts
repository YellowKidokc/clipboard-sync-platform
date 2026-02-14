import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.BLOB_STORAGE_PATH ?? "./blobs";

export async function persistDataUrl(dataUrl: string, id: string): Promise<string> {
  const [meta, body] = dataUrl.split(",");
  const ext = meta.includes("image/png") ? "png" : "bin";
  await mkdir(root, { recursive: true });
  const filepath = join(root, `${id}.${ext}`);
  await writeFile(filepath, Buffer.from(body, "base64"));
  return filepath;
}
