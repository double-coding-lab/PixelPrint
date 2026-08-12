# R17 - no-baked-dom（v1.2.0 对账新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅（兜底）
- **排斥条件**:
  - 节点 `_inBakedSubtree !== true`（不在整体切图子树内）→ 不适用
  - 节点 `_templateDup === true`（`.map()` 数据副本）→ 跳过（代表项报过即可）

## 触发条件

**同时满足**:

1. 节点处于 `bg-` / `img-`（整体切图，含裸词 `bg`/`img`）或 `x-`（整体忽略）前缀节点的**子树内**（`loadCache.mjs` 标注 `_inBakedSubtree === true`，`_bakedBy` 指向那个前缀节点）。**不含 `bgc-`**：bgc- 是盒级 CSS 写父、非切图，其子孙走正常规则（见 R21）
2. 产物 JSX 中出现该节点的 `data-node-id="<nodeId>"` 元素（跨行 / 属性顺序任意）

命中 → 违规（双重渲染）。

## 期望产物

- 整体切图子树内的节点，其像素**已经在父层切图 PNG 里**（`bg-`/`bgc-`/`img-`），或被 `x-` 整体忽略
- 产物中**不得**再有其 `data-node-id` 元素——它不该作为独立 DOM 出现
- 与 R02/R06 分工：R02/R06 **跳过** baked 子孙（不逐个溯源），"禁 DOM" 由本条正向兜底

## 反例（agent 常见错法）

```jsx
{/* ❌ bg-main(211:39) 整体切成 main.png，title/subtitle 文字像素已在 PNG 里 */}
<div className="page__main-bg" data-node-id="211:39" />
{/* ↓ 但又把 bg-main 子孙的 title-text/subtitle 生成成 DOM → 文字渲染两遍、叠字 */}
<div className="page__title-row" data-node-id="211:410">
  <span className="page__title-text" data-node-id="211:83">中秋火车票开售预测</span>
</div>
<p className="page__subtitle" data-node-id="211:84">官方尚未给出明确开售时间...</p>
```

对应 cache（211:83 / 211:84 是 bg-main 211:39 的子孙）:
```json
{ "id": "211:39", "name": "bg-main", "type": "GROUP",
  "children": [ { "id": "211:410", "children": [ { "id": "211:83", "type": "TEXT" } ] },
                { "id": "211:82",  "children": [ { "id": "211:84", "type": "TEXT" } ] } ] }
```

## 落地代码模板

```jsx
{/* ✅ bg-main 整体切图 → 只保留背景层，子孙文字不再出 DOM（已在 main.png 里） */}
<div className="page__main-bg" data-node-id="211:39" />
{/* title-text / subtitle 不生成 —— 它们的像素在 main.png 中 */}
```

若文案需要动态替换 → 见 §4.3「含 TEXT 容器 压平 vs 拆」裁决树：改走**拆结构**（去掉 bg- 前缀，文字出 DOM，背景单独切成不含文字的图），而非"既烤又留"。

## 违反后果

- **产物表现**：文字/图叠一遍（切图里一份 + DOM 一份），视觉重影、错位
- **典型事故**：v1.1.0 test13 — bg-main 的 title-text/subtitle/韩国贴纸既进 main.png 又出 DOM，用户手工删除 DOM 才修正

## 与其他规则的关系

- **R16 no-flatten-text**：R16 管"不该压平的容器被整体切图"；R17 管"该压平的容器压平后子孙又出 DOM"。二者是同一矛盾（压平 vs 拆）的两面
- **R02/R06**：跳过 `_inBakedSubtree` 节点（不误报"缺 url/缺 color"），"禁 DOM" 交由 R17
- **§6.0.2 兜底防线 N=0**：R17 违规一律不许豁免，回滚

## Rule-Scan 识别提示

- 遍历 cache，找 `_inBakedSubtree === true` 的节点
- 检查产物 JSX 是否有其 `data-node-id`
- 有 → 标记 `rule: 'R17'` + `expected: '整体切图子树内节点禁止出 DOM（像素已在父层切图）'`

## 相关

- SKILL.md §4.3「含 TEXT 容器 压平 vs 拆」裁决树
- SKILL.md §6.0.2 兜底防线
- rules/R16-no-flatten-text.md
- bin/lib/loadCache.mjs（`_inBakedSubtree` 标注）
