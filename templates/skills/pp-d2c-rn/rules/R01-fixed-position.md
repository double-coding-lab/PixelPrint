# R01 - fixed-position(RN 语义变更)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 与 R14 fixed-z-index 是"父规则-补充规则"关系,不排斥;骨架本体判定归 RN01

## 触发条件

- **cache**: `node.name.startsWith('fixed-')`
- **命中信号**: 图层名以 `fixed-` 开头(如 `fixed-状态栏`、`fixed-topbar`、`fixed-底部bar`)

## 期望产物(fixed-* 铁律,SKILL §4.1.1)

RN 没有 CSS `position: fixed`;`<ScrollView>` 内部的 absolute 元素相对内容容器定位,滚动时跟着动。"贴屏"只有一条路:放根 `<View>` 直接子层。三项同时满足:

1. style 含 `position: 'absolute'`
2. style 含 `zIndex` 且 ≥ 100(高于 ScrollView 内容)
3. 该元素的 data-node-id **不出现在任何 ScrollView 开闭区间内**(adapter 启用时 tagMap.ScrollView 映射值同判)

位置按 Figma constraints 换算三档:

| constraints.vertical | 写法 |
|---|---|
| `TOP`(默认) | `top: rpx(<Figma y - 顶层frame y>)` |
| `BOTTOM` | `bottom: rpx(<顶层frame 底 - 节点底>)`(常见 `bottom: 0`) |
| `CENTER` | `top: '50%'` + `transform: [{ translateY: -h/2 }]` |

## 反例 (agent 常见错法)

```ts
// ❌ 错法 1: 写在 ScrollView 内(滚动时跟内容动,贴屏语义失效)
// <ScrollView><Image style={styles.fixedNavbar} data-node-id="211:32" /></ScrollView>

// ❌ 错法 2: 缺 position
fixedNavbar: { top: 0, width: rpx(375), height: rpx(88) },

// ❌ 错法 3: 缺 zIndex(被 ScrollView 内容盖住)
fixedNavbar: { position: 'absolute', top: 0 },
```

## 落地代码模板

```tsx
// fixed-* 放根 View 直接子层(ScrollView 外)
<View style={styles.root}>
  <ScrollView style={styles.scroll}>{/* 顺流内容 */}</ScrollView>
  <Image source={require('./assets/fixed-navbar.png')} style={styles.fixedNavbar} data-node-id="211:32" />
</View>
```

```ts
fixedNavbar: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: rpx(375),
  height: rpx(88),
  zIndex: 100,  // 见 R14
},
```

## 违反后果

- **产物表现**: 滚动时"贴屏"元素跟随内容滚走,导航栏/底部按钮消失
- **判不了降级**: ScrollView 开闭数不平衡(文本区间法失效)时,区间判定降 warning,人工复核

## 相关

- SKILL.md §4.1.1 rn 页面根强制骨架 + fixed-* 分层
- rules/RN01-scroll-skeleton.md(骨架本体)
- rules/R14-fixed-z-index.md
