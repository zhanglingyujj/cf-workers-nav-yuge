// render.js - 增量 DOM 渲染引擎
import {
    getCategories, isEditMode, isLoggedIn,
    setFlushHandler, subscribe,
    addCategory, renameCategory, deleteCategory, moveCategory, pinCategory, setCategoryHidden,
    isCategoryAppLayout, setCategoryAppLayout
} from './state.js';
import { createCardElement, updateCardElement } from './card.js';
import { getEl, clearElCache, debounce } from './utils.js';

const containerId = 'sections-container';
const buttonsContainerId = 'category-buttons-container';
const addCategoryContainerId = 'add-category-container';

let _renderedCategories = new Set();

// 站内搜索过滤
export function getFilteredCategoriesByKeyword(query) {
    const lowerQuery = query.toLowerCase();
    const result = {};
    const categories = getCategories();
    Object.keys(categories).forEach(cat => {
        const catData = categories[cat];
        const matchedLinks = (catData.links || []).filter(link => {
            const nameMatch = link.name && link.name.toLowerCase().includes(lowerQuery);
            const tipsMatch = link.tips && link.tips.toLowerCase().includes(lowerQuery);
            const urlMatch = link.url && link.url.toLowerCase().includes(lowerQuery);
            return nameMatch || tipsMatch || urlMatch;
        });
        if (matchedLinks.length > 0) {
            result[cat] = { ...catData, links: matchedLinks };
        }
    });
    return result;
}

export function initRender() {
    setFlushHandler((dirtyCategories) => {
        dirtyCategories.forEach(cat => patchCategory(cat));
        renderCategoryButtons();
        setupScrollSpyNow();
    });

    subscribe('editMode', () => {
        renderAll();
        updateUIState();
    });
    subscribe('appLayout', () => {
        clearElCache();
        renderAll();
    });
    subscribe('loggedIn', () => renderAll());
    subscribe('categoriesLoaded', () => {
        renderAll();
        updateUIState();
    });
}

export function renderAll() {
    _renderedCategories.clear();
    const container = getEl(containerId);
    if (!container) return;

    container.innerHTML = '';
    const categories = getCategories();
    const fragment = document.createDocumentFragment();

    for (const [catName, { links, isHidden }] of Object.entries(categories)) {
        const section = createCategorySection(catName, links, isHidden);
        if (section) {
            fragment.appendChild(section);
            _renderedCategories.add(catName);
        }
    }

    container.appendChild(fragment);
    renderCategoryButtons();
    updateUIState();
    setupScrollSpyNow();
}

export function patchCategory(categoryName) {
    const categories = getCategories();
    const catData = categories[categoryName];

    if (!catData) {
        const oldSection = document.getElementById(categoryName);
        if (oldSection) oldSection.remove();
        _renderedCategories.delete(categoryName);
        renderCategoryButtons();
        return;
    }

    const { links, isHidden } = catData;
    if (!isEditMode() && !isLoggedIn() && isHidden) {
        const oldSection = document.getElementById(categoryName);
        if (oldSection) oldSection.remove();
        _renderedCategories.delete(categoryName);
        renderCategoryButtons();
        return;
    }

    const existingSection = document.getElementById(categoryName);

    if (!existingSection) {
        const newSection = createCategorySection(categoryName, links, isHidden);
        if (newSection) {
            const container = getEl(containerId);
            if (!container) return;
            const keys = Object.keys(categories);
            const idx = keys.indexOf(categoryName);
            const afterSection = idx > 0 ? document.getElementById(keys[idx - 1]) : null;
            if (afterSection && afterSection.nextSibling) {
                container.insertBefore(newSection, afterSection.nextSibling);
            } else {
                container.appendChild(newSection);
            }
            _renderedCategories.add(categoryName);
        }
        return;
    }

    updateSectionHeader(existingSection, categoryName, isHidden);

    const cardContainer = existingSection.querySelector('.card-container');
    if (!cardContainer) return;

    const existingCards = Array.from(cardContainer.querySelectorAll('.card'));
    const existingUrls = new Set(existingCards.map(c => c.getAttribute('data-url')));
    const newUrls = new Set(links.map(l => l.url));

    existingCards.forEach(card => {
        const url = card.getAttribute('data-url');
        if (!newUrls.has(url)) card.remove();
    });

    links.forEach((link, idx) => {
        const existingCard = existingCards.find(c => c.getAttribute('data-url') === link.url);
        if (existingCard) {
            updateCardElement(existingCard, link);
            const currentIdx = Array.from(cardContainer.children).indexOf(existingCard);
            if (currentIdx !== -1 && currentIdx !== idx) {
                const refNode = cardContainer.children[idx];
                if (refNode && refNode !== existingCard) {
                    cardContainer.insertBefore(existingCard, refNode);
                }
            }
        } else {
            const newCard = createCardElement(link);
            if (!newCard) return;
            const refNode = cardContainer.children[idx];
            if (refNode) {
                cardContainer.insertBefore(newCard, refNode);
            } else {
                cardContainer.appendChild(newCard);
            }
        }
    });

}

