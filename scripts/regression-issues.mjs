// 回归取证：issues #12-#17 深化批次的手动验收项 Playwright 自动化（#18 修复后补齐 #15 筛选态可达性断言）
// 前置：wrangler dev --port 8787 已运行且已播种（见脚本内 seed()）
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = 'http://localhost:8787';
const password = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();

const results = [];
function report(suite, name, pass, detail = '') {
    results.push({ suite, name, pass });
    console.log(`${pass ? '✓' : '✗'} [#${suite}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function seed() {
    const { token } = await (await fetch(`${BASE}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    })).json();
    if (!token) throw new Error('seed login failed');
    const categories = {
        常规A: { isHidden: false, links: [
            { name: '甲站', url: 'https://a1.example.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
            { name: '乙站', url: 'https://a2.example.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
            { name: '丙站', url: 'https://a3.example.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
        ]},
        常规B: { isHidden: false, links: [
            { name: '丁站', url: 'https://b1.example.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
            { name: '戊站', url: 'https://b2.example.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
        ]},
        应用面板: { isHidden: false, isAppLayout: true, links: [
            { name: 'GitHub', url: 'https://github.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
            { name: 'GitLab', url: 'https://gitlab.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
            { name: '油管', url: 'https://youtube.com', tips: '', icon: '', backgroundColor: '', isPrivate: false },
        ]},
    };
    const res = await fetch(`${BASE}/api/saveData`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categories })
    });
    if (!res.ok) throw new Error('seed saveData failed');
}

// 统计 sections-container 的全量重建次数（renderAll 的 innerHTML='' 产生一次大批量移除）；
// 同时记录 window.open 调用（本环境外部 URL 的 popup 事件仅在 teardown 才派发，不可靠）
const RENDER_ALL_COUNTER = `
(() => {
    window.__renderAllCount = 0;
    window.__openCalls = [];
    const __origOpen = window.open.bind(window);
    window.open = (...args) => { window.__openCalls.push(String(args[0])); return __origOpen(...args); };
    // 告警开启次数（跃迁计数，同一弹窗只计一次）
    window.__alertLog = [];
    window.__lastAlertOpen = false;
    setInterval(() => {
        const c = document.getElementById('custom-alert-content');
        const o = document.getElementById('custom-alert-overlay');
        const open = !!(o && !o.classList.contains('overlay-hidden') && c && c.textContent);
        if (open && !window.__lastAlertOpen) window.__alertLog.push(c.textContent);
        window.__lastAlertOpen = open;
    }, 100);
    const attach = () => {
        const container = document.getElementById('sections-container');
        if (!container) return;
        new MutationObserver(muts => {
            for (const m of muts) if (m.type === 'childList' && m.removedNodes.length > 2) window.__renderAllCount++;
        }).observe(container, { childList: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();`;

async function newPage(browser, { collectErrors = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(RENDER_ALL_COUNTER);
    const pageErrors = [];
    if (collectErrors) page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    return { context, page, pageErrors };
}

async function login(page) {
    await page.click('#profile-menu-toggle');
    await page.waitForTimeout(300);
    await page.click('#login-Btn');
    await page.fill('#password-input', password);
    await page.click('#password-confirm-btn');
    await page.waitForTimeout(800);
}

async function enterEditMode(page) {
    await page.click('#profile-menu-toggle');
    await page.waitForTimeout(300);
    await page.click('#edit-mode-btn');
    await page.waitForTimeout(600);
}

const cardIdsIn = (page, cat) => page.evaluate(name =>
    Array.from(document.getElementById(name).querySelectorAll('.card')).map(c => c.getAttribute('data-card-id')), cat);

async function main() {
    await seed();
    const browser = await chromium.launch();

    // ============ #12 渲染次数减半 + #17 无 ReferenceError ============
    {
        const { context, page, pageErrors } = await newPage(browser, { collectErrors: true });

        const renderCount = () => page.evaluate(() => window.__renderAllCount);
        await page.evaluate(() => { window.__renderAllCount = 0; });
        await login(page);
        const loginRenders = await renderCount();
        report('12', '登录链路全量渲染恰好 3 次（3 个 state 变更各一次；旧双通道为 6 次）', loginRenders === 3, `实际 ${loginRenders}`);

        await page.evaluate(() => { window.__renderAllCount = 0; });
        await enterEditMode(page);
        const editRenders = await renderCount();
        report('12', '进入编辑模式全量渲染恰好 1 次', editRenders === 1, `实际 ${editRenders}`);

        await page.evaluate(() => { window.__renderAllCount = 0; });
        await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(1500);
        const loadRenders = await renderCount();
        const sectionsVisible = await page.evaluate(() => document.querySelectorAll('#sections-container .section').length);
        report('12', '首载渲染无冗余双跑（首次渲染无可移除内容，计数 0；sections 已出图）', loadRenders === 0 && sectionsVisible >= 1, `计数 ${loadRenders} sections ${sectionsVisible}`);

        // #17 blob 动画元素与合并样式
        const blobOk = await page.evaluate(() => {
            const blobs = document.querySelectorAll('.animate-blob');
            if (blobs.length < 2) return '元素数量 ' + blobs.length;
            const cs = getComputedStyle(blobs[0]);
            if (cs.willChange !== 'transform') return 'will-change=' + cs.willChange;
            if (!cs.transform.includes('matrix') && cs.transform !== 'translateZ(0)' && cs.transform !== 'none') return 'transform=' + cs.transform;
            return 'ok';
        });
        report('17', 'blob 动画元素存在且合并后样式生效', blobOk === 'ok', blobOk);

        // #17 标题点击刷新
        await page.evaluate(() => { window.__reloaded = true; });
        await page.click('#reload-site-link');
        await page.waitForTimeout(2000);
        const reloaded = await page.evaluate(() => !window.__reloaded);
        report('17', '站点标题点击触发页面刷新', reloaded, reloaded ? '' : '页面未重载');

        // #17 导出按钮（reload 后 authToken 仍在，auth.load 已恢复登录态）
        await page.bringToFront().catch(() => {});
        await page.click('#profile-menu-toggle');
        await page.waitForTimeout(300);
        const exportVisible = await page.evaluate(() => {
            const btn = document.getElementById('export-data-btn');
            return !!btn && btn.offsetParent !== null;
        });
        let exportStatus = 0;
        page.on('response', r => { if (r.url().includes('/api/exportData')) exportStatus = r.status(); });
        if (exportVisible) {
            await page.click('#export-data-btn');
            await page.waitForTimeout(500);
            await page.click('#custom-confirm-ok');
            await page.waitForTimeout(1500);
        }
        report('17', '导出按钮可见且 /api/exportData 返回 200', exportVisible && exportStatus === 200, `可见=${exportVisible} status=${exportStatus}`);

        const refErrors = pageErrors.filter(e => e.includes('ReferenceError'));
        report('17', '全程无 ReferenceError（含导出按钮点击）', refErrors.length === 0, refErrors.join('; '));

        await context.close();
    }

    // ============ #13 拖拽（PC HTML5 DnD + 移动端长按） ============
    {
        const { context, page } = await newPage(browser);
        await login(page);
        await enterEditMode(page);

        const a0 = async () => (await cardIdsIn(page, '常规A'))[0];

        // 组内重排：常规A 第一张拖到第三张右半（落到 idx2）
        const before = await cardIdsIn(page, '常规A');
        let saves = 0;
        page.on('request', r => { if (r.url().includes('/api/saveData')) saves++; });
        const dstBox = await page.locator(`#常规A [data-card-id="${before[2]}"]`).boundingBox();
        await page.dragAndDrop(`#常规A [data-card-id="${before[0]}"]`, `#常规A [data-card-id="${before[2]}"]`, { targetPosition: { x: dstBox.width - 10, y: 20 } });
        await page.waitForTimeout(600);
        const after = await cardIdsIn(page, '常规A');
        report('13', '组内拖拽重排：卡片落到目标位置', after[2] === before[0] && after[0] === before[1], `before=[${before.join(',')}] after=[${after.join(',')}]`);
        report('13', '拖拽落库走 saveData（300ms 尾沿后 1 次）', saves === 1, `实际 ${saves}`);

        // 拖回原位不触发提交（idx0 卡拖到 idx1 卡左侧 = 位置不变）
        saves = 0;
        const cur = await cardIdsIn(page, '常规A');
        await page.dragAndDrop(`#常规A [data-card-id="${cur[0]}"]`, `#常规A [data-card-id="${cur[1]}"]`, { targetPosition: { x: 2, y: 20 } });
        await page.waitForTimeout(600);
        const noCommit = saves === 0;
        report('13', '拖回原位不触发提交', noCommit, `saveData 次数 ${saves}`);

        // 跨组拖入 APP 布局组：详情卡 → 极简卡形态（#13 关键断言：create 分支重建）
        const bCard = (await cardIdsIn(page, '常规B'))[0];
        const appCard = (await cardIdsIn(page, '应用面板'))[0];
        await page.dragAndDrop(`#常规B [data-card-id="${bCard}"]`, `#应用面板 [data-card-id="${appCard}"]`, { targetPosition: { x: 30, y: 30 } });
        await page.waitForTimeout(700);
        const appCheck = await page.evaluate(id => {
            const card = document.querySelector(`#应用面板 [data-card-id="${id}"]`);
            if (!card) return '卡片未出现在应用面板';
            if (card.className.includes('border-white')) return '仍是详情卡形态（未重建）';
            if (!card.hasAttribute('draggable')) return '未带 draggable';
            return 'ok';
        }, bCard);
        report('13', '跨组拖入 APP 布局组：卡片重建为极简卡形态 + draggable', appCheck === 'ok', appCheck);
        const bAfter = await cardIdsIn(page, '常规B');
        report('13', '源分组同步对账（常规B 少一张）', !bAfter.includes(bCard), `常规B 剩 ${bAfter.length}`);

        // 跨组拖回普通组：极简卡 → 详情卡形态
        await page.dragAndDrop(`#应用面板 [data-card-id="${bCard}"]`, `#常规B [data-card-id="${(await cardIdsIn(page, '常规B'))[0]}"]`, { targetPosition: { x: 60, y: 20 } });
        await page.waitForTimeout(700);
        const backCheck = await page.evaluate(id => {
            const card = document.querySelector(`#常规B [data-card-id="${id}"]`);
            if (!card) return '卡片未回常规B';
            if (!card.className.includes('border-white')) return '仍是极简卡形态（未重建）';
            return 'ok';
        }, bCard);
        report('13', '跨组拖出 APP 布局组：重建为详情卡形态', backCheck === 'ok', backCheck);

        // 连续拖拽 300ms 内合并落库（手动 dispatch 两次完整 DnD 序列，间隔 < 300ms）
        await page.waitForTimeout(700); // 排干
        saves = 0;
        const cur2 = await cardIdsIn(page, '常规A');
        await page.evaluate(async ([a, b]) => {
            const fire = (srcEl, dstEl) => {
                const dst = dstEl.getBoundingClientRect();
                const dt = new DataTransfer();
                const x = dst.left + dst.width - 10, y = dst.top + dst.height / 2;
                srcEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
                dstEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
                dstEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
                srcEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
            };
            const q = id => document.querySelector(`#常规A [data-card-id="${id}"]`);
            fire(q(a), q(b));
            // drop 同步移除被拖卡，等一帧 flush 对账重建后再做第二次拖拽（总间隔仍 < 300ms）
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
            const order = () => Array.from(document.getElementById('常规A').querySelectorAll('.card')).map(c => c.getAttribute('data-card-id'));
            const o1 = order();
            fire(q(o1[0]), q(o1[2]));
        }, [cur2[0], cur2[2]]);
        await page.waitForTimeout(700);
        report('13', '连续拖拽 300ms 内合并为 1 次落库', saves === 1, `实际 ${saves}`);

        // 移动端长按拖拽（touch 事件序列）
        const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const mpage = await mobile.newPage();
        await mpage.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
        await mpage.waitForTimeout(1500);
        await login(mpage);
        await enterEditMode(mpage);
        await mpage.evaluate(() => document.getElementById('常规A').scrollIntoView({ block: 'center' }));
        await mpage.waitForTimeout(300);
        const mA = await cardIdsIn(mpage, '常规A');
        const mres = await mpage.evaluate(async ([id0, id2]) => {
            const card = document.querySelector(`#常规A [data-card-id="${id0}"]`);
            const target = document.querySelector(`#常规A [data-card-id="${id2}"]`);
            if (!card || !target) return 'elements missing';
            const src = card.getBoundingClientRect();
            const dst = target.getBoundingClientRect();
            const mkTouch = (el, x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
            const fire = (type, el, x, y) => el.dispatchEvent(new TouchEvent(type, {
                bubbles: true, cancelable: true,
                touches: type === 'touchend' ? [] : [mkTouch(el, x, y)],
                targetTouches: type === 'touchend' ? [] : [mkTouch(el, x, y)],
                changedTouches: [mkTouch(el, x, y)],
            }));
            fire('touchstart', card, src.left + src.width / 2, src.top + src.height / 2);
            await new Promise(r => setTimeout(r, 700)); // 长按 500ms 启动 + 克隆创建
            const dbg = { clone: !!document.querySelector('.card-clone-dragging'), dragging: card.classList.contains('border-dashed') };
            fire('touchmove', target, dst.left + dst.width - 10, dst.top + dst.height / 2);
            await new Promise(r => setTimeout(r, 250));
            const movedDuringDrag = Array.from(document.getElementById('常规A').querySelectorAll('.card')).map(c => c.getAttribute('data-card-id'));
            fire('touchend', target, dst.left + dst.width - 10, dst.top + dst.height / 2);
            await new Promise(r => setTimeout(r, 800)); // 等 200ms 克隆归位闭包 + flush
            const order = Array.from(document.getElementById('常规A').querySelectorAll('.card')).map(c => c.getAttribute('data-card-id'));
            return order[2] === id0 ? 'ok' : `order=${order.join(',')} mid=${movedDuringDrag.join(',')} dbg=${JSON.stringify(dbg)}`;
        }, [mA[0], mA[2]]);
        report('13', '移动端长按拖拽组内重排', mres === 'ok', mres);
        await mobile.close();

        await context.close();
    }

    // ============ #14 弹窗协议 ============
    {
        const { context, page } = await newPage(browser);

        // 密码弹窗：错误密码不关闭
        await page.click('#profile-menu-toggle');
        await page.waitForTimeout(300);
        await page.click('#login-Btn');
        await page.waitForTimeout(300);
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.id === 'password-input');
        report('14', '密码弹窗打开后 focus 输入框', focused);
        await page.fill('#password-input', 'wrong-password');
        await page.click('#password-confirm-btn');
        await page.waitForTimeout(800);
        const stillOpen = await page.evaluate(() => !document.getElementById('password-dialog-overlay').classList.contains('hidden'));
        report('14', '错误密码：弹窗不关闭（留着重试）', stillOpen);

        // 重开/失败后输入框不清空（当前弹窗仍开着，值应保留）
        const keptValue = await page.evaluate(() => document.getElementById('password-input').value);
        report('14', '登录失败后输入框不清空', keptValue === 'wrong-password', `值="${keptValue}"`);

        // 正确密码关闭
        await page.fill('#password-input', password);
        await page.click('#password-confirm-btn');
        await page.waitForTimeout(800);
        const closed = await page.evaluate(() => document.getElementById('password-dialog-overlay').classList.contains('hidden'));
        report('14', '正确密码：弹窗关闭', closed);

        // 卡片编辑弹窗：重复开关后确认只提交一次（listener 不叠加）
        // 编辑模式打开编辑弹窗：点卡片右上角 ⋯ 菜单 → 编辑
        await enterEditMode(page);
        let saves = 0;
        page.on('request', r => { if (r.url().includes('/api/saveData')) saves++; });
        const openEdit = async () => {
            await page.click('#常规A .card >> nth=0 >> button >> nth=0');
            await page.waitForTimeout(300);
            await page.click('.menu-edit');
            await page.waitForTimeout(400);
        };
        const editCard = async () => {
            await openEdit();
            await page.fill('#name-input', '甲站改名');
            await page.click('#dialog-confirm-btn');
            await page.waitForTimeout(400);
        };
        await openEdit();
        await page.click('#dialog-cancel-btn');
        await page.waitForTimeout(500);
        await editCard();
        await editCard();
        await page.waitForTimeout(700);
        report('14', '重复开关弹窗后确认提交：每次确认恰好 1 次落库（无 listener 叠加）', saves === 2, `实际 ${saves}`);

        // Esc 关闭卡片弹窗
        await openEdit();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const escClosed = await page.evaluate(() => document.getElementById('dialog-overlay').classList.contains('overlay-hidden'));
        report('14', 'Esc 关闭卡片弹窗', escClosed);

        await context.close();
    }

    // ============ #15 筛选态 ============
    // #18 起面板 search 行常驻（q 非空时总在 cat/link 行之后追加），Enter 走 doSearch：
    // site 引擎进筛选态、外部引擎开搜索页。管线本身（setFilter/getViewCategories/
    // 结构脏联动）另有 node:test 6 组覆盖，此处验 UI 可达性与端到端表现。
    {
        const { context, page } = await newPage(browser);
        await login(page);

        // 打开面板输入词，选中 search 行（总在最后）回车；返回该行 meta 文案
        const searchViaPalette = async (keyword, beforeType) => {
            await page.keyboard.press('/');
            await page.waitForTimeout(400);
            if (beforeType) await beforeType();
            await page.fill('#cmd-input', keyword);
            await page.waitForTimeout(200);
            const meta = await page.evaluate(() => {
                const rows = document.querySelectorAll('.cmd-row');
                const last = rows[rows.length - 1];
                return last ? ((last.querySelector('.ml-auto') || {}).textContent || '') : '';
            });
            const rows = await page.locator('.cmd-row').count();
            for (let i = 0; i < rows - 1; i++) await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
            return meta;
        };
        const sections = () => page.evaluate(() => {
            const chip = document.getElementById('filter-chip');
            return {
                a: !!document.getElementById('常规A'),
                b: !!document.getElementById('常规B'),
                app: !!document.getElementById('应用面板'),
                chip: !!chip && !chip.classList.contains('hidden'),
            };
        });

        // 空结果：alert 且不进筛选态
        await page.keyboard.press('/');
        await page.waitForTimeout(400);
        await page.fill('#cmd-input', 'zzz不存在的词');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        const emptyAlert = await page.evaluate(() => {
            const alert = document.getElementById('custom-alert-overlay');
            const text = document.getElementById('custom-alert-content');
            return alert && !alert.classList.contains('overlay-hidden') && text && text.textContent.includes('没有找到相关站点');
        });
        report('15', '空结果：openAlert 提示且不进筛选态（UI 可达路径）', emptyAlert);
        await page.evaluate(() => document.getElementById('custom-alert-confirm')?.click());
        await page.waitForTimeout(300);

        // 匹配词 Enter 直达 link（selectedIndex=0 仍指向第一匹配，44c5af5 既有直达行为）
        const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
        await page.keyboard.press('/');
        await page.waitForTimeout(400);
        await page.fill('#cmd-input', 'GitHub');
        await page.keyboard.press('Enter');
        const popup = await popupPromise;
        report('15', '面板匹配词 Enter 直达卡片链接（44c5af5 既有行为，非筛选路径）', !!popup);
        await popup?.close();
        await page.waitForTimeout(300);

        const noChip = await page.evaluate(() => !document.getElementById('filter-chip'));
        report('15', '直达路径不残留筛选浮标（setFilter 未被误触）', noChip);

        // ① 筛选渲染：选中 search 行 Enter 进筛选态，命中分组出图、未命中分组消失
        const siteMeta = await searchViaPalette('甲');
        const filtered = await sections();
        report('15', '筛选态渲染：命中分组出图、未命中分组 section 消失',
            filtered.a && !filtered.b && !filtered.app && filtered.chip && siteMeta === '筛选本站',
            `sections=${JSON.stringify(filtered)} search行meta="${siteMeta}"`);

        // ③ chip 清除恢复全量
        await page.click('#filter-chip');
        await page.waitForTimeout(500);
        const restored = await sections();
        report('15', '点击筛选浮标清除：全部分组回来、chip 消失',
            restored.a && restored.b && restored.app && !restored.chip, JSON.stringify(restored));

        // ② APP 布局网格列宽 minmax(56px,68px)（筛选态下端到端）
        await searchViaPalette('git');
        const gridCheck = await page.evaluate(() => {
            const container = document.querySelector('#应用面板 .card-container');
            if (!container) return '应用面板 section 缺失';
            const tracks = getComputedStyle(container).gridTemplateColumns.split(' ').map(parseFloat);
            if (tracks.length < 2) return `轨道数 ${tracks.length}`;
            const bad = tracks.find(v => !(v >= 56 && v <= 68));
            return bad === undefined ? 'ok' : `轨道宽 ${bad}`;
        });
        report('15', '筛选态 APP 布局网格 minmax(56px,68px) 端到端生效', gridCheck === 'ok', gridCheck);
        await page.click('#filter-chip');
        await page.waitForTimeout(500);

        // ④ 筛选态进入编辑模式保持筛选视图
        await searchViaPalette('甲');
        await enterEditMode(page);
        const editFiltered = await sections();
        report('15', '筛选态进入编辑模式：保持筛选视图（非命中分组仍消失）',
            editFiltered.a && !editFiltered.b && !editFiltered.app, JSON.stringify(editFiltered));

        // ⑤ 筛选态编辑模式新增不匹配卡：当前视图不出现，清除 chip 后可见
        await page.click('#常规A [aria-label="新增链接"]');
        await page.waitForTimeout(400);
        await page.fill('#name-input', '零站');
        await page.fill('#url-input', 'https://z9.example.com');
        await page.click('#dialog-confirm-btn');
        await page.waitForTimeout(800);
        const hiddenCard = await page.evaluate(() => {
            const sec = document.getElementById('常规A');
            return !sec || !sec.textContent.includes('零站');
        });
        await page.click('#filter-chip');
        await page.waitForTimeout(500);
        const visibleCard = await page.evaluate(() => {
            const sec = document.getElementById('常规A');
            return !!sec && sec.textContent.includes('零站');
        });
        report('15', '筛选态编辑模式新增不匹配卡：当前视图不出现，清除 chip 后可见', hiddenCard && visibleCard);

        // 非 site 引擎防呆：外部引擎下 search 行 Enter 开引擎搜索页，不进筛选态
        const extMeta = await searchViaPalette('甲', async () => {
            await page.locator('#cmd-engines button', { hasText: '谷歌' }).click();
            await page.waitForTimeout(200);
        });
        await page.waitForTimeout(500);
        const opened = await page.evaluate(() => window.__openCalls);
        const noFilter = await sections();
        report('15', '外部引擎：search 行 Enter 开引擎搜索页且不出现筛选浮标',
            opened.some(u => u.includes('google.com/search?q=')) && !noFilter.chip,
            `opened=${JSON.stringify(opened)} search行meta="${extMeta}"`);

        await context.close();
    }

    // ============ #16 会话失效降级一次 ============
    {
        const { context, page } = await newPage(browser);
        await login(page);
        await enterEditMode(page);

        // 模拟旧 token 失效：清 refresh cookie + 换坏签名 token（后端首响 401 + refresh 失败）
        await context.clearCookies();
        await page.evaluate(() => {
            // 格式合法但签名错误的 JWT
            const b64 = s => btoa(JSON.stringify(s)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
            localStorage.setItem('authToken', `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'admin', type: 'access', exp: 9999999999 })}.bad-signature`);
        });

        // 编辑卡触发 validateTokenOrRedirect → fetchWithAuth 降级（⋯ 菜单 → 编辑）
        await page.click('#常规A .card >> nth=0 >> button >> nth=0');
        await page.waitForTimeout(300);
        await page.click('.menu-edit');
        await page.waitForTimeout(400);
        await page.fill('#name-input', '触发降级');
        await page.click('#dialog-confirm-btn');
        await page.waitForTimeout(2500);

        const texts = await page.evaluate(() => window.__alertLog);
        const downgrades = texts.filter(t => t.includes('登录已过期'));
        report('16', '会话失效降级提示恰好出现 1 次', downgrades.length === 1, `次数 ${downgrades.length} 文案 ${JSON.stringify(texts)}`);

        const loggedOut = await page.evaluate(() => {
            const menu = document.getElementById('data-tools-menu');
            return !menu || menu.offsetParent === null; // 登录态菜单消失
        });
        report('16', '会话失效后登录态翻转为未登录', loggedOut);

        await context.close();
    }

    await browser.close();

    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 回归结果：${results.length - failed.length}/${results.length} 通过 =====`);
    if (failed.length) {
        console.log('失败项：');
        failed.forEach(f => console.log(`  ✗ [#${f.suite}] ${f.name}`));
        process.exitCode = 1;
    }
}

main().catch(e => { console.error(e); process.exit(1); });
