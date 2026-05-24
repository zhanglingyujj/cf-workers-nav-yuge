# cf-workers-nav 重构与性能优化实施计划

> **目标:** 单文件 workers.js (2978行) → 模块化 src/ 目录 + esbuild 构建，解决编辑模式卡顿。

> **设计决策:** 前端 JS 内联到 HTML 模板 / Tailwind CDN 保持不变 / 构建产物 dist/workers.js / 增量渲染 + 本地优先拖拽

---

## 目录结构变化

```
当前: workers.js (2978行单文件)
目标:
├── src/
│   ├── backend/           ← Phase 1: 从 workers.js L2349-2978 拆分
│   │   ├── index.js       # export default { fetch } 路由分发
│   │   ├── config.js      # DEFAULT_USER, DEFAULT_CONFIG, getConfig()
│   │   ├── utils.js       # timingSafeEqual, base64Url, log, CORS, parseCookie, normalize
│   │   ├── auth.js        # createJWT, validateJWT, validateServerToken
│   │   ├── api.js         # handleLogin, handleGetLinks, handleSaveData, handleBackup, handleExport, handleImport
│   │   ├── icon.js        # handleIconProxy, fetchBestIcon
│   │   └── backup.js      # handleSmartBackup
│   ├── frontend/          ← Phase 2-5: 从 workers.js L1-2347 拆分
│   │   ├── index.html     # HTML 骨架, <script>{{FRONTEND_JS}}</script> 占位
│   │   ├── app.js         # 入口: DOMContentLoaded → 初始化所有模块
│   │   ├── state.js       # ★ 集中状态 + 脏标记增量渲染
│   │   ├── render.js      # ★ 增量 DOM 渲染引擎
│   │   ├── card.js        # createCardElement, updateCardElement, 编辑菜单
│   │   ├── drag.js        # PC 拖拽 + 移动端长按拖拽, debounce 异步保存
│   │   ├── search.js      # 搜索引擎, 站内筛选, category buttons
│   │   ├── auth.js        # 客户端: login/logout/validateToken/fetchWithAuth
│   │   ├── dialogs.js     # 弹窗: add/edit卡片, 分类命名, confirm, alert, 密码
│   │   ├── tooltip.js     # 鼠标跟随 tooltip
│   │   ├── scrollspy.js   # IntersectionObserver 滚动监听
│   │   └── utils.js       # debounce, throttle, rafThrottle, DOM 辅助
│   └── build/
│       └── html-content.js # 构建时自动生成: export const HTML_CONTENT = `...`
├── build.js               # esbuild 构建脚本
├── dist/
│   └── workers.js         # 构建产物 (gitignore)
├── package.json
├── wrangler.toml           # main 改为 dist/workers.js
├── .gitignore
├── AGENTS.md               # 本文件
└── README.md               # 改版 (Phase 7)
```

---

## 性能问题根因分析 (编辑模式卡顿)

| # | 根因 | 位置 | 影响 |
|---|------|------|------|
| 1 | **每次操作触发全量 DOM 重建** | `renderCategories()` → `container.innerHTML = ''` (L1081) → 全量重建 | ★ 最严重, 增删改拖拽均触发 |
| 2 | **拖拽松手立即同步写服务器** | `drop()` → `saveCardOrder()` → `saveDataToServer()` (L1573, L1870) | 网络延迟阻塞 UI |
| 3 | **saveCardOrder O(n²) 遍历** | L1870-1892: 遍历 sections → cards → flatMap 全量匹配 URL | 百张卡时 ~10000 次遍历 |
| 4 | **编辑模式下图标仍在网络加载** | `createCard()` L1290-1303: `<img>` 仍触发网络请求 | 浪费带宽和渲染 |
| 5 | **CSS will-change 在所有卡片** | L59 `.card { will-change: transform, opacity }` | GPU 内存压力 |
| 6 | **scrollObserver 每次 render 重建** | `renderCategorySections()` L1086 每次都调 `setupScrollSpy()` | 不必要的 Observer 重建 |

---

## Phase 0: 项目脚手架

### Task 0.1: 创建 package.json

