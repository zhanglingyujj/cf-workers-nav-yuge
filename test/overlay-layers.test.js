import test from 'node:test';
import assert from 'node:assert/strict';
import { topmostOpen, anyOpen } from '../src/frontend/overlay-layers.js';

// entries 形如 [{ id, z, open }]，z 取自浮层 class 的 z-[N]（评审快照：卡片菜单 9999、
// alert 110、命令面板 90、导入选择 85、confirm 80、登录 70、分类弹窗 65、卡片弹窗 60、下拉 50）

test('anyOpen: 没有浮层时返回 false', () => {
    assert.equal(anyOpen([]), false);
    assert.equal(anyOpen([{ id: 'dialog-overlay', z: 60, open: false }]), false);
});

test('anyOpen: 任一浮层开着即 true（含 z 为 0 的动态浮层）', () => {
    assert.equal(anyOpen([{ id: 'dialog-overlay', z: 60, open: true }]), true);
    assert.equal(anyOpen([{ id: 'card-menu', z: 0, open: true }]), true);
});

test('topmostOpen: 没有开着的浮层返回 null', () => {
    assert.equal(topmostOpen([]), null);
    assert.equal(topmostOpen([{ id: 'cmd-palette', z: 90, open: false }]), null);
});

test('topmostOpen: 返回 z 最高的开着浮层', () => {
    const entries = [
        { id: 'dialog-overlay', z: 60, open: true },
        { id: 'cmd-palette', z: 90, open: true },
        { id: 'password-dialog-overlay', z: 70, open: true },
    ];
    assert.equal(topmostOpen(entries).id, 'cmd-palette');
});

test('topmostOpen: 更高 z 但未开的浮层不参与（弹窗之上叠 alert 时关 alert）', () => {
    const entries = [
        { id: 'dialog-overlay', z: 60, open: true },
        { id: 'custom-alert-overlay', z: 110, open: false },
    ];
    assert.equal(topmostOpen(entries).id, 'dialog-overlay');
});

test('topmostOpen: z 相同时任一可关（返回该条目）', () => {
    const entries = [
        { id: 'a', z: 60, open: true },
        { id: 'b', z: 60, open: true },
    ];
    const top = topmostOpen(entries);
    assert.ok(top === entries[0] || top === entries[1]);
});
