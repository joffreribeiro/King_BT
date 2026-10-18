# Expo: leia a documentação da versão instalada

O projeto está no **Expo SDK 55** (React Native 0.83, React 19.2; `sdkVersion` em `app.json`). Antes de escrever código, leia a documentação versionada em https://docs.expo.dev/versions/v55.0.0/ e atualize esta linha a cada troca de SDK.

## CSS & Styling Workflow

Before changing any CSS layout/width/spacing rule, FIRST find every rule that affects the target element: grep all stylesheets for the selector, including inline styles, `!important`, global `nth-child` rules, `table-layout: fixed`, colspan summary rows, and freeze-column rules. List every matching rule with its specificity and flag which ones conflict. Do not edit until the conflicting layers are identified. Apply one consolidated fix, not one rule at a time.

## Ambiente, publicação e CI

- Repositório: `D:\SISTEMAS\KINGBT\King_BT-repo` (o app está em `kingbt/`); remoto github.com/joffreribeiro/King_BT. Os caminhos antigos `C:\KINGBT` e `D:\KINGBT\projeto` não existem mais.
- **Publicar é pelo GitHub Actions**, não por cópia de pasta. Push na `main` que mude `kingbt/**` roda `deploy-web.yml`: testes, suíte de regras no emulador, build web e deploy no Firebase Hosting **mais as regras do Firestore**. O APK só sai com `[apk]` na mensagem do commit ou disparo manual de `build-apk.yml`, e ele **publica a release `latest-apk`** (os celulares recebem o aviso de atualização).
- Não há hook que copie ou publique ao editar arquivos (o `.claude/settings.json` não tem hooks).
- `firebase` não está no PATH: use sempre `npx firebase-tools`.
- O CI usa Node 22 / npm 10. Um `package-lock.json` gerado pelo npm 11 pode ser recusado pelo `npm ci`: depois de mexer em dependências, rode `npx -y npm@10 install --package-lock-only`.
- Para conferir o que está no ar: `curl https://kingbt.web.app/version.json` devolve o sha do commit publicado.
- Manutenção do banco: `kingbt/scripts/`, com o login do gcloud e **sem arquivo de chave** (ver `scripts/README.md`). Nunca crie chave de conta de serviço: o histórico público do repositório já vazou duas (revogadas).

### Regras do Firestore

`firestore.rules` é publicado pelo mesmo `deploy-web.yml`, depois da suíte do emulador. Toda regra nova ganha teste em `test/firestore.rules.test.mjs`, e o teste precisa **falhar contra a regra antiga** (senão não prova nada). Cuidado: os testes de criação reutilizam ids; use um id novo para o caso ser uma criação de verdade. `--dry-run` valida só sintaxe.

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
- **Observabilidade de crash:** o Sentry está ligado (`src/services/crashReporting.ts`; DSN em `EXPO_PUBLIC_SENTRY_DSN`, que só envia em build de produção). Não há Crashlytics.

## Git Workflow

Do not run `git commit` or `git push` unless explicitly asked. Let the user verify a fix visually first.

## Domain Rules — Beach Tennis

This app follows real Beach Tennis rules. There is no second-serve distinction (unlike tennis). Super 8 format must correctly distinguish individuals play vs. duplas. Verify rules with the user before implementing scoring/format features if unsure.
