// commit.js - 提交模块：导航数据变更落库的唯一通道
// commit(actionName) 立即提交（并取消挂起的合并提交）；commitSoon(actionName) 尾沿合并高频操作
import { getCategories, setLoggedIn } from './state.js';

export function createCommit({ save, getData, notify, setTimer = setTimeout, clearTimer = clearTimeout, debounceDelay = 300 }) {
    let pendingAction = null;
    let pendingTimer = null;

    async function persist(actionName) {
        try {
            await save(getData());
        } catch (e) {
            // Unauthorized 已由 save 适配器处理（清凭证 + 提示），不重复弹窗
            if (!e || e.message !== 'Unauthorized') {
                await notify(actionName + '失败，请重试');
            }
        }
    }

    async function commit(actionName) {
        if (pendingTimer !== null) {
            clearTimer(pendingTimer);
            pendingTimer = null;
        }
        pendingAction = null;
        return persist(actionName);
    }

    function commitSoon(actionName) {
        pendingAction = actionName;
        if (pendingTimer !== null) clearTimer(pendingTimer);
        pendingTimer = setTimer(() => {
            pendingTimer = null;
            if (pendingAction !== null) {
                const action = pendingAction;
                pendingAction = null;
                persist(action);
            }
        }, debounceDelay);
    }

    return { commit, commitSoon };
}

async function saveToServer(data) {
    const { fetchWithAuth } = await import('./auth.js');
    const response = await fetchWithAuth('/api/saveData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: data }),
    });

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        setLoggedIn(false);
        const { openAlert } = await import('./overlay.js');
        await openAlert('登录凭证已过期，请重新登录');
        throw new Error('Unauthorized');
    }

    const result = await response.json();
    if (!result.success) throw new Error('Failed to save');
}

async function notifyFailure(msg) {
    const { openAlert } = await import('./overlay.js');
    await openAlert(msg);
}

const defaultCommit = createCommit({
    save: saveToServer,
    getData: getCategories,
    notify: notifyFailure,
});

export const commit = defaultCommit.commit;
export const commitSoon = defaultCommit.commitSoon;
