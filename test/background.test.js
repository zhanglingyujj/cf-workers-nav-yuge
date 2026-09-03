import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSettings } from '../src/frontend/background.js';

function makeStorage(items = {}) {
    const m = new Map(Object.entries(items));
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('服务器无值时回退 localStorage 镜像', () => {
    const s = resolveSettings(null, makeStorage({
        backgroundImage: 'https://example.com/a.jpg',
        backgroundOpacity: '35',
        backgroundBlur: '4',
    }));
    assert.deepEqual(s, { backgroundImage: 'https://example.com/a.jpg', backgroundOpacity: 35, backgroundBlur: 4, siteTitle: '珊岛听海' });
});

test('localStorage 也无值时用默认值', () => {
    assert.deepEqual(resolveSettings(null, makeStorage()), {
        backgroundImage: '', backgroundOpacity: 20, backgroundBlur: 0, siteTitle: '珊岛听海',
    });
});

test('服务器空对象视为无值，走回退', () => {
    const s = resolveSettings({}, makeStorage({ backgroundOpacity: '80' }));
    assert.equal(s.backgroundOpacity, 80);
});

test('服务器有值时取服务器值并补全缺省字段', () => {
    const s = resolveSettings({ backgroundImage: 'https://example.com/b.jpg' }, makeStorage({ backgroundImage: 'stale' }));
    assert.deepEqual(s, { backgroundImage: 'https://example.com/b.jpg', backgroundOpacity: 20, backgroundBlur: 0, siteTitle: '珊岛听海' });
});

test('服务器值为 null/非法时回退默认', () => {
    const s = resolveSettings({ backgroundOpacity: null, backgroundBlur: 'abc' }, makeStorage());
    assert.equal(s.backgroundOpacity, 20);
    assert.equal(s.backgroundBlur, 0);
});
