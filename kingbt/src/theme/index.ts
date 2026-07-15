export const darkColors = {
  bg:         '#0B0B0D',
  bg2:        '#000000',
  surf:       '#16140F',
  surf2:      '#221C12',
  line:       'rgba(214,175,70,0.16)',
  gold:       '#F3C544',
  goldDeep:   '#C2891A',
  goldBright: '#FFDD66',
  teal:       '#54B981',
  coral:      '#E5483D',
  text:       '#F6EFDD',
  muted:      '#A99B7C',
  faint:      '#6E6452',
} as const;

export type ThemeColors = { [K in keyof typeof darkColors]: string };

// Paleta clara — tokens estruturais (bg/surf/text/muted/faint/line) adaptados para
// contraste em fundo claro; gold/teal/coral escurecidos um pouco (mesma família de cor)
// porque na paleta escura eles servem de texto/destaque direto sobre fundo quase preto.
export const lightColors: ThemeColors = {
  bg:         '#FAF7F0',
  bg2:        '#FFFFFF',
  surf:       '#FFFFFF',
  surf2:      '#F2E9D8',
  line:       'rgba(194,137,26,0.28)',
  gold:       '#B8790E',
  goldDeep:   '#8A5A0A',
  goldBright: '#F3C544',
  teal:       '#2E8F5C',
  coral:      '#C23328',
  text:       '#241F16',
  muted:      '#6B5D45',
  faint:      '#8D816A',
} as const;

// Alias de compatibilidade: cor estática (não reativa) para os poucos usos fora de
// StyleSheet/useTheme(). Componentes de tela devem usar useTheme().colors.
export const Colors = darkColors;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 22,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FontFamily = {
  title:      'Sora_700Bold',
  titleBold:  'Sora_800ExtraBold',
  body:       'Sora_400Regular',
  bodyMed:    'Sora_500Medium',
  number:     'SpaceGrotesk_500Medium',
  numberBold: 'SpaceGrotesk_700Bold',
} as const;

// Escala de tipografia — consolida os tamanhos/pesos que já eram repetidos
// soltos em cada tela (rótulo de seção, título de card, número de destaque etc.).
// Uso: `<Text style={Type.label}>` ou espalhado num StyleSheet: `{ ...Type.body, color: Colors.text }`.
export const Type = {
  display:  { fontFamily: FontFamily.titleBold, fontSize: 40, lineHeight: 46 },
  numberLg: { fontFamily: FontFamily.titleBold, fontSize: 28, lineHeight: 32 },
  h1:       { fontFamily: FontFamily.titleBold, fontSize: 20, lineHeight: 26 },
  h2:       { fontFamily: FontFamily.title,     fontSize: 17, lineHeight: 22 },
  title:    { fontFamily: FontFamily.title,     fontSize: 15, lineHeight: 20 },
  number:   { fontFamily: FontFamily.numberBold, fontSize: 18, lineHeight: 22 },
  body:     { fontFamily: FontFamily.body,      fontSize: 13, lineHeight: 18 },
  bodyMed:  { fontFamily: FontFamily.bodyMed,   fontSize: 13, lineHeight: 18 },
  caption:  { fontFamily: FontFamily.body,      fontSize: 11, lineHeight: 15 },
  // Rótulo maiúsculo de seção — o padrão "SECTION LABEL" repetido em quase toda tela.
  label:    { fontFamily: FontFamily.numberBold, fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
} as const;
