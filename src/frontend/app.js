// app.js - 前端入口
import { initRender } from './render.js';
import { getEl, clearElCache } from './utils.js';
<<<<<<< HEAD
import { setEditMode, setLoggedIn } from './state.js';
import { initDialogs } from './dialogs.js';
import { initDrag } from './drag.js';

=======
import { setAppLayout, isAppLayout, setEditMode, setLoggedIn } from './state.js';
import { initDialogs } from './dialogs.js';
import { initDrag } from './drag.js';

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

>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
document.addEventListener('DOMContentLoaded', async () => {
    initRender();

    // 初始化 UI 组件 (来自 workers.js L657-765)
    const themeSwitch = getEl('theme-switch-checkbox');
<<<<<<< HEAD
    const darkModeToggleBtn = getEl('dark-mode-toggle-btn');
=======
    const layoutSwitch = getEl('layout-switch-checkbox');
    const savePrefCheckbox = getEl('save-preference-checkbox');
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
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

<<<<<<< HEAD
    if (darkModeToggleBtn) {
        darkModeToggleBtn.addEventListener('click', () => {
            const isDark = !document.documentElement.classList.contains('dark');
            window.isDarkTheme = isDark;
            if (isDark) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
=======
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
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
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

<<<<<<< HEAD
    // 自定义背景 + 遮罩 (服务器持久化)
=======
    // 自定义背景 + 遮罩
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
    const bgImageInput = getEl('bg-image-input');
    const bgOpacitySlider = getEl('bg-opacity-slider');
    const bgOpacityValue = getEl('bg-opacity-value');
    const customBgImage = document.getElementById('custom-bg-image');
    const bgMask = document.getElementById('bg-mask');

    function applyBgImage(url) {
<<<<<<< HEAD
        if (url && customBgImage) {
            const blurVal = bgBlurSlider ? parseInt(bgBlurSlider.value) : 2;
=======
        const blurVal = parseInt(localStorage.getItem('backgroundBlur')) || 2;
        if (url && customBgImage) {
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
            customBgImage.style.backgroundImage = `url(${url})`;
            customBgImage.style.filter = `blur(${blurVal}px)`;
            customBgImage.style.transform = 'scale(1.05)';
            customBgImage.style.opacity = '1';
        } else if (customBgImage) {
            customBgImage.style.backgroundImage = '';
            customBgImage.style.filter = '';
            customBgImage.style.transform = '';
            customBgImage.style.opacity = '0';
        }
    }

    function applyBgOpacity(val) {
        if (!bgMask) return;
        const pct = val / 100;
        const isDark = document.documentElement.classList.contains('dark');
        bgMask.style.backgroundColor = isDark
            ? `rgba(13, 14, 16, ${pct})`
            : `rgba(247, 245, 242, ${pct})`;
    }

<<<<<<< HEAD
    // 从服务器加载设置 (公开接口, 无鉴权)
    async function loadBackgroundSettings() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Not available');
            const settings = await res.json();
            const imgUrl = settings.backgroundImage || '';
            const opacity = settings.backgroundOpacity || 20;
            const blurVal = settings.backgroundBlur || 2;
            if (bgImageInput) bgImageInput.value = imgUrl;
            if (bgOpacitySlider && bgOpacityValue) {
                bgOpacitySlider.value = opacity;
                bgOpacityValue.textContent = opacity + '%';
                applyBgOpacity(opacity);
            }
            if (bgBlurSlider && bgBlurValue) {
                bgBlurSlider.value = blurVal;
                bgBlurValue.textContent = blurVal + 'px';
            }
            applyBgImage(imgUrl);
        } catch (e) {
            // Fallback 到 localStorage
            const imgUrl = localStorage.getItem('backgroundImage') || '';
            const opacityVal = localStorage.getItem('backgroundOpacity');
            const blurVal = localStorage.getItem('backgroundBlur');
            if (bgImageInput) bgImageInput.value = imgUrl;
            applyBgImage(imgUrl);
            if (bgOpacitySlider && bgOpacityValue && opacityVal !== null) {
                const opacity = parseInt(opacityVal) || 20;
                bgOpacitySlider.value = opacity;
                bgOpacityValue.textContent = opacity + '%';
                applyBgOpacity(opacity);
            }
            if (bgBlurSlider && bgBlurValue && blurVal !== null) {
                const blur = parseInt(blurVal) || 2;
                bgBlurSlider.value = blur;
                bgBlurValue.textContent = blur + 'px';
            }
        }
    }

    // debounce 保存到服务器
    let _saveSettingsTimer = null;
    function scheduleSaveSettings() {
        if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer);
        _saveSettingsTimer = setTimeout(async () => {
            const { fetchWithAuth, validateTokenOrRedirect } = await import('./auth.js');
            if (!(await validateTokenOrRedirect())) return;
            await fetchWithAuth('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    backgroundImage: bgImageInput ? bgImageInput.value.trim() : '',
                    backgroundOpacity: bgOpacitySlider ? parseInt(bgOpacitySlider.value) : 20,
                    backgroundBlur: bgBlurSlider ? parseInt(bgBlurSlider.value) : 2,
                }),
            });
        }, 500);
    }

    if (bgImageInput) {
        bgImageInput.addEventListener('input', () => {
            const url = bgImageInput.value.trim();
            applyBgImage(url);
            scheduleSaveSettings();
=======
    if (bgImageInput) {
        const saved = localStorage.getItem('backgroundImage') || '';
        bgImageInput.value = saved;
        applyBgImage(saved);
        bgImageInput.addEventListener('input', () => {
            const url = bgImageInput.value.trim();
            localStorage.setItem('backgroundImage', url);
            applyBgImage(url);
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
        });
    }

    if (bgOpacitySlider && bgOpacityValue) {
<<<<<<< HEAD
        bgOpacitySlider.addEventListener('input', () => {
            const val = parseInt(bgOpacitySlider.value);
            bgOpacityValue.textContent = val + '%';
            applyBgOpacity(val);
            scheduleSaveSettings();
=======
        const saved = parseInt(localStorage.getItem('backgroundOpacity')) || 20;
        bgOpacitySlider.value = saved;
        bgOpacityValue.textContent = saved + '%';
        applyBgOpacity(saved);
        bgOpacitySlider.addEventListener('input', () => {
            const val = parseInt(bgOpacitySlider.value);
            localStorage.setItem('backgroundOpacity', val);
            bgOpacityValue.textContent = val + '%';
            applyBgOpacity(val);
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
        });
    }

    const bgBlurSlider = getEl('bg-blur-slider');
    const bgBlurValue = getEl('bg-blur-value');
    if (bgBlurSlider && bgBlurValue && customBgImage) {
<<<<<<< HEAD
        bgBlurSlider.addEventListener('input', () => {
            const val = parseInt(bgBlurSlider.value);
=======
        const savedBlur = parseInt(localStorage.getItem('backgroundBlur')) || 2;
        bgBlurSlider.value = savedBlur;
        bgBlurValue.textContent = savedBlur + 'px';
        if (customBgImage.style.backgroundImage) {
            customBgImage.style.filter = `blur(${savedBlur}px)`;
        }
        bgBlurSlider.addEventListener('input', () => {
            const val = parseInt(bgBlurSlider.value);
            localStorage.setItem('backgroundBlur', val);
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
            bgBlurValue.textContent = val + 'px';
            if (customBgImage.style.backgroundImage) {
                customBgImage.style.filter = `blur(${val}px)`;
            }
<<<<<<< HEAD
            scheduleSaveSettings();
=======
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
        });
    }

    // 搜索引擎初始化
    const { initSearchEngines } = await import('./search.js');
<<<<<<< HEAD
    initSearchEngines(searchEngineBtn, searchEngineMenu, searchInput);
=======
    initSearchEngines(searchEngineBtn, searchEngineMenu, savePrefCheckbox, searchInput);
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de

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

<<<<<<< HEAD
    // 并行加载数据和背景设置
    const { checkLoginStatusAndLoad } = await import('./auth.js');
    await Promise.all([checkLoginStatusAndLoad(), loadBackgroundSettings()]);
=======
    // 加载数据
    const { checkLoginStatusAndLoad } = await import('./auth.js');
    await checkLoginStatusAndLoad();
>>>>>>> 8794ea6a7a21414ca907e492fc7d46678fc868de
});
