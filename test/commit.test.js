import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommit } from '../src/frontend/commit.js';

function makeTimers() {
    const tasks = new Map();
    let nextId = 1;
    return {
        setTimer(fn) { const id = nextId++; tasks.set(id, fn); return id; },
        clearTimer(id) { tasks.delete(id); },
        runAll() { for (const fn of [...tasks.values()]) fn(); tasks.clear(); },
        get size() { return tasks.size; },
    };
}

function makeHarness({ saveImpl } = {}) {
    const timers = makeTimers();
    const saved = [];
    const notified = [];
    let data = { counter: 0 };
    const c = createCommit({
        save: saveImpl || (async (d) => { saved.push(d); }),
        getData: () => data,
        notify: async (msg) => { notified.push(msg); },
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
    });
    return { c, timers, saved, notified, getData: () => data };
}

test('commit 立即以当前数据快照保存', async () => {
    const h = makeHarness();
    h.getData().counter = 7;
    await h.c.commit('保存数据');
    assert.equal(h.saved.length, 1);
    assert.equal(h.saved[0].counter, 7);
    assert.equal(h.notified.length, 0);
});

test('commitSoon 连续调用合并为一次保存，且取触发时的最新数据', async () => {
    const h = makeHarness();
    h.c.commitSoon('保存排序');
    h.c.commitSoon('保存排序');
    h.c.commitSoon('保存排序');
    assert.equal(h.timers.size, 1);
    h.getData().counter = 42;
    h.timers.runAll();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(h.saved.length, 1);
    assert.equal(h.saved[0].counter, 42);
});

test('commit 取消挂起的 commitSoon，不产生第二次保存', async () => {
    const h = makeHarness();
    h.c.commitSoon('切换隐藏');
    await h.c.commit('保存数据');
    assert.equal(h.timers.size, 0);
    h.timers.runAll();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(h.saved.length, 1);
});

test('commitSoon 的 actionName 取最后一次', async () => {
    const h = makeHarness({ saveImpl: async () => { throw new Error('boom'); } });
    h.c.commitSoon('切换隐藏');
    h.c.commitSoon('切换APP视图');
    h.timers.runAll();
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(h.notified, ['切换APP视图失败，请重试']);
});

test('保存失败（非 Unauthorized）时按动作名提示', async () => {
    const h = makeHarness({ saveImpl: async () => { throw new Error('network'); } });
    await h.c.commit('删除链接');
    assert.deepEqual(h.notified, ['删除链接失败，请重试']);
});

test('Unauthorized 不重复提示', async () => {
    const h = makeHarness({ saveImpl: async () => { const e = new Error('x'); e.message = 'Unauthorized'; throw e; } });
    await h.c.commit('保存数据');
    assert.equal(h.notified.length, 0);
});
