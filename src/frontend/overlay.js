// overlay.js - 浮层弹窗三原语（alert / confirm / prompt），DOM 惰性创建并复用
// 动画规格与原静态 HTML 逐字一致：overlay-hidden/visible + dialog-scale-*，300ms

const OVERLAY_BASE = 'fixed inset-0 flex items-center justify-center p-4 transition-opacity duration-300 overlay-hidden';
const BOX_BASE = 'bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-zinc-200 transform transition-all duration-300 dialog-scale-hidden';

function buildDialog(overlayId, overlayClass, innerHTML) {
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = overlayClass;
    overlay.innerHTML = innerHTML;
    overlay.classList.add('hidden');
    document.body.appendChild(overlay);
    return overlay;
}

const _dialogs = {};

function getDialog(name) {
    if (!_dialogs[name]) {
        _dialogs[name] = buildDialog(...TEMPLATES[name]());
    }
    return _dialogs[name];
}

const TEMPLATES = {
    alert: () => [
        'custom-alert-overlay',
        `${OVERLAY_BASE} z-[110] bg-heritage-dark-900/50 backdrop-blur-[2px]`,
        `<div id="custom-alert-box" class="${BOX_BASE}">
            <h3 id="custom-alert-title" class="text-lg font-bold mb-2 text-zinc-900">提示</h3>
            <p id="custom-alert-content" class="text-zinc-600 mb-6 text-sm leading-relaxed"></p>
            <div class="flex justify-end">
                <button id="custom-alert-confirm" class="px-5 py-2 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-black/20">我知道了</button>
            </div>
        </div>`
    ],
    confirm: () => [
        'custom-confirm-overlay',
        `${OVERLAY_BASE} z-[80] bg-heritage-dark-900/50 backdrop-blur-[2px]`,
        `<div id="custom-confirm-box" class="${BOX_BASE}">
            <h3 class="text-lg font-bold mb-3 text-zinc-900">确认操作</h3>
            <p id="custom-confirm-message" class="text-zinc-600 mb-6 text-sm"></p>
            <div class="flex justify-end gap-3">
                <button id="custom-confirm-cancel" class="px-4 py-2 text-sm rounded-xl text-zinc-600 hover:bg-zinc-200 transition-colors font-medium">取消</button>
                <button id="custom-confirm-ok" class="px-4 py-2 text-sm text-white bg-zinc-900 hover:bg-zinc-700 rounded-xl shadow-lg shadow-black/20 transition-colors font-medium">确定</button>
            </div>
        </div>`
    ],
    prompt: () => [
        'category-dialog',
        `${OVERLAY_BASE} z-[65] bg-heritage-dark-900/50 backdrop-blur-sm`,
        `<div id="category-dialog-box" class="${BOX_BASE}">
            <h3 id="category-dialog-title" class="text-lg font-bold mb-4 text-zinc-900">分类名称</h3>
            <input type="text" id="category-name-input" class="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-zinc-400 outline-none mb-6 text-zinc-800 transition-all" placeholder="输入分类名称">
            <div class="flex justify-end gap-3">
                <button id="category-cancel-btn" class="px-4 py-2 text-sm rounded-xl hover:bg-zinc-200 bg-zinc-100 text-zinc-600 font-medium">取消</button>
                <button id="category-confirm-btn" class="px-4 py-2 text-sm rounded-xl text-white bg-zinc-900 hover:bg-zinc-700 shadow-md font-medium">确定</button>
            </div>
        </div>`
    ],
};

function toggle(overlay, show) {
    const box = overlay.querySelector('div[id$="-box"]');
    if (show) {
        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.remove('overlay-hidden');
        overlay.classList.add('overlay-visible');
        if (box) { box.classList.remove('dialog-scale-hidden'); box.classList.add('dialog-scale-visible'); }
    } else {
        overlay.classList.remove('overlay-visible');
        overlay.classList.add('overlay-hidden');
        if (box) { box.classList.remove('dialog-scale-visible'); box.classList.add('dialog-scale-hidden'); }
        setTimeout(() => {
            if (overlay.classList.contains('overlay-hidden')) overlay.classList.add('hidden');
        }, 300);
    }
}

// 通用弹窗协议：开关动画 + 关闭即 resolve。wire(close) 负责绑定按钮（用 onclick，可重复绑定不叠加）
export function runDialog(overlay, wire) {
    return new Promise(resolve => {
        const close = (val) => {
            toggle(overlay, false);
            resolve(val);
        };
        wire(close);
        toggle(overlay, true);
    });
}

export function openAlert(msg) {
    const overlay = getDialog('alert');
    const content = overlay.querySelector('#custom-alert-content');
    if (content) content.textContent = msg;
    return runDialog(overlay, close => {
        const btn = overlay.querySelector('#custom-alert-confirm');
        if (btn) btn.onclick = () => close();
    });
}

export function openConfirm(msg) {
    const overlay = getDialog('confirm');
    const msgEl = overlay.querySelector('#custom-confirm-message');
    if (msgEl) msgEl.textContent = msg;
    return runDialog(overlay, close => {
        const ok = overlay.querySelector('#custom-confirm-ok');
        const cancel = overlay.querySelector('#custom-confirm-cancel');
        if (ok) ok.onclick = () => close(true);
        if (cancel) cancel.onclick = () => close(false);
    });
}

export function openPrompt(title, defaultVal = '') {
    const overlay = getDialog('prompt');
    const titleEl = overlay.querySelector('#category-dialog-title');
    const input = overlay.querySelector('#category-name-input');
    if (titleEl) titleEl.innerText = title;
    if (input) { input.value = defaultVal; }
    const p = runDialog(overlay, close => {
        const confirmBtn = overlay.querySelector('#category-confirm-btn');
        const cancelBtn = overlay.querySelector('#category-cancel-btn');
        if (confirmBtn) confirmBtn.onclick = () => close(input ? input.value.trim() : null);
        if (cancelBtn) cancelBtn.onclick = () => close(null);
    });
    if (input) input.focus();
    return p;
}
