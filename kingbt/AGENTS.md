# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## CSS & Styling Workflow

Before changing any CSS layout/width/spacing rule, FIRST find every rule that affects the target element: grep all stylesheets for the selector, including inline styles, `!important`, global `nth-child` rules, `table-layout: fixed`, colspan summary rows, and freeze-column rules. List every matching rule with its specificity and flag which ones conflict. Do not edit until the conflicting layers are identified. Apply one consolidated fix, not one rule at a time.

## Environment & Sync

Fonte: `C:\Users\JoffreRibeiro\OneDrive\Documentos\Sistemas\King_BT\kingbt`.
Cópia de build: `D:\KINGBT\projeto` (fora do OneDrive — os `node_modules` no OneDrive
são placeholders de nuvem e travam o bundler).

**Era `C:\KINGBT` até 20/09/2026** — mudou porque o disco `C:` encheu (o hook
recopia a árvore inteira a cada Write/Edit, e o volume acumulado ao longo de
semanas esgotou os 238GB do disco). O hook, o `.claude/settings.json` e este
arquivo foram todos atualizados juntos para `D:\KINGBT\projeto`. Se algo ainda
mencionar `C:\KINGBT` (um terminal aberto, uma nota antiga), é resquício —
o caminho atual é `D:\KINGBT\projeto`.

Um hook `PostToolUse` (matcher `Write|Edit`) copia a fonte para `D:\KINGBT\projeto`,
roda `npx expo export --platform web` e `npx firebase-tools deploy --only
hosting`. Se uma mudança "não aparece", confira primeiro se o hook rodou e
sincronizou/publicou — a maioria dos casos de "mudança invisível" é tempo de
sync/deploy, não cascata de CSS.

### O hook mora na RAIZ do repositório, não em `kingbt/`

Ele fica em **`King_BT\.claude\settings.json`** (junto do `.git`), e não em
`kingbt\.claude\settings.json`. O Claude Code carrega hooks do `settings.json`
da raiz do projeto reconhecido — ele não varre subpastas atrás de outro. Um
hook declarado em `kingbt/.claude/settings.json` **nunca dispara**, e falha em
silêncio: nenhum erro, nenhum aviso, o sync simplesmente não acontece.

Isso já aconteceu (03/09/2026): o hook passou semanas sem rodar por estar na
subpasta, e ninguém percebeu porque não há mensagem de erro. Sintoma típico:
`D:\KINGBT\projeto` com arquivos dias mais velhos que a fonte, e o site publicado
mostrando uma versão antiga mesmo depois de vários edits.

Como testar se está vivo: edite qualquer arquivo com a ferramenta Write/Edit e
verifique se o arquivo aparece atualizado em `D:\KINGBT\projeto`. Se não aparecer, o
hook não está sendo carregado — confira em qual `settings.json` ele está.

### `firebase` não existe no PATH

Chame sempre **`npx firebase-tools`**, nunca `firebase` puro. O CLI não está
instalado globalmente aqui (a pasta global do npm nem existe), então
`firebase deploy ...` falha com "não é reconhecido como comando". Esse era o
segundo bug do hook, além do lugar errado.

### Deploy manual (quando o hook não rodou)

Rodar de `D:\KINGBT\projeto`, nunca do OneDrive:

```bash
cd /d/KINGBT/projeto
npx expo export --platform web
npx firebase-tools deploy --only hosting,firestore:rules --project king-bt-7f559
```

