// dialogs.js - 弹窗管理 (添加/编辑卡片, 分类命名, confirm, alert, 密码登录)
import { addLink, updateLink, removeLink, getCategories, addCategory, setLoggedIn, setEditMode } from './state.js';
import { updateUIState, renderAll } from './render.js';
import { commit } from './commit.js';
import { getEl } from './utils.js';

function toggleOverlay(id, show) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    const box = overlay.querySelector('div[id$="-box"]');
    if (show) {
        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.remove('overlay-hidden');
        overlay.classList.add('overlay-visible');
        if (box) { box.classList.remove('dialog-scale-hidden'); box.classList.add('dialog-scale-visible'); }
    } else {
        overlay.classList.remove('overlay-visible');
        overlay.classList.add('overlay-hidden');
        if (box) { box.classList.remove('dialog-scale-visible'); box.classList.add('dialog-scale-hidden'); }
        setTimeout(() => {
            if (overlay.classList.contains('overlay-hidden')) overlay.classList.add('hidden');
        }, 300);
    }
}

const BG_COLOR_PRESETS = [
    '#2a2a2a6b', '#1e293bd9', '#B8422Ed9', '#4285F4d9', '#34A853d9',
    '#FBBC05d9', '#EB4335d9', '#008373d9', '#6C7278d9',
];

function initBgColorPicker() {
    const swatches = getEl('bg-color-swatches');
    const input = getEl('bg-color-input');
    if (!swatches || !input || swatches.childElementCount) return;

    BG_COLOR_PRESETS.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = color;
        btn.className = 'w-7 h-7 rounded-lg border border-white/20 transition-transform hover:scale-110';
        btn.style.backgroundColor = color;
        btn.addEventListener('click', () => {
            input.value = color;
            swatches.querySelectorAll('button').forEach(b => b.style.outline = '');
            btn.style.outline = '2px solid #B8422E';
        });
        swatches.appendChild(btn);
    });

    const clearBtn = getEl('bg-color-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            swatches.querySelectorAll('button').forEach(b => b.style.outline = '');
        });
    }
}

function setBgColorValue(color) {
    const input = getEl('bg-color-input');
    if (input) input.value = color || '';
    const swatches = getEl('bg-color-swatches');
    if (swatches) swatches.querySelectorAll('button').forEach(b => b.style.outline = '');
}

function getBgColorValue() {
    const input = getEl('bg-color-input');
    const v = (input && input.value.trim()) || '';
    return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : '';
}

export function showAddDialog() {
    toggleOverlay('dialog-overlay', true);
    const nameInput = getEl('name-input');
    const urlInput = getEl('url-input');
    const tipsInput = getEl('tips-input');
    const iconInput = getEl('icon-input');
    const privateCheckbox = getEl('private-checkbox');
    const catValue = getEl('category-select-value');
    const catText = getEl('category-select-text');
    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
    if (tipsInput) tipsInput.value = '';
    if (iconInput) iconInput.value = '';
    initBgColorPicker();
    setBgColorValue('');
    if (privateCheckbox) privateCheckbox.checked = false;
    if (catValue) catValue.value = '';
    if (catText) catText.textContent = '请选择分类';

    const confirmBtn = getEl('dialog-confirm-btn');
    if (confirmBtn) {
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', addCard);
    }

    const cancelBtn = getEl('dialog-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => toggleOverlay('dialog-overlay', false);

    updateCategorySelectDropdown();
}

function updateCategorySelectDropdown() {
    const menu = getEl('category-select-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const categories = getCategories();
    Object.keys(categories).forEach(cat => {
        const item = document.createElement('div');
        item.className = 'px-3 py-2.5 text-sm text-heritage-outline hover:bg-heritage-dark-700/50 hover:text-white cursor-pointer transition-colors';
        item.textContent = cat;
        item.addEventListener('click', () => {
            const catVal = getEl('category-select-value');
            const catText = getEl('category-select-text');
            if (catVal) catVal.value = cat;
            if (catText) catText.textContent = cat;
            menu.classList.add('hidden');
        });
        menu.appendChild(item);
    });
}

export function showEditDialog(link, categoryName) {
    toggleOverlay('dialog-overlay', true);
    const nameInput = getEl('name-input');
    const urlInput = getEl('url-input');
    const tipsInput = getEl('tips-input');
    const iconInput = getEl('icon-input');
    const privateCheckbox = getEl('private-checkbox');
    const catValue = getEl('category-select-value');
    const catText = getEl('category-select-text');
    if (nameInput) nameInput.value = link.name;
    if (urlInput) urlInput.value = link.url;
    if (tipsInput) tipsInput.value = link.tips || '';
    if (iconInput) iconInput.value = link.icon || '';
    initBgColorPicker();
    setBgColorValue(link.backgroundColor || '');
    if (privateCheckbox) privateCheckbox.checked = link.isPrivate;
    if (catValue) catValue.value = categoryName || link.category || '';
    if (catText) catText.textContent = categoryName || link.category || '请选择分类';

    const confirmBtn = getEl('dialog-confirm-btn');
    if (confirmBtn) {
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => updateCard(link, categoryName));
    }

    const cancelBtn = getEl('dialog-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => toggleOverlay('dialog-overlay', false);

    updateCategorySelectDropdown();
}

async function addCard() {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const name = getEl('name-input').value.trim();
    const url = getEl('url-input').value.trim();
    const category = getEl('category-select-value').value;
    if (!name || !url || !category) {
        await customAlert('请填写必要信息 (名称, URL, 分类)');
        return;
    }

    const newLink = {
        name, url, category,
        tips: getEl('tips-input').value.trim(),
        icon: getEl('icon-input').value.trim(),
        backgroundColor: getBgColorValue(),
        isPrivate: getEl('private-checkbox').checked
    };

    addLink(category, newLink);
    toggleOverlay('dialog-overlay', false);

    await commit('保存数据');
}

async function updateCard(oldLink, categoryName) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const newLink = {
        name: getEl('name-input').value.trim(),
        url: getEl('url-input').value.trim(),
        tips: getEl('tips-input').value.trim(),
        icon: getEl('icon-input').value.trim(),
        backgroundColor: getBgColorValue(),
        category: getEl('category-select-value').value,
        isPrivate: getEl('private-checkbox').checked
    };

const categoryChanged = (categoryName || oldLink.category) !== newLink.category;
    updateLink(oldLink.url, newLink);
    if (categoryChanged) {
        renderAll();
    }
    toggleOverlay('dialog-overlay', false);

    await commit('保存数据');
}

export async function removeCard(card) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const url = card.getAttribute('data-url');
    removeLink(url);
    await commit('删除链接');
}

