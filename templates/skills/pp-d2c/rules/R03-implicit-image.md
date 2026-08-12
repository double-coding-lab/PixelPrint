# R03 - implicit-image

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌ (语义判断,脚本难)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - 节点有 `img-` / `bg-` / `bgc-` / `x-` / `input-` / `sub-` / `block-` / `btn-` / `fixed-` / `end-` / `scrollx-` / `scrolly-` 前缀 → 不适用
  - 子树中有 TEXT / INSTANCE / COMPONENT 节点 → 不适用 (需交互或文字,不该切)
  - 子树中有以 btn- / input- / sub- / block- 命名的子节点 → 不适用

## 触发条件

**同时满足**:
1. `node.name` **无**上述任何前缀
2. 整棵子树的节点 `type` 全在 `['VECTOR', 'BOOLEAN_OPERATION', 'RECTANGLE', 'ELLIPSE', 'STAR', 'REGULAR_POLYGON', 'LINE']`
3. 子树中**无** `TEXT` / `INSTANCE` / `COMPONENT` 类型
4. 子树中**无** `btn-` / `input-` / `sub-` / `block-` 前缀命名的子节点

## 期望产物

**assets.txt 端**:
- 必须为该节点整体切一张图,记录 `nodeId → filename`

**JSX 端**:
- `<img className={styles.foo} src="${ASSET_PREFIX}foo.png" data-node-id="{id}" alt="" />`

**SCSS 端**:
- 只写尺寸和定位,**不要**展开成一堆 vector 元素

**反例扫描**:
- agent 不切图,展开成 20+ 个 `<div>` + `<svg>` + CSS 渐变叠加
- SCSS 里出现大量 `.icon-part-1 { ... } .icon-part-2 { ... }` 类的重复子元素规则

## 反例 (agent 常见错法)

```jsx
{/* ❌ 错法: 该整体切图但没识别,展开成 vector CSS 堆 */}
<div className={styles.iconWrap} data-node-id="123:45">
  <div className={styles.iconLayer1} />
  <div className={styles.iconLayer2} />
  <svg><path d="M..." /></svg>
  <div className={styles.iconLayer3} />
</div>
```

## 落地代码模板

```jsx
<img className={styles.iconWrap}
     src={`${ASSET_PREFIX}icon-wrap.png`}
     data-node-id="123:45"
     alt="" />
```

```scss
.iconWrap {
  width: 120px;
  height: 120px;
}
```

## 违反后果

- **产物表现**: 该切图没切,变成一堆 vector/CSS 堆叠,几何形状不对、无法还原设计
- **典型事故**:
  - v0.3.20 test2 事故 — `renwuInviteIcon` (装饰性 icon)没切,agent 用 4 层 div 叠 shadow 模拟

## Rule-Scan 识别提示

- 看 cache 里 `node.children` 递归,统计子树的 `type` 分布
- 只要出现 `TEXT` 就绝对不是 R03
- 只要出现 `btn-` / `input-` / `sub-` / `block-` 前缀的子节点(说明是复合结构,不是纯装饰)也不是 R03
- 常见误判:装饰性圆点、装饰花纹被误识别为需要展开的元素

## 相关

- SKILL.md §4.3 切图四条硬规则 (R3 隐式切图)
- rules/R11-mask-vector-css-able.md (相似判断,更严格)