```json
{
  "name": "cf-workers-nav",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.js",
    "deploy": "npm run build && wrangler deploy",
    "dev": "wrangler dev"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

- [ ] Create `package.json`
- [ ] Run `npm install`

### Task 0.2: 创建目录 + .gitignore

```powershell
New-Item -ItemType Directory -Path "src\backend" -Force
New-Item -ItemType Directory -Path "src\frontend" -Force
New-Item -ItemType Directory -Path "src\build" -Force
New-Item -ItemType Directory -Path "dist" -Force
```

`.gitignore`: `node_modules/` / `dist/`

- [ ] Create directories + .gitignore

### Task 0.3: 更新 wrangler.toml

将 `main = "workers.js"` 改为 `main = "dist/workers.js"`，其余不变。

- [ ] Edit wrangler.toml

---

## Phase 1: 后端模块拆分 (低风险)

从 workers.js 纯后端部分 (L2349-2978) 提取 7 个模块。每个模块保持与原始代码完全一致的结构。

### Task 1.1: src/backend/config.js (L2352-2380)

内容: DEFAULT_USER, DEFAULT_IMGAPI, DEFAULT_CONFIG, getConfig()

### Task 1.2: src/backend/utils.js (L2385-2562)

导出: getCorsHeaders, timingSafeEqual, logError, logInfo, base64UrlEncode, base64UrlEncodeUint8, base64UrlDecode, parseCookie, normalizeCategories

### Task 1.3: src/backend/auth.js (L2480-2553)

导入 `./utils.js`。导出: createJWT, validateJWT, validateServerToken

### Task 1.4: src/backend/icon.js (L2566-2691)

导入 `./config.js`, `./utils.js`。导出: fetchBestIcon, handleIconProxy

### Task 1.5: src/backend/backup.js (L2693-2739)

导入 `./config.js`, `./utils.js`。导出: handleSmartBackup

### Task 1.6: src/backend/api.js (L2768-2974)

导入 config, utils, auth, backup。导出 8 个 handler: handleLogin, handleRefreshToken, handleValidateToken, handleGetLinks, handleSaveData, handleBackupData, handleExportData, handleImportData

### Task 1.7: src/backend/index.js + 临时 HTML 占位

`src/build/html-content.js` (临时):
```js
export const HTML_CONTENT = 'TODO: replace with built HTML';
```

`src/backend/index.js`: 导入 html-content，导入 api.js + icon.js，组装路由分发 (L2742-2977 逻辑)。

### Task 1.8: 创建 build.js (初版) + 验证

```js
// build.js - Phase 1 初版: 只打包后端
import * as esbuild from 'esbuild';
await esbuild.build({
    entryPoints: ['src/backend/index.js'],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: 'dist/workers.js',
    external: ['cloudflare:*'],
    minify: false,
});
console.log('Build complete: dist/workers.js');
```

- [ ] 运行 `node build.js`
- [ ] 检查 `dist/workers.js` 语法正确
- [ ] 语法验证: `node --check dist/workers.js`
- [ ] Commit: `feat: extract backend modules to src/backend/`

---

## Phase 2: 提取 HTML 模板

### Task 2.1: src/frontend/index.html

从 workers.js L1-461 提取 HTML 骨架 (包括 `<head>` 中的 Tailwind CDN + dark mode 检测 + `<style>` 所有 CSS)，保持 `<body>` 中所有结构。将 L462-2344 的 `<script>...</script>` 替换为 `<script>{{FRONTEND_JS}}</script>`。

- [ ] Create `src/frontend/index.html`
- [ ] 验证: HTML 结构完整 (meta, style, body 所有 div/button/input 存在)
- [ ] 验证: `{{FRONTEND_JS}}` 占位符在正确位置

---

## Phase 3: 前端核心重构 ★ (关键)

### 架构设计

```
数据流:
  用户操作 → state.js (立即更新本地状态 + 标记脏分类)
           → RAF 回调 → render.js (增量 patch 受影响的 DOM 节点)
           → API 层 (异步保存, 不阻塞 UI)

旧流程: addCard() → saveLinks() → await saveDataToServer() → renderCategories() → innerHTML='' + 全量重建
新流程: addCard() → state.addLink() → RAF → patchCategory() [仅更新 DOM diff]
                    → api.saveData() [异步, 后台]
```

### Task 3.1: src/frontend/state.js ★ 核心模块

设计: 集中状态管理 + 脏标记系统

```js
// 核心 API:
getState()           // 返回 { categories, isEditMode, isLoggedIn, isAppLayout }
getCategories()
isEditMode() / isLoggedIn() / isAppLayout()

// 修改器 (立即更新内部状态, 标记受影响分类, 触发 RAF 渲染)
setEditMode(v)       // markAllDirty → flush → emit('editMode')
setLoggedIn(v)
setAppLayout(v)
setCategories(data)  // 全量加载数据

