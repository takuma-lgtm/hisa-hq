#!/usr/bin/env node
/**
 * Take a screenshot of the local CRM dev server (with auto-login).
 *
 * Usage:
 *   node scripts/screenshot.mjs [path] [--width=1440] [--height=900] [--out=screenshot.png] [--full]
 *
 * Examples:
 *   node scripts/screenshot.mjs                      # screenshots /
 *   node scripts/screenshot.mjs /leads               # screenshots /leads
 *   node scripts/screenshot.mjs /opportunities --full # full-page scroll capture
 *   node scripts/screenshot.mjs / --width=375 --height=812 --out=mobile.png  # mobile viewport
 *
 * Auth:
 *   Logs in via the login form. Default: takuma@hisamatcha.com / HisaMatcha2025!
 *   Override with --email=... --password=...
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=');
    flags[key] = rest.join('=') || 'true';
  } else {
    positional.push(arg);
  }
}

const pagePath = positional[0] || '/';
const width = parseInt(flags.width || '1440', 10);
const height = parseInt(flags.height || '900', 10);
const fullPage = flags.full === 'true';
const outFile = flags.out || 'screenshot.png';
const baseUrl = flags.url || 'http://localhost:3000';
const email = flags.email || 'takuma@hisamatcha.com';
const password = flags.password || 'HisaMatcha2025!';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Navigate to the target page — if redirected to login, authenticate
  const target = `${baseUrl}${pagePath}`;
  console.log(`Navigating to ${target} (${width}x${height})...`);

  await page.goto(target, { waitUntil: 'networkidle', timeout: 15000 });

  // Check if we landed on the login page
  if (page.url().includes('/login')) {
    console.log(`Redirected to login. Signing in as ${email}...`);

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation away from login
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 });
    console.log('Logged in successfully.');

    // Now navigate to the actual target if we were redirected elsewhere
    if (!page.url().endsWith(pagePath) && pagePath !== '/') {
      await page.goto(target, { waitUntil: 'networkidle', timeout: 15000 });
    } else {
      await page.waitForLoadState('networkidle');
    }
  }

  // Wait for hydration and animations
  await page.waitForTimeout(1000);

  await page.screenshot({ path: outFile, fullPage });
  console.log(`Screenshot saved to ${outFile}`);

  await browser.close();
}

takeScreenshot().catch((err) => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
