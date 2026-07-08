#!/usr/bin/env node
// Driver CDP para o KingBT (Expo web / React Native Web) rodando em localhost:8081.
// Não depende de Playwright — fala diretamente com o Chrome via
// Chrome DevTools Protocol usando o WebSocket nativo do Node 24.
//
// O app exige login real (Firebase Auth) — não há bypass/mock de sessão no
// código hoje. A sessão é persistida no --user-data-dir do driver, então o
// login manual só precisa ser feito UMA VEZ (comando `login`); depois disso
// `shot`/`html` reaproveitam a sessão salva, headless.
//
// Uso:
//   node driver.mjs login                    abre Chrome VISÍVEL para logar manualmente
//   node driver.mjs shot <path> <out.png>     screenshot headless (requer login já feito)
//   node driver.mjs html <path>               HTML renderizado (pós-JS), headless
//
// Requer: Chrome/Edge instalado localmente e o servidor Expo já rodando
// (`npx expo start --web`, ex. em D:\KINGBT).

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const DEBUG_PORT = 9222;
const BASE_URL = process.env.KINGBT_URL ?? 'http://localhost:8081';
// Perfil dedicado do driver — isolado do Chrome pessoal do usuário.
// A sessão do Firebase Auth (localStorage/IndexedDB) fica salva aqui entre execuções.
const USER_DATA_DIR = 'C:/Users/Joffre/AppData/Local/Temp/kingbt-driver-profile';

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('Chrome/Edge não encontrado nos caminhos padrão.');
}

async function isCdpUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForCdp(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isCdpUp(port)) return true;
    await sleep(300);
  }
  throw new Error('CDP não respondeu a tempo — Chrome não iniciou.');
}

function launchChrome({ headless }) {
  const exe = findChrome();
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${USER_DATA_DIR}`,
  ];
  if (headless) args.push('--headless=new', '--disable-gpu');
  args.push('about:blank');
  const proc = spawn(exe, args, { stdio: 'ignore', detached: true });
  proc.unref();
  return proc;
}

// Cliente CDP mínimo: abre uma aba, manda comandos, lê eventos.
async function openCdpSession() {
  // /json/new já devolve o objeto do target com webSocketDebuggerUrl —
  // não precisa de round-trip extra em /json/list.
  const target = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result ?? msg.error);
      pending.delete(msg.id);
    }
  };
  function send(method, params = {}) {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise(resolve => pending.set(id, { resolve }));
  }
  return { ws, send, targetId: target.id };
}

async function navigateAndWait(send, url, waitMs = 10000) {
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(waitMs); // RN Web hidrata via JS + splash animada; sem seletor de "app pronto" — espera fixa.
}

async function screenshot(send, outPath) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
}

async function getHtml(send) {
  const { result } = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
  return result.value;
}

async function ensureChrome({ headless }) {
  if (!(await isCdpUp(DEBUG_PORT))) launchChrome({ headless });
  await waitForCdp(DEBUG_PORT);
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  if (!cmd) {
    console.error('Uso: node driver.mjs login | node driver.mjs shot <path> <out.png> | node driver.mjs html <path>');
    process.exit(1);
  }

  if (cmd === 'login') {
    // Chrome VISÍVEL — o usuário loga manualmente uma vez. A sessão fica
    // salva em USER_DATA_DIR para os comandos headless (shot/html) reusarem.
    await ensureChrome({ headless: false });
    const { send, ws } = await openCdpSession();
    await navigateAndWait(send, new URL('/', BASE_URL).toString(), 2000);
    console.log('Chrome aberto (visível) em', BASE_URL);
    console.log('Faça login manualmente na janela do Chrome. Feche a janela quando terminar.');
    ws.close();
    process.exit(0);
  }

  // shot/html: sessão headless reaproveitando o perfil já logado.
  await ensureChrome({ headless: true });
  const { send, ws } = await openCdpSession();
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

  const url = new URL(arg1 ?? '/', BASE_URL).toString();
  await navigateAndWait(send, url);

  if (cmd === 'shot') {
    await screenshot(send, arg2 ?? 'out.png');
    console.log('Screenshot salvo em', arg2 ?? 'out.png');
  } else if (cmd === 'html') {
    console.log(await getHtml(send));
  } else {
    console.error('Comando desconhecido:', cmd);
    process.exit(1);
  }
  ws.close();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
