import test from 'node:test';
import assert from 'node:assert/strict';
import { createJWT, validateJWT, validateServerToken } from '../src/backend/auth.js';

const SECRET = 'test-secret-32-chars-aaaaaaaaaaaaa';

function payload(over = {}) {
    return {
        iat: Math.floor(Date.now() / 1000) - 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: 'admin',
        type: 'access',
        ...over,
    };
}

test('createJWT/validateJWT：签发即验，payload 完整还原', async () => {
    const p = payload({ extra: 'ok' });
    const token = await createJWT(p, SECRET);
    assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(await validateJWT(token, SECRET), p);
});

test('validateJWT：篡改 payload / 错误密钥 / 格式错误均拒绝', async () => {
    const token = await createJWT(payload(), SECRET);
    const [h, p, s] = token.split('.');

    const tamperedPayload = `${h}.${p.replace(/.$/, p.endsWith('a') ? 'b' : 'a')}.${s}`;
    assert.equal(await validateJWT(tamperedPayload, SECRET), null);
    assert.equal(await validateJWT(token, 'wrong-secret'), null);
    assert.equal(await validateJWT('not.a.jwt', SECRET), null);
    assert.equal(await validateJWT('onlytwo', SECRET), null);
    assert.equal(await validateJWT('', SECRET), null);
});

test('validateServerToken：缺失/非法/过期/类型错误/有效', async () => {
    const env = { JWT_SECRET: SECRET };

    const missing = await validateServerToken(null, env);
    assert.equal(missing.isValid, false);
    assert.equal(missing.status, 401);

    const notBearer = await validateServerToken('Token abc', env);
    assert.equal(notBearer.isValid, false);

    const invalid = await validateServerToken('Bearer bad.token.here', env);
    assert.equal(invalid.status, 401);

    const expiredToken = await createJWT(payload({ exp: Math.floor(Date.now() / 1000) - 1 }), SECRET);
    const expired = await validateServerToken(`Bearer ${expiredToken}`, env);
    assert.equal(expired.isValid, false);
    assert.equal(expired.status, 401);

    const refresh = await createJWT(payload({ type: 'refresh' }), SECRET);
    const wrongType = await validateServerToken(`Bearer ${refresh}`, env);
    assert.equal(wrongType.isValid, false);
    assert.equal(wrongType.status, 403);

    const access = await createJWT(payload(), SECRET);
    const ok = await validateServerToken(`Bearer ${access}`, env);
    assert.equal(ok.isValid, true);
    assert.equal(ok.payload.type, 'access');
});
