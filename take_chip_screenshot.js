/**
 * Targeted: just capture the citation drawer by clicking a chip (not the Back button).
 * Reuses workspace: f7682580-3a4a-430d-a8ec-2d45ec40e220
 * User: studio_proxy_573934@example.com / TestPassword123!
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const envLines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const clean = line.trim();
  if (clean && !clean.startsWith('#') && clean.includes('=')) {
    const idx = clean.indexOf('=');
    const key = clean.slice(0, idx).trim();
    let val = clean.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
  }
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const FRONTEND_URL = 'http://localhost:3010';
const BACKEND_URL_HOST = 'http://localhost:8080';
const BACKEND_URL_INTERNAL = 'http://127.0.0.1:8000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Reuse the workspace + user created in the previous run
const WS_ID = 'f7682580-3a4a-430d-a8ec-2d45ec40e220';
const EMAIL = 'studio_proxy_573934@example.com';
const PASSWORD = 'TestPassword123!';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Proxy all calls from internal docker URL to host port
  await page.route(`${BACKEND_URL_INTERNAL}/**`, async (route) => {
    const proxyUrl = route.request().url().replace(BACKEND_URL_INTERNAL, BACKEND_URL_HOST);
    try {
      const body = route.request().postData();
      const headers = { ...route.request().headers() };
      delete headers['host'];
      const response = await fetch(proxyUrl, {
        method: route.request().method(),
        headers,
        body: body || undefined,
      });
      const responseBody = await response.arrayBuffer();
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: Buffer.from(responseBody),
      });
    } catch (err) {
      await route.abort();
    }
  });

  // Login
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${FRONTEND_URL}/dashboard*`, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log(`Logged in: ${page.url()}`);

  // Click the workspace in sidebar
  const wsEntry = page.getByText('Studio Outputs Demo', { exact: false });
  if (await wsEntry.count() > 0) {
    await wsEntry.first().click();
    await page.waitForTimeout(2000);
  }

  // Switch to Studio tab
  await page.getByText('AtlasLM Studio', { exact: true }).click();
  await page.waitForTimeout(2000);

  // Click the Report card title to open reader
  await page.locator('h3').filter({ hasText: /Report/i }).first().click();
  await page.waitForTimeout(2500);
  console.log('Reader open.');

  // Now find the citation chips — they are <button> elements with:
  //   - bg-orange-950/40 in their class
  //   - Short numeric text like "1"
  // The "Back to Studio outputs" button has text-orange-500 NOT bg-orange-950
  // So filter: cls must contain "bg-orange-950" OR "select-none"
  const allBtns = await page.$$('button');
  console.log(`Total buttons: ${allBtns.length}`);

  let chipClicked = false;
  for (const btn of allBtns) {
    const cls = (await btn.getAttribute('class') || '');
    const txt = (await btn.innerText()).trim();
    // Citation chips have bg-orange-950 class and short numeric text
    if (cls.includes('bg-orange-950') && /^\d+$/.test(txt)) {
      console.log(`Citation chip found: "${txt}" | class: ${cls.slice(0, 100)}`);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_citation_drawer_correct.png') });
      console.log('✓ studio_citation_drawer_correct.png');
      chipClicked = true;
      break;
    }
  }

  if (!chipClicked) {
    console.log('No bg-orange-950 chip found. Dumping all button info:');
    for (const btn of allBtns) {
      const t = (await btn.innerText()).trim().slice(0, 40);
      const c = (await btn.getAttribute('class') || '').slice(0, 120);
      console.log(`  "${t}" | ${c}`);
    }
    // Take the reader screenshot to confirm chips are visible
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_chip_debug.png'), fullPage: true });
    console.log('✓ studio_reader_chip_debug.png (full page debug)');
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
