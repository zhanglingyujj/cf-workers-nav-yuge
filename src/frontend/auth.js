// auth.js - 客户端认证 + 会话（login/logout/load）+ API 通信
import { setLoggedIn, setCategories } from './state.js';
import { openAlert, openConfirm } from './overlay.js';

async function validateToken() {
    const t = localStorage.getItem('authToken');
    if (!t) return false;
    try {
        const r = await fetchWithAuth('/api/validateToken');
        return r.status === 200;
    } catch (e) { return false; }
}

export async function validateTokenOrRedirect() {
    const valid = await validateToken();
    if (!valid) {
        localStorage.removeItem('authToken');
        setLoggedIn(false);
        await openAlert('登录凭证已过期，请重新登录');
        return false;
    }
    return true;
}

export async function refreshAccessToken() {
    try {
        const refreshRes = await fetch('/api/refreshToken', {
            method: 'POST',
            credentials: 'include'
        });
        if (!refreshRes.ok) return null;
        const refreshData = await refreshRes.json();
        if (!refreshData.accessToken) return null;
        localStorage.setItem('authToken', refreshData.accessToken);
        return refreshData.accessToken;
    } catch (e) {
        return null;
    }
}

export async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = options.headers || {};
    if (token) {
        headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    options.headers = headers;
    options.cache = 'no-store';

    let res = await fetch(url, options);

    if (res.status === 401) {
        try {
            const newToken = await refreshAccessToken();
            if (newToken) {
                headers.Authorization = `Bearer ${newToken}`;
                options.headers = headers;
                res = await fetch(url, options);
            } else {
                throw new Error('Refresh token expired');
            }
        } catch (refreshError) {
            localStorage.removeItem('authToken');
            setLoggedIn(false);
            await openAlert('登录已过期，请重新登录');
            throw new Error('Unauthorized');
        }
    }
    return res;
}

function defaultRunWithMask(fn) {
    const mask = document.getElementById('loading-mask');
    if (mask) mask.classList.remove('hidden');
    return fn().finally(() => { if (mask) mask.classList.add('hidden'); });
}

async function defaultOnCategoriesLoaded() {
    const { updateCategorySelectDropdown } = await import('./dialogs.js');
    updateCategorySelectDropdown?.();
}

// 会话深模块：登录态生命周期（login/logout/load），token 存取与数据加载联动藏在实现内
export function createSession({
    fetchJson = fetchWithAuth,
    storage = localStorage,
    setLoggedInImpl = setLoggedIn,
    setCategoriesImpl = setCategories,
    notify = openAlert,
    runWithMask = defaultRunWithMask,
    onCategoriesLoaded = defaultOnCategoriesLoaded,
    refresh = refreshAccessToken,
} = {}) {
    async function load() {
        try {
            let response = await fetchJson('/api/getLinks');
            if (!response.ok) throw new Error("HTTP error! status: " + response.status);
            let data = await response.json();

            // getLinks 对无效 token 静默降级为未登录（不返 401），
            // 本地仍有 token 时先尝试 refresh，成功后重拉恢复登录态
            if (!data.isAuthenticated && storage.getItem('authToken')) {
                if (await refresh()) {
                    response = await fetchJson('/api/getLinks');
                    if (!response.ok) throw new Error("HTTP error! status: " + response.status);
                    data = await response.json();
                } else {
                    storage.removeItem('authToken');
                }
            }

            if (data.categories) {
                setLoggedInImpl(data.isAuthenticated);
                setCategoriesImpl(data.categories);
            }
            await onCategoriesLoaded();
        } catch (error) {
            console.error('Error loading links:', error);
            await notify('加载链接时出错，请刷新页面重试');
        }
    }

    return {
        load,
        async login(password) {
            let data;
            try {
                const res = await fetchJson('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                data = await res.json();
            } catch (e) {
                await notify('Login Error');
                return false;
            }
            if (!data.valid) return false;

            storage.setItem('authToken', data.token);
            setLoggedInImpl(true);
            await runWithMask(load);
            return true;
        },
        async logout() {
            storage.removeItem('authToken');
            setLoggedInImpl(false);
            await load();
        },
    };
}

// 单例惰性创建：模块加载时不触碰 localStorage，保证纯 Node 环境可导入测试
let session = null;
function getSession() {
    if (!session) session = createSession();
    return session;
}

export function login(password) { return getSession().login(password); }
export function logout() { return getSession().logout(); }
export function load() { return getSession().load(); }

export async function exportData() {
    if (!(await validateTokenOrRedirect())) return;
    if (!(await openConfirm('确定要导出数据吗？'))) return;
    try {
        const res = await fetchWithAuth("/api/exportData", { method: "POST" });
        if (!res.ok) throw new Error("Export failed");
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nav_export_" + new Date().toISOString().split("T")[0] + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        if (e.message !== 'Unauthorized') await openAlert("导出失败");
    }
}

export async function importData(fileInput) {
    if (!(await validateTokenOrRedirect())) return;
    if (!(await openConfirm("确定要导入数据吗？导入将覆盖现有数据！"))) return;

    fileInput.value = '';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const res = await fetchWithAuth("/api/importData", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data)
                    });
                    if (!res.ok) throw new Error("Import failed");
                    await openAlert('数据导入成功！');
                    location.reload();
                } catch (error) {
                    await openAlert('文件格式错误，请检查文件内容！');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            await openAlert('数据导入失败，请重试！');
        }
    };
    fileInput.click();
}
