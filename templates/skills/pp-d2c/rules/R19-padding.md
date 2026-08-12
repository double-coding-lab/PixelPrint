# R19 - padding（v1.2.0 对账新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅（兜底）
- **排斥条件**:
  - `layoutMode` 非 `HORIZONTAL`/`VERTICAL`（padding 仅在 autolayout 容器有意义）→ 不适用
  - `_inBakedSubtree` / `_hidden` / `_templateDup` → 跳过
  - `classMap[nodeId]` 为空 → 不报，由 §5.1.1 兜底
  - CSS padding 含非 px 值（%/auto/var/calc）→ 放弃比对（不误报）

## 触发条件

设 Figma 期望 padding = `[paddingTop, paddingRight, paddingBottom, paddingLeft] × scale`，容差 2px。

**任一命中**:

1. Figma 四边 padding 均为 0，但产物写了非 0 padding → **凭空捏造**
2. Figma 有 padding，但产物**未写** padding → 漏写
3. 产物 padding 某边与 Figma×scale **相差 > 2px** → 数值错

命中 → 违规。

## 期望产物

- CSS padding 四值 ≈ `Figma paddingT/R/B/L × scale`
- Figma pad0 → 产物**不写** padding（或显式 0）
- 支持 shorthand（`padding: 0 82px 10px 82px`）与 longhand（`padding-left` 等），longhand 覆盖 shorthand 对应边
- **无单位 0 合法**（`padding: 0 12px` 里的 `0` 按 0px 处理）

## 反例（agent 常见错法）

```scss
/* ❌ small-card-top 对应 Figma Frame 764 四边 padding 全 0，却凭空加了 0 12px */
.page {
  &__small-card-top {
    display: flex;
    padding: 0 12px;   /* ← Figma pad0，凭空捏造 */
  }
}
```

对应 cache:
```json
{ "id": "211:221", "layoutMode": "VERTICAL",
  "paddingTop": 0, "paddingRight": 0, "paddingBottom": 0, "paddingLeft": 0 }
```

## 落地代码模板

```scss
/* ✅ Figma pad0 → 不写 padding */
.page {
  &__small-card-top { display: flex; flex-direction: column; }
}

/* ✅ Figma pad=[0,41,5,41]，scale=2 → padding: 0 82px 10px 82px */
.page {
  &__btn-q { display: flex; padding: 0 82px 10px 82px; }
}
```

## 违反后果

- **产物表现**：内容框内边距多/少，元素错位、挤压或留白异常
- **典型事故**：v1.1.0 test13 — small-card-top（Figma pad0）凭空加 `padding: 0 12px`；btn-q（Figma pad=[0,41,5,41]）漏写 padding

## 与其他规则的关系

- **R18 flex-direction**：同为 autolayout 容器忠实度，成对使用
- **R13 unit-scale**：R19 的期望值走 `Figma padding × scale`，与 R13 换算口径一致
- **§5.1.1**：靠 data-node-id 绑定，模板项挂代表项 id

## Rule-Scan 识别提示

- 遍历 cache 里 autolayout 容器，读 `paddingTop/Right/Bottom/Left`
- 提示 UI sub-agent：padding 从 Figma 读，勿凭视觉估；Figma 0 就别写
- 标记 `rule: 'R19'` + `expected: 'padding = Figma四边×scale'`

## 相关

- SKILL.md §4.3 判定优先级（父视角 padding）
- SKILL.md §5.1.1 data-node-id 全覆盖铁律
- bin/lib/cssMatch.mjs
- rules/R18-flex-direction.md
