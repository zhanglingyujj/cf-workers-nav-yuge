# 与 Sun-Panel 导入导出格式对齐评估

> 结论：**不建议替换内部存储格式，建议"导出双格式 + 导入已兼容"方案**。改动量小（约半天），风险可控。

## 1. 双方格式现状

### 本站原生格式（KV `CARD_ORDER` → `/api/exportData`）

```json
{
  "categories": {
    "<分类名>": {
      "isHidden": false,
      "isAppLayout": false,
      "links": [
        {
          "name": "示例",
          "url": "https://example.com",
          "tips": "描述",
          "icon": "https://... 或空(自动抓取)",
          "backgroundColor": "#RRGGBBAA 或空",
          "isPrivate": false,
          "category": "<分类名>"
        }
      ]
    }
  }
}
```

### Sun-Panel 导出格式（`*.sun-panel.json`）

来源：`hslr-s/sun-panel` 仓库 `src/utils/jsonImportExport/index.ts` 与 `service/models/itemIcon.go`。

```json
{
  "version": 1,
  "appName": "Sun-Panel-Config",
  "exportTime": "YYYY-MM-DD HH:mm:ss",
  "appVersion": "",
  "icons": [
    {
      "title": "分组名",
      "sort": 1,
      "children": [
        {
          "title": "站点名",
          "sort": 1,
          "icon": { "itemType": 0, "src": "url 或 base64", "text": "", "backgroundColor": "" },
          "url": "https://...",
          "lanUrl": "http://192.168...",
          "description": "描述",
          "openMethod": 1
        }
      ]
    }
  ],
  "md5": "<JSON 序列化(不含 md5 字段)的 MD5>"
}
```

## 2. 字段映射关系

| 本站字段 | Sun-Panel 字段 | 映射说明 |
|---|---|---|
| 分类名 (categories key) | `icons[].title` | 直接对应 |
| 分类排序 (对象插入顺序) | `icons[].sort` | 本站靠对象顺序表达，导出时按序生成 sort |
| `links[].name` | `children[].title` | 直接对应 |
| `links[].url` | `children[].url`（优先）/ `lanUrl` | 本站无内外网双地址，导入取 url 为空时的 lanUrl |
| `links[].tips` | `children[].description` | 直接对应 |
| `links[].icon` | `children[].icon.src` | itemType 区分图片/文字图标；文字图标（`icon.text`）无本站对应，降级为自动抓取 |
| `links[].backgroundColor` | `children[].icon.backgroundColor` | 仅作用于图标槽 vs 本站整卡，语义有偏差但可映射 |
| `links[].sort`（数组顺序） | `children[].sort` | 本站靠数组顺序表达 |
| `isPrivate` | **无** | 本站私有标记，导出 Sun-Panel 格式时丢失（单向降级） |
| `categories.isAppLayout` | **无**（Sun-Panel 分组样式存在数据库，不在导出 JSON 内） | 丢失 |
| `categories.isHidden` | **无** | 丢失 |
| **无** | `openMethod`（1=当前页 2=新标签） | 本站固定新标签打开，可忽略或后续支持 |
| **无** | `version` / `md5` / `appVersion` / `exportTime` | 导出时补齐固定值即可，md5 算法公开（对不含 md5 的 JSON 串做 MD5） |

## 3. 兼容性风险

1. **信息丢失是单向的**：`isPrivate`、`isHidden`、`isAppLayout`、卡片背景色语义在 Sun-Panel 格式中不存在或语义不同。若把 Sun-Panel 格式作为唯一导出格式，往返（导出→导入）后这些设置会被抹掉。
2. **md5 校验**：Sun-Panel 导入时会校验 md5。若想让自己的导出文件能被 Sun-Panel 官方导入，必须按其算法生成 md5（CryptoJS `MD5(JSON.stringify(jsonData))`，其中 jsonData 尚无 md5 字段）。实现简单，但属于对其内部实现的耦合。
3. **图标**：Sun-Panel 图标常为上传文件（iconType + 相对路径），本站图标为 URL/自动抓取；跨系统迁移时相对路径图标会失效，需容错降级。
4. **书签导入已兼容**：`src/frontend/bookmark-parsers.js` 已实现 Sun-Panel JSON 的解析导入（按 sort 排序、url/lanUrl 兜底、icon.src 映射），**导入方向已打通**。

## 4. 方案建议

**推荐：A（导出双格式）**，不做 B（内部格式替换）。

- **方案 A：导出时可选格式** —— 导出弹窗增加"本站格式 / Sun-Panel 格式"两个选项；Sun-Panel 格式按上表正向映射生成（补 `version:1`、`appName`、`exportTime`、`sort`、`md5`）。导入方向已兼容双格式，无需改动。
  - 工作量：约 0.5 天（前端导出弹窗 + 一个纯函数序列化器 + 单测）。
  - 风险：低；不触碰存储与既有导入逻辑。
- **方案 B：内部存储改为 Sun-Panel 格式** —— 需要重写 save/load/backup/import 全链路，且丢失 `isPrivate`/`isHidden`/`isAppLayout` 等本站独有能力（或塞进非标字段，变成事实上不兼容的方言）。
  - 工作量：2~3 天 + 全量回归；风险高，无收益。**不推荐**。

### 方案 A 落地要点（待排期）

1. `bookmark-parsers.js` 旁新增 `sun-panel-serializer.js`：`toSunPanelConfig(categories) → object`（含 md5）。
2. 导出弹窗复用任务 2 的选择弹窗交互（本站格式 / Sun-Panel 格式）。
3. md5 依赖：浏览器端可用 `crypto.subtle.digest('MD5')`（不可用，subtle 不支持 MD5）→ 需引入约 3KB 的 md5 纯 JS 实现，或在 Worker 端（Node 兼容层）计算后返回。
4. 单测：字段映射、sort 生成、md5 与 Sun-Panel 官方导出文件互认。
