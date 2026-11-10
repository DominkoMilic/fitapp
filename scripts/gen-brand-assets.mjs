// Generates every PACE icon from one drawing (the "Pace ring" logo: a runner inside an open
// progress ring) into assets/brand/. app.config.ts points at these files; `expo prebuild` turns
// them into the native Android/iOS icons, splash and notification icon.
// Usage (Playwright is not a project dependency; install it temporarily):
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/gen-brand-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'assets', 'brand');
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('playwright');

const INK = '#121417'; // app dark background
const MINT = '#34D399'; // app accent (dark theme)
const WHITE = '#FFFFFF';

const stroke = (w, color) =>
  `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

/** Runner centred around (cx, cy) at scale k; the head rests on the shoulders. */
function runner(cx, cy, k, color, w) {
  const p = (x, y) => `${cx + x * k},${cy + y * k}`;
  return `<circle cx="${cx + 66 * k}" cy="${cy - 244 * k}" r="${68 * k}" fill="${color}"/>
    <path ${stroke(w * k, color)} d="M${p(34, -150)} L${p(-30, 40)}"/>
    <path ${stroke(w * k, color)} d="M${p(30, -140)} L${p(130, -70)} L${p(200, -160)}"/>
    <path ${stroke(w * k, color)} d="M${p(30, -140)} L${p(-60, -70)} L${p(-120, 10)}"/>
    <path ${stroke(w * k, color)} d="M${p(-30, 40)} L${p(100, 120)} L${p(70, 270)}"/>
    <path ${stroke(w * k, color)} d="M${p(-30, 40)} L${p(-90, 170)} L${p(-230, 200)}"/>`;
}

/** The mark (ring + runner) on a 1024 canvas, scaled around the centre. */
function mark({ scale = 1, ring = MINT, figure = WHITE, bold = false }) {
  const ringW = bold ? 96 : 58;
  const r = bold ? 420 : 330;
  const dash = bold ? '2100 539' : '1660 414';
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <circle cx="512" cy="512" r="${r}" ${stroke(ringW, ring)} stroke-dasharray="${dash}" transform="rotate(-50 512 512)"/>
    ${bold ? runner(500, 545, 0.92, figure, 96) : runner(500, 545, 0.72, figure, 70)}
  </g>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${body}</svg>`;

const files = {
  // Master drawings (sources of truth, kept as SVG).
  'pace-logo.svg': svg(`<rect width="1024" height="1024" rx="232" fill="${INK}"/>${mark({})}`),
  'pace-mark.svg': svg(mark({})),
  'pace-mono.svg': svg(mark({ ring: WHITE, bold: true })),
};
// PNGs the app config uses: [name, svg, size].
const pngs = [
  // iOS / store icon: full-bleed square (the OS applies its own rounded mask), no transparency.
  ['icon.png', svg(`<rect width="1024" height="1024" fill="${INK}"/>${mark({})}`), 1024],
  // Android adaptive icon: transparent foreground inside the 66 dp safe zone; the background is
  // the solid colour from app.config.ts.
  ['android-icon-foreground.png', svg(mark({ scale: 0.85 })), 1024],
  // Android 13+ themed icon: one-colour silhouette, same framing as the foreground.
  ['android-icon-monochrome.png', svg(mark({ scale: 0.85, ring: WHITE })), 1024],
  // Splash: the rounded tile reads on both the light and the dark splash background.
  ['splash-icon.png', files['pace-logo.svg'], 1024],
  ['favicon.png', files['pace-logo.svg'], 64],
  // Android notification small icon: white silhouette, bold strokes for 24 dp (tinted by Android).
  ['notification-icon.png', files['pace-mono.svg'], 96],
];

mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, content, px] of pngs) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<body style="margin:0;background:transparent">${content.replace('width="1024" height="1024"', `width="${px}" height="${px}"`)}</body>`,
  );
  await page.locator('svg').screenshot({ path: join(out, name), omitBackground: true });
}
await browser.close();
console.log(`brand assets written to ${out}`);
