// utils.js - 通用工具

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

export function rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;
    return function (...args) {
        lastArgs = args;
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                func(...lastArgs);
                rafId = null;
                lastArgs = null;
            });
        }
    };
}

let _writeQueue = [];
let _writeScheduled = false;

export function scheduleDOMWrite(fn) {
    _writeQueue.push(fn);
    if (!_writeScheduled) {
        _writeScheduled = true;
        requestAnimationFrame(() => {
            const queue = _writeQueue;
            _writeQueue = [];
            _writeScheduled = false;
            queue.forEach(f => f());
        });
    }
}

const _elCache = new Map();
export function getEl(id) {
    if (!_elCache.has(id)) {
        const el = document.getElementById(id);
        if (el) _elCache.set(id, el);
        return el;
    }
    const cached = _elCache.get(id);
    if (cached && document.contains(cached)) return cached;
    const el = document.getElementById(id);
    if (el) _elCache.set(id, el);
    return el;
}

export function clearElCache() {
    _elCache.clear();
}
