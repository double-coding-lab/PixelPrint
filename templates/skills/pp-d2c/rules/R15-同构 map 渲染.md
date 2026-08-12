# R15 - 同构 map 渲染

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - 同层 <3 个同构节点 → 不强制 map
  - 每个节点有明显不同的交互 / 命名 / 结构差异 → 保留独立元素

## 触发条件

- **cache**: 同一父节点下有 **≥3 个** 结构同构的子节点
- **同构判定**:
  - 相同 `type`
  - 相同 `children` 结构(层级 + 类型分布相同)
  - 相同 `name` 前缀(如 `item-1`, `item-2`, `item-3` 或 `card_1`, `card_2`)
- **命中信号**: agent 展开成 3+ 份重复 JSX + SCSS

## 期望产物

**JSX 端** (强制):
```jsx
{[
  { title: '...', desc: '...' },
  { title: '...', desc: '...' },
  { title: '...', desc: '...' },
].map((item, i) => (
  <div key={i} className={styles.card}>
    <div className={styles.cardTitle}>{item.title}</div>
    <div className={styles.cardDesc}>{item.desc}</div>
  </div>
))}
```

**SCSS 端** (强制):
- 同构节点**只写一份** `.card { ... }` 规则
- 通过 `:nth-child(n)` 处理个别差异(通常无差异,不需要)

## 反例 (agent 常见错法)

```jsx
{/* Figma: 同层 3 个 item-* 节点 */}

{/* ❌ 错法: 展开 3 份重复 JSX */}
<div className={styles.item1}>
  <div className={styles.item1Title}>标题 1</div>
  <div className={styles.item1Desc}>描述 1</div>
</div>
<div className={styles.item2}>
  <div className={styles.item2Title}>标题 2</div>
  <div className={styles.item2Desc}>描述 2</div>
</div>
<div className={styles.item3}>
  <div className={styles.item3Title}>标题 3</div>
  <div className={styles.item3Desc}>描述 3</div>
</div>
```

```scss
/* ❌ 错法: 展开 3 份重复 SCSS */
.item1 { ... }
.item1Title { ... }
.item2 { ... }
.item2Title { ... }
.item3 { ... }
.item3Title { ... }
```

## 落地代码模板

```jsx
const CARDS = [
  { title: '预约票', desc: '开售自动抢' },
  { title: '优惠券', desc: '限时领取' },
  { title: '会员权益', desc: '专享特惠' },
];

<div className={styles.cardList}>
  {CARDS.map((card, i) => (
    <div key={i} className={styles.card}>
      <div className={styles.cardTitle}>{card.title}</div>
      <div className={styles.cardDesc}>{card.desc}</div>
    </div>
  ))}
</div>
```

```scss
.cardList {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card {
  padding: 30px;
  background: #FFFFFF;
  border-radius: 16px;
}
.cardTitle { font-size: 32px; font-weight: bold; }
.cardDesc  { font-size: 24px; color: #666; }
```

## 违反后果

- **产物表现**:
  - 代码冗长 3 倍以上,可维护性差
  - 后续加/删一项需要多处改
  - SCSS 类名膨胀,增大产物体积
- **典型事故**:
  - v0.3.14 test8 事故 — 6 个卡片各 15 行 JSX + 30 行 SCSS,合计 270 行,合并成 map 后仅 40 行

## Rule-Scan 识别提示

- 找同层 ≥3 个子节点
- 判断"同构":
  1. `type` 相同
  2. 子结构签名相同(如 `[TEXT, TEXT, VECTOR]`)
  3. 名字前缀相同(可选)
- 输出 context 里列出:
  - 同构节点 nodeId 列表
  - 每个节点的可提取内容差异(如 title / imageUrl)

## 相关

- rules/R12-flat-mode-naming.md
