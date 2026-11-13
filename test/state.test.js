import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getCategories, isEditMode, isLoggedIn,
    setEditMode, setLoggedIn, setCategories,
    addLink, updateLink, removeLink, findLinkById,
    addCategory, renameCategory, deleteCategory,
    moveCategory, pinCategory, setCategoryHidden,
    reorderCards, isCategoryAppLayout, setCategoryAppLayout,
    moveLink,
    markAllDirty, markDirty,
    setFlushHandler,
} from '../src/frontend/state.js';

function flushNow() {
    // setTimeout(0) 回退调度器：等一帧让 flush 执行
    return new Promise(r => setTimeout(r, 10));
}

function link(url, category, extra = {}) {
    return { name: url, url, category, isPrivate: false, ...extra };
}

test('setCategories 为缺失 id 的卡片补齐身份，已有 id 保留', () => {
    setCategories({ A: { isHidden: false, links: [link('x.com', 'A'), { ...link('y.com', 'A'), id: 'keep-me' }] } });
    const links = getCategories().A.links;
    assert.ok(links[0].id);
    assert.notEqual(links[0].id, 'keep-me');
    assert.equal(links[1].id, 'keep-me');
    assert.equal(findLinkById('keep-me'), links[1]);
});

test('addLink 为新卡生成 id', () => {
    setCategories({ A: { isHidden: false, links: [] } });
    addLink('A', link('x.com', 'A'));
    assert.ok(getCategories().A.links[0].id);
});

test('setCategories 装载数据并同步触发结构脏 flush', async () => {
    await flushNow(); // 排干前序用例遗留的脏集合与挂起调度
    let seen = null;
    setFlushHandler((dirty, structureDirty) => { if (structureDirty) seen = [...dirty]; });
    setCategories({ 工具: { isHidden: false, links: [link('a.com', '工具')] } });
    assert.deepEqual(Object.keys(getCategories()), ['工具']);
    assert.deepEqual(seen, ['工具']);
});

test('结构脏标志：markAllDirty 置位，markDirty 单组不置位', async () => {
    const seen = [];
    setFlushHandler((dirty, structureDirty) => seen.push(structureDirty));
    setCategories({ A: { isHidden: false, links: [] } });
    await flushNow(); // 消化 setCategories 的同步 flush 与其遗留的空调度
    seen.length = 0;
    markAllDirty();
    await flushNow();
    markDirty('A');
    await flushNow();
    assert.deepEqual(seen, [true, false]);
});

test('addLink 标记所在分类为脏', async () => {
    const dirty = new Set();
    setFlushHandler(d => d.forEach(c => dirty.add(c)));
    setCategories({ A: { isHidden: false, links: [] } });
    addLink('A', link('x.com', 'A'));
    await flushNow();
    assert.deepEqual([...dirty], ['A']);
});

test('updateLink 按引用定位，跨分类移动时保留 id 且两个分类都标脏', async () => {
    const dirty = new Set();
    setFlushHandler(d => d.forEach(c => dirty.add(c)));
    setCategories({
        A: { isHidden: false, links: [link('x.com', 'A')] },
        B: { isHidden: false, links: [] },
    });
    const old = getCategories().A.links[0];
    updateLink(old, link('x.com', 'B'));
    await flushNow();
    assert.deepEqual([...dirty].sort(), ['A', 'B']);
    assert.equal(getCategories().A.links.length, 0);
    assert.equal(getCategories().B.links.length, 1);
    assert.equal(getCategories().B.links[0].id, old.id); // 身份随卡片迁移保留
});

test('updateLink 兼容陈旧引用：按 id 兑底命中', () => {
    setCategories({ A: { isHidden: false, links: [link('x.com', 'A')] } });
    const stale = { ...getCategories().A.links[0] }; // 引用已不在 state 中，但 id 相同
    updateLink(stale, { ...link('x2.com', 'A'), category: 'A' });
    assert.equal(getCategories().A.links.length, 1);
    assert.equal(getCategories().A.links[0].url, 'x2.com');
    assert.equal(getCategories().A.links[0].id, stale.id);
});

test('同 URL 双卡各自更新/删除命中正确目标', () => {
    setCategories({
        A: { isHidden: false, links: [link('dup.com', 'A')] },
        B: { isHidden: false, links: [{ ...link('dup.com', 'B'), name: 'B侧' }] },
    });
    const aRef = getCategories().A.links[0];
    const bRef = getCategories().B.links[0];
    updateLink(bRef, { ...bRef, name: '改名后' });
    assert.equal(getCategories().A.links[0].name, 'dup.com');
    assert.equal(getCategories().B.links[0].name, '改名后');
    removeLink(aRef);
    assert.equal(getCategories().A.links.length, 0);
    assert.equal(getCategories().B.links.length, 1);
});

