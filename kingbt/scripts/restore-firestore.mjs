// Restaura documentos de um backup (gerado por backup-firestore.mjs) de volta ao Firestore.
//
// SEGURO POR PADRÃO: sem --apply só MOSTRA o que seria feito. Sem --overwrite só recria o que NÃO existe mais.
//
// Uso (de D:\KINGBT\projeto\scripts):
//   node restore-firestore.mjs <backup.json> --only <caminho>            -> simulação
//   node restore-firestore.mjs <backup.json> --only <caminho> --apply    -> grava de verdade
//
//   --only <caminho>  obrigatório. Prefixo do caminho a restaurar, por exemplo:
//        groups/ID_DO_GRUPO/competitions/ID_DA_COMPETICAO   (uma competição apagada por engano)
//        groups/ID_DO_GRUPO/competitions                    (todas as competições do grupo)
//        groups/ID_DO_GRUPO                                 (o grupo inteiro, com tudo dentro)
//   --overwrite       também sobrescreve documentos que ainda existem (padrão: pula)
//   --list            só lista os caminhos do backup que começam com o prefixo (não consulta o banco)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--only');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.replace(/^\/+|\/+$/g, '') : null;
const apply = args.includes('--apply');
const overwrite = args.includes('--overwrite');
const listOnly = args.includes('--list');
if (!file || !only) { console.error('Uso: node restore-firestore.mjs <backup.json> --only <caminho> [--apply] [--overwrite] [--list]'); process.exit(1); }
if (!existsSync(file)) { console.error('Arquivo não encontrado:', file); process.exit(1); }

const backup = JSON.parse(readFileSync(file, 'utf8'));
const matches = Object.keys(backup.docs).filter(p => p === only || p.startsWith(only + '/'));
console.log(`Backup de ${backup.meta?.createdAt} (${backup.meta?.projectId}): ${matches.length} documento(s) em "${only}"`);
if (matches.length === 0) process.exit(0);
if (listOnly) { matches.slice(0, 200).forEach(p => console.log(' ', p)); if (matches.length > 200) console.log(`  ... e mais ${matches.length - 200}`); process.exit(0); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = process.env.KINGBT_KEY || resolve(__dirname, 'serviceAccountKey.json');
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
if (backup.meta?.projectId && backup.meta.projectId !== key.project_id) { console.error(`Projeto diferente: backup ${backup.meta.projectId} x chave ${key.project_id}. Abortando.`); process.exit(1); }
initializeApp({ credential: cert(key) });
const db = getFirestore();

function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec);
  if (v.__t === 'ts') return new Timestamp(v.s, v.n);
  if (v.__t === 'geo') return new GeoPoint(v.lat, v.lng);
  if (v.__t === 'ref') return db.doc(v.path);
  if (v.__t === 'bytes') return Buffer.from(v.b64, 'base64');
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
}

let toWrite = 0, skipped = 0, written = 0;
for (const path of matches) {
  const ref = db.doc(path);
  const exists = (await ref.get()).exists;
  if (exists && !overwrite) { skipped++; continue; }
  toWrite++;
  if (apply) { await ref.set(dec(backup.docs[path])); written++; }
  else console.log(`  [simulação] ${exists ? 'sobrescreveria' : 'recriaria'}: ${path}`);
}
console.log(apply
  ? `Pronto: ${written} documento(s) restaurado(s); ${skipped} já existiam e foram mantidos.`
  : `Simulação: ${toWrite} documento(s) seriam gravados; ${skipped} já existem (mantidos). Rode de novo com --apply para gravar.`);
process.exit(0);
