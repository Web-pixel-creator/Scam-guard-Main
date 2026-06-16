import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { decodeQrFromDataUrl } from "@/lib/risk/qr-decoder";

const files = process.argv.slice(2);

function mimeFromPath(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

for (const file of files) {
  const bytes = readFileSync(file);
  const dataUrl = `data:${mimeFromPath(file)};base64,${bytes.toString("base64")}`;
  const result = decodeQrFromDataUrl(dataUrl);
  console.log(`${basename(file)} ${JSON.stringify(result)}`);
}
