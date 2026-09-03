// app.js - 前端入口
import { initRender } from './render.js';
import { getEl } from './utils.js';
import { setEditMode, setLoggedIn } from './state.js';
import { initDialogs } from './dialogs.js';
import { initDrag } from './drag.js';
import { initBackground } from './background.js';

document.addEventListener('DOMContentLoaded', async () => {
    initRender();

    // 立即加载链接数据（一次请求获取数据 + auth 状态）
    const { load } = await import('./auth.js');
    load();

    // 壁纸/遮罩/模糊设置（独立模块）
    initBackground();

    // 初始化 UI 组件
    const backToTopBtn = getEl('back-to-top-btn');
    const menuToggleBtn = getEl('profile-menu-toggle');
    const dropdown = getEl('profile-dropdown');
    const dropdownWrapper = getEl('profile-dropdown-wrapper');

    // 命令条 + 命令面板
    const { initCommandBar } = await import('./command.js');
    initCommandBar();

if (menuToggleBtn && dropdown) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    if (dropdown) {
        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    if (backToTopBtn) {
        let backTopRaf = false;
        window.addEventListener('scroll', () => {
            if (backTopRaf) return;
            backTopRaf = true;
            requestAnimationFrame(() => {
                backTopRaf = false;
                backToTopBtn.classList.toggle('backtop-hidden', window.scrollY <= 300);
            });
        }, { passive: true });
    }

    // 工具提示
    const { initTooltip } = await import('./tooltip.js');
    initTooltip();

    // 弹窗和按钮事件绑定
    initDialogs();

    // 卡片点击 + 编辑模式关闭菜单
    const sectionsContainer = getEl('sections-container');
    if (sectionsContainer) {
        const { isEditMode } = await import('./state.js');
        sectionsContainer.addEventListener('click', (e) => {
            if (isEditMode()) return;
            const card = e.target.closest('.card');
            if (card && !e.target.closest('button') && !e.target.closest('.card-menu-dropdown')) {
                let url = card.getAttribute('data-url');
                if (url) {
                    if (!url.startsWith('http')) url = 'http://' + url;
                    window.open(url, '_blank');
                }
            }
        });
    }

    // 全局点击关闭卡片菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.card-menu-dropdown') && !e.target.closest('.card button')) {
            document.querySelectorAll('.card-menu-dropdown').forEach(el => el.classList.add('hidden'));
        }
    });

    // 拖拽事件
    if (sectionsContainer) initDrag(sectionsContainer);

    // 全局快捷键
    const { initShortcuts } = await import('./shortcuts.js');
    initShortcuts();

    // PWA：注册 service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        });
    }
});
