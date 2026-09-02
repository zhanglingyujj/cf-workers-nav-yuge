---
name: Heritage
description: A warm, grounded design system inspired by traditional craft and modern simplicity
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-variant: "#F0EEEA"
  outline: "#D1CDC5"
typography:
  h1:
    fontFamily: system-ui stack
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: system-ui stack
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: system-ui stack
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: system-ui stack
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: system-ui stack
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: system-ui stack
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: 0.05em
  mono:
    fontFamily: monospace stack
    fontSize: 0.875rem
    fontWeight: 400
rounded:
  sm: 4px
  md: 8px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  "2xl": 48px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    typography: "{typography.label-caps}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    typography: "{typography.label-caps}"
    padding: "12px 24px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    typography: "{typography.body-md}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
---

## Overview

Architectural Minimalism meets Journalistic Gravitas. The UI evokes a premium matte finish — a high-end broadsheet or contemporary gallery. Whitespace is generous, typography is intentional, and every element has room to breathe.

## Colors

The palette is rooted in high-contrast neutrals and a single warm accent color.

- **Primary (#1A1C1E):** Deep ink for headlines and core text. Use for headings, body copy, and when you need maximum contrast.
- **Secondary (#6C7278):** Sophisticated slate for borders, captions, metadata. A muted, elegant grey that doesn't compete with content.
- **Tertiary (#B8422E):** "Boston Clay" — the sole driver for interaction. Use it for CTAs, accent elements, and highlights.
- **Neutral (#F7F5F2):** Warm limestone foundation, softer than pure white. Use as the page background or secondary button fill.
- **Surface (#FFFFFF):** Pure white for cards and elevated containers on the neutral background.
- **Outline (#D1CDC5):** Subtle borders for cards, inputs, and dividers.

## Typography

系统字体栈，零外部字体请求（无 Google Fonts 外链、无 font-display 闪烁）：

- 栈：`-apple-system, system-ui, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`；代码等宽场景用 `ui-monospace, monospace`。
- **Hierarchy:** Scale from h1 (3rem) down to body-sm (0.875rem). Maintain generous line-height (1.2–1.6) for readability.

## Layout & Spacing

Spacing follows an 8px grid. Generous whitespace is a feature, not a bug. Content should feel curated, not cramped.

- **xs (4px):** Icon-to-label gaps, inline tight spacing
- **sm (8px):** Element siblings, chip gaps
- **md (16px):** Section padding, form field spacing
- **lg (24px):** Card padding, content block spacing
- **xl (32px):** Page section gaps
- **2xl (48px):** Hero section spacing

## Shapes

Rounded corners are restrained — sharp enough for professionalism, soft enough for approachability.

- **sm (4px):** Chips, badges, small inline elements
- **md (8px):** Buttons, inputs, standard interactive elements
- **lg (16px):** Cards, modals, containers
- **full (9999px):** Pills, avatars, tags

## Components

Component tokens reference the primitives above, ensuring consistency and making it easy to derive new components from the same foundation.

### Buttons
- **button-primary:** Boston Clay background with white text — the primary call to action.
- **button-secondary:** Limestone background with deep ink text — for secondary or cancel actions.

### Forms
- **input-field:** White surface with primary text color and medium rounded corners.

### Cards
- **card:** White surface with large rounded corners and generous padding.

## Do's and Don'ts

- **Do** use generous whitespace. Content should float, not fill.
- **Do** use tertiary as the sole accent. Avoid introducing new accent colors.
- **Do** use the system font stack everywhere. Avoid web-font external links.
- **Don't** use pure black (#000) or pure white (#FFF) as neutrals — they feel harsh against the warm palette.
- **Don't** add drop shadows on light backgrounds — use subtle borders instead.
- **Don't** compress spacing below the 8px grid — the system depends on breathing room.
