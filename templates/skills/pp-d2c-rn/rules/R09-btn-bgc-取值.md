# R09 - btn-bgc-取值(RN 语义变更:二选一合法)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: bgc 末位 SOLID → 按 backgroundColor 取,不算 R09;bgc IMAGE → 归 R02

## 触发条件

- **cache**: `btn-` 节点子树含 `bgc-` 子层,且 bgc- 末位可见 fill 是 `GRADIENT_*`

## 期望产物(二选一)

RN 没有 CSS gradient,渐变按钮两条合法路径:

1. **真渐变**:产物引用 `LinearGradient` 组件(`react-native-linear-gradient` 或项目等价库)——import 存在且 jsx 出现 `<LinearGradient`
2. **退化路径**:btn/bgc 任一 styleKey 落**首 stop 纯色** `backgroundColor`(归一化 rgba 比对,RGB 三通道容差 1/255),且 `assets.txt` 有 btn 或 bgc nodeId 的 `[退化告警]` 行

两者皆无 → violation;写了首 stop 之外的臆造纯色 → violation;退化了但没留痕 → violation。

## 反例 (agent 常见错法)

```ts
// Figma: btn-submit > bgc-grad, fills 末位 GRADIENT_LINEAR stops=[#FF8800 → #FF3300]
// ❌ 臆造中间色,无 LinearGradient 也无告警行
btnSubmit: { backgroundColor: '#FF5500' },

// ❌ 完全丢视觉(渐变按钮变透明)
btnSubmit: { borderRadius: rpx(22) },
```

## 落地代码模板

```ts
// 退化路径
btnSubmit: {
  backgroundColor: '#FF8800',   // GRADIENT_LINEAR 首 stop;真渐变接 LinearGradient
  borderRadius: rpx(22),
},
```

```
# assets.txt 追加
[退化告警] 211:72 btn-submit/bgc-grad: GRADIENT_LINEAR 退化为首 stop #FF8800
```

## 违反后果

- **产物表现**: 渐变按钮变纯色/透明且无告警,视觉降级静默逃逸

## 相关

- rules/R04-text-gradient.md(同为渐变退化留痕机制)
- rules/R07-multi-fills.md
- SKILL.md §4.3.rn RN 特性退化表
