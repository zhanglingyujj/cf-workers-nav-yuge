// state.js - 集中状态管理 + 脏标记增量渲染
// 调度器：浏览器走 requestAnimationFrame，非浏览器环境（node:test）回退 setTimeout(0)
const _scheduleFlushFrame = typeof requestAnimationFrame === 'function'
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => setTimeout(fn, 0);

let _categories = {};
let _isEditMode = false;
let _isLoggedIn = false;

const _subscribers = {};
const _dirtyCategories = new Set();
let _renderScheduled = false;
let _onFlush = null;

export function getState() {
    return {
        categories: _categories,
        isEditMode: _isEditMode,
        isLoggedIn: _isLoggedIn,
    };
}

export function getCategories() { return _categories; }
export function isEditMode() { return _isEditMode; }
export function isLoggedIn() { return _isLoggedIn; }

export function setEditMode(v) {
    _isEditMode = v;
    markAllDirty();
    flushNow();
    emit('editMode', v);
}

export function setLoggedIn(v) {
    _isLoggedIn = v;
    markAllDirty();
    flushNow();
    emit('loggedIn', v);
}

export function setAppLayout(v) {}

let _linkIdCounter = 0;

function newLinkId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'link-' + Date.now().toString(36) + '-' + (++_linkIdCounter);
}

// 惰性迁移：为缺失 id 的卡片补齐身份（旧数据零迁移，随下一次 commit 落库）
export function ensureLinkIds(categories) {
    for (const cat in categories) {
        const links = categories[cat] && categories[cat].links;
        if (!Array.isArray(links)) continue;
        links.forEach(l => { if (!l.id) l.id = newLinkId(); });
    }
    return categories;
}

export function findLinkById(id) {
    if (!id) return null;
    for (const cat in _categories) {
        const link = (_categories[cat].links || []).find(l => l.id === id);
        if (link) return link;
    }
    return null;
}

export function setCategories(data) {
    const oldKeys = Object.keys(_categories);
    oldKeys.forEach(k => delete _categories[k]);
    ensureLinkIds(data || {});
    Object.assign(_categories, data);
    markAllDirty();
    flushNow();
    emit('categoriesLoaded', _categories);
}

export function addLink(category, link) {
    if (!_categories[category]) {
        _categories[category] = { isHidden: false, links: [] };
    }
    if (!link.id) link.id = newLinkId();
    _categories[category].links.push(link);
    markDirty(category);
    emit('linksChanged', { action: 'add', category, link });
}

// 按对象引用定位（兜底按 id，覆盖弹窗打开期间 state 被 load() 整体替换的陈旧引用）
function locateLink(linkRef) {
    for (const cat in _categories) {
        const idx = _categories[cat].links.findIndex(l => l === linkRef || (linkRef && linkRef.id && l.id === linkRef.id));
        if (idx !== -1) return { cat, idx };
    }
    return null;
}

export function updateLink(oldLink, newLink) {
    const found = locateLink(oldLink);
    if (found) {
        const { cat, idx } = found;
        newLink.id = _categories[cat].links[idx].id;
        if (cat === newLink.category) {
            _categories[cat].links[idx] = newLink;
            markDirty(cat);
        } else {
            _categories[cat].links.splice(idx, 1);
            if (!_categories[newLink.category]) {
                _categories[newLink.category] = { isHidden: false, links: [] };
            }
            _categories[newLink.category].links.push(newLink);
            markDirty(cat);
            markDirty(newLink.category);
        }
        emit('linksChanged', { action: 'update', oldLink, newLink });
    }
}

export function removeLink(linkRef) {
    const found = locateLink(linkRef);
    if (found) {
        const { cat, idx } = found;
        const link = _categories[cat].links[idx];
        _categories[cat].links.splice(idx, 1);
        markDirty(cat);
        emit('linksChanged', { action: 'remove', category: cat, link });
    }
}

export function addCategory(name) {
    if (_categories[name]) return false;
    _categories[name] = { isHidden: false, links: [] };
    markAllDirty();
    emit('categoriesChanged', { action: 'add', name });
    return true;
}

export function renameCategory(oldName, newName) {
    if (_categories[newName] || !_categories[oldName]) return false;
    const newCategories = {};
    for (const key in _categories) {
        if (key === oldName) {
            const data = _categories[oldName];
            data.links.forEach(item => item.category = newName);
            newCategories[newName] = data;
        } else {
            newCategories[key] = _categories[key];
        }
    }
    _categories = newCategories;
    markAllDirty();
    emit('categoriesChanged', { action: 'rename', oldName, newName });
    return true;
}

