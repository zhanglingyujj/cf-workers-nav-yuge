---
name: Heritage Glass Mono
description: 深色内容 + 亮色浮层的双层玻璃设计系统，黑白灰配色，以壁纸为底
colors:
  primary: "#1A1C1E"   # 近黑（仅作亮度自适应文字的"黑"端）
  secondary: "#6C7278"
  accent: "#E4E4E7 / #18181B"  # 黑白灰：亮面用深、暗面用白，无彩色强调
  neutral: "#0D0E10"   # 页面底色（无壁纸时）
  surface-dark: "#2a2a2a8c"    # 内容区玻璃面（浮岛/区块）
  surface-light: "rgba(255,255,255,0.95)"  # 浮层面（菜单/面板/弹窗/tooltip）
  outline: "#D1CDC5"
rounded:
  card: "16px (rounded-2xl)"
  block: "12px (rounded-xl)"
  small: "8px (rounded-lg)"
  full: "9999px"
typography:
  stack: system-ui stack（-apple-system, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC"）
  site-title: "text-[22px] font-bold（浮岛标题，略大于分组标题）"
  group-title: "text-xl font-extrabold text-white + drop-shadow"
  card-title: "text-sm font-semibold"
  card-desc: "text-xs opacity-80, 最多两行省略"
---

## Overview

深色玻璃内容 + 亮色浮层的双层体系（ADR-0002）：以用户壁纸为底，**内容区**浮在半透明深色玻璃上，**浮层**（菜单/面板/弹窗/提示）统一亮色白底。配色黑白灰（zinc 阶），无彩色强调色。卡片沿用 Sun-Panel 双形态。

## 分层规则（最重要）

| 层 | 底色 | 用途 |
|---|---|---|
| 内容区 | 深色玻璃 `#2a2a2a8c` + blur | 浮岛、卡片、区块控件、返回顶部 |
| 浮层 | `bg-white/95` + blur + `border-zinc-200` | 下拉菜单、命令面板、全部弹窗、tooltip |

判断归属：跟随页面滚动的属于内容区（深）；覆盖在页面之上、可开合的属于浮层（亮）。

## 内容区（深色玻璃）

- 页面底色 `#0D0E10`（有壁纸时壁纸为底 + 可调遮罩，默认 30%）。
- `heritage` 色阶 = zinc 灰阶：暗面上的强调用白（`heritage-400/500`），主按钮/选中用深（浮层上）。禁止彩色强调。
- `heritage-dark-*` 色阶承担暗面中性色：文字、边框。
- **浮岛（Island）**：固定顶部居中，宽度与内容区卡片边界对齐（`max-w-[1200px]`，随断点内边距缩放）。结构：logo + 站点标题（22px，可编辑，`/api/settings` 通道）+ 分隔线 + 搜索触发（`Alt C` / `/` 唤起命令面板）+ 设置按钮。玻璃 `#2a2a2a8c` + `border-white/10` + 柔光阴影。

## 浮层（亮色，统一规格）

- 容器：`bg-white/95 backdrop-blur-xl border-zinc-200 shadow-xl shadow-black/20~30`
- 文字：正文 `text-zinc-700`、标题 `text-zinc-900`、label 小标题 `text-zinc-500`
- 悬停：`hover:bg-zinc-200 hover:text-zinc-900`；危险项 `hover:bg-red-50 hover:text-red-600`
- 选中态（持久/键盘）：`bg-zinc-800 text-white`；鼠标悬停瞬时态一律灰（zinc-200），不用黑
- 输入框：`bg-zinc-50 border-zinc-200 focus:ring-zinc-400`
- 主按钮 `bg-zinc-900 hover:bg-zinc-700 text-white`；次按钮 `bg-zinc-100 text-zinc-600 hover:bg-zinc-200`
- 分割线 `zinc-200/80`
- 命令面板引擎栏：等宽分段控件（`flex-1 h-11`），选中项 `bg-zinc-800 text-white`；移动端顶栏 Esc 徽标换为“取消”按钮
- 危险项（删除/退出登录）常态红字 `text-red-600`，悬停 `hover:bg-red-50`

## Cards（对齐 Sun-Panel 双形态）

**图标原样呈现**：favicon 不裁剪、不加默认衬底，以其自身形状呈现（Q10 决议）。详情卡玻璃底默认 `rgba(42,42,42,0.40)`；每卡可设 `backgroundColor`（hex，含 8 位 alpha，极简卡设于图标槽、详情卡设于整卡），文字颜色按背景亮度自动黑/白（luminance > 0.5 → 黑）。

### 详情卡（默认）

横排：`rounded-2xl` 玻璃底整卡 → 左 56px 图标槽（透明，图标 44px 原样不裁剪）→ 右侧名称（`font-semibold text-xs sm:text-sm` 单行省略）+ 描述（`text-xs line-clamp-2`）。hover 阴影 `0 0 20px 10px rgba(0,0,0,0.2)`。

### 极简卡（APP 布局，分类级开关）

竖排：56px 图标槽默认无底色（仅自定义色时渲染），图标 52px 原样呈现，槽和图标均带投影兜底 → 下方名称（`text-xs sm:text-sm` 居中单行省略、白字 + drop-shadow `0 1px 3px rgba(0,0,0,0.7)`）。**不渲染描述**（描述仅作悬停提示）。

## 可读性兜底（三层参数，2026-11-10 定）

壁纸亮度不可控，内容区文字/图标靠三层参数保证可读，单一参数不够、全套过头（证据：`scripts/proto-matrix.mjs` 参数矩阵）：

| 层 | 默认值 | 作用对象 |
|---|---|---|
| 全局遮罩 | 30%（`#bg-mask`） | 全部白色元素 |
| 卡片玻璃底 | `rgba(42,42,42,0.40)` | 详情卡内文字 |
| 文字/图标阴影 | 标签 `0 1px 3px rgba(0,0,0,0.7)`；图标 `0 1px 3px rgba(0,0,0,0.6)` | 裸文字与无衬底图标 |

## 触控与键盘（交互规范）

- 移动端（<640px）可点击目标 ≥44px（编辑工具栏、引擎分段栏邨遵守；桌面端可收窄）。
- 所有浮层（弹窗/命令面板/卡片菜单/下拉）统一 Esc 关闭，一次只关最顶层（z 序）；浮层开着时全局快捷键（`/`、数字键、`Alt C`）不响应。

## Grid & Groups

- 详情卡网格：`auto-fill minmax(200px,1fr)`，移动端 150px，gap 18px。
- 极简卡网格：`auto-fill minmax(75px,1fr)`，gap 18px。
- 组标题：`text-xl font-extrabold text-white` + drop-shadow；编辑控制按钮在编辑模式常显（移动端无 hover）。

## Do / Don't

- **Do** 内容区用 heritage-dark 色阶做中性色，浮层用 zinc 阶。
- **Do** 亮色卡片背景配黑字（自动计算，勿手写）。
- **Do** 新浮层直接套用上文浮层规格，勿自创配色。
- **Don't** 引入彩色强调色（历史 Boston Clay 已废弃）。
- **Don't** 在浮层用暗面 token（heritage-dark-*）做文字/边框。
- **Don't** 给瞬时悬停态用黑底——黑底只属于持久/键盘选中态。
