import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getCorsHeaders, timingSafeEqual, base64UrlEncode, base64UrlEncodeUint8,
    base64UrlDecode, parseCookie, normalizeCategories,
} from '../src/backend/utils.js';

test('base64UrlEncode / base64UrlDecode 往返一致且无 padding 与 +/', () => {
    const samples = ['hello', '{"alg":"HS256","typ":"JWT"}', 'latin1+chars/==', ''];
    for (const s of samples) {
        const enc = base64UrlEncode(s);
        assert.ok(!enc.includes('+') && !enc.includes('/') && !enc.includes('='));
        assert.equal(base64UrlDecode(enc), s);
    }
});

test('base64UrlEncodeUint8 编码字节序列', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
    assert.equal(base64UrlDecode(base64UrlEncodeUint8(bytes)), String.fromCharCode(...bytes));
});

test('parseCookie 解析常见 Cookie 头', () => {
    assert.deepEqual(parseCookie('a=1; b=2'), { a: '1', b: '2' });
    assert.deepEqual(parseCookie('token=abc%20def'), { token: 'abc def' });
    assert.deepEqual(parseCookie('novalue'), { novalue: '' });
    assert.deepEqual(parseCookie(''), {});
    assert.deepEqual(parseCookie(undefined), {});
});

test('normalizeCategories：数组升级为对象并补默认值', () => {
    const cats = normalizeCategories({ tools: [{ name: 'x', url: 'https://x.com' }] });
    assert.deepEqual(Object.keys(cats.tools), ['isHidden', 'isAppLayout', 'links']);
    assert.equal(cats.tools.isHidden, false);
    assert.equal(cats.tools.isAppLayout, false);
    assert.ok(Array.isArray(cats.tools.links));
});

test('normalizeCategories：对象补缺失字段并布尔化', () => {
    const cats = normalizeCategories({
        a: { isHidden: 1, links: null },
        b: { links: [{ url: 'u' }] },
    });
    assert.equal(cats.a.isHidden, true);
    assert.equal(cats.a.isAppLayout, false);
    assert.deepEqual(cats.a.links, []);
    assert.equal(cats.b.isHidden, false);
    assert.equal(cats.b.isAppLayout, false);
    assert.equal(cats.b.links.length, 1);
});

test('normalizeCategories：为缺失 id 的卡片补齐，已有 id 保留', () => {
    const cats = normalizeCategories({
        a: { links: [{ url: 'u' }, { url: 'v', id: 'keep' }] },
        b: [{ url: 'w' }],
    });
    assert.ok(cats.a.links[0].id);
    assert.equal(cats.a.links[1].id, 'keep');
    assert.ok(cats.b.links[0].id);
});

test('timingSafeEqual：相等/不等/长度不同', async () => {
    assert.equal(await timingSafeEqual('secret', 'secret'), true);
    assert.equal(await timingSafeEqual('secret', 'secreT'), false);
    assert.equal(await timingSafeEqual('short', 'longer-string'), false);
    assert.equal(await timingSafeEqual('', ''), true);
});

test('getCorsHeaders：默认 * 与白名单匹配', () => {
    const req = (origin) => ({ headers: { get: () => origin } });

    assert.equal(getCorsHeaders({}, req('https://any.com'))['Access-Control-Allow-Origin'], '*');

    const env = { ALLOWED_ORIGIN: 'https://a.com,https://b.com' };
    assert.equal(getCorsHeaders(env, req('https://b.com'))['Access-Control-Allow-Origin'], 'https://b.com');
    assert.equal(getCorsHeaders(env, req('https://evil.com'))['Access-Control-Allow-Origin'], 'https://a.com');
    assert.equal(getCorsHeaders(env, req(null))['Access-Control-Allow-Origin'], 'https://a.com');
});
