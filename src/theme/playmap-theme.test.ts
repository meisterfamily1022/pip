import { playmapTheme as theme } from './playmap-theme';

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  if (!channels || channels.length !== 3) throw new Error(`Expected a six-digit hex color, received ${hex}`);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('PlayMap visual tokens', () => {
  it('keeps primary actions readable', () => {
    expect(contrast(theme.colors.white, theme.colors.coralAction)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['blush peach', theme.colors.surfacePeach],
    ['sage', theme.colors.surfaceSage],
    ['mint', theme.colors.surfaceMint],
    ['soft yellow', theme.colors.surfaceYellow],
    ['lavender', theme.colors.surfaceLavender],
  ])('keeps dark text readable on %s', (_name, surface) => {
    expect(contrast(theme.colors.primaryText, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('distinguishes enabled and disabled action surfaces', () => {
    expect(theme.colors.disabled).not.toBe(theme.colors.coralAction);
    expect(contrast(theme.colors.disabledText, theme.colors.disabled)).toBeGreaterThanOrEqual(4.5);
  });
});
