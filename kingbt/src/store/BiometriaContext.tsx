import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { devePedirDeNovo } from '@/logic/biometria';

const CHAVE = '@kingbt:biometriaAtiva';

export type ResultadoAtivar = 'ok' | 'indisponivel' | 'falhou';

interface BiometriaCtx {
  /** O aparelho tem digital/rosto cadastrado (e não é web). */
  disponivel: boolean;
  /** O usuário ligou o bloqueio neste aparelho. */
  ativa: boolean;
  /** A preferência já foi lida do aparelho. */
  carregado: boolean;
  /** O conteúdo está coberto pela tela de bloqueio agora. */
  bloqueado: boolean;
  /** Pede a biometria; libera o app se der certo. */
  desbloquear: () => Promise<boolean>;
  /** Liga o bloqueio — só depois de uma biometria confirmada, para ninguém se trancar por engano. */
  ativar: () => Promise<ResultadoAtivar>;
  desativar: () => Promise<void>;
}

const Ctx = createContext<BiometriaCtx>({
  disponivel: false, ativa: false, carregado: true, bloqueado: false,
  desbloquear: async () => true, ativar: async () => 'indisponivel', desativar: async () => {},
});

async function pedirBiometria(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear o KING BT', cancelLabel: 'Cancelar' });
    return r.success;
  } catch {
    return false;
  }
}

/**
 * Bloqueio por biometria: ao abrir o app (e ao voltar de segundo plano depois de 5 min) cobre a tela até
 * o usuário confirmar digital/rosto do próprio celular. Não substitui o login; protege quem abre o app num
 * celular desbloqueado. Fica desligado por padrão e é uma preferência deste aparelho (não vai para a nuvem).
 * Na web não faz nada.
 */
export function BiometriaProvider({ children }: { children: React.ReactNode }) {
  const nativo = Platform.OS !== 'web';
  const [disponivel, setDisponivel] = useState(false);
  const [ativa, setAtiva] = useState(false);
  const [carregado, setCarregado] = useState(!nativo);
  const [bloqueado, setBloqueado] = useState(false);
  const saiuEm = useRef<number | null>(null);
  const ativaRef = useRef(false);
  ativaRef.current = ativa;

  useEffect(() => {
    if (!nativo) return;
    let vivo = true;
    (async () => {
      let ligada = false;
      try { ligada = (await AsyncStorage.getItem(CHAVE)) === '1'; } catch { /* sem leitura: segue sem bloqueio */ }
      let ok = false;
      try { ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { /* sem módulo */ }
      if (!vivo) return;
      setDisponivel(ok);
      // Se o usuário tirou a biometria do celular depois de ligar, não trava o app para sempre.
      const vale = ligada && ok;
      setAtiva(vale);
      setBloqueado(vale);
      setCarregado(true);
    })();
    return () => { vivo = false; };
  }, [nativo]);

  useEffect(() => {
    if (!nativo) return;
    const sub = AppState.addEventListener('change', estado => {
      // Só 'background': no iOS o próprio pedido do Face ID passa por 'inactive' e travaria em loop.
      if (estado === 'background') saiuEm.current = Date.now();
      else if (estado === 'active') {
        if (ativaRef.current && devePedirDeNovo(saiuEm.current, Date.now())) setBloqueado(true);
        saiuEm.current = null;
      }
    });
    return () => sub.remove();
  }, [nativo]);

  const desbloquear = useCallback(async () => {
    const ok = await pedirBiometria();
    if (ok) setBloqueado(false);
    return ok;
  }, []);

  const ativar = useCallback(async (): Promise<ResultadoAtivar> => {
    if (!disponivel) return 'indisponivel';
    if (!(await pedirBiometria())) return 'falhou';
    try { await AsyncStorage.setItem(CHAVE, '1'); } catch { return 'falhou'; }
    setAtiva(true);
    return 'ok';
  }, [disponivel]);

  const desativar = useCallback(async () => {
    try { await AsyncStorage.removeItem(CHAVE); } catch { /* ignora */ }
    setAtiva(false);
    setBloqueado(false);
  }, []);

  const value = useMemo(
    () => ({ disponivel, ativa, carregado, bloqueado, desbloquear, ativar, desativar }),
    [disponivel, ativa, carregado, bloqueado, desbloquear, ativar, desativar],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBiometria() {
  return useContext(Ctx);
}
