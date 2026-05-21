// app.js - 前端入口
import { initRender } from './render.js';
import { getEl, clearElCache } from './utils.js';
import { setAppLayout, isAppLayout, setEditMode, setLoggedIn } from './state.js';

// 暗色模式初始化 (对应 workers.js L153-167)
(function initDarkMode() {
    let isDark;
    const savePreferences = localStorage.getItem('savePreferences');
    if (savePreferences === 'true') {
        const savedTheme = localStorage.getItem('theme');
        isDark = savedTheme === 'dark';
    } else {
        const hour = new Date().getHours();
        isDark = (hour >= 21 || hour < 6);
    }
    window.isDarkTheme = isDark;
    if (isDark) document.documentElement.classList.add('dark');
})();

document.addEventListener('DOMContentLoaded', async () => {
    initRender();

    // 初始化 UI 组件 (来自 workers.js L657-765)
    const themeSwitch = getEl('theme-switch-checkbox');
    const layoutSwitch = getEl('layout-switch-checkbox');
    const savePrefCheckbox = getEl('save-preference-checkbox');
    const searchInput = getEl('search-input');
    const clearSearchBtn = getEl('clear-search-button');
    const searchBtn = getEl('search-button');
    const backToTopBtn = getEl('back-to-top-btn');
    const menuToggleBtn = getEl('profile-menu-toggle');
    const dropdown = getEl('profile-dropdown');
    const dropdownWrapper = getEl('profile-dropdown-wrapper');
    const searchEngineBtn = getEl('search-engine-btn');
    const searchEngineMenu = getEl('search-engine-menu');
    const searchWrapper = getEl('search-engine-wrapper');

    if (themeSwitch) {
        themeSwitch.checked = document.documentElement.classList.contains('dark');
        themeSwitch.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            window.isDarkTheme = isDark;
            if (isDark) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            if (savePrefCheckbox && savePrefCheckbox.checked) {
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            }
        });
    }

    if (layoutSwitch) layoutSwitch.checked = isAppLayout();

    if (savePrefCheckbox) {
        savePrefCheckbox.checked = localStorage.getItem('savePreferences') === 'true';
        savePrefCheckbox.addEventListener('change', () => {
            const enabled = savePrefCheckbox.checked;
            localStorage.setItem('savePreferences', enabled);
            if (!enabled) {
                localStorage.removeItem('searchEngine');
                localStorage.removeItem('theme');
            }
        });
    }

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
        if (searchWrapper && !searchWrapper.contains(e.target)) {
            searchEngineMenu.classList.add('hidden');
        }
    });

    if (dropdown) {
        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            const { doSearch } = await import('./search.js');
            doSearch(query);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchBtn.click();
        });

        searchInput.addEventListener('input', (e) => {
            if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !e.target.value);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', async () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            const { renderAll } = await import('./render.js');
            renderAll();
        });
    }

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            backToTopBtn.classList.toggle('hidden', window.scrollY <= 300);
        }, { passive: true });
    }

    // 搜索引擎初始化
    const { initSearchEngines } = await import('./search.js');
    initSearchEngines(searchEngineBtn, searchEngineMenu, savePrefCheckbox, searchInput);

    // 工具提示
    const { initTooltip } = await import('./tooltip.js');
    initTooltip();

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

    // 加载数据
    const { checkLoginStatusAndLoad } = await import('./auth.js');
    await checkLoginStatusAndLoad();
});
