export function getCorsHeaders(env, request) {
    const origin = request?.headers?.get('Origin') || '*';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';

    let responseOrigin = '*';
    if (allowedOrigin !== '*') {
        const allowedOrigins = allowedOrigin.split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
            responseOrigin = origin;
        } else {
            responseOrigin = allowedOrigins[0];
        }
    }

    return {
        'Access-Control-Allow-Origin': responseOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Credentials': 'true'
    };
}

export async function timingSafeEqual(a, b) {
    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);

    if (aBytes.length !== bBytes.length) {
        const dummyBytes = encoder.encode(a);
        await crypto.subtle.digest('SHA-256', dummyBytes);
        return false;
    }

    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const sigA = await crypto.subtle.sign('HMAC', key, aBytes);
    const sigB = await crypto.subtle.sign('HMAC', key, bBytes);

    const arrA = new Uint8Array(sigA);
    const arrB = new Uint8Array(sigB);

    let result = 0;
    for (let i = 0; i < arrA.length; i++) {
        result |= arrA[i] ^ arrB[i];
    }
    return result === 0;
}

export function logError(context, error, extra = {}) {
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        context,
        error: error?.message || String(error),
        stack: error?.stack,
        ...extra
    }));
}

export function logInfo(context, message, extra = {}) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        context,
        message,
        ...extra
    }));
}

export function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncodeUint8(arr) {
    const str = String.fromCharCode(...arr);
    return base64UrlEncode(str);
}

export function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

export function parseCookie(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name) cookies[name] = decodeURIComponent(value || '');
    });
    return cookies;
}

export function normalizeCategories(categories) {
    for (const key in categories) {
        if (Array.isArray(categories[key])) {
            categories[key] = { isHidden: false, isAppLayout: false, links: categories[key] };
        } else if (categories[key] && typeof categories[key] === 'object') {
            categories[key].isHidden = Boolean(categories[key].isHidden);
            categories[key].isAppLayout = Boolean(categories[key].isAppLayout);
            categories[key].links = categories[key].links || [];
        }
    }
    return categories;
}
