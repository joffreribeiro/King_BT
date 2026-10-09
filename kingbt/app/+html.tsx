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
 * O Expo CLI também injeta /favicon.ico a partir de expo.web.favicon (app.json) durante o export;
 * o <link rel="icon"> abaixo garante o ícone do King BT também no servidor de desenvolvimento.
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

        {/* iPhone/iPad: abre em tela cheia quando adicionado à Tela de Início, com a barra de status escura. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="King BT" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Ícone da aba do navegador (o Expo também injeta /favicon.ico no export; este vale inclusive no servidor de desenvolvimento). */}
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Reset de estilo necessário para apps React Native Web full-screen. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
