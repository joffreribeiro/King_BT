import { initAdmin } from './_admin.mjs';

const db = await initAdmin();

const snap = await db.collection('groups').doc('KINGBT').collection('players').get();
console.log(`${snap.docs.length} jogadores:\n`);
snap.docs.forEach(d => {
  const data = d.data();
  console.log(`ID: ${d.id}  |  name: "${data.name}"  |  guest: ${data.guest}  |  uid: ${data.uid ?? 'null'}`);
});
process.exit(0);
