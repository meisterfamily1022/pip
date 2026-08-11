import { pipFontFamily } from './fonts';
import { pipAvatarPalette, pipLogoColors, playmapTheme as theme } from './playmap-theme';

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

describe('Pip visual tokens', () => {
  it('uses the approved redesign palette exactly', () => {
    expect(theme.colors.brandPrimary).toBe('#8FD3EE');
    expect(theme.colors.brandInk).toBe('#23708B');
    expect(theme.colors.primaryText).toBe('#263B43');
    expect(theme.colors.cardSurface).toBe('#F7FBFE');
    expect(theme.colors.border).toBe('#DCEAF3');
    expect(theme.colors.accentSunshine).toBe('#FFDE96');
    expect(theme.colors.accentSage).toBe('#A9C4A2');
    expect(theme.colors.accentLavender).toBe('#C2ACEC');
  });

  it('uses the approved logo colours for the mark and nothing else', () => {
    expect(pipLogoColors).toEqual({
      wordmark: '#8FD3EE',
      dot: '#FFDE96',
      rayPink: '#F0A9BC',
      raySage: '#B6D9B3',
      rayLavender: '#A98BD4',
      monochrome: '#263B43',
    });
  });

  it('carries no red: caution and destruction read as lavender', () => {
    expect(theme.colors.error).toBe('#6B54A3');
    expect(theme.colors.danger).toBe(theme.colors.error);
    expect(theme.colors.warning).toBe(theme.colors.error);
  });

  it.each([
    ['body text on canvas', theme.colors.primaryText, theme.colors.background],
    ['supporting text on canvas', theme.colors.secondaryText, theme.colors.background],
    ['supporting text on a card', theme.colors.secondaryText, theme.colors.cardSurface],
    ['muted text on a card', theme.colors.mutedText, theme.colors.cardSurface],
    ['muted text on a muted card', theme.colors.mutedText, theme.colors.mutedSurface],
    ['blue ink on canvas', theme.colors.brandInk, theme.colors.background],
    ['blue ink on a card', theme.colors.brandInk, theme.colors.cardSurface],
    ['blue ink on a selected card', theme.colors.brandInk, theme.colors.selectedSurface],
    ['primary button label', theme.colors.brandPrimaryLabel, theme.colors.brandPrimary],
    ['pressed primary button label', theme.colors.brandPrimaryLabel, theme.colors.brandPrimaryPressed],
    ['destructive fill label', theme.colors.destructiveFillLabel, theme.colors.destructiveFill],
    ['alert text on its own surface', theme.colors.error, theme.colors.errorSoft],
    ['toast text on its own surface', theme.colors.brandPrimaryLabel, theme.colors.successSoft],
    ['body text on the sunshine accent', theme.colors.primaryText, theme.colors.accentSunshine],
    ['body text on a soft blue surface', theme.colors.primaryText, theme.colors.brandPrimarySoft],
  ])('holds WCAG AA for %s', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the disabled label readable and distinct from a faded primary', () => {
    expect(theme.colors.disabled).not.toBe(theme.colors.brandPrimary);
    expect(contrast(theme.colors.disabledText, theme.colors.disabled)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every avatar character legible on its own ground', () => {
    for (const { surface, ink } of pipAvatarPalette) {
      expect(contrast(ink, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('never puts white on a pastel fill', () => {
    for (const pastel of [theme.colors.brandPrimary, theme.colors.accentSunshine, theme.colors.accentSage, theme.colors.accentLavender, theme.colors.destructiveFill]) {
      expect(contrast(theme.colors.white, pastel)).toBeLessThan(4.5);
    }
  });

  it('sets type in Montserrat, with Quicksand reserved for the logo', () => {
    const families = new Set(Object.values(theme.typography).map((style) => style.fontFamily));
    expect([...families].sort()).toEqual([pipFontFamily.bold, pipFontFamily.regular]);
    expect(pipFontFamily.logo).toBe('Quicksand-Medium');
  });

  it('carries the weight in the family so Android cannot double-bold', () => {
    for (const style of Object.values(theme.typography)) {
      expect(style).not.toHaveProperty('fontWeight');
    }
  });

  it('keeps to four radii plus the pill', () => {
    expect(theme.radii.control).toBe(12);
    expect(theme.radii.card).toBe(16);
    expect(theme.radii.sheet).toBe(24);
    expect(theme.radii.photo).toBe(14);
    expect(theme.radii.pill).toBe(999);
  });

  it('meets the minimum touch target on every interactive measurement', () => {
    const { minimumTouchTarget, inputHeight, primaryButtonHeight, childButtonHeight, searchHeight, pinBoxHeight, segmentHeight } = theme.measurements;
    expect(minimumTouchTarget).toBe(44);
    for (const height of [inputHeight, primaryButtonHeight, childButtonHeight, searchHeight, pinBoxHeight, segmentHeight]) {
      expect(height).toBeGreaterThanOrEqual(minimumTouchTarget);
    }
  });
});
