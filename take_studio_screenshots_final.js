/**
 * Robust Playwright screenshot capture for AtlasLM Studio UI.
 * Handles animation delay on login page, uses explicit waitForSelector.
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
const BACKEND_URL = 'http://localhost:8080';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function apiFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  return r.json();
}

async function waitForReady(token, urlPath, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await apiFetch(`${BACKEND_URL}${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`  poll ${i+1}: ${r.status}`);
    if (r.status === 'ready' || r.status === 'failed') return r;
    await new Promise(s => setTimeout(s, 3000));
  }
  throw new Error(`Timeout waiting for ${urlPath}`);
}

async function main() {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `studio_final_${rand}@example.com`;
  const password = 'TestPassword123!';

  console.log('--- SETUP ---');
  // Create user
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

  // Create workspace
  const ws = await apiFetch(`${BACKEND_URL}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Studio Demo Workspace' }),
  });
  const wsId = ws.id;
  console.log(`Workspace: ${wsId}`);

  // Upload CSV
  const csvContent = 'Item ID,Description,Value\nItem-A,Alpha item,100\nItem-B,Beta item,200\nItem-C,Gamma item,300\nItem-D,Delta item,400\nItem-E,Epsilon item,500\n';
  const form = new FormData();
  form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'demo_data.csv');
  const uploadR = await fetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploadD = await uploadR.json();
  console.log(`Doc: ${uploadD.id}`);
  await waitForReady(token, `/api/v1/documents/${uploadD.id}/status`);

  // Generate both studio outputs
  const rep = await apiFetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'report' }),
  });
  console.log(`Report: ${rep.id}`);
  const repFinal = await waitForReady(token, `/api/v1/studio/${rep.id}`);
  console.log(`Report ready. Citations: ${(repFinal.citations || []).length}`);

  const sum = await apiFetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'executive_summary' }),
  });
  console.log(`Summary: ${sum.id}`);
  await waitForReady(token, `/api/v1/studio/${sum.id}`);
  console.log('Summary ready!');

  console.log('\n--- BROWSER ---');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Go to login page
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  console.log(`Login page loaded: ${page.url()}`);

  // Wait for the animated form to appear (Framer Motion animates in)
  await page.waitForSelector('#email', { timeout: 15000 });
  console.log('Email input visible.');

  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_login_filled.png') });

  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL(`${FRONTEND_URL}/dashboard*`, { timeout: 15000 }).catch(() => console.log('No nav to dashboard yet'));
  await page.waitForTimeout(3000);
  console.log(`After login: ${page.url()}`);

  // Navigate to specific workspace
  await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(`Workspace page: ${page.url()}`);

  // Take chat tab baseline screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_dashboard_chat_tab.png') });
  console.log('✓ studio_dashboard_chat_tab.png');

  // Click Studio tab — button text is "AtlasLM Studio"
  await page.getByText('AtlasLM Studio', { exact: true }).click();
  await page.waitForTimeout(2000);

  // Screenshot of Studio list view with both outputs
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_outputs_list.png') });
  console.log('✓ studio_outputs_list.png');

  // Click on the Report card (first "Ready" text, which is inside a clickable card)
  // The card is a div with "cursor-pointer". We click the card containing "Ready" text.
  const cards = page.locator('div.cursor-pointer');
  const cardCount = await cards.count();
  console.log(`Cursor-pointer divs: ${cardCount}`);

  if (cardCount > 0) {
    await cards.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_open.png') });
    console.log('✓ studio_reader_open.png');

    // Look for citation chip buttons — they have specific inline styling
    // Their className includes "bg-orange-950/40" and "text-orange-400"
    // In the rendered HTML they'll appear as <button> with those classes
    const allButtons = await page.$$('button');
    console.log(`Total buttons: ${allButtons.length}`);

    // Get button texts to find citation chips (short numeric text like "1", "2")
    let citationClicked = false;
    for (const btn of allButtons) {
      const text = (await btn.innerText()).trim();
      const cls = (await btn.getAttribute('class')) || '';
      if (cls.includes('orange') && text.length <= 3 && /^\d+$/.test(text)) {
        console.log(`Found citation chip: "${text}", clicking...`);
        await btn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_citation_drawer_open.png') });
        console.log('✓ studio_citation_drawer_open.png');
        citationClicked = true;
        break;
      }
    }

    if (!citationClicked) {
      console.log('No citation chips found. Logging button list:');
      for (const btn of allButtons.slice(0, 20)) {
        const t = (await btn.innerText()).trim();
        const c = (await btn.getAttribute('class') || '').slice(0, 60);
        console.log(`  btn: "${t}" | class: ${c}`);
      }
      // Take a fullpage screenshot anyway to debug
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_no_chip_debug.png'), fullPage: true });
      console.log('✓ studio_reader_no_chip_debug.png (debug)');
    }
  } else {
    console.log('No cursor-pointer cards found. Current page state:');
    const bodyText = await page.innerText('body');
    console.log(bodyText.slice(0, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_debug.png'), fullPage: true });
    console.log('✓ studio_debug.png');
  }

  await browser.close();
  console.log('\nAll screenshots saved to:', SCREENSHOTS_DIR);
  // List what was saved
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.startsWith('studio_'));
  console.log('Studio screenshots:', files);
}

main().catch(err => { console.error(err); process.exit(1); });
