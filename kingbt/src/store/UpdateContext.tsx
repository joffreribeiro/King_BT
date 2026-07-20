import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface UpdateContextType {
  updateAvailable: boolean;
}

const UpdateContext = createContext<UpdateContextType>({
  updateAvailable: false,
});

// SHA do commit a partir do qual este build foi gerado — embutido no bundle
// no momento do build (ver EXPO_PUBLIC_GIT_SHA em .github/workflows/build-apk.yml
// e no comando "expo export" usado para publicar a versão web). Sem esse
// valor (ex.: `expo start` local), não há como saber a própria versão, então
// o banner nunca aparece — está correto, é o caso do ambiente de desenvolvimento.
const CURRENT_SHA = process.env.EXPO_PUBLIC_GIT_SHA ?? null;

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);

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

  return (
    <UpdateContext.Provider value={{ updateAvailable }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  return useContext(UpdateContext);
}
