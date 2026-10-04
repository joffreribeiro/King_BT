import { Platform, useWindowDimensions } from 'react-native';
import { WIDE_BREAKPOINT } from '@/theme';

/**
 * Computador (web com janela larga): é quando o app mostra o menu lateral e as telas se abrem em
 * colunas. Reage ao redimensionar a janela. No celular (nativo ou web estreita) é sempre false.
 */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