// 细粒度操作 (增量标记)
addLink(category, link)     // markDirty(category)
updateLink(oldUrl, newLink) // markDirty(oldCat) + markDirty(newCat)
removeLink(url)             // markDirty(category)
reorderCards(cat, newLinks) // markDirty(cat)

addCategory(name)
renameCategory(old, new)    // markAllDirty
deleteCategory(name)        // markAllDirty
moveCategory(name, dir)     // markAllDirty
pinCategory(name)           // markAllDirty
setCategoryHidden(cat, v)

// 脏标记系统 (内部)
markDirty(catName)    // 加入 _dirtyCategories, scheduleFlush()
markAllDirty()        // 所有分类标记脏
setFlushHandler(fn)   // 注册 RAF 回调: fn(Set<脏分类名>)

// 订阅系统
subscribe(event, callback)  // 返回取消订阅函数
// 事件: 'editMode', 'loggedIn', 'appLayout', 'categoriesLoaded',
//       'linksChanged', 'categoriesChanged'
```

实现要点:
- `_categories`, `_isEditMode` 等私有状态
- `_dirtyCategories: Set` 收集需要渲染的分类
- `scheduleFlush()` 用 `requestAnimationFrame` 防抖，合并同一帧内的多次变更
- `flushNow()` 跳过 RAF 立即执行 (用于初始加载和模式切换)
- 订阅系统用于 render.js 监听模式变更、tooltip 清理等

### Task 3.2: src/frontend/utils.js

```js
export function debounce(fn, wait)  // 标准 debounce
export function throttle(fn, limit) // 标准 throttle
export function rafThrottle(fn)     // requestAnimationFrame 节流, 合并高频调用
export function scheduleDOMWrite(fn) // 批量 DOM 写入到下一帧

// 缓存 DOM 查询 (L484 和 L582 的 getDom/cacheDOM 合并到此)
let _elCache = new Map();
export function getEl(id)          // 缓存的 document.getElementById
export function clearElCache()     // 清除缓存 (模式切换后调用)
```

### Task 3.3: src/frontend/render.js ★ 增量渲染引擎

核心: 用 DOM diff 替代 `innerHTML = ''` 全量重建。

```js
import { getCategories, isEditMode, isLoggedIn, isAppLayout, setFlushHandler } from './state.js';
import { createCardElement, updateCardElement } from './card.js';
import { getEl } from './utils.js';

// 初始化: 注册脏标记回调
export function initRender() {
    setFlushHandler((dirtyCategories) => {
        dirtyCategories.forEach(cat => patchCategory(cat));
        renderCategoryButtons();
    });
}

// 全量渲染 (首次加载、模式切换)
export function renderAll() {
    container.innerHTML = '';
    for (const [cat, data] of Object.entries(getCategories())) {
        const section = createSection(cat, data.links, data.isHidden);
        if (section) container.appendChild(section);
    }
}

// ★ 增量更新单个分类 (替代全量重建)
export function patchCategory(catName) {
    const data = categories[catName];
    if (!data) { existingSection.remove(); return; }          // 分类已删除
    
    const existing = document.getElementById(catName);
    if (!existing) { insertSection(catName); return; }         // 新增分类
    
    const cardContainer = existing.querySelector('.card-container');  // 卡片容器
    
    // ★ DOM diff: 计算新旧卡片差异
    const oldUrls = new Set(existingCards.map(c => c.dataset.url));
    const newUrls = new Set(data.links.map(l => l.url));
    
    // 1. 移除已删除的卡片
    existingCards.filter(c => !newUrls.has(c.dataset.url)).forEach(c => c.remove());
    
    // 2. 插入新卡片 / 更新已有卡片位置
    data.links.forEach((link, idx) => {
        const existing = existingCards.find(c => c.dataset.url === link.url);
        if (existing) {
            updateCardElement(existing, link);      // 更新内容 (名称/图标等)
            moveToPosition(cardContainer, existing, idx);  // 移到正确 DOM 位置
        } else {
            const card = createCardElement(link);
            insertAt(cardContainer, card, idx);
        }
    });
    
    // 3. 编辑模式下确保添加占位符在最后
    if (isEditMode()) ensureAddPlaceholder(cardContainer, catName);
    else removeAddPlaceholder(cardContainer);
    
    updateSectionHeader(existing, catName, data.isHidden);
    renderCategoryButtons();
}
```

关键函数:
- `createSection(catName, links, isHidden)` — 创建完整分类块 (标题 + 卡片网格)
- `updateSectionHeader(section, catName, isHidden)` — 更新编辑模式控制按钮 (L986-1030)
- `patchCategory(catName)` — ★ 增量 diff 核心
- `renderCategoryButtons()` — 提取自 workers.js L1105-1127

### Task 3.4: src/frontend/card.js

从 workers.js L1258-1417 的 `createCard()` 提取。

```js
import { isEditMode, isLoggedIn, isAppLayout, addLink } from './state.js';

