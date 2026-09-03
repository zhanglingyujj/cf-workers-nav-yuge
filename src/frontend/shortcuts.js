// shortcuts.js - 全局快捷键
// '/' 打开命令面板、非编辑模式数字键 1-9 打开对应卡片
import { isEditMode } from './state.js';

export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

        if (e.key === '/') {
            e.preventDefault();
            import('./command.js').then(m => m.openPalette());
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
