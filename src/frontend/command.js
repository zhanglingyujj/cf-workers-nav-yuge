// command.js - 命令条 + 命令面板（Command Bar 范式，替代原顶部搜索栏 + 快捷分类栏）
import { getCategories, isLoggedIn, isEditMode } from './state.js';
import { getEl } from './utils.js';
import { getEngine, getEngineList, setEngineByIndex, doSearch } from './search.js';

let selectedIndex = 0;
let items = [];

export function initCommandBar() {
    const trigger = getEl('cmd-trigger');
    const palette = getEl('cmd-palette');
    const input = getEl('cmd-input');
    if (!trigger || !palette || !input) return;

    trigger.addEventListener('click', openPalette);
    palette.addEventListener('click', (e) => {
        if (e.target === palette) closePalette();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            palette.classList.contains('hidden') ? openPalette() : closePalette();
        }
    });

    input.addEventListener('input', () => {
        selectedIndex = 0;
        renderList(input.value.trim());
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % Math.max(1, items.length);
            renderList(input.value.trim());
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % Math.max(1, items.length);
            renderList(input.value.trim());
        } else if (e.key === 'Enter') {
            e.preventDefault();
            activate(items[selectedIndex], input.value.trim());
        } else if (e.key === 'Escape') {
            closePalette();
        }
    });

    renderEngines();
}

export function openPalette() {
    const palette = getEl('cmd-palette');
    const input = getEl('cmd-input');
    if (!palette || !input) return;
    palette.classList.remove('hidden');
    palette.classList.add('flex');
    input.value = '';
    selectedIndex = 0;
    renderList('');
    input.focus();
}

function closePalette() {
    const palette = getEl('cmd-palette');
    if (!palette) return;
    palette.classList.add('hidden');
    palette.classList.remove('flex');
}

function visibleCategories() {
    const categories = getCategories();
    return Object.keys(categories).filter(c =>
        (categories[c].links || []).some(l => !l.isPrivate || isLoggedIn()) &&
        (!categories[c].isHidden || isEditMode() || isLoggedIn())
    );
}

function buildItems(query) {
    const q = (query || '').toLowerCase();
    const categories = getCategories();
    items = [];

    visibleCategories().forEach(cat => {
        const links = (categories[cat].links || []).filter(l => !l.isPrivate || isLoggedIn());
        if (!q || cat.toLowerCase().includes(q)) {
            items.push({ type: 'cat', name: cat, meta: `${links.length} 个站点` });
        }
        if (q) {
            links
                .filter(l => (l.name || '').toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q))
                .forEach(l => items.push({ type: 'link', name: l.name, url: l.url, meta: cat }));
        }
    });

    if (q && items.length === 0) {
        items.push({ type: 'search', name: query, meta: '搜索网页' });
    }
    if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1);
}

function renderList(query) {
    const list = getEl('cmd-list');
    if (!list) return;
    buildItems(query);

    if (items.length === 0) {
        list.innerHTML = '<div class="px-4 py-6 text-sm text-zinc-400 text-center">输入关键词开始搜索</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = `cmd-row flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${i === selectedIndex ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200'}`;
        const icon = it.type === 'cat' ? '🗂' : it.type === 'link' ? '🔗' : '🌐';
        row.innerHTML = `<span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${i === selectedIndex ? 'bg-white/25' : 'bg-zinc-200/70'}">${icon}</span>
            <span class="truncate font-medium">${it.name}</span>
            <span class="ml-auto text-xs opacity-60 flex-shrink-0">${it.meta || ''}</span>`;
        row.addEventListener('click', () => activate(it, query));
        row.addEventListener('mouseenter', () => {
            selectedIndex = i;
            list.querySelectorAll('.cmd-row').forEach((r, j) => {
                r.classList.toggle('bg-zinc-900', j === i);
                r.classList.toggle('text-white', j === i);
            });
        });
        fragment.appendChild(row);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
}

function activate(item, query) {
    if (!item) {
        if (query) doSearch(query);
        closePalette();
        return;
    }
    if (item.type === 'cat') {
        closePalette();
        const section = document.getElementById(item.name);
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item.type === 'link') {
        closePalette();
        let url = item.url;
        if (url && !url.startsWith('http')) url = 'http://' + url;
        if (url) window.open(url, '_blank');
    } else {
        doSearch(item.name);
        closePalette();
    }
}

function renderEngines() {
    const container = getEl('cmd-engines');
    if (!container) return;
    container.innerHTML = '<span class="text-xs text-zinc-400 mr-2">搜索引擎</span>';

    getEngineList().forEach((eng, i) => {
        const btn = document.createElement('button');
        btn.className = `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${eng.key === getEngine() ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200'}`;
        btn.textContent = eng.label;
        btn.addEventListener('click', () => {
            setEngineByIndex(i);
            renderEngines();
        });
        container.appendChild(btn);
    });
}