const imgApi = '/api/icon?url=';

export function createCardElement(link) {
    if (!isEditMode() && link.isPrivate && !isLoggedIn()) return null;
    
    const card = document.createElement('div');
    const baseClass = isAppLayout()
        ? 'flex flex-col items-center justify-start py-1 gap-1.5 hover:z-10'
        : 'flex flex-col p-4 bg-white/90 dark:bg-[#1e293b]/60 ... ';
    
    card.className = `group relative h-full w-full rounded-2xl transition-all duration-300 ... card ${baseClass}`;
    card.dataset.url = link.url;
    card.dataset.isPrivate = link.isPrivate;
    
    if (isEditMode()) card.setAttribute('draggable', 'true');
    
    // 编辑模式下: 用纯色 div 替代 <img> (★ 性能优化 #4)
    const iconEl = isEditMode()
        ? createIconPlaceholder(isAppLayout())
        : createIconImage(link);
    
    // ... 其余卡片结构 (title, desc, badge, edit menu)
    
    return card;
}

export function updateCardElement(card, newLink) {
    // 更新卡片内的 title 文本、icon src、data-url
    card.dataset.url = newLink.url;
    card.dataset.isPrivate = newLink.isPrivate;
    card.querySelector('.card-title').textContent = newLink.name;
    
    const descEl = card.querySelector('.card-tip');
    if (descEl) descEl.textContent = newLink.tips || '';
    
    // 只在非编辑模式下更新图标
    if (!isEditMode()) updateIconSrc(card.querySelector('img'), newLink);
}

// ★ 优化: 编辑模式下不加载图标
function createIconPlaceholder(isApp) {
    const div = document.createElement('div');
    div.className = isApp
        ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-[1.2rem] bg-slate-200 dark:bg-slate-600'
        : 'w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700';
    return div;
}

function createIconImage(link) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.src = (!link.icon || !link.icon.startsWith('http'))
        ? imgApi + link.url
        : link.icon;
    img.onerror = () => { /* fallback SVG */ };
    return img;
}
```

- [ ] Create `src/frontend/card.js`

### Task 3.5: 创建 app.js (入口)

```js
import { initRender, renderAll } from './render.js';
import { initDrag } from './drag.js';
import { initSearch } from './search.js';
import { initDialogs } from './dialogs.js';
import { initTooltip } from './tooltip.js';
import { initScrollSpy } from './scrollspy.js';
import { checkLoginStatusAndLoad } from './auth.js';
import { getEl, clearElCache } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    initRender();
    initDrag();
    initSearch();
    initDialogs();
    initTooltip();
    initScrollSpy();
    
    await checkLoginStatusAndLoad();
});
```

- [ ] Create `src/frontend/app.js`

---

## Phase 4: 性能优化专项

### Task 4.1: 编辑模式 CSS 优化

在 `src/frontend/index.html` 的 `<style>` 中添加/修改:

```css
/* ★ 修复 #5: 编辑模式下禁用 will-change, 减少 GPU 内存 */
body.edit-mode .card {
    will-change: auto !important;  /* 覆盖 L59 的 will-change: transform, opacity */
}

/* ★ 修复 #4 兜底: 编辑模式下隐藏图标加载失败 */
body.edit-mode .card img {
    display: none;
}

/* 保持编辑模式现有样式 (L71-86) */
body.edit-mode .card:hover {
    transform: none !important;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
}
```

- [ ] Edit `src/frontend/index.html` `<style>` 添加编辑模式优化

### Task 4.2: 拖拽系统重构 (src/frontend/drag.js) ★

从 workers.js L1532-1892 提取，关键改动:

```js
import { reorderCards, getCategories } from './state.js';
import { debounce } from './utils.js';
import { patchCategory } from './render.js';

// ★ 修复 #2: drag end 立即更新本地状态, 异步 debounce 保存
let draggedCard = null;
let initialDragState = { category: null, index: -1 };

