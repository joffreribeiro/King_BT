import * as Sentry from '@sentry/react-native';

/**
 * Relatório de erros em produção (Sentry). Só liga se existir a variável EXPO_PUBLIC_SENTRY_DSN no build:
 * sem ela, tudo aqui é no-op e o app se comporta como antes. O DSN não é segredo (vai no pacote do app).
 *
 * Privacidade: não enviamos dados pessoais automaticamente (sendDefaultPii desligado). Só o id da conta
 * (uid do Firebase) é anexado, para saber se é a mesma pessoa batendo no mesmo erro.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let enabled = false;

/** Mensagens de ruído que não ajudam: o usuário sem rede, o navegador reclamando de si mesmo. */
const IGNORED = [
  'ResizeObserver loop',
  'Network request failed',
  'Failed to fetch',
  'Load failed',
  'AbortError',
];

export function initCrashReporting(): void {
  if (enabled || !DSN) return;
  try {
    Sentry.init({
      dsn: DSN,
      environment: __DEV__ ? 'development' : 'production',
      enabled: !__DEV__, // no localhost não polui o painel
      sendDefaultPii: false,
      tracesSampleRate: 0, // só erros; sem monitoramento de desempenho
      ignoreErrors: IGNORED,
    });
    enabled = true;
  } catch {
    // Relatório de erro nunca pode derrubar o app.
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), context ? { extra: context } : undefined);
  } catch { /* ignora */ }
}

/** Liga os erros à conta (só o uid); `null` ao sair. */
export function setCrashUser(uid: string | null): void {
  if (!enabled) return;
  try { Sentry.setUser(uid ? { id: uid } : null); } catch { /* ignora */ }
}

export const crashReportingEnabled = (): boolean => enabled;
