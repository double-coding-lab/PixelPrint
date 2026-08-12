# R18 - flex-direction（v1.2.0 对账新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅（兜底）
- **排斥条件**:
  - `layoutMode` 非 `HORIZONTAL`/`VERTICAL`（非 autolayout 容器）→ 不适用
  - `_inBakedSubtree` / `_hidden` / `_templateDup` → 跳过
  - `classMap[nodeId]` 为空（不可追溯）→ 不报，由 §5.1.1 data-node-id 铁律在生成侧兜底
  - 该节点 CSS 规则体无 `display: flex` → 不判定（可能非 flex 实现）

## 触发条件

**同时满足**:

1. `node.layoutMode` ∈ `{HORIZONTAL, VERTICAL}`
2. 节点有 `data-node-id` + className 映射，且 CSS 规则体含 `display: flex`
3. CSS 的 `flex-direction` 与 Figma `layoutMode` **不符**:
   - `layoutMode === 'VERTICAL'` 但 CSS **非** `flex-direction: column`（含缺省，默认 row）→ 违规
   - `layoutMode === 'HORIZONTAL'` 但 CSS **是** `flex-direction: column`（方向写反）→ 违规

命中 → 违规。

## 期望产物

| Figma `layoutMode` | CSS `flex-direction` |
|--------------------|----------------------|
| `VERTICAL` | `column`（**必须显式写**，否则默认 row 会横排） |
| `HORIZONTAL` | `row` 或省略（row 是 flex 默认，可不写） |

## 反例（agent 常见错法）

```scss
/* ❌ small-card-top 对应 Figma Frame 764 layoutMode=VERTICAL，却写成 row */
.page {
  &__small-card-top {
    display: flex;
    flex-direction: row;   /* ← 应为 column，价格与描述该竖排却横排 */
    align-items: center;
  }
}
```

对应 cache:
```json
{ "id": "211:221", "name": "Frame 764", "type": "FRAME", "layoutMode": "VERTICAL" }
```

## 落地代码模板

```scss
/* ✅ VERTICAL → 显式 column */
.page {
  &__small-card-top {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}
```

## 违反后果

- **产物表现**：子元素排列方向反了（竖排变横排 / 横排变竖排），整块布局错乱
- **典型事故**：v1.1.0 test13 — small-card-top（Figma VERTICAL）写成 `flex-direction: row`，价格与描述横排；且该节点在 `.map()` 模板里没挂 data-node-id，逃过校验直接上线

## 与其他规则的关系

- **§5.1.1 data-node-id 全覆盖铁律**：R18 靠 data-node-id 绑定；`.map()` 模板必须挂代表项（variant a）id，否则 R18 无法校验（正是 test13 逃逸根因）
- **lib/cssMatch.mjs**：R18 用它匹配 SCSS `&__foo` 嵌套写法，避免"产物嵌套、正则找平铺"的假阴性

## Rule-Scan 识别提示

- 遍历 cache 里 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 的容器
- 提示 UI sub-agent：VERTICAL 必写 `flex-direction: column`；勿凭视觉猜方向
- 标记 `rule: 'R18'` + `expected: 'VERTICAL→column / HORIZONTAL→row'`

## 相关

- SKILL.md §4.3 判定优先级（子视角 layoutMode↔flex-direction）
- SKILL.md §5.1.1 data-node-id 全覆盖铁律
- bin/lib/cssMatch.mjs
- rules/R19-padding.md（同为 autolayout 容器忠实度）
