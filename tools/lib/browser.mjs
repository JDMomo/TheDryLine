/* Shared Playwright bootstrap for QA/art tools.
   Normal local development uses the repository's Playwright dependency. The original Linux agent can still use its shared install and system Chrome. */
import { createRequire } from 'module';
import { existsSync } from 'fs';

const localRequire = createRequire(import.meta.url);
let playwright;
try {
  playwright = localRequire('playwright');
} catch (localError) {
  const shared = '/opt/npm-tools/node_modules/playwright';
  if (process.platform === 'linux' && existsSync(shared)) playwright = createRequire('/opt/npm-tools/node_modules/')('playwright');
  else {
    const err = new Error('Playwright is required for Dry Line tools. Run "npm install" in the repository root.');
    err.cause = localError;
    throw err;
  }
}

export const { chromium } = playwright;

export function launchBrowser(options = {}) {
  const args = [
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    '--no-first-run',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-component-update',
    ...(options.args || [])
  ];
  const linuxChrome = '/usr/bin/google-chrome';
  const executablePath = process.env.DRYLINE_CHROME ||
    (process.platform === 'linux' && existsSync(linuxChrome) ? linuxChrome : undefined);
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
    args
  });
}
