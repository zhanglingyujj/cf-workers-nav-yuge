// utils.js - 通用工具

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
