import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True quando o usuário pediu menos movimento no sistema (iOS "Reduzir
 * Movimento", Android "Remover animações", `prefers-reduced-motion` na web).
 * Quem consome deve pular loops/animações e renderizar direto o estado final.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (alive) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  return reduced;
}
