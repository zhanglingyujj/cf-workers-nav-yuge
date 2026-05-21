# cf-workers-nav 个人导航页

部署在 Cloudflare Workers 的轻量化导航页，支持书签管理、拖拽排序、私密链接保护。

## 特性

- ⚡ Serverless 架构 (Cloudflare Workers)
- 💾 KV 存储 + 自动备份
- 🎨 深色模式 / APP 视图 / 响应式设计
- 🖱️ PC 拖拽 + 移动端长按拖拽
- 🔒 JWT 双 Token 认证 + 私密链接
- 🔍 多引擎聚合搜索 + 站内筛选
- 📂 JSON 格式导入/导出
- ⚡ 增量 DOM 渲染 (编辑模式 60fps)

## 部署到 Cloudflare

### 前提条件

- [Cloudflare 账号](https://www.cloudflare.com)
- Node.js 18+ 和 npm
- wrangler CLI: `npm install -g wrangler`

### 完整命令清单

```bash
# 1. 进入项目目录
cd cf-workers-nav
npm install

# 2. 登录 Cloudflare（浏览器授权）
wrangler login

# 3. 创建 KV 命名空间（复制返回的 id 到 wrangler.toml）
wrangler kv:namespace create "CARD_ORDER"

# 4. 设置密钥
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET

# 5. 构建并部署
npm run deploy
```

### 详细步骤

#### Step 1: 登录 Cloudflare

```bash
wrangler login
```

浏览器会自动打开 Cloudflare 授权页面，点击 **Allow** 完成授权。

#### Step 2: 创建 KV 命名空间

```bash
wrangler kv:namespace create "CARD_ORDER"
```

命令返回类似以下内容：

```
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CARD_ORDER", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

打开 `wrangler.toml`，将返回的 `id` 替换掉原有占位值：

```toml
kv_namespaces = [
  { binding = "CARD_ORDER", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
]
```

#### Step 3: 配置管理员密码和签名密钥

```bash
wrangler secret put ADMIN_PASSWORD
# 输入你希望使用的管理员登录密码（回车确认）

wrangler secret put JWT_SECRET
# 输入一个随机字符串作为签名密钥
# 推荐用 openssl 生成: openssl rand -base64 32
```

> **注意:** 这两个密钥通过 Cloudflare 加密存储，不会出现在代码或配置文件中。

#### Step 4: 构建并部署

```bash
npm run deploy
```

该命令执行两个步骤：
1. `npm run build` — esbuild 打包前端 + 后端，输出 `dist/workers.js`
2. `wrangler deploy` — 将 `dist/workers.js` 部署到 Cloudflare Workers

部署成功后，终端会输出 Worker 的访问地址，例如：

```
Deployed cf-workers-nav (xx.xx sec)
https://cf-workers-nav.你的用户名.workers.dev
```

#### Step 5: 使用

1. 浏览器访问 Worker 的 URL
2. 首次访问看到的是**空白导航页**（无数据）
3. 点击右上角菜单 → 点击 **登录**
4. 输入 Step 3 设置的管理员密码，点击 **确认登录**
5. 登录成功后，再次点击右上角菜单 → **进入编辑模式**
6. 点击页面底部 **新建分类**，输入名称
7. 在分类下方点击 ⊕ 占位符添加链接
8. 支持**拖拽排序**（长按移动端）调整卡片位置

### 更新部署

修改代码后，重新部署：

```bash
npm run deploy
```

### 本地开发

```bash
npm run dev
# 等同于 wrangler dev
# 本地启动开发服务器，默认访问 http://localhost:8787
```

> **注意:** 本地开发需要先通过 `wrangler secret put` 设置环境变量，否则 API 会因缺少 `JWT_SECRET` 报错。

### 常见问题

| 问题 | 解决方法 |
|------|----------|
| `wrangler deploy` 提示未登录 | 运行 `wrangler login` 重新登录 |
| 部署后访问显示 404 / Not Found | 确认 `wrangler.toml` 中 `main = "dist/workers.js"` |
| 登录报错 / 密码错误 | 检查 `wrangler secret put ADMIN_PASSWORD` 是否设置，重新设置后再部署 |
| 保存数据报错 | 检查 KV 命名空间 `id` 是否正确写入 `wrangler.toml` |
| 构建失败 `esbuild` 未找到 | 运行 `npm install` 安装依赖 |
| Cannot find module | 确认在项目根目录执行命令 |
| 本地开发报 JWT 错误 | 确保已运行 `wrangler secret put JWT_SECRET` 设置密钥 |
| 部署成功但页面空白 | 正常现象，首次无数据。按 Step 5 登录后添加内容 |

## 项目结构

```
├── src/
│   ├── backend/        # Worker API 模块
│   │   ├── index.js    # 入口: fetch handler + 路由分发
│   │   ├── config.js   # DEFAULT_USER, getConfig()
│   │   ├── utils.js    # 工具函数 (CORS, JWT base64, 日志, Cookie)
│   │   ├── auth.js     # JWT 创建/验证
│   │   ├── api.js      # API 路由处理器
│   │   ├── icon.js     # 图标代理 (HTMLRewriter + Cache API)
│   │   └── backup.js   # 智能备份
│   ├── frontend/       # 前端模块
│   │   ├── index.html  # HTML 骨架 (Tailwind CDN + 暗色模式)
│   │   ├── app.js      # 入口
│   │   ├── state.js    # 集中状态 + 脏标记增量渲染
│   │   ├── render.js   # 增量 DOM 渲染引擎
│   │   ├── card.js     # 卡片元素工厂
│   │   ├── drag.js     # PC + 移动端拖拽排序
│   │   ├── search.js   # 搜索引擎 + 站内筛选
│   │   ├── auth.js     # 客户端认证
│   │   ├── dialogs.js  # 弹窗管理
│   │   ├── tooltip.js  # 鼠标跟随 tooltip
│   │   ├── scrollspy.js# 滚动监听
│   │   └── utils.js    # 工具函数
│   └── build/          # 构建中间产物
├── build.js            # esbuild 构建脚本
├── dist/workers.js     # 构建产物 (gitignore)
├── package.json
└── wrangler.toml
```

## 构建流程

```
build.js:
  1. esbuild 打包前端 (IIFE)
  2. 注入到 HTML 模板替换 {{FRONTEND_JS}}
  3. 生成 html-content.js 导出 HTML_CONTENT 字符串
  4. esbuild 打包后端 (ESM, minify)
  5. 输出 dist/workers.js
```

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|:--:|
| `ADMIN_PASSWORD` | 管理员密码 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 (32+字符) | ✅ |
| `ALLOWED_ORIGIN` | CORS 来源 (默认 `*`) | |
| `MAX_BACKUPS` | 最大备份数 (默认 10) | |
| `USE_EXTERNAL_ICON_API` | 使用外部图标 API | |

## 技术栈

Cloudflare Workers / KV / Cache API · Tailwind CSS (CDN) · esbuild · JWT (HS256) · HTMLRewriter

## 致谢

[Cloudflare](https://www.cloudflare.com/) · [Tailwind CSS](https://tailwindcss.com/) · [hmhm2022](https://github.com/hmhm2022) · [xinac](https://api.xinac.net/)