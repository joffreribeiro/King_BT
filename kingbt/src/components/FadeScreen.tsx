import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewProps } from 'react-native';

export function FadeScreen({ children, style, ...props }: ViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.fill, { opacity }, style]} {...props}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
