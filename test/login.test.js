import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLogin } from '../src/backend/api.js';
import { validateJWT } from '../src/backend/auth.js';

const env = {
    ADMIN_PASSWORD: 'correct-password',
    JWT_SECRET: 'test-secret-32-chars-aaaaaaaaaaaaa',
};

function loginRequest(password) {
    return new Request('https://example.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
}

test('handleLogin：正确密码返回 access token（可验签、type=access）与 refresh Cookie', async () => {
    const res = await handleLogin(loginRequest('correct-password'), env);
    assert.equal(res.status, 200);

    const body = JSON.parse(await res.text());
    assert.equal(body.valid, true);

    const payload = await validateJWT(body.token, env.JWT_SECRET);
    assert.equal(payload.type, 'access');
    assert.equal(payload.role, 'admin');
    assert.ok(payload.exp > payload.iat);

    const setCookie = res.headers.get('Set-Cookie');
    assert.ok(setCookie.includes('refreshToken='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Path=/api/refreshToken'));
});

test('handleLogin：错误密码与缺失密码均被拒', async () => {
    for (const pwd of ['wrong-password', undefined]) {
        const res = await handleLogin(loginRequest(pwd), env);
        assert.equal(res.status, 403);
        assert.equal(JSON.parse(await res.text()).valid, false);
    }
});
