import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

/**
 * Valor 0↔1 em loop, para pulsos sutis (sombra, badge, ponto "ao vivo").
 * Com reduced motion ativo o valor fica parado em 0 — quem consome deve
 * interpolar de forma que 0 seja um estado final aceitável.
 */
export function usePulseAnim(duration = 1800): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => { loop.stop(); anim.stopAnimation(); };
  }, [reduced, duration]);

  return anim;
}
