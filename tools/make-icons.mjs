// Gera os PNG dos ícones a partir dos SVG: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../icons/', import.meta.url));
const out = [
  ['icon.svg', 'apple-touch-icon-180.png', 180],
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, dest, size] of out) {
  const svg = readFileSync(dir + src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: dir + dest, omitBackground: false });
  console.log(dest);
}
await browser.close();
