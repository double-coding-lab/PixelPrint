# R10 - no-fake-solid-color(RN 文档改写,软防线)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌ (需交叉核对 cache 与产物)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: R06 已判定的 TEXT color、R07/R09 已判定的背景色不重复扫

## 触发条件

- **产物**: styles.ts 中出现 `color: '#XXX'` / `backgroundColor: '#XXX'` 等 SOLID 色
- **cache 侧**: 该 styleKey 对应 nodeId 的所有 fills 中找不到匹配的 SOLID 色 → agent 幻觉搓色

## 期望产物

**核心原则**:产物里出现的每一个色值都必须在 cache 里能找到 fills 源头。

**判定算法**:
1. Read 产物全部 styles 文件,提取所有 `'#RRGGBB'` / `'rgba(...)'`
2. 反查:该 styleKey 挂在哪个 nodeId 下(经 jsx 的 data-node-id ↔ style 绑定)
3. Read 该 nodeId 的 cache,遍历 fills:
   - 有匹配 SOLID.color → OK
   - 全部 GRADIENT/IMAGE → 走 R04/R07/R09,不属 R10
   - 找不到匹配 → **R10 命中(幻觉色)**

## 反例 (agent 常见错法)

```ts
// Figma nodeId=211:32 fills = [](无填充,靠父容器)
topbar: { backgroundColor: '#F5F5F5' },  // ❌ cache 里找不到 #F5F5F5

// Figma nodeId=211:411 fills = [{SOLID #003366}]
title: { color: '#0066CC' },  // ❌ #0066CC ≠ #003366
```

## Rule-Scan 识别提示

- 只对产物已 Read 后判定,靠"反向核对"
- cache fills=[] 但产物有色 → 强命中;fills 全 IMAGE/GRADIENT 但产物有 SOLID 色 → 强命中
- **豁免**: `'transparent'`、渐变退化产物已带 `[退化告警]` 行的首 stop 色(R04/R09 管辖)

## 违反后果

- **产物表现**: 颜色与设计稿不符,agent "猜"一个相近色

## 相关

- rules/R06-text-solid-last.md
- rules/R07-multi-fills.md
- rules/R09-btn-bgc-取值.md
