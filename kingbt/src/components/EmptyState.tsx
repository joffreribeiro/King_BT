import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path, Line, Ellipse } from 'react-native-svg';
import { FontFamily } from '@/theme';

function RacketSvg() {
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90" fill="none">
      {/* Círculo decorativo de fundo */}
      <Circle cx="45" cy="45" r="42" stroke="rgba(243,197,68,0.08)" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* Cabeça da raquete */}
      <Ellipse cx="45" cy="36" rx="18" ry="22" stroke="rgba(243,197,68,0.35)" strokeWidth="1.8" />
      {/* Strings horizontais */}
      <Line x1="27" y1="28" x2="63" y2="28" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      <Line x1="27" y1="34" x2="63" y2="34" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      <Line x1="27" y1="40" x2="63" y2="40" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      <Line x1="27" y1="46" x2="63" y2="46" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      {/* Strings verticais */}
      <Line x1="38" y1="14" x2="38" y2="58" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      <Line x1="45" y1="14" x2="45" y2="58" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      <Line x1="52" y1="14" x2="52" y2="58" stroke="rgba(243,197,68,0.2)" strokeWidth="1" />
      {/* Cabo */}
      <Rect x="42" y="56" width="6" height="22" rx="3" fill="rgba(243,197,68,0.25)" />
      {/* Bolinha */}
      <Circle cx="66" cy="20" r="6" fill="rgba(84,185,129,0.5)" />
      <Circle cx="66" cy="20" r="4" fill="rgba(84,185,129,0.8)" />
    </Svg>
  );
}

function TrophySvg() {
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90" fill="none">
      <Circle cx="45" cy="45" r="42" stroke="rgba(243,197,68,0.08)" strokeWidth="1.5" strokeDasharray="4 4" />
      <Path d="M30 20h30v20a15 15 0 01-30 0V20z" stroke="rgba(243,197,68,0.4)" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Path d="M30 28H22v8a8 8 0 008 8" stroke="rgba(243,197,68,0.3)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M60 28h8v8a8 8 0 01-8 8" stroke="rgba(243,197,68,0.3)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M45 56v8M36 68h18" stroke="rgba(243,197,68,0.4)" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function CalendarSvg() {
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90" fill="none">
      <Circle cx="45" cy="45" r="42" stroke="rgba(107,127,215,0.1)" strokeWidth="1.5" strokeDasharray="4 4" />
      <Rect x="20" y="26" width="50" height="42" rx="6" stroke="rgba(107,127,215,0.4)" strokeWidth="2" fill="none" />
      <Line x1="20" y1="38" x2="70" y2="38" stroke="rgba(107,127,215,0.3)" strokeWidth="1.5" />
      <Line x1="33" y1="20" x2="33" y2="32" stroke="rgba(107,127,215,0.4)" strokeWidth="2" strokeLinecap="round" />
      <Line x1="57" y1="20" x2="57" y2="32" stroke="rgba(107,127,215,0.4)" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="33" cy="50" r="3" fill="rgba(107,127,215,0.4)" />
      <Circle cx="45" cy="50" r="3" fill="rgba(107,127,215,0.4)" />
      <Circle cx="57" cy="50" r="3" fill="rgba(107,127,215,0.4)" />
      <Circle cx="33" cy="60" r="3" fill="rgba(107,127,215,0.3)" />
      <Circle cx="45" cy="60" r="3" fill="rgba(107,127,215,0.3)" />
    </Svg>
  );
}

const ICONS = { racket: RacketSvg, trophy: TrophySvg, calendar: CalendarSvg };

interface EmptyStateProps {
  icon?: 'racket' | 'trophy' | 'calendar';
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon = 'racket', title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  const IconComp = ICONS[icon];
  return (
    <View style={es.container}>
      <IconComp />
      <Text style={es.title}>{title}</Text>
      <Text style={es.subtitle}>{subtitle}</Text>
      {ctaLabel && onCta && (
        <TouchableOpacity style={es.cta} onPress={onCta} activeOpacity={0.85}>
          <Text style={es.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    fontWeight: '700',
    color: '#F6EFDD',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#6E6452',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 220,
  },
  cta: {
    backgroundColor: '#F3C544',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 4,
  },
  ctaText: {
    fontFamily: FontFamily.title,
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
