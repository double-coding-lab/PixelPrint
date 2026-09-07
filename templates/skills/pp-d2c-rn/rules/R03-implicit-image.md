# R03 - implicit-image(RN 改写,极保守)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: R11 mask-vector-css-able 的常见形态被本条覆盖;任何前缀命中即不判

## 触发条件

- **cache**: 节点无任何内置前缀 + 子树纯几何/容器(GROUP/FRAME + VECTOR/BOOL/RECT/ELLIPSE/STAR/POLYGON/LINE)
- **且**: 无 TEXT/INSTANCE/COMPONENT 子层、无 btn-/input-/sub-/block- 子节点
- **且**: 子树含 **≥3 个真矢量路径**(VECTOR/BOOLEAN_OPERATION/STAR/REGULAR_POLYGON)——RN style 无法还原
- RECTANGLE/ELLIPSE/LINE 等可 style 化形状不计入"必切"信号

## 期望产物

- 该容器整体切图:assets.txt 有记录 + 产物 `<Image>` / require / uri 引用

## 反例 (agent 常见错法)

```tsx
// Figma: 无前缀装饰组合,子树 5 个 VECTOR 路径
// ❌ 逐个 VECTOR 用 View 描边近似(RN 无 SVG path 能力,视觉必然失真)
<View style={styles.deco1} /><View style={styles.deco2} />...
```

## 落地代码模板

```tsx
<Image source={require('./assets/deco-cluster.png')} style={styles.decoCluster} data-node-id="211:88" />
```

## 违反后果

- **产物表现**: 一堆矢量路径被 View 近似或直接丢失,装饰区域空白/失真

## 相关

- rules/R11-mask-vector-css-able.md(软防线,RN 可表达集更小)
- rules/R02-fills-image.md
