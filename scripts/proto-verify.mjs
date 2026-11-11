// 验证 prototype 注入是否生效：读取注入后的 computed style
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:8787', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2000);

// 模拟 C5
await page.evaluate(() => {
    document.getElementById('bg-mask').style.backgroundColor = 'rgba(13, 14, 16, 0.20)';
});
await page.addStyleTag({ content: `
    .card { background-color: rgba(42,42,42,0.32) !important; }
    .card > div:first-child { background-color: rgba(42,42,42,0.32) !important; }
    .card-title { text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.55) !important; }
` });
await page.waitForTimeout(300);

const probe = await page.evaluate(() => {
    const title = document.querySelector('.card-title');
    const appCard = document.querySelector('.card');
    const iconSlot = document.querySelector('.card > div:first-child');
    const mask = document.getElementById('bg-mask');
    return {
        titleShadow: title ? getComputedStyle(title).textShadow : 'NO TITLE',
        cardBg: appCard ? getComputedStyle(appCard).backgroundColor : 'NO CARD',
        iconSlotBg: iconSlot ? getComputedStyle(iconSlot).backgroundColor : 'NO SLOT',
        maskBg: mask ? getComputedStyle(mask).backgroundColor : 'NO MASK',
        titleCount: document.querySelectorAll('.card-title').length
    };
});
console.log(JSON.stringify(probe, null, 2));
await browser.close();
