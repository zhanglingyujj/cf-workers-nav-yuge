import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetchWithAuth, refreshAccessToken } from '../src/frontend/auth.js';

// 按序消费的计划响应：{ status, body?, error? }
function stubFetch(plans) {
    const calls = [];
    const impl = async (url, options = {}) => {
        calls.push({ url, options });
        const plan = plans.shift();
        if (!plan) throw new Error('unexpected fetch: ' + url);
        if (plan.error) throw plan.error;
        return {
            ok: plan.status >= 200 && plan.status < 300,
            status: plan.status,
            json: async () => plan.body,
        };
    };
    impl.calls = calls;
    return impl;
}

function makeHarness({ plans, refresh }) {
    const originalFetch = globalThis.fetch;
    const storage = new Map([['authToken', 'tok-old']]);
    const events = { loggedIn: [], notified: [] };
    const fetchImpl = stubFetch(plans);
    globalThis.fetch = fetchImpl;
    const fetchWithAuth = createFetchWithAuth({
        storage: {
            getItem: k => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, v),
            removeItem: k => storage.delete(k),
        },
        refresh,
        notify: async msg => { events.notified.push(msg); },
        setLoggedInImpl: v => { events.loggedIn.push(v); },
    });
    return {
        fetchWithAuth, storage, events, fetchImpl,
        restore() { globalThis.fetch = originalFetch; },
    };
}

test('首响 200：直通返回，不触发 refresh', async () => {
    const h = makeHarness({
        plans: [{ status: 200, body: { success: true } }],
        refresh: async () => { throw new Error('不应触发 refresh'); },
    });
    try {
        const res = await h.fetchWithAuth('/api/getLinks');
        assert.equal(res.status, 200);
        assert.equal(h.fetchImpl.calls.length, 1);
        assert.equal(h.fetchImpl.calls[0].options.headers.Authorization, 'Bearer tok-old');
        assert.equal(h.storage.get('authToken'), 'tok-old');
        assert.deepEqual(h.events.notified, []);
        assert.deepEqual(h.events.loggedIn, []);
    } finally { h.restore(); }
});

test('首响 401：refresh 成功后携带新 token 重试，重试 200 直通', async () => {
    const h = makeHarness({
        plans: [{ status: 401 }, { status: 200, body: { success: true } }],
        refresh: async () => { h.storage.set('authToken', 'tok-new'); return 'tok-new'; },
    });
    try {
        const res = await h.fetchWithAuth('/api/saveData', { method: 'POST' });
        assert.equal(res.status, 200);
        assert.equal(h.fetchImpl.calls.length, 2);
        assert.equal(h.fetchImpl.calls[1].options.headers.Authorization, 'Bearer tok-new');
        assert.equal(h.fetchImpl.calls[1].options.method, 'POST');
        assert.equal(h.storage.get('authToken'), 'tok-new');
        assert.deepEqual(h.events.notified, []);
        assert.deepEqual(h.events.loggedIn, []);
    } finally { h.restore(); }
});

test('首响 401 且重试仍 401：会话失效三件事并抛 Unauthorized', async () => {
    const h = makeHarness({
        plans: [{ status: 401 }, { status: 401 }],
        refresh: async () => 'tok-new',
    });
    try {
        await assert.rejects(h.fetchWithAuth('/api/saveData', { method: 'POST' }), { message: 'Unauthorized' });
        assert.equal(h.storage.has('authToken'), false);
        assert.deepEqual(h.events.loggedIn, [false]);
        assert.deepEqual(h.events.notified, ['登录已过期，请重新登录']);
        assert.equal(h.fetchImpl.calls.length, 2);
    } finally { h.restore(); }
});

test('首响 401 且 refresh 失败：清凭证退登录态并抛 Unauthorized', async () => {
    const h = makeHarness({
        plans: [{ status: 401 }],
        refresh: async () => null,
    });
    try {
        await assert.rejects(h.fetchWithAuth('/api/getLinks'), { message: 'Unauthorized' });
        assert.equal(h.storage.has('authToken'), false);
        assert.deepEqual(h.events.loggedIn, [false]);
        assert.deepEqual(h.events.notified, ['登录已过期，请重新登录']);
        assert.equal(h.fetchImpl.calls.length, 1);
    } finally { h.restore(); }
});

test('refreshAccessToken：refresh 端点 5xx/401 一律返回 null', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = stubFetch([{ status: 500 }, { status: 401, body: {} }]);
    try {
        assert.equal(await refreshAccessToken(), null);
        assert.equal(await refreshAccessToken(), null);
        assert.equal(globalThis.fetch.calls.length, 2);
        for (const call of globalThis.fetch.calls) {
            assert.equal(call.url, '/api/refreshToken');
            assert.equal(call.options.method, 'POST');
            assert.equal(call.options.credentials, 'include');
        }
    } finally { globalThis.fetch = originalFetch; }
});
