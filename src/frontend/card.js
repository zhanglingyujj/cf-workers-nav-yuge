// card.js - 卡片 DOM 元素创建/更新（Sun-Panel 对齐：详情卡 / 极简卡）
import { isEditMode, isLoggedIn, isCategoryAppLayout, removeLink, updateLink } from './state.js';
import { getEl } from './utils.js';

const imgApi = '/api/icon?url=';
const fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='12' y1='8' x2='12' y2='12'%3E%3C/line%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'%3E%3C/line%3E%3C/svg%3E";

// Sun-Panel 默认卡片底色 #2a2a2a6b
const DEFAULT_CARD_BG = 'rgba(42, 42, 42, 0.42)';

export function cardBackgroundColor(link) {
    return link.backgroundColor || DEFAULT_CARD_BG;
}

// 照搬 Sun-Panel：按背景亮度自动黑白文字
function textColorForBackground(bg) {
    let r = 42, g = 42, b = 42;
    const m = /^#([0-9a-f]{3,8})$/i.exec(bg || '');
    if (m) {
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1A1C1E' : '#FFFFFF';
}

export function createCardElement(link) {
    if (!isEditMode() && link.isPrivate && !isLoggedIn()) return null;

    const isApp = isCategoryAppLayout(link.category);
    const card = document.createElement('div');
    card.className = isApp
        ? 'group relative h-full w-full flex flex-col items-center justify-start py-1 transition-all duration-200 cursor-pointer select-none card'
        : 'group relative h-full w-full flex items-center px-2 py-2 rounded-2xl transition-all duration-200 cursor-pointer select-none card hover:shadow-[0_0_20px_10px_rgba(0,0,0,0.2)]';

    if (isEditMode()) {
        card.setAttribute('draggable', 'true');
        card.classList.add('cursor-move');
    }

    card.dataset.isPrivate = link.isPrivate;
    card.dataset.url = link.url;

    const bg = cardBackgroundColor(link);

    if (isApp) {
        // 极简卡：70px 图标槽（玻璃底在槽上）+ 下方居中标题，无描述
        const iconSlot = document.createElement('div');
        iconSlot.className = 'w-[70px] h-[70px] rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-200 hover:shadow-[0_0_20px_10px_rgba(0,0,0,0.2)]';
        iconSlot.style.backgroundColor = bg;
        iconSlot.appendChild(createIconImage(link, 'w-[50px] h-[50px] object-contain'));
        card.appendChild(iconSlot);

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none text-center text-sm mt-[2px] w-full truncate px-1 text-white drop-shadow-sm';
        title.textContent = link.name;
        card.appendChild(title);
    } else {
        // 详情卡：70px 图标槽居左 + 右侧名称/描述，玻璃底在整卡，文字按背景亮度黑白
        card.style.backgroundColor = bg;
        card.style.color = textColorForBackground(bg);

        const iconSlot = document.createElement('div');
        iconSlot.className = 'w-[70px] h-[70px] flex-shrink-0 flex items-center justify-center';
        iconSlot.appendChild(createIconImage(link, 'w-[50px] h-[50px] object-contain rounded-xl overflow-hidden pointer-events-none'));
        card.appendChild(iconSlot);

        const textBlock = document.createElement('div');
        textBlock.className = 'flex-1 min-w-0 ml-2 flex flex-col justify-center';

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none font-semibold text-sm truncate';
        title.textContent = link.name;
        textBlock.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'text-xs line-clamp-2 card-tip leading-relaxed opacity-80 pointer-events-none';
        desc.textContent = link.tips || '';
        textBlock.appendChild(desc);

        card.appendChild(textBlock);
    }

    if (isEditMode()) {
        card.appendChild(createEditControls(link, card));
    }

    if (!isEditMode() && link.tips) {
        card.classList.add('has-tooltip');
        card.setAttribute('data-tooltip', link.tips);
    }

    return card;
}

export function updateCardElement(card, newLink) {
    card.dataset.url = newLink.url;
    card.dataset.isPrivate = newLink.isPrivate;
    card.setAttribute('data-url', newLink.url);

    const titleEl = card.querySelector('.card-title');
    if (titleEl) titleEl.textContent = newLink.name;

    const descEl = card.querySelector('.card-tip');
    if (descEl) descEl.textContent = newLink.tips || '';

    const imgEl = card.querySelector('img');
    if (imgEl) {
        const newSrc = (!newLink.icon || (!newLink.icon.startsWith('http') && !newLink.icon.startsWith('data:')))
            ? imgApi + newLink.url
            : newLink.icon;
        if (imgEl.src !== newSrc) {
            imgEl.src = newSrc;
        }
    }

    const bg = cardBackgroundColor(newLink);
    if (isCategoryAppLayout(newLink.category)) {
        const slot = card.querySelector(':scope > div');
        if (slot) slot.style.backgroundColor = bg;
    } else {
        card.style.backgroundColor = bg;
        card.style.color = textColorForBackground(bg);
    }

    if (!isEditMode() && newLink.tips) {
        card.classList.add('has-tooltip');
        card.setAttribute('data-tooltip', newLink.tips);
    }
}

function createIconImage(link, className) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.className = className;

    const src = (!link.icon || (!link.icon.startsWith('http') && !link.icon.startsWith('data:')))
        ? imgApi + link.url
        : link.icon;
    img.src = src;
    img.onerror = function () {
        if (this.src !== fallbackSrc) {
            this.src = fallbackSrc;
        }
    };

    return img;
}

function createEditControls(link, card) {
    const actionWrapper = document.createElement('div');
    actionWrapper.className = isCategoryAppLayout(link.category)
        ? 'absolute top-[-4px] right-[-4px] z-50'
        : 'absolute top-2 right-2 z-50';

    const menuBtn = document.createElement('button');
    const btnStyle = isCategoryAppLayout(link.category)
        ? 'w-6 h-6 rounded-full bg-heritage-dark-700 text-heritage-dark-300 shadow-sm hover:bg-heritage-500 hover:text-white'
        : 'w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-heritage-dark-700/80 backdrop-blur-sm';

    menuBtn.className = `${btnStyle} flex items-center justify-center transition-all duration-200`;
    menuBtn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';

    const dropdown = document.createElement('div');
    dropdown.className = 'hidden fixed w-28 bg-heritage-dark-800 rounded-xl shadow-xl ring-1 ring-white/10 overflow-hidden transform origin-top-right transition-all z-[9999] flex flex-col p-1 card-menu-dropdown';
    document.body.appendChild(dropdown);

    dropdown.innerHTML = `
        <button class="menu-edit w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-heritage-outline hover:bg-heritage-dark-700/50 hover:text-heritage-600 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            编辑
        </button>
        <button class="menu-delete w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-heritage-outline hover:bg-red-900/20 hover:text-red-500 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            删除
        </button>
    `;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnRect = menuBtn.getBoundingClientRect();
        let top = btnRect.top + btnRect.height + 4;
        let left = btnRect.right - 112;
        if (left < 0) left = btnRect.left;
        if (top + 100 > window.innerHeight) top = btnRect.top - 100;
        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';
        document.querySelectorAll('.card-menu-dropdown').forEach(el => {
            if (el !== dropdown) el.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
    });

    dropdown.querySelector('.menu-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        import('./dialogs.js').then(m => m.showEditDialog(link));
    });

    dropdown.querySelector('.menu-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        import('./dialogs.js').then(m => m.removeCard(card));
    });

    actionWrapper.appendChild(menuBtn);
    return actionWrapper;
}
