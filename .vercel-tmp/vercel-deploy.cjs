#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
const ALLOWED_COMMANDS = new Set(['vercel', 'npm', 'pnpm', 'yarn']);
function log(msg) { console.error(msg); }
function checkVercelInstalled() {
  try {
    const result = spawnSync('vercel', ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    if (result.status !== 0) { log('Vercel CLI not installed'); process.exit(1); }
    log(`Vercel CLI: ${(result.stdout || '').trim()}`);
  } catch { log('Vercel CLI not installed'); process.exit(1); }
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
  log('========================================');
  log('Vercel Deploy');
  log('========================================');
  checkVercelInstalled();
  if (!checkLoginStatus()) { log('Not logged in'); process.exit(1); }
  const projectPath = process.cwd();
  log(`Project: ${projectPath}`);
  // Deploy with --prod and --yes
  const args = ['--prod', '--yes'];
  log('Deploying to production...');
  try {
    const result = spawnSync('vercel', args, {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 300000,
      shell: isWindows
    });
    const output = (result.stdout || '') + (result.stderr || '');
    log(output);
    if (result.status !== 0) throw new Error('Deploy failed');
    const aliasedMatch = output.match(/Aliased:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const deploymentMatch = output.match(/Production:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const finalUrl = aliasedMatch ? aliasedMatch[1] : (deploymentMatch ? deploymentMatch[1] : null);
    if (finalUrl) {
      log(`Deployed: ${finalUrl}`);
      console.log(JSON.stringify({ status: 'success', url: finalUrl }));
    } else {
      console.log(JSON.stringify({ status: 'success', message: 'Deploy complete' }));
    }
  } catch (e) {
    log(`Error: ${e.message}`);
    process.exit(1);
  }
}
main();
