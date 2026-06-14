// take_deep_research_screenshots.js
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
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function apiFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  return r.json();
}

async function main() {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `research_verify_${rand}@example.com`;
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
    body: JSON.stringify({ name: 'Deep Research Verification Workspace' }),
  });
  const wsId = ws.id;
  console.log(`Workspace: ${wsId}`);

  console.log('\n--- BROWSER ---');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Go to login page
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  console.log(`Login page loaded: ${page.url()}`);

  // Wait for login form
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL(`${FRONTEND_URL}/dashboard*`, { timeout: 15000 });
  await page.waitForTimeout(3000);
  console.log(`Dashboard loaded: ${page.url()}`);

  // Navigate to specific workspace
  await page.goto(`${FRONTEND_URL}/dashboard?workspace=${wsId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(`Workspace page loaded: ${page.url()}`);

  // 1. Open Deep Research drawer
  console.log('Clicking Deep Research button...');
  await page.click('button:has-text("Deep Research")');
  await page.waitForSelector('.dr-drawer', { timeout: 5000 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_1_drawer_open.png') });
  console.log('✓ dr_1_drawer_open.png');

  // 2. Perform search
  console.log('Filing query and clicking Research...');
  await page.fill('.dr-input input', 'NRR benchmarks B2B SaaS 2026');
  await page.click('.dr-input button');
  
  console.log('Waiting for search results...');
  await page.waitForSelector('.dr-card', { timeout: 25000 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_2_search_results.png') });
  console.log('✓ dr_2_search_results.png');

  // 3. Tick two results
  console.log('Selecting first two results...');
  const cards = page.locator('.dr-card');
  await cards.nth(0).click();
  await page.waitForTimeout(500);
  await cards.nth(1).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_3_results_selected.png') });
  console.log('✓ dr_3_results_selected.png');

  // 4. Click "Add to notebook"
  console.log('Clicking Add to notebook...');
  await page.click('.dr-foot button:has-text("Add to notebook")');
  
  // Wait for the drawer to close (it closes when polling completes)
  await page.waitForSelector('.dr-drawer', { state: 'hidden', timeout: 30000 });
  console.log('Drawer closed.');
  
  // Wait for source items to become ready in dashboard
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_4_sources_added.png') });
  console.log('✓ dr_4_sources_added.png');

  // 5. Query chat
  console.log('Sending chat question...');
  await page.fill('input[placeholder="Ask your notebook sources a question..."]', 'What are some B2B SaaS NRR benchmarks for 2026 based on the sources?');
  await page.click('form button[type="submit"]');

  console.log('Waiting for response...');
  // Wait for chat loading to finish (input placeholder reverts to normal)
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder^="Ask your notebook"]');
    return input && !input.disabled;
  }, { timeout: 35000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_5_chat_answered.png') });
  console.log('✓ dr_5_chat_answered.png');

  // 6. Click citation badge
  console.log('Clicking citation badge...');
  const citationBtn = page.locator('button:has-text("1")').first();
  if (await citationBtn.count() > 0) {
    await citationBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dr_6_citation_clicked.png') });
    console.log('✓ dr_6_citation_clicked.png');
  } else {
    console.log('No citation badge found, skipping click');
  }

  await browser.close();
  console.log('\nAll verification screenshots saved to:', SCREENSHOTS_DIR);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
