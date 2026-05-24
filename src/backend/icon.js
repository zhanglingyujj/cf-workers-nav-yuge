import { DEFAULT_IMGAPI, getConfig } from './config.js';
import { getCorsHeaders, logError } from './utils.js';

export async function fetchBestIcon(targetUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(targetUrl, {
            headers: headers,
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Site unreachable');

        let iconUrl = null;

        const rewriter = new HTMLRewriter()
            .on('link[rel="apple-touch-icon"]', {
                element(e) {
                    if (!iconUrl) {
                        const href = e.getAttribute('href');
                        if (href) iconUrl = href;
                    }
                }
            })
            .on('link[rel~="icon"]', {
                element(e) {
                    if (!iconUrl) {
                        const href = e.getAttribute('href');
                        if (href) iconUrl = href;
                    }
                }
            });

        await rewriter.transform(response).text();

        let finalUrl;
        if (iconUrl) {
            finalUrl = new URL(iconUrl, targetUrl).toString();
        } else {
            finalUrl = new URL('/favicon.ico', targetUrl).toString();
        }

        const iconResponse = await fetch(finalUrl, { headers: headers });

        if (iconResponse.ok && iconResponse.headers.get('content-type')?.includes('image')) {
            return iconResponse;
        }

        throw new Error('Icon fetch failed');
    } catch (e) {
    }
    return null;
}

export async function handleIconProxy(request, ctx, env) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const corsHeaders = getCorsHeaders(env, request);

    if (!targetUrl) return new Response('Missing URL', { status: 400, headers: corsHeaders });

    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (response) {
        response = new Response(response.body, response);
        response.headers.set('X-Icon-Cache-Status', 'HIT');
    } else {
        let upstreamResponse = null;
        const useExternalApi = env.USE_EXTERNAL_ICON_API === 'true';

        if (useExternalApi) {
            try {
                const upstreamApi = `${DEFAULT_IMGAPI}${encodeURIComponent(targetUrl)}`;
                upstreamResponse = await fetch(upstreamApi, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
            } catch (e) {
                logError('handleIconProxy', e, { targetUrl, method: 'external_api' });
            }
        }

        if (!upstreamResponse || !upstreamResponse.ok) {
            upstreamResponse = await fetchBestIcon(targetUrl);
        }

        const iconCacheMaxAge = getConfig(env, 'ICON_CACHE_MAX_AGE');

        if (upstreamResponse && upstreamResponse.ok) {
            response = new Response(upstreamResponse.body, upstreamResponse);
            response.headers.set('Cache-Control', `public, max-age=${iconCacheMaxAge}, s-maxage=${iconCacheMaxAge}`);
            response.headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
            response.headers.set('X-Icon-Cache-Status', 'MISS');
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            const defaultSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="none" stroke="#94a3b8" stroke-width="4"/>
                <line x1="32" y1="20" x2="32" y2="36" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
                <circle cx="32" cy="44" r="2" fill="#94a3b8"/>
            </svg>`;

            response = new Response(defaultSVG, {
                status: 200,
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
            response.headers.set('X-Icon-Cache-Status', 'DEFAULT');
        }
        response.headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    }

    return response;
}
