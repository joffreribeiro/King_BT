// Testa firestore.rules contra o emulador do Firestore, ANTES de deployar.
// Roda uma vez, contra o emulador local (sem tocar produção): `npm run test:rules`
// (o script sobe o emulador, roda este arquivo, derruba o emulador). Também
// dá pra rodar direto contra um emulador já em pé em 127.0.0.1:8090:
// `node test/firestore.rules.test.mjs`.
//
// Cobre o portão de admin (excluir jogo, trocar jogadores, renomear, excluir
// competição, apagar post do feed), entrada em grupo por código sem vazar
// dados de grupos privados (/groupCodes), autoria de comentário no feed, e
// a subcoleção de placar ao vivo (/liveMatches). Não é suíte de regressão
// completa de todas as regras antigas.

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, Timestamp,
} from 'firebase/firestore';

// Docs de teste para /groupCodes que precisam ser recriados do zero por não
// terem código-base fixo em CODE1/CODE2 (senão o emulador acumula estado
// entre execuções do script e um doc "create" vira "update" na 2ª rodada).
const CODE_NEW = 'CODIGONOVO';

const PROJECT_ID = 'kingbt-rules-test';
const GID = 'grupo1';
const GID2 = 'grupo2'; // grupo separado, pra testar que código/membro de um não vaza no outro

const MEMBER_UID = 'membro1';
const ADMIN_UID = 'admin1';
const SUPER_ADMIN_EMAIL = 'joffre.ribeiro@gmail.com';
const SUPER_ADMIN_UID = 'superadmin-nao-e-membro-da-lista-admins';
const OUTSIDER_UID = 'defora1';

const CODE1 = 'KINGBT1';
const CODE2 = 'KINGBT2';

let testEnv;

// Estado inicial do grupo e da competição, recriado antes de cada teste via
// setDoc "as admin" (a API de teste ignora as regras — with.withSecurityRulesDisabled).
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'groups', GID), {
      name: 'King BT',
      code: CODE1,
      members: [MEMBER_UID, ADMIN_UID, SUPER_ADMIN_UID],
      admins: [ADMIN_UID],
      visibility: 'privado',
    });
    await setDoc(doc(db, 'groupCodes', CODE1), { groupId: GID });
    await setDoc(doc(db, 'groups', GID2), {
      name: 'Outro grupo',
      code: CODE2,
      members: [],
      admins: [OUTSIDER_UID], // dono do grupo2, não tem nada a ver com grupo1
      visibility: 'privado',
    });
    await setDoc(doc(db, 'groupCodes', CODE2), { groupId: GID2 });
    await deleteDoc(doc(db, 'groupCodes', CODE_NEW)).catch(() => {}); // limpa resíduo de execuções anteriores
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
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
      ],
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

  // ── 9. Grupo privado não vaza mais pra fora só por estar logado ────────
  await seed();
  await check(
    'Quem não é membro NÃO lê o doc do grupo privado (código, membros, admins)',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID)),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO lê o doc do próprio grupo normalmente',
    getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID)),
    'succeed',
  );

  // ── 10. /groupCodes resolve código→id sem expor o resto do grupo ───────
  await seed();
  await check(
    'Qualquer autenticado lê /groupCodes (só recebe o id, não os dados do grupo)',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groupCodes', CODE1)),
    'succeed',
  );
  await seed();
  await check(
    'Fluxo de entrar por código: resolve o id via /groupCodes, depois se autoadiciona em members',
    updateDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID), {
      members: arrayUnion(OUTSIDER_UID),
    }),
    'succeed',
  );
  await seed();
  await check(
    'Não-admin não cria /groupCodes apontando pra um grupo que não é dele',
    setDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID2 }),
    'fail',
  );
  await seed();
  await check(
    'Admin do grupo cria /groupCodes apontando pro próprio grupo (fluxo normal de createGroup)',
    setDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID }),
    'succeed',
  );
  await seed();
  await check(
    '/groupCodes não pode ser editado depois de criado',
    updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE1), { groupId: GID2 }),
    'fail',
  );

  // ── 11. Comentário do feed: autoria checada de verdade ──────────────────
  await seed();
  await check(
    'MEMBRO adiciona comentário com o próprio uid',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        { uid: MEMBER_UID, name: 'Membro Um', text: 'De novo!', ts: Timestamp.now() },
      ],
    }),
    'succeed',
  );
  await seed();
  await check(
    'MEMBRO NÃO consegue adicionar comentário assinado com uid de outra pessoa',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        { uid: ADMIN_UID, name: 'Admin', text: 'Forjado!', ts: Timestamp.now() },
      ],
    }),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO apaga o PRÓPRIO comentário',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [],
    }),
    'succeed',
  );
  await seed();
  {
    // Comentário de outra pessoa (admin) além do já existente do membro
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [
          { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
          { uid: ADMIN_UID, name: 'Admin', text: 'Comentário do admin', ts: Timestamp.now() },
        ],
      });
    });
    const snap = await getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'));
    const comments = snap.data().comments; // uma única leitura — filter() e o array final precisam vir da MESMA referência
    await check(
      'MEMBRO NÃO consegue apagar comentário de OUTRO membro',
      updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: comments.filter(c => c.uid !== ADMIN_UID),
      }),
      'fail',
    );
  }
  await seed();
  {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [
          { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        ],
      });
    });
    await check(
      'ADMIN pode apagar comentário de outro membro (moderação)',
      updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [],
      }),
      'succeed',
    );
  }

  // ── 12. Placar ao vivo (/liveMatches) ───────────────────────────────────
  await seed();
  await check(
    'MEMBRO grava placar ao vivo de um jogo da própria competição',
    setDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
      liveScore: { gamesA: 3, gamesB: 2, setsA: 0, setsB: 0, updatedAt: new Date().toISOString(), scorerUid: MEMBER_UID, scorerName: 'Membro Um' },
    }, { merge: true }),
    'succeed',
  );
  await seed();
  await check(
    'MEMBRO lê o placar ao vivo de um jogo da própria competição',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString(), scorerUid: ADMIN_UID, scorerName: 'Admin' },
        });
      });
      await getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'succeed',
  );
  await seed();
  await check(
    'Quem não é membro NÃO grava placar ao vivo',
    setDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
      liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString() },
    }, { merge: true }),
    'fail',
  );
  await seed();
  await check(
    'Quem não é membro NÃO lê o placar ao vivo',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString() },
        });
      });
      await getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO apaga o doc de placar ao vivo (fim de partida)',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 6, gamesB: 4, setsA: 1, setsB: 0, updatedAt: new Date().toISOString() },
        });
      });
      await deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'succeed',
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