function dragStart(e) { /* ... 不变 */ }
function dragOver(e) { /* ... 不变 */ }
function dragEnd() { this.classList.remove('dragging'); }

async function drop(e) {
    e.preventDefault();
    if (!draggedCard) return;
    
    const newState = getCardState(draggedCard);
    if (changed(initialDragState, newState)) {
        // ★ 立即更新本地状态 (不等待服务器)
        const links = readLinksFromDOM(newState.category);
        reorderCards(newState.category, links);
        patchCategory(newState.category);  // 增量渲染
        
        // ★ 异步保存 (debounce 300ms, 合并连续拖拽)
        debouncedSaveOrder();
    }
    draggedCard = null;
}

// ★ 修复 #3: 从 DOM 读取顺序 (O(n)), 替代原 flatMap O(n²)
function readLinksFromDOM(categoryName) {
    const section = document.getElementById(categoryName);
    const cards = section.querySelectorAll('.card');
    return Array.from(cards).map(c => {
        const url = c.getAttribute('data-url');
        return findLinkByUrl(url);  // Map<url, link> 查找 O(1)
    });
}

// 构建 URL→link 索引, 避免 flatMap 遍历
let _linkIndex = new Map();
function buildLinkIndex() {
    _linkIndex.clear();
    Object.values(getCategories()).forEach(cat => {
        cat.links.forEach(l => _linkIndex.set(l.url, l));
    });
}
function findLinkByUrl(url) {
    return _linkIndex.get(url);
}

// debounce 300ms 保存
const debouncedSaveOrder = debounce(async () => {
    buildLinkIndex();  // 重建索引
    await saveDataToServer('保存排序', getCategories());
}, 300);

// 移动端拖拽逻辑不变, 只在 touchend 中调用 debouncedSaveOrder
```

- [ ] Create `src/frontend/drag.js`
- [ ] 保持 PC 端和移动端拖拽逻辑完整性 (从 workers.js L1532-1892 提取)

### Task 4.3: 搜索模块 (src/frontend/search.js)

从 workers.js L527-775 提取:
- `searchEngines`, `searchEngineLabels`, `searchEngineIcons` 常量
- `selectSearchEngine()`, `renderSearchEngineMenu()`
- `filtLinks()` (站内搜索, workers.js L945-960)
- `renderCategoryButtons()` (分类按钮, workers.js L1105-1127)

- [ ] Create `src/frontend/search.js`

### Task 4.4: 弹窗模块 (src/frontend/dialogs.js)

从 workers.js L1188-2128 提取:
- `toggleOverlay()` — 遮罩过渡
- `showAddDialog()` / `showEditDialog()` / `hideAddDialog()`
- `showCategoryDialog()` — 分类命名弹窗
- `customConfirm()` / `customAlert()`
- 密码弹窗登录逻辑 (workers.js L2021-2041)

- [ ] Create `src/frontend/dialogs.js`

---

## Phase 5: 剩余前端模块

### Task 5.1: src/frontend/auth.js (客户端认证)

从 workers.js L640-655, L1968-2077 提取:
- `checkLoginStatusAndLoad()`
- `validateToken()`, `validateTokenOrRedirect()`
- `toggleLogin()`, `logout()`
- `fetchWithAuth()` (含自动 refresh token 逻辑)
- `importData()`, `exportData()`

### Task 5.2: src/frontend/tooltip.js

从 workers.js L2130-2214 提取 `setupTooltipDelegation()`.

### Task 5.3: src/frontend/scrollspy.js

从 workers.js L1136-1186 提取 `setupScrollSpy()` 和 `highlightButton()`.

---

## Phase 6: 构建脚本 + 组装验证

### Task 6.1: 完整 build.js

```js
// build.js - 完整构建流程
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';

