// render.js - 增量 DOM 渲染引擎
import {
    getCategories, isEditMode, isLoggedIn, isAppLayout,
    setFlushHandler, subscribe,
    addCategory, renameCategory, deleteCategory, moveCategory, pinCategory, setCategoryHidden
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

    if (isEditMode()) {
        ensureAddPlaceholder(cardContainer, categoryName);
    } else {
        removeAddPlaceholder(cardContainer);
    }
}

function createCategorySection(categoryName, links, isHidden) {
    if (!isEditMode() && !isLoggedIn() && isHidden) return null;

    const filteredLinks = links.filter(l => !l.isPrivate || isLoggedIn());
    if (filteredLinks.length === 0 && !isEditMode()) return null;

    const section = document.createElement('div');
    section.className = 'section section-anchor';
    section.id = categoryName;

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex items-center gap-3 mb-5 pb-2 border-b border-heritage-outline/60 dark:border-slate-700/60';

    const title = document.createElement('h2');
    title.className = 'text-lg font-bold heritage-primary dark:text-heritage-variant flex items-center gap-2';
    title.innerHTML = `<span class="w-1.5 h-5 bg-heritage-500 rounded-full inline-block shadow-sm"></span> ${categoryName}`;
    titleContainer.appendChild(title);

    if (isEditMode()) {
        titleContainer.appendChild(createCategoryControls(categoryName, isHidden));
    }

    const cardContainer = document.createElement('div');
    const gridClasses = isAppLayout()
        ? 'grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-[18px]'
        : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[18px]';

    cardContainer.className = `grid ${gridClasses} card-container relative`;
    cardContainer.dataset.category = categoryName;

    section.appendChild(titleContainer);
    section.appendChild(cardContainer);

    filteredLinks.forEach(link => {
        const card = createCardElement(link);
        if (card) cardContainer.appendChild(card);
    });

    if (isEditMode()) {
        ensureAddPlaceholder(cardContainer, categoryName);
    }

    return section;
}

function updateSectionHeader(section, categoryName, isHidden) {
    const titleContainer = section.querySelector('div');
    if (!titleContainer) return;

    const existingControls = titleContainer.querySelector('.category-controls');
    if (existingControls) existingControls.remove();

    if (isEditMode()) {
        titleContainer.appendChild(createCategoryControls(categoryName, isHidden));
    }
}

