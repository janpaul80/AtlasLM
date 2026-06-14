/**
 * Playwright screenshot capture for AtlasLM Studio UI — Patch 005 Flag 2 evidence.
 *
 * Takes:
 *  1. Studio panel listing Report + Executive Summary with status badges
 *  2. Reader view showing rendered Markdown with [source_N] citation chips
 *  3. Citation drawer after clicking a chip
 *
 * Usage: node take_studio_screenshots.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Read env from .env file
const envLines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const clean = line.trim();
  if (clean && !clean.startsWith('#') && clean.includes('=')) {
    const idx = clean.indexOf('=');
    let key = clean.slice(0, idx).trim();
    let val = clean.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const FRONTEND_URL = 'http://localhost:3010';
const BACKEND_URL = 'http://localhost:8080';

// Screenshots directory
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function supabaseSignup(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  return res.json();
}

async function supabaseLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.access_token;
}

async function apiPost(token, path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(token, path) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

async function waitForStatus(token, urlPath, targetStatus, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const result = await apiGet(token, urlPath);
    console.log(`  → status: ${result.status}`);
    if (result.status === targetStatus || result.status === 'failed') return result;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Timed out waiting for ${targetStatus} on ${urlPath}`);
}

async function main() {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `studio_screenshot_${rand}@example.com`;
  const password = 'TestPassword123!';

  console.log('1. Creating test user and workspace via API...');
  await supabaseSignup(email, password);
  const token = await supabaseLogin(email, password);
  
  const workspace = await apiPost(token, '/api/v1/workspaces', { name: 'Screenshot Test Workspace' });
  const wsId = workspace.id;
  console.log(`   Workspace: ${wsId}`);

  // Upload a small document (CSV in-memory)
  console.log('2. Uploading a test document...');
  const csvContent = `Item ID,Description,Value\nItem-A,Alpha item,100\nItem-B,Beta item,200\nItem-C,Gamma item,300\n`;
  const blob = Buffer.from(csvContent, 'utf8');
  const formData = new FormData();
  formData.append('file', new Blob([blob], { type: 'text/csv' }), 'screenshot_data.csv');
  const uploadRes = await fetch(`${BACKEND_URL}/api/v1/workspaces/${wsId}/documents`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  const docId = uploadData.id;
  console.log(`   Document: ${docId}`);

  // Wait for doc ready
  await waitForStatus(token, `/api/v1/documents/${docId}/status`, 'ready');
  console.log('   Document ready!');

  // Generate Report
  console.log('3. Generating Report...');
  const reportRes = await apiPost(token, `/api/v1/workspaces/${wsId}/studio`, { output_type: 'report' });
  const reportId = reportRes.id;
  console.log(`   Report ID: ${reportId}`);
  await waitForStatus(token, `/api/v1/studio/${reportId}`, 'ready');
  console.log('   Report ready!');

  // Generate Executive Summary
  console.log('4. Generating Executive Summary...');
  const summaryRes = await apiPost(token, `/api/v1/workspaces/${wsId}/studio`, { output_type: 'executive_summary' });
  const summaryId = summaryRes.id;
  console.log(`   Summary ID: ${summaryId}`);
  await waitForStatus(token, `/api/v1/studio/${summaryId}`, 'ready');
  console.log('   Summary ready!');

  // Now launch browser and log in via the UI
  console.log('5. Launching browser and logging in...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject the session into localStorage to bypass Supabase login form
  await page.goto(FRONTEND_URL);
  await page.waitForTimeout(2000);

  // Get a fresh token via Supabase
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await loginRes.json();

  // Set Supabase session in localStorage
  await page.evaluate((sessionData) => {
    const storageKey = `sb-${new URL(window.location.href).hostname.split('.')[0]}-auth-token`;
    // Find the actual Supabase storage key
    const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'));
    console.log('Supabase storage keys found:', keys);
    localStorage.setItem('sb-ortmzzdfkwidvuolczqa-auth-token', JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: sessionData.user,
    }));
  }, session);

  await page.goto(`${FRONTEND_URL}/dashboard`);
  await page.waitForTimeout(3000);

  // Check if we're redirected to login
  const currentUrl = page.url();
  console.log(`   Current URL after goto dashboard: ${currentUrl}`);

  // If still on auth page, try logging in via the form
  if (currentUrl.includes('login') || currentUrl.includes('auth') || currentUrl === `${FRONTEND_URL}/`) {
    console.log('   Logging in via form...');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`   After form login, URL: ${page.url()}`);
  }

  // Navigate to the specific workspace
  console.log('6. Navigating to workspace...');
  await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`);
  await page.waitForTimeout(3000);

  // Take screenshot of dashboard (general)
  const dashUrl = page.url();
  console.log(`   Dashboard URL: ${dashUrl}`);

  // Look for Studio tab
  const studioTab = await page.locator('text=Studio').first();
  if (await studioTab.isVisible()) {
    console.log('7. Found Studio tab, clicking it...');
    await studioTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_panel_badges.png'), fullPage: false });
    console.log('   ✓ Saved: studio_panel_badges.png');
  } else {
    console.log('   Studio tab not found, taking full page screenshot...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard_state.png'), fullPage: true });
    console.log('   ✓ Saved: dashboard_state.png');
  }

  // After Studio tab was clicked, the output cards should now be visible.
  // Click any card that says "Ready" — use a more reliable text-based approach.
  // The cards have h3 with the title text and a date. We click by searching output cards.
  await page.waitForTimeout(1000); // let the list render

  // Look for any output card that has "Ready" text (not "Generating...")
  const readyCards = page.locator('text=Ready');
  const readyCount = await readyCards.count();
  console.log(`8. Found ${readyCount} ready card(s). Clicking the first one to open reader...`);

  if (readyCount > 0) {
    // Click the parent card (the h36 card div that contains "Ready")
    await readyCards.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_view.png'), fullPage: false });
    console.log('   ✓ Saved: studio_reader_view.png');

    // Citation chips render as inline <button> elements with orange styling
    // Their text is just the source number e.g. "1", "2"
    // They exist in the reader content area
    const citationBtn = page.locator('button.text-orange-400').first();
    const chipCount = await citationBtn.count();
    console.log(`9. Found ${chipCount} orange citation button(s).`);

    if (chipCount > 0) {
      await citationBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_citation_drawer.png'), fullPage: false });
      console.log('   ✓ Saved: studio_citation_drawer.png');
    } else {
      // Try by looking for any button with small numeric text in the content area
      const allBtns = page.locator('button');
      const btnCount = await allBtns.count();
      console.log(`   ${btnCount} total buttons. Taking screenshot of current reader state.`);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_reader_with_chips.png'), fullPage: false });
    }
  } else {
    console.log('   No ready cards found. Taking screenshot of current state...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'studio_no_ready_outputs.png'), fullPage: true });
  }

  await browser.close();
  console.log('\nScreenshots complete!');
  console.log('Files saved to:', SCREENSHOTS_DIR);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
