# R19 - padding(RN 改写:camelCase + rpx 剥壳对账)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 与 R18 成对;凭空捏造分支与 RN02 分工(RN02 判顺流子 cache 无却写了;本条判数值精度);无 styleKey 交 R21

## 触发条件

- **cache**: autolayout 容器声明了 padding(paddingTop/Right/Bottom/Left 任一非 0),或产物写了 padding

## 期望产物

- `paddingTop/Right/Bottom/Left` ≈ Figma 同名字段 × `unit.scale`,容差 2(剥壳后同域数值)
- 合成口径(RN 语义):具体边 > 轴简写(`paddingHorizontal`/`paddingVertical`)> 全简写(`padding`),后声明覆盖先声明
- `rpx(x)` 剥壳取 x 参与对账;任一 padding 属性动态值(Platform.select/三元)→ 整节点保守跳过

## 反例 (agent 常见错法)

```ts
// Figma: paddingTop=16, paddingLeft=20, scale=1
// ❌ 凭空捏造(Figma 没有 paddingBottom)
card: { paddingTop: rpx(16), paddingLeft: rpx(20), paddingBottom: rpx(12) },

// ❌ 数值错(16 写成 20)
card: { paddingTop: rpx(20), paddingLeft: rpx(20) },

// ❌ 漏写(内容顶到边)
card: {},
```

## 落地代码模板

```ts
card: {
  paddingTop: rpx(16),
  paddingLeft: rpx(20),
  paddingRight: rpx(20),   // Figma paddingRight=20
},
```

## 违反后果

- **产物表现**: 间距凭空出现/丢失/数值漂移,逐块累积成整页错位

## 相关

- rules/R18-flex-direction.md(成对)
- rules/R13-unit-scale.md(rpx 包装方式)
- rules/RN02-flow-child-position.md(顺流子凭空 padding)
