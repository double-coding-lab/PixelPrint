# R11 - mask-vector-css-able

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - 节点已按 R02 (fills=IMAGE) 切图 → 不重复判
  - 节点已按 R03 (implicit-image) 切图 → 不重复判
  - 简单矩形 / 圆角矩形 / 圆形 / 椭圆 → CSS 可表达,不切

## 触发条件

- **cache**: 节点或其子树含以下之一:
  - `type === 'BOOLEAN_OPERATION'`(布尔运算,如 UNION/INTERSECT/SUBTRACT)
  - 多层 `type === 'VECTOR'` 叠加
  - `node.isMask === true` 与其他节点组合
  - 复杂 SVG path(非矩形/圆形)
- **且**: 该结构**不能仅用 CSS** 表达(如 `border-radius` + `background` 组合)

## 期望产物

**核心原则**: CSS 表达不了的复合几何 → 必须切图。

**JSX 端**:
- `<img className={styles.foo} src="${ASSET_PREFIX}foo.png" data-node-id="{id}" alt="" />`

**SCSS 端**:
- 只写尺寸,**不**尝试用 CSS `mask` / 多层 `clip-path` / SVG path 还原

**反例扫描**:
- SCSS 里出现 `mask-image` / `-webkit-mask` (虽然合法,但兼容性差)
- SCSS 里出现多层 `clip-path` 试图组合
- JSX 里 inline `<svg>` 复杂 path

## 反例 (agent 常见错法)

```jsx
{/* Figma 结构: BOOLEAN_OPERATION SUBTRACT (圆环减去中间空心) */}

{/* ❌ 错法 1: agent 用 mask */}
<div className={styles.ring} />
```
```scss
.ring {
  width: 200px;
  height: 200px;
  background: #FF6600;
  mask-image: radial-gradient(circle, transparent 60px, black 61px);
  -webkit-mask-image: radial-gradient(circle, transparent 60px, black 61px);
}
```

```jsx
{/* ❌ 错法 2: agent 用 clip-path */}
<div className={styles.ring} style={{ clipPath: "..." }} />

{/* ❌ 错法 3: agent 用内联 SVG (性能差, 无缓存) */}
<svg>
  <path d="M100,100 L200,200 ..." fill="#FF6600" />
</svg>
```

## 落地代码模板

```jsx
<img className={styles.ring}
     src={`${ASSET_PREFIX}ring.png`}
     data-node-id="{id}"
     alt="" />
```

```scss
.ring {
  width: 200px;
  height: 200px;
}
```

## CSS 可表达 vs 不可表达速查

**可 CSS 表达(不切图)**:
- 纯色矩形 / 圆角矩形 → `background-color` + `border-radius`
- 单色圆形 / 椭圆 → `border-radius: 50%`
- 单向阴影 → `box-shadow`
- 单一渐变(线性/径向) → `background: linear-gradient(...)`
- 单层 border → `border`

**不可 CSS 表达(必须切图)**:
- 布尔运算(subtract/intersect/exclude)
- 多层 vector 叠加(如 icon 组合)
- 复杂 SVG path(非规则几何)
- mask 与其他 fills 组合
- 特殊纹理 / 光效

## 违反后果

- **产物表现**:
  - `mask-image` 在旧浏览器失效
  - 内联 `<svg>` 破坏组件树、无缓存
  - 复杂 `clip-path` 兼容性差
- **典型事故**:
  - v0.3.9 test8 事故 — 圆环装饰用 `mask-image`,某些手机不显示

## Rule-Scan 识别提示

- 首先看 cache 里的 `type` 分布:出现 `BOOLEAN_OPERATION` → 强命中
- 出现多个 `VECTOR` 叠加 → 命中
- 判断"CSS 可表达"的临界:如果 shape 是圆/椭圆/圆角矩形,不命中
- 输出 context 里列出复合几何的形态描述

## 相关

- SKILL.md §4.4.pre.b 子树结构禁切规则 (v0.3.9)
- rules/R02-fills-image.md
- rules/R03-implicit-image.md
