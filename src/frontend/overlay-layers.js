// overlay-layers.js - 浮层开合集的单一出处：Esc 关闭最顶层（B2）与快捷键守卫（B3）共用
// 纯函数（topmostOpen/anyOpen）与 DOM 接线分离；模块顶层不触碰 document，保证 node:test 可导入

// 纯函数区（node:test 覆盖）——entries 形如 [{ id, z, open }]
export function anyOpen(entries) {
    return entries.some(e => e.open);
}

export function topmostOpen(entries) {
    let top = null;
    for (const e of entries) {
        if (!e.open) continue;
        if (!top || e.z > top.z) top = e;
    }
    return top;
}

// DOM 接线区
const OVERLAY_IDS = [
    'custom-alert-overlay', 'cmd-palette', 'import-chooser-overlay', 'custom-confirm-overlay',
    'password-dialog-overlay', 'category-dialog', 'dialog-overlay', 'profile-dropdown',
];

// 开合判定：hidden / overlay-hidden 任一在场即关（静态弹窗关闭动画期是 overlay-hidden）
function isOpenEl(el) {
    return el && !el.classList.contains('hidden') && !el.classList.contains('overlay-hidden');
}

export function collectOverlayEntries(doc = document) {
    const entries = [];
    for (const id of OVERLAY_IDS) {
        const el = doc.getElementById(id);
        if (isOpenEl(el)) {
            entries.push({ id, open: true, z: parseInt(getComputedStyle(el).zIndex) || 0 });
        }
    }
    const menu = doc.querySelector('.card-menu-dropdown');
    if (isOpenEl(menu)) {
        entries.push({ id: 'card-menu', open: true, z: parseInt(getComputedStyle(menu).zIndex) || 0 });
    }
    return entries;
}

// 需要"关闭副作用"的浮层（resolve Promise、清输入、走动画）由各自模块注册 closer；
// 未注册的（profile-dropdown、card-menu）退化为直接置 hidden
const closers = new Map();

export function registerCloser(id, fn) {
    closers.set(id, fn);
}

export function unregisterCloser(id) {
    closers.delete(id);
}

export function isAnyOverlayOpen(doc = document) {
    return anyOpen(collectOverlayEntries(doc));
}

export function closeTopOverlay(doc = document) {
    const top = topmostOpen(collectOverlayEntries(doc));
    if (!top) return false;
    const closer = closers.get(top.id);
    if (closer) {
        closer();
        return true;
    }
    const el = top.id === 'card-menu' ? doc.querySelector('.card-menu-dropdown') : doc.getElementById(top.id);
    if (el) el.classList.add('hidden');
    return true;
}

export function initOverlayLayers() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeTopOverlay();
    });
}
