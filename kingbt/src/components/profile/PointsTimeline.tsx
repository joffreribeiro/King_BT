import { View, Text, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import { FontFamily, Spacing } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import Svg, { Polyline, Line, Circle, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// ─── Gráfico de Evolução de Pontos ────────────────────────────────────────────
export function PointsTimeline({ data }: { data: { label: string; pts: number; pos: number }[] }) {
  const { colors: Colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [W, setW] = useState(0);

  if (data.length < 2) return null;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const H = 140;
  const PAD = { top: 16, bottom: 32, left: 28, right: 12 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxPts = Math.max(...data.map(d => d.pts), 1);
  const minPts = Math.min(...data.map(d => d.pts), 0);
  const range  = maxPts - minPts || 1;

  const pts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD.top + chartH - ((d.pts - minPts) / range) * chartH,
    ...d,
  }));

  const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${pts[0].x},${PAD.top + chartH} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${PAD.top + chartH} Z`;

  const trend = data[data.length - 1].pts - data[0].pts;
  const trendColor = trend > 0 ? Colors.teal : trend < 0 ? Colors.coral : Colors.muted;

  return (
    <Card style={{ gap: 6, paddingHorizontal: 0, paddingTop: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md }}>
        <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1.5 }}>
          EVOLUÇÃO DE PONTOS
        </Text>
        <View style={{ backgroundColor: trendColor + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: trendColor }}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'} {Math.abs(trend).toFixed(2)}
          </Text>
        </View>
      </View>

      <View onLayout={onLayout} style={{ height: H }}>
      {W > 0 && (
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="profAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.gold} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={Colors.gold} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.top + chartH * (1 - t);
          const val = (minPts + range * t).toFixed(0);
          return (
            <Line key={i} x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke={Colors.line} strokeWidth="1" />
          );
        })}
        {[0, 0.5, 1].map((t, i) => (
          <SvgText key={i} x={PAD.left - 4} y={PAD.top + chartH * (1 - t) + 4}
            fontSize="8" fill={Colors.faint} textAnchor="end">
            {(minPts + range * t).toFixed(0)}
          </SvgText>
        ))}

        {/* Área + linha */}
        <Path d={areaPath} fill="url(#profAreaGrad)" />
        <Polyline points={linePoints} fill="none"
          stroke={Colors.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={selected === i ? 6 : 4}
            fill={selected === i ? Colors.gold : Colors.bg}
            stroke={Colors.gold} strokeWidth="2"
            onPress={() => setSelected(selected === i ? null : i)} />
        ))}

        {/* Labels X */}
        {pts.map((p, i) => (
          <SvgText key={i} x={p.x} y={H - 4} fontSize="8"
            fill={selected === i ? Colors.gold : Colors.faint} textAnchor="middle">
            {p.label}
          </SvgText>
        ))}

        {/* Tooltip — vira pra baixo quando o ponto está muito no topo */}
        {selected !== null && (() => {
          const p = pts[selected];
          const boxW = 88, boxH = 34;
          const bx = Math.min(Math.max(p.x - boxW / 2, 2), W - boxW - 2);
          const flipDown = p.y - boxH - 10 < PAD.top;
          const by = flipDown ? p.y + 10 : p.y - boxH - 10;
          return (
            <>
              <Line x1={p.x} y1={p.y} x2={p.x}
                y2={flipDown ? by : by + boxH}
                stroke={Colors.gold} strokeWidth="1" strokeDasharray="3,3" />
              <Path
                d={`M${bx},${by} h${boxW} a4,4 0 0 1 4,4 v${boxH - 8} a4,4 0 0 1 -4,4 h${-boxW} a4,4 0 0 1 -4,-4 v${-(boxH - 8)} a4,4 0 0 1 4,-4 z`}
                fill={Colors.surf2} stroke={Colors.gold} strokeWidth="0.5" />
              <SvgText x={bx + boxW / 2} y={by + 15} fontSize="10" fill={Colors.gold}
                textAnchor="middle" fontWeight="700">{p.pts.toFixed(2)} pts</SvgText>
              <SvgText x={bx + boxW / 2} y={by + 27} fontSize="8" fill={Colors.muted}
                textAnchor="middle">{p.pos}° lugar</SvgText>
            </>
          );
        })()}
      </Svg>
      )}
      </View>
    </Card>
  );
}