function createCategoryControls(categoryName, isHidden) {
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-1 ml-auto bg-heritage-outline/50 dark:bg-slate-800/50 p-1 rounded-xl border border-heritage-outline/50 dark:border-slate-700/50 backdrop-blur-sm category-controls';
    const btnBase = "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95";

    controls.innerHTML = `
        <button class="${btnBase} text-heritage-secondary hover:text-blue-600 hover:bg-blue-100 dark:text-heritage-secondary dark:hover:bg-blue-900/30 dark:hover:text-blue-400 has-tooltip" data-tooltip="重命名">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <div class="w-px h-4 bg-heritage-outline dark:bg-slate-600 mx-0.5"></div>
        <button class="${btnBase} text-heritage-secondary hover:text-heritage-600 hover:bg-heritage-100 dark:text-heritage-secondary dark:hover:bg-heritage-900/30 dark:hover:text-heritage-400 has-tooltip" data-tooltip="上移">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
        </button>
        <button class="${btnBase} text-heritage-secondary hover:text-heritage-600 hover:bg-heritage-100 dark:text-heritage-secondary dark:hover:bg-heritage-900/30 dark:hover:text-heritage-400 has-tooltip" data-tooltip="下移">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <button class="${btnBase} text-heritage-secondary hover:text-amber-600 hover:bg-amber-100 dark:text-heritage-secondary dark:hover:bg-amber-900/30 dark:hover:text-amber-400 has-tooltip" data-tooltip="置顶">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3h14M18 13l-6-6l-6 6M12 7v14"></path></svg>
        </button>
        <div class="w-px h-4 bg-heritage-outline dark:bg-slate-600 mx-0.5"></div>
        <div class="flex items-center justify-center w-8 h-8 has-tooltip cursor-pointer" data-tooltip="${isHidden ? '显示分类' : '隐藏分类'}">
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${isHidden ? 'checked' : ''} class="sr-only peer category-hide-toggle">
                <div class="w-3.5 h-3.5 rounded-full border-2 border-slate-400 peer-focus:outline-none dark:border-slate-500 peer-checked:bg-slate-500 peer-checked:border-slate-500 transition-colors"></div>
            </label>
        </div>
        <div class="w-px h-4 bg-heritage-outline dark:bg-slate-600 mx-0.5"></div>
        <button class="${btnBase} text-heritage-secondary hover:text-red-600 hover:bg-red-100 dark:text-heritage-secondary dark:hover:bg-red-900/30 dark:hover:text-red-400 has-tooltip" data-tooltip="删除分类">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
    `;

    const buttons = controls.querySelectorAll('button');
    buttons[0].addEventListener('click', () => {
        import('./dialogs.js').then(m => m.editCategoryName(categoryName));
    });
    buttons[1].addEventListener('click', () => {
        moveCategory(categoryName, -1);
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[2].addEventListener('click', () => {
        moveCategory(categoryName, 1);
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[3].addEventListener('click', () => {
        pinCategory(categoryName);
        import('./auth.js').then(m => m.validateTokenOrRedirect()).then(v => {
            if (!v) return;
            return import('./auth.js').then(a => a.saveDataToServer('保存排序', getCategories()));
        });
    });
    buttons[4].addEventListener('click', async () => {
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

    return controls;
}

function ensureAddPlaceholder(cardContainer, categoryName) {
    if (cardContainer.querySelector('.add-card-placeholder')) return;
    const placeholder = document.createElement('div');
    const sizeClasses = isAppLayout()
        ? 'w-[70px] h-[70px] rounded-2xl mx-auto'
        : 'min-h-[100px] p-4 rounded-2xl w-full';

    placeholder.className = `add-card-placeholder group flex flex-col h-full w-full ${sizeClasses} rounded-2xl border-2 border-dashed border-heritage-outline dark:border-slate-700 hover:border-heritage-500 dark:hover:border-heritage-500 hover:bg-heritage-50/50 dark:hover:bg-heritage-900/10 transition-all cursor-pointer flex items-center justify-center`;

    placeholder.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-heritage-variant dark:bg-slate-800 group-hover:bg-heritage-100 dark:group-hover:bg-heritage-900/30 flex items-center justify-center transition-colors pointer-events-none">
            <svg class="w-6 h-6 text-heritage-secondary group-hover:text-heritage-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </div>
    `;

    placeholder.addEventListener('click', () => {
        import('./dialogs.js').then(m => {
            m.showAddDialog();
            const catVal = document.getElementById('category-select-value');
            const catText = document.getElementById('category-select-text');
            if (catVal) catVal.value = categoryName;
            if (catText) catText.textContent = categoryName;
        });
    });

    placeholder.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.card.dragging');
        if (dragging && dragging.parentElement === cardContainer) {
            cardContainer.insertBefore(dragging, placeholder);
        }
    });

    cardContainer.appendChild(placeholder);
}

function removeAddPlaceholder(cardContainer) {
    const placeholder = cardContainer.querySelector('.add-card-placeholder');
    if (placeholder) placeholder.remove();
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
        btn.className = 'category-button whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-xl border border-heritage-outline dark:border-slate-600 transition-all active:scale-95 shadow-sm scroll-snap-align-start bg-heritage-variant dark:bg-slate-800 text-heritage-primary dark:text-heritage-outline hover:bg-heritage-50 hover:text-heritage-600 dark:hover:bg-slate-700 hover:border-heritage-300 dark:hover:border-heritage-500/50';
        btn.textContent = cat;
        btn.dataset.target = cat;
        btn.addEventListener('click', () => {
            const section = document.getElementById(cat);
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        container.appendChild(btn);
    });
}

let _scrollObserver = null;
let _animationFrameId = null;

function setupScrollSpyNow() {
    if (_scrollObserver) _scrollObserver.disconnect();
    if (_animationFrameId) cancelAnimationFrame(_animationFrameId);

    const sections = document.querySelectorAll('.section');
    const buttons = document.querySelectorAll('.category-button');
    if (!sections.length || !buttons.length) return;

    let lastHighlightedId = null;

    _scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.id !== lastHighlightedId) {
                lastHighlightedId = entry.target.id;
                if (_animationFrameId) cancelAnimationFrame(_animationFrameId);
                _animationFrameId = requestAnimationFrame(() => highlightButton(entry.target.id));
            }
        });
    }, { root: null, rootMargin: '-80px 0px -80% 0px', threshold: 0 });

    sections.forEach(section => _scrollObserver.observe(section));
}

function highlightButton(id) {
    const buttons = document.querySelectorAll('.category-button');
    const activeClass = 'bg-heritage-500 text-white shadow-md dark:bg-heritage-600';
    const inactiveClass = 'bg-heritage-variant dark:bg-slate-800 text-heritage-primary dark:text-heritage-outline hover:bg-heritage-50 hover:text-heritage-600 dark:hover:bg-slate-700';

    buttons.forEach(btn => {
        if (btn.dataset.target === id) {
            if (!btn.classList.contains('bg-heritage-500')) {
                btn.classList.remove(...inactiveClass.split(' '));
                btn.classList.add(...activeClass.split(' '));
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        } else {
            if (btn.classList.contains('bg-heritage-500')) {
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

    if (editModeBtn) {
        if (isEditMode()) {
            editModeBtn.innerHTML = '<span class="text-red-500 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>退出编辑</span>';
            document.body.classList.add('edit-mode');
            if (addCategoryContainer) addCategoryContainer.classList.remove('hidden');
        } else {
            editModeBtn.innerHTML = isLoggedIn()
                ? '<span class="flex items-center gap-3"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>进入编辑模式</span>'
                : '<span class="flex items-center gap-3 text-heritage-secondary"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>编辑模式 (需登录)</span>';
            document.body.classList.remove('edit-mode');
            if (addCategoryContainer) addCategoryContainer.classList.add('hidden');
        }
    }
}