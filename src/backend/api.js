import { DEFAULT_USER, getConfig } from './config.js';
import { timingSafeEqual, getCorsHeaders, logError, logInfo, parseCookie, normalizeCategories } from './utils.js';
import { createJWT, validateJWT, validateServerToken } from './auth.js';
import { handleSmartBackup } from './backup.js';

export async function handleLogin(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    try {
        const { password } = await request.json();
        const isPasswordValid = await timingSafeEqual(password || '', env.ADMIN_PASSWORD || '');
        if (!isPasswordValid) throw new Error('Password mismatch');

        const currentTime = Math.floor(Date.now() / 1000);
        const accessTokenExpiry = getConfig(env, 'ACCESS_TOKEN_EXPIRY');
        const refreshTokenExpiry = getConfig(env, 'REFRESH_TOKEN_EXPIRY');

        const accessTokenPayload = {
            iat: currentTime,
            exp: currentTime + accessTokenExpiry,
            role: 'admin',
            type: 'access'
        };
        const accessToken = await createJWT(accessTokenPayload, env.JWT_SECRET);

        const refreshTokenPayload = {
            iat: currentTime,
            exp: currentTime + refreshTokenExpiry,
            role: 'admin',
            type: 'refresh'
        };
        const refreshToken = await createJWT(refreshTokenPayload, env.JWT_SECRET);

        logInfo('login', 'Login successful');

        const response = new Response(JSON.stringify({
            valid: true,
            token: accessToken
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

        response.headers.append('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/refreshToken; Max-Age=${refreshTokenExpiry}`);

        return response;
    } catch (e) {
        logError('login', e);
        return new Response(JSON.stringify({ valid: false, error: 'Auth failed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}

export async function handleRefreshToken(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    try {
        const cookies = parseCookie(request.headers.get('Cookie'));
        const refreshToken = cookies.refreshToken;

        if (!refreshToken) {
            return new Response(JSON.stringify({ error: 'Refresh token missing' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const payload = await validateJWT(refreshToken, env.JWT_SECRET);
        const currentTime = Math.floor(Date.now() / 1000);

        if (!payload || payload.exp < currentTime) {
            return new Response(JSON.stringify({ error: 'Refresh token expired' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (payload.type !== 'refresh') {
            return new Response(JSON.stringify({ error: 'Invalid token type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const accessTokenExpiry = getConfig(env, 'ACCESS_TOKEN_EXPIRY');
        const refreshTokenExpiry = getConfig(env, 'REFRESH_TOKEN_EXPIRY');

        const newAccessTokenPayload = {
            iat: currentTime,
            exp: currentTime + accessTokenExpiry,
            role: 'admin',
            type: 'access'
        };
        const newAccessToken = await createJWT(newAccessTokenPayload, env.JWT_SECRET);

        const newRefreshTokenPayload = {
            iat: currentTime,
            exp: currentTime + refreshTokenExpiry,
            role: 'admin',
            type: 'refresh'
        };
        const newRefreshToken = await createJWT(newRefreshTokenPayload, env.JWT_SECRET);

        const response = new Response(JSON.stringify({
            accessToken: newAccessToken
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

        response.headers.append('Set-Cookie', `refreshToken=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/refreshToken; Max-Age=${refreshTokenExpiry}`);

        return response;
    } catch (e) {
        logError('refreshToken', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}

export async function handleValidateToken(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    const validation = await validateServerToken(request.headers.get('Authorization'), env);
    return new Response(JSON.stringify(validation.isValid ? { valid: true } : validation.response), {
        status: validation.status || 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export async function handleGetLinks(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    const authToken = request.headers.get('Authorization');
    const dataStr = await env.CARD_ORDER.get(DEFAULT_USER);

    if (dataStr) {
        const parsedData = JSON.parse(dataStr);
        const normalizedCategories = normalizeCategories(parsedData.categories || {});
        let isAuthorized = false;

        if (authToken) {
            const validation = await validateServerToken(authToken, env);
            if (validation.isValid) {
                isAuthorized = true;
            }
        }

        if (isAuthorized) {
            return new Response(JSON.stringify(parsedData), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'} });
        }

        const filteredCategories = {};
        for (const cat in normalizedCategories) {
            const catData = normalizedCategories[cat];
            if (!catData.isHidden) {
                const publicLinks = (catData.links || []).filter(l => !l.isPrivate);
                if (publicLinks.length > 0) {
                    filteredCategories[cat] = { ...catData, links: publicLinks };
                }
            }
        }
        return new Response(JSON.stringify({ categories: filteredCategories }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'} });
    }
    return new Response(JSON.stringify({ categories: {} }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
}

export async function handleSaveData(request, env, ctx) {
    const corsHeaders = getCorsHeaders(env, request);
    const validation = await validateServerToken(request.headers.get('Authorization'), env);
    if (!validation.isValid) return new Response(JSON.stringify(validation.response), { status: validation.status, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    try {
        const { categories } = await request.json();
        const currentData = await env.CARD_ORDER.get(DEFAULT_USER);

        if (currentData) {
            ctx.waitUntil(handleSmartBackup(env, currentData));
        }

        await env.CARD_ORDER.put(DEFAULT_USER, JSON.stringify({ categories }));

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (e) {
        logError('saveData', e);
        return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

export async function handleBackupData(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    const validation = await validateServerToken(request.headers.get('Authorization'), env);
    if (!validation.isValid) return new Response(JSON.stringify(validation.response), { status: validation.status, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    const sourceData = await env.CARD_ORDER.get(DEFAULT_USER);

    if (sourceData) {
        const now = Date.now();
        const date = new Date(now + 8 * 3600 * 1000);
        const dateStr = date.toISOString().replace(/[:.]/g, '-');
        await env.CARD_ORDER.put(`backup_${DEFAULT_USER}_${dateStr}`, sourceData, {
            metadata: { timestamp: now }
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    }
    return new Response(JSON.stringify({ success: false, error: 'User data not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
}

export async function handleExportData(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    const validation = await validateServerToken(request.headers.get('Authorization'), env);
    if (!validation.isValid) return new Response(JSON.stringify(validation.response), { status: validation.status, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    const data = await env.CARD_ORDER.get(DEFAULT_USER);
    return new Response(data || '{}', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
}

export async function handleImportData(request, env) {
    const corsHeaders = getCorsHeaders(env, request);
    const validation = await validateServerToken(request.headers.get('Authorization'), env);
    if (!validation.isValid) return new Response(JSON.stringify(validation.response), { status: validation.status, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    const body = await request.json();

    const cleanData = {
        categories: body.categories || {}
    };

    await env.CARD_ORDER.put(DEFAULT_USER, JSON.stringify(cleanData));
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
}
