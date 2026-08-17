#!/usr/bin/env node
/**
 * Cross-platform starter. Boots the orchestrator API, waits for /health,
 * then starts the Tauri desktop if cargo/rustc is on PATH.
 * Does not pull models (and never the 27B).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HEALTH_URL = 'http://127.0.0.1:8787/health';
const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_INTERVAL_MS = 500;
const isWin = process.platform === 'win32';

const children = [];
let shuttingDown = false;

function hasBin(name) {
  const probe = isWin ? 'where' : 'which';
  const r = spawnSync(probe, [name], { stdio: 'ignore', shell: isWin });
  return r.status === 0;
}

function spawnInherit(command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
    windowsHide: false,
  });
  children.push(child);
  child.on('error', (err) => {
    console.error('Failed to start ' + command + ': ' + err.message);
  });
  return child;
}

function killChild(child) {
  if (!child || child.killed || child.exitCode != null) return;
  try {
    if (isWin && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    try { child.kill(); } catch { /* ignore */ }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killChild(child);
  const t = setTimeout(() => process.exit(code), 400);
  t.unref?.();
}

function onSignal() {
  console.log('\nShutting down...');
  shutdown(0);
}

process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);
process.on('SIGBREAK', onSignal);
process.on('SIGHUP', onSignal);

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.ok === true || res.status === 200) return true;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  return false;
}

if (!existsSync(join(ROOT, '.env.example'))) {
  console.error('ERROR: Not in the Vrac repo (missing .env.example).');
  process.exit(1);
}

const PM = 'pnpm';
const FILTER = '--filter';

console.log('Starting API (' + PM + ' ' + FILTER + ' @grokbot/orchestrator start)');
const api = spawnInherit(PM, [FILTER, '@grokbot/orchestrator', 'start']);
api.on('exit', (code) => {
  if (shuttingDown) return;
  if (code) {
    console.error('ERROR: Orchestrator exited with code ' + code);
    shutdown(code);
  } else {
    shutdown(0);
  }
});

console.log('Waiting for ' + HEALTH_URL + ' (up to ' + HEALTH_TIMEOUT_MS / 1000 + 's)...');
const healthy = await waitForHealth();
if (!healthy) {
  console.error('ERROR: API did not become healthy at ' + HEALTH_URL + ' within ' + HEALTH_TIMEOUT_MS / 1000 + 's.');
  console.error('Check the orchestrator logs above. Typical causes: missing deps, port 8787 in use.');
  shutdown(1);
  process.exit(1);
}

console.log('API is up at ' + HEALTH_URL);

if (hasBin('cargo') || hasBin('rustc')) {
  console.log('Rust found — starting desktop (' + PM + ' ' + FILTER + ' @grokbot/desktop dev)');
  const desktop = spawnInherit(PM, [FILTER, '@grokbot/desktop', 'dev']);
  desktop.on('exit', (code) => {
    if (shuttingDown) return;
    if (code) {
      console.error('Desktop exited with code ' + code + '. API is still running at http://127.0.0.1:8787');
    }
  });
} else {
  console.log('');
  console.log('Desktop skipped (Rust/cargo not on PATH).');
  console.log('  API:  http://127.0.0.1:8787');
  console.log('  Later, install Rust (https://rustup.rs) then:');
  console.log('    ' + PM + ' ' + FILTER + ' @grokbot/desktop dev');
  console.log('  On Windows, Tauri also needs WebView2 and the MSVC C++ tools:');
  console.log('    https://v2.tauri.app/start/prerequisites/');
}

await new Promise(() => {});