export function deleteCategory(name) {
    if (!_categories[name]) return false;
    delete _categories[name];
    markAllDirty();
    emit('categoriesChanged', { action: 'delete', name });
    return true;
}

export function moveCategory(name, direction) {
    const keys = Object.keys(_categories);
    const idx = keys.indexOf(name);
    if (idx < 0) return false;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= keys.length) return false;
    const newCategories = {};
    const reordered = [...keys];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reordered.forEach(key => newCategories[key] = _categories[key]);
    _categories = newCategories;
    markAllDirty();
    emit('categoriesChanged', { action: 'move', name, direction });
    return true;
}

export function pinCategory(name) {
    const keys = Object.keys(_categories);
    const idx = keys.indexOf(name);
    if (idx <= 0) return false;
    const newCategories = {};
    const reordered = [...keys];
    reordered.splice(idx, 1);
    reordered.unshift(name);
    reordered.forEach(key => newCategories[key] = _categories[key]);
    _categories = newCategories;
    markAllDirty();
    emit('categoriesChanged', { action: 'pin', name });
    return true;
}

export function setCategoryHidden(category, isHidden) {
    if (!_categories[category]) return;
    _categories[category].isHidden = isHidden;
    markAllDirty();
    emit('categoriesChanged', { action: 'hidden', category, isHidden });
}

export function reorderCards(categoryName, orderedLinks) {
    if (!_categories[categoryName]) return;
    _categories[categoryName].links = orderedLinks;
    markDirty(categoryName);
    emit('linksChanged', { action: 'reorder', category: categoryName });
}

export function isCategoryAppLayout(categoryName) {
    return _categories[categoryName] && _categories[categoryName].isAppLayout === true;
}

export function setCategoryAppLayout(categoryName, v) {
    if (!_categories[categoryName]) return;
    _categories[categoryName].isAppLayout = v;
    markDirty(categoryName);
    emit('categoriesChanged', { action: 'appLayout', category: categoryName, value: v });
}

// 可见性规则唯一出处：隐藏分组在登录/编辑态豁免，私密卡仅登录可见；非编辑态空分组略去
export function getVisibleCategories() {
    const result = {};
    for (const name of Object.keys(_categories)) {
        const data = _categories[name];
        if (data.isHidden && !_isEditMode && !_isLoggedIn) continue;
        const links = (data.links || []).filter(l => !l.isPrivate || _isLoggedIn);
        if (links.length === 0 && !_isEditMode) continue;
        result[name] = { ...data, links };
    }
    return result;
}

// 卡片关键词匹配唯一出处（name/tips/url，不区分大小写），站内搜索与命令面板共用
export function linkMatches(link, lowerQuery) {
    const nameMatch = link.name && link.name.toLowerCase().includes(lowerQuery);
    const tipsMatch = link.tips && link.tips.toLowerCase().includes(lowerQuery);
    const urlMatch = link.url && link.url.toLowerCase().includes(lowerQuery);
    return !!(nameMatch || tipsMatch || urlMatch);
}

export function searchCategories(query) {
    const lowerQuery = query.toLowerCase();
    const result = {};
    for (const [cat, catData] of Object.entries(getVisibleCategories())) {
        const matchedLinks = (catData.links || []).filter(link => linkMatches(link, lowerQuery));
        if (matchedLinks.length > 0) {
            result[cat] = { ...catData, links: matchedLinks };
        }
    }
    return result;
}

export function markDirty(categoryName) {
    _dirtyCategories.add(categoryName);
    scheduleFlush();
}

export function markAllDirty() {
    for (const cat in _categories) {
        _dirtyCategories.add(cat);
    }
    scheduleFlush();
}

function scheduleFlush() {
    if (!_renderScheduled) {
        _renderScheduled = true;
        _scheduleFlushFrame(() => {
            _renderScheduled = false;
            const dirty = new Set(_dirtyCategories);
            _dirtyCategories.clear();
            if (_onFlush) _onFlush(dirty);
        });
    }
}

export function setFlushHandler(fn) {
    _onFlush = fn;
}

function flushNow() {
    if (_renderScheduled) {
        _renderScheduled = false;
    }
    const dirty = new Set(_dirtyCategories);
    _dirtyCategories.clear();
    if (_onFlush) _onFlush(dirty);
}

export function subscribe(event, callback) {
    if (!_subscribers[event]) _subscribers[event] = [];
    _subscribers[event].push(callback);
    return () => {
        _subscribers[event] = _subscribers[event].filter(cb => cb !== callback);
    };
}

function emit(event, data) {
    if (_subscribers[event]) {
        _subscribers[event].forEach(cb => cb(data));
    }
}