Validar as regras do Firestore sem publicar: acrescente `--dry-run` ao deploy.
Conferir se o bundle publicado é o atual: compare o hash de
`curl -s https://king-bt-7f559.web.app/ | grep -oE 'entry-[a-f0-9]+\.js'` com o
arquivo em `D:\KINGBT\projeto\dist\_expo\static\js\web\`.

### Regras do Firestore

`firestore.rules` é deploy separado do app — não passa por `D:\KINGBT` nem pelo
build; vai direto para o backend. `git push` não publica nem um nem outro.
Testes de comportamento das regras: `npm run test:rules` (emulador).

### O emulador SOBE nesta máquina — com duas condições (19/09/2026)

Esta seção já disse que o emulador era impossível aqui. Não é: ele roda, e a
suíte `test/firestore.rules.test.mjs` passa inteira. Eram dois problemas
empilhados, e o primeiro escondia o segundo.

1. **JDK 21+.** O `firebase-tools` 15.x recusa Java anterior a 21 e morre antes
   de tentar qualquer coisa. O `JAVA_HOME` da máquina aponta para o 17, mas o
   21 **já está instalado**:
   `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
2. **`TMP` em caminho simples.** Com o JDK 21 aparece o erro que esta seção
   documentava — `Unable to establish loopback connection` /
   `Invalid argument: connect` em `UnixDomainSockets.connect0`. O diagnóstico
   estava certo, mas a causa é o diretório temporário: o `PipeImpl` da JVM cria
   um socket AF_UNIX no `TMP`, e o caminho padrão (dentro do perfil do usuário,
   com espaços e via OneDrive) não serve. Apontar `TMP`/`TEMP` para algo curto
   como `C:\Temp\fbemu` resolve.

Rodar a suíte de regras, de `kingbt/`:

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
export TMP="C:\Temp\fbemu" TEMP="C:\Temp\fbemu" TMPDIR="C:\Temp\fbemu"
mkdir -p /c/Temp/fbemu
npx firebase-tools emulators:exec --only firestore --project kingbt-rules-test "node test/firestore.rules.test.mjs"
```

O mesmo emulador roda o teste de concorrência de competição, que prova que
salvar placar não é mais last-write-wins (`test/competition.concurrency.test.mjs`):

```bash
npx firebase-tools emulators:exec --only firestore --project kingbt-concurrency-test "node test/competition.concurrency.test.mjs"
```

`npm run test:rules` sozinho ainda falha, porque não exporta nada disso.
`--dry-run` continua útil, mas valida só sintaxe — não substitui a suíte.

## Cloud Functions

**Não há.** A pasta `functions/` foi removida em 17/10/2026. Das duas funções que existiam, `getLatestCommitSha` não era chamada por ninguém (a checagem de versão usa `version.json` e `apk-version.json`) e `searchUsers` só alimentava a tela "adicionar membro existente", que também saiu: entrar num grupo é pelo código de convite, com aprovação do admin. Sem funções, o projeto não precisa do plano Blaze. Se algum dia voltar a precisar de código no servidor, a busca por e-mail devolve dados pessoais: faça por e-mail exato e só para admins.

## Decisões de produto pendentes (não mexer sem reconfirmar)

Levantadas na auditoria de 20-21/09/2026, o usuário pediu explicitamente
para NÃO corrigir agora — não são bugs esquecidos, são escolhas conscientes:

- **GA satura em 9,99 sem games contra** (src/logic/scoring.ts, `gameAverage`).
  Quem jogou 1 partida 6×0 sobe ao topo do ranking à frente de quem jogou a
  temporada inteira. Corrigir exigiria decidir um critério mínimo de jogos
  primeiro — não decidido ainda.
- **Sem Crashlytics/Sentry** — nenhuma observabilidade de crash em produção
  além do Logger local (200 entradas em memória, só em `__DEV__`). Adicionar
  é infraestrutura nova (conta terceiro ou rebuild nativo pro Crashlytics),
  não pedida ainda.

## Git Workflow

Do not run `git commit` or `git push` unless explicitly asked. Let the user verify a fix visually first.

## Domain Rules — Beach Tennis

This app follows real Beach Tennis rules. There is no second-serve distinction (unlike tennis). Super 8 format must correctly distinguish individuals play vs. duplas. Verify rules with the user before implementing scoring/format features if unsure.
