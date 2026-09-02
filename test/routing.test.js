import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';

// index.js 依赖构建期生成的 src/build/html-content.js（build 后会被删除），
// 测试用最小 stub 动态生成后再导入。
const STUB_PATH = 'src/build/html-content.js';
const stubExisted = existsSync(STUB_PATH);
if (!stubExisted) {
    mkdirSync('src/build', { recursive: true });
    writeFileSync(STUB_PATH, 'export const HTML_CONTENT = "<!DOCTYPE html><html><body>stub</body></html>";');
}

const worker = (await import('../src/backend/index.js')).default;

test.after?.(async () => {
    if (!stubExisted) rmSync(STUB_PATH);
});

const env = {};
const ctx = { waitUntil() {} };

test('OPTIONS 预检：204/200 且带 CORS 头', async () => {
    const res = await worker.fetch(new Request('https://example.com/', { method: 'OPTIONS' }), env, ctx);
    assert.ok([200, 204].includes(res.status));
    assert.ok(res.headers.get('Access-Control-Allow-Origin'));
});

test('GET /：返回 HTML stub 且带安全响应头', async () => {
    const res = await worker.fetch(new Request('https://example.com/'), env, ctx);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Content-Type'), /text\/html/);
    assert.equal(res.headers.get('X-Frame-Options'), 'SAMEORIGIN');
    assert.ok(res.headers.get('Content-Security-Policy'));
    assert.equal(await res.text(), '<!DOCTYPE html><html><body>stub</body></html>');
});

test('受保护接口未授权：401', async () => {
    const res = await worker.fetch(
        new Request('https://example.com/api/exportData', { method: 'POST' }), env, ctx);
    assert.equal(res.status, 401);
    const body = JSON.parse(await res.text());
    assert.ok(body.error);
});

test('未知路径：404', async () => {
    const res = await worker.fetch(new Request('https://example.com/api/nope'), env, ctx);
    assert.equal(res.status, 404);
});

test('PWA 资源：manifest / icon.svg / sw.js 均可访问', async () => {
    const manifest = await worker.fetch(new Request('https://example.com/manifest.webmanifest'), env, ctx);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('Content-Type'), /manifest\+json/);
    assert.equal(JSON.parse(await manifest.text()).name, 'Card Tab - 我的导航');

    const icon = await worker.fetch(new Request('https://example.com/icon.svg'), env, ctx);
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get('Content-Type'), /image\/svg\+xml/);
    assert.match(await icon.text(), /<svg/);

    const sw = await worker.fetch(new Request('https://example.com/sw.js'), env, ctx);
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('Content-Type'), /javascript/);
    const swBody = await sw.text();
    assert.ok(swBody.includes('addEventListener')); // ensure sw code body is valid
});
