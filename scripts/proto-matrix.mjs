// 可读性兜底参数矩阵 prototype：对同一页面注入不同 遮罩/玻璃底/文字阴影 组合批量截图
// 产出 screenshots/prototype/W{n}-{combo}.png，供参数决策用证据。不改任何源码。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:8787';
const OUT = 'screenshots/prototype';
mkdirSync(OUT, { recursive: true });

// 1. 取 3 张互不相同的随机壁纸（跟随 302 拿最终 URL，避免浏览器缓存歧义）
const walls = [];
while (walls.length < 3) {
    const r = await fetch('https://bingapi.yuge.qzz.io/random', { redirect: 'follow' });
    if (!walls.includes(r.url)) walls.push(r.url);
}

// 2. 参数组合：遮罩(#bg-mask) × 卡片玻璃底(.card / 极简卡图标槽) × 标签阴影(.card-title)
const STRONG = '0 1px 3px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.55)';
const COMBOS = [
    { id: 'C0', label: '基线(遮罩20+玻璃32)', mask: 0.20, glass: 0.32, shadow: null },
    { id: 'C1', label: '遮罩35', mask: 0.35, glass: 0.32, shadow: null },
    { id: 'C2', label: '遮罩50', mask: 0.50, glass: 0.32, shadow: null },
    { id: 'C3', label: '玻璃50', mask: 0.20, glass: 0.50, shadow: null },
    { id: 'C4', label: '玻璃65', mask: 0.20, glass: 0.65, shadow: null },
    { id: 'C5', label: '阴影强', mask: 0.20, glass: 0.32, shadow: STRONG },
    { id: 'C6', label: '组合(遮罩35+玻璃45+阴影强)', mask: 0.35, glass: 0.45, shadow: STRONG },
];

const browser = await chromium.launch();

async function applyCombo(page, wall, combo) {
    await page.evaluate(([w, m]) => {
        document.getElementById('custom-bg-image').style.backgroundImage = `url(${w})`;
        document.getElementById('bg-mask').style.backgroundColor = `rgba(13, 14, 16, ${m})`;
    }, [wall, combo.mask]);
    await page.evaluate(() => document.getElementById('proto-style')?.remove());
    const css = `
        .card { background-color: rgba(42,42,42,${combo.glass}) !important; }
        .card > div:first-child { background-color: rgba(42,42,42,${combo.glass}) !important; }
        ${combo.shadow ? `.card-title { text-shadow: ${combo.shadow} !important; }` : ''}
    `;
    await page.addStyleTag({ content: css }).then(el => el.id = 'proto-style');
    await page.waitForTimeout(2200); // 等壁纸加载
}

// ---------- 桌面矩阵：1440×1600 视口一屏覆盖三个分组 ----------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);

for (let wi = 0; wi < walls.length; wi++) {
    for (const combo of COMBOS) {
        await applyCombo(page, walls[wi], combo);
        await page.screenshot({ path: `${OUT}/W${wi + 1}-${combo.id}.png` });
        console.log(`✓ W${wi + 1}-${combo.id} ${combo.label}`);
    }
}
await ctx.close();

// ---------- 移动端两行标签验证 ----------
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mpage = await mob.newPage();
await mpage.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await mpage.waitForTimeout(2500);
await mpage.evaluate(([w, m]) => {
    document.getElementById('custom-bg-image').style.backgroundImage = `url(${w})`;
    document.getElementById('bg-mask').style.backgroundColor = `rgba(13, 14, 16, ${m})`;
}, [walls[0], 0.20]);
await mpage.waitForTimeout(2000);
await mpage.screenshot({ path: `${OUT}/M-1line.png` });
await mpage.addStyleTag({ content: `
    .card-title { white-space: normal !important; overflow: hidden !important;
        display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; }
` });
await mpage.waitForTimeout(600);
await mpage.screenshot({ path: `${OUT}/M-2line.png` });
console.log('✓ M-1line / M-2line');
await mob.close();

await browser.close();
console.log('done. wallpapers:');
walls.forEach((w, i) => console.log(`  W${i + 1}: ${w.slice(0, 90)}`));
