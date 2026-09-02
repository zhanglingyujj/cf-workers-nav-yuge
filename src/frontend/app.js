// app.js - 前端入口
import { initRender } from './render.js';
import { getEl, clearElCache } from './utils.js';
import { setEditMode, setLoggedIn } from './state.js';
import { initDialogs } from './dialogs.js';
import { initDrag } from './drag.js';

document.addEventListener('DOMContentLoaded', async () => {
    initRender();

    // 立即加载链接数据（一次请求获取数据 + auth 状态）
    const { loadLinks } = await import('./auth.js');
    loadLinks();

    loadBackgroundSettings();

    // 初始化 UI 组件 (来自 workers.js L657-765)
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

// 自定义背景 + 遮罩 (服务器持久化)
    const bgImageInput = getEl('bg-image-input');
    const bgOpacitySlider = getEl('bg-opacity-slider');
    const bgOpacityValue = getEl('bg-opacity-value');
    const customBgImage = document.getElementById('custom-bg-image');
    const bgMask = document.getElementById('bg-mask');

    function applyBgImage(url) {
        if (url && customBgImage) {
            const blurVal = bgBlurSlider ? parseInt(bgBlurSlider.value) : 0;
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
        bgMask.style.backgroundColor = `rgba(13, 14, 16, ${val / 100})`;
    }

// 从服务器加载设置 (公开接口, 无鉴权)；服务器无值时回退 localStorage 镜像
    async function loadBackgroundSettings() {
        let settings = null;
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Not available');
            settings = await res.json();
        } catch (e) {
            settings = null;
        }

        const hasServerValue = settings && (
            'backgroundImage' in settings || 'backgroundOpacity' in settings || 'backgroundBlur' in settings
        );
        if (!hasServerValue) {
            settings = {
                backgroundImage: localStorage.getItem('backgroundImage') || '',
                backgroundOpacity: localStorage.getItem('backgroundOpacity') !== null
                    ? parseInt(localStorage.getItem('backgroundOpacity')) : 20,
                backgroundBlur: localStorage.getItem('backgroundBlur') !== null
                    ? parseInt(localStorage.getItem('backgroundBlur')) : 0,
            };
        } else {
            // 镜像到 localStorage，保证下次离线/降级时也有值
            localStorage.setItem('backgroundImage', settings.backgroundImage || '');
            if ('backgroundOpacity' in settings) localStorage.setItem('backgroundOpacity', String(settings.backgroundOpacity));
            if ('backgroundBlur' in settings) localStorage.setItem('backgroundBlur', String(settings.backgroundBlur));
        }

        const imgUrl = settings.backgroundImage || '';
        const opacity = Number.isFinite(+settings.backgroundOpacity) && settings.backgroundOpacity !== null
            ? +settings.backgroundOpacity : 20;
        const blurVal = Number.isFinite(+settings.backgroundBlur) && settings.backgroundBlur !== null
            ? +settings.backgroundBlur : 0;

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
    }

    // 立即镜像到 localStorage，并 debounce 保存到服务器
    function persistBgSettings() {
        localStorage.setItem('backgroundImage', bgImageInput ? bgImageInput.value.trim() : '');
        localStorage.setItem('backgroundOpacity', String(bgOpacitySlider ? parseInt(bgOpacitySlider.value) : 20));
        localStorage.setItem('backgroundBlur', String(bgBlurSlider ? parseInt(bgBlurSlider.value) : 0));
        scheduleSaveSettings();
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
                    backgroundBlur: bgBlurSlider ? parseInt(bgBlurSlider.value) : 0,
                }),
            });
        }, 500);
    }

    if (bgImageInput) {
        bgImageInput.addEventListener('input', () => {
            const url = bgImageInput.value.trim();
            applyBgImage(url);
            persistBgSettings();
        });
    }

    if (bgOpacitySlider && bgOpacityValue) {
        bgOpacitySlider.addEventListener('input', () => {
            const val = parseInt(bgOpacitySlider.value);
            bgOpacityValue.textContent = val + '%';
            applyBgOpacity(val);
            persistBgSettings();
        });
    }

    const bgBlurSlider = getEl('bg-blur-slider');
    const bgBlurValue = getEl('bg-blur-value');
    if (bgBlurSlider && bgBlurValue && customBgImage) {
        bgBlurSlider.addEventListener('input', () => {
            const val = parseInt(bgBlurSlider.value);
            bgBlurValue.textContent = val + 'px';
            if (customBgImage.style.backgroundImage) {
                customBgImage.style.filter = `blur(${val}px)`;
            }
            persistBgSettings();
        });
    }

    // 搜索引擎初始化
    const { initSearchEngines } = await import('./search.js');
initSearchEngines(searchEngineBtn, searchEngineMenu, searchInput);

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
