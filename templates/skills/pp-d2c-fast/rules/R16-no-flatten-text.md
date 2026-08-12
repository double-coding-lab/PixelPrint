# R16 - no-flatten-text

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底,建议 sub-agent 生成前也自查一遍)
- **排斥条件**:
  - 节点 name **裸词** `img` / `bg` → 免疫
  - 节点 name 以 **`img-`** / **`bg-`** 开头（且后有字符）→ 免疫
  - 节点 `type` 不在 `{GROUP, FRAME, COMPONENT, INSTANCE}` → 不适用

## 触发条件

**同时满足**:

1. `node.type` ∈ `{GROUP, FRAME, COMPONENT, INSTANCE}`
2. `node.name` 前缀 **非** `img-` / `bg-` / 裸词 `img` / `bg`
3. 该节点子树（递归 children）中 **存在** 至少一个 `TEXT` 类型节点
4. 产物 jsx 中出现 `<img ... data-node-id="<该节点 nodeId>" ... />`（无论跨行/属性顺序）

命中 → 违规。

## 期望产物

**JSX 端**:
- 不允许 `<img data-node-id="<该 nodeId>">`
- 应按 §4.3 前缀规则递归拆解子树：
  - TEXT 子节点 → `<span>` / `<p>` 展开
  - `btn-` 子节点 → `<button>` + CSS 化
  - `img-` 子节点 → `<img>` 引用切图
  - `bg-` 子节点 → 挂父容器 `background-image`
  - 无前缀装饰性 vector 子树 → 走 R03 隐式切图

**assets.txt 端**:
- 不允许出现该 nodeId 的"整体切图"行

## 反例（agent 常见错法）

```jsx
{/* ❌ Frame 745 含 TEXT "北京时间18:00开抢" + btn，被整体烤成 png */}
<img
  className={styles.couponBig}
  src={`${ASSET}frame-745.png`}
  data-node-id="211:171"
  alt=""
/>
```

对应 cache:
```json
{
  "id": "211:171",
  "name": "Frame 745",
  "type": "FRAME",
  "children": [
    { "id": "211:174", "name": "coupon-big-bg", "type": "RECTANGLE" },
    { "id": "211:198", "name": "折扣数字", "type": "TEXT" },   // ← 触发 R16
    { "id": "211:212", "name": "btn-q", "type": "GROUP" }
  ]
}
```

## 落地代码模板

```jsx
{/* ✅ 拆解子树；bg-* 挂父 background；TEXT 用 <span>；btn-* 用 <button> */}
<div className={styles.couponBig} data-node-id="211:171">
  {/* 211:174 bg-* → 父容器 background-image，此处不生成 DOM */}
  <span className={styles.couponBigNum} data-node-id="211:198">1折</span>
  <button className={styles.couponBigBtn} type="button" data-node-id="211:212">
    立即抢
  </button>
</div>
```

```scss
.couponBig {
  position: relative;
  width: 718px;
  height: 300px;
  background: url('#{$asset-prefix}coupon-big-bg.png') no-repeat center / 100% 100%;
}
```

## 违反后果

- **产物表现**：TEXT 无障碍缺失（屏幕阅读器读不到）、无法本地化（换语言换不了）、按钮不可点击、体验不可修改
- **典型事故**：v1.0.0 test12 事故 — Frame 745/744/762/img-title-quan + sub-MAIN 五处被整体烤成 png，91 条 R02/R06 违规被 agent 用 `[整体切图兜底]` 标签自签豁免

## 与其他规则的关系

- **R03 implicit-image**：R03 自身已排斥子树含 TEXT 的情况；R16 是"哪怕 agent 无视 R03 的排斥条件，最终也拦得住"的兜底
- **R02 fills-image**：R02 只管 fills 含 IMAGE 的节点必须落切图；R16 管 fills 不含 IMAGE 但被违规整体切图的情况
- **§6.0.2 兜底防线 N=0**：R16 输出的 violation 一律不许被 `[整体切图兜底]` 豁免（该标签已废除）

## Rule-Scan 识别提示

- 遍历 cache 里 `type ∈ {GROUP, FRAME, COMPONENT, INSTANCE}` 且 `name` 非白名单的节点
- 递归 `children` 判断子树是否含 `TEXT`
- 是 → 在 `rule-hits.json` 里给该节点标记 `rule: 'R16'` + `expected: '禁止整体切图；按前缀拆解子树'`
- UI sub-agent 生成 jsx 时若准备对该节点写 `<img>` → 强制回退到子树递归

## 相关

- SKILL.md §4.3 图层解析规则（前缀白名单来源）
- SKILL.md §6.0.2 兜底防线（配合本规则彻底废除"整体切图兜底"路径）
- rules/R02-fills-image.md
- rules/R03-implicit-image.md
- rules/R06-text-solid-last.md
