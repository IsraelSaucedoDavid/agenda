import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const svgDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "manual-identidad", "svg");
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const jobs = [
  { src: "app-icon.svg",        out: "icon-512.png",          size: 512 },
  { src: "app-icon.svg",        out: "icon-192.png",          size: 192 },
  { src: "app-icon.svg",        out: "apple-touch-icon.png",  size: 180 },
  { src: "app-icon-maskable.svg", out: "icon-512-maskable.png", size: 512 },
];

for (const job of jobs) {
  const src = path.join(svgDir, job.src);
  const dest = path.join(outDir, job.out);
  await sharp(src, { density: 300 }).resize(job.size, job.size).png().toFile(dest);
  console.log("OK", job.out, "->", job.size, "px");
}
