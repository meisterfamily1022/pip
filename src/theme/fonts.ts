/**
 * Pip's two typefaces.
 *
 * Montserrat carries the entire interface in exactly two weights. Quicksand is
 * reserved for the logo wordmark and is never used for interface copy.
 *
 * Weight is expressed by picking a family, not by `fontWeight`. React Native on
 * Android will otherwise synthesise a second bold on top of Montserrat Bold,
 * which thickens headings unevenly across platforms.
 */
export const pipFontFamily = {
  regular: 'Montserrat-Regular',
  bold: 'Montserrat-Bold',
  logo: 'Quicksand-Medium',
} as const;

/**
 * The map handed to `useFonts`. Keys must match {@link pipFontFamily} exactly:
 * a mismatch renders the system face silently rather than failing loudly.
 */
export const pipFontAssets = {
  [pipFontFamily.regular]: require('../../assets/fonts/Montserrat-Regular.ttf'),
  [pipFontFamily.bold]: require('../../assets/fonts/Montserrat-Bold.ttf'),
  [pipFontFamily.logo]: require('../../assets/fonts/Quicksand-Medium.ttf'),
} as const;
