/**
 * Targeted Playwright screenshot for Studio reader view and citation drawer.
 * Uses already-existing workspace with Report + Executive Summary.
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
    let key = clean.slice(0, idx).trim();
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

// Use the workspace created by the first script run
const TARGET_WS_ID = '994c3c1c-76da-4566-910b-47d7324b6b6e';

async function main() {
  // Create a fresh test user so we can log in cleanly
  const rand = Math.floor(Math.random() * 1000000);
  const email = `studio_shots2_${rand}@example.com`;
  const password = 'TestPassword123!';

  console.log('0. Creating fresh test user...');
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const loginResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await loginResp.json();
  const token = session.access_token;
  console.log(`   Token acquired: ${token ? 'yes' : 'NO'}`);

  // Create their own workspace + outputs so it appears on their dashboard
  console.log('1. Creating workspace + CSV document...');
  const wsRes = await fetch(`${BACKEND_URL}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Studio Screenshot Workspace' }),
  });
  const ws = await wsRes.json();
  const wsId = ws.id;
  console.log(`   WS: ${wsId}`);

  const csvContent = 'Item ID,Description,Value\nItem-A,Alpha item,100\nItem-B,Beta item,200\nItem-C,Gamma item,300\nItem-D,Delta item,400\nItem-E,Epsilon item,500\n';
  const formData = new FormData();
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'items.csv');
  const upRes = await fetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const docData = await upRes.json();
  console.log(`   Doc: ${docData.id} status=${docData.status}`);

  // Wait for doc ready
  let docStatus = docData.status;
  while (docStatus !== 'ready' && docStatus !== 'failed') {
    await new Promise(r => setTimeout(r, 2000));
    const s = await (await fetch(`${BACKEND_URL}/api/v1/documents/${docData.id}/status`, { headers: { Authorization: `Bearer ${token}` } })).json();
    docStatus = s.status;
    console.log(`   → doc status: ${docStatus}`);
  }

  // Generate Report
  console.log('2. Generating Report...');
  const repRes = await (await fetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'report' }),
  })).json();
  const repId = repRes.id;
  let repStatus = repRes.status;
  while (repStatus !== 'ready' && repStatus !== 'failed') {
    await new Promise(r => setTimeout(r, 3000));
    const r = await (await fetch(`${BACKEND_URL}/api/v1/studio/${repId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    repStatus = r.status;
    console.log(`   → report: ${repStatus}`);
  }
  console.log('   Report ready!');

  // Generate Executive Summary
  console.log('3. Generating Executive Summary...');
  const sumRes = await (await fetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/studio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ output_type: 'executive_summary' }),
  })).json();
  const sumId = sumRes.id;
  let sumStatus = sumRes.status;
  while (sumStatus !== 'ready' && sumStatus !== 'failed') {
    await new Promise(r => setTimeout(r, 3000));
    const r = await (await fetch(`${BACKEND_URL}/api/v1/studio/${sumId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    sumStatus = r.status;
    console.log(`   → summary: ${sumStatus}`);
  }
  console.log('   Summary ready!');

  // Browser
  console.log('4. Opening browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(FRONTEND_URL);
  await page.waitForTimeout(1500);

  // Login via form
  console.log('5. Logging in via form...');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log(`   URL: ${page.url()}`);

  // Navigate to workspace
  await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`);
  await page.waitForTimeout(3000);
  console.log(`   Dashboard URL: ${page.url()}`);

  // Click Studio tab
  console.log('6. Clicking Studio tab...');
  const studioTab = page.getByText('AtlasLM Studio', { exact: true });
  await studioTab.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_panel_list.png') });
  console.log('   ✓ Saved: studio_panel_list.png');

  // Click the first "Ready" card label to open reader
  console.log('7. Opening reader view...');
  // Cards display "Ready" text in the bottom-left of each card
  const readySpan = page.locator('text=Ready').first();
  const readySpanCount = await readySpan.count();
  console.log(`   Ready spans found: ${readySpanCount}`);
  
  if (readySpanCount > 0) {
    // Get the card that contains this span and click it
    await readySpan.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_view.png') });
    console.log('   ✓ Saved: studio_reader_view.png');

    // Citation chips are <button> elements with bg-orange-950/40 styling
    // They contain just the source number. 
    // Try multiple selectors:
    const chipSelectors = [
      'button.bg-orange-950\\/40',   // exact class
      '.text-orange-400',             // by color class
    ];
    let chipFound = false;
    for (const sel of chipSelectors) {
      const chips = page.locator(sel);
      const count = await chips.count();
      console.log(`   Selector "${sel}" matched ${count} element(s).`);
      if (count > 0) {
        await chips.first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_citation_drawer.png') });
        console.log('   ✓ Saved: studio_citation_drawer.png');
        chipFound = true;
        break;
      }
    }
    if (!chipFound) {
      console.log('   No chips found with those selectors. Checking page content...');
      const html = await page.content();
      const hasOrange = html.includes('text-orange-400');
      console.log(`   Page has text-orange-400: ${hasOrange}`);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_fullpage.png'), fullPage: true });
      console.log('   ✓ Saved: studio_reader_fullpage.png');
    }
  } else {
    // Cards might require clicking the title/card area, not just "Ready"
    console.log('   No "Ready" text found. Checking current page state...');
    const pageText = await page.innerText('body');
    console.log('   Body text snippet:', pageText.slice(0, 500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_debug_state.png'), fullPage: true });
    console.log('   ✓ Saved: studio_debug_state.png');
  }

  await browser.close();
  console.log('\nDone! Check screenshots/ directory.');
}

main().catch(err => { console.error(err); process.exit(1); });
