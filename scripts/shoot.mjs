// 设计评审取证：对本地 dev 环境批量截图（桌面 9 态 + 移动端 3 态）
// 前置：
//   1. wrangler dev --port 8787 已运行
//   2. node scripts/seed-dev.mjs 已播种（导航数据 + 壁纸设置）
//   3. 本机 chromium 缺系统库时：export LD_LIBRARY_PATH=/tmp/chrome-libs/ext/usr/lib/x86_64-linux-gnu
//      （解包自 Debian .deb，过程见 docs/research/frontend-design-review-*.md）
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:8787';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const password = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();
const { token } = await (await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
})).json();
if (!token) throw new Error('login failed');

const browser = await chromium.launch();

async function shot(page, name) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('✓', name);
}

// 点空白角落：关闭共享菜单等"外点即关"的浮层，且不触发卡片点击
const clickEmpty = (page) => page.mouse.click(10, 880);

// ---------- 桌面 1440×900 ----------
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await desktop.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000); // 等壁纸 + favicon
await shot(page, '01-visitor-home');

await page.click('#profile-menu-toggle');
await page.waitForTimeout(400);
await shot(page, '02-profile-dropdown-logged-out');

await page.click('#edit-mode-btn'); // 未登录态点击弹出密码框
await page.waitForTimeout(500);
await shot(page, '03-login-dialog');
await page.click('#password-cancel-btn');
await page.waitForTimeout(300);
await clickEmpty(page); // 收起下拉

await page.evaluate((t) => localStorage.setItem('authToken', t), token);
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);
await shot(page, '04-admin-home');

await page.click('#profile-menu-toggle');
await page.waitForTimeout(400);
await page.click('#edit-mode-btn');
await page.waitForTimeout(600);
await shot(page, '05-edit-mode');

const menuBtn = page.locator('[data-card-id] button.rounded-full').first();
if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    await shot(page, '06-card-menu');
    await clickEmpty(page); // 关共享菜单（勿点卡片区域，编辑模式点卡会开编辑弹窗）
    await page.waitForTimeout(300);
}

const addBtn = page.locator('button[aria-label="新增链接"]').first();
if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '07-add-card-dialog');
    await page.click('#dialog-cancel-btn');
    await page.waitForTimeout(300);
}

await page.keyboard.press('/');
await page.waitForTimeout(500);
await shot(page, '08-command-palette');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.click('#profile-menu-toggle');
await page.waitForTimeout(400);
await shot(page, '09-profile-dropdown-logged-in');
await desktop.close();

// ---------- 移动端 390×844 ----------
const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
});
const mpage = await mobile.newPage();
await mpage.addInitScript((t) => localStorage.setItem('authToken', t), token);
await mpage.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await mpage.waitForTimeout(2500);
await shot(mpage, '10-mobile-admin-home');

await mpage.click('#profile-menu-toggle');
await mpage.waitForTimeout(400);
await mpage.click('#edit-mode-btn');
await mpage.waitForTimeout(600);
await shot(mpage, '11-mobile-edit-mode');

await mpage.evaluate(() => document.getElementById('profile-dropdown')?.classList.add('hidden'));
await mpage.waitForTimeout(300);
await mpage.click('#cmd-trigger');
await mpage.waitForTimeout(500);
await shot(mpage, '12-mobile-command-palette');
await mobile.close();

await browser.close();
console.log('done: 12 shots');
