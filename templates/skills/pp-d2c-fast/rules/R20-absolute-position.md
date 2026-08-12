# R20 - absolute-position（v1.2.0 对账新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅（兜底）
- **排斥条件**:
  - `layoutPositioning !== 'ABSOLUTE'`（未脱离父顺流）→ 不适用
  - `name` 以 `fixed-` 开头 → 跳过（走 constraints 视口定位，R01 域，非 bbox 相对定位）
  - `_inBakedSubtree` / `_hidden` / `_templateDup` → 跳过
  - `classMap[nodeId]` 为空 → 不报，由 §5.1.1 兜底
  - 节点或父节点缺 `absoluteBoundingBox` → 无法精确计算，不误报

## 触发条件

设 `scale` = `config.unit.scale`（默认 2），容差 4px，父 = `cache.nodes[node._parentId]`：

- 期望 `left = (node.bbox.x − parent.bbox.x) × scale`
- 期望 `top  = (node.bbox.y − parent.bbox.y) × scale`

**任一命中**:

1. 产物写了 `top`/`left` 但与期望**相差 > 4px** → 坐标错（典型：靠猜）
2. 期望值**非 0**（|exp| > 4）但产物**缺** `top`/`left` → 丢了真实偏移

命中 → 违规。

> **容忍**：期望值 ≈ 0 且产物未显式声明 → 原点绝对定位与顺流视觉等价，不报（避免噪声）。支持 `top: 0` 无单位零与 `inset` 简写。

## 期望产物

- ABSOLUTE 子节点：`position: absolute` + `top`/`left` = `(子bbox − 父bbox) × scale`
- 父容器加 `position: relative`
- **能从 bbox 精确算出的坐标，禁止靠猜 + 「需人工核对」兜底**（§6.0.2 已封该逃逸口）

## 反例（agent 常见错法）

```scss
/* ❌ img-huochepiao 相对父 Frame 760：真值 left=-5/top=-6.5（×2=-10/-13，溢出到背景上）
      产物却写正值 40/40，方向完全反 */
.page {
  &__screen-piao {
    position: absolute;
    top: 40px;    /* ← 应 -13px */
    left: 40px;   /* ← 应 -10px */
  }
}
```

对应 cache:
```json
{ "id": "211:440", "name": "img-huochepiao", "layoutPositioning": "ABSOLUTE",
  "absoluteBoundingBox": { "x": -4016, "y": 248 },
  "_parentId": "211:102" }   // 父 Frame 760 bbox.x=-4011, y=254.5
```

## 落地代码模板

```scss
/* ✅ left=(-4016−(-4011))×2=-10；top=(248−254.5)×2=-13 */
.page {
  &__screen { position: relative; }        /* 父加 relative */
  &__screen-piao {
    position: absolute;
    top: -13px;
    left: -10px;
  }
}
```

## 违反后果

- **产物表现**：绝对定位元素位置错乱（本该溢出到背景上的贴纸缩进容器内 / 偏移丢失贴边错位）
- **典型事故**：v1.1.0 test13 — img-huochepiao 坐标靠猜写 40/40（应 -10/-13），agent 用「需人工核对」兜底交付

## 与其他规则的关系

- **R01 fixed-position**：`fixed-` 前缀走 constraints 视口定位，由 R01 管；R20 只管非 fixed 的 `layoutPositioning: ABSOLUTE`
- **§6.0.2**：R20 覆盖的坐标是"可机械计算量"，禁用「需人工核对」豁免
- **§5.1.1**：靠 data-node-id 绑定

## Rule-Scan 识别提示

- 遍历 cache 里 `layoutPositioning === 'ABSOLUTE'` 且非 `fixed-` 的节点
- 提示 UI sub-agent：top/left 用 `(子bbox − 父bbox) × scale` 算，勿目测；父加 `position: relative`
- 标记 `rule: 'R20'` + `expected: 'top/left=(子bbox−父bbox)×scale'`

## 相关

- SKILL.md §4.3 判定优先级第 0 条（`layoutPositioning: ABSOLUTE`）
- SKILL.md §6.0.2（禁「需人工核对」用于可计算量）
- rules/R01-fixed-position.md
- bin/lib/loadCache.mjs（`_parentId` 供父 bbox 查询）
