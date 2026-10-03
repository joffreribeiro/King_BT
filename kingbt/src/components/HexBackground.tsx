import { StyleSheet } from 'react-native';
import { useId } from 'react';
import Svg, { Defs, Pattern, Path, Rect, RadialGradient, Stop, G } from 'react-native-svg';
import { useTheme } from '@/store/ThemeContext';

interface Props {
  /** Cor do traço e do brilho. Padrão: a cor de destaque do tema (`colors.gold`). */
  accent?: string;
}

// Traço um pouco mais visível que o da prévia (0.085), a pedido: no tema claro
// ele é mais opaco, senão some sobre o fundo claro.
const STROKE_OPACITY = { dark: 0.17, light: 0.26 } as const;

// Favo de verdade: hexágonos de lado 32.33 (largura 56), sem as linhas internas
// em "Y" que faziam o desenho antigo parecer cubos 3D. O tile tem 2 fileiras
// (56 x 97): um hexágono inteiro + o traço vertical que liga à fileira de baixo.
const HEX_PATH = 'M28 0L56 16.17L56 48.5L28 64.67L0 48.5L0 16.17L28 0M28 64.67L28 97';
const GLOW_ALPHA = { dark: 0.14, light: 0.16 } as const;

/**
 * Fundo "favo de mel" (a vespa da marca): hexágonos finos repetidos e um brilho
 * suave no topo. É um SVG estático, sem animação, que ocupa a tela toda por
 * trás do conteúdo e não recebe toques. As telas por cima precisam ter fundo
 * transparente para ele aparecer.
 */
export function HexBackground({ accent }: Props) {
  const { colors, mode } = useTheme();
  const color = accent ?? colors.gold;
  // Cada favo precisa de nomes próprios para o desenho e o brilho: com vários na tela
  // (o das abas + o das telas por cima), nomes iguais fazem o navegador usar o de uma
  // tela escondida, que não é desenhado — e o favo some das outras.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hexId = `kbtHex${uid}`;
  const glowId = `kbtGlow${uid}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id={hexId} width={56} height={97} patternUnits="userSpaceOnUse">
          <G fill="none" stroke={color} strokeOpacity={STROKE_OPACITY[mode]} strokeWidth={1.5} strokeLinejoin="round">
            <Path d={HEX_PATH} />
          </G>
        </Pattern>
        {/* Elipse: 130% da largura x 55% da altura, some aos 62% (como na prévia). */}
        <RadialGradient id={glowId} cx="0.5" cy="0" fx="0.5" fy="0" rx={1.3 * 0.62} ry={0.55 * 0.62}>
          <Stop offset="0" stopColor={color} stopOpacity={GLOW_ALPHA[mode]} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${hexId})`} />
      <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
    </Svg>
  );
}