function createCategorySection(categoryName, links, isHidden) {
    if (!isEditMode() && !isLoggedIn() && isHidden) return null;

    const filteredLinks = links.filter(l => !l.isPrivate || isLoggedIn());
    if (filteredLinks.length === 0 && !isEditMode()) return null;

    const section = document.createElement('div');
    section.className = 'section section-anchor';
    section.id = categoryName;

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex flex-wrap items-center gap-3 mb-6';

    const title = document.createElement('h2');
    title.className = 'text-xl font-extrabold text-white flex items-center gap-2 mb-1 drop-shadow-sm';
    title.textContent = categoryName;
    titleContainer.appendChild(title);

    if (isEditMode()) {
const catData = getCategories()[categoryName];
        const isApp = catData && catData.isAppLayout;
        titleContainer.appendChild(createCategoryControls(categoryName, isHidden, isApp));
    }

    const cardContainer = document.createElement('div');
    const catData = getCategories()[categoryName];
    const isApp = catData && catData.isAppLayout;
    const gridClasses = isApp
        ? 'grid-cols-[repeat(auto-fill,minmax(56px,68px))] justify-start gap-x-4 gap-y-3'
        : 'grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-[14px] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]';

    cardContainer.className = `grid ${gridClasses} card-container relative`;
    cardContainer.dataset.category = categoryName;

    section.appendChild(titleContainer);
    section.appendChild(cardContainer);

    filteredLinks.forEach(link => {
        const card = createCardElement(link);
        if (card) cardContainer.appendChild(card);
    });

    return section;
}

function updateSectionHeader(section, categoryName, isHidden) {
    const titleContainer = section.querySelector('div');
    if (!titleContainer) return;

    const existingControls = titleContainer.querySelector('.category-controls');
    if (existingControls) existingControls.remove();

    if (isEditMode()) {
const catData = getCategories()[categoryName];
        const isApp = catData && catData.isAppLayout;
        titleContainer.appendChild(createCategoryControls(categoryName, isHidden, isApp));
    }
}

