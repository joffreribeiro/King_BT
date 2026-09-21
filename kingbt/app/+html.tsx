import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Template raiz do HTML exportado para web (só roda no build estático —
 * expo export --platform web). Antes deste arquivo não havia <meta
 * description>, theme-color nem manifest PWA: link compartilhado sem
 * descrição, app não instalável — apesar de a web ser o canal de
 * distribuição principal do King BT.
 *
 * O <title> NÃO mora aqui: ele é definido via <Head> (expo-router/head) no
 * _layout.tsx raiz, porque esse componente usa o mesmo react-helmet-async
 * que o Expo Router já deixa como placeholder vazio no <head> — um <title>
 * estático escrito neste arquivo fica ao lado do placeholder em vez de
 * substituí-lo, e a página acaba com dois <title>.
 *
 * O <link rel="icon"> também não é declarado aqui: o Expo CLI já injeta esse
 * link sozinho a partir de expo.web.favicon (app.json) durante o export.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <meta name="description" content="Placar, ranking e competições de beach tennis do seu grupo." />
        <meta name="theme-color" content="#0B0B0D" />

        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Reset de estilo necessário para apps React Native Web full-screen. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
