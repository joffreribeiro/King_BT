import { FontFamily } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { SKILLS, radarPoint, radarPolygon } from '@/logic/skills';

const SIZE = 340;           // área do desenho
const C = SIZE / 2;         // centro
const R = 112;              // raio do gráfico (sobra margem para os nomes)

/** Gráfico radar: só o contorno das notas (1 a 10) e o nome de cada habilidade, sem a teia de fundo. */
export function RadarChart({ values }: { values: number[] }) {
  const { colors: Colors } = useTheme();
  const n = values.length;
  const poly = radarPolygon(values, C, C, R);
  const points = poly.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width="100%" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* notas */}
      <Polygon points={points} fill="none" stroke={Colors.gold} strokeWidth={2.5} strokeLinejoin="round" />
      {/* nomes */}
      {SKILLS.map((sk, i) => {
        const p = radarPoint(i, n, 1.2, C, C, R);
        const anchor = Math.abs(p.x - C) < 8 ? 'middle' : p.x > C ? 'start' : 'end';
        return (
          <SvgText key={sk.key} x={p.x} y={p.y + 4} fontSize={12} fill={Colors.muted} textAnchor={anchor} fontFamily={FontFamily.body}>
            {sk.short}
          </SvgText>
        );
      })}
    </Svg>
  );
}
