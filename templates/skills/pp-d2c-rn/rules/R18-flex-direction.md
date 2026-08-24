# R18 - flex-direction(RN 语义变更:判定与 h5 镜像)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 与 R19 成对(autolayout 容器忠实度);无 styleKey 交 R21;动态方向值保守跳过

## 触发条件

- **cache**: autolayout 容器(`layoutMode === 'HORIZONTAL' | 'VERTICAL'`)
- **前置**: 该节点有 style 绑定(RN 全员 flex,无 `display: flex` 门槛——与 h5 的差异点)

## 期望产物(与 h5 镜像——RN flex 默认 column,web 默认 row)

| Figma layoutMode | RN 合法写法 | 违规 |
|---|---|---|
| `VERTICAL` | `flexDirection` **省略** 或 `'column'` | 写 `'row'`/`'row-reverse'` |
| `HORIZONTAL` | **必须显式** `flexDirection: 'row'`(或 `'row-reverse'`) | 缺失(默认 column 会把横排竖排)或写 `'column'` |

直接复制 h5 判定逻辑会全量误判——h5 拦"VERTICAL 漏写 column",RN 拦"HORIZONTAL 漏写 row",方向相反。

## 反例 (agent 常见错法)

```ts
// Figma: layoutMode=HORIZONTAL(三个标签横排)
// ❌ web 习惯:不写方向(RN 默认 column,标签竖着排下来)
tagRow: { alignItems: 'center' },

// Figma: layoutMode=VERTICAL
// ❌ 方向写反
list: { flexDirection: 'row' },
```

## 落地代码模板

```ts
tagRow: {
  flexDirection: 'row',   // HORIZONTAL 必须显式
  alignItems: 'center',
  gap: rpx(8),
},
list: {
  // VERTICAL:flexDirection 省略即 column
  gap: rpx(12),
},
```

## 违反后果

- **产物表现**: 横排内容竖排(或反之),整块布局崩坏——RN 侧最高频的方向事故

## 相关

- rules/R19-padding.md(成对)
- rules/RN02-flow-child-position.md(顺流子位置由父 flex 负责)
