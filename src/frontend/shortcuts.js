// shortcuts.js - 全局快捷键
// '/' 聚焦搜索框、Esc 清空搜索并失焦、非编辑模式数字键 1-9 打开对应卡片
import { isEditMode } from './state.js';
import { getEl } from './utils.js';

export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        const searchInput = getEl('search-input');

        if (e.key === 'Escape') {
            if (document.activeElement === searchInput && searchInput.value) {
                searchInput.value = '';
                const clearBtn = getEl('clear-search-button');
                if (clearBtn) {
                    clearBtn.classList.remove('hidden');
                    clearBtn.click();
                } else {
                    searchInput.dispatchEvent(new Event('input'));
                }
            }
            searchInput?.blur();
            return;
        }

        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

        if (e.key === '/' && searchInput) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
            return;
        }

        if (/^[1-9]$/.test(e.key) && !isEditMode()) {
            const cards = document.querySelectorAll('#sections-container .card[data-url]');
            const visible = Array.from(cards).filter((c) => c.offsetParent !== null);
            const card = visible[parseInt(e.key, 10) - 1];
            if (card) {
                let url = card.getAttribute('data-url');
                if (url) {
                    if (!url.startsWith('http')) url = 'http://' + url;
                    window.open(url, '_blank');
                }
            }
        }
    });
}
