# cf-workers-nav 项目约定

部署在 Cloudflare Workers 的个人导航页。单上下文仓库，前后端同仓，esbuild 构建为单文件产物 `dist/workers.js`。

## 命令（项目级，优先 npm scripts / npx，勿依赖全局安装）

```bash
npm run build     # Tailwind 编译 + esbuild 打包 → dist/workers.js
npm test          # node --test test/**/*.js（当前 46 组）
npm run dev       # wrangler dev 本地开发（默认 8787）
npm run deploy    # 构建后 wrangler deploy
npx wrangler login / kv:namespace create "CARD_ORDER" / secret put <NAME>
node build.js --check-classes   # 校验源码 class 全部命中生成的 CSS（防 Tailwind purge 误删）
```

本地 dev 的密钥放根目录 `.dev.vars`（已 gitignore），格式 `KEY=value` 每行一对，至少需要 `ADMIN_PASSWORD` 与 `JWT_SECRET`；生产密钥用 `npx wrangler secret put`。

## 前端核心约定（新增功能时必须遵守）

### 数据流：单向、管线化

```
用户操作 → state.js mutator（改数据 + 标脏）
         → flush handler（reconcileSections 对账 + patchCategory 增量 DOM）
         → commit / commitSoon（异步落库，不阻塞 UI）
```

- `src/frontend/state.js` 是唯一数据源。UI 事件处理器只调 mutator + commit，**不手动 renderAll**（管线会自动渲染；例外：切换分类 APP 布局涉及整块卡片形态重建，才手动 renderAll）。
- 删除/改名分组靠 `reconcileSections` 对账（脏集合无法表达"键消失"），勿绕过。
- `requestAnimationFrame` 在 state.js 中有 node 回退（`setTimeout(0)`），别在模块顶层直接引用浏览器全局。

### 持久化：commit 是唯一通道

- 除壁纸设置外，所有数据落库走 `src/frontend/commit.js`：显式提交用 `commit(actionName)`，高频操作（拖拽、开关连拨）用 `commitSoon(actionName)`（300ms 尾沿合并）。
- 弹窗类编辑（增删改卡片）提交前保留一次 `validateTokenOrRedirect()`；热路径不前置验证（`fetchWithAuth` 自带 401 自动刷新）。
- 壁纸/遮罩走 `background.js` 自有的 `/api/settings` 通道，与 commit 无关。

### 其他

- 跨模块引用 dialogs/auth/render 时沿用现有动态 `import()` 风格，避免静态循环依赖。
- 卡片编辑菜单是全局单例（`card.js` 的 `_sharedMenu`），勿再按卡创建。

## 测试约定

`test/` 下 node:test 纯 Node 环境，无 DOM/fetch/localStorage。可测的形态看现有先例：纯函数（`bookmark-parsers`、`background.resolveSettings`）、依赖注入（`commit.createCommit`）、RAF 回退（`state.js`）。后端 handler 直接测（mock env/request）。

## 文档指针

- `CONTEXT.md` — 域术语表（详情卡/极简卡/提交等）。引入或锐化域概念时同步更新它。
- `DESIGN.md` — 视觉设计系统（深色玻璃单主题、色板、卡片规格）。改样式前先读。
- `docs/adr/` — 已接受的架构决策。勿再提议已被 ADR 否决的方案（如 ADR-0001 已放弃明暗双主题）。
- `docs/research/` — 调研记录（如 Sun-Panel 格式对齐评估）。
