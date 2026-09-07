# RN01 - scroll-skeleton(RN 特有:页面根强制骨架)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅(--merge 正向 / --block 反向;骨架 key 缺失时细则降 warning)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: fixed- 不入 ScrollView 的逐节点区间判定归 R01,本条只管骨架本体

## 触发条件与校验

**--merge(页面级)**:

1. 页面 jsx 必须出现滚动容器标签(`ScrollView` + tagMap.ScrollView)——rn 分支**不判视口**,所有页面一律套骨架:`View(root) > ScrollView > View(scrollContent)`
2. styles 的 `scrollContent`:必须用 `minHeight`,写死 `height` 即违规(内容超高被裁,用户看不到底部——v1.0.3 事故形态:1579px 长图 + 死高 View,RN 的 View 天然不滚)
3. `root` / `scrollContent` 规则体禁 `overflow: 'hidden'`(阻止滚动)

**--block(反向)**:

- block 产物**不得**套页面骨架——同时存在滚动容器标签与 `scrollContent` key 即违规(骨架只属于页面根,由主 agent 合并时套);`scrollx-`/`scrolly-` 的普通 ScrollView 不受影响(其 styleKey 不叫 scrollContent)

## 期望产物(SKILL §4.1.1 固定骨架)

```tsx
<View style={styles.root}>              {/* flex:1 + position:'relative',承接 fixed-* */}
  <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.scrollContent}>  {/* width + minHeight + paddingTop */}
      {/* bg-body Image + 顶层 frame 顺流子 + bottomPadding */}
    </View>
  </ScrollView>
  {/* fixed-* 放这里,根 View 直接子层 */}
</View>
```

```ts
root: { flex: 1, position: 'relative' },
scroll: { flex: 1 },
scrollContent: {
  width: rpx(375),
  minHeight: rpx(1579),   // 不用 height:内容不足时至少这么高,超出自动增高
},
```

## 反例 (四种硬错)

```ts
// ❌ 1: 根 View 直接装内容不套 ScrollView(内容被裁,不滚)
// ❌ 2: scrollContent 写死 height: rpx(1579)
// ❌ 3: root 或 scrollContent 写 overflow: 'hidden'
// ❌ 4: block 产物套了骨架(scrollContent key + ScrollView 同现)
```

## 违反后果

- **产物表现**: 长页面底部内容永远不可见;或 block 合并后双层 ScrollView 滚动冲突

## 相关

- SKILL.md §4.1.1 rn 页面根强制骨架 + fixed-* 分层
- rules/R01-fixed-position.md(fixed- 区间判定)
- rules/RN03-no-percent-fill.md(骨架内 bg- 铺满层)
