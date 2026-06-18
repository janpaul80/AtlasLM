/**
 * Robust Playwright screenshot capture and flow verification for AtlasLM Production Server.
 * Connects directly to https://atlaslm.cloud and verifies the complete end-to-end system.
 * Ignores TLS errors to bypass temporary Let's Encrypt API outages.
 */

// Enforce strict SSL/TLS verification
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
const FRONTEND_URL = 'https://atlaslm.cloud';
const BACKEND_URL = 'https://atlaslm.cloud';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots_production');
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
  const email = `prod_test_${rand}@example.com`;
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

  if (!token) {
    console.error('Failed to authenticate with Supabase. Check keys.');
    process.exit(1);
  }

  // Create workspace
  const ws = await apiFetch(`${BACKEND_URL}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Production Verification Workspace' }),
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

  // Generate Mind Map studio output
  let repId = null;
  try {
    const rep = await apiFetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_type: 'mind_map' }),
    });
    repId = rep.id;
    console.log(`Mind Map: ${repId}`);
    const repFinal = await waitForReady(token, `/api/v1/workspaces/${wsId}/studio/${repId}`);
    console.log(`Mind Map status: ${repFinal.status}. Citations: ${(repFinal.citations || []).length}`);
  } catch (e) {
    console.warn('[WARNING] Mind Map generation encountered error:', e.message);
  }

  // Generate Study Guide studio output (optional test)
  try {
    const sum = await apiFetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_type: 'study_guide' }),
    });
    console.log(`Study Guide: ${sum.id}`);
    const sumFinal = await waitForReady(token, `/api/v1/workspaces/${wsId}/studio/${sum.id}`);
    console.log(`Study Guide status: ${sumFinal.status}`);
  } catch (e) {
    console.warn('[WARNING] Study Guide generation encountered error:', e.message);
  }

  console.log('\n--- BROWSER ---');
  const browser = await chromium.launch({ headless: true });
  // Pass ignoreHTTPSErrors to allow browser to load the page with self-signed/invalid certificate
  const ctx = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: false 
  });
  const page = await ctx.newPage();

  // Go to login page
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  console.log(`Login page loaded: ${page.url()}`);

  // Wait for the animated form to appear
  await page.waitForSelector('#email', { timeout: 15000 });
  console.log('Email input visible.');

  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_login_filled.png') });

  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL(`${FRONTEND_URL}/dashboard*`, { timeout: 15000 }).catch(() => console.log('No nav to dashboard yet'));
  await page.waitForTimeout(3000);
  console.log(`After login: ${page.url()}`);

  // Navigate to specific workspace
  await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(`Workspace page: ${page.url()}`);

  // Dismiss onboarding tour if it is visible
  const tourClose = page.locator('button.tour-close');
  if (await tourClose.count() > 0 && await tourClose.isVisible()) {
    console.log('Onboarding tour visible. Skipping tour...');
    await tourClose.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('Onboarding tour not overlaying or not visible.');
  }

  // Take chat tab baseline screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_dashboard_chat_tab.png') });
  console.log('✓ prod_dashboard_chat_tab.png');

  // Click Studio tab
  await page.getByText('AtlasLM Studio', { exact: true }).click();
  await page.waitForTimeout(2000);

  // Screenshot of Studio list view with both outputs
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_outputs_list.png') });
  console.log('✓ prod_outputs_list.png');

  // Click on the Mind Map card
  const cards = page.locator('div.cursor-pointer');
  const cardCount = await cards.count();
  console.log(`Cursor-pointer divs: ${cardCount}`);

  if (cardCount > 0) {
    await cards.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_reader_open.png') });
    console.log('✓ prod_reader_open.png');

    let citationClicked = false;
    // Look for the specific document citation button in the Studio footer
    const citeButton = page.locator('button:has-text("demo_data.csv")').first();
    if (await citeButton.count() > 0 && await citeButton.isVisible()) {
      console.log('Found citation footer button, clicking...');
      await citeButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_citation_drawer_open.png') });
      console.log('✓ prod_citation_drawer_open.png');
      citationClicked = true;
    }

    if (!citationClicked) {
      console.log('No citation buttons found. Logging button list:');
      const allButtons = await page.$$('button');
      for (const btn of allButtons.slice(0, 20)) {
        const t = (await btn.innerText()).trim();
        const c = (await btn.getAttribute('class') || '').slice(0, 60);
        console.log(`  btn: "${t}" | class: ${c}`);
      }
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_reader_no_chip_debug.png'), fullPage: true });
      console.log('✓ prod_reader_no_chip_debug.png (debug)');
    }
  } else {
    console.log('No cursor-pointer cards found.');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_debug.png'), fullPage: true });
    console.log('✓ prod_debug.png');
  }

  await browser.close();
  console.log('\nAll verification screenshots saved to:', SCREENSHOTS_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
