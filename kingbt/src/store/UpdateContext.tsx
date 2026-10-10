import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { entryHashFrom, isNewerBuild, shaFromVersionJson } from '@/logic/webVersion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from './AuthContext';

/** Link de download do APK mais recente, publicado pelo workflow de build. */
export const APK_URL = 'https://github.com/joffreribeiro/King_BT/releases/download/latest-apk/kingbt.apk';

/** nova = há versão mais nova; atual = já está na mais recente; offline = não deu para consultar; indisponivel = build de desenvolvimento. */
export type UpdateCheckResult = 'nova' | 'atual' | 'offline' | 'indisponivel';

interface UpdateContextType {
  /** Há uma versão mais nova publicada — apenas avisa, dá pra dispensar. */
  updateAvailable: boolean;
  /** Versão publicada (ex.: "1.0.0-58"), quando o aviso vem do APK; null se desconhecida. */
  latestVersion: string | null;
  /** Link de download do APK mais recente (arquivo KINGBT_<versão>.apk quando a versão é conhecida). */
  apkUrl: string;
  /** Checa agora (botão em Configurações) e diz o que achou; atualiza o aviso se houver versão nova. */
  checkNow: () => Promise<UpdateCheckResult>;
  /**
   * O build atual está abaixo da versão mínima obrigatória definida pelo
   * Super Admin — bloqueia o uso do app até atualizar (ver
   * src/components/MandatoryUpdateScreen.tsx e app/_layout.tsx).
   */
  updateRequired: boolean;
}

const UpdateContext = createContext<UpdateContextType>({
  updateAvailable: false,
  latestVersion: null,
  apkUrl: APK_URL,
  checkNow: async () => 'indisponivel',
  updateRequired: false,
});

/**
 * Versão do APK mais recente: o workflow do APK publica este arquivo na release `latest-apk` JUNTO com o
 * kingbt.apk (ver .github/workflows/build-apk.yml). Assim o aviso só aparece quando já existe APK novo para
 * baixar. (Antes comparava com o site, que publica em ~4 min, enquanto o APK leva ~16: o aviso aparecia
 * cedo e o link entregava o APK antigo.)
 */
const VERSION_URL = 'https://github.com/joffreribeiro/King_BT/releases/download/latest-apk/apk-version.json';


/**
 * Link do APK com a versão no nome do arquivo (KINGBT_1.0.0-55.apk), para o arquivo baixado já vir identificado.
 * Sem a versão (ainda não consultada), cai no link fixo kingbt.apk, que continua na release.
 */
export function apkUrlDaVersao(versao: string | null): string {
  return versao ? `https://github.com/joffreribeiro/King_BT/releases/download/latest-apk/KINGBT_${versao}.apk` : APK_URL;
}

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

/** Hash do pacote que está rodando no navegador (null no servidor de desenvolvimento e fora da web). */
function runningEntryHash(): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  for (const el of Array.from(document.querySelectorAll('script[src]'))) {
    const h = entryHashFrom(el.getAttribute('src'));
    if (h) return h;
  }
  return null;
}

/** Hash do pacote publicado agora no site, lido do index.html (sem cache). */
async function fetchLiveEntryHash(): Promise<string | null> {
  const res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return entryHashFrom(await res.text());
}

/** Consulta a versão publicada (web: site; APK: release do GitHub). Nunca lança. */
async function consultar(): Promise<{ status: UpdateCheckResult; versao: string | null }> {
  if (Platform.OS === 'web') {
    const running = runningEntryHash();
    if (!running) return { status: 'indisponivel', versao: null }; // desenvolvimento: não há como saber a própria versão
    try {
      const live = await fetchLiveEntryHash();
      if (!live) return { status: 'offline', versao: null };
      return { status: isNewerBuild(running, live) ? 'nova' : 'atual', versao: null };
    } catch { return { status: 'offline', versao: null }; }
  }
  if (!CURRENT_SHA) return { status: 'indisponivel', versao: null };
  try {
    const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return { status: 'offline', versao: null };
    const json = await res.json();
    const live = shaFromVersionJson(json);
    if (!live) return { status: 'offline', versao: null };
    return { status: isNewerBuild(CURRENT_SHA, live) ? 'nova' : 'atual', versao: typeof json?.versao === 'string' ? json.versao : null };
  } catch { return { status: 'offline', versao: null }; }
}

const WEB_CHECK_EVERY_MS = 30 * 60 * 1000;
const WEB_CHECK_MIN_GAP_MS = 5 * 60 * 1000;

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [minRequiredBuildTime, setMinRequiredBuildTime] = useState<number | null>(null);

  // Web: compara o pacote em uso com o publicado no próprio site. Sem token, sem
  // Cloud Function e sem plano pago. Checa ao entrar, a cada 30 min e quando a aba
  // volta ao primeiro plano (no máximo a cada 5 min).
  useEffect(() => {
    if (!user || Platform.OS !== 'web') return;
    const running = runningEntryHash();
    if (!running) return; // desenvolvimento: não há como saber a própria versão
    let last = 0;
    let alive = true;
    async function check() {
      last = Date.now();
      const r = await consultar(); // sem rede: tenta de novo depois
      if (alive && r.status === 'nova') setUpdateAvailable(true);
    }
    check();
    const timer = setInterval(check, WEB_CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > WEB_CHECK_MIN_GAP_MS) check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [user]);

  // App instalado (APK): compara o commit embutido no build com o publicado em /version.json.
  // (Antes usava uma Cloud Function, que exige o plano Blaze e nunca foi publicada: a checagem
  // falhava em silêncio e ninguém era avisado.) Checa ao entrar e quando o app volta ao primeiro plano.
  useEffect(() => {
    if (!user || !CURRENT_SHA || Platform.OS === 'web') return;
    let alive = true;
    let last = 0;
    async function checkForUpdates() {
      last = Date.now();
      const r = await consultar(); // sem rede: tenta de novo depois
      if (alive && r.versao) setLatestVersion(r.versao);
      if (alive && r.status === 'nova') setUpdateAvailable(true);
    }
    checkForUpdates();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active' && Date.now() - last > WEB_CHECK_MIN_GAP_MS) checkForUpdates();
    });
    return () => { alive = false; sub.remove(); };
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

  const checkNow = async (): Promise<UpdateCheckResult> => {
    const r = await consultar();
    if (r.versao) setLatestVersion(r.versao);
    if (r.status === 'nova') setUpdateAvailable(true);
    return r.status;
  };

  const updateRequired =
    CURRENT_BUILD_TIME != null &&
    minRequiredBuildTime != null &&
    CURRENT_BUILD_TIME < minRequiredBuildTime;

  return (
    <UpdateContext.Provider value={{ updateAvailable, latestVersion, apkUrl: apkUrlDaVersao(latestVersion), checkNow, updateRequired }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  return useContext(UpdateContext);
}
