const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./serviceAccount.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function fix() {
  const groupsSnap = await db.collection('groups').get();
  for (const gDoc of groupsSnap.docs) {
    const playersSnap = await db.collection('groups').doc(gDoc.id).collection('players').get();
    let danielDoc = null;
    let marcelaoDoc = null;
    for (const p of playersSnap.docs) {
      const d = p.data();
      if (d.uid === 'bMPkSsd7CZUq4ZfGMKFLcQOdRdx1') danielDoc = p;
      if (d.name && d.name.toLowerCase().includes('marcel') && !d.uid) marcelaoDoc = p;
    }
    if (danielDoc) {
      console.log('Grupo:', gDoc.data().name, '| ID:', gDoc.id);
      console.log('Player com uid do Marcelao:', danielDoc.id, JSON.stringify(danielDoc.data()));
      if (marcelaoDoc) console.log('Marcelao sem uid:', marcelaoDoc.id, JSON.stringify(marcelaoDoc.data()));
      else console.log('Nenhum Marcelao sem uid encontrado');
    }
  }
}
fix().catch(console.error);