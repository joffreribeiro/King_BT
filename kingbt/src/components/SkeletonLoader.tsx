import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, Radius } from '@/theme';
import { useEffect, useRef } from 'react';

function SkeletonPulse({ style }: { style?: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ backgroundColor: Colors.surf2, borderRadius: Radius.sm }, style, { opacity }]} />;
}

export function SkeletonRow() {
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

const s = StyleSheet.create({
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
