# R22 - empty-visual-btn（v1.2.4 新增，warning 级）

## 判定归属

- **硬防线** (check-rules.mjs 自动识别): ✅（**warning 级**，提示不阻断、不 exit 1）
- **软防线** (Rule-Scan sub-agent 识别): ✅（生成前指引）
- **排斥条件**:
  - 节点名非 `btn-` 前缀（或裸词 `btn`）→ 不适用
  - `_inBakedSubtree` / `_hidden` / `_templateDup` → 跳过
  - `classMap[nodeId]` 为空 → 不报，交 R21（不可追溯）
  - 缺 `absoluteBoundingBox` 或面积为 0 → 跳过（不可见热区无视觉诉求）

## 触发条件

`btn-` 节点在产物中存在（有 className），但**自身与整棵子树都找不到任何可见视觉**——同时满足：

1. 子树无可见 TEXT（`visible !== false` 且 `characters` 非空白）；
2. 自身与子树所有有 className 节点的 CSS 均无 `background` / `gradient` / `url(...)`；
3. 子树所有节点在 JSX 中均非 `<img>` 挂载，且标签上无内联 `style={{ background... }}`。

命中 → **warning**（不阻断）。

## 为什么是 warning 不是 error

部分设计确实用**透明热区**叠在整图上（`bg-` 父层已含按钮视觉），此时空视觉按钮是正确产物——机械判定无法区分"合法热区"与"内容丢失"，按保守原则不 exit 1。但必须让主 agent 在 QA 段看见并**逐个复核**。

## 常见根因（复核清单）

1. **cache 深度截断**：`fetch-node --depth=N` 边界上的 GROUP children 为空，按钮真实内容不在 cache 里（典型 test24 btn-qiang 136:45810）→ 用 `figma.mjs fetch-node` 输出的 `truncatedSuspects` 核对，命中则不带 `--depth` 补拉子树后重生成。
2. **该切图没切**：内容是复杂矢量/图片组合，应命名 `btn-img-*`（可点击容器 + 内容为图片）走切图；只标 `btn-` 时生成器按 CSS 化处理，视觉丢失。
3. **合法透明热区**：视觉在 `bg-` 整图里 → 在 assets.txt 注明 `[R22 复核] {nodeId} 热区叠加于 {bg nodeId}`，消警。

## 期望产物

- 文字按钮：`<button>` + 子 TEXT `<span>` + 按 fills 写 `background`
- 图片按钮：改名 `btn-img-*` → 可点击容器 + 内容切图 `<img>` / `background-image`
- 透明热区（合法场景）：产物不变，assets.txt 写复核记录

## 与相邻规则的边界

- **R09 btn-bgc**：管 `btn-` 内 `bgc-` 子层渐变取真值；R22 管"整个按钮什么视觉都没有"
- **R21 node-id-coverage**：btn- 节点没进产物由 R21 报；R22 只管"进了产物但没视觉"
- **R03 implicit-image**：管无前缀纯矢量堆；btn- 前缀节点被 R03 排斥，由 R22 接手

## Rule-Scan 提示要点

- 提示 UI sub-agent：btn- 子树若只有占位矩形 + 空 GROUP，先怀疑 cache 截断，再怀疑该切图没切；禁止静默生成透明热区不留痕
