// bookmarks.js - 浏览器书签导入 UI 入口
import { parseNetscapeBookmark, parseSunPanelData } from './bookmark-parsers.js';
import { getCategories } from './state.js';
import { validateTokenOrRedirect, loadLinks } from './auth.js';
import { commit } from './commit.js';

export function importBookmarks(fileInput) {
    if (!fileInput) return;
    fileInput.value = '';
    fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleBookmarkFile(file);
    };
    fileInput.click();
}

async function handleBookmarkFile(file) {
    const { customAlert, customConfirm } = await import('./dialogs.js');
    if (!(await validateTokenOrRedirect())) return;

    const text = await file.text();

    // 先按文件名/内容探测 Sun-Panel JSON，失败再按 Netscape HTML 解析
    let imported = null;
    if (/\.(sun-panel\.)?json$/i.test(file.name)) {
        try {
            imported = parseSunPanelData(JSON.parse(text));
        } catch (e) {
            imported = null;
        }
    }
    if (!imported) {
        try {
            imported = parseNetscapeBookmark(text);
        } catch (e) {
            imported = null;
        }
    }

    const total = imported
        ? Object.values(imported).reduce((n, links) => n + links.length, 0)
        : 0;
    if (!imported || !total) {
        await customAlert('无法识别的文件或没有可导入的书签（支持：浏览器导出的书签 HTML、Sun-Panel 导出 JSON）');
        return;
    }

    const summary = Object.entries(imported)
        .map(([cat, links]) => `${cat}(${links.length}条)`)
        .join('、');
    if (!(await customConfirm(`解析成功：${summary}，共 ${total} 条。将按 URL 去重后追加到现有数据，确定导入吗？`))) return;

    const categories = getCategories();
    const existing = new Set(
        Object.values(categories).flatMap((c) => (c.links || []).map((l) => l.url))
    );
    let added = 0;
    for (const [cat, links] of Object.entries(imported)) {
        if (!categories[cat]) categories[cat] = { isHidden: false, links: [] };
        for (const link of links) {
            if (existing.has(link.url)) continue;
            existing.add(link.url);
            link.category = cat;
            categories[cat].links.push(link);
            added++;
        }
    }

    await commit('导入书签');
    await loadLinks();
    await customAlert(`导入完成：新增 ${added} 条，跳过重复 ${total - added} 条`);
}
