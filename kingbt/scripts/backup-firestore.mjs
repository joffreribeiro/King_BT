// Backup completo do Firestore em um arquivo JSON (só LÊ; nunca altera nada no banco).
//
// Uso (de D:\KINGBT\projeto\scripts):
//   node backup-firestore.mjs                 -> grava em D:\KINGBT\dados\backup-AAAA-MM-DD-HHMM.json
//   node backup-firestore.mjs "E:\Meus backups" -> grava na pasta indicada
//
// Percorre TODAS as coleções e subcoleções (grupos, jogadores, competições, feed, desafios, usuários...).
// O arquivo contém dados pessoais (nomes e e-mails dos usuários): guarde fora do repositório e não envie a ninguém.
// Para restaurar: restore-firestore.mjs.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = process.env.KINGBT_KEY || resolve(__dirname, 'serviceAccountKey.json');
if (!existsSync(keyPath)) { console.error('Chave não encontrada:', keyPath, '(defina KINGBT_KEY ou coloque serviceAccountKey.json aqui)'); process.exit(1); }
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

/** Valores especiais do Firestore viram objetos marcados, para a restauração recriar o tipo certo. */
export function enc(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint) return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (v instanceof DocumentReference) return { __t: 'ref', path: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'bytes', b64: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(enc);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
}

const docs = {};
const perCollection = {};
async function dump(col) {
  const snap = await col.get();
  for (const d of snap.docs) {
    docs[d.ref.path] = enc(d.data());
    const root = d.ref.path.split('/')[0];
    perCollection[root] = (perCollection[root] || 0) + 1;
    for (const sub of await d.ref.listCollections()) await dump(sub);
  }
}

const started = Date.now();
for (const col of await db.listCollections()) await dump(col);

const now = new Date();
const p2 = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;
const outDir = process.argv[2] || 'D:\\KINGBT\\dados';
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `backup-${stamp}.json`);
writeFileSync(file, JSON.stringify({
  meta: { projectId: key.project_id, createdAt: now.toISOString(), totalDocs: Object.keys(docs).length, perCollection },
  docs,
}));
// Guarda só os KEEP mais recentes (backup semanal: ~5 meses) para a pasta não crescer sem limite.
const KEEP = 20;
const old = readdirSync(outDir).filter(f => /^backup-.*\.json$/.test(f)).sort().reverse().slice(KEEP);
for (const f of old) { unlinkSync(join(outDir, f)); console.log('Removido backup antigo:', f); }

console.log(`OK: ${Object.keys(docs).length} documentos em ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('Por coleção:', JSON.stringify(perCollection));
console.log('Arquivo:', file);
process.exit(0);
