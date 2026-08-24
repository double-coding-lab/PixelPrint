# R05 - space-between(RN 改写)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无

## 触发条件

- **cache**: `node.primaryAxisAlignItems === 'SPACE_BETWEEN'`(Figma AutoLayout)

## 期望产物

- style 含 `justifyContent: 'space-between'`
- **RN 特别提醒**:`margin*: 'auto'` 撑开在 RN 无效(Yoga 不支持 auto margin 分配剩余空间),出现即 warning

## 反例 (agent 常见错法)

```ts
// ❌ 漏写(两端对齐退化为起点堆叠)
row: { flexDirection: 'row' },

// ❌ margin auto 模拟(web 习惯带过来,RN 无效)
rowLast: { marginLeft: 'auto' },
```

## 落地代码模板

```ts
row: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
```

## 违反后果

- **产物表现**: 两端对齐元素挤在起点,间距全丢

## 相关

- rules/R18-flex-direction.md(方向镜像)
- rules/RN02-flow-child-position.md(顺流子禁 margin)
