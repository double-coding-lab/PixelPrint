# R23 - size-fidelity(RN 改写:覆盖面 ≥ h5)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无 styleKey 交 R21;动态值 unparseable 保守跳过

## 触发条件

- **产物**: 应渲染节点的 style 声明了显式数值 `width`/`height`(纯数字或 rpx 包装)

## 期望产物

- `width`/`height`(rpx 剥壳后)≈ `absoluteBoundingBox` × `unit.scale`,容差 4
- **锚点欺诈点名**(test28 形态):`width: 1, height: 1` + `overflow: 'hidden'` 且真实尺寸 > 8 → 直接 violation——为混过 R21 的 id 覆盖检查而把真实元素缩成隐藏点
- **RN 恒为 border-box**:h5 的 `hasPadding && !hasBorderBox` 跳过分支不存在,含 padding 节点照判,覆盖面比 h5 更大

## 反例 (agent 常见错法)

```ts
// Figma bbox = 331.5 × 141,scale=1
// ❌ 锚点欺诈(挂着 id 的 1×1 隐藏点应付 R21,真实 UI 用别的无 id 元素渲染)
cardAnchor: { width: 1, height: 1, overflow: 'hidden' },

// ❌ 尺寸漂移(超容差)
card: { width: rpx(320), height: rpx(130) },
```

## 落地代码模板

```ts
card: { width: rpx(331.5), height: rpx(141) },
```

## 违反后果

- **产物表现**: 元素尺寸失真;锚点欺诈则是整套对账被"应付检查"架空

## 相关

- rules/R21-node-id-coverage.md(欺诈动机来源)
- rules/R13-unit-scale.md(rpx 口径)

## 证据边界

尺寸检查通过不证明节点实际可见；禁止隐藏/透明锚点、删除 node-id 或改成不可解析样式冒充还原。真实布局需要动态尺寸时保留依据与视觉检查，不能把静态检查跳过说成已验证。
