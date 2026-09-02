import test from 'node:test';
import assert from 'node:assert/strict';
import { handleIconProxy } from '../src/backend/icon.js';

// 测试目标（#4）：
// 1. 抓取失败的默认 SVG 也写入 Cache API（负面缓存，TTL 1 天），二次请求 HIT
// 2. 成功响应 Cache-Control max-age=2592000（30 天）

function setup({ upstreamFetch }) {
    const realFetch = globalThis.fetch;
    globalThis.fetch = upstreamFetch;

    // Node 无 HTMLRewriter，mock 为透传空文档
    const realRewriter = globalThis.HTMLRewriter;
    globalThis.HTMLRewriter = class {
        on() { return this; }
        transform() { return { text: async () => '' }; }
    };

    const stored = new Map();
    const putPromises = [];
    const cache = {
        async match(key) { return stored.get(key.url ?? String(key)); },
        async put(key, res) { stored.set(key.url ?? String(key), res); },
    };
    const realCaches = globalThis.caches;
    globalThis.caches = { default: cache };

    const ctx = { waitUntil(p) { putPromises.push(p); } };
    const env = {};

    const request = () => new Request('https://example.com/api/icon?url=https://target.example.com');

    return {
        ctx, env, request, stored, putPromises,
        flush: () => Promise.all(putPromises),
        async cleanup() {
            globalThis.fetch = realFetch;
            globalThis.caches = realCaches;
            globalThis.HTMLRewriter = realRewriter;
            await Promise.all(putPromises);
        },
    };
}

test('抓取失败：返回默认 SVG 且写入负面缓存，二次请求 HIT', async () => {
    const h = setup({ upstreamFetch: async () => { throw new Error('unreachable'); } });
    try {
        const first = await handleIconProxy(h.request(), h.ctx, h.env);
        assert.equal(first.headers.get('X-Icon-Cache-Status'), 'DEFAULT');
        assert.match(first.headers.get('Cache-Control'), /s-maxage=86400/);

        await h.flush();
        assert.equal(h.stored.size, 1, '默认 SVG 应写入 Cache API');

        const second = await handleIconProxy(h.request(), h.ctx, h.env);
        assert.equal(second.headers.get('X-Icon-Cache-Status'), 'HIT');
    } finally {
        await h.cleanup();
    }
});

test('抓取成功：Cache-Control 为 30 天且写缓存，二次请求 HIT', async () => {
    const h = setup({
        upstreamFetch: async () => new Response('icon-bytes', {
            headers: { 'Content-Type': 'image/png' },
        }),
    });
    try {
        const first = await handleIconProxy(h.request(), h.ctx, h.env);
        assert.equal(first.headers.get('X-Icon-Cache-Status'), 'MISS');
        assert.equal(first.headers.get('Cache-Control'), 'public, max-age=2592000, s-maxage=2592000');

        await h.flush();
        assert.equal(h.stored.size, 1, '成功响应应写入 Cache API');

        const second = await handleIconProxy(h.request(), h.ctx, h.env);
        assert.equal(second.headers.get('X-Icon-Cache-Status'), 'HIT');
    } finally {
        await h.cleanup();
    }
});
