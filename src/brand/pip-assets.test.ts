import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import appConfig from '../../app.json';

const root = join(__dirname, '../..');

describe('Pip generated brand assets', () => {
  it('keeps the approved source byte-for-byte unchanged', () => {
    const checksum = createHash('sha256').update(readFileSync(join(root, 'assets/brand/source/pip-logo-approved.svg'), 'utf8')).digest('hex');
    expect(checksum).toBe('c378455a3099aae121db140fb0c4d74900822cc69802dd050cf25dd27e8c7463');
  });

  it.each([
    'assets/brand/source/pip-logo-approved.svg',
    'assets/brand/generated/pip-lockup.png',
    'assets/brand/generated/pip-wordmark.png',
    'assets/brand/generated/pip-symbol.png',
    'assets/brand/generated/pip-app-icon.png',
    'assets/brand/generated/pip-android-foreground.png',
    'assets/brand/generated/pip-splash.png',
    'assets/brand/generated/pip-favicon.png',
    'assets/brand/generated/pip-preview.png',
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

  it('keeps native icon canvases and transparency platform-appropriate', async () => {
    const ios = await sharp(join(root, 'assets/brand/generated/pip-app-icon.png')).metadata();
    const android = await sharp(join(root, 'assets/brand/generated/pip-android-foreground.png')).metadata();
    const favicon = await sharp(join(root, 'assets/brand/generated/pip-favicon.png')).metadata();
    expect(ios).toMatchObject({ width: 1024, height: 1024, hasAlpha: false });
    expect(android).toMatchObject({ width: 432, height: 432, hasAlpha: true });
    expect(favicon).toMatchObject({ width: 64, height: 64, hasAlpha: true });
  });
});
