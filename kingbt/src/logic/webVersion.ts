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

/** Há versão mais nova? Só se os dois hashes existem e diferem. */
export function isNewerBuild(running: string | null, latest: string | null): boolean {
  return !!running && !!latest && running !== latest;
}