test('removeLink 按引用定位并删除，未命中不抛错', () => {
    setCategories({ A: { isHidden: false, links: [link('x.com', 'A')] } });
    removeLink(getCategories().A.links[0]);
    assert.equal(getCategories().A.links.length, 0);
    removeLink({ url: '不存在.com' }); // 不抛错
});

test('reorderCards 覆盖分类链接顺序', () => {
    setCategories({ A: { isHidden: false, links: [link('1.com', 'A'), link('2.com', 'A')] } });
    reorderCards('A', [link('2.com', 'A'), link('1.com', 'A')]);
    assert.deepEqual(getCategories().A.links.map(l => l.url), ['2.com', '1.com']);
});

test('分类 mutator：add/rename/delete 的返回值与数据一致性', () => {
    setCategories({ A: { isHidden: false, links: [] } });
    assert.equal(addCategory('B'), true);
    assert.equal(addCategory('B'), false); // 重名
    assert.equal(renameCategory('A', 'C'), true);
    assert.ok(getCategories().C);
    assert.equal(renameCategory('C', 'B'), false); // 目标名已存在
    assert.equal(deleteCategory('B'), true);
    assert.equal(deleteCategory('B'), false);
});

test('moveCategory/pinCategory 返回值反映是否实际移动', () => {
    setCategories({
        A: { isHidden: false, links: [] },
        B: { isHidden: false, links: [] },
    });
    assert.equal(moveCategory('A', -1), false); // 已在顶部
    assert.equal(moveCategory('A', 1), true);
    assert.deepEqual(Object.keys(getCategories()), ['B', 'A']);
    assert.equal(pinCategory('A'), true);
    assert.deepEqual(Object.keys(getCategories()), ['A', 'B']);
    assert.equal(pinCategory('A'), false); // 已在顶部
});

test('APP 布局开关读写', () => {
    setCategories({ A: { isHidden: false, links: [] } });
    assert.equal(isCategoryAppLayout('A'), false);
    setCategoryAppLayout('A', true);
    assert.equal(isCategoryAppLayout('A'), true);
});

test('setEditMode/setLoggedIn 切换状态', () => {
    setEditMode(true);
    assert.equal(isEditMode(), true);
    setEditMode(false);
    assert.equal(isEditMode(), false);
    assert.equal(isLoggedIn(), false);
    setLoggedIn(true);
    assert.equal(isLoggedIn(), true);
});

test('同一帧内多次变更合并为一次 flush', async () => {
    let flushCount = 0;
    setFlushHandler(() => flushCount++);
    setCategories({
        A: { isHidden: false, links: [] },
        B: { isHidden: false, links: [] },
    });
    await flushNow(); // setCategories 的 flushNow 已清空
    flushCount = 0;
    addLink('A', link('1.com', 'A'));
    addLink('A', link('2.com', 'A'));
    addLink('B', link('3.com', 'B'));
    await flushNow();
    assert.equal(flushCount, 1);
});

test('moveLink 组内重排：按 orderedIds 落位并标脏该组', async () => {
    const dirty = new Set();
    setFlushHandler(d => d.forEach(c => dirty.add(c)));
    setCategories({ A: { isHidden: false, links: [link('1.com', 'A'), link('2.com', 'A'), link('3.com', 'A')] } });
    await flushNow();
    dirty.clear();
    const ids = getCategories().A.links.map(l => l.id);
    assert.equal(moveLink(ids[2], 'A', [ids[2], ids[0], ids[1]]), true);
    await flushNow();
    assert.deepEqual(getCategories().A.links.map(l => l.url), ['3.com', '1.com', '2.com']);
    assert.deepEqual([...dirty], ['A']);
});

test('moveLink 跨组移动：源组移除、目标组按序落位，两组均标脏', async () => {
    const dirty = new Set();
    setFlushHandler(d => d.forEach(c => dirty.add(c)));
    setCategories({
        A: { isHidden: false, links: [link('1.com', 'A'), link('2.com', 'A')] },
        B: { isHidden: false, links: [link('3.com', 'B')] },
    });
    await flushNow();
    dirty.clear();
    const moved = getCategories().A.links[1];
    const bId = getCategories().B.links[0].id;
    assert.equal(moveLink(moved.id, 'B', [moved.id, bId]), true);
    await flushNow();
    assert.deepEqual(getCategories().A.links.map(l => l.url), ['1.com']);
    assert.deepEqual(getCategories().B.links.map(l => l.url), ['2.com', '3.com']);
    assert.equal(getCategories().B.links[0].id, moved.id); // 身份随卡片迁移保留
    assert.equal(getCategories().B.links[0].category, 'B');
    assert.deepEqual([...dirty].sort(), ['A', 'B']);
});

