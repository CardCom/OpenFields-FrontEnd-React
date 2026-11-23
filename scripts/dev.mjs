#!/usr/bin/env node
// Starts the backend and the checkout page against one CardCom environment:
//   npm run dev                      -> CARDCOM_ENV or billgold
//   npm run dev -- --env=local       -> .env.local
//   npm run dev:prod                 -> .env.prod
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, DEFAULT_ENV, loadEnvironment, processEnv } from './env.mjs';

const arg = process.argv.slice(2).find((a) => a.startsWith('--env='));
const name = arg ? arg.slice('--env='.length) : process.env.CARDCOM_ENV || DEFAULT_ENV;

let env;
try {
  env = loadEnvironment(name);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const vars = processEnv(env);

// Internal environments (billgold, local IIS) use certificates of the company CA, which Node only
// trusts from the OS store with --use-system-ca (Node >= 22.15).
const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --use-system-ca`.trim();

console.log(
  `\nOpenFieldsTester -> ${env.name}  ${env.host}  terminal ${env.terminalNumber}  amount ${env.amount}\n` +
    `  checkout : ${env.frontendUrl}\n  backend  : ${env.serverUrl}\n`,
);

// Run npm's own JS entry with this node (set by `npm run`): no shell, no .cmd shim on Windows.
const npmCli = process.env.npm_execpath?.endsWith('.js') ? process.env.npm_execpath : null;
const children = [
  ['server', vars.server, ['run', 'dev', '-w', 'server'], '\x1b[34m'],
  ['web   ', vars.web, ['run', 'dev', '-w', 'apps/web'], '\x1b[32m'],
].map(([label, extra, npmArgs, color]) => {
  const [cmd, cmdArgs] = npmCli ? [process.execPath, [npmCli, ...npmArgs]] : ['npm', npmArgs];
  const child = spawn(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...extra, NODE_OPTIONS: nodeOptions, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: !npmCli && process.platform === 'win32',
  });
  const prefix = `${color}[${label}]\x1b[0m `;
  const relay = (stream) => (chunk) =>
    stream.write(
      chunk
        .toString()
        .split(/\r?\n/)
        .filter((l, i, a) => l || i < a.length - 1)
        .map((l) => prefix + l)
        .join('\n') + '\n',
    );
  child.stdout.on('data', relay(process.stdout));
  child.stderr.on('data', relay(process.stderr));
  child.on('exit', (code) => {
    console.log(`${prefix}exited (${code})`);
    stop(code ?? 1);
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
