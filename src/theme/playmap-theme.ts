export const playmapTheme = {
  colors: {
    background: '#FFF9F0', childBackground: '#F2F8F2', surface: '#FFFEFB', elevatedSurface: '#FFFFFF',
    surfaceWarm: '#FFF1E7', surfaceCool: '#EAF3EC', text: '#3F4A43', mutedText: '#69756E',
    peach: '#F7C6AF', peachSoft: '#FCE7DC', sage: '#9AB79E', sageSoft: '#E4EFE5',
    mint: '#A9D3C3', mintSoft: '#E1F2EC', yellow: '#F4D58B', yellowSoft: '#FFF2CC',
    lavender: '#CFC3DC', lavenderSoft: '#EEE8F3', coral: '#EC8F78', coralDark: '#A94F3F',
    primary: '#5E8F7E', primarySoft: '#E1F2EC', border: '#E6DCCF', danger: '#A74742',
    errorSoft: '#FBE9E7', success: '#4F7D5D', successSoft: '#E2EFE4', photoFallback: '#F2E9DC', white: '#FFFFFF',
  },
  radii: { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 },
  type: { display: 38, title: 32, childTitle: 36, section: 22, body: 17, small: 14, button: 17 },
  sizes: { button: 56, childButton: 72, input: 54 },
  shadows: {
    card: { boxShadow: '0 4px 16px rgba(89, 72, 54, 0.08)' } as const,
    elevated: { boxShadow: '0 8px 24px rgba(89, 72, 54, 0.11)' } as const,
  },
  images: { toyCard: 1.12, hero: 1.25, upload: 1.65 },
};

export const screenContentStyle = {
  width: '100%' as const, maxWidth: 920, alignSelf: 'center' as const,
  paddingHorizontal: 20, paddingTop: 24, paddingBottom: 56,
};