test('moveLink orderedIds 归一：多余 id 忽略、缺失 id 追加末尾', async () => {
    setCategories({
        A: { isHidden: false, links: [link('1.com', 'A')] },
        B: { isHidden: false, links: [link('4.com', 'B'), link('5.com', 'B')] },
    });
    const id1 = getCategories().A.links[0].id;
    const id4 = getCategories().B.links[0].id;
    // 'ghost' 不在目标组忽略；id5 未列出追加末尾；被拖卡未列出也追加末尾
    assert.equal(moveLink(id1, 'B', ['ghost', id4]), true);
    assert.deepEqual(getCategories().B.links.map(l => l.url), ['4.com', '5.com', '1.com']);
    assert.deepEqual(getCategories().A.links.map(l => l.url), []);
});

test('moveLink id 不存在或目标组不存在：返回 false 且 no-op', async () => {
    const dirty = new Set();
    setFlushHandler(d => d.forEach(c => dirty.add(c)));
    setCategories({ A: { isHidden: false, links: [link('1.com', 'A')] } });
    await flushNow();
    dirty.clear();
    const id1 = getCategories().A.links[0].id;
    assert.equal(moveLink('不存在', 'A', []), false); // 拖拽中卡片被删的竞态
    assert.equal(moveLink(id1, '不存在的组', [id1]), false);
    assert.deepEqual(getCategories().A.links.map(l => l.url), ['1.com']);
    await flushNow();
    assert.deepEqual([...dirty], []);
});

test('moveLink 源组拖空后非编辑态可见集自动略去', () => {
    resetState({ loggedIn: false });
    setCategories({
        A: { isHidden: false, links: [link('1.com', 'A')] },
        B: { isHidden: false, links: [link('2.com', 'B')] },
    });
    const id1 = getCategories().A.links[0].id;
    const id2 = getCategories().B.links[0].id;
    assert.equal(moveLink(id1, 'B', [id1, id2]), true);
    const v = getVisibleCategories();
    assert.deepEqual(Object.keys(v), ['B']); // 空分组非编辑态略去
    assert.deepEqual(v.B.links.map(l => l.url), ['1.com', '2.com']);
});

import {
    getVisibleCategories, searchCategories,
    setFilter, getFilter, getViewCategories,
} from '../src/frontend/state.js';

function resetState({ loggedIn = false, editMode = false } = {}) {
    setLoggedIn(loggedIn);
    setEditMode(editMode);
    setCategories({});
}

test('getVisibleCategories 未登录：隐藏分组与私密卡均不可见', () => {
    resetState({ loggedIn: false });
    setCategories({
        普通分组: { isHidden: false, links: [link('a.com', '普通分组'), { ...link('p.com', '普通分组'), isPrivate: true }] },
        隐藏分组: { isHidden: true, links: [link('h.com', '隐藏分组')] },
        纯私密: { isHidden: false, links: [{ ...link('only.com', '纯私密'), isPrivate: true }] },
    });
    const v = getVisibleCategories();
    assert.deepEqual(Object.keys(v), ['普通分组']);
    assert.equal(v.普通分组.links.length, 1);
    assert.equal(v.普通分组.links[0].url, 'a.com');
});

test('getVisibleCategories 登录后：隐藏分组与私密卡均可见', () => {
    resetState({ loggedIn: true });
    setCategories({
        隐藏分组: { isHidden: true, links: [link('h.com', '隐藏分组')] },
        纯私密: { isHidden: false, links: [{ ...link('only.com', '纯私密'), isPrivate: true }] },
    });
    const v = getVisibleCategories();
    assert.deepEqual(Object.keys(v), ['隐藏分组', '纯私密']);
    assert.equal(v.纯私密.links.length, 1);
});

test('getVisibleCategories 编辑模式：未登录也可见隐藏分组与空分组', () => {
    resetState({ loggedIn: false, editMode: true });
    setCategories({
        隐藏分组: { isHidden: true, links: [link('h.com', '隐藏分组')] },
        空分组: { isHidden: false, links: [] },
    });
    const v = getVisibleCategories();
    assert.deepEqual(Object.keys(v), ['隐藏分组', '空分组']);
});

test('getVisibleCategories 非编辑空分组被略去（未登录）', () => {
    resetState({ loggedIn: false });
    setCategories({ 空分组: { isHidden: false, links: [] } });
    assert.deepEqual(getVisibleCategories(), {});
});

test('searchCategories 只在可见集内做 name/tips/url 匹配', () => {
    resetState({ loggedIn: false });
    setCategories({
        工具: { isHidden: false, links: [
            link('github.com', '工具', { tips: '代码托管' }),
            link('news.com', '新闻站', {}),
        ] },
        隐藏分组: { isHidden: true, links: [link('gitlab.com', 'GitLab')] },
    });
    const r = searchCategories('git');
    assert.deepEqual(Object.keys(r), ['工具']);
    assert.deepEqual(r.工具.links.map(l => l.url), ['github.com']);

    const r2 = searchCategories('代码');
    assert.deepEqual(Object.keys(r2), ['工具']);
    assert.equal(r2.工具.links.length, 1);
});

