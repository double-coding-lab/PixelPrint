# R20 - absolute-position(RN 改写:camelCase 数值 + 删 inset 分支)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 排斥 fixed-(那走 R01/贴屏);只管非 fixed 的 `layoutPositioning: 'ABSOLUTE'`;无 styleKey 交 R21

## 触发条件

- **cache**: `layoutPositioning === 'ABSOLUTE'` 且 name 不以 `fixed-` 开头

## 期望产物

1. style **必须声明** `position: 'absolute'`(只对数值不对声明,`position: 'relative'` 也能混过——h5 v1.2.4 同款增强)
2. `top` ≈ (子 bbox.y − 父 bbox.y) × `unit.scale`,`left` ≈ (子 bbox.x − 父 bbox.x) × scale,容差 4(剥壳后同域)
3. RN 无 `inset` 简写,该分支不存在;`rpx(x)` 剥壳取 x 对账;动态值保守跳过

## 反例 (agent 常见错法)

```ts
// Figma: 子 bbox=(120, 340),父 bbox=(20, 300),scale=1 → top=40, left=100
// ❌ 坐标靠猜
badge: { position: 'absolute', top: rpx(30), left: rpx(90) },

// ❌ 缺 position 声明(数值全对也白搭,元素还在文档流里)
badge: { top: rpx(40), left: rpx(100) },
```

## 落地代码模板

```ts
badge: {
  position: 'absolute',
  top: rpx(40),     // (340-300)×1
  left: rpx(100),   // (120-20)×1
},
```

## 违反后果

- **产物表现**: 角标/徽章漂移或掉回文档流,把兄弟内容挤开

## 相关

- rules/R01-fixed-position.md(fixed- 归属)
- rules/RN02-flow-child-position.md(顺流子反面:禁写 top/left)
