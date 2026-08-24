# R08 - bg-landing-form(RN 语义变更:bg- = 独立 Image 层契约)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: '100%'/absoluteFillObject 塌陷写法归 RN03,本条不双报;祖先也是 bg-/img-(baked)跳过

## 触发条件

- **cache**: `node.name.startsWith('bg-')` 或 `name === 'bg'`

## 期望产物

RN 没有 `background-image`,bg- 的落地形态是**独立 `<Image>` 挂父容器内头部**:

1. 该 nodeId 落在图片家族标签上(`Image`/`ImageBackground`/`FastImage` + adapter tagMap.Image 映射值)
2. style 含 `position: 'absolute'`(+ `top: 0, left: 0`)
3. `width`/`height` 为**数值(rpx)固定尺寸**——Figma 事实尺寸,数值精度由 R23 对账
4. bg- 子孙不生成组件(像素已烤进 PNG,禁 DOM 交 R17)

## 反例 (agent 常见错法)

```tsx
// ❌ 错法 1: bg- 被写成空 View,背景整体丢失
<View style={styles.bgBody} data-node-id="211:20" />

// ❌ 错法 2: 铺满层用 %(父 minHeight 时塌陷,详见 RN03)
bgBody: { width: '100%', height: '100%' },

// ❌ 错法 3: 缺 absolute(把兄弟内容挤下去)
bgBody: { width: rpx(375), height: rpx(1579) },
```

## 落地代码模板

```tsx
<View style={styles.scrollContent}>
  <Image
    source={require('./assets/bg-body.png')}
    style={styles.bgBody}
    data-node-id="211:20"
  />
  {/* 顶层 frame 顺流子... */}
</View>
```

```ts
bgBody: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: rpx(375),
  height: rpx(1579),   // Figma 事实值,不用 '100%'
},
```

## 违反后果

- **产物表现**: 页面/卡片背景丢失或塌陷,内容浮在空白上

## 相关

- SKILL.md §4.1.1 bg- 铺满层用 Figma 事实尺寸
- rules/RN03-no-percent-fill.md(塌陷写法专责)
- rules/R17-no-baked-dom.md(bg- 子孙禁 DOM)
