# Acceptance — skill_add_autolayout_and_spacing_rules

> 逐项核对通过即可归档。所有改动集中在 `templates/skills/pp-d2c/SKILL.md` 单文件，4 段。

## 一、SKILL.md 静态核对（agent 已自查通过，用户可复核）

### §4.1（node 字段清单）
- [ ] line 573 后新增 6 类字段分组（视觉 / 布局 autoLayout / 子节点尺寸行为 / 定位 / 文本 / 可见性），autoLayout 段包含 `layoutMode / itemSpacing / paddingLeft/Right/Top/Bottom / primaryAxisAlignItems / counterAxisAlignItems / layoutWrap / layoutSizingHorizontal / layoutSizingVertical`
- [ ] 段末新增 "v0.3.1 强调" 引用块，明确"每处理一个 Frame 节点，必须先读 `layoutMode`"

### §4.1.1（REST → CSS 字段表）
- [ ] 标题变为"REST 原始 JSON 字段取值指引（v0.3 新增；v0.3.1 补 autoLayout）"
- [ ] 表格前分成 A / B 两段：**A. 布局 / autoLayout → flex**（10 行）+ **B. 视觉属性**（原有 15 行）
- [ ] A 段包含所有映射：`layoutMode → display: flex` / `HORIZONTAL/VERTICAL → flex-direction` / `itemSpacing → gap` / `padding* → padding-*` / `primaryAxisAlignItems → justify-content`（含 `SPACE_BETWEEN → space-between`）/ `counterAxisAlignItems → align-items` / `layoutWrap → flex-wrap` / `layoutSizingHorizontal/Vertical → 自身尺寸` / `layoutGrow → flex: 1` / `layoutAlign → align-self`
- [ ] A 段后有两条 "v0.3.1 铁律" / "两端对齐特别提醒" 引用块

### §4.3（布局规则重写）
- [ ] 段头标题变为"布局规则：每 Frame 独立走判定优先级 + 间距单一来源（v0.3.1 重写）"
- [ ] 5 步判定优先级完整（autoLayout / fixed- / 特殊前缀 / 坐标重叠 / 顺流兜底）
- [ ] 3 条间距单一来源铁律（兄弟间距 / 容器内边距 / 绝对定位下无 margin）
- [ ] 结尾 "选 flex 还是 block+margin" 引用块 + "选择依据是 Figma 属性，不是图层名前缀" 硬约束
- [ ] 原来 4 条模糊表述已完全删除，没有孤立残留

### §6.0（主 agent 逐叶子对比）
- [ ] "叶子 sub-block 接缝也要看" 之后新增"双重间距 / 布局违反检测 checklist（v0.3.1 新增）"整段
- [ ] 5 项检查完整（flex+margin / padding+first/last-child margin / absolute+margin / autoLayout 违反 flex 强制 / space-between 表达不忠实）
- [ ] 命中处理约定明确：不是改 scss 数值糊过去，而是回退该叶子 sub-agent 重写

## 二、端到端回归验证（用户执行）

**测试用例 1**：`https://www.figma.com/design/dKc9NQvjTgHe9sZzg4zFOL/?node-id=163-2085`
（D3C-有票未填写，测试项目 `figma-plugin-test-function/`）

- [ ] 把新版 SKILL 覆盖到测试项目 `.claude/skills/pp-d2c/SKILL.md`
- [ ] 重跑 SKILL，观察产物 `view/D3cYouPiaoWeiTianXie/index.module.scss`：
  - [ ] `position: absolute` 数量从 8 处降到 ≤ 3 处（预计只剩 cardImg 叠 cardContent 那一处；其余 bgHead/bgBody/notice/card/pinxuan 都改成 flex column + gap/margin）
  - [ ] `.statusBar` 保留 `position: fixed`（fixed- 前缀）
  - [ ] 出现 `display: flex; flex-direction: column; gap: xxpx` 段落表示 autoLayout 被翻译成 flex 了
  - [ ] 出现 `padding-top` / `padding-bottom` 表示 Figma 的 `paddingTop/Bottom` 被翻译上
- [ ] 抽 3 个 flex 容器检查：父有 `gap` 时子代**没有** `margin-*`
- [ ] 抽 3 个 padding 容器检查：没有 `:first-child { margin-top }` / `:last-child { margin-bottom }` 类补偿
- [ ] 若稿子里有 SPACE_BETWEEN（比如 `fixed-状态栏`）→ 输出 `justify-content: space-between`，**不是** `margin-left: auto`

**测试用例 2（补丁触发用例）**：`https://www.figma.com/design/dKc9NQvjTgHe9sZzg4zFOL/?node-id=163-2291`
（D3C-有票未填写，含 `fixed-状态栏` + `Frame 250(163:2298)` autoLayout 混合结构）

- [ ] 重跑 SKILL，观察产物 `pages/D3CBlindBox/index.module.scss`：
  - [ ] 根容器 `.d3cBlindBox` 走 `display: flex; flex-direction: column`（因根 Frame 163:2291 是 autoLayout `VERTICAL`），**不是** `position: relative`
  - [ ] `.notify` 段**只有 padding-top / padding-bottom + flex**，**没有** `position: absolute` + `top / left`
  - [ ] `.statusBar` 仍是 `position: fixed`，且 DOM 中作为 `.d3cBlindBox` 的 flex 顺流子项存在（不影响 `.notify` / `.mainWrap` 的位置计算）
  - [ ] `.notifyText` 靠 `.notifyInner` 的 padding 定位，**没有** `position: absolute + top:168px + left:146px` 这种"手算坐标"

## 三、回归验证（关键 bug 防线，不能因新规则回退老功能）

- [ ] `bg-` 前缀节点仍按 §4.0 / §4.3 处理（不生成 HTML、单独切图），未被 flex 规则误伤
- [ ] `sub-` 前缀仍走 §4.0.5 派发流程，本节新规则只在 sub-agent 内部生效
- [ ] `fixed-` 前缀仍走 §4.3 `fixed-` 定位规则子章节（判定优先级第 2 条明确指向）
- [ ] `scrollx-` / `scrolly-` 仍走各自专属规则（判定优先级第 3 条把它们排除在决策树外）
- [ ] `img-card` 上叠 `cardContent` 这种"设计上就是重叠"的场景，走判定优先级第 4 条 → absolute + top/left，行为不变

## 四、v0.3 REST 迁移的完整性（本次未改，但要确认没退回去）

- [ ] 全文没有新增 `mcp__plugin_figma_figma__*` 调用（保留的 3 处引用仍是"废弃说明"性质）
- [ ] 全文没有直接手写 curl（Figma 相关都走 `figma.mjs`）

## 五、归档条件

上述 1-4 全部通过 → 用户在此文件顶部补一句 `已验收 YYYY-MM-DD`，随后 agent 可把 `.task/active/skill_add_autolayout_and_spacing_rules/` 归档到 `.task/completed/<YYYYMMDD>-skill_add_autolayout_and_spacing_rules/`。
