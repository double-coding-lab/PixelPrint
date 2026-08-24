# R04 - text-gradient(RN 语义变更:校验目标 = 退化正确性)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 末位可见 fill 是 SOLID → 归 R06;baked/hidden/templateDup 跳过;无 styleKey 交 R21

## 触发条件

- **cache**: TEXT 节点,fills 非空,末位可见 fill 是 `GRADIENT_*` 或 `IMAGE`

## 期望产物(RN 特性退化表)

RN 没有 `background-clip: text`,渐变/图案字按退化表处理,校验目标从"必须走 clip"变为"退化必须正确且留痕":

1. **色值正确**:产物 `color` 等于**渐变首 stop 色值**(归一化 rgba 元组比对,RGB 三通道各容差 1/255);末位是 IMAGE(图案字)无首 stop,不比色值
2. **退化留痕**:`assets.txt` 必须有该 nodeId 的 `[退化告警]` 行,例:
   ```
   [退化告警] 211:56 渐变标题: GRADIENT_LINEAR 退化为首 stop #FF6600(RN 无 background-clip:text,如需真渐变字接 react-native-linear-gradient + MaskedView)
   ```

产物写了首 stop 之外的臆造纯色 → violation;缺告警行 → violation。

## 反例 (agent 常见错法)

```ts
// Figma: TEXT fills 末位 GRADIENT_LINEAR stops = [#FF6600 → #FF0000]
// ❌ 臆造中间色冒充渐变(既不是首 stop 也没留痕)
title: { color: '#FF3300' },

// ❌ 退化了但 assets.txt 无 [退化告警] 行(静默降级,QA 不可复核)
title: { color: '#FF6600' },
```

## 落地代码模板

```ts
// styles.ts —— 退化为首 stop
title: {
  color: '#FF6600',   // GRADIENT_LINEAR 首 stop;真渐变字需接三方库,见 assets.txt 退化告警
  fontSize: rpx(24),
},
```

```
# assets.txt 追加
[退化告警] 211:56 渐变标题: GRADIENT_LINEAR 退化为首 stop #FF6600
```

## 违反后果

- **产物表现**: 渐变字变成随机纯色且无告警,视觉偏差静默逃逸

## 相关

- SKILL.md §4.3.rn RN 特性退化表
- rules/R06-text-solid-last.md(SOLID 归属)
- rules/R09-btn-bgc-取值.md(同为渐变退化留痕机制)
