import { base64UrlEncode, base64UrlEncodeUint8, base64UrlDecode } from './utils.js';

export async function createJWT(payload, secret) {
    const encoder = new TextEncoder();
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const toSign = encoder.encode(`${headerEncoded}.${payloadEncoded}`);

    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, toSign);
    const signatureEncoded = base64UrlEncodeUint8(new Uint8Array(signature));

    return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}

export async function validateJWT(token, secret) {
    try {
        const encoder = new TextEncoder();
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerEncoded, payloadEncoded, signature] = parts;
        const data = encoder.encode(`${headerEncoded}.${payloadEncoded}`);

        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );

        const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, data);
        const expectedSig = base64UrlEncodeUint8(new Uint8Array(expectedSigBuffer));

        if (signature !== expectedSig) return null;

        const payloadStr = base64UrlDecode(payloadEncoded);
        return JSON.parse(payloadStr);
    } catch (e) {
        return null;
    }
}

export async function validateServerToken(authHeader, env) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { isValid: false, status: 401, response: { error: 'Unauthorized', message: '未登录' } };
    }
    const token = authHeader.slice(7);

    const payload = await validateJWT(token, env.JWT_SECRET);

    if (!payload) {
        return { isValid: false, status: 401, response: { error: 'Invalid', message: 'Token无效' } };
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, status: 401, response: { error: 'Expired', message: 'Token过期' } };
    }

    if (payload.type !== 'access') {
        return { isValid: false, status: 403, response: { error: 'Forbidden', message: '令牌类型错误' } };
    }

    return { isValid: true, payload };
}
