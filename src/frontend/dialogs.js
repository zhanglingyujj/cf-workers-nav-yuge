// dialogs.js - 弹窗管理 (添加/编辑卡片, 密码登录)
import { addLink, updateLink, removeLink, getCategories, findLinkById, addCategory, isEditMode, isLoggedIn, setEditMode } from './state.js';
import { commit } from './commit.js';
import { getEl } from './utils.js';
import { openAlert, openConfirm, openPrompt, runDialog } from './overlay.js';
import { createCardForm } from './card-form.js';

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
        btn.className = 'w-7 h-7 rounded-lg border border-zinc-300 transition-transform hover:scale-110';
        btn.style.backgroundColor = color;
        btn.addEventListener('click', () => {
            input.value = color;
            swatches.querySelectorAll('button').forEach(b => b.style.outline = '');
            btn.style.outline = '2px solid #27272A';
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

function setCardDialogTitle(text) {
    const title = getEl('card-dialog-title');
    if (title) title.textContent = text;
}

// 新增/编辑卡弹窗走 runDialog 协议：动画 + registerCloser + 关闭即 resolve，onclick 可重复绑定不叠加
function openCardDialog(onConfirm) {
    const overlay = document.getElementById('dialog-overlay');
    if (!overlay) return null;
    return runDialog(overlay, close => {
        const confirmBtn = getEl('dialog-confirm-btn');
        const cancelBtn = getEl('dialog-cancel-btn');
        if (confirmBtn) confirmBtn.onclick = () => onConfirm(close);
        if (cancelBtn) cancelBtn.onclick = () => close();
    });
}

const cardForm = createCardForm();

export function showAddDialog(categoryName) {
    setCardDialogTitle('新增链接');
    initBgColorPicker();
    cardForm.clearForm(categoryName);
    updateCategorySelectDropdown();
    openCardDialog(close => addCard(close));
}

export function updateCategorySelectDropdown() {
    const menu = getEl('category-select-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const categories = getCategories();
    const currentVal = (getEl('category-select-value') || {}).value || '';
    Object.keys(categories).forEach(cat => {
        const item = document.createElement('div');
        item.className = cat === currentVal
            ? 'px-3 py-2.5 text-sm bg-zinc-800 text-white cursor-pointer transition-colors'
            : 'px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 cursor-pointer transition-colors';
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
    setCardDialogTitle('编辑链接');
    initBgColorPicker();
    cardForm.writeForm(link, categoryName);
    updateCategorySelectDropdown();
    openCardDialog(close => updateCard(link, close));
}

async function addCard(close) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const error = cardForm.validate();
    if (error) {
        await openAlert(error);
        return;
    }

    const newLink = cardForm.readForm();
    addLink(newLink.category, newLink);
    close();

    await commit('保存数据');
}

async function updateCard(oldLink, close) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const error = cardForm.validate();
    if (error) {
        await openAlert(error);
        return;
    }

    updateLink(oldLink, cardForm.readForm());
    close();

    await commit('保存数据');
}

export async function removeCard(card) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const link = findLinkById(card.getAttribute('data-card-id'));
    if (link) removeLink(link);
    await commit('删除链接');
}

export async function editCategoryName(oldName) {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const newName = await openPrompt('请输入新的分类名称', oldName);
    if (!newName || newName === oldName) return;

    const categories = getCategories();
    if (categories[newName]) {
        await openAlert('该名称已存在');
        return;
    }

    const { renameCategory } = await import('./state.js');
    if (!renameCategory(oldName, newName)) return;
    await commit('重命名分类');
}

export async function addCategoryAction() {
    const { validateTokenOrRedirect } = await import('./auth.js');
    if (!(await validateTokenOrRedirect())) return;

    const name = await openPrompt('请输入新分类名称');
    if (!name) return;
    const categories = getCategories();
    if (categories[name]) {
        await openAlert('该分类已存在');
        return;
    }
    addCategory(name);
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
    await commit('新增分类');
}

// 密码登录弹窗：登录失败不 close（弹窗留着重试），重开不清空输入框，打开后 focus
function showPasswordDialog() {
    const overlay = document.getElementById('password-dialog-overlay');
    if (!overlay) return null;
    const p = runDialog(overlay, close => {
        const confirmBtn = getEl('password-confirm-btn');
        const cancelBtn = getEl('password-cancel-btn');
        if (confirmBtn) confirmBtn.onclick = async () => {
            const pwd = getEl('password-input').value;
            if (!pwd) return;
            const { login } = await import('./auth.js');
            if (await login(pwd)) close();
        };
        if (cancelBtn) cancelBtn.onclick = () => close();
    });
    const pwdInput = getEl('password-input');
    if (pwdInput) pwdInput.focus();
    return p;
}

export function initDialogs() {
    // 编辑模式按钮 (来自 profile dropdown)
    const editModeBtn = getEl('edit-mode-btn');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', async () => {
            const dropdown = getEl('profile-dropdown');
            if (dropdown) dropdown.classList.add('hidden');

            if (!isLoggedIn()) {
                showPasswordDialog();
                return;
            }
            setEditMode(!isEditMode());
        });
    }

    // 登录按钮
    const loginBtn = getEl('login-Btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            if (!isLoggedIn()) {
                showPasswordDialog();
            } else {
                if (await openConfirm('确定退出登录吗？')) {
                    const { logout } = await import('./auth.js');
                    await logout();
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
        const overlay = document.getElementById('import-chooser-overlay');
        if (!overlay) return;

        runDialog(overlay, close => {
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
            if (cancelBtn) cancelBtn.onclick = () => close();
        });
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
