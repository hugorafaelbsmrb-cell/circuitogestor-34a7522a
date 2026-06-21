#!/usr/bin/env node
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
const ALLOWED_COMMANDS = new Set(['vercel']);
function log(msg) { console.error(msg); }
function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) throw new Error(`Command not in whitelist: ${cmd}`);
  try {
    const result = spawnSync(isWindows ? 'where' : 'sh', isWindows ? [cmd] : ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' });
    return result.status === 0;
  } catch { return false; }
}
function getCommandOutput(cmd, args) {
  try {
    const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows });
    return result.status === 0 ? (result.stdout || '').trim() : null;
  } catch { return null; }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function checkVercelInstalled() {
  if (!commandExists('vercel')) { log('Vercel CLI not installed'); process.exit(1); }
}
function checkLoginStatus() {
  try {
    const result = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    const output = (result.stdout || '').trim();
    if (result.status === 0 && output && !output.includes('Error') && !output.includes('not logged in')) {
      log(`Logged in as: ${output}`);
      return true;
    }
  } catch {}
  return false;
}
function main() {
  log('Vercel Login');
  checkVercelInstalled();
  if (checkLoginStatus()) {
    console.log(JSON.stringify({ status: 'already_logged_in' }));
    process.exit(0);
  }
  const tmpDir = path.join(process.cwd(), '.vercel-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const LOG_FILE = path.join(tmpDir, 'login.log');
  const logStream = fs.openSync(LOG_FILE, 'w');
  const child = spawn('vercel', ['login'], { detached: true, stdio: ['ignore', logStream, logStream], shell: isWindows });
  child.unref();
  log(`Background login PID: ${child.pid}`);
  // Wait for auth URL
  async function waitForUrl() {
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        if (fs.existsSync(LOG_FILE)) {
          const content = fs.readFileSync(LOG_FILE, 'utf8');
          const match = content.match(/https:\/\/vercel\.com\/oauth\/device\?user_code=[A-Z0-9-]+(?=\s|$)/);
          if (match) return match[0];
        }
      } catch (e) { if (e.code !== 'ENOENT') log(`Warning: ${e.code || e.message}`); }
    }
    return null;
  }
  waitForUrl().then(url => {
    if (url) {
      log(`Auth URL: ${url}`);
      try { spawnSync('powershell', ['-Command', `Start-Process '${url}'`], { stdio: 'ignore', windowsHide: true }); } catch {}
      console.log(JSON.stringify({ status: 'needs_auth', auth_url: url }));
    } else {
      console.log(JSON.stringify({ status: 'failed', error: 'No auth URL found' }));
    }
  });
}
main();
