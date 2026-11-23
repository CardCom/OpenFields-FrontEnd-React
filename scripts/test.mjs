#!/usr/bin/env node
// npm test [-- --env=<name>] [other Playwright args]: runs the e2e specs against .env.<name>.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { DEFAULT_ENV } from './env.mjs';

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith('--env='));
const name = envArg ? envArg.slice('--env='.length) : process.env.CARDCOM_ENV || DEFAULT_ENV;
const rest = args.filter((a) => a !== envArg);
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --use-system-ca`.trim();
const result = spawnSync(process.execPath, [cli, 'test', ...rest], {
  stdio: 'inherit',
  env: { ...process.env, CARDCOM_ENV: name, NODE_OPTIONS: nodeOptions },
});
process.exit(result.status ?? 1);
