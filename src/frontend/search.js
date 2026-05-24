// search.js - 搜索引擎 + 站内筛选
import { renderAll, getFilteredCategoriesByKeyword, renderCategoryButtons } from './render.js';
import { getCategories } from './state.js';
import { getEl } from './utils.js';

const searchEngines = {
    baidu: "https://www.baidu.com/s?wd=",
    bing: "https://www.bing.com/search?q=",
    google: "https://www.google.com/search?q=",
    site: ""
};

const searchEngineLabels = {
    baidu: "百度", bing: "必应", google: "谷歌", site: "本站"
};

const searchEngineIcons = {
    site: '<svg width="16" height="16" fill="#FFD700" stroke="#FFD700" viewBox="0 0 24 24"><path fill="#FFD700" stroke="#FFD700" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
    baidu: '<svg width="16" height="16" viewBox="0 0 32 32"><path fill="#4285F4" d="M5.749 16.864c3.48-.744 3-4.911 2.901-5.817c-.172-1.401-1.823-3.853-4.057-3.656c-2.812.249-3.224 4.323-3.224 4.323c-.385 1.88.907 5.901 4.38 5.151zm6.459-6.984c1.923 0 3.475-2.213 3.475-4.948C15.683 2.213 14.136 0 12.214 0c-1.916 0-3.479 2.197-3.479 4.932s1.557 4.948 3.479 4.948zm8.281.328c2.573.344 4.213-2.401 4.547-4.479c.333-2.068-1.333-4.484-3.145-4.896c-1.823-.421-4.079 2.5-4.307 4.401c-.24 2.333.333 4.651 2.895 4.979zm10.178 3.505c0-.995-.817-3.995-3.88-3.995c-3.057 0-3.48 2.828-3.48 4.828c0 1.907.157 4.563 3.98 4.48c3.807-.095 3.391-4.319 3.391-5.319zm-3.864 8.714s-3.985-3.077-6.303-6.4c-3.145-4.901-7.62-2.907-9.115-.423c-1.489 2.511-3.812 4.084-4.14 4.505c-.333.412-4.797 2.823-3.803 7.224c1 4.401 4.479 4.323 4.479 4.323s2.557.251 5.548-.416c2.984-.667 5.547.161 5.547.161s6.943 2.333 8.864-2.147c1.896-4.495-1.083-6.812-1.083-6.812z"/></svg>',
    bing: '<svg width="16" height="16" viewBox="0 0 32 32"><path fill="#008373" d="m4.807 0l6.391 2.25v22.495l9.005-5.193l-4.411-2.073l-2.786-6.932l14.188 4.984v7.245L11.204 32l-6.396-3.563z"/></svg>',
    google: '<svg width="16" height="16" viewBox="0 0 256 262"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>'
};

let currentEngine = 'site';
const engineList = ['site', 'baidu', 'bing', 'google'];

export function initSearchEngines(btn, menu, searchInput) {
    currentEngine = localStorage.getItem('searchEngine') || 'site';
    updateEngineUI(currentEngine);

    renderEngineMenu(menu);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });
}

function updateEngineUI(value) {
    const label = getEl('current-engine-label');
    const icon = getEl('current-engine-icon');
    if (label) label.textContent = searchEngineLabels[value] || "本站";
    if (icon) icon.innerHTML = searchEngineIcons[value] || searchEngineIcons['site'];
}

function renderEngineMenu(menu) {
    const list = menu.querySelector('#search-engine-list') || menu.querySelector('div');
    if (!list) return;
    list.innerHTML = '<div class="px-3 py-2 text-xs font-semibold text-heritage-secondary uppercase tracking-wider">搜索引擎</div>';

    engineList.forEach(key => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-3 py-2.5 text-sm text-heritage-primary dark:text-heritage-outline hover:bg-heritage-50 dark:hover:bg-slate-700 hover:text-heritage-600 transition-colors flex items-center gap-3";
        btn.innerHTML = `${searchEngineIcons[key]}<span>${searchEngineLabels[key]}</span>`;
        btn.addEventListener('click', () => selectEngine(key));
        list.appendChild(btn);
    });
}

function selectEngine(value) {
    currentEngine = value;
    updateEngineUI(value);
    localStorage.setItem('searchEngine', value);
    const menu = getEl('search-engine-menu');
    if (menu) menu.classList.add('hidden');
}

export function getEngine() {
    return currentEngine;
}

export function doSearch(query) {
    if (currentEngine === 'site') {
        const filtered = getFilteredCategoriesByKeyword(query);
        const hasResults = Object.values(filtered).some(c => c.links.length > 0);
        if (!hasResults) {
            import('./dialogs.js').then(m => m.customAlert('没有找到相关站点。'));
            return;
        }
        // 搜索模式: 全量重建过滤后的视图
        const container = getEl('sections-container');
        if (!container) return;
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const [cat, { links }] of Object.entries(filtered)) {
            const section = document.createElement('div');
            section.className = 'section section-anchor';
            section.id = cat;

            const titleContainer = document.createElement('div');
            titleContainer.className = 'flex items-center gap-3 mb-5 pb-2 border-b border-heritage-outline/60 dark:border-slate-700/60';
            const title = document.createElement('h2');
            title.className = 'text-lg font-bold text-heritage-primary dark:text-slate-100 flex items-center gap-2';
            title.innerHTML = `<span class="w-1.5 h-5 bg-heritage-500 rounded-full inline-block shadow-sm"></span> ${cat}`;
            titleContainer.appendChild(title);
            section.appendChild(titleContainer);

            const cardContainer = document.createElement('div');
            cardContainer.className = 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[18px] card-container relative';
            cardContainer.dataset.category = cat;
            section.appendChild(cardContainer);

            import('./card.js').then(m => {
                links.forEach(link => {
                    const card = m.createCardElement(link);
                    if (card) cardContainer.appendChild(card);
                });
            });

            fragment.appendChild(section);
        }
        container.innerHTML = '';
        container.appendChild(fragment);
        renderCategoryButtons();

        const clearBtn = getEl('clear-search-button');
        if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
        window.open(searchEngines[currentEngine] + encodeURIComponent(query), '_blank');
    }
}