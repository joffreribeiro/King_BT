import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * "Instalar como app" na web (PWA). O Chrome/Edge (computador e Android) avisa que o site é instalável com o
 * evento `beforeinstallprompt`, que só dispara UMA vez e cedo: por isso o ouvinte é registrado quando este módulo é
 * carregado (ao abrir o app), e o botão só guarda o evento para usar depois. No iPhone não existe esse evento: lá
 * só dá para mostrar o passo a passo (Compartilhar > Adicionar à Tela de Início).
 */
type DeferredPrompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
let deferred: DeferredPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (isWeb) {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as unknown as DeferredPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

/** Já está rodando como app instalado (janela própria / tela de início)? */
export function isStandalone(): boolean {
  if (!isWeb) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

const isIos = (): boolean => isWeb && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const IOS_INSTALL_STEPS = 'No iPhone/iPad: toque em Compartilhar (o quadrado com a seta) e escolha "Adicionar à Tela de Início".';

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const standalone = isStandalone();
  return {
    /** Dá para instalar com um toque (Chrome/Edge). */
    canInstall: isWeb && !standalone && !!deferred,
    /** iPhone/iPad no navegador: instalar é manual; mostra o passo a passo. */
    needsIosSteps: isWeb && !standalone && isIos(),
    /** Abre a janela de instalação do navegador. */
    install: async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
      if (!deferred) return 'unavailable';
      const d = deferred;
      deferred = null;
      notify();
      await d.prompt();
      return (await d.userChoice).outcome;
    },
  };
}
