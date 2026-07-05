import { Animated, Text, StyleSheet } from 'react-native';
import { useEffect, useRef, useMemo } from 'react';
import { FontFamily, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

interface TrendBadgeProps {
  direction: 'up' | 'down';
  diff: number;
}

export function TrendBadge({ direction, diff }: TrendBadgeProps) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const color   = direction === 'up' ? Colors.teal : Colors.coral;
  const bgColor = direction === 'up' ? Colors.teal + '22' : Colors.coral + '22';
  const icon    = direction === 'up' ? '▲' : '▼';

  return (
    <Animated.View style={[s.badge, { backgroundColor: bgColor, transform: [{ scale }] }]}>
      <Text style={[s.text, { color }]}>
        {icon}{diff > 0 ? diff : ''}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  badge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  text:  { fontFamily: FontFamily.numberBold, fontSize: 9 },
});
