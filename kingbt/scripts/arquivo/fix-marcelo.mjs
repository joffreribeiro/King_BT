import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccount.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const OLD_ID = 'wxuEAlOGg80lGRI53PRL'; // Marcelo
const NEW_ID = 'smwSTud7lAGwVZUgjMqE'; // Marcelão
const GROUP_ID = 'KINGBT';

function replaceId(val) {
  if (val === OLD_ID) return NEW_ID;
  if (Array.isArray(val)) return val.map(replaceId);
  return val;
}

async function main() {
  const comps = await db.collection('groups').doc(GROUP_ID).collection('competitions').get();
  let fixed = 0;

  for (const c of comps.docs) {
    const data = c.data();
    let changed = false;

    const matches = (data.matches || []).map(m => {
      const nm = { ...m };
      if (nm.teamA) { const r = replaceId(nm.teamA); if (JSON.stringify(r) !== JSON.stringify(nm.teamA)) { nm.teamA = r; changed = true; } }
      if (nm.teamB) { const r = replaceId(nm.teamB); if (JSON.stringify(r) !== JSON.stringify(nm.teamB)) { nm.teamB = r; changed = true; } }
      if (nm.aId === OLD_ID) { nm.aId = NEW_ID; changed = true; }
      if (nm.bId === OLD_ID) { nm.bId = NEW_ID; changed = true; }
      return nm;
    });

    const competitors = (data.competitors || []).map(comp => {
      const nc = { ...comp };
      if (nc.id === OLD_ID) { nc.id = NEW_ID; changed = true; }
      if (nc.members) {
        const r = replaceId(nc.members);
        if (JSON.stringify(r) !== JSON.stringify(nc.members)) { nc.members = r; changed = true; }
      }
      return nc;
    });

    if (changed) {
      await db.collection('groups').doc(GROUP_ID).collection('competitions').doc(c.id).update({ matches, competitors });
      console.log('Corrigido:', data.name);
      fixed++;
    } else {
      console.log('Sem alteração:', data.name);
    }
  }

  await db.collection('groups').doc(GROUP_ID).collection('players').doc(OLD_ID).update({
    name: 'Marcelão',
    color: '#F97316',
  });
  console.log('Player "Marcelo" renomeado para "Marcelão"');
  console.log(`\nTotal: ${fixed} competições corrigidas`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
