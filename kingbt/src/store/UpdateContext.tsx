import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface UpdateContextType {
  updateAvailable: boolean;
  latestVersion: string | null;
  currentVersion: string;
}

const UpdateContext = createContext<UpdateContextType>({
  updateAvailable: false,
  latestVersion: null,
  currentVersion: '1.0.0',
});

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentVersion] = useState('1.0.0');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function checkForUpdates() {
      try {
        const res = await fetch('https://api.github.com/repos/joffreribeiro/King_BT/releases/tags/latest-apk', {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return;

        const release = await res.json();
        const tag = release.tag_name || 'latest-apk';
        // Tratamos o tag como versão; se não for semver, só marcamos como atualizado disponível
        if (tag !== currentVersion) {
          setLatestVersion(tag);
          setUpdateAvailable(true);
        }
      } catch (e) {
        // Silenciosamente falha se não conseguir checar
      }
    }

    // Checa na primeira vez que o usuário loga
    checkForUpdates();
  }, [user, currentVersion]);

  return (
    <UpdateContext.Provider value={{ updateAvailable, latestVersion, currentVersion }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  return useContext(UpdateContext);
}
