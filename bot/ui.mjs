import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import ora from 'ora';
import { createRequire } from 'module';

export const isTTY = !!(process.stdout.isTTY && !process.env.CI);

export const neon   = chalk.hex('#39FF14');
export const cy     = chalk.hex('#00F0FF');
export const warn   = chalk.hex('#FF4444');
export const dm     = chalk.dim;
export const bd     = chalk.bold;

export function getVersion() {
  try {
    const require = createRequire(import.meta.url);
    return require('../package.json').version || '0.0.0';
  } catch { return '0.0.0'; }
}

function clampWidth(str, maxW) {
  return str.split('\n').map(l => l.slice(0, maxW)).join('\n');
}

export function printBanner() {
  if (!isTTY) return;

  const cols = process.stdout.columns || 80;
  const w = Math.min(cols, 72);

  const patternUnit = '░▒▓█▓▒░';
  const strip = patternUnit.repeat(Math.ceil(w / patternUnit.length)).slice(0, w);
  console.log('');
  console.log(cy(strip));
  console.log('');

  let ascii;
  try {
    ascii = figlet.textSync('SIGNALBOT', { font: 'ANSI Shadow', horizontalLayout: 'fitted' });
  } catch {
    ascii = figlet.textSync('SIGNALBOT', { horizontalLayout: 'fitted' });
  }
  ascii = clampWidth(ascii, w);

  const grad = gradient(['#FF4444', '#00F0FF', '#39FF14']);
  console.log(grad.multiline(ascii));
  console.log('');

  const subtitle = 'Your Automated Hyperliquid Trader';
  const ver = `v${getVersion()}`;
  const padSub = Math.max(0, Math.floor((w - subtitle.length) / 2));
  const padVer = Math.max(0, Math.floor((w - ver.length) / 2));
  console.log(' '.repeat(padSub) + bd(subtitle));
  console.log(' '.repeat(padVer) + dm(ver));
  console.log('');
  console.log(cy(strip));
  console.log('');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function systemChecks() {
  if (!isTTY) {
    console.log('[boot] running system checks...');
    return;
  }

  const checks = [
    'Loading strategy engine',
    'Connecting to Hyperliquid',
    'Syncing funding rates',
    'Validating wallet config',
    'Risk engine armed',
  ];

  const delays = [400, 600, 350, 300, 250];

  for (let i = 0; i < checks.length; i++) {
    const spinner = ora({ text: dm(checks[i] + '...'), color: 'cyan', spinner: 'dots' }).start();
    await sleep(delays[i]);
    spinner.succeed(neon(checks[i]));
  }
  console.log('');
}

export function stepHeader(num, total, title) {
  console.log('');
  console.log(bd(neon(`  ┌─ Step ${num}/${total} ── ${title}`)));
  console.log(neon('  │'));
}

export function stepFooter() {
  console.log(neon('  └──────────────────────────────────────'));
}

export function ok(msg) {
  console.log(neon('  │  ✓ ') + chalk.green(msg));
}

export function info(msg) {
  console.log(dm('  │  ' + msg));
}

export function line(msg) {
  console.log('  │  ' + msg);
}

export function blank() {
  console.log(neon('  │'));
}

export function warning(msg) {
  console.log(chalk.yellow('  │  ⚠ ' + msg));
}

export function fail(msg) {
  console.log(warn('  │  ✗ ' + msg));
}

export function prompt(msg) {
  return neon('  │  ') + msg;
}
