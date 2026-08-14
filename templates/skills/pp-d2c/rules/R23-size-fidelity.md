# R23 - size-fidelity（v1.2.5 新增）

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅（生成前指引）
- **排斥条件**:
  - 产物未显式声明 px 宽/高（HUG 不写宽、FILL 写 `100%`、`auto`/`fit-content`）→ 布局驱动，不判
  - `TEXT` 节点（字体渲染尺寸与 bbox 天然有出入）→ 不判
  - 声明了 padding 且全部规则体均无 `box-sizing: border-box` → 盒模型不确定，不判
  - `_inBakedSubtree` / `_hidden` / `_templateDup` / 无 className / 无 bbox 或面积为 0 → 不判

## 触发条件

设 `scale` = `config.unit.scale`（默认 2），容差 4px：

- 期望 `width  = bbox.width  × scale`
- 期望 `height = bbox.height × scale`

**任一命中 → 违规**:

1. 产物声明的 px `width`/`height`（取同类规则体中最后一次声明，CSS 后写覆盖）与期望**相差 > 4px**
2. **锚点欺诈特判**：声明 `width: 1px; height: 1px` 且任一规则体含 `overflow: hidden`，而期望宽高均 > 8px → 直接点名"锚点欺诈"

## 为什么需要本规则

test28 实测：执行器把真实 331.5×141（应 663×282px）的节点写成 `1×1 + overflow:hidden` 隐藏 div——挂着 data-node-id 骗过 R21 存在性检查、塞 1px 背景图骗过 R02 引用检查，agent 自供这是"校验锚点"。当时**没有任何规则校验宽高忠实度**，1px 无人过问。本规则封死这个维度：产物敢写 px 数值，就必须与设计稿对得上。

## 期望产物

- 固定尺寸元素：`width/height = bbox × scale`（±4px）
- 布局驱动元素：不写死 px（HUG 不写宽 / FILL 写 `100%`），本规则自动跳过
- **禁止**用 1×1 隐藏锚点代替真实渲染；节点确实不该有独立视觉时，走 baked 机制（`bg-`/`img-` 前缀）或与用户确认后不出 DOM

## 与相邻规则的边界

- **R19 padding**：管盒内间距忠实度；R23 管盒本身尺寸
- **R20 absolute-position**：管坐标与 position 声明；R23 管宽高
- **R21 node-id-coverage**：管"节点是否出现在产物"；R23 管"出现了但尺寸造假"（1px 锚点正是骗 R21 的产物）

## Rule-Scan 提示要点

- 提示 UI sub-agent：写死 px 的元素先算 `bbox × scale`，勿目测；不确定尺寸来源时选择不写 px（布局驱动），而不是写个大概值
