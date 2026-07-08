---
name: run-kingbt
description: Build, run, and drive the KingBT Expo web app (React Native Web). Use when asked to start KingBT, run its tests, take a screenshot of a screen (ranking, classificação, competições), or verify a UI change actually rendered.
---

KingBT é um app Expo (React Native Web) rodando em `http://localhost:8081`.
Não há servidor headless "puro" — é dirigido via Chrome DevTools Protocol
(CDP) usando `.claude/skills/run-kingbt/driver.mjs`, um driver próprio em
Node (sem dependência de Playwright). Ambiente: **Windows**, não Linux/xvfb.

Todos os paths abaixo são relativos a `kingbt/`.

## Prerequisites

- Chrome ou Edge instalados nos caminhos padrão do Windows (o driver detecta
  automaticamente):
  `C:/Program Files/Google/Chrome/Application/chrome.exe` ou
  `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.
- Node 24+ (usa `WebSocket` e `fetch` globais nativos — sem `npm install`
  extra para o driver).

## Build / Setup

Sem passo de build separado para rodar local — o Expo serve em modo dev.

```bash
npx expo start --web
```

Sobe em `http://localhost:8081`. Deixe rodando em um terminal (ou em
background) — o driver não inicia o servidor, só o navegador.

> O projeto tem um hook próprio que sincroniza `kingbt/` → `D:\KINGBT` e
> roda `expo export` + `firebase deploy` a cada edição (ver `AGENTS.md`).
> Rodar `npx expo start --web` em `D:\KINGBT` também funciona — é o mesmo
> app, só o diretório de deploy sincronizado.

## Run (agent path)

O app exige **login real** (Firebase Auth contra o projeto de produção
`king-bt-7f559`) — não existe bypass/mock de sessão no código hoje (ver
Gotchas). A sessão fica salva no perfil dedicado do driver
(`C:/Users/Joffre/AppData/Local/Temp/kingbt-driver-profile`), então o login
manual só precisa ser feito **uma vez**.

**1. Primeira vez (ou sessão expirada) — login manual:**

```bash
node .claude/skills/run-kingbt/driver.mjs login
```

Abre uma janela do Chrome **visível** (não headless) em `localhost:8081`,
usando o perfil dedicado do driver — isolado do Chrome pessoal do usuário.
Passe pelo onboarding e faça login normalmente na janela. A sessão
(localStorage/IndexedDB do Firebase Auth) fica persistida no perfil.

**2. Screenshots / inspeção (headless, reusa a sessão salva):**

```bash
node .claude/skills/run-kingbt/driver.mjs shot "http://localhost:8081/ranking" out.png
node .claude/skills/run-kingbt/driver.mjs shot "http://localhost:8081/dashboard" out.png
node .claude/skills/run-kingbt/driver.mjs html "http://localhost:8081/ranking"
```

Sempre passe a **URL completa** (`http://localhost:8081/...`), não só o
path — ver Gotchas sobre path-mangling do Git Bash.

| comando | o que faz |
|---|---|
| `login` | Abre Chrome visível para login manual (uma vez) |
| `shot <url> <out.png>` | Screenshot headless em `<out.png>` |
| `html <url>` | Imprime `document.documentElement.outerHTML` pós-JS |

Rotas úteis descobertas nesta sessão (Expo Router, `app/`):
- `/dashboard` — home do grupo
- `/(app)/ranking` (acessível em `/ranking`) — ranking geral
- Lista de competições: clique na aba inferior "Competições" (não há rota
  de listagem direta — é `/competitions/[id]` por item; navegue pela UI)

**Para clicar em elementos** (ex.: abrir uma competição, trocar de aba
dentro dela), não há comando pronto no driver — use CDP diretamente
(`Runtime.evaluate` para achar coordenadas por texto, depois
`Input.dispatchMouseEvent`). Ver padrão comentado em Gotchas.

## Run (human path)

```bash
npx expo start --web   # abre um terminal Expo; pressione 'w' se não abrir sozinho
```