function createCategoryControls(categoryName, isHidden, isApp) {
    const controls = document.createElement('div');
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', `${categoryName}分组操作`);
    controls.className = 'flex flex-wrap items-center gap-0.5 category-controls';
    const btnBase = "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60";
    const divider = '<div class="w-px h-4 bg-white/15 mx-0.5" aria-hidden="true"></div>';

    controls.innerHTML = `
        <button class="${btnBase} has-tooltip" aria-label="新增链接" data-tooltip="新增链接">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
        ${divider}
        <button class="${btnBase} has-tooltip" aria-label="重命名分组" data-tooltip="重命名">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        ${divider}
        <button class="${btnBase} has-tooltip" aria-label="上移分组" data-tooltip="上移">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
        </button>
        <button class="${btnBase} has-tooltip" aria-label="下移分组" data-tooltip="下移">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <button class="${btnBase} has-tooltip" aria-label="置顶分组" data-tooltip="置顶">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3h14M18 13l-6-6l-6 6M12 7v14"></path></svg>
        </button>
        ${divider}
        <div class="flex items-center justify-center w-8 h-8 has-tooltip cursor-pointer" aria-label="切换分组可见性" data-tooltip="${isHidden ? '显示分类' : '隐藏分类'}">
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${isHidden ? 'checked' : ''} class="sr-only peer category-hide-toggle">
                <div class="w-3.5 h-3.5 rounded-full border-2 peer-focus:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-white/60 border-white/60 peer-checked:bg-white/70 peer-checked:border-white/70 transition-colors"></div>
            </label>
        </div>
        ${divider}
<div class="flex items-center justify-center w-8 h-8 has-tooltip cursor-pointer" aria-label="切换APP视图" data-tooltip="${isApp ? '列表视图' : 'APP视图'}">
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${isApp ? 'checked' : ''} class="sr-only peer category-app-toggle">
                <div class="w-3.5 h-3.5 rounded-full border-2 peer-focus:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-white/60 border-white/60 peer-checked:bg-heritage-500 peer-checked:border-heritage-500 transition-colors"></div>
            </label>
        </div>
        ${divider}
        <button class="${btnBase} hover:text-red-400 hover:bg-red-900/30 has-tooltip" aria-label="删除分组" data-tooltip="删除分类">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
    `;

    const buttons = controls.querySelectorAll('button');
    buttons[0].addEventListener('click', () => {
        import('./dialogs.js').then(m => {
            m.showAddDialog();
            const catVal = document.getElementById('category-select-value');
            const catText = document.getElementById('category-select-text');
            if (catVal) catVal.value = categoryName;
            if (catText) catText.textContent = categoryName;
        });
    });
    buttons[1].addEventListener('click', () => {
        import('./dialogs.js').then(m => m.editCategoryName(categoryName));
    });
    buttons[2].addEventListener('click', () => {
        moveCategory(categoryName, -1);
        renderAll();
        renderCategoryButtons();
        setupScrollSpyNow();
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[3].addEventListener('click', () => {
        moveCategory(categoryName, 1);
        renderAll();
        renderCategoryButtons();
        setupScrollSpyNow();
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[4].addEventListener('click', () => {
        pinCategory(categoryName);
        renderAll();
        renderCategoryButtons();
        setupScrollSpyNow();
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[5].addEventListener('click', async () => {
        const { validateTokenOrRedirect } = await import('./auth.js');
        if (!await validateTokenOrRedirect()) return;
        const { customConfirm } = await import('./dialogs.js');
        if (await customConfirm(`确定删除 "${categoryName}" 分类及其所有链接吗？`)) {
            deleteCategory(categoryName);
            renderCategoryButtons();
            const { saveDataToServer } = await import('./auth.js');
            await saveDataToServer('删除分类', getCategories());
        }
    });

    const hideToggle = controls.querySelector('.category-hide-toggle');
    if (hideToggle) {
        hideToggle.addEventListener('change', async function () {
            const container = this.closest('.has-tooltip');
            if (container) container.setAttribute('data-tooltip', this.checked ? '显示分类' : '隐藏分类');
            setCategoryHidden(categoryName, this.checked);
            const { validateTokenOrRedirect, saveDataToServer } = await import('./auth.js');
            if (await validateTokenOrRedirect()) {
                await saveDataToServer('切换隐藏', getCategories());
            }
        });
    }

const appToggle = controls.querySelector('.category-app-toggle');
    if (appToggle) {
        appToggle.addEventListener('change', async function () {
            setCategoryAppLayout(categoryName, this.checked);
            renderAll();
            renderCategoryButtons();
            setupScrollSpyNow();
            const container = this.closest('.has-tooltip');
            if (container) container.setAttribute('data-tooltip', this.checked ? '列表视图' : 'APP视图');
            const { validateTokenOrRedirect, saveDataToServer } = await import('./auth.js');
            if (await validateTokenOrRedirect()) {
                await saveDataToServer('切换APP视图', getCategories());
            }
        });
    }

    return controls;
}


export function renderCategoryButtons() {
    const container = getEl(buttonsContainerId) || document.getElementById('category-buttons-container');
    if (!container) return;
    container.innerHTML = '';

    const categories = getCategories();
    const visibleCategories = Object.keys(categories).filter(c =>
        (categories[c].links || []).some(l => !l.isPrivate || isLoggedIn()) &&
        (!categories[c].isHidden || isEditMode() || isLoggedIn())
    );

    if (visibleCategories.length === 0) return;

    visibleCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-button whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-xl border border-heritage-dark-600 transition-all active:scale-95 shadow-sm scroll-snap-align-start bg-heritage-dark-800 text-heritage-outline hover:text-heritage-400 hover:bg-heritage-dark-700 hover:border-heritage-500/50';
        btn.textContent = cat;
        btn.dataset.target = cat;
        btn.addEventListener('click', () => {
_manualScrollTarget = cat;
            highlightButton(cat);
            clearTimeout(_manualScrollTimer);
            _manualScrollTimer = setTimeout(() => { _manualScrollTarget = null; }, 1000);
            const section = document.getElementById(cat);
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        container.appendChild(btn);
    });
}

let _scrollObserver = null;
let _animationFrameId = null;
let _manualScrollTarget = null;
let _manualScrollTimer = null;

function setupScrollSpyNow() {
    if (_scrollObserver) _scrollObserver.disconnect();
    if (_animationFrameId) cancelAnimationFrame(_animationFrameId);

    const sections = document.querySelectorAll('.section');
    const buttons = document.querySelectorAll('.category-button');
    if (!sections.length || !buttons.length) return;

    let lastHighlightedId = null;

    _scrollObserver = new IntersectionObserver((entries) => {
if (_manualScrollTarget) return;
        const visibleSections = [];
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                visibleSections.push({
                    id: entry.target.id,
                    top: entry.target.getBoundingClientRect().top
                });
            }
        });

        visibleSections.sort((a, b) => a.top - b.top);

        let targetId = null;
        if (visibleSections.length > 0) {
            targetId = visibleSections[0].id;
        } else {
            if (window.scrollY <= 50 && sections.length > 0) {
                targetId = sections[0].id;
            } else {
                const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50;
                if (isAtBottom && sections.length > 0) {
                    targetId = sections[sections.length - 1].id;
                }
            }
        }

        if (targetId && targetId !== lastHighlightedId) {
            lastHighlightedId = targetId;
            if (_animationFrameId) cancelAnimationFrame(_animationFrameId);
            _animationFrameId = requestAnimationFrame(() => highlightButton(targetId));
        }
    }, { root: null, rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    sections.forEach(section => _scrollObserver.observe(section));
}

function highlightButton(id) {
    const buttons = document.querySelectorAll('.category-button');
    const activeClass = 'text-white shadow-md bg-heritage-600';
    const inactiveClass = 'bg-heritage-dark-800 text-heritage-outline hover:text-heritage-400 hover:bg-heritage-dark-700';

    buttons.forEach(btn => {
        if (btn.dataset.target === id) {
            if (!btn.classList.contains('bg-heritage-600')) {
                btn.classList.remove(...inactiveClass.split(' '));
                btn.classList.add(...activeClass.split(' '));
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        } else {
            if (btn.classList.contains('bg-heritage-600')) {
                btn.classList.remove(...activeClass.split(' '));
                btn.classList.add(...inactiveClass.split(' '));
            }
        }
    });
}

export function updateUIState() {
    const editModeBtn = document.getElementById('edit-mode-btn');
    const loginBtn = document.getElementById('login-Btn');
    const addCategoryContainer = document.getElementById('add-category-container');
    const dataToolsMenu = document.getElementById('data-tools-menu');

    if (loginBtn) {
        loginBtn.innerHTML = isLoggedIn()
            ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 退出登录'
            : '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> 登录';
    }

    if (dataToolsMenu) {
        dataToolsMenu.classList.toggle('hidden', !isLoggedIn());
    }

const bgControlsSection = document.getElementById('bg-controls-section');
    if (bgControlsSection) {
        bgControlsSection.classList.toggle('hidden', !isLoggedIn());
    }

    if (editModeBtn) {
        if (isEditMode()) {
            editModeBtn.innerHTML = '<span class="text-red-500 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>退出编辑</span>';
            document.body.classList.add('edit-mode');
            if (addCategoryContainer) addCategoryContainer.classList.remove('hidden');
        } else {
            editModeBtn.innerHTML = isLoggedIn()
                ? '<span class="flex items-center gap-3"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>进入编辑模式</span>'
                : '<span class="flex items-center gap-3 text-heritage-dark-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>编辑模式 (需登录)</span>';
            document.body.classList.remove('edit-mode');
            if (addCategoryContainer) addCategoryContainer.classList.add('hidden');
        }
    }
}