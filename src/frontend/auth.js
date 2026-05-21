// auth.js - 客户端认证 + API 通信
import { setLoggedIn, getCategories, setCategories } from './state.js';
import { customAlert } from './dialogs.js';

export async function validateToken() {
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
        await customAlert('登录凭证已过期，请重新登录');
        return false;
    }
    return true;
}

export async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = options.headers || {};
    if (token) headers.Authorization = token;
    options.headers = headers;

    let res = await fetch(url, options);

    if (res.status === 401) {
        try {
            const refreshRes = await fetch('/api/refreshToken', {
                method: 'POST',
                credentials: 'include'
            });
            if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                localStorage.setItem('authToken', refreshData.accessToken);
                headers.Authorization = refreshData.accessToken;
                options.headers = headers;
                res = await fetch(url, options);
            } else {
                throw new Error('Refresh token expired');
            }
        } catch (refreshError) {
            localStorage.removeItem('authToken');
            setLoggedIn(false);
            await customAlert('登录已过期，请重新登录');
            throw new Error('Unauthorized');
        }
    }
    return res;
}

export async function saveDataToServer(actionName, data) {
    try {
        const response = await fetchWithAuth('/api/saveData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: data }),
        });

        if (response.status === 401) {
            localStorage.removeItem('authToken');
            setLoggedIn(false);
            await customAlert('登录凭证已过期，请重新登录');
            throw new Error('Unauthorized');
        }

        const result = await response.json();
        if (!result.success) throw new Error('Failed to save');
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            await customAlert(actionName + '失败，请重试');
        }
    }
}

export async function checkLoginStatusAndLoad() {
    const isValid = await validateToken();
    if (isValid) {
        setLoggedIn(true);
    } else {
        setLoggedIn(false);
    }
    await loadLinks();
}

async function loadLinks() {
    try {
        const response = await fetchWithAuth('/api/getLinks');
        if (!response.ok) throw new Error("HTTP error! status: " + response.status);

        const data = await response.json();
        if (data.categories) {
            setCategories(data.categories);
        }
        const { updateCategorySelectDropdown } = await import('./dialogs.js');
        updateCategorySelectDropdown?.();
    } catch (error) {
        console.error('Error loading links:', error);
        await customAlert('加载链接时出错，请刷新页面重试');
    }
}

export async function exportData() {
    if (!(await validateTokenOrRedirect())) return;
    if (!(await customConfirm('确定要导出数据吗？'))) return;
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
        if (e.message !== 'Unauthorized') await customAlert("导出失败");
    }
}

export async function importData(fileInput) {
    if (!(await validateTokenOrRedirect())) return;
    const { customConfirm } = await import('./dialogs.js');
    if (!(await customConfirm("确定要导入数据吗？导入将覆盖现有数据！"))) return;

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
                    await customAlert('数据导入成功！');
                    location.reload();
                } catch (error) {
                    await customAlert('文件格式错误，请检查文件内容！');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            await customAlert('数据导入失败，请重试！');
        }
    };
    fileInput.click();
}

function customConfirm(msg) {
    return import('./dialogs.js').then(m => m.customConfirm(msg));
}
