// PWA 静态资源：manifest、应用图标、service worker（均由 Worker 直接返回）

export const MANIFEST = JSON.stringify({
    name: 'Card Tab - 我的导航',
    short_name: 'Card Tab',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F5F2',
    theme_color: '#B8422E',
    icons: [
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
});

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#B8422E"/><path d="M32 13l6.2 12.6 13.8 2-10 9.7 2.4 13.7L32 44.5l-12.4 6.5 2.4-13.7-10-9.7 13.8-2z" fill="#fff"/></svg>`;

// 缓存策略：
// - /api/icon（图标）：cache-first，命中即离线可用
// - 其余同源 GET（页面 HTML / getLinks / settings）：network-first，失败回退缓存，
//   最终兜底 precache 的 '/'（保证断网首屏可打开）
export const SW_JS = `const CACHE_NAME = 'card-tab-v1';
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((c) => c.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return;

    if (url.pathname === '/api/icon') {
        e.respondWith(
            caches.match(req).then((hit) => hit || fetch(req).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                }
                return res;
            }))
        );
        return;
    }

    e.respondWith(
        fetch(req).then((res) => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return res;
        }).catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
});
`;
