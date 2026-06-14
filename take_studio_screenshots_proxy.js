/**
 * Definitive Studio UI screenshot script.
 *
 * Problem solved: The Next.js frontend makes API calls to http://127.0.0.1:8000
 * (the internal Docker address), but Playwright on the host must reach port 8080.
 * We intercept all requests to 127.0.0.1:8000 and proxy them to localhost:8080.
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
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const FRONTEND_URL = 'http://localhost:3010';
const BACKEND_URL_HOST = 'http://localhost:8080';   // host-accessible port
const BACKEND_URL_INTERNAL = 'http://127.0.0.1:8000'; // what the frontend JS uses
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function apiFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  return r.json();
}

async function waitForReady(token, urlPath, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await apiFetch(`${BACKEND_URL_HOST}${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`  poll ${i+1}: ${r.status}`);
    if (r.status === 'ready' || r.status === 'failed') return r;
    await new Promise(s => setTimeout(s, 3000));
  }
  throw new Error(`Timeout on ${urlPath}`);
}

async function main() {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `studio_proxy_${rand}@example.com`;
  const password = 'TestPassword123!';

  console.log('--- SETUP ---');
  await apiFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const loginData = await apiFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = loginData.access_token;
  console.log(`User: ${email} | Token: ${token ? 'OK' : 'FAIL'}`);

  // Create workspace + doc + both outputs
  const ws = await apiFetch(`${BACKEND_URL_HOST}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Studio Outputs Demo' }),
  });
  const wsId = ws.id;
  console.log(`Workspace: ${wsId}`);

  const csvContent = 'Product,Region,Revenue\nAlpha Widget,North,125000\nBeta Gadget,South,87500\nGamma Device,East,203000\nDelta Module,West,156000\n';
  const form = new FormData();
  form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'sales_data.csv');
  const uploadD = await (await fetch(`${BACKEND_URL_HOST}/api/v1/workspaces/${wsId}/documents`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  })).json();
  console.log(`Doc: ${uploadD.id}`);
  await waitForReady(token, `/api/v1/documents/${uploadD.id}/status`);

  const rep = await apiFetch(`${BACKEND_URL_HOST}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'report' }),
  });
  await waitForReady(token, `/api/v1/studio/${rep.id}`);
  console.log('Report ready!');

  const sum = await apiFetch(`${BACKEND_URL_HOST}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'executive_summary' }),
  });
  await waitForReady(token, `/api/v1/studio/${sum.id}`);
  console.log('Summary ready!');

  console.log('\n--- BROWSER (with API proxy) ---');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // INTERCEPT all calls to the internal docker address and reroute to host port
  await page.route(`${BACKEND_URL_INTERNAL}/**`, async (route) => {
    const originalUrl = route.request().url();
    const proxyUrl = originalUrl.replace(BACKEND_URL_INTERNAL, BACKEND_URL_HOST);
    console.log(`  [proxy] ${originalUrl.slice(0, 80)} → ${BACKEND_URL_HOST}`);
    try {
      const body = route.request().postData();
      const headers = { ...route.request().headers() };
      delete headers['host']; // remove original host header
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
      console.error(`  [proxy error] ${err.message}`);
      await route.abort();
    }
  });

  // Navigate to login
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  console.log(`Login page: ${page.url()}`);

  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${FRONTEND_URL}/dashboard*`, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log(`Logged in: ${page.url()}`);

  // Navigate to workspace (workspace list should load after login since proxy is active)
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`Dashboard loaded`);

  // Click our workspace in the sidebar — it shows as "Studio Outputs Demo"
  const wsText = page.getByText('Studio Outputs Demo', { exact: false });
  const wsCount = await wsText.count();
  console.log(`Workspace sidebar entry found: ${wsCount}`);

  if (wsCount > 0) {
    await wsText.first().click();
    await page.waitForTimeout(2000);
  } else {
    console.log('Workspace not found in sidebar. Navigating by URL...');
    await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  // Switch to Studio tab
  await page.getByText('AtlasLM Studio', { exact: true }).click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_list_with_badges.png') });
  console.log('✓ studio_list_with_badges.png');

  // Open a Studio output — click the title or the card
  // Cards have h3 with the title. Let's click the first card's h3 text.
  const reportCard = page.locator('h3').filter({ hasText: /Report/i }).first();
  const reportCardCount = await reportCard.count();
  console.log(`Report card h3 found: ${reportCardCount}`);

  if (reportCardCount > 0) {
    await reportCard.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_with_citations.png') });
    console.log('✓ studio_reader_with_citations.png');

    // Find citation chip buttons — they are <button> elements inside the reader content area
    // with className containing "bg-orange-950/40" and "text-orange-400"
    // First try getting all buttons and logging their text + class
    const allBtns = await page.$$('button');
    console.log(`Total buttons on page: ${allBtns.length}`);

    let chipClicked = false;
    for (const btn of allBtns) {
      const cls = (await btn.getAttribute('class') || '');
      const txt = (await btn.innerText()).trim();
      // Citation chips contain ONLY a short number, e.g. "1", "2", "3"
      // and have orange-related classes
      if (cls.includes('orange') || cls.includes('source')) {
        console.log(`  Found orange btn: "${txt}" | class snippet: ${cls.slice(0, 80)}`);
        await btn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_citation_drawer.png') });
        console.log('✓ studio_citation_drawer.png');
        chipClicked = true;
        break;
      }
    }

    if (!chipClicked) {
      // Take fullpage debug screenshot to see what rendered
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_debug.png'), fullPage: true });
      console.log('✓ studio_reader_debug.png (no chips — saved debug screenshot)');

      // Log first 30 buttons
      console.log('First 30 buttons:');
      for (const btn of allBtns.slice(0, 30)) {
        const t = (await btn.innerText()).trim().slice(0, 50);
        const c = (await btn.getAttribute('class') || '').slice(0, 80);
        console.log(`  "${t}" | ${c}`);
      }
    }
  } else {
    console.log('No report card found. Page content:');
    const content = await page.innerText('body');
    console.log(content.slice(0, 1500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_debug_nocard.png'), fullPage: true });
    console.log('✓ studio_debug_nocard.png');
  }

  await browser.close();
  const saved = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.startsWith('studio_'));
  console.log('\nAll studio screenshots:', saved);
}

main().catch(err => { console.error(err); process.exit(1); });
