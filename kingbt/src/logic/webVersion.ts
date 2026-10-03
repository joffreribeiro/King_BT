/**
 * Versão do app na web: o `index.html` publicado referencia o pacote como
 * `/_expo/static/js/web/entry-<hash>.js`. Cada publicação gera um hash novo,
 * então comparar o hash do pacote que está rodando com o do site ao vivo diz se
 * há versão mais nova — sem arquivo de versão para manter, sem token e sem
 * Cloud Function, e vale para qualquer forma de publicar.
 */
const ENTRY_RE = /entry-([a-f0-9]{8,})\.js/;

/** Hash do pacote principal a partir de um trecho de HTML ou de um `src`. null se não houver (ex.: servidor de desenvolvimento). */
export function entryHashFrom(text: string | null | undefined): string | null {
  const m = text ? ENTRY_RE.exec(text) : null;
  return m ? m[1] : null;
}

/**
 * App instalado (APK): o site publica `/version.json` ({ "sha": "<commit>" }) a cada deploy (ver
 * deploy-web.yml). O APK compara o commit embutido no build com esse. Sem Cloud Function, sem token
 * do GitHub e sem limite por IP.
 */
export function shaFromVersionJson(raw: unknown): string | null {
  const sha = raw && typeof raw === 'object' ? (raw as { sha?: unknown }).sha : null;
  return typeof sha === 'string' && /^[a-f0-9]{7,40}$/i.test(sha) ? sha : null;
}

/** Há versão mais nova? Só se os dois hashes existem e diferem. */
export function isNewerBuild(running: string | null, latest: string | null): boolean {
  return !!running && !!latest && running !== latest;
}
