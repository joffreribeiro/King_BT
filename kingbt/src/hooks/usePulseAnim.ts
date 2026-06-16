import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

export function usePulseAnim(duration = 1800): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);
  return anim;
}
