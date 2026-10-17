import { initAdmin } from './_admin.mjs';

const db = await initAdmin();

const snap = await db.collection('groups').doc('KINGBT').collection('competitions').get();
console.log(`${snap.docs.length} competições encontradas:\n`);
snap.docs.forEach(d => {
  const data = d.data();
  console.log(`ID: ${d.id}`);
  console.log(`  name: ${data.name}`);
  console.log(`  format: ${data.format}`);
  console.log(`  status: ${data.status}`);
  console.log(`  date: ${data.date}`);
  console.log(`  matches: ${data.matches?.length ?? 0}`);
  console.log();
});
process.exit(0);
