import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import appConfig from '../../app.json';
import { pipLogoColors } from '../theme/playmap-theme';

const root = join(__dirname, '../..');
const artwork = readFileSync(join(root, 'assets/brand/source/pip-logo-approved.svg'), 'utf8');

describe('the approved Pip artwork', () => {
  it('sets the wordmark as outlines, so it rasterises without Quicksand installed', () => {
    expect(artwork).not.toMatch(/<text/);
    expect(artwork).toMatch(/<path id="pip-p"/);
    expect(artwork).toMatch(/<path id="pip-dotless-i"/);
  });

  it('uses the approved logo colours and no others', () => {
    const used = new Set(artwork.match(/fill="#[0-9A-F]{6}"/gi)?.map((match) => match.slice(7, -1).toUpperCase()));
    const approved = new Set(Object.values(pipLogoColors).map((value) => value.slice(1).toUpperCase()));
    expect([...used].filter((colour) => !approved.has(colour))).toEqual([]);
  });

  it('keeps the wordmark blue and carries no green lettering', () => {
    const wordmark = artwork.match(/<g id="main-wordmark"[\s\S]*?<\/g>\s*<\/g>/)?.[0] ?? '';
    expect(wordmark).toContain(`fill="${pipLogoColors.wordmark}"`);
    expect(wordmark).not.toContain(pipLogoColors.raySage.toLowerCase());
  });

  it('builds the spark from a dot and exactly three distinct pastel marks', () => {
    const spark = artwork.match(/<g id="pip-spark">[\s\S]*?<\/g>/)?.[0] ?? '';
    expect(spark.match(/<circle/g)).toHaveLength(1);
    expect(spark).toContain(pipLogoColors.dot);
    const markColours = [pipLogoColors.rayPink, pipLogoColors.raySage, pipLogoColors.rayLavender];
    expect(new Set(markColours).size).toBe(3);
    for (const colour of markColours) expect(spark).toContain(colour);
    expect(spark.match(/<rect/g)).toHaveLength(3);
  });

  it('centres the spark on the dotless i stem axis', () => {
    // The dotless i is placed at x=614 and its stem spans 71..151 in glyph
    // space, so the axis is 725 — which is where the spark is used.
    expect(artwork).toMatch(/<use href="#pip-dotless-i" x="614"\/>/);
    expect(artwork).toMatch(/<use href="#pip-spark" x="725"\/>/);
  });
});

describe('Pip generated brand assets', () => {
  it.each([
    'assets/brand/generated/pip-lockup.png',
    'assets/brand/generated/pip-wordmark.png',
    'assets/brand/generated/pip-symbol.png',
    'assets/brand/generated/pip-app-icon.png',
    'assets/brand/generated/pip-android-foreground.png',
    'assets/brand/generated/pip-splash.png',
    'assets/brand/generated/pip-favicon.png',
    'assets/brand/generated/pip-preview.png',
    'assets/fonts/Montserrat-Regular.ttf',
    'assets/fonts/Montserrat-Bold.ttf',
    'assets/fonts/Quicksand-Medium.ttf',
    'assets/fonts/OFL.txt',
  ])('includes non-empty %s', (relativePath) => {
    const asset = join(root, relativePath);
    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeGreaterThan(100);
  });

  it('points Expo configuration only at generated Pip brand assets', () => {
    expect(appConfig.expo.icon).toContain('assets/brand/generated/pip-app-icon.png');
    expect(appConfig.expo.ios.icon).toContain('assets/brand/generated/pip-app-icon.png');
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toContain('pip-android-foreground.png');
    expect(appConfig.expo.web.favicon).toContain('pip-favicon.png');
    expect(JSON.stringify(appConfig.expo.plugins)).toContain('pip-splash.png');
  });

  it('grounds the app on the redesign canvas rather than the retired cream', () => {
    expect(appConfig.expo.backgroundColor).toBe('#FFFFFF');
    expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe('#FFFFFF');
    expect(appConfig.expo.primaryColor).toBe(pipLogoColors.wordmark);
    expect(JSON.stringify(appConfig.expo.plugins)).not.toContain('#FFF9F0');
  });

  it('keeps native icon canvases and transparency platform-appropriate', async () => {
    const ios = await sharp(join(root, 'assets/brand/generated/pip-app-icon.png')).metadata();
    const android = await sharp(join(root, 'assets/brand/generated/pip-android-foreground.png')).metadata();
    const favicon = await sharp(join(root, 'assets/brand/generated/pip-favicon.png')).metadata();
    expect(ios).toMatchObject({ width: 1024, height: 1024, hasAlpha: false });
    expect(android).toMatchObject({ width: 432, height: 432, hasAlpha: true });
    expect(favicon).toMatchObject({ width: 64, height: 64, hasAlpha: true });
  });

  it('keeps the Android foreground inside the adaptive-icon safe zone', async () => {
    const { info, data } = await sharp(join(root, 'assets/brand/generated/pip-android-foreground.png'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Anything outside the centre 66% would be clipped by a circular mask.
    const margin = Math.floor(info.width * 0.17);
    let outside = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[((y * info.width) + x) * info.channels + 3];
        const beyond = x < margin || y < margin || x >= info.width - margin || y >= info.height - margin;
        if (beyond && alpha > 8) outside += 1;
      }
    }
    expect(outside).toBe(0);
  });
});
