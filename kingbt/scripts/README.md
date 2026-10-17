# Scripts de manutenção do Firestore

Scripts de Node (`.mjs`) que falam direto com o Firestore pelo Admin SDK. Eles **ignoram as regras de segurança**, então rodam com o poder da conta que fez login. Use com cuidado.

## Sem arquivo de chave

Estes scripts **não usam arquivo de chave** de conta de serviço (um `serviceAccountKey.json` vazou no histórico público do git em 2026 e teve de ser revogado). O acesso é pelo **login da sua conta Google** (Application Default Credentials), feito uma vez por máquina:

1. Instalar o Google Cloud SDK: `winget install --id Google.CloudSDK -e` (ou o instalador em cloud.google.com/sdk/docs/install). Abrir um terminal novo depois.
2. Entrar (cada comando abre o navegador):
   ```bash
   gcloud auth login
   gcloud config set project king-bt-7f559
   gcloud auth application-default login
   gcloud auth application-default set-quota-project king-bt-7f559
   ```
3. Rodar o script, por exemplo `node scripts/list-players.mjs` (de dentro de `kingbt/`).
4. Em um computador **sem** backup agendado, convém revogar o login ao terminar uma sessão que **grava** no banco: `gcloud auth application-default revoke`. Neste computador, **não revogue**: o backup semanal usa esse mesmo login e pararia de funcionar (ver "Agendamento").

`_admin.mjs` faz a inicialização e **recusa rodar** se encontrar a variável `GOOGLE_APPLICATION_CREDENTIALS` ou um arquivo `serviceAccount*.json` ao lado dos scripts. Se você baixar uma chave nova do console por engano, apague o arquivo.

## Scripts

| Script | O que faz | Grava no banco? |
|---|---|---|
| `backup-firestore.mjs [pasta]` | Salva todas as coleções em um JSON (contém dados pessoais: guarde fora do repositório e do OneDrive) | não |
| `restore-firestore.mjs <backup.json> --only <caminho>` | Simula a restauração; só grava com `--apply` (e só sobrescreve com `--overwrite`) | só com `--apply` |
| `list-players.mjs` | Lista os jogadores do grupo `KINGBT` | não |
| `list-competitions.mjs` | Lista as competições do grupo `KINGBT` | não |

## Regras para scripts novos

- Importar `initAdmin` de `./_admin.mjs`; nunca `cert()` nem `readFileSync` de chave.
- Quem grava, apaga ou migra dados deve **simular por padrão** e só aplicar com `--apply` (modelo: `restore-firestore.mjs`).
- Nada de dados de teste no grupo real `KINGBT`.

## Agendamento

O backup semanal precisa de uma tarefa agendada do Windows apontando para `backup-firestore.mjs` **desta pasta** (e com esta pasta como diretório de trabalho), em uma conta onde o login do gcloud já foi feito. Se o login expirar (troca de senha da conta Google, revogação), o backup passa a falhar: confira o log e o resultado da última execução da tarefa de tempos em tempos.

## Scripts antigos

Os de uso único (migrações, correções, seeds) estão em `arquivo/`, só como referência. Não rode: ver `arquivo/README.md`.