Abre no navegador padrão do usuário (com a sessão pessoal já logada).
`Ctrl-C` para parar.

## Test

```bash
npm test          # Jest (jest-expo), roda src/**/__tests__/*.test.ts
npm run typecheck # tsc --noEmit
```

40 testes em 4 suítes na última execução verificada.

---

## Gotchas

- **Não há bypass de autenticação.** `app/index.tsx:35` faz
  `if (!user) router.replace('/(auth)/login')`, sem nenhum `if (__DEV__)`
  ou env var de mock. `src/firebase/config.ts` aponta direto para produção
  (`king-bt-7f559`), sem `connectAuthEmulator()`. Login manual (comando
  `login` acima) é o único caminho hoje — não tente criar um usuário fake
  sem antes confirmar com o usuário (mexeria em código de produção).
- **Splash screen animada + onboarding na primeira visita.** A splash do
  KingBT roda ~6-10s antes de estabilizar. Numa sessão nova (perfil sem
  onboarding visto), ela leva a uma tela de boas-vindas com botões
  "Pular"/"Próximo", não direto ao app. Depois da primeira vez logada,
  isso não reaparece. O driver usa `waitMs = 10000` por padrão — não
  reduza, o app fica incompleto/splash congelada com menos que isso.
- **Path-mangling do Git Bash.** Se a Bash tool (Git Bash/MSYS) do agente
  receber um path tipo `/ranking` como argumento solto, ele é convertido
  para `E:/Program Files/Git/ranking` antes de chegar no Node — e o driver
  navega para `file:///E:/.../ranking` em vez de
  `http://localhost:8081/ranking`. **Sempre passe a URL completa entre
  aspas** (`"http://localhost:8081/ranking"`), nunca só o path.
- **`/json/new` do CDP já retorna o target completo** (incluindo
  `webSocketDebuggerUrl`) — não precisa de round-trip extra em
  `/json/list` para resolver o `targetId`.
- **Múltiplos processos `chrome.exe` na lista de tasks é normal.** O
  Chrome headless spawna um processo por aba/worker/extensão. Para
  confirmar que é o processo do driver (não o Chrome pessoal do usuário),
  cheque a `--user-data-dir` na command line — deve ser
  `.../Temp/kingbt-driver-profile`, nunca o perfil padrão do usuário.
- **Clicar em elementos via CDP**: não há seletor CSS estável (RN Web gera
  classes geradas). O padrão que funcionou é achar por texto via
  `Runtime.evaluate` (`document.querySelectorAll('*')` +
  `textContent.trim() === '<texto>'` num elemento folha) e then
  `Input.dispatchMouseEvent` (`mousePressed` + `mouseReleased`) nas
  coordenadas do `getBoundingClientRect()`. Rótulos com acento (ex.
  "Classificação") funcionam melhor com regex parcial sem acento
  (`/assifica/i`) para evitar problemas de encoding entre o heredoc bash e
  o `Runtime.evaluate`.

## Troubleshooting

- **Screenshot mostra só a tela de login**: a sessão expirou ou nunca foi
  criada nesse perfil. Rode `node driver.mjs login` de novo.
- **Screenshot mostra a splash presa / botão "↻ Repetir"**: é a splash
  screen no fim da animação aguardando interação — normalmente some depois
  do onboarding ser visto uma vez (fica salvo no mesmo perfil). Se
  persistir, aumente `waitMs` em `navigateAndWait()` no driver.
- **`ERR_FILE_NOT_FOUND` na screenshot / título vira `file:///E:/...`**:
  path-mangling do Git Bash (ver Gotchas) — a URL virou um path de
  arquivo local. Passe a URL completa entre aspas.
- **`TypeError: Cannot read properties of undefined (reading
  'webSocketDebuggerUrl')`**: bug já corrigido no driver (vinha de tentar
  casar `targetId` de `/json/new` com uma entrada separada de
  `/json/list`); se reaparecer, confirme que `openCdpSession()` está
  usando o retorno direto de `/json/new`.
