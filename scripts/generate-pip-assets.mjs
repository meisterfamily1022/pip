/**
 * Renders every production Pip brand asset from the single approved artwork at
 * assets/brand/source/pip-logo-approved.svg.
 *
 * The wordmark in that file is outlined, not live text, so nothing here depends
 * on Quicksand being installed on the machine doing the rendering. Each output
 * is produced by slicing the master canvas with a viewBox, which is also how
 * the padding and optical centring are expressed — there is no second cropping
 * pass to keep in step.
 *
 * Run with: npm run assets:pip
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'assets/brand/source/pip-logo-approved.svg');
const outputDirectory = join(root, 'assets/brand/generated');
const legacyImageDirectory = join(root, 'assets/images');
const publicDirectory = join(root, 'public');

const approvedSource = await readFile(sourcePath, 'utf8');
const defs = approvedSource.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
const wordmarkGroup = approvedSource.match(/<g id="main-wordmark"[\s\S]*?<\/g>\s*<\/g>/)?.[0];
const markGroup = approvedSource.match(/<g id="app-icon"[\s\S]*?<\/g>\s*<\/g>/)?.[0];

if (!defs || !wordmarkGroup || !markGroup) {
  throw new Error('The approved Pip artwork no longer exposes the expected defs, main-wordmark and app-icon groups.');
}

/**
 * Ink bounds of each group on the master canvas, in font units. These are the
 * geometry the artwork documents; if the artwork moves, these move with it.
 */
const ink = {
  wordmark: { x: 134, y: 57, width: 1329, height: 1243 },
  mark: { x: 1674, y: 57, width: 494, height: 1243 },
};

/** Clear space equals the height of the p bowl — one x-height, 525 units. */
const clearSpace = 525;
// Keep a small transparent margin around any intentionally tight export.
// Rasterising directly on the ink edge can cut antialiased pixels on native
// splash screens and browser image decoders.
const edgePadding = 64;

const canvas = '#FFFFFF';

/**
 * Frames a group so its ink occupies `heightRatio` of a box with the given
 * aspect, centred, then nudged down by `opticalShift` (as a fraction of the
 * box height) because the spark makes the mark top-heavy.
 */
function frame(bounds, { aspect, heightRatio, opticalShift = 0 }) {
  const boxHeight = bounds.height / heightRatio;
  const boxWidth = boxHeight * aspect;
  const centreX = bounds.x + (bounds.width / 2);
  const centreY = bounds.y + (bounds.height / 2);
  return [
    centreX - (boxWidth / 2),
    centreY - (boxHeight / 2) - (boxHeight * opticalShift),
    boxWidth,
    boxHeight,
  ].map((value) => Number(value.toFixed(2))).join(' ');
}

/** Frames a group tightly, with equal padding on all four sides. */
function pad(bounds, padding) {
  return [bounds.x - padding, bounds.y - padding, bounds.width + (padding * 2), bounds.height + (padding * 2)]
    .join(' ');
}

/**
 * Renders at `supersample`× the target and lets sharp resolve back down, so
 * the 64px favicon and the 1024px icon get the same edge quality. The explicit
 * width and height matter: without them the rasteriser sizes the document from
 * the viewBox in font units, which at any useful density blows the pixel limit.
 */
const supersample = 4;

function document(viewBox, group, background, width, height) {
  const ground = background ? `<rect x="-100000" y="-100000" width="200000" height="200000" fill="${background}"/>` : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * supersample}" height="${height * supersample}" viewBox="${viewBox}">${defs}${ground}${group}</svg>`,
  );
}

const wordmarkAspect = ink.wordmark.width / ink.wordmark.height;
const markAspect = ink.mark.width / ink.mark.height;

const outputs = [
  // In-app wordmark with enough room to preserve antialiased outer edges.
  { name: 'pip-wordmark.png', group: wordmarkGroup, viewBox: pad(ink.wordmark, edgePadding), width: 1200, height: Math.round(1200 * ((ink.wordmark.height + (edgePadding * 2)) / (ink.wordmark.width + (edgePadding * 2)))) },
  // Wordmark with the documented clear space, for placement outside the app.
  { name: 'pip-lockup.png', group: wordmarkGroup, viewBox: pad(ink.wordmark, clearSpace), width: 1200, height: Math.round(1200 * ((ink.wordmark.height + (clearSpace * 2)) / (ink.wordmark.width + (clearSpace * 2)))) },
  // Compact mark with enough room to preserve antialiased outer edges.
  { name: 'pip-symbol.png', group: markGroup, viewBox: pad(ink.mark, edgePadding), width: 512, height: Math.round(512 * ((ink.mark.height + (edgePadding * 2)) / (ink.mark.width + (edgePadding * 2)))) },
  // iOS app icon: flat white ground, no text, mark optically centred.
  { name: 'pip-app-icon.png', group: markGroup, viewBox: frame(ink.mark, { aspect: 1, heightRatio: 0.74, opticalShift: 0.02 }), width: 1024, height: 1024, background: canvas, flatten: true },
  // Android adaptive foreground: transparent, ink kept inside the 66% safe zone.
  { name: 'pip-android-foreground.png', group: markGroup, viewBox: frame(ink.mark, { aspect: 1, heightRatio: 0.58, opticalShift: 0.02 }), width: 432, height: 432 },
  // Splash: the wordmark, drawn over the splash background Expo supplies.
  { name: 'pip-splash.png', group: wordmarkGroup, viewBox: pad(ink.wordmark, edgePadding), width: 720, height: Math.round(720 * ((ink.wordmark.height + (edgePadding * 2)) / (ink.wordmark.width + (edgePadding * 2)))) },
  { name: 'pip-favicon.png', group: markGroup, viewBox: frame(ink.mark, { aspect: 1, heightRatio: 0.82 }), width: 64, height: 64 },
  // Social preview.
  { name: 'pip-preview.png', group: wordmarkGroup, viewBox: frame(ink.wordmark, { aspect: 1200 / 630, heightRatio: 0.6 }), width: 1200, height: 630, background: canvas, flatten: true },
];

await mkdir(outputDirectory, { recursive: true });
await mkdir(legacyImageDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });

for (const { name, group, viewBox, width, height, background, flatten } of outputs) {
  let pipeline = sharp(document(viewBox, group, background, width, height)).resize({ width, height, fit: 'fill' });
  if (flatten) pipeline = pipeline.flatten({ background });
  await pipeline.png({ compressionLevel: 9, palette: false }).toFile(join(outputDirectory, name));
}

const aliases = [
  ['pip-app-icon.png', 'icon.png'],
  ['pip-android-foreground.png', 'android-icon-foreground.png'],
  ['pip-splash.png', 'splash-icon.png'],
  ['pip-favicon.png', 'favicon.png'],
];
for (const [generated, alias] of aliases) {
  await writeFile(join(legacyImageDirectory, alias), await readFile(join(outputDirectory, generated)));
}

const published = ['pip-preview.png', 'pip-symbol.png', 'pip-wordmark.png', 'pip-lockup.png'];
for (const name of published) {
  await writeFile(join(publicDirectory, name), await readFile(join(outputDirectory, name)));
}
await writeFile(join(publicDirectory, 'pip-icon.png'), await readFile(join(outputDirectory, 'pip-app-icon.png')));

console.log(`Generated ${outputs.length} Pip assets from ${sourcePath}`);
