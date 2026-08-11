# R01 - fixed-position

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无(与 R14 fixed-z-index 是"父规则-补充规则"关系,不排斥)

## 触发条件

- **cache**: `node.name.startsWith(config.layers.fixed || 'fixed-')`
- **命中信号**: 图层名以 `fixed-` 开头(如 `fixed-状态栏`、`fixed-topbar`、`fixed-底部bar`)

## 期望产物

**JSX 端**:
- 该节点对应的 `<div>` / `<section>` 必须有 `className` 且带 `data-node-id`

**SCSS 端**:
- 对应 className 规则内 **必须含** `position: fixed;`
- 同时按 `constraints` 推 `top` / `left` / `right` / `bottom`:
  - `constraints.vertical === 'TOP'` → `top: 0;`
  - `constraints.vertical === 'BOTTOM'` → `bottom: 0;`
  - `constraints.horizontal === 'LEFT'` → `left: 0;`
  - `constraints.horizontal === 'RIGHT'` → `right: 0;`

**反例扫描**:
- `.<className> { position: relative/static/absolute; ... }` 而不是 `fixed`
- 缺 `position` 属性
- 只在父容器上写 `position: relative`,自身没写 `fixed`

## 反例 (agent 常见错法)

```scss
/* ❌ 错法 */
.topbar {
  position: relative;
  width: 750px;
  height: 236px;
}

/* ❌ 错法 (缺 position) */
.topbar {
  width: 750px;
  height: 236px;
}
```

## 落地代码模板

```jsx
<div className={styles.topbar} data-node-id="211:32">
  {/* ... */}
</div>
```

```scss
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 750px;
  height: 236px;
  z-index: 100;  // 见 R14
}
```

## 违反后果

- **产物表现**: 页面滚动时该组件跟随滚动,不再"钉"在视口顶/底/左/右
- **典型事故**: v0.3.20 test1 事故 — `fixed-状态栏` 只写了 `position: relative`,滚动后状态栏消失

## 相关

- SKILL.md §4.3 切图四条硬规则
- rules/R14-fixed-z-index.md
