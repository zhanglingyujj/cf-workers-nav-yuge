import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/frontend/auth.js';

function fakeFetch(routes) {
    const calls = [];
    const fn = async (url, options = {}) => {
        calls.push({ url, options });
        const route = routes[url];
        if (!route) throw new Error('no route: ' + url);
        const body = typeof route === 'function' ? route(options) : route;
        return { ok: true, status: 200, json: async () => body };
    };
    fn.calls = calls;
    return fn;
}

function makeHarness({ routes = {} } = {}) {
    const storage = new Map();
    const events = { loggedIn: [], categories: null, notified: [], masked: 0 };
    const fetchImpl = fakeFetch(routes);
    const session = createSession({
        fetchJson: fetchImpl,
        storage: {
            getItem: k => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, v),
            removeItem: k => storage.delete(k),
        },
        setLoggedInImpl: v => events.loggedIn.push(v),
        setCategoriesImpl: c => { events.categories = c; },
        notify: async msg => { events.notified.push(msg); },
        runWithMask: fn => { events.masked++; return fn(); },
        onCategoriesLoaded: async () => { events.dropdownUpdated = true; },
    });
    return { session, storage, events, fetchImpl };
}

test('login 成功：写 token、翻登录态、遮罩内拉取数据', async () => {
    const h = makeHarness({
        routes: {
            '/api/login': { valid: true, token: 'tok-1' },
            '/api/getLinks': { isAuthenticated: true, categories: { 工具: { links: [] } } },
        },
    });
    const ok = await h.session.login('pw');
    assert.equal(ok, true);
    assert.equal(h.storage.get('authToken'), 'tok-1');
    assert.deepEqual(h.events.loggedIn, [true, true]); // login 翻转 + load 按 isAuthenticated 再确认
    assert.deepEqual(h.events.categories, { 工具: { links: [] } });
    assert.equal(h.events.masked, 1); // 数据加载被遮罩包裹
    assert.equal(h.events.dropdownUpdated, true);
    assert.equal(h.events.notified.length, 0);
});

test('login 密码无效：返回 false 且不动状态', async () => {
    const h = makeHarness({ routes: { '/api/login': { valid: false } } });
    const ok = await h.session.login('bad');
    assert.equal(ok, false);
    assert.equal(h.storage.has('authToken'), false);
    assert.deepEqual(h.events.loggedIn, []);
    assert.equal(h.fetchImpl.calls.length, 1); // 未触发 getLinks
});

test('login 网络异常：提示并返回 false', async () => {
    const h = makeHarness({
        routes: { '/api/login': () => { throw new Error('offline'); } },
    });
    const ok = await h.session.login('pw');
    assert.equal(ok, false);
    assert.deepEqual(h.events.notified, ['Login Error']);
});

test('logout：清 token、立即翻登出态并重拉数据', async () => {
    const h = makeHarness({
        routes: { '/api/getLinks': { isAuthenticated: false, categories: {} } },
    });
    h.storage.set('authToken', 'tok-1');
    await h.session.logout();
    assert.equal(h.storage.has('authToken'), false);
    assert.deepEqual(h.events.loggedIn, [false, false]);
    assert.deepEqual(h.events.categories, {});
});

test('load：本地有 token 但 getLinks 降级为未登录，refresh 成功则恢复登录态', async () => {
    const h = makeHarness({
        routes: {
            '/api/getLinks': (options) => {
                const auth = options.headers?.Authorization || '';
                return auth === 'Bearer tok-new'
                    ? { isAuthenticated: true, categories: { 私密: { links: [{ name: 'x' }] } } }
                    : { isAuthenticated: false, categories: {} };
            },
        },
    });
    h.storage.set('authToken', 'tok-expired');
    const fetchJson = (url, options = {}) => h.fetchImpl(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${h.storage.get('authToken') || ''}`,
        },
    });
    const session = createSession({
        fetchJson,
        storage: {
            getItem: k => (h.storage.has(k) ? h.storage.get(k) : null),
            setItem: (k, v) => h.storage.set(k, v),
            removeItem: k => h.storage.delete(k),
        },
        setLoggedInImpl: v => h.events.loggedIn.push(v),
        setCategoriesImpl: c => { h.events.categories = c; },
        notify: async msg => { h.events.notified.push(msg); },
        runWithMask: fn => fn(),
        onCategoriesLoaded: async () => {},
        refresh: async () => { h.storage.set('authToken', 'tok-new'); return true; },
    });
    await session.load();
    assert.equal(h.storage.get('authToken'), 'tok-new');
    assert.deepEqual(h.events.loggedIn, [true]);
    assert.deepEqual(h.events.categories, { 私密: { links: [{ name: 'x' }] } });
    assert.equal(h.fetchImpl.calls.length, 2); // 首次降级 + refresh 后重拉
});

test('load：本地有 token 但 refresh 失败，静默按未登录处理并清理 token', async () => {
    const h = makeHarness({
        routes: { '/api/getLinks': { isAuthenticated: false, categories: { A: { links: [] } } } },
    });
    h.storage.set('authToken', 'tok-expired');
    const session = createSession({
        fetchJson: h.fetchImpl,
        storage: {
            getItem: k => (h.storage.has(k) ? h.storage.get(k) : null),
            setItem: (k, v) => h.storage.set(k, v),
            removeItem: k => h.storage.delete(k),
        },
        setLoggedInImpl: v => h.events.loggedIn.push(v),
        setCategoriesImpl: c => { h.events.categories = c; },
        notify: async msg => { h.events.notified.push(msg); },
        runWithMask: fn => fn(),
        onCategoriesLoaded: async () => {},
        refresh: async () => false,
    });
    await session.load();
    assert.equal(h.storage.has('authToken'), false);
    assert.deepEqual(h.events.loggedIn, [false]);
    assert.deepEqual(h.events.categories, { A: { links: [] } });
    assert.equal(h.fetchImpl.calls.length, 1);
    assert.deepEqual(h.events.notified, []); // 无弹窗，静默降级
});

test('load：按响应 isAuthenticated 翻转登录态', async () => {
    const h = makeHarness({
        routes: { '/api/getLinks': { isAuthenticated: false, categories: { A: { links: [] } } } },
    });
    await h.session.load();
    assert.deepEqual(h.events.loggedIn, [false]);
    assert.deepEqual(h.events.categories, { A: { links: [] } });
});

test('load 响应异常：提示加载失败', async () => {
    const h = makeHarness({
        routes: { '/api/getLinks': () => { throw new Error('boom'); } },
    });
    await h.session.load();
    assert.deepEqual(h.events.notified, ['加载链接时出错，请刷新页面重试']);
    assert.deepEqual(h.events.loggedIn, []);
});
