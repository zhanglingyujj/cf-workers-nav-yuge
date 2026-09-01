# 同类导航页项目功能全景调研

> 票据：#2（Part of #1）。目的：为 cf-workers-nav 功能选型提供裁剪底稿。
> 视角：个人导航页，高价值、低维护成本优先。

调研对象：Homer、Dashy、Heimdall、Sun-Panel、flare、Homarr。信息来源以各项目官方 README / 官方文档为准，引用附于每节。

## 一、按项目概览

### Homer（bastienwirtz/homer）
静态 YAML 配置的单页导航，零维护取向。核心特性：PWA 可安装、模糊搜索（`/` 唤起、`Enter` 直达首个结果、`Alt+Enter` 新标签打开）、多页面与条目分组、主题定制、键盘快捷键、"Smart cards"（对特定服务的预设卡片）。（来源：[README](https://github.com/bastienwirtz/homer#highlights)）

### Dashy（Lissy93/dashy）
功能最全的之一。核心特性：多页面；每条链接的实时状态检查（HTTP 状态码 + ICMP ping，悬停显示响应时间）；丰富 widget 生态（对接自托管服务展示动态内容）；多主题 + UI 配色编辑器 + 自定义 CSS；图标多来源（favicon 自动抓取、Font Awesome、dashboard-icons、emoji、生成式图标）；多用户认证（含 SSO/Keycloak、只读访客）；最小视图（Minimal View，作浏览器起始页）和工作区视图（Workspace，多应用同屏）；多种打开方式（新标签/同标签/弹窗 modal/复制 URL）；即时搜索 + 每条目快捷键（0-9 hotkey）+ 标签（tags）+ web search bangs（`/r` → reddit 等，支持自定义搜索引擎）；UI 内可视化配置编辑器（改完预览、保存到磁盘或本地）；E2E 加密云端备份（Cloudflare Worker + KV）；多语言 30+；PWA。（来源：[README](https://github.com/Lissy93/dashy#features-) 及其各分节）

### Heimdall（linuxserver/Heimdall）
经典 PHP 仪表盘。核心特性：应用目录库（Foundation apps 自动填图标和颜色，按标题联想；Enhanced apps 对接应用 API 在卡片上显示实时状态如下载速度）；自定义搜索提供商（`searchproviders.yaml`，含站内 Tiles 搜索）；标签 pinned 收藏；自定义背景图；多语言。（来源：[README (2.x)](https://github.com/linuxserver/Heimdall/blob/2.x/readme.md)）

### Sun-Panel（hslr-s/sun-panel）
NAS 导航面板（开源版 v1.3.0，此后转闭源 PRO）。核心特性：内外网一键切换（同一卡片按场景打开不同地址）；多账户隔离；系统状态查看；自定义 JS/CSS；无外部数据库依赖；图标风格自由组合，支持 Iconify 图标库；网页内小窗口打开应用。（来源：[README](https://github.com/hslr-s/sun-panel#-features)）

### flare（soulteary/flare）
Go 单二进制、极简性能取向。README 明确列出的可开关功能：离线模式、天气、编辑器、账号（登录）。无数据库依赖。（来源：[README](https://github.com/soulteary/flare#feature)）

### Homarr（homarr-labs/homarr）
现代化重型仪表盘。核心特性：自由拖拽网格布局；40+ 应用集成（integrations，对接具体服务展示动态数据）；完全 UI 化管理（"No YAML"）；用户/组/权限管理；OIDC/LDAP SSO；WebSocket + tRPC 实时 widget 更新；全局搜索（可搜索集成应用内的数据）；11K+ 图标选择器；书签 widget（一个 widget 内聚合多条链接）。（来源：[README](https://github.com/homarr-labs/homarr)，特性列表及 [Bookmarks 文档](https://homarr.dev/docs/widgets/bookmarks/)）

## 二、共性功能清单（合并去重）

| # | 功能 | 一句话说明 | 代表项目 |
|---|------|-----------|---------|
| 1 | 模糊/即时搜索 | 输入即过滤卡片，键盘导航直达 | Homer, Dashy, Homarr |
| 2 | 键盘快捷键 | `/` 聚焦搜索、数字键直达高频条目、Esc 退出 | Homer, Dashy |
| 3 | 标签(tags)与别名检索 | 给条目附加关键词，搜索时命中 | Dashy |
| 4 | Web 搜索集成 | 搜索框回车落到外部引擎，支持多引擎切换 | Dashy, Heimdall, cf-workers-nav（已有） |
| 5 | 搜索 bangs | 前缀（如 `/g`、`:so`）把查询重定向到指定站点/引擎 | Dashy |
| 6 | 站内搜索（过滤自有卡片） | 搜索框同时能过滤面板内条目 | Dashy（Tiles 搜索）, Heimdall, cf-workers-nav（已有） |
| 7 | 分组/分类 + 多页面 | 条目按 section 分组，或多页签拆分 | 全部 |
| 8 | 拖拽排序/布局 | 卡片级拖拽；Homarr 进一步做自由网格布局 | 全部（程度不同） |
| 9 | 私密条目/访问控制 | 未登录隐藏特定条目；多用户权限 | Dashy（guest 只读）, Homarr（组/权限）, cf-workers-nav（已有私密链接） |
| 10 | 图标自动抓取（favicon） | 输入 URL 自动取图标 | Dashy, Heimdall, cf-workers-nav（已有） |
| 11 | 图标库/emoji/自定义图片 | 除 favicon 外的图标来源 | Dashy, Homarr, Sun-Panel（Iconify） |
| 12 | 主题/深色模式 | 内置多主题或深浅切换 | 全部（cf-workers-nav 已有深色） |
| 13 | 自定义 CSS/JS 注入 | 用户级样式与脚本扩展 | Dashy, Sun-Panel, Homer |
| 14 | PWA 可安装/离线 | 作为应用安装，离线可用 | Homer, Dashy |
| 15 | 配置可视化编辑（UI 编辑器） | 在页面里直接增删改，而非手写配置文件 | Dashy, Homarr, Sun-Panel, cf-workers-nav（已有编辑模式） |
| 16 | 配置导出/导入/备份 | YAML/JSON 导入导出，或云端加密备份 | Dashy（E2E 云备份到 CF Worker+KV）, 全部（文件级）, cf-workers-nav（已有 JSON 导入导出 + KV 备份） |
| 17 | 状态检查/服务探活 | 每卡片显示 up/down 与响应时间 | Dashy, Heimdall（Enhanced apps） |
| 18 | Widget / 应用集成动态内容 | 卡片位展示天气、下载速度、RSS 等动态数据 | Dashy, Homarr, Heimdall, flare（天气） |
| 19 | 多视图模式 | 最小视图 / 工作区视图 / APP 视图等切换 | Dashy（Minimal/Workspace）, Sun-Panel, cf-workers-nav（已有 APP 布局） |
| 20 | 打开方式可选 | 新标签/同标签/弹窗 modal/复制 URL | Dashy, Sun-Panel（小窗口） |
| 21 | 多语言 i18n | UI 界面翻译 | Dashy, Homarr, Heimdall |
| 22 | 浏览器书签导入 | 从浏览器书签 HTML 批量导入 | Dashy（Bookmarks widget 支持导入，[Dashy Academy](https://academy.dashyapp.com/importing-bookmarks/)）；其余项目均非原生特性，社区有 fork（如 sun-panel-v2）自加 |
| 23 | 使用频率统计/自动排序 | 按点击频率自动调整顺序 | 主流六项目中均未作为原生特性出现（未在任一官方 README/docs 找到） |
| 24 | 内外网地址切换 | 同一条目按网络环境打开内网/外网地址 | Sun-Panel |
| 25 | 多用户 | 多账户数据隔离 | Sun-Panel, Dashy, Homarr |

## 三、个人导航页视角的初步观察（供 #7 裁剪参考）

- **六项目均有的基线**：分组、搜索、拖拽、图标抓取、深色模式、可视化编辑、导入导出——cf-workers-nav 已全部具备。
- **高价值、低维护成本候选**（票据点名关注的四项）：
  - PWA 离线：Homer/Dashy 均为纯静态资源 + service worker 实现；cf-workers-nav 单 Worker 返回 HTML，加 manifest + SW 缓存首屏可行，维护成本低。
  - 浏览器书签导入：仅 Dashy 原生支持；实现即解析书签导出 HTML，一次性脚本逻辑，成本低。
  - 使用频率统计排序：六个主流项目均未做，属差异化功能；需要客户端埋点 + KV 计数 + 排序策略，中低成本但涉及隐私取舍。
  - 多视图模式：Dashy 的 Minimal View 定位是"快速启动器"；cf-workers-nav 已有 APP 布局，可低成本加一个极简视图。
- **低性价比（重维护，不建议）**：状态探活、Widget/应用集成、多用户/SSO、自由网格布局、多语言——这些是 Homarr/Dashy 的重型方向，与"个人导航页 + 单 Worker"定位冲突。
- **中等候选**：搜索 bangs（Dashy 式前缀重定向，纯前端逻辑，低成本）、快捷键（`/` 聚焦、数字直达，低成本）、内外网地址切换（Sun-Panel 式双 URL，低成本且个人场景常用）。
