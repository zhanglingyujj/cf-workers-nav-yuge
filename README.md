# cf-workers-nav 个人导航页

部署在 Cloudflare Workers 的轻量化导航页，支持书签管理、拖拽排序、私密链接保护。

## 目录

- [特性](#特性)
- [快速部署](#快速部署)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [架构亮点](#架构亮点)
- [环境变量](#环境变量)
- [技术栈](#技术栈)

## 特性

- ⚡ Serverless 架构 — Cloudflare Workers 全球边缘部署
- 💾 KV 存储 — 数据持久化 + 10 分钟间隔智能自动备份
- 🎨 深色模式 / 按分类 APP 视图 / 响应式设计
- 🖱️ PC 拖拽 + 移动端长按拖拽排序
- 🔒 JWT 双 Token 认证（access 2h + refresh 30d）+ 私密链接
- 🔍 多引擎聚合搜索（百度/必应/谷歌/站内筛选）
- 📂 JSON 导入/导出
- 🖼️ 自定义背景图片 + 遮罩透明度 + 模糊程度（登录后可用，KV 持久化）
- 🚀 单请求渲染 — 一次 getLinks 获取数据 + 认证状态，刷新即显
- 🌐 CSP 安全策略 — 白名单 Google Fonts + Cloudflare Insights
- 🧩 模块化架构 — 14 个源文件，esbuild 构建为单文件部署

## 快速部署

```bash
# 1. 安装依赖
git clone https://github.com/zhanglingyujj/cf-workers-nav-yuge
cd cf-workers-nav-yuge
npm install

# 2. 登录 Cloudflare
wrangler login

# 3. 创建 KV 命名空间，将返回的 id 填入 wrangler.toml
wrangler kv:namespace create "CARD_ORDER"

# 4. 设置密钥（推荐用 openssl rand -base64 32 生成 JWT_SECRET）
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET

# 5. 构建并部署
npm run deploy
```

部署后访问终端输出的 URL，首次为空白页：点击右上角菜单 → 登录 → 进入编辑模式 → 新建分类 → 添加链接。

## 本地开发

```bash
npm run dev
# 本地启动 http://localhost:8787，需先完成 wrangler secret put 设置密钥

node build.js --check-classes
# 校验源码中的 class 全部命中生成的 CSS，防止 Tailwind purge 误删
```

## 项目结构

```
├── src/
│   ├── backend/              # Worker API 模块
│   │   ├── index.js          # fetch handler 入口 + CSP + 路由分发
│   │   ├── config.js         # 默认用户 / getConfig()
│   │   ├── utils.js          # CORS / JWT base64 / 日志 / Cookie / normalize
│   │   ├── auth.js           # createJWT / validateJWT / validateServerToken
│   │   ├── api.js            # login / getLinks / saveData / backup / export / import / settings
│   │   ├── icon.js           # 图标代理（HTMLRewriter + Cache API）
│   │   └── backup.js         # 智能备份（10 分钟最小间隔）
│   ├── frontend/             # 前端模块
│   │   ├── index.html        # HTML 骨架（构建期内联 Tailwind CSS + 暗色模式检测）
│   │   ├── app.js            # 入口：渐进式加载 + 并行初始化
│   │   ├── state.js          # 集中状态 + 脏标记 + 订阅系统
│   │   ├── render.js         # 增量 DOM 渲染（patchCategory + scrollspy）
│   │   ├── card.js           # 卡片元素创建/更新 + 编辑菜单
│   │   ├── drag.js           # PC 拖拽 + 移动端长按拖拽 + debounce 保存
│   │   ├── search.js         # 多引擎搜索 + 站内筛选
│   │   ├── auth.js           # 客户端认证（fetchWithAuth + 自动 refresh）
│   │   ├── dialogs.js        # 弹窗管理（添加/编辑/分类/确认/登录）
│   │   ├── tooltip.js        # 鼠标跟随 tooltip
│   │   ├── scrollspy.js      # IntersectionObserver 滚动高亮
│   │   ├── utils.js          # debounce / throttle / rafThrottle / getEl
│   │   └── input.css         # Tailwind 入口（三条 @tailwind 指令）
│   └── build/                # 构建中间产物（自动生成 + 清理）
├── build.js                  # 构建脚本（Tailwind 编译 + esbuild）
├── tailwind.config.js       # Tailwind v3 配置（heritage/glass 色板）
├── dist/workers.js           # 构建产物（gitignore）
├── package.json
├── wrangler.toml
└── .gitignore
```

## 架构亮点

### 增量渲染引擎

用户操作（添加/删除/拖拽）立即更新 `state.js` 中数据，标记受影响分类为"脏"，下一帧通过 `render.js` 的 `patchCategory()` 执行 DOM diff（仅替换变化的卡片节点），避免 `innerHTML = ''` 全量重建。保存请求异步执行，不阻塞 UI。

### 单请求认证流

```
┌─────────────────────────────────────────────────┐
│  loadLinks() → /api/getLinks                    │
│    ├─ JWT 验证（后端）                          │
│    └─ 返回 { categories, isAuthenticated }       │
│                                                  │
│  前端：                                          │
│    setLoggedIn(isAuthenticated)  ← 先设状态      │
│    setCategories(data)           ← 再渲染        │
│    → 一次请求、一次渲染、状态正确                │
└─────────────────────────────────────────────────┘
```

不额外调用 `/api/validateToken`，刷新页面时仅 1 个网络请求完成数据 + 认证。

### 按分类 APP 视图

每个分类独立切换列表视图 / APP 图标视图，网格布局实时切换，状态存储在 KV 中。

### 本地优先拖拽

拖拽松手立即更新本地状态 + 增量渲染，300ms debounce 后异步保存到服务器。移动端使用 FLIP 动画 + 触觉反馈。

## 环境变量

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|:--:|
| `ADMIN_PASSWORD` | 管理员登录密码 | — | ✅ |
| `JWT_SECRET` | JWT HMAC-SHA256 签名密钥 | — | ✅ |
| `ALLOWED_ORIGIN` | CORS 允许来源，逗号分隔多个 | `*` | |
| `ACCESS_TOKEN_EXPIRY` | Access Token 有效期（秒） | `7200`（2h） | |
| `REFRESH_TOKEN_EXPIRY` | Refresh Token 有效期（秒） | `2592000`（30d） | |
| `MAX_BACKUPS` | 最大备份保留数 | `10` | |
| `ICON_CACHE_MAX_AGE` | 图标缓存时间（秒） | `604800`（7d） | |
| `HTML_CACHE_MAX_AGE` | HTML 页面缓存时间（秒） | `3600`（1h） | |
| `USE_EXTERNAL_ICON_API` | 使用外部图标 API | — | |
| `MAX_BACKUPS` | 最大备份数 | `10` | |

借助 `wrangler secret put <变量名>` 设置必需变量，可选变量可通过 `wrangler.toml` 的 `[vars]` 设置。

## 技术栈

Cloudflare Workers · KV · Cache API · HTMLRewriter · Tailwind CSS v3（构建期编译内联） · esbuild · JWT (HS256)