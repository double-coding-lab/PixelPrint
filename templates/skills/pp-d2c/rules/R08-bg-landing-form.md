# R08 - bg-landing-form

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无(反向匹配,自成一体)

## 触发条件

- **cache**: `node.name.startsWith('bg-')` 或 `node.name === 'bg'`
- **命中信号**: 图层名以 `bg-` 开头(如 `bg-body`、`bg-header`、`bg-card`)或裸 `bg`

## 期望产物

**核心原则**: `bg-` 前缀节点表示"该节点是父容器的背景",**必须以父容器的 `background-image` 方式落地**。

**JSX 端** (强制):
- **不**为 bg 节点单独渲染 `<div>` 或 `<img>`
- **父容器** 直接挂 `className` 并有 `data-node-id="{bgNodeId}"` (代表这层背景由 bg 节点提供)

**SCSS 端**:
- **父容器类**含 `background-image: url("...bg-xxx.png")` + `background-size: cover|100% 100%`

**禁止的落地形态** (反向扫描):

| 错法 | 表现 | 检测正则 |
|---|---|---|
| `<img src="bg-xxx.png">` | 把 bg 当前景图 | `/<img[^>]*src=[^>]*bg-/` |
| `<img src=".../bg.png">` (裸 bg) | 同上 | `/<img[^>]*src=[^>]*\/bg\.[a-z]+/` |
| `style={{ background: ... }}` | inline style | `/style=\{\{[^}]*background/` |
| `.foo::before { background-image }` | 伪元素挂 bg | `/::(before\|after)\s*\{[^}]*background-image/` |
| `<div className={styles.bg} />` (空 div) | 空 div 挂 bg | `/<div[^>]*className=\{styles\.bg[^}]*\}[^>]*\/>/` |

## 反例 (agent 常见错法)

```jsx
{/* ❌ 错法 1: bg 用 <img> */}
<img src={`${ASSET_PREFIX}bg-body.png`} className={styles.bgBody} />

{/* ❌ 错法 2: inline style */}
<div style={{ backgroundImage: `url(${ASSET_PREFIX}bg-body.png)` }} />

{/* ❌ 错法 3: 空 div 挂 bg */}
<div className={styles.bgBody} data-node-id="211:37" />
{/* 然后在其他 div 里塞内容,分开的父子关系 */}
```

```scss
/* ❌ 错法 4: 伪元素 */
.page::before {
  content: "";
  background-image: url("...bg-body.png");
  position: absolute;
  inset: 0;
}
```

## 落地代码模板

```jsx
<div className={styles.page} data-node-id="211:31">
  {/* 父容器 page 承担 bg-body 的背景, 无需为 bg-body 单开元素 */}
  <div className={styles.topbar} data-node-id="211:32">...</div>
  <div className={styles.content}>...</div>
</div>
```

```scss
.page {
  background-image: url("../../static/test1/bg-body.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  width: 750px;
  min-height: 100vh;
}
```

## 违反后果

- **产物表现**:
  - `<img>` 挂 bg → 图片和内容 z-index 冲突,内容被压在图后
  - 伪元素挂 bg → 父容器 `position: relative` 忘配时定位错
  - inline style → 无缓存、无响应式,后期难维护
- **典型事故**:
  - v0.3.9 test8 事故 — `bg-body` 用 `<img>` + `position: absolute`,内容层被盖住

## Rule-Scan 识别提示

- 触发只看图层名(`bg-` 前缀 or 裸 `bg`)
- 判定产物形态需 Read jsx/scss,对照上表 5 种禁止形态
- **警惕**: 有些 agent 会把 bg 分层到子块内(不是 page 而是 sub- 或 block-),这时候 bg 应挂到那个子块的父容器

## 相关

- SKILL.md §4.3 硬规则第 4 条
- rules/R02-fills-image.md (fills IMAGE 的通用落地)
