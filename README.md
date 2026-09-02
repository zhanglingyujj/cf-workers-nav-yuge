# cf-workers-nav 个人导航页

部署在 Cloudflare Workers 的轻量化导航页，支持书签管理、拖拽排序、私密链接保护。

## 目录

- [特性](#特性)
- [快速部署](#快速部署)
- [本地开发](#本地开发)
- [测试](#测试)
- [项目结构](#项目结构)
- [架构亮点](#架构亮点)
- [环境变量](#环境变量)
- [技术栈](#技术栈)

## 特性

- ⚡ Serverless 架构 — Cloudflare Workers 全球边缘部署
- 💾 KV 存储 — 数据持久化 + 10 分钟间隔智能自动备份
- 🎨 深色玻璃单主题（壁纸为底）/ 按分类 APP 视图 / 响应式设计
- 🖱️ PC 拖拽 + 移动端长按拖拽排序（本地优先，300ms 合并保存）
- 🔒 JWT 双 Token 认证（access 2h + refresh 30d）+ 私密链接
- 🔍 多引擎聚合搜索（百度/必应/谷歌/站内筛选）+ 全局快捷键
- 📂 数据 JSON 导入/导出；浏览器书签导入（Netscape HTML / Sun-Panel JSON）
- 🖼️ 自定义背景图片 + 遮罩透明度 + 模糊程度（登录后可用，KV 持久化）
- 📱 PWA 离线可用（manifest + service worker）
- 🚀 单请求渲染 — 一次 getLinks 获取数据 + 认证状态，刷新即显
- 🧩 模块化架构 — 26 个源文件，esbuild 构建为单文件部署，node:test 46 组回归

## 快速部署

```bash
# 1. 安装依赖
git clone https://github.com/zhanglingyujj/cf-workers-nav-yuge
cd cf-workers-nav-yuge
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建 KV 命名空间，将返回的 id 填入 wrangler.toml
npx wrangler kv:namespace create "CARD_ORDER"

# 4. 设置密钥（推荐用 openssl rand -base64 32 生成 JWT_SECRET）
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET

# 5. 构建并部署
npm run deploy
```

部署后访问终端输出的 URL，首次为空白页：点击右上角菜单 → 登录 → 进入编辑模式 → 新建分类 → 添加链接。

## 本地开发

```bash
# 密钥放根目录 .dev.vars（已 gitignore），至少：
#   ADMIN_PASSWORD=<你的密码>
#   JWT_SECRET=<32+ 字符随机串>
npm run dev
# 本地启动 http://localhost:8787

node build.js --check-classes
# 校验源码中的 class 全部命中生成的 CSS，防止 Tailwind purge 误删
```

## 测试

```bash
npm test   # node --test test/**/*.js
```

后端 handler（路由/登录/认证/图标/配置/工具）、前端核心逻辑（状态脏合并、commit 持久化、壁纸设置回退、书签解析）均有回归用例；改完相关代码跑最小相关测试，必要时全量。

## 项目结构

```
├── src/
│   ├── backend/              # Worker API 模块
│   │   ├── index.js          # fetch handler 入口 + CSP + 路由分发
│   │   ├── config.js         # 默认配置 / getConfig()
│   │   ├── utils.js          # CORS / JWT base64 / 日志 / Cookie / normalize
│   │   ├── auth.js           # createJWT / validateJWT / validateServerToken
│   │   ├── api.js            # login / getLinks / saveData / backup / export / import / settings
│   │   ├── icon.js           # 图标代理（HTMLRewriter + Cache API + 负面缓存）
│   │   ├── backup.js         # 智能备份（10 分钟最小间隔）
│   │   └── pwa.js            # manifest / icon.svg / service worker
│   ├── frontend/             # 前端模块
│   │   ├── index.html        # HTML 骨架（构建期内联 Tailwind CSS）
│   │   ├── app.js            # 入口：纯装配职责
│   │   ├── state.js          # 集中状态 + 脏标记 + 订阅系统（RAF 可回退）
│   │   ├── render.js         # 增量 DOM 渲染（对账 + patchCategory + scrollspy）
│   │   ├── commit.js         # 提交模块：数据落库唯一通道（commit / commitSoon）
│   │   ├── card.js           # 卡片元素创建/更新 + 共享单例编辑菜单
│   │   ├── drag.js           # PC 拖拽 + 移动端长按拖拽 + 合并保存
│   │   ├── background.js     # 壁纸/遮罩/模糊设置（服务器 + localStorage 回退）
│   │   ├── search.js         # 多引擎搜索 + 站内筛选
│   │   ├── auth.js           # 客户端认证（fetchWithAuth + 自动 refresh）
│   │   ├── dialogs.js        # 弹窗管理（添加/编辑/分类/确认/登录/导入选择）
│   │   ├── bookmarks.js      # 书签导入入口
│   │   ├── bookmark-parsers.js # Netscape HTML / Sun-Panel JSON 解析
│   │   ├── shortcuts.js      # 全局快捷键
│   │   ├── tooltip.js        # 鼠标跟随 tooltip
│   │   ├── scrollspy.js      # IntersectionObserver 滚动高亮
│   │   ├── utils.js          # debounce / throttle / rafThrottle / getEl
│   │   └── input.css         # Tailwind 入口（三条 @tailwind 指令）
│   └── build/                # 构建中间产物（自动生成 + 清理）
├── test/                     # node:test（后端 + 前端可测模块）
├── docs/                     # ADR / 调研 / agent 约定
├── build.js                  # 构建脚本（Tailwind 编译 + esbuild + --check-classes）
├── tailwind.config.js        # Tailwind v3 配置（heritage/glass 色板）
├── CONTEXT.md                # 域术语表
├── DESIGN.md                 # 视觉设计系统（深色玻璃单主题）
└── AGENTS.md                 # 项目约定（数据流 / commit 通道 / 测试形态）
```

## 架构亮点

### 提交模块（commit）

所有数据落库收敛到 `commit.js` 一条通道：显式操作 `commit(actionName)` 立即保存（并取消挂起的合并提交），高频操作（拖拽、开关连拨）`commitSoon(actionName)` 300ms 尾沿合并。`fetchWithAuth` 自带 401 自动刷新，热路径不做前置验证；弹窗类编辑提交前保留一次凭证校验。

### 增量渲染引擎

用户操作立即更新 `state.js` 数据并标记受影响分类为"脏"，下一帧 flush handler 先做**渲染集对账**（移除已消失的分组、按数据顺序重排），再对脏分类执行 DOM diff（仅替换变化的卡片节点），避免 `innerHTML = ''` 全量重建。保存请求异步执行，不阻塞 UI。

### 单请求认证流

```
loadLinks() → /api/getLinks
  ├─ JWT 验证（后端）
  └─ 返回 { categories, isAuthenticated }

前端：
  setLoggedIn(isAuthenticated)  ← 先设状态
  setCategories(data)           ← 再渲染
  → 一次请求、一次渲染、状态正确
```

刷新页面时仅 1 个网络请求完成数据 + 认证。

### 按分类 APP 视图

每个分类独立切换列表视图（详情卡）/ APP 图标视图（极简卡），网格布局实时切换，状态存储在 KV 中。

### 本地优先拖拽

拖拽松手立即更新本地状态 + 增量渲染，`commitSoon` 合并落库。移动端使用 FLIP 动画 + 触觉反馈。

## 环境变量

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|:--:|
| `ADMIN_PASSWORD` | 管理员登录密码 | — | ✅ |
| `JWT_SECRET` | JWT HMAC-SHA256 签名密钥 | — | ✅ |
| `ALLOWED_ORIGIN` | CORS 允许来源，逗号分隔多个 | `*` | |
| `ACCESS_TOKEN_EXPIRY` | Access Token 有效期（秒） | `7200`（2h） | |
| `REFRESH_TOKEN_EXPIRY` | Refresh Token 有效期（秒） | `2592000`（30d） | |
| `MAX_BACKUPS` | 最大备份保留数 | `10` | |
| `ICON_CACHE_MAX_AGE` | 图标缓存时间（秒） | `2592000`（30d） | |
| `HTML_CACHE_MAX_AGE` | HTML 页面缓存时间（秒） | `3600`（1h） | |
| `USE_EXTERNAL_ICON_API` | 使用外部图标 API | — | |

生产环境借助 `npx wrangler secret put <变量名>` 设置必需变量，可选变量可通过 `wrangler.toml` 的 `[vars]` 设置；本地开发放 `.dev.vars`。

## 技术栈

Cloudflare Workers · KV · Cache API · HTMLRewriter · Tailwind CSS v3（构建期编译内联） · esbuild · JWT (HS256) · node:test · PWA (Service Worker)
