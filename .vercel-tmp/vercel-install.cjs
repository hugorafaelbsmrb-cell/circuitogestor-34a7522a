#!/usr/bin/env node
const { spawnSync } = require('child_process');
const os = require('os');
const isWindows = os.platform() === 'win32';
const ALLOWED_COMMANDS = new Set(['node', 'npm', 'pnpm', 'yarn', 'vercel']);
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
function detectPackageManager() {
  if (commandExists('pnpm')) return 'pnpm';
  if (commandExists('yarn')) return 'yarn';
  if (commandExists('npm')) return 'npm';
  return null;
}
function installVercel(pkgManager) {
  log(`Installing Vercel CLI using ${pkgManager}...`);
  const commands = {
    pnpm: ['pnpm', ['add', '-g', 'vercel']],
    yarn: ['yarn', ['global', 'add', 'vercel']],
    npm: ['npm', ['install', '-g', 'vercel']]
  };
  const entry = commands[pkgManager];
  const result = spawnSync(entry[0], entry[1], { stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) throw new Error(`Exit code: ${result.status}`);
}
function main() {
  log('========================================');
  log('Vercel CLI Installation');
  log('========================================');
  if (commandExists('vercel')) {
    log(`Vercel CLI already installed: ${getCommandOutput('vercel', ['--version']) || 'unknown'}`);
    console.log(JSON.stringify({ status: 'already_installed' }));
    process.exit(0);
  }
  const pkgManager = detectPackageManager();
  if (!pkgManager) { log('No package manager found'); process.exit(1); }
  installVercel(pkgManager);
  if (commandExists('vercel')) {
    console.log(JSON.stringify({ status: 'success' }));
  } else {
    log('Install failed'); process.exit(1);
  }
}
main();
