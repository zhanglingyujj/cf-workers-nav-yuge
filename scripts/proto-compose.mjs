// 用 Playwright 把 prototype 截图拼成对比网格（避免精简 ffmpeg 缺滤镜）
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const DIR = resolve('screenshots/prototype');
const panel = (name, cropTop) => `
  <div style="width:1440px;height:900px;overflow:hidden;position:relative;background:#000">
    <img src="./${name}" style="width:1440px;position:absolute;top:${-cropTop}px;left:0">
  </div>`;

const GRIDS = [
    { file: 'comp-W1.html', png: 'comp-W1.png', panels: ['W1-C0.png', 'W1-C1.png', 'W1-C5.png', 'W1-C6.png'], cropTop: 100, vp: [2880, 2000] },
    { file: 'comp-W2.html', png: 'comp-W2.png', panels: ['W2-C0.png', 'W2-C1.png', 'W2-C5.png', 'W2-C6.png'], cropTop: 100, vp: [2880, 2000] },
    { file: 'comp-mobile.html', png: 'comp-mobile.png',
      panels: null, vp: [780, 844] }
];

const browser = await chromium.launch();
for (const g of GRIDS) {
    const page = await browser.newPage({ viewport: { width: g.vp[0], height: g.vp[1] } });
    if (g.panels) {
        writeFileSync(`${DIR}/${g.file}`, `<body style="margin:0"><div style="display:grid;grid-template-columns:1440px 1440px">
            ${panel(g.panels[0], g.cropTop)}${panel(g.panels[1], g.cropTop)}${panel(g.panels[2], g.cropTop)}${panel(g.panels[3], g.cropTop)}</div>`);
    } else {
        writeFileSync(`${DIR}/${g.file}`, `<body style="margin:0"><div style="display:flex">
            <img src="./M-1line.png" style="width:390px"><img src="./M-2line.png" style="width:390px"></div>`);
    }
    await page.goto(`file://${DIR}/${g.file}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/${g.png}`, fullPage: true });
    console.log('✓', g.png);
    await page.close();
}
await browser.close();
