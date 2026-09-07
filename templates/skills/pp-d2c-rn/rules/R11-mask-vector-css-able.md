# R11 - mask-vector-css-able(RN 文档改写,软防线;RN 可表达集更小)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: 已按 R02(fills=IMAGE)/R03(implicit-image)切图 → 不重复判;简单矩形/圆角矩形/圆形 → style 可表达,不切

## 触发条件

- **cache**: 节点或其子树含 `BOOLEAN_OPERATION` / 多层 `VECTOR` 叠加 / `isMask === true` 组合 / 复杂 path
- **且**: 该结构不能仅用 RN style 表达

## 期望产物

**核心原则**:RN 可表达集比 CSS 更小——没有 `mask` / `clip-path` / 多值 background / SVG path 原生能力,**复合几何基本一律切图**,判"该切图"的门槛比 h5 更低。

- `<Image source={require('...')} style={styles.foo} data-node-id="{id}" />`
- style 只写尺寸与定位,禁止试图用 borderRadius 组合近似复合几何

## RN 可表达 vs 不可表达速查

**可 style 表达(不切图)**:
- 纯色矩形 / 圆角矩形 → `backgroundColor` + `borderRadius`
- 圆形 / 椭圆 → `borderRadius`(取宽高一半)
- 阴影 → `shadowColor/shadowOffset/shadowRadius/shadowOpacity` + `elevation`
- 单层 border → `borderWidth` + `borderColor`

**不可表达(必须切图)**:
- 布尔运算(subtract/intersect/exclude)
- 多层 vector 叠加(icon 组合)
- 任何 mask 组合(RN 无 mask;MaskedView 是三方库,不默认引入)
- 渐变(除非项目已接 LinearGradient,否则按退化表)
- 特殊纹理 / 光效 / 复杂 path

## 反例 (agent 常见错法)

```tsx
// Figma: BOOLEAN_OPERATION SUBTRACT(圆环)
// ❌ 试图用两层 View + borderRadius 近似圆环(内圈颜色永远对不准)
<View style={styles.ringOuter}><View style={styles.ringInner} /></View>

// ❌ 引入 react-native-svg 内联 path(未经项目确认引依赖)
```

## 违反后果

- **产物表现**: 复合几何被 View 近似,视觉失真;或私自引入三方依赖

## Rule-Scan 识别提示

- cache 出现 `BOOLEAN_OPERATION` → 强命中;多个 `VECTOR` 叠加 → 命中
- 圆/椭圆/圆角矩形不命中
- 输出 context 里列出复合几何的形态描述

## 相关

- rules/R02-fills-image.md
- rules/R03-implicit-image.md
