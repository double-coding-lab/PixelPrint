# R02 - fills-image(RN 改写)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: `x-` 前缀忽略;`_inBakedSubtree`/`_hidden`/`_templateDup` 跳过(禁 DOM 交 R17);btn- 内 fills IMAGE 走 R09 优先

## 触发条件

- **cache**: `node.fills[].some(f => f.type === 'IMAGE' && f.visible !== false)`

## 期望产物

- `assets.txt` 中有该 nodeId 的切图记录(fileName)
- 产物引用该切图,RN 合法引用形态:
  - `<Image source={require('./assets/xxx.png')} data-node-id="..." />`
  - `source={{ uri: `${ASSET_PREFIX}xxx.png` }}`
  - `<ImageBackground source={...}>` / `<FastImage source={...}>`
- 判定口径:nodeId(或其 `:` → `-` 归一形)出现在 jsx/styles,或该节点 styleKey 规则体含 `require(` / `uri:`

## 反例 (agent 常见错法)

```ts
// Figma fills = [{IMAGE, imageRef: xxx}]
// ❌ 凭空搓渐变/纯色代替切图
card: { backgroundColor: '#FFE9C8' },

// ❌ assets.txt 记了切图,产物却没引用(图被偷换成空 View)
```

## 落地代码模板

```tsx
<Image
  source={require('./assets/card-bg.png')}
  style={styles.cardBg}
  data-node-id="211:45"
/>
```

## 违反后果

- **产物表现**: 图片内容缺失,或被"看起来差不多"的纯色/渐变冒充
- **对账关系**: 切图台账(images.json md5)与消费契约(F₁⊆F₂)的绑定起点

## 相关

- SKILL.md §4.4.0 切图复用契约
- rules/R17-no-baked-dom.md(baked 子孙禁 DOM)
- rules/R09-btn-bgc-取值.md