// Step 1: 构建前端 JS bundle (IIFE)
const frontendResult = await esbuild.build({
    entryPoints: ['src/frontend/app.js'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    minify: true,
});

const frontendJs = frontendResult.outputFiles[0].text;

// Step 2: 读取 HTML 模板, 注入前端 JS
let html = readFileSync('src/frontend/index.html', 'utf-8');
html = html.replace('{{FRONTEND_JS}}', frontendJs);

// Step 3: 生成 html-content.js (导出 HTML_CONTENT)
const escapedHtml = html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

writeFileSync('src/build/html-content.js',
    `// Auto-generated by build.js\nexport const HTML_CONTENT = \`${escapedHtml}\`;\n`
);

// Step 4: 构建后端 (包含 HTML_CONTENT)
await esbuild.build({
    entryPoints: ['src/backend/index.js'],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: 'dist/workers.js',
    external: ['cloudflare:*'],
    minify: true,
    drop: ['console'],  // 生产环境去除 console.log
});

// Step 5: 清理生成的中间文件
unlinkSync('src/build/html-content.js');

console.log('Build complete: dist/workers.js');
```

- [ ] Update `build.js` to full version
- [ ] Run `npm run build`
- [ ] Verify `dist/workers.js` contains `export default` and HTML content string

### Task 6.2: 功能验证清单

- [ ] `node build.js` 成功后检查 dist/workers.js 语法: `node --check dist/workers.js`
- [ ] 检查 dist/workers.js 包含 `HTML_CONTENT` 字符串
- [ ] 检查 dist/workers.js 包含 `export default`
- [ ] 检查 dist/workers.js 包含所有 API 路由
- [ ] 对比 dist/workers.js 大小 vs 原始 workers.js (应接近)
- [ ] 本地测试: `npx wrangler dev` (需要配置环境变量)
- [ ] 浏览器访问 http://localhost:8787 验证页面渲染
- [ ] 测试登录流程
- [ ] 测试编辑模式: 添加/编辑/删除/拖拽
- [ ] 测试深色模式/APP 布局切换
- [ ] 测试移动端拖拽
- [ ] Commit: `feat: complete modular refactor with incremental rendering`

---

## Phase 7: README 改版

### README.md 新结构

```markdown
# cf-workers-nav 个人导航页

部署在 Cloudflare Workers 的轻量化导航页，集成书签管理、拖拽排序、私密链接保护等功能。

## ✨ 特性
- ⚡ Serverless 架构 (Cloudflare Workers)
- 💾 KV 存储 + 自动备份
- 🎨 支持深色模式 / APP 视图 / 响应式
- 🖱️ PC 拖拽 + 移动端长按拖拽
- 🔒 JWT 双 Token 认证 + 私密链接
- 🔍 多引擎聚合搜索 + 站内筛选
- 📂 JSON 导入导出

## 快速部署

### 前提条件
- Cloudflare 账号
- 已安装 Node.js 18+
- 已安装 wrangler: `npm install -g wrangler`

### 部署步骤

1. 克隆项目
   git clone <repo-url>
   cd cf-workers-nav
   npm install

2. 创建 KV 命名空间
   wrangler kv:namespace create "CARD_ORDER"
   # 将返回的 id 填入 wrangler.toml

3. 配置环境变量
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put JWT_SECRET

4. 构建并部署
   npm run deploy

### 本地开发
   npm run dev  # 等同于 wrangler dev

## 项目结构
   src/
   ├── backend/    # Worker API (配置/认证/数据/图标)
   ├── frontend/   # 前端模块 (状态/渲染/拖拽/搜索/弹窗)
   └── build/      # 构建产物
   build.js        # esbuild 构建脚本
   dist/workers.js # 部署产物

## 环境变量
| 变量 | 说明 | 必需 |
|------|------|------|
| ADMIN_PASSWORD | 管理员密码 | ✅ |
| JWT_SECRET | JWT 签名密钥 (32+字符) | ✅ |
| ALLOWED_ORIGIN | CORS 来源 | ❌ |
| MAX_BACKUPS | 最大备份数 (默认10) | ❌ |
| USE_EXTERNAL_ICON_API | 外部图标API | ❌ |

## 技术栈
- Cloudflare Workers / KV / Cache API
- Tailwind CSS (CDN)
- esbuild
- JWT (HS256)
- HTMLRewriter (图标抓取)

## 致谢
Cloudflare, Tailwind CSS, hmhm2022, xinac
```

- [ ] Rewrite `README.md`

---

## 执行建议

按 Phase 顺序执行，每个 Phase 完成后验证 + 提交:
1. **Phase 0** → 环境准备
2. **Phase 1** → 后端拆分 (可独立验证: `node build.js` 语法检查)
3. **Phase 2** → HTML 模板提取
4. **Phase 3** → 前端核心 (增量渲染 + 状态管理) ★ 重点
5. **Phase 4** → 性能优化 (编辑模式 will-change、图标跳过、debounce 保存)
6. **Phase 5** → 剩余模块
7. **Phase 6** → 构建脚本完整化 + 端到端验证
8. **Phase 7** → README

每个 Commit 消息格式: `feat(scope): description`