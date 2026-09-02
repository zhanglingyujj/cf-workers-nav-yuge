// 书签导入解析器（纯函数，无模块依赖）
// 支持两种格式：Netscape bookmarks HTML（Chrome/Edge/Firefox 通用导出格式）、Sun-Panel 导出 JSON

function makeLink(name, url, tips = '', icon = '') {
    return { name, url, tips, icon, isPrivate: false };
}

function isHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
}

// Netscape bookmarks HTML：文件夹 <DT><H3> 名称 + 相邻 <DL> 内的书签 <DT><A HREF>
export function parseNetscapeBookmark(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const categories = {};
    const processed = new Set();

    const addLink = (cat, a) => {
        const url = a.getAttribute('href');
        if (!isHttpUrl(url)) return;
        const name = a.textContent.trim() || new URL(url).hostname;
        if (!categories[cat]) categories[cat] = [];
        if (categories[cat].some((l) => l.url === url)) return;
        categories[cat].push(makeLink(name, url, '', a.getAttribute('icon') || ''));
        processed.add(a);
    };

    // 每个文件夹：H3 后第一个 DL 内的直接书签
    doc.querySelectorAll('h3').forEach((h3) => {
        const cat = h3.textContent.trim();
        if (!cat) return;
        let node = h3.nextElementSibling;
        while (node && node.tagName !== 'DL') node = node.nextElementSibling;
        if (!node) return;
        node.querySelectorAll(':scope > dt > a[href]').forEach((a) => addLink(cat, a));
    });

    // 顶层散落书签（不在任何文件夹 DL 下）→ 归入"未分类"
    doc.querySelectorAll('a[href]').forEach((a) => {
        if (!processed.has(a)) addLink('未分类', a);
    });

    return categories;
}

// Sun-Panel 导出 JSON：appName === 'Sun-Panel-Config'，icons[].{title, sort, children[].{title, url, lanUrl, description, icon.src}}
export function parseSunPanelData(data) {
    if (!data || data.appName !== 'Sun-Panel-Config' || !Array.isArray(data.icons)) return null;
    const categories = {};

    [...data.icons]
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .forEach((group) => {
            const cat = (group.title || '').trim() || '未分类';
            if (!categories[cat]) categories[cat] = [];
            [...(group.children || [])]
                .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                .forEach((item) => {
                    const url = item.url || item.lanUrl;
                    if (!isHttpUrl(url)) return;
                    const name = (item.title || '').trim() || new URL(url).hostname;
                    if (categories[cat].some((l) => l.url === url)) return;
                    categories[cat].push(makeLink(name, url, item.description || '', item.icon?.src || ''));
                });
        });

    return categories;
}
