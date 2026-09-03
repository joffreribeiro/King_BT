// Testa firestore.rules contra o emulador do Firestore, ANTES de deployar.
// Roda uma vez, contra o emulador local (sem tocar produção): `npm run test:rules`
// (o script sobe o emulador, roda este arquivo, derruba o emulador).
//
// Cobre só o que mudou nesta rodada — o portão de admin para excluir jogo,
// trocar jogadores, renomear, excluir competição e apagar post do feed.
// Não é suíte de regressão das regras antigas (isMember, visitante, etc.).

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'kingbt-rules-test';
const GID = 'grupo1';

const MEMBER_UID = 'membro1';
const ADMIN_UID = 'admin1';
const SUPER_ADMIN_EMAIL = 'joffre.ribeiro@gmail.com';
const SUPER_ADMIN_UID = 'superadmin-nao-e-membro-da-lista-admins';
const OUTSIDER_UID = 'defora1';

let testEnv;

// Estado inicial do grupo e da competição, recriado antes de cada teste via
// setDoc "as admin" (a API de teste ignora as regras — with.withSecurityRulesDisabled).
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'groups', GID), {
      name: 'King BT',
      members: [MEMBER_UID, ADMIN_UID, SUPER_ADMIN_UID],
      admins: [ADMIN_UID],
      visibility: 'privado',
    });
    await setDoc(doc(db, 'groups', GID, 'competitions', 'comp1'), {
      name: 'Rodada de teste',
      format: 'avulso',
      matches: [
        { id: 'm1', stage: 'rotating', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], scoreA: 6, scoreB: 3 },
        { id: 'm2', stage: 'rotating', teamA: ['p1', 'p3'], teamB: ['p2', 'p4'], scoreA: null, scoreB: null },
      ],
      status: 'active',
    });
    await setDoc(doc(db, 'groups', GID, 'feed', 'post1'), {
      type: 'match_result',
      compId: 'comp1',
      matchId: 'm1',
      compName: 'Rodada de teste',
      reactions: {},
      comments: [],
    });
  });
}

function ctxFor(uid, email) {
  return testEnv.authenticatedContext(uid, email ? { email } : undefined);
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8090,
    },
  });

  const results = [];
  async function check(label, promise, expect) {
    try {
      await promise;
      results.push({ label, ok: expect === 'succeed', got: 'succeed' });
    } catch (e) {
      results.push({ label, ok: expect === 'fail', got: 'fail', err: e.message?.split('\n')[0] });
    }
  }

  // ── 1. Excluir um jogo (matches encolhe) ──────────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef); // leitura ainda passa pelas regras normalmente
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'MEMBRO comum não pode excluir um jogo (matches encolhe)',
      updateDoc(compRef, shrunk),
      'fail',
    );
  }
  await seed();
  {
    const adminDb = ctxFor(ADMIN_UID).firestore();
    const compRef = doc(adminDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'ADMIN do grupo pode excluir um jogo',
      updateDoc(compRef, shrunk),
      'succeed',
    );
  }
  await seed();
  {
    const superDb = ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL).firestore();
    const compRef = doc(superDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'SUPER ADMIN (fora da lista admins do grupo) pode excluir um jogo',
      updateDoc(compRef, shrunk),
      'succeed',
    );
  }

  // ── 2. Renomear a competição ───────────────────────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    await check(
      'MEMBRO comum não pode renomear a competição',
      updateDoc(compRef, { ...snap.data(), name: 'Nome trocado' }),
      'fail',
    );
  }
  await seed();
  {
    const adminDb = ctxFor(ADMIN_UID).firestore();
    const compRef = doc(adminDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    await check(
      'ADMIN pode renomear a competição',
      updateDoc(compRef, { ...snap.data(), name: 'Nome trocado' }),
      'succeed',
    );
  }

  // ── 3. Marcar placar de um jogo pendente (matches NÃO encolhe) ────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const scored = {
      ...comp,
      matches: comp.matches.map(m => m.id === 'm2' ? { ...m, scoreA: 6, scoreB: 4 } : m),
    };
    await check(
      'MEMBRO comum pode marcar o placar de um jogo pendente (uso do dia a dia)',
      updateDoc(compRef, scored),
      'succeed',
    );
  }

  // ── 4. Adicionar um jogo novo (matches cresce) ─────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const added = {
      ...comp,
      matches: [...comp.matches, { id: 'm3', stage: 'rotating', teamA: ['p1', 'p4'], teamB: ['p2', 'p3'], scoreA: null, scoreB: null }],
    };
    await check(
      'MEMBRO comum pode adicionar um jogo novo (matches cresce)',
      updateDoc(compRef, added),
      'succeed',
    );
  }

  // ── 5. Excluir a competição inteira ─────────────────────────────────────
  await seed();
  await check(
    'MEMBRO comum não pode excluir a competição inteira',
    deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'fail',
  );
  await seed();
  await check(
    'ADMIN pode excluir a competição inteira',
    deleteDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'succeed',
  );

  // ── 6. Apagar o post do feed ────────────────────────────────────────────
  await seed();
  await check(
    'MEMBRO comum não pode apagar um post do feed',
    deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1')),
    'fail',
  );
  await seed();
  await check(
    'ADMIN pode apagar um post do feed',
    deleteDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'feed', 'post1')),
    'succeed',
  );

  // ── 7. Reagir/comentar no feed continua livre pra qualquer membro ──────
  await seed();
  await check(
    'MEMBRO comum ainda pode reagir/comentar no feed (não é delete)',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      reactions: { '👑': [MEMBER_UID] },
    }),
    'succeed',
  );

  // ── 8. De fora do grupo, nada ───────────────────────────────────────────
  await seed();
  await check(
    'Quem não é membro do grupo não lê a competição',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'fail',
  );

  await testEnv.cleanup();

  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    const mark = r.ok ? 'OK  ' : 'FALHOU';
    console.log(`${mark} — ${r.label}${r.err ? `  (${r.err})` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passaram.`);
  if (failed.length > 0) process.exit(1);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
