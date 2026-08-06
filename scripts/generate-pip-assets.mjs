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

const wordmark = approvedSource.match(/<g id="main-wordmark"[\s\S]*?<\/g>/)?.[0];
const tagline = approvedSource.match(/<text id="tagline"[\s\S]*?<\/text>/)?.[0];
const iconGroup = approvedSource.match(/<g id="app-icon"[\s\S]*?<\/g>/)?.[0]
  ?.replace(/ filter="url\(#softShadow\)"/, '')
  .replace(/\s*<rect id="app-icon-background"[^>]*\/>/, '');

if (!wordmark || !tagline || !iconGroup) throw new Error('Approved Pip logo groups could not be located.');

const svg = (viewBox, content, background = '') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${background}${content}</svg>`,
);
const transparentLockup = svg('190 175 760 690', `${wordmark}${tagline}`);
const transparentWordmark = svg('190 175 760 610', wordmark);
const transparentSymbol = svg('1010 355 300 325', iconGroup);
const cream = '#FFF9F0';

await mkdir(outputDirectory, { recursive: true });
await mkdir(legacyImageDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });

const outputs = [
  ['pip-lockup.png', transparentLockup, 1200, 1089, null],
  ['pip-wordmark.png', transparentWordmark, 1200, 963, null],
  ['pip-symbol.png', transparentSymbol, 512, 555, null],
  ['pip-app-icon.png', transparentSymbol, 1024, 1024, cream, 760, 823],
  ['pip-android-foreground.png', transparentSymbol, 432, 432, null, 280, 303],
  ['pip-splash.png', transparentWordmark, 720, 578, null],
  ['pip-favicon.png', transparentSymbol, 64, 64, null, 50, 54],
  ['pip-preview.png', transparentLockup, 1200, 630, cream, 760, 630],
];

for (const [name, source, width, height, background, contentWidth = width, contentHeight = height] of outputs) {
  const horizontalPadding = width - contentWidth;
  const verticalPadding = height - contentHeight;
  let pipeline = sharp(source, { density: 384 })
    .resize({ width: contentWidth, height: contentHeight, fit: 'contain' })
    .extend({
      left: Math.floor(horizontalPadding / 2), right: Math.ceil(horizontalPadding / 2),
      top: Math.floor(verticalPadding / 2), bottom: Math.ceil(verticalPadding / 2),
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    });
  if (background) pipeline = pipeline.flatten({ background });
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
await writeFile(join(publicDirectory, 'pip-preview.png'), await readFile(join(outputDirectory, 'pip-preview.png')));
await writeFile(join(publicDirectory, 'pip-icon.png'), await readFile(join(outputDirectory, 'pip-app-icon.png')));
await writeFile(join(publicDirectory, 'pip-symbol.png'), await readFile(join(outputDirectory, 'pip-symbol.png')));
await writeFile(join(publicDirectory, 'pip-wordmark.png'), await readFile(join(outputDirectory, 'pip-wordmark.png')));
await writeFile(join(publicDirectory, 'pip-lockup.png'), await readFile(join(outputDirectory, 'pip-lockup.png')));

console.log(`Generated ${outputs.length} Pip assets from ${sourcePath}`);
