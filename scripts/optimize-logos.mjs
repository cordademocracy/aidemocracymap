/**
 * Converts every public/logos/<slug>.png into <slug>-80.webp + <slug>-120.webp
 * (2x/3x densities for the ~40px rendered logo). Skips outputs newer than
 * their source. Run: bun run optimize-logos (after fetch-logos)
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/logos");
const SIZES = [80, 120];

const pngs = (await readdir(dir)).filter((f) => f.endsWith(".png"));
let converted = 0;
let cached = 0;
let failed = 0;

for (const file of pngs) {
  const src = path.join(dir, file);
  const slug = file.slice(0, -4);
  const srcMtime = (await stat(src)).mtimeMs;
  for (const size of SIZES) {
    const dest = path.join(dir, `${slug}-${size}.webp`);
    try {
      if ((await stat(dest).catch(() => null))?.mtimeMs > srcMtime) {
        cached++;
        continue;
      }
      await sharp(src)
        .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .webp({ quality: 82 })
        .toFile(dest);
      converted++;
    } catch (err) {
      failed++;
      console.error(`FAILED  ${slug}-${size}: ${err.message}`);
    }
  }
}

console.log(`Done: ${converted} converted, ${cached} cached, ${failed} failed (${pngs.length} sources).`);
if (failed) process.exit(1);