export async function editCategoryName(oldName) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const newName = await showCategoryDialog('请输入新的分类名称', oldName);
    if (!newName || newName === oldName) return;

    const categories = getCategories();
    if (categories[newName]) {
        await customAlert('该名称已存在');
        return;
    }

    const { renameCategory } = await import('./state.js');
    if (!renameCategory(oldName, newName)) return;
    const { renderAll } = await import('./render.js');
    renderAll();
    await commit('重命名分类');
}

export async function addCategoryAction() {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const name = await showCategoryDialog('请输入新分类名称');
    if (!name) return;
    const categories = getCategories();
    if (categories[name]) {
        await customAlert('该分类已存在');
        return;
    }
    addCategory(name);
    const { renderAll } = await import('./render.js');
    renderAll();
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
    await commit('新增分类');
}

function showCategoryDialog(title, defaultVal = '') {
    return new Promise(resolve => {
        toggleOverlay('category-dialog', true);
        const titleEl = getEl('category-dialog-title');
        const input = getEl('category-name-input');
        if (titleEl) titleEl.innerText = title;
        if (input) { input.value = defaultVal; input.focus(); }

        const confirmBtn = getEl('category-confirm-btn');
        const cancelBtn = getEl('category-cancel-btn');

        const close = (val) => {
            toggleOverlay('category-dialog', false);
            if (confirmBtn) confirmBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
            resolve(val);
        };

        if (confirmBtn) confirmBtn.onclick = () => close(input ? input.value.trim() : null);
        if (cancelBtn) cancelBtn.onclick = () => close(null);
    });
}

export function customConfirm(msg) {
    return new Promise(resolve => {
        toggleOverlay('custom-confirm-overlay', true);
        const msgEl = getEl('custom-confirm-message');
        if (msgEl) msgEl.innerText = msg;

        const okBtn = getEl('custom-confirm-ok');
        const cancelBtn = getEl('custom-confirm-cancel');
        const close = (val) => {
            toggleOverlay('custom-confirm-overlay', false);
            if (okBtn) okBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
            resolve(val);
        };
        if (okBtn) okBtn.onclick = () => close(true);
        if (cancelBtn) cancelBtn.onclick = () => close(false);
    });
}

export function customAlert(msg) {
    return new Promise(resolve => {
        toggleOverlay('custom-alert-overlay', true);
        const contentEl = getEl('custom-alert-content');
        if (contentEl) contentEl.innerText = msg;
        const confirmBtn = getEl('custom-alert-confirm');
        if (confirmBtn) confirmBtn.onclick = () => {
            toggleOverlay('custom-alert-overlay', false);
            resolve();
        };
    });
}

