# Scripts antigos (não rodar)

Scripts de uso único, guardados só como referência. Eles ainda usam o método antigo (`cert()` lendo `serviceAccountKey.json` ou `serviceAccount.json`), então **não funcionam** sem arquivo de chave, e é assim de propósito: não crie esse arquivo de novo.

Vários gravam direto no grupo real `KINGBT`:

| Script | Para que serviu | Risco |
|---|---|---|
| `seed-all`, `seed-competitions`, `seed-feed` | Criar dados de teste | gravam dados falsos no grupo real |
| `migrate-avulso-to-super8`, `migrate-feed-compname`, `migrate-feed-format`, `migrate-gender-masculino` | Migrações de formato de dados | alteram documentos em massa (só `migrate-gender-masculino` simula por padrão) |
| `fix-marcelo`, `delete-duplicate-marcelo`, `update-group-code`, `cleanup-test-treino`, `fix_temp.js` | Correções pontuais | alteram ou apagam documentos específicos |

Para reaproveitar um deles: reescrever com `initAdmin` de `../_admin.mjs`, fazer simular por padrão e só gravar com `--apply` (modelo: `../restore-firestore.mjs`), e fazer um `backup-firestore.mjs` antes.
