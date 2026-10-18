// Liga (ou desliga) os logs de auditoria de ACESSO A DADOS de serviços do projeto, direto na política de IAM.
// Serve quando o console não lista o serviço (o Firestore não aparece na tela "Registros de auditoria").
//
// SIMULA por padrão: mostra a configuração atual e o que mudaria. Para gravar: --apply
//   node scripts/auditoria-acesso-dados.mjs firestore.googleapis.com                       -> simulação
//   node scripts/auditoria-acesso-dados.mjs firestore.googleapis.com --apply               -> liga
//   node scripts/auditoria-acesso-dados.mjs firestore.googleapis.com --remover file.googleapis.com --apply
//
// Liga ADMIN_READ, DATA_READ e DATA_WRITE. Só mexe em `auditConfigs`; os papéis (quem tem acesso) ficam como estão.
// Custo: o Google cobra pelo volume de log. Se pesar, desligue só DATA_READ (edite LOG_TYPES abaixo).
// Exige o login do gcloud (scripts/README.md) com papel de Proprietário no projeto.
import { applicationDefault } from 'firebase-admin/app';
import { initAdmin, PROJECT_ID } from './_admin.mjs';

// Encerrar com folga: no Windows, process.exit durante uma conexão HTTP aberta imprime um erro do Node.
async function sair(codigo) { await new Promise(r => setTimeout(r, 300)); process.exit(codigo); }

const LOG_TYPES = ['ADMIN_READ', 'DATA_READ', 'DATA_WRITE'];
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const iRem = args.indexOf('--remover');
const remover = iRem >= 0 ? args.slice(iRem + 1).filter(a => !a.startsWith('--')) : [];
const ligar = args.filter((a, i) => !a.startsWith('--') && (iRem < 0 || i < iRem));
if (ligar.length === 0 && remover.length === 0) {
  console.error('Uso: node scripts/auditoria-acesso-dados.mjs <servico.googleapis.com> [...] [--remover <servico> ...] [--apply]');
  await sair(1);
}

await initAdmin();
const token = (await applicationDefault().getAccessToken()).access_token;
const base = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`;
const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const r = await fetch(`${base}:getIamPolicy`, { method: 'POST', headers: hdr, body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }) });
const policy = await r.json();
if (!r.ok) { console.error('Falha ao ler a política:', r.status, JSON.stringify(policy).slice(0, 300)); await sair(1); }

const fmt = (cfgs) => (cfgs ?? []).map(c => `  ${c.service.padEnd(36)} ${c.auditLogConfigs.map(x => x.logType).join(', ')}`).join('\n') || '  (nenhuma)';
console.log(`Projeto: ${PROJECT_ID}\nConfiguração ATUAL:\n${fmt(policy.auditConfigs)}`);

let cfgs = (policy.auditConfigs ?? []).filter(c => !remover.includes(c.service));
for (const s of ligar) {
  cfgs = cfgs.filter(c => c.service !== s);
  cfgs.push({ service: s, auditLogConfigs: LOG_TYPES.map(logType => ({ logType })) });
}
console.log(`\nConfiguração DEPOIS:\n${fmt(cfgs)}`);
if (JSON.stringify(cfgs) === JSON.stringify(policy.auditConfigs ?? [])) { console.log('\nNada a mudar.'); await sair(0); }
if (!apply) { console.log('\nSIMULAÇÃO. Rode de novo com --apply para gravar.'); await sair(0); }

// Mantém o etag lido: se alguém mudou a política no meio do caminho, o Google recusa em vez de sobrescrever.
const w = await fetch(`${base}:setIamPolicy`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({ policy: { ...policy, auditConfigs: cfgs }, updateMask: 'auditConfigs,etag' }),
});
const out = await w.json();
if (!w.ok) { console.error('Falha ao gravar:', w.status, JSON.stringify(out).slice(0, 300)); await sair(1); }
console.log('\nPronto. Configuração gravada:\n' + fmt(out.auditConfigs));
await sair(0);
