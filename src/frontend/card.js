// card.js - 卡片 DOM 元素创建/更新（Sun-Panel 对齐：详情卡 / 极简卡）
import { isEditMode, isLoggedIn, isCategoryAppLayout, removeLink, updateLink, findLinkById } from './state.js';
import { getEl } from './utils.js';

const imgApi = '/api/icon?url=';
const fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='12' y1='8' x2='12' y2='12'%3E%3C/line%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'%3E%3C/line%3E%3C/svg%3E";

// Sun-Panel 默认详情卡底色 #2a2a2a6b；Q7 定为 0.40（可读性兑底，见 DESIGN.md）
const DEFAULT_CARD_BG = 'rgba(42, 42, 42, 0.40)';
// 图标投影兜底：透明/白色线条图标无衬底时靠它压住亮壁纸（Q10 取消了默认槽底）
const ICON_SHADOW = 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]';
const ICON_HOVER_SHADOW = 'hover:drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]';

export function cardBackgroundColor(link, categoryName) {
    // 极简卡默认无底（Q10：图标原样呈现，仅自定义色时渲染）；详情卡默认玻璃底
    if (isCategoryAppLayout(categoryName || link.category)) {
        return link.backgroundColor || '';
    }
    return link.backgroundColor || DEFAULT_CARD_BG;
}

// 照搬 Sun-Panel 亮度算法，半透明色按叠加深底（42,42,42）后的合成色计算
function textColorForBackground(bg) {
    let r = 42, g = 42, b = 42, alpha = 1;
    const m = /^#([0-9a-f]{3,8})$/i.exec(bg || '');
    if (m) {
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        if (hex.length === 8) alpha = parseInt(hex.substring(6, 8), 16) / 255;
    }
    // 合成到深色玻璃底 (42,42,42)
    r = Math.round(r * alpha + 42 * (1 - alpha));
    g = Math.round(g * alpha + 42 * (1 - alpha));
    b = Math.round(b * alpha + 42 * (1 - alpha));
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1A1C1E' : '#FFFFFF';
}

export function createCardElement(link, categoryName) {
    if (!isEditMode() && link.isPrivate && !isLoggedIn()) return null;

    const isApp = isCategoryAppLayout(categoryName || link.category);
    const card = document.createElement('div');
    card.className = isApp
        ? 'group relative h-full w-full flex flex-col items-center justify-start py-1 transition-all duration-200 cursor-pointer select-none card'
        : 'group relative h-full w-full flex items-center px-1.5 py-1 rounded-2xl border border-white/[0.08] transition-all duration-200 cursor-pointer select-none card hover:shadow-[0_0_20px_10px_rgba(0,0,0,0.2)]';

    if (isEditMode()) {
        card.setAttribute('draggable', 'true');
        card.classList.add('cursor-move');
    }

    card.dataset.isPrivate = link.isPrivate;
    card.dataset.url = link.url;
    card.dataset.cardId = link.id;

    const bg = cardBackgroundColor(link, categoryName);

    if (isApp) {
        // 极简卡：图标原样呈现（Q10 无默认槽底，仅自定义色时渲染），下方居中标题
        const iconSlot = document.createElement('div');
        iconSlot.className = 'w-[56px] h-[56px] rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-200';
        if (bg) iconSlot.style.backgroundColor = bg;
        iconSlot.appendChild(createIconImage(link, `w-[52px] h-[52px] object-contain p-[3px] ${ICON_SHADOW} ${ICON_HOVER_SHADOW}`));
        card.appendChild(iconSlot);

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none text-center text-xs sm:text-sm font-medium mt-[2px] w-full truncate px-1 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]';
        title.textContent = link.name;
        card.appendChild(title);
    } else {
        // 详情卡：图标槽居左（透明，图标原样不裁剪）+ 右侧名称/描述，玻璃底在整卡，文字按背景亮度黑白
        card.style.backgroundColor = bg || DEFAULT_CARD_BG;
        card.style.color = textColorForBackground(bg || DEFAULT_CARD_BG);

        const iconSlot = document.createElement('div');
        iconSlot.className = 'w-[56px] h-[56px] flex-shrink-0 flex items-center justify-center';
        iconSlot.appendChild(createIconImage(link, `w-[44px] h-[44px] object-contain p-[3px] ${ICON_SHADOW} pointer-events-none`));
        card.appendChild(iconSlot);

        const textBlock = document.createElement('div');
        textBlock.className = 'flex-1 min-w-0 ml-1.5 flex flex-col justify-center';

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none font-semibold text-xs sm:text-sm truncate';
        title.textContent = link.name;
        textBlock.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'text-xs line-clamp-2 card-tip leading-relaxed opacity-80 pointer-events-none';
        desc.textContent = link.tips || '';
        textBlock.appendChild(desc);

        card.appendChild(textBlock);
    }

    if (isEditMode()) {
        card.appendChild(createEditControls(card, isApp, categoryName));
    }

    applyTooltip(card, link, isApp);

    return card;
}