export function initDialogs() {
    // 密码确认按钮
    const passwordConfirmBtn = getEl('password-confirm-btn');
    const passwordCancelBtn = getEl('password-cancel-btn');
    if (passwordConfirmBtn) {
        passwordConfirmBtn.addEventListener('click', async () => {
            const pwd = getEl('password-input').value;
            if (!pwd) return;
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pwd })
                });
                const data = await res.json();
if (data.valid) {
                        localStorage.setItem('authToken', data.token);
                        setLoggedIn(true);
                        toggleOverlay('password-dialog-overlay', false);
                        const loadingMask = document.getElementById('loading-mask');
                        if (loadingMask) loadingMask.classList.remove('hidden');
                        const { reloadLinksAfterLogin } = await import('./auth.js');
                        await reloadLinksAfterLogin(data.token);
                        if (loadingMask) loadingMask.classList.add('hidden');
                    }
            } catch (e) { await customAlert('Login Error'); }
        });
    }
    if (passwordCancelBtn) {
        passwordCancelBtn.addEventListener('click', () => toggleOverlay('password-dialog-overlay', false));
    }

    // 编辑模式按钮 (来自 profile dropdown)
    const editModeBtn = getEl('edit-mode-btn');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', async () => {
            const dropdown = getEl('profile-dropdown');
            if (dropdown) dropdown.classList.add('hidden');

            const { isLoggedIn, setEditMode, setLoggedIn } = await import('./state.js');
            if (!isLoggedIn()) {
                toggleOverlay('password-dialog-overlay', true);
                const pwdInput = getEl('password-input');
                if (pwdInput) pwdInput.focus();
                return;
            }
            const edit = !(await import('./state.js')).isEditMode();
            setEditMode(edit);
            const { renderAll } = await import('./render.js');
            renderAll();
        });
    }

    // 登录按钮
    const loginBtn = getEl('login-Btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const { isLoggedIn, setLoggedIn } = await import('./state.js');
            if (!isLoggedIn()) {
                toggleOverlay('password-dialog-overlay', true);
                const pwdInput = getEl('password-input');
                if (pwdInput) pwdInput.focus();
            } else {
                if (await customConfirm('确定退出登录吗？')) {
                    localStorage.removeItem('authToken');
                    setLoggedIn(false);
                    const { checkLoginStatusAndLoad } = await import('./auth.js');
                    await checkLoginStatusAndLoad();
                }
            }
        });
    }

// 新建分类按钮
    const addCategoryBtn = document.querySelector('#add-category-container button');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => addCategoryAction());
    }

    // 返回顶部按钮
    const backToTopBtn = getEl('back-to-top-btn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // 导入导出（单一导入入口，弹窗选择类型）
    const importFileInput = getEl('import-file-input');
    if (importFileInput) {
        document.getElementById('data-tools-menu')?.querySelector('[onclick="exportData()"]')?.addEventListener('click', async () => {
            const { exportData } = await import('./auth.js');
            await exportData();
        });

        const importDataBtn = document.getElementById('import-data-btn');
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => showImportChooser(importFileInput));
        }
    }

    function showImportChooser(importFileInput) {
        toggleOverlay('import-chooser-overlay', true);

        const close = () => toggleOverlay('import-chooser-overlay', false);

        const bookmarkChoice = getEl('import-bookmark-choice');
        const configChoice = getEl('import-config-choice');
        const cancelBtn = getEl('import-chooser-cancel');
        if (bookmarkChoice) bookmarkChoice.onclick = async () => {
            close();
            const bookmarkFileInput = getEl('bookmark-file-input');
            const { importBookmarks } = await import('./bookmarks.js');
            importBookmarks(bookmarkFileInput);
        };
        if (configChoice) configChoice.onclick = async () => {
            close();
            const { importData } = await import('./auth.js');
            await importData(importFileInput);
        };
        if (cancelBtn) cancelBtn.onclick = close;
    }

    // 分类选择下拉 (在编辑弹窗中)
    const catBtn = getEl('category-select-btn');
    if (catBtn) {
        catBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = getEl('category-select-menu');
            if (menu) menu.classList.toggle('hidden');
        });
    }

    // 关闭分类选择下拉
    const catWrapper = getEl('category-select-wrapper');
    if (catWrapper) {
        document.addEventListener('click', (e) => {
            if (!catWrapper.contains(e.target)) {
                const menu = getEl('category-select-menu');
                if (menu) menu.classList.add('hidden');
            }
        });
    }
}
