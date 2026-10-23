/* Design tokens. The same values as assets/css/styles.css on the website, so the app and
   the site read as one product ("clinical instrument", see PRODUCT.md). */
export const color = {
  ground: '#EEF2F5',
  ground2: '#E3E9EE',
  panel: '#FFFFFF',
  ink: '#0A1722',
  ink2: '#34444F',
  muted: '#52616D',
  line: '#CBD5DC',
  lineStrong: '#8696A3',
  signal: '#1546C9',
  signalDeep: '#0F359B',
  signalTint: '#DCE5FA',
  alert: '#8A3B00',
  alertTint: '#FBE8D0',
  // Dark surfaces: the home hero, the camera screens and the verdict.
  nightLine: '#24394A',
  onNight: '#B9C6D0',
  tones: ['#F4D6BF', '#E6B48F', '#CB9069', '#9B6341', '#77472D', '#472A1B'],
} as const;

export const font = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const radius = { sm: 8, md: 14, lg: 18, pill: 999 } as const;

/* Wider than this the app switches to its desktop-browser layout. */
export const WIDE = 900;
