# R17 - no-baked-dom(RN 侧逐字节复用 h5 判定)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅(脚本与 h5 母本逐字节一致,纯 data-node-id 判定,零样式耦合)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 与 R16 配套(压平 vs 拆两面);R02/R06 跳过 `_inBakedSubtree` 节点,禁 DOM 由本条正向兜底

## 触发条件

- **cache**: 节点 `_inBakedSubtree`(祖先是 `bg-`/`img-`/`x-`,像素已烤进父层 PNG 或被忽略)
- **反查**: 产物出现其 `data-node-id` → 双重渲染

## 期望产物

- baked 子孙**不生成任何组件**——文字/图形已在父层 PNG 里,再出 `<Text>`/`<View>` 就是双重渲染
- RN 场景注意(v0.3.12 事故形态):`sub-<X> > bg-<Y> > <中间容器> > <TEXT 叶子>`——中间层遍历时同样禁止提取 TEXT 叶子出 DOM,红线扩展到中间层

## 反例 (agent 常见错法)

```tsx
// Figma: bg-header(整体切图)内含 TEXT "限时抢购"
<Image source={require('./assets/bg-header.png')} data-node-id="211:10" />
// ❌ 文字已烤进 PNG,又出了一份 Text(视觉重影)
<Text data-node-id="211:12">限时抢购</Text>
```

## 违反后果

- **产物表现**: 文字/图形重影;改文案只改了 DOM 层,PNG 里的旧文案仍在

## 相关

- rules/R16-no-flatten-text.md
- bin/lib/loadCache.mjs(`_inBakedSubtree` 标注,与 h5 同步副本)
