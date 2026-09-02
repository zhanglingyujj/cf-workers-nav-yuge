// background.js - 壁纸/遮罩/模糊设置：加载（服务器优先 + localStorage 回退镜像）、实时预览、防抖持久化
import { getEl } from './utils.js';

const DEFAULTS = { backgroundImage: '', backgroundOpacity: 20, backgroundBlur: 0 };

// 纯函数：合并服务器设置与 localStorage 回退（服务器无值时降级，有值时镜像回写由调用方处理）
export function resolveSettings(serverSettings, storage = localStorage) {
    const hasServerValue = serverSettings && (
        'backgroundImage' in serverSettings
        || 'backgroundOpacity' in serverSettings
        || 'backgroundBlur' in serverSettings
    );

    if (!hasServerValue) {
        const storedOpacity = storage.getItem('backgroundOpacity');
        const storedBlur = storage.getItem('backgroundBlur');
        return {
            backgroundImage: storage.getItem('backgroundImage') || '',
            backgroundOpacity: storedOpacity !== null ? parseInt(storedOpacity) : DEFAULTS.backgroundOpacity,
            backgroundBlur: storedBlur !== null ? parseInt(storedBlur) : DEFAULTS.backgroundBlur,
        };
    }
    return {
        backgroundImage: serverSettings.backgroundImage || '',
        backgroundOpacity: pickNumber(serverSettings.backgroundOpacity, DEFAULTS.backgroundOpacity),
        backgroundBlur: pickNumber(serverSettings.backgroundBlur, DEFAULTS.backgroundBlur),
    };
}

function pickNumber(v, fallback) {
    return Number.isFinite(+v) && v !== null ? +v : fallback;
}

export function initBackground() {
    const bgImageInput = getEl('bg-image-input');
    const bgOpacitySlider = getEl('bg-opacity-slider');
    const bgOpacityValue = getEl('bg-opacity-value');
    const bgBlurSlider = getEl('bg-blur-slider');
    const bgBlurValue = getEl('bg-blur-value');
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

    async function loadBackgroundSettings() {
        let serverSettings = null;
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Not available');
            serverSettings = await res.json();
        } catch (e) {
            serverSettings = null;
        }

        const settings = resolveSettings(serverSettings);
        const fromServer = !!(serverSettings && (
            'backgroundImage' in serverSettings
            || 'backgroundOpacity' in serverSettings
            || 'backgroundBlur' in serverSettings
        ));
        if (fromServer) {
            // 镜像到 localStorage，保证下次离线/降级时也有值
            localStorage.setItem('backgroundImage', settings.backgroundImage || '');
            localStorage.setItem('backgroundOpacity', String(settings.backgroundOpacity));
            localStorage.setItem('backgroundBlur', String(settings.backgroundBlur));
        }

        if (bgImageInput) bgImageInput.value = settings.backgroundImage;
        if (bgOpacitySlider && bgOpacityValue) {
            bgOpacitySlider.value = settings.backgroundOpacity;
            bgOpacityValue.textContent = settings.backgroundOpacity + '%';
            applyBgOpacity(settings.backgroundOpacity);
        }
        if (bgBlurSlider && bgBlurValue) {
            bgBlurSlider.value = settings.backgroundBlur;
            bgBlurValue.textContent = settings.backgroundBlur + 'px';
        }
        applyBgImage(settings.backgroundImage);
    }

    // 立即镜像到 localStorage，并 debounce 保存到服务器
    function persistBgSettings() {
        localStorage.setItem('backgroundImage', bgImageInput ? bgImageInput.value.trim() : '');
        localStorage.setItem('backgroundOpacity', String(bgOpacitySlider ? parseInt(bgOpacitySlider.value) : DEFAULTS.backgroundOpacity));
        localStorage.setItem('backgroundBlur', String(bgBlurSlider ? parseInt(bgBlurSlider.value) : DEFAULTS.backgroundBlur));
        scheduleSaveSettings();
    }

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
                    backgroundOpacity: bgOpacitySlider ? parseInt(bgOpacitySlider.value) : DEFAULTS.backgroundOpacity,
                    backgroundBlur: bgBlurSlider ? parseInt(bgBlurSlider.value) : DEFAULTS.backgroundBlur,
                }),
            });
        }, 500);
    }

    if (bgImageInput) {
        bgImageInput.addEventListener('input', () => {
            applyBgImage(bgImageInput.value.trim());
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

    loadBackgroundSettings();
}
