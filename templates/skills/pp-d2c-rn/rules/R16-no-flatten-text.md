# R16 - no-flatten-text(RN 改写:标签集换图片家族 + adapter 感知)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: img-/bg- 前缀(含裸词)白名单免疫——它们天然就是切图载体;与 R17 配套(压平 vs 拆两面)

## 触发条件

- **cache**: GROUP/FRAME/COMPONENT/INSTANCE 子树含 TEXT,且节点 name 前缀不在 img-/bg- 白名单
- **反查**: 产物 jsx 出现「图片家族标签 + data-node-id=<该节点>」——标签集 = `Image`/`ImageBackground`/`FastImage` + `config.adapter.tagMap.Image` 映射值

## 期望产物

- 禁止对含 TEXT 的容器整体切图;必须按前缀规则拆解:TEXT 出 `<Text>`、btn- 出 `<Pressable>`、img-/bg- 各归其位
- RN 侧危害更重:整体导出的图放进 `<Image>` 无法承载动态数据,业务侧完全无救(文案/价格/倒计时全部焊死)

## 反例 (agent 常见错法)

```tsx
// Figma: FRAME "card-price"(无 img-/bg- 前缀)内含 TEXT "¥299"
// ❌ 整卡切图,价格焊死在 PNG 里
<Image source={require('./assets/card-price.png')} data-node-id="211:66" />
```

## 落地代码模板

```tsx
<View style={styles.cardPrice} data-node-id="211:66">
  <Text style={styles.cardPriceValue} data-node-id="211:67">¥299</Text>
</View>
```

## 违反后果

- **产物表现**: 文字不可改、不可本地化、无障碍缺失、按钮不可点、动态数据无处挂

## 相关

- SKILL.md §4.3「含 TEXT 容器 压平 vs 拆」唯一裁决树
- rules/R17-no-baked-dom.md(白名单内的另一面:烤进 PNG 后禁 DOM)
