# R13 - unit-scale

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌ (未来可升,现阶段需 config 解析)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: `pp-d2c.config.json` 的 `unit.figmaBase === unit.outputBase` → scale=1,不适用

## 触发条件

- **config**: `unit.scale !== 1`(常见 Figma 375 base 输出到 750 px,scale=2)
- **命中信号**: 产物 CSS 中的 `px` 数字与 Figma 原始尺寸相同(意味着没换算)

## 期望产物

**换算公式**:
```
outputPx = figmaPx * (unit.outputBase / unit.figmaBase)
```

**举例**(figmaBase=375, outputBase=750, scale=2):

| Figma 尺寸 | 输出尺寸 |
|---|---|
| `x=20, y=44` | `20 * 2 = 40px, 44 * 2 = 88px` |
| `width=335, height=118` | `670px × 236px` |
| `fontSize=16` | `32px` |
| `borderRadius=8` | `16px` |
| `padding: 12 20` | `24px 40px` |

**SCSS 端**:
- 所有 `px` 值都是换算后的输出值,不含 Figma 原值

## 反例 (agent 常见错法)

```scss
/* Figma cache: node.width = 335, node.absoluteBoundingBox.height = 118
   config: figmaBase=375, outputBase=750, scale=2
   期望输出: width=670px, height=236px

   agent 错法: */
.card {
  width: 335px;      /* ❌ Figma 原值,未换算 */
  height: 118px;     /* ❌ */
  padding: 12px;     /* ❌ */
  font-size: 16px;   /* ❌ */
  border-radius: 8px; /* ❌ */
}

/* 期望 */
.card {
  width: 670px;
  height: 236px;
  padding: 24px;
  font-size: 32px;
  border-radius: 16px;
}
```

## 落地代码模板

**UI sub-agent 生 SCSS 前应用换算**:
```js
const config = readConfig();
const scale = config.unit.outputBase / config.unit.figmaBase;

function toPx(figmaPx) {
  return `${Math.round(figmaPx * scale)}px`;
}

// 使用
.card {
  width: ${toPx(node.width)};
  height: ${toPx(node.height)};
}
```

## 违反后果

- **产物表现**:
  - 375 base 输出到 750 屏幕 → 元素显示只有一半大小
  - 或应用 `rem` 换算时,基础字号错乱
- **典型事故**:
  - v0.3.8 test1 事故 — agent 忘换算,整个页面在真机上缩小一半

## Rule-Scan 识别提示

- Read `pp-d2c.config.json`,取 `unit.figmaBase` / `unit.outputBase`
- scale = outputBase / figmaBase
- 若 scale === 1 → 不适用
- 命中判定:
  - Read 产物 SCSS,提取所有 `\d+px`
  - 反查每个 px 值对应的 nodeId,读 cache 的 `absoluteBoundingBox.width/height` / `x/y`
  - 若产物 px === Figma px 且 scale != 1 → 命中 R13

## 相关

- SKILL.md §4.5 单位换算
- pp-d2c.config.json `unit.figmaBase` / `unit.outputBase`
- rules/R10-no-fake-solid-color.md