test('searchCategories 空查询返回全量可见集', () => {
    resetState({ loggedIn: false });
    setCategories({ 工具: { isHidden: false, links: [link('a.com', '工具')] } });
    const r = searchCategories('');
    assert.deepEqual(Object.keys(r), ['工具']);
    assert.equal(r.工具.links.length, 1);
});

test('setFilter/getFilter：置词与清除', () => {
    resetState({ loggedIn: false });
    assert.equal(getFilter(), '');
    setFilter('git');
    assert.equal(getFilter(), 'git');
    setFilter('');
    assert.equal(getFilter(), '');
});

test('getViewCategories 无筛选词时等于可见集', () => {
    resetState({ loggedIn: false });
    setCategories({ 工具: { isHidden: false, links: [link('a.com', '工具')] } });
    setFilter('');
    assert.deepEqual(getViewCategories(), getVisibleCategories());
});

test('getViewCategories 有筛选词时叠加筛选，卡片引用保持', () => {
    resetState({ loggedIn: false });
    setCategories({
        工具: { isHidden: false, links: [link('github.com', '工具'), link('news.com', '工具')] },
        资讯: { isHidden: false, links: [link('gitlab.com', '资讯')] },
    });
    setFilter('git');
    const v = getViewCategories();
    assert.deepEqual(Object.keys(v), ['工具', '资讯']);
    assert.deepEqual(v.工具.links.map(l => l.url), ['github.com']);
    assert.equal(v.工具.links[0], getCategories().工具.links[0]); // 浅拷贝保持引用，patch 对账可命中
    setFilter('news');
    assert.deepEqual(Object.keys(getViewCategories()), ['工具']); // 资讯组整组不匹配从视图消失
});

test('getViewCategories 不命中时为空集，清除筛选恢复全量', () => {
    resetState({ loggedIn: false });
    setCategories({ 工具: { isHidden: false, links: [link('a.com', '工具')] } });
    setFilter('不存在的词');
    assert.deepEqual(getViewCategories(), {});
    setFilter('');
    assert.deepEqual(Object.keys(getViewCategories()), ['工具']);
});

test('getViewCategories 与可见集规则叠加：隐藏分组、私密卡不进视图', () => {
    resetState({ loggedIn: false });
    setCategories({
        普通分组: { isHidden: false, links: [link('git.com', '普通分组')] },
        隐藏分组: { isHidden: true, links: [link('github.com', '隐藏分组')] },
        纯私密: { isHidden: false, links: [{ ...link('gitlab.com', '纯私密'), isPrivate: true }] },
    });
    setFilter('git');
    const v = getViewCategories();
    assert.deepEqual(Object.keys(v), ['普通分组']);
    assert.deepEqual(v.普通分组.links.map(l => l.url), ['git.com']);
});

test('setFilter 联动结构脏：flush 收到 structureDirty 且全量置脏', async () => {
    resetState({ loggedIn: false });
    setCategories({
        A: { isHidden: false, links: [link('a.com', 'A')] },
        B: { isHidden: false, links: [link('b.com', 'B')] },
    });
    await flushNow(); // 排干前序同步 flush 与遗留空调度
    const events = [];
    setFlushHandler((dirty, structureDirty) => events.push({ dirty: [...dirty], structureDirty }));
    setFilter('a');
    await flushNow();
    const structureFlush = events.find(e => e.structureDirty);
    assert.ok(structureFlush, 'setFilter 后 flush 收到 structureDirty');
    assert.deepEqual(structureFlush.dirty.sort(), ['A', 'B']); // markAllDirty 全量置脏 → renderAll 通道
    setFilter('');
    await flushNow();
    assert.equal(events.filter(e => e.structureDirty).length, 2); // 清除同样走结构脏
});

import {
    linkMatches,
} from '../src/frontend/state.js';

test('linkMatches 匹配 name/tips/url 且不区分大小写', () => {
    const link0 = { name: 'GitHub', url: 'github.com', tips: '代码托管' };
    assert.equal(linkMatches(link0, 'git'), true);       // url + name
    assert.equal(linkMatches(link0, '代码'), true);      // tips
    assert.equal(linkMatches(link0, 'github'), true);   // 输入约定为已小写的 query，链接字段自身大小写不敏感
    assert.equal(linkMatches(link0, '不存在的词'), false);
    const bare = { name: '站', url: 'a.com' };           // 无 tips 字段不误匹配
    assert.equal(linkMatches(bare, ''), true);
    assert.equal(linkMatches(bare, 'x'), false);
});
