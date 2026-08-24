# RN02 - flow-child-position(RN 特有:顺流子位置来源硬约束)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 子 `layoutPositioning === 'ABSOLUTE'` → 归 R20;fixed- 前缀子 → 归 R01;bg- 前缀子(含裸词 bg)→ 归 R08/RN03(铺满层契约本身要求 absolute);子自身是 autolayout 容器时 padding 分支让位 R19(R19 对 autolayout 容器做含凭空分支的全量对账);显式 0 / rpx(0) 的 margin/offset 不改变布局,保守放行(position 无数值形态,恒报);无 styleKey 交 R21

## 触发条件

- **cache**: 父 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 且子 `layoutPositioning !== 'ABSOLUTE'`(顺流子)

## 校验(位置由父 flex 5 字段负责:flexDirection/justifyContent/alignItems/gap/padding)

1. 子 style **禁**出现 `position` / `top` / `left` / `right` / `bottom` / `margin*`(含 Horizontal/Vertical)——用 `absoluteBoundingBox` 逆推 margin/absolute 会绕过父 flex 语义
2. 子 style 的 `padding*` 非 0 值必须溯源到该子节点 cache 同名字段(`padding`/`paddingHorizontal`/`paddingVertical` 简写按展开边溯源)
3. 子 style 的 `flex: 1` 仅当 cache `layoutGrow === 1` 或 `layoutSizingHorizontal/Vertical === 'FILL'`(FIXED sizing 的子尺寸写事实值)

## 反例(v0.3.13 真实事故形态)

```ts
// Figma: 父 FRAME VERTICAL / primaryAxisAlignItems=CENTER / itemSpacing=N
// 三个顺流子被 agent 用 absoluteBoundingBox 逆推:
// ❌ 分别写 marginTop:<y1> / marginTop:<y2> / position:'absolute', top:<y3>
//    → 绕过父 flex 语义,视觉整体下移
item1: { marginTop: rpx(120) },
item2: { marginTop: rpx(184) },
item3: { position: 'absolute', top: rpx(248) },

// ❌ 同批命中: paddingLeft 凭空捏造(cache 无该字段)、flex:1 违反 FIXED sizing
item4: { paddingLeft: rpx(12), flex: 1 },
```

## 落地代码模板

```ts
// 位置全部由父承担
parent: {
  // VERTICAL: flexDirection 省略
  justifyContent: 'center',
  gap: rpx(16),          // itemSpacing
},
item1: { width: rpx(200), height: rpx(48) },   // 子只写自身尺寸与视觉
```

## 违反后果

- **产物表现**: 顺流内容整体漂移/重叠;改一处父布局,所有逆推值全部失效

## 相关

- SKILL.md §4.3 顺流子位置来源硬约束(v0.3.13)
- rules/R18-flex-direction.md / R19-padding.md / R20-absolute-position.md
