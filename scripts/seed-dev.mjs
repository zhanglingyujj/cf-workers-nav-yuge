// 播种本地 dev 环境：导入用户导出的导航数据 + 自定义壁纸设置
import { readFileSync } from 'fs';

const BASE = 'http://localhost:8787';
const vars = readFileSync('.dev.vars', 'utf8');
const password = vars.match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();

// 1. 登录拿 token
const loginRes = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
});
const { token } = await loginRes.json();
if (!token) throw new Error('login failed');
console.log('login ok');

// 2. 导入分类数据
const exportData = JSON.parse(readFileSync('nav_export_2026-11-10.json', 'utf8'));
const saveRes = await fetch(`${BASE}/api/saveData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ categories: exportData.categories })
});
console.log('saveData:', saveRes.status, await saveRes.text());

// 3. 写入站点设置（Bing 每日壁纸 + UI 默认遮罩/模糊）
const settingsRes = await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
        backgroundImage: 'https://bingapi.yuge.qzz.io',
        backgroundOpacity: 20,
        backgroundBlur: 0,
        siteTitle: ''
    })
});
console.log('settings:', settingsRes.status, await settingsRes.text());

// 4. 验证
const check = await fetch(`${BASE}/api/getLinks`);
const data = await check.json();
const cats = data.categories || {};
console.log('getLinks ok, categories:', Object.keys(cats).length,
    Object.entries(cats).map(([n, c]) => `${n}(${(c.links || []).length})`).join(' '));
