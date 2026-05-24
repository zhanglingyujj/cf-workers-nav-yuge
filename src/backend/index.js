import { HTML_CONTENT } from '../build/html-content.js';
import { getCorsHeaders } from './utils.js';
import { handleIconProxy } from './icon.js';
import { handleLogin, handleRefreshToken, handleValidateToken, handleGetLinks, handleSaveData, handleBackupData, handleExportData, handleImportData, handleGetSettings, handleSaveSettings } from './api.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const corsHeaders = getCorsHeaders(env, request);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === '/api/icon') {
            return handleIconProxy(request, ctx, env);
        }

        if (url.pathname === '/') {
            const htmlCacheMaxAge = env.HTML_CACHE_MAX_AGE || 3600;
            return new Response(HTML_CONTENT, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': `public, max-age=${htmlCacheMaxAge}`,
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'SAMEORIGIN',
                    'Referrer-Policy': 'strict-origin-when-cross-origin',
                    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://static.cloudflareinsights.com; font-src 'self' data: https://fonts.gstatic.com;"
                }
            });
        }

        if (url.pathname === '/api/login' && request.method === 'POST') {
            return handleLogin(request, env);
        }

        if (url.pathname === '/api/refreshToken' && request.method === 'POST') {
            return handleRefreshToken(request, env);
        }

        if (url.pathname === '/api/validateToken') {
            return handleValidateToken(request, env);
        }

        if (url.pathname === '/api/getLinks') {
            return handleGetLinks(request, env);
        }

        if (url.pathname === '/api/saveData' && request.method === 'POST') {
            return handleSaveData(request, env, ctx);
        }

        if (url.pathname === '/api/backupData' && request.method === 'POST') {
            return handleBackupData(request, env);
        }

        if (url.pathname === '/api/exportData' && request.method === 'POST') {
            return handleExportData(request, env);
        }

        if (url.pathname === '/api/importData' && request.method === 'POST') {
            return handleImportData(request, env);
        }

if (url.pathname === '/api/settings') {
            if (request.method === 'GET') return handleGetSettings(request, env);
            if (request.method === 'POST') return handleSaveSettings(request, env);
        }
        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
};
