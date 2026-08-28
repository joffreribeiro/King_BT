import { View, StyleSheet, Animated } from 'react-native';
import { Spacing, Radius, type ThemeColors } from '@/theme';
import { useEffect, useRef, useMemo } from 'react';
import { useTheme } from '@/store/ThemeContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type SkeletonVariant = 'line' | 'card' | 'comp';

/**
 * Um único loop de opacidade compartilhado por todos os blocos do skeleton —
 * antes cada bloco montava o seu (havia três implementações duplicadas do
 * mesmo efeito só na home). Com reduced motion ativo não há loop: opacidade
 * fixa em 0.5.
 */
function useSkeletonOpacity(): Animated.Value | number {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced]);

  return reduced ? 0.5 : opacity;
}

function SkeletonPulse({ style }: { style?: any }) {
  const { colors: Colors } = useTheme();
  const opacity = useSkeletonOpacity();
  return <Animated.View style={[{ backgroundColor: Colors.surf2, borderRadius: Radius.sm }, style, { opacity }]} />;
}

type SkeletonProps = {
  variant?: SkeletonVariant;
  /** Só para `line`/`card`. */
  width?: number | string;
  height?: number;
  radius?: number;
};

/**
 * Bloco de carregamento. `line` é o átomo (barra simples); `card` é o bloco de
 * avatar + 2 linhas + separador; `comp` é o retângulo alto com borda usado na
 * lista de competições.
 */
export function Skeleton({ variant = 'line', width = '100%', height, radius }: SkeletonProps) {
  const { colors: Colors } = useTheme();
  const opacity = useSkeletonOpacity();

  if (variant === 'comp') {
    return (
      <Animated.View style={{
        opacity, backgroundColor: Colors.surf, borderRadius: Radius.lg,
        marginBottom: Spacing.sm, height: height ?? 130,
        borderWidth: 1, borderColor: Colors.line,
      }} />
    );
  }

  if (variant === 'card') {
    return (
      <View style={{
        backgroundColor: Colors.surf, borderRadius: Radius.lg,
        padding: Spacing.md, gap: Spacing.sm,
      }}>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <SkeletonPulse style={{ width: 36, height: 36, borderRadius: Radius.sm }} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonPulse style={{ width: '60%', height: 14 }} />
            <SkeletonPulse style={{ width: '40%', height: 10 }} />
          </View>
        </View>
        <SkeletonPulse style={{ height: 1, borderRadius: 1 }} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <SkeletonPulse style={{ width: '30%', height: 10 }} />
          <SkeletonPulse style={{ width: '20%', height: 10 }} />
        </View>
      </View>
    );
  }

  return <SkeletonPulse style={{ width: width as any, height: height ?? 16, borderRadius: radius ?? 8 }} />;
}

export function SkeletonRow() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.row}>
      <SkeletonPulse style={s.circle} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonPulse style={{ height: 12, width: '60%' }} />
        <SkeletonPulse style={{ height: 9, width: '40%' }} />
      </View>
      <SkeletonPulse style={s.rect} />
      <SkeletonPulse style={s.rect} />
      <SkeletonPulse style={{ height: 14, width: 44, borderRadius: Radius.sm }} />
    </View>
  );
}

export function SkeletonRanking() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.container}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonCard({ height = 80 }: { height?: number }) {
  return <SkeletonPulse style={{ height, borderRadius: Radius.md, marginBottom: Spacing.sm }} />;
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  circle: { width: 32, height: 32, borderRadius: 16 },
  rect:   { height: 12, width: 30, borderRadius: Radius.sm },
});
