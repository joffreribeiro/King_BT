import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { FontFamily, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

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
  color,
}: AnimatedNumberProps) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const finalColor = color ?? Colors.gold;
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

  return <Text style={[s.num, { color: finalColor }, style]}>{display}</Text>;
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  num: { fontFamily: FontFamily.numberBold, fontSize: 15 },
});
