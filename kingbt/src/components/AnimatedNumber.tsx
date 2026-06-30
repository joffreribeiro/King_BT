import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { FontFamily, Colors } from '@/theme';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  style?: any;
  color?: string;
}

export function AnimatedNumber({
  value,
  decimals = 2,
  duration = 900,
  style,
  color = Colors.gold,
}: AnimatedNumberProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0' + (decimals > 0 ? '.' + '0'.repeat(decimals) : ''));

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => {
      setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString());
    });
    Animated.timing(anim, { toValue: value, duration, useNativeDriver: false }).start(() => {
      anim.removeListener(id);
      setDisplay(decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString());
    });
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={[s.num, { color }, style]}>{display}</Text>;
}

const s = StyleSheet.create({
  num: { fontFamily: FontFamily.numberBold, fontSize: 15 },
});
