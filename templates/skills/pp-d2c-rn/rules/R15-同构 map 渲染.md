# R15 - 同构 map 渲染(RN 文档改写,软防线)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: 同层 <3 个同构节点 → 不强制 map;各节点交互/结构差异明显 → 保留独立元素

## 触发条件

- **cache**: 同一父节点下 **≥3 个**结构同构的子节点(相同 type、相同 children 结构签名、相同 name 前缀如 `item-1/2/3`)
- **命中信号**: agent 展开成 3+ 份重复 JSX + styles key

## 期望产物

```tsx
const CARDS = [
  { title: '预约票', desc: '开售自动抢' },
  { title: '优惠券', desc: '限时领取' },
  { title: '会员权益', desc: '专享特惠' },
];

<View style={styles.cardList}>
  {CARDS.map((card, i) => (
    <View key={i} style={styles.card} data-node-id="211:90">
      {/* data-node-id 挂代表项(variant a)的 id,副本由 _templateDup 豁免对账 */}
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardDesc}>{card.desc}</Text>
    </View>
  ))}
</View>
```

```ts
cardList: { gap: rpx(20) },          // RN 0.71+;低版本改 marginBottom
card: { padding: rpx(30), backgroundColor: '#FFFFFF', borderRadius: rpx(16) },
cardTitle: { fontSize: rpx(32), fontWeight: '500' },
cardDesc: { fontSize: rpx(24), color: '#666666' },
```

- styles 只写一份 key;个别差异用数组形态 `style={[styles.card, i === 0 && styles.cardFirst]}`

## 反例 (agent 常见错法)

- 展开 item1/item2/item3 三份重复 JSX + `item1Title`/`item2Title`/... 重复 key(还会触发 R12 隐患)

## 违反后果

- **产物表现**: 代码冗长 3 倍以上;加/删一项多处改;styles key 膨胀

## Rule-Scan 识别提示

- 找同层 ≥3 个子节点,判"同构":type 相同 + 子结构签名相同(如 `[TEXT, TEXT, VECTOR]`)+ 名字前缀相同(可选)
- 输出 context 列同构节点 nodeId 列表 + 每项可提取内容差异(title/imageUrl 等)

## 相关

- rules/R12-flat-mode-naming.md
- rules/R21-node-id-coverage.md(模板项挂代表项 id)
