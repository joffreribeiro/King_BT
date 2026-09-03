# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## CSS & Styling Workflow

Before changing any CSS layout/width/spacing rule, FIRST find every rule that affects the target element: grep all stylesheets for the selector, including inline styles, `!important`, global `nth-child` rules, `table-layout: fixed`, colspan summary rows, and freeze-column rules. List every matching rule with its specificity and flag which ones conflict. Do not edit until the conflicting layers are identified. Apply one consolidated fix, not one rule at a time.

## Environment & Sync

Fonte: `C:\Users\JoffreRibeiro\OneDrive\Documentos\Sistemas\King_BT\kingbt`.
Cópia de build: `C:\KINGBT` (fora do OneDrive — os `node_modules` no OneDrive
são placeholders de nuvem e travam o bundler). **Não existe drive `D:` nesta
máquina**; qualquer referência a `D:\KINGBT` ou `E:\...` é resquício de uma
configuração antiga e está errada.

Um hook `PostToolUse` (matcher `Write|Edit`) copia a fonte para `C:\KINGBT`,
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
`C:\KINGBT` com arquivos dias mais velhos que a fonte, e o site publicado
mostrando uma versão antiga mesmo depois de vários edits.

Como testar se está vivo: edite qualquer arquivo com a ferramenta Write/Edit e
verifique se o arquivo aparece atualizado em `C:\KINGBT`. Se não aparecer, o
hook não está sendo carregado — confira em qual `settings.json` ele está.

### `firebase` não existe no PATH

Chame sempre **`npx firebase-tools`**, nunca `firebase` puro. O CLI não está
instalado globalmente aqui (a pasta global do npm nem existe), então
`firebase deploy ...` falha com "não é reconhecido como comando". Esse era o
segundo bug do hook, além do lugar errado.

### Deploy manual (quando o hook não rodou)

Rodar de `C:\KINGBT`, nunca do OneDrive:

```bash
cd /c/KINGBT
npx expo export --platform web
npx firebase-tools deploy --only hosting,firestore:rules --project king-bt-7f559
```

Validar as regras do Firestore sem publicar: acrescente `--dry-run` ao deploy.
Conferir se o bundle publicado é o atual: compare o hash de
`curl -s https://king-bt-7f559.web.app/ | grep -oE 'entry-[a-f0-9]+\.js'` com o
arquivo em `C:\KINGBT\dist\_expo\static\js\web\`.

### Regras do Firestore

`firestore.rules` é deploy separado do app — não passa por `C:\KINGBT` nem pelo
build; vai direto para o backend. `git push` não publica nem um nem outro.
Testes de comportamento das regras: `npm run test:rules` (emulador). O emulador
**não sobe nesta máquina** — o Windows recusa o socket de loopback que a JVM
usa (reproduzível com um `Selector.open()` puro, sem código do Firebase), então
a validação possível aqui é só `--dry-run` (sintaxe).

## Git Workflow

Do not run `git commit` or `git push` unless explicitly asked. Let the user verify a fix visually first.

## Domain Rules — Beach Tennis

This app follows real Beach Tennis rules. There is no second-serve distinction (unlike tennis). Super 8 format must correctly distinguish individuals play vs. duplas. Verify rules with the user before implementing scoring/format features if unsure.
