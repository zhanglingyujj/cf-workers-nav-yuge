import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, getConfig } from '../src/backend/config.js';

test('getConfig：无 env 时返回默认值', () => {
    assert.equal(getConfig({}, 'ICON_CACHE_MAX_AGE'), DEFAULT_CONFIG.ICON_CACHE_MAX_AGE);
    assert.equal(getConfig({}, 'MAX_BACKUPS'), 10);
});

test('getConfig：env 数字字符串解析为数字，非数字保持字符串', () => {
    const env = { ICON_CACHE_MAX_AGE: '123', ALLOWED_ORIGIN: 'https://a.com' };
    assert.equal(getConfig(env, 'ICON_CACHE_MAX_AGE'), 123);
    assert.equal(getConfig(env, 'ALLOWED_ORIGIN'), 'https://a.com');
});

test('getConfig：env 0 生效（不被 falsy 跳过）', () => {
    assert.equal(getConfig({ MAX_BACKUPS: '0' }, 'MAX_BACKUPS'), 0);
});
