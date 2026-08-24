# R14 - fixed-z-index(RN 改写)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 单个 fixed- → 不判(无层级冲突);与 R01 是"父规则-补充规则"关系

## 触发条件

- **cache**: ≥2 个 `fixed-` 前缀节点(可追溯、非 baked/hidden)

## 期望产物

- 各 fixed- 元素的 `zIndex` 存在且不全相同(层级可区分)
- 保守口径:只报「全部缺 zIndex」或「全部 zIndex 相同」;不强求具体递增序;动态值不计入统计

## 反例 (agent 常见错法)

```ts
// ❌ 全缺(层叠顺序交给 JSX 顺序,重构一挪就乱)
fixedNavbar: { position: 'absolute', top: 0 },
fixedBtn: { position: 'absolute', bottom: 0 },

// ❌ 全同(无法区分谁在上)
fixedNavbar: { position: 'absolute', top: 0, zIndex: 100 },
fixedBtn: { position: 'absolute', bottom: 0, zIndex: 100 },
```

## 落地代码模板

```ts
fixedNavbar: { position: 'absolute', top: 0, zIndex: 100 },
fixedBtn: { position: 'absolute', bottom: 0, zIndex: 101 },
```

## 违反后果

- **产物表现**: 多个贴屏元素交叠时层级不可控(RN zIndex 仅同父内生效,更需显式声明)

## 相关

- rules/R01-fixed-position.md
