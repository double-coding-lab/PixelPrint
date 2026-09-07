# R21 - node-id-coverage(RN 侧逐字节复用 h5 判定;最高优先级)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅(脚本与 h5 母本逐字节一致,正则与 cache 判定零样式耦合)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (优先级最高)
- **排斥条件**: 排斥 baked/hidden/templateDup 与 bg-/bgc-/x-(不生成独立组件);节点无 id 则 R06/R18/R19/R20 全绑定不上,先补 id 再谈其余

## 触发条件

- **正向**: 应渲染节点(TEXT / autolayout 容器 / ABSOLUTE / img-·btn-·input-)在产物 JSX 里找不到 `data-node-id`
- **反向**(v1.2.5 对齐): 产物 `data-node-id` 不存在于 cache → 幻觉 id,直接 violation

## 期望产物

- 凡承载 Figma 语义的组件必挂 `data-node-id="<figma nodeId>"`(RN 运行时忽略未知 prop;上线前 `pp-strip-nodeid` 统一剥离并转存锚点)
- `.map()` 模板项挂**代表项(variant a)**的 id;唯一例外是 Figma 里不存在源节点的虚拟 wrapper(如 `end-` 机制的 `__front-group`、骨架的 root/scroll/scrollContent)

## 反例 (agent 常见错法)

```tsx
// ❌ 正向漏挂(该 Text 逃出全部对账)
<Text style={styles.title}>限时抢购</Text>

// ❌ 反向幻觉(cache 里没有 9:99 —— test29 形态:截断 cache + 幻觉 id 真空通过)
<View style={styles.card} data-node-id="9:99" />
```

## 落地代码模板

```tsx
<Text style={styles.title} data-node-id="211:12">限时抢购</Text>
```

## 违反后果

- **产物表现**: 漏挂 = 该节点逃出 R06/R18/R19/R20/R23 全部对账,bug 静默逃逸;幻觉 id = 对账对到不存在的节点,防线真空通过

## 相关

- SKILL.md §5.1.1 data-node-id 全覆盖铁律
- rules/R23-size-fidelity.md(1×1 锚点欺诈——为混过本条而生的对策)