export function updateCardElement(card, newLink, categoryName) {
    card.dataset.url = newLink.url;
    card.dataset.isPrivate = newLink.isPrivate;
    card.dataset.cardId = newLink.id;
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

    const bg = cardBackgroundColor(newLink, categoryName);
    if (isCategoryAppLayout(categoryName || newLink.category)) {
        const slot = card.querySelector(':scope > div');
        if (slot) slot.style.backgroundColor = bg;
    } else {
        card.style.backgroundColor = bg;
        card.style.color = textColorForBackground(bg);
    }

    applyTooltip(card, newLink, isCategoryAppLayout(categoryName || newLink.category));
}

// 悬停提示：仅详情卡在有描述时提示；APP 布局名称常显在图标下方，不再悬停提示
function applyTooltip(card, link, isApp) {
    if (isEditMode() || isApp) {
        card.classList.remove('has-tooltip');
        card.removeAttribute('data-tooltip');
    } else if (link.tips) {
        card.classList.add('has-tooltip');
        card.setAttribute('data-tooltip', link.tips);
    } else {
        card.classList.remove('has-tooltip');
        card.removeAttribute('data-tooltip');
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

// 共享单例编辑菜单：全站一份，打开时按卡片绑定动作，避免每卡一个 body 级下拉泄漏
let _sharedMenu = null;
let _sharedMenuBtn = null;

function getSharedMenu() {
    if (_sharedMenu) return _sharedMenu;

    const dropdown = document.createElement('div');
    dropdown.className = 'hidden fixed w-28 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl shadow-black/20 border border-zinc-200 overflow-hidden transform origin-top-right transition-all z-[9999] flex flex-col p-1 card-menu-dropdown';

    dropdown.innerHTML = `
        <button class="menu-edit w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            编辑
        </button>
        <button class="menu-delete w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            删除
        </button>
    `;
    document.body.appendChild(dropdown);
    _sharedMenu = dropdown;
    return dropdown;
}

function openCardMenu(menuBtn, card, categoryName) {
    const dropdown = getSharedMenu();
    const btnRect = menuBtn.getBoundingClientRect();
    // 锚到卡片整体下方而非按钮下方，避免菜单盖住触发卡本身（Q6）
    const cardRect = card.getBoundingClientRect();
    let top = cardRect.bottom + 4;
    let left = btnRect.right - 112;
    if (left < 0) left = btnRect.left;
    if (top + 100 > window.innerHeight) top = cardRect.top - 104;
    dropdown.style.top = top + 'px';
    dropdown.style.left = left + 'px';

    dropdown.querySelector('.menu-edit').onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        _sharedMenuBtn = null;
        // 点击时按卡片 id 现查：闭包捕获的 link 是创建卡片时的旧对象，编辑确认后 state 已替换为新对象
        const current = findLinkById(card.getAttribute('data-card-id'));
        if (current) {
            import('./dialogs.js').then(m => m.showEditDialog(current, categoryName));
        }
    };
    dropdown.querySelector('.menu-delete').onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        _sharedMenuBtn = null;
        import('./dialogs.js').then(m => m.removeCard(card));
    };

    if (!dropdown.classList.contains('hidden') && _sharedMenuBtn === menuBtn) {
        dropdown.classList.add('hidden');
        _sharedMenuBtn = null;
    } else {
        dropdown.classList.remove('hidden');
        _sharedMenuBtn = menuBtn;
    }
}

function createEditControls(card, isApp, categoryName) {
    const actionWrapper = document.createElement('div');
    actionWrapper.className = isApp
        ? 'absolute top-[-4px] right-[-4px] z-50'
        : 'absolute top-2 right-2 z-50';

    const menuBtn = document.createElement('button');
    const btnStyle = 'w-6 h-6 rounded-full bg-heritage-dark-900/70 ring-1 ring-white/10 backdrop-blur-sm text-heritage-dark-200 hover:bg-white hover:text-heritage-dark-900 hover:ring-white shadow-sm';

    menuBtn.className = `${btnStyle} flex items-center justify-center transition-all duration-200`;
    menuBtn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardMenu(menuBtn, card, categoryName);
    });

    actionWrapper.appendChild(menuBtn);
    return actionWrapper;
}
