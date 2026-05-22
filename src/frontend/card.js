// card.js - 卡片 DOM 元素创建/更新
import { isEditMode, isLoggedIn, isAppLayout, removeLink, updateLink } from './state.js';
import { getEl } from './utils.js';

const imgApi = '/api/icon?url=';
const fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E";

export function createCardElement(link) {
    if (!isEditMode() && link.isPrivate && !isLoggedIn()) return null;

    const card = document.createElement('div');
    let cardBaseClass = isAppLayout()
        ? 'flex flex-col items-center justify-start py-2 px-2 gap-1.5 hover:z-10 bg-white/30 dark:bg-[#1e293b]/30 backdrop-blur-md shadow-sm hover:bg-white/50 dark:hover:bg-[#1e293b]/40 hover:shadow-[0_0_20px_8px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_0_20px_10px_rgba(0,0,0,0.35)] transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)]'
        : 'flex items-center px-3 py-3 bg-white/30 dark:bg-[#1e293b]/30 backdrop-blur-md hover:bg-white/50 dark:hover:bg-[#1e293b]/40 shadow-sm hover:shadow-[0_0_20px_8px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_0_20px_10px_rgba(0,0,0,0.35)] transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)]';

    if (link.isPrivate && !isAppLayout()) {
        cardBaseClass += ' ring-1 ring-amber-400/40 bg-amber-50/80 dark:bg-amber-900/10 !border-amber-200 dark:!border-amber-700/50';
    }

    card.className = `group relative h-full w-full rounded-2xl transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)] cursor-pointer select-none card ${cardBaseClass}`;

    if (isEditMode()) {
        card.setAttribute('draggable', 'true');
        card.classList.add('cursor-move');
    }

    card.dataset.isPrivate = link.isPrivate;
    card.dataset.url = link.url;

    if (isAppLayout()) {
        const header = document.createElement('div');
        header.className = 'flex flex-col items-center justify-center w-full relative';

        const iconEl = isEditMode()
            ? createIconPlaceholder(true)
            : createIconImage(link);
        header.appendChild(iconEl);

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none text-center text-xs sm:text-sm font-medium mt-1 w-[120%] truncate px-1 heritage-primary dark:text-heritage-outline drop-shadow-sm';
        title.textContent = link.name;
        header.appendChild(title);
        card.appendChild(header);
    } else {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'w-[70px] h-[70px] flex-shrink-0 flex items-center justify-center';
        const iconEl = isEditMode()
            ? createIconPlaceholder(false)
            : createIconImage(link);
        iconContainer.appendChild(iconEl);
        card.appendChild(iconContainer);

        const textBlock = document.createElement('div');
        textBlock.className = 'flex-1 min-w-0 ml-2.5 flex flex-col justify-center';

        const title = document.createElement('div');
        title.className = 'card-title pointer-events-none font-semibold text-sm truncate heritage-primary dark:text-heritage-variant group-hover:text-heritage-600 dark:group-hover:text-heritage-400 transition-colors';
        title.textContent = link.name;
        textBlock.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'text-xs text-heritage-secondary dark:text-slate-400 line-clamp-2 card-tip leading-relaxed pointer-events-none';
        desc.textContent = link.tips || '';
        textBlock.appendChild(desc);

        card.appendChild(textBlock);
    }

    if (link.isPrivate && !isAppLayout()) {
        const badge = document.createElement('div');
        badge.className = 'absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden rounded-tr-2xl';
        badge.innerHTML = '<div class="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rotate-45 w-8 h-8 bg-amber-400"></div>';
        card.appendChild(badge);
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

    if (!isEditMode() && newLink.tips) {
        card.classList.add('has-tooltip');
        card.setAttribute('data-tooltip', newLink.tips);
    }
}

function createIconPlaceholder(isApp) {
    const div = document.createElement('div');
    div.className = isApp
        ? 'w-[70px] h-[70px] rounded-2xl bg-heritage-outline/40 dark:bg-slate-600/30 backdrop-blur-sm shadow-md'
        : 'w-[50px] h-[50px] rounded-xl bg-heritage-variant/40 dark:bg-slate-900/30 backdrop-blur-sm';
    return div;
}

function createIconImage(link) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';

    let iconClass = '';
    if (isAppLayout()) {
        iconClass = 'w-[70px] h-[70px] rounded-2xl object-contain bg-white/40 dark:bg-slate-600/30 backdrop-blur-sm p-2 shadow-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95 z-10';
        if (link.isPrivate) iconClass += ' ring-2 ring-amber-400';
    } else {
        iconClass = 'w-[50px] h-[50px] rounded-xl object-contain bg-heritage-variant/40 dark:bg-slate-900/30 backdrop-blur-sm p-0.5 transition-transform duration-200 group-hover:scale-105 pointer-events-none';
    }
    img.className = iconClass;

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
    actionWrapper.className = isAppLayout()
        ? 'absolute top-[-4px] right-[-4px] z-30'
        : 'absolute top-2 right-2 z-30';

    const menuBtn = document.createElement('button');
    const btnStyle = isAppLayout()
        ? 'w-6 h-6 rounded-full bg-heritage-outline dark:bg-slate-700 text-heritage-primary dark:text-slate-300 shadow-sm hover:bg-heritage-500 hover:text-white'
        : 'w-7 h-7 rounded-lg text-slate-400 hover:text-heritage-primary hover:bg-heritage-variant/80 backdrop-blur-sm';

    menuBtn.className = `${btnStyle} flex items-center justify-center transition-all duration-200`;
    menuBtn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';

    const dropdown = document.createElement('div');
    dropdown.className = 'hidden absolute right-0 top-6 w-28 bg-white dark:bg-[#1e293b] rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden transform origin-top-right transition-all z-50 flex flex-col p-1 card-menu-dropdown';

    dropdown.innerHTML = `
        <button class="menu-edit w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-heritage-primary dark:text-heritage-outline hover:bg-heritage-50 dark:hover:bg-slate-700/50 hover:text-heritage-600 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            编辑
        </button>
        <button class="menu-delete w-full text-left px-3 py-2 rounded-lg text-xs font-medium heritage-primary dark:text-heritage-outline hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            删除
        </button>
    `;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
    actionWrapper.appendChild(dropdown);
    return actionWrapper;
}