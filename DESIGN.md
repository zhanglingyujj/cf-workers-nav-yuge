---
name: Heritage Glass
description: 深色玻璃导航页设计系统，对齐 Sun-Panel 视觉基线，以壁纸为底
colors:
  primary: "#1A1C1E"   # 近黑（仅作亮度自适应文字的"黑"端）
  secondary: "#6C7278"
  tertiary: "#B8422E"  # Boston Clay，唯一强调色
  neutral: "#0D0E10"   # 页面底色（无壁纸时）
  surface: "#1e293b"   # heritage-dark-800，弹窗/菜单面
  outline: "#D1CDC5"
rounded:
  card: "16px (rounded-2xl)"
  block: "12px (rounded-xl)"
  small: "8px (rounded-lg)"
  full: "9999px"
typography:
  stack: system-ui stack（-apple-system, system-ui, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC"）
  group-title: "text-xl font-extrabold text-white + drop-shadow"
  card-title: "text-sm font-semibold"
  card-desc: "text-xs opacity-80, 最多两行省略"
---

## Overview

深色玻璃（dark glass）单主题：以用户壁纸为底，内容浮在半透明深色玻璃层上。视觉基线对齐 Sun-Panel：唯一主题、双卡片形态、每卡可自定义玻璃底色、文字按背景亮度自动黑白。

## Theme

**只有深色主题，无明暗切换。**

- 页面底色 `#0D0E10`（有壁纸时壁纸为底 + 可调遮罩）。
- heritage 色板中 `heritage-500/600/400`（Boston Clay）是唯一强调色：按钮、选中态、focus ring。禁止用于大面积填色。
- `heritage-dark-*` 色阶（slate 值）承担全部中性色：文字、边框、玻璃面。

## Cards（对齐 Sun-Panel 双形态）

玻璃底默认 `#2a2a2a6b`（`rgba(42,42,42,0.42)`）；每卡可设 `backgroundColor`（hex，含 8 位 alpha），文字颜色按背景亮度自动黑/白（luminance > 0.5 → 黑）。

### 详情卡（默认）

横排：`rounded-2xl` 玻璃底整卡 → 左 70px 图标槽（透明，图标 50px `rounded-xl`）→ 右侧名称（`font-semibold text-sm` 单行省略）+ 描述（`text-xs opacity-80` 两行省略）。hover 阴影 `0 0 20px 10px rgba(0,0,0,0.2)`。

### 极简卡（APP 布局，分类级开关）

竖排：70px 图标槽自身带玻璃底 + `rounded-2xl` overflow-hidden → 下方名称（`text-sm` 居中单行省略、白字 + drop-shadow）。**不渲染描述**（描述仅作悬停提示）。

## Grid & Groups

- 详情卡网格：`auto-fill minmax(200px,1fr)`，移动端 150px，gap 18px。
- 极简卡网格：`auto-fill minmax(75px,1fr)`，gap 18px。
- 组标题：`text-xl font-extrabold text-white` + drop-shadow；编辑控制按钮在编辑模式常显（移动端无 hover）。

## Do / Don't

- **Do** 用 heritage-dark 色阶做一切中性色。
- **Do** 亮色卡片背景配黑字（自动计算，勿手写）。
- **Don't** 引入浅色背景/浅色主题变体。
- **Don't** 用 Boston Clay 做大面积填充。
