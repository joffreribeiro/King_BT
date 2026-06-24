import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';

function SkeletonBar({ width, height = 9, style }: {
  width: number | string; height?: number; style?: object;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 300],
  });

  return (
    <View style={[{ width, height, backgroundColor: '#221C12', borderRadius: 5, overflow: 'hidden' }, style]}>
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { width: '45%', backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ translateX }, { skewX: '-12deg' }] },
      ]} />
    </View>
  );
}

export function SkeletonCard({ hasProgress = false, style }: { hasProgress?: boolean; style?: object }) {
  return (
    <View style={[sk.card, style]}>
      <View style={sk.cardHeader}>
        <SkeletonBar width={110} />
        <SkeletonBar width={40} height={16} style={{ borderRadius: 8 }} />
      </View>
      <View style={sk.cardBody}>
        <SkeletonBar width={160} height={13} style={{ marginBottom: 4 }} />
        <SkeletonBar width={100} height={7} style={{ marginBottom: hasProgress ? 8 : 0 }} />
        {hasProgress && <SkeletonBar width="100%" height={5} style={{ borderRadius: 3 }} />}
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} hasProgress={i === 0} style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: '#16140F',
    borderWidth: 1,
    borderColor: 'rgba(214,175,70,0.10)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardHeader: {
    height: 32,
    backgroundColor: '#1a1610',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  cardBody: {
    padding: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
});
