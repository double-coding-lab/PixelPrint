# R04 - text-gradient

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - 末位可见 fill 是 SOLID → 归 R06
  - 末位可见 fill 是 IMAGE 且节点不是 TEXT → 归 R02

## 触发条件

- **cache**: `node.type === 'TEXT'`
- **fills 末位可见** (从 `fills.length-1` 倒序找第一个 `visible !== false`) 的类型是:
  - `GRADIENT_LINEAR` / `GRADIENT_RADIAL` / `GRADIENT_ANGULAR` / `GRADIENT_DIAMOND`
  - `IMAGE`

## 期望产物

**JSX 端** (强制):
```jsx
<div className={styles.title} data-node-id="{id}">
  <span>2026</span>
</div>
```

**SCSS 端** (强制):
```scss
.title {
  span {
    background: linear-gradient(180deg, #FFF7EE 0%, #FFDBAA 100%);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
}
```

**关键点**:
- `<span>` 是**必须的**(background-clip 需要行内元素承载)
- `background` 后必须紧跟 `background-clip: text` + `color: transparent`
- 缺任何一项都会失效(要么整块背景、要么无渐变)

## Handle → CSS angle 转换表

Figma `gradientHandlePositions` 有 3 个点:`P0=起点, P1=终点, P2=侧向控制点`。

| 常见 handle (P0→P1) | CSS angle | 视觉方向 |
|---|---|---|
| `[0.5, 0] → [0.5, 1]` | `180deg` | 从上到下 |
| `[0.5, 1] → [0.5, 0]` | `0deg` | 从下到上 |
| `[0, 0.5] → [1, 0.5]` | `90deg` | 从左到右 |
| `[1, 0.5] → [0, 0.5]` | `270deg` | 从右到左 |
| `[0, 0] → [1, 1]` | `135deg` | 左上到右下 |
| `[1, 0] → [0, 1]` | `225deg` | 右上到左下 |

**通用公式**:
```
angle_rad = atan2(P1.x - P0.x, P0.y - P1.y)  // 注意 y 反向
angle_deg = angle_rad * 180 / π
// 结果映射到 CSS 0..360
```

## 反例 (agent 常见错法)

```scss
/* ❌ 错法 1: 凭空搓 solid color 代替 gradient */
.title { color: #FFDBAA; }

/* ❌ 错法 2: 写 background 但没 background-clip */
.title {
  background: linear-gradient(180deg, #FFF7EE 0%, #FFDBAA 100%);
  /* 缺 background-clip: text 和 color: transparent → 整个块被染色,文字看不见 */
}

/* ❌ 错法 3: 没包 <span>,直接给 .title 挂 background-clip → Safari 部分场景失效 */
```

## 落地代码模板

**GRADIENT_LINEAR**:
```jsx
<div className={styles.title2026} data-node-id="211:411 > 211:91">
  <span>2026</span>
</div>
```
```scss
.title2026 {
  font-size: 48px;
  font-weight: bold;
  span {
    background: linear-gradient(180deg, #FFF7EE 0%, #FFDBAA 100%);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
}
```

**IMAGE fill**:
```jsx
<div className={styles.brandText} data-node-id="{id}">
  <span>品牌名</span>
</div>
```
```scss
.brandText span {
  background: url("../../static/xxx/brand-fill.png") center / cover;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

## 违反后果

- **产物表现**: 文字渐变/图案填充丢失,变成纯色或整块背景
- **典型事故**:
  - v0.3.21 test8 事故 — `2026 (TEXT)` 应该白到金渐变,agent 写成 `color: white`

## Rule-Scan 识别提示

- 只判 TEXT 节点
- fills 数组末位可见类型判断:
  ```js
  const lastVisible = fills.slice().reverse().find(f => f && f.visible !== false);
  if (lastVisible && (lastVisible.type.startsWith('GRADIENT') || lastVisible.type === 'IMAGE')) → 命中 R04
  ```
- 输出 context 里必须带 `fills_last_type` / `fills_last_stops` / `fills_last_handles`,UI sub-agent 直接照做

## 相关

- SKILL.md §4.1.1 TEXT 多层 fills 处理
- rules/R06-text-solid-last.md (末位 SOLID 的对应规则)
