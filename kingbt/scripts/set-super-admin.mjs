// Define (ou remove) a custom claim `superAdmin` de UMA conta, para as regras do Firestore
// (firestore.rules → isSuperAdmin) reconhecerem o super admin pela claim em vez do e-mail.
//
// SIMULA por padrão: só mostra o que faria. Para gravar de verdade: --apply
//   node scripts/set-super-admin.mjs joffre.ribeiro@gmail.com                    -> simulação
//   node scripts/set-super-admin.mjs joffre.ribeiro@gmail.com --apply            -> grava a claim
//   node scripts/set-super-admin.mjs joffre.ribeiro@gmail.com --revoke --apply   -> remove a claim
//
// A claim só chega ao app no próximo token: a pessoa precisa sair e entrar de novo (ou esperar até ~1 hora).
// Exige o login do gcloud (scripts/README.md). Só concede a contas com e-mail verificado.
import { getAuth } from 'firebase-admin/auth';
import { initAdmin, PROJECT_ID } from './_admin.mjs';

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const apply = args.includes('--apply');
const revoke = args.includes('--revoke');
if (!email) { console.error('Uso: node scripts/set-super-admin.mjs <email> [--revoke] [--apply]'); process.exit(1); }

await initAdmin();
const auth = getAuth();
const user = await auth.getUserByEmail(email);
if (!revoke && !user.emailVerified) {
  console.error(`${email}: o e-mail NÃO está verificado. Verifique a conta antes de conceder a claim.`);
  process.exit(1);
}

const atuais = user.customClaims ?? {};
const novas = { ...atuais };
if (revoke) delete novas.superAdmin; else novas.superAdmin = true;

console.log(`Projeto: ${PROJECT_ID}`);
console.log(`Conta:   ${email} (uid ${user.uid})`);
console.log(`Claims agora:  ${JSON.stringify(atuais)}`);
console.log(`Claims depois: ${JSON.stringify(novas)}`);
if (JSON.stringify(atuais) === JSON.stringify(novas)) { console.log('Nada a mudar.'); process.exit(0); }
if (!apply) { console.log('SIMULAÇÃO. Rode de novo com --apply para gravar.'); process.exit(0); }

await auth.setCustomUserClaims(user.uid, novas);
console.log('Pronto. A pessoa precisa sair e entrar de novo no app para receber a claim.');
process.exit(0);
