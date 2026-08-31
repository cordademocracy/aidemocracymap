/**
 * Composes a static 1200x630 OG/Twitter card from the map's ocean/island
 * palette. Run: bun run generate-og
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/og.png");

const W = 1200;
const H = 630;

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#08090c" />
  <ellipse cx="600" cy="820" rx="620" ry="420" fill="#1f7a5c" />
  <ellipse cx="600" cy="800" rx="480" ry="320" fill="#2e8c6a" />
  <ellipse cx="600" cy="770" rx="330" ry="230" fill="#57b98c" opacity="0.6" />
  <text x="90" y="270" font-family="monospace" font-size="30" letter-spacing="6" fill="#f2849a">AI 4 DEMOCRACY</text>
  <text x="90" y="360" font-family="monospace" font-size="66" font-weight="700" fill="#f5f6f7">Map of AI</text>
  <text x="90" y="436" font-family="monospace" font-size="66" font-weight="700" fill="#f5f6f7">&amp; Democracy</text>
  <text x="90" y="500" font-family="monospace" font-size="24" fill="#c0e4ec">Organizations · research · tools · funders</text>
</svg>
`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${out}`);
