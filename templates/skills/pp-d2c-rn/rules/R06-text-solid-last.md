# R06 - text-solid-last(RN 改写)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 末位可见 fill 是 GRADIENT/IMAGE → 归 R04;R10 不重复扫已判定的 color

## 触发条件

- **cache**: TEXT 节点,fills 数组非空,末位可见 fill 是 `SOLID`

## 期望产物

- style 含 `color: '#rrggbb'`,色值 = fills **末位可见** SOLID(多层 fills 取错层是本条主拦对象)
- 识别形态:`'#hex'` 字符串字面量(3/4/6/8 位均归一到 6 位比对)、`0xAARRGGBB` 数字色
- 动态色值(三元/变量)→ 保守跳过

## 反例 (agent 常见错法)

```ts
// Figma: fills = [{SOLID #999999, visible}, {SOLID #003366, visible}] → 末位 #003366
// ❌ 取了第一层
title: { color: '#999999' },

// ❌ 不写 color(RN Text 默认黑,与设计不符)
title: { fontSize: rpx(16) },
```

## 落地代码模板

```ts
title: {
  color: '#003366',   // fills 末位可见 SOLID
  fontSize: rpx(16),
},
```

## 违反后果

- **产物表现**: 字色取错层/丢失,大面积文字颜色偏差

## 相关

- rules/R04-text-gradient.md(GRADIENT/IMAGE 归属)
- rules/R10-no-fake-solid-color.md(幻觉色)
