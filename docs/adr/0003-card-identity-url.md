# 0003: 暂不引入卡片 id，以 URL 为卡片身份

日期：2026-09-04
状态：已被取代（见 0004-card-identity-id.md）

## 背景

架构审查发现卡片身份是 Primitive Obsession：DOM 用 `data-url` 定位卡片（约 10 处），`updateLink`/`removeLink` 全量扫描所有分组按 url 查找，编辑弹窗改 URL 即换身份。潜在 bug：两张同 URL 卡片（不同分组/名称）会让 update/remove 命中第一张。

## 决策

**暂不引入卡片 id**，继续以 URL 作为卡片身份。理由：

1. 引入 id 是 schema 变更，牵动后端存储、导入导出、Sun-Panel 格式兼容（见 docs/research/sun-panel-format-alignment.md），扩散面远大于当前收益。
2. 同 URL 双卡命中错误目标目前无实际 bug 报告，纯属理论风险。
3. 数据规模（个人导航页）下触发概率极低。

## 重启条件

满足任一时应重开本决策：

- 同 URL 双卡命中错误目标成为实际 bug 报告；
- 引入需要稳定卡片身份的功能（卡片级历史、统计、跨设备同步等）。

## 备选方案

为每张卡生成 `crypto.randomUUID()`，url 降为普通属性——被否（当下）：扩散面与收益不成比例，见上述理由。
