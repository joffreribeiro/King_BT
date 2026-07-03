import { Platform, Share } from 'react-native';

/**
 * Compartilha texto de forma multiplataforma.
 * - Nativo: abre a folha de compartilhamento do sistema (WhatsApp etc.).
 * - Web: copia para a área de transferência — o navigator.share no desktop
 *   abre o painel do Windows, que falha ("Não foi possível mostrar todas as
 *   maneiras de compartilhar").
 *
 * Retorna como o texto foi entregue, para o chamador dar feedback.
 */
export async function shareText(message: string, title?: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      // Clipboard bloqueado (ex.: contexto não seguro) — mostra para cópia manual
      window.prompt('Copie o texto:', message);
      return 'failed';
    }
  }
  try {
    await Share.share(title ? { message, title } : { message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Feedback padrão na web após cópia (no nativo a folha de compartilhar já é o feedback). */
export function notifyCopied(what = 'Texto') {
  if (Platform.OS === 'web') {
    window.alert(`${what} copiado! Cole no WhatsApp ou onde preferir.`);
  }
}
