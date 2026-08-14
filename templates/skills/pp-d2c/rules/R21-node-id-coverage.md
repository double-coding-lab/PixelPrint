# R21 - node-id-coverage（v1.2.1 对账新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅（优先级最高——节点无 node-id 则其余绑定类规则全失效）
- **软防线** (Rule-Scan sub-agent 识别): ✅（兜底）
- **排斥条件**:
  - `_inBakedSubtree`（bg-/img- 整体切图 或 x- 忽略子树，本就不出独立 DOM）→ 跳过
  - `_hidden`（不渲染）→ 跳过
  - `_templateDup`（`.map()` 数据副本，只需代表项挂 id）→ 跳过
  - `name` 前缀 `bg-` / `bgc-` / `x-`（自身不生成独立 DOM：bg/bgc 挂父，x 忽略）→ 跳过

## 触发条件

**同时满足**:

1. 节点"应生成独立 DOM"（满足任一）:
   - `type === 'TEXT'`
   - autolayout 容器：`layoutMode ∈ {HORIZONTAL, VERTICAL}`
   - `layoutPositioning === 'ABSOLUTE'`（需 R20 校验坐标）
   - `name` 前缀 `img-` / `btn-` / `input-`（生成 `<img>`/`<button>`/`<input>`）
2. 产物 JSX 中**找不到**该节点的 `data-node-id="<nodeId>"`（跨行/属性顺序任意）

命中 → 违规（不可追溯）。

**反向对账（v1.2.5）**：产物 JSX 中每个**字面量** `data-node-id` 必须存在于 cache——cache 中不存在 = **幻觉 id**（凭记忆/臆造挂 id 应付正向检查），命中 → 违规。表达式形式（`data-node-id={x}`）不判。典型 test29：产物 33 个 id 有 11 个不在 cache（浅 cache + 低推理执行器编造）。

## 期望产物

- 凡承载 Figma 语义、会渲染成 DOM 的节点，产物元素必须带 `data-node-id="<nodeId>"`
- `.map()` 模板项：用**代表项（列表第一个同构兄弟 = variant a）**的 nodeId 挂在模板元素上；副本（variant b/c）已被 `_templateDup` 跳过，只校验代表项
- 详见 SKILL.md §5.1.1 data-node-id 全覆盖铁律

## 为什么必须机械强制

没有 node-id，R06（字色）/R18（flex 方向）/R19（padding）/R20（绝对坐标）在 `classMap[nodeId]` 为空时只能 `continue` → **对账规则集体失灵**。若只把"挂 id"写成文档铁律，agent 仍可漏挂 → bug 静默逃逸（典型 test13：`.small-card-top` 无 data-node-id，flex 方向反 + 幻觉 padding 直接上线，R18/R19 绑定不上没拦住）。R21 把"应渲染却无 id"本身变成硬违规，从机制上堵死这条逃逸。

## 反例（agent 常见错法）

```jsx
{/* ❌ .map() 模板：容器与文字都没挂 data-node-id → 逃出 R18/R19/R06 校验 */}
{CARDS.map((c) => (
  <div className="page__small-card" key={c.key}>
    <div className="page__small-card-top">                    {/* 无 data-node-id */}
      <span className="page__small-card-title">{c.title}</span> {/* 无 data-node-id */}
    </div>
  </div>
))}
```

## 落地代码模板

```jsx
{/* ✅ 模板挂代表项（variant a）的 nodeId；副本由 _templateDup 跳过 */}
{CARDS.map((c) => (
  <div className="page__small-card" data-node-id="211:218" key={c.key}>
    <div className="page__small-card-top" data-node-id="211:221">
      <span className="page__small-card-title" data-node-id="211:227">{c.title}</span>
    </div>
  </div>
))}
```

## 违反后果

- **产物表现**：节点不可追溯 → 对账规则绑定不上 → 布局/字色/坐标错误无人拦截，静默上线
- **典型事故**：v1.1.0 test13 — `.map()` 模板的 small-card-top / 文字节点全无 data-node-id，R18/R19 无法校验，flex 方向反 + 幻觉 padding 逃逸

## 与其他规则的关系

- **§5.1.1 data-node-id 全覆盖铁律**：R21 是该铁律的机械执行体
- **R06**：R06 只校验"可追溯 TEXT 的字色"；"TEXT 不可追溯"由 R21 统一报，二者不双报同一节点
- **R18/R19/R20**：都靠 data-node-id 绑定；R21 保证绑定前提成立
- **_templateDup**：R21 只校验代表项，副本跳过——与"模板挂代表项 id"策略配套

## Rule-Scan 识别提示

- 遍历 cache 里"应渲染"节点（TEXT / autolayout 容器 / ABSOLUTE / img-·btn-·input-）
- 排除 baked/hidden/templateDup 与 bg-/bgc-/x- 前缀
- 提示 UI sub-agent：每个这类节点必挂 data-node-id，模板挂代表项 id
- 标记 `rule: 'R21'` + `expected: '应渲染节点必挂 data-node-id'`

## 相关

- SKILL.md §5.1.1 data-node-id 全覆盖铁律
- bin/lib/loadCache.mjs（`_inBakedSubtree`/`_hidden`/`_templateDup` 标注）
- rules/R18-flex-direction.md / R19-padding.md / R20-absolute-position.md（依赖 R21 保证的可追溯前提）
