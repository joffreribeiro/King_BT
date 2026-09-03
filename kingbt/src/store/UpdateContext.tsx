import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from './AuthContext';

interface UpdateContextType {
  /** Há uma versão mais nova publicada — apenas avisa, dá pra dispensar. */
  updateAvailable: boolean;
  /**
   * O build atual está abaixo da versão mínima obrigatória definida pelo
   * Super Admin — bloqueia o uso do app até atualizar (ver
   * src/components/MandatoryUpdateScreen.tsx e app/_layout.tsx).
   */
  updateRequired: boolean;
}

const UpdateContext = createContext<UpdateContextType>({
  updateAvailable: false,
  updateRequired: false,
});

/** Link de download do APK mais recente, publicado pelo workflow de build. */
export const APK_URL = 'https://github.com/joffreribeiro/King_BT/releases/download/latest-apk/kingbt.apk';

// SHA do commit a partir do qual este build foi gerado — embutido no bundle
// no momento do build (ver EXPO_PUBLIC_GIT_SHA em .github/workflows/build-apk.yml
// e .github/workflows/deploy-web.yml). Sem esse valor (ex.: `expo start`
// local), não há como saber a própria versão, então o banner nunca aparece —
// está correto, é o caso do ambiente de desenvolvimento.
const CURRENT_SHA = process.env.EXPO_PUBLIC_GIT_SHA ?? null;

// Timestamp (epoch ms) de quando este build foi gerado — embutido pelos
// mesmos workflows (EXPO_PUBLIC_BUILD_TIME). Usado para comparar contra a
// versão mínima obrigatória em /config/appVersion. Também null fora de CI,
// e nesse caso o bloqueio nunca é aplicado (mesma lógica do CURRENT_SHA).
export const CURRENT_BUILD_TIME = process.env.EXPO_PUBLIC_BUILD_TIME
  ? Number(process.env.EXPO_PUBLIC_BUILD_TIME)
  : null;

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [minRequiredBuildTime, setMinRequiredBuildTime] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !CURRENT_SHA) return;

    async function checkForUpdates() {
      try {
        const res = await fetch('https://api.github.com/repos/joffreribeiro/King_BT/commits/main', {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return;
        const commit = await res.json();
        const latestSha: string | undefined = commit.sha;
        if (latestSha && latestSha !== CURRENT_SHA) setUpdateAvailable(true);
      } catch (e) {
        // Silenciosamente falha se não conseguir checar
      }
    }

    // Checa na primeira vez que o usuário loga
    checkForUpdates();
  }, [user]);

  // Assinatura ao vivo da versão mínima obrigatória — se o Super Admin marcar
  // uma versão como obrigatória com o app já aberto, o bloqueio aplica na hora,
  // sem precisar de novo login. Só assina com usuário logado: a leitura de
  // /config/{doc} exige auth nas regras do Firestore.
  useEffect(() => {
    if (!user) { setMinRequiredBuildTime(null); return; }
    const unsub = onSnapshot(
      doc(db, 'config', 'appVersion'),
      snap => {
        const v = snap.data()?.minBuildTime;
        setMinRequiredBuildTime(typeof v === 'number' && Number.isFinite(v) ? v : null);
      },
      () => setMinRequiredBuildTime(null),
    );
    return unsub;
  }, [user]);

  const updateRequired =
    CURRENT_BUILD_TIME != null &&
    minRequiredBuildTime != null &&
    CURRENT_BUILD_TIME < minRequiredBuildTime;

  return (
    <UpdateContext.Provider value={{ updateAvailable, updateRequired }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  return useContext(UpdateContext);
}
