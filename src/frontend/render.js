// render.js - 增量 DOM 渲染引擎
import {
    getCategories, isEditMode, isLoggedIn,
    setFlushHandler, subscribe,
    addCategory, renameCategory, deleteCategory, moveCategory, pinCategory, setCategoryHidden,
    isCategoryAppLayout, setCategoryAppLayout
} from './state.js';
import { createCardElement, updateCardElement } from './card.js';
import { getEl } from './utils.js';
import { commit, commitSoon } from './commit.js';

const containerId = 'sections-container';
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
        reconcileSections();
        dirtyCategories.forEach(cat => patchCategory(cat));
    });

    subscribe('editMode', () => {
        renderAll();
        updateUIState();
    });
    subscribe('loggedIn', () => renderAll());
    subscribe('categoriesLoaded', () => {
        renderAll();
        updateUIState();
    });
}

// 渲染集对账：移除已消失的分组 section，并按数据顺序重排现有 section
function reconcileSections() {
    const container = getEl(containerId);
    if (!container) return;
    const categories = getCategories();

    for (const name of _renderedCategories) {
        const data = categories[name];
        if (!data || (!isEditMode() && !isLoggedIn() && data.isHidden)) {
            const section = document.getElementById(name);
            if (section) section.remove();
            _renderedCategories.delete(name);
        }
    }

    let ref = null;
    for (const key of Object.keys(categories)) {
        const section = document.getElementById(key);
        if (!section) continue;
        if (ref) {
            if (ref.nextSibling !== section) container.insertBefore(section, ref.nextSibling);
        } else if (container.firstChild !== section) {
            container.insertBefore(section, container.firstChild);
        }
        ref = section;
    }
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
    updateUIState();
}

export function patchCategory(categoryName) {
    const categories = getCategories();
    const catData = categories[categoryName];

    if (!catData) {
        const oldSection = document.getElementById(categoryName);
        if (oldSection) oldSection.remove();
        _renderedCategories.delete(categoryName);
        return;
    }

    const { links, isHidden } = catData;
    if (!isEditMode() && !isLoggedIn() && isHidden) {
        const oldSection = document.getElementById(categoryName);
        if (oldSection) oldSection.remove();
        _renderedCategories.delete(categoryName);
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
            updateCardElement(existingCard, link, categoryName);
            const currentIdx = Array.from(cardContainer.children).indexOf(existingCard);
            if (currentIdx !== -1 && currentIdx !== idx) {
                const refNode = cardContainer.children[idx];
                if (refNode && refNode !== existingCard) {
                    cardContainer.insertBefore(existingCard, refNode);
                }
            }
        } else {
            const newCard = createCardElement(link, categoryName);
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
        const card = createCardElement(link, categoryName);
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
                <div class="w-3.5 h-3.5 rounded-full border-2 peer-focus:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-white/60 border-white/60 peer-checked:bg-white peer-checked:border-white transition-colors"></div>
            </label>
        </div>
        ${divider}
<div class="flex items-center justify-center w-8 h-8 has-tooltip cursor-pointer" aria-label="切换APP视图" data-tooltip="${isApp ? '列表视图' : 'APP视图'}">
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${isApp ? 'checked' : ''} class="sr-only peer category-app-toggle">
                <div class="w-3.5 h-3.5 rounded-full border-2 peer-focus:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-white/60 border-white/60 peer-checked:bg-white peer-checked:border-white transition-colors"></div>
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
        if (moveCategory(categoryName, -1)) commit('保存排序');
    });
    buttons[3].addEventListener('click', () => {
        if (moveCategory(categoryName, 1)) commit('保存排序');
    });
    buttons[4].addEventListener('click', () => {
        if (pinCategory(categoryName)) commit('保存排序');
    });
    buttons[5].addEventListener('click', async () => {
        const { validateTokenOrRedirect } = await import('./auth.js');
        if (!await validateTokenOrRedirect()) return;
        const { customConfirm } = await import('./dialogs.js');
        if (await customConfirm(`确定删除 "${categoryName}" 分类及其所有链接吗？`)) {
            deleteCategory(categoryName);
            await commit('删除分类');
        }
    });

    const hideToggle = controls.querySelector('.category-hide-toggle');
    if (hideToggle) {
        hideToggle.addEventListener('change', async function () {
            const container = this.closest('.has-tooltip');
            if (container) container.setAttribute('data-tooltip', this.checked ? '显示分类' : '隐藏分类');
            setCategoryHidden(categoryName, this.checked);
            commitSoon('切换隐藏');
        });
    }

const appToggle = controls.querySelector('.category-app-toggle');
    if (appToggle) {
        appToggle.addEventListener('change', async function () {
            setCategoryAppLayout(categoryName, this.checked);
            renderAll();
            const container = this.closest('.has-tooltip');
            if (container) container.setAttribute('data-tooltip', this.checked ? '列表视图' : 'APP视图');
            commitSoon('切换APP视图');
        });
    }

    return controls;
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