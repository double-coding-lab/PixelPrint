# R22 - empty-visual-btn(RN 改写,warning 级不阻断)

## 判定归属

- **硬防线**: warning 级(进 warnings,不 exit 1)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: baked/hidden/templateDup/无 styleKey 跳过(不可追溯交 R21)

## 触发条件

- **cache**: btn- 节点 bbox 面积 > 0、可追溯,但产物无任何可见视觉:
  - 子树无可见 TEXT(cache 侧)
  - 子树全部 styleKey 的规则体无 `backgroundColor` / `borderWidth` / `borderColor`
  - jsx 无图片家族标签(Image/ImageBackground/FastImage + tagMap.Image)挂子树任一 id
  - 所在文件无 `<LinearGradient`

## 期望产物

- btn- 应有可见视觉(文字/背景/边框/图片/渐变);纯透明热区在少数设计合法(叠在 bg- 整图上),故仅 warning,主 agent 必须在 QA 段复核

## 反例 (agent 常见错法)

```ts
// ❌ 按钮退化成透明热区(典型根因: cache 深度截断把内容丢了 / 该切图没切)
btnQiang: { width: rpx(120), height: rpx(44) },
```

## 违反后果

- **产物表现**: 按钮"隐形",可点但看不见——多数情况是内容在数据侧被截断丢失的下游症状

## 相关

- 门禁 GATE-cache-truncation(上游根因拦截)
- rules/R21-node-id-coverage.md
