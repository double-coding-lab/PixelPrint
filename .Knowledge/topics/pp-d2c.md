---
id: pp-d2c
revision: 0
summary: pp-d2c
primary: policy
confidence: inferred
tags: [feature, config]
---
# pp-d2c

> D2C 主 SKILL（`templates/skills/pp-d2c/`）的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md（共约 770 行），本 topic 是路由摘要 + 关键边界，不重复长篇内容。

## 适用场景 / 触发词

- 用户提供 Figma 设计稿 URL 并说"还原"、"D2C"、"生成代码"
- 维护者修改主 SKILL 时定位读哪几节
- 排查"切出来的图带画板背景色 / 光晕 / 间距对不上 / 列表被压平成背景图 / token 过期生成失败 / bg- 套 bgc- 揉到一张图 / 描边丢失 / `doctor.run()` 函数找不到"等典型 bug
- 排查"文字/图双重渲染（切图里一份 + DOM 一份）/ flex 方向反 / padding 凭空加 / 绝对定位坐标靠猜 / `.map()` 模板节点漏挂 data-node-id / check-rules 报一堆 R02·R06 假阳性被『语义盲点』批量豁免"等 v1.2.0 对账类 bug
- 排查"rule-hits.json 缺失但 assets.txt 已写消费证明 / check-rules --block 报 block 外节点误报 / 切图透明热区（深度截断丢内容）/ btn- 空视觉按钮"等 v1.2.4 生成过程类 bug

## SKILL.md 是给 LLM 读的操作手册，不是可执行代码（v0.2 关键澄清）

主 SKILL.md 和 doctor SKILL.md 全篇都是**自然语言指令**。文档里出现的 `doctor.run({...})`、`return { passed, ... }`、`派发新 sub-agent`、`sub-agent 上报` 等表述全是**伪代码/隐喻**，不是真函数调用、不是真多进程通信。

**全程只有一个 LLM agent**（执行的 Claude），它按 SKILL 步骤顺序：
- Read 各 SKILL.md 当操作手册读
- 调 MCP 工具（Figma get_metadata / get_screenshot / get_design_context、文件读写）
- 在对话里产出文本（代码、JSON 摘要、报告、决策）

唯一真正"被执行"的是 MCP 工具调用和文本输出。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

**典型映射**（详见主 SKILL 顶部「执行模型说明」表）：

| 文档表述 | 实际操作 |
|---------|---------|
| 主 SKILL §0.5 `doctor.run({fileKey, nodeId, mode:'integrated'})` | 当前 agent Read doctor SKILL.md，按其 §-1 → §5.4 步骤执行，最后输出 §5.4 描述的 JSON 摘要到对话 |
| doctor §5.4 `return { passed, ... }` | 当前 agent 在对话里输出该 JSON 字符串；主 SKILL 后续步骤从同一对话上下文读这段 JSON 继续推进 |
| 主 SKILL §4.0.5 "派发新 sub-agent" | 当前 agent 重新进入 §4.0 流程，把根节点重置为新 nodeId、depth +1，重走一遍 |
| §4.0.5 "sub-agent 上报" | 当前 agent 把 subslots.json 内容**写到真实磁盘文件**（与 assets.txt 同级），下一轮读这个文件继续 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**，要字面写进 JSX 文件作占位符；§5.0 合并时再字面替换 |

**误读后果**：把伪代码当真函数会**卡死流程**（等待一个永远不到来的"返回值"），或**绕过关键步骤**（"既然 SKILL 里说 `doctor.run()` 就行，那直接跳到 §1"）。

## 与 doctor 的分工（必读）

主 SKILL `pp-d2c` 与 doctor `pp-doctor`（见 [[pp-doctor]]）是**协作但独立**的两条流程：

| 层级 | 关注 | 产物 |
|------|------|------|
| **doctor** | 体检设计稿是否符合命名/布局/结构约定 | `.d2c-health-*.md` 报告 + 阻塞决策 |
| **主 SKILL** | 解析图层、分发 sub-agent、生成 JSX/SCSS、下载图片 | 完整可运行的页面代码 |

**集成关系**：主 SKILL 步骤 0.5 在 `health.enabled=true` 时**调用** doctor 做集成体检，根据返回的 `passed` 决定是否阻塞生成（详见 SKILL.md §0.5）。doctor 的内部规则不影响主 SKILL 的生成逻辑——两者各自独立可读，**无强 dependency**。

## 版本口径（skill 版本 ≠ npm 版本）

pp-d2c 有**两套独立版本号**，不一致是正常的：

- **SKILL 版本**：`SKILL.md` banner 里的 `v1.2.x`——追踪 skill **规则 / 防线的演化**（如 v1.2.0 对账范式、v1.2.1 R21）。
- **npm 包版本**：`package.json` 的 `version`（如 `1.3.1`）——追踪 npm 包 `@double-coding/pixel-print` 的**整体发布**，覆盖所有 skill + `install.js` + docs。

二者独立递增：改一条 skill 规则会 bump SKILL 版本但未必 bump npm；发一次 npm 可能只动 `install.js` 而 SKILL 版本不变。**看到 SKILL `v1.2.5` 与 npm `1.3.1` 不一致属预期，不是 bug**。（pp-d2c-rn `v0.4`、pp-d2c-fast 等各 skill 的 SKILL 版本同样与 npm 独立。）

## 设计原理概述

一句收敛：**允许兜底的路径就是错误来源；校验以 cache 为唯一真值逐节点对账，而非抽查已知坏味道。**

- **四层架构**：数据层(`figma.mjs`) / 规则层(`SKILL.md`+`rules/`) / 执行层(LLM) / 校验层(`check-rules.mjs`)——两个确定性脚本层夹住一个概率性 LLM 层，机械动作(HTTP/缓存/下载/校验)从 LLM 手里拿走，LLM 只做"理解结构+产出代码"。
- **前缀即协议**：图层名前缀是硬编码内置常量(config 无 `layers` 段)，设计师用前缀显式写意图，skill 不猜。组合优先级 `x- > img- > bg- > bgc- > btn- > 滚动 > 无前缀`，`fixed-`/`end-` 是修饰前缀最后叠加；裸词白名单 `bg/bgc/btn/img/input`。
- **双防线**：软防线 Rule-Scan(生成前识别语义类 R07/R10/R11/R13/R15) + 硬防线 check-rules(交付前逐节点对账,17 条 R01/R02/R03/R04/R05/R06/R08/R09/R12/R14/R16–R21/R23)。软管提效(先扫作业指引再动笔)、硬管保质(exit 1 回滚)。**v1.2.3 起 软规则硬化**：Rule-Scan 软防线里机械可判的 R03/R04/R09/R12/R14 下沉硬防线(逐节点对账不依赖 sub- 触发、exit 1 阻断,一律保守判定宁漏报不误判),软防线瘦身至需 LLM 语义的 R07/R10/R11/R13/R15。**v1.2.2 起 Rule-Scan 触发与 sub- 解耦**：页面无 sub- 图层时,主 agent 出码前把「页面根」当虚拟 block 对整页跑一次 Rule-Scan,`rule-hits.json` 落页面根目录(与页面 `assets.txt` 同级)——软防线覆盖不依赖设计师是否标了 sub-(pp-d2c 与 pp-d2c-fast 同口径)。**v1.2.4 起 生成过程缺陷修复批**（exit-1 规则数维持 16 条）：`check-rules --block` 局部化（`--root <nodeId>` 或产物 data-node-id LCA 推断,cache 裁剪到 block 子树,消除 block 外全量误报）；新增 **GATE-rule-hits 门禁**（rule-hits.json 缺失即 exit 1,含 assets.txt 消费证明捏造检测）与 **IMG-reconcile 三方对账**（`--merge` 时产物图片引用必须来自 slice-manifest,动态拼接碎片按后缀匹配保守放行）；R20 增强（ABSOLUTE 节点强制 `position: absolute` 声明）；新增 R22 empty-visual-btn（warning 级,btn- 空视觉按钮嫌疑,不计入 16 条）；Rule-Scan 恢复全量扫描出指引（软 5 条仍是唯一判定点,硬防线命中只作生成前指引,判决权在 check-rules）。**v1.2.5 起 防线加固批**（exit-1 硬规则 16→**17 条**,新增 R23 计入;warning 级 R22 与四道门禁 GATE-cache-truncation / GATE-rule-hits / IMG-reconcile / GATE-slice-confirm 不计入 17）：新增 **GATE-cache-truncation**（合并 cache 中空 GROUP/BOOLEAN_OPERATION = fetch depth 截断实锤,截断 cache 会令逐节点对账真空通过——test29 取证:cache 仅 25 节点令全防线真空通过,产物 33 个 data-node-id 有 11 个幻觉 id）；**R21 增加反向对账**（产物 data-node-id 必须存在于 cache,幻觉 id 直接 violation）；新增 **R23 size-fidelity**（显式 px 宽高须 ≈ bbox×scale 容差 4px,点名 `1px×1px + overflow:hidden` 锚点欺诈——test28 取证:agent 自供"校验锚点",把真实 331.5×141 写成 1×1 隐藏 div）；**GATE-rule-hits 收紧**（fallback 占位必须伴随 assets.txt `[Rule-Scan 降级]` 失败记录）；**GATE-slice-confirm 确认留痕**（slice-manifest `confirmed` 须为 true,由 `figma.mjs confirm-slices` 用户确认后翻转,legacy 缺字段仅 warning）。
- **sub-agent 分块是质量保证非性能优化**：单 agent 同时处理全局协调+局部细节时细节退化，故 `sub-` 强制分发、最深 3 层、`<__SUBSLOT__>`+`subslots.json` 上报-派发。
- **data-node-id 贯穿全流程**：对账绑定 / 守恒律差集 / review 反查 / 局部修复锚点，四用途；R21 把"全覆盖"变硬规则。
- **封逃逸口 + 自证代替信任**：已知逃逸路径(整体切图代拆结构/凭空搓渐变/幻觉 padding)显式禁止 + 机械拦截；豁免须三段证据且单次 ≤3；生成流程禁 `--force-skip`。

> 完整原理（四层架构 / 执行流水线 步骤-1→7 / 前缀协议 / sub-agent 分块 / 对账范式 / 忠实度契约 / 设计取舍）见终稿 [`.Knowledge/stock-docs/pp-d2c-原理_终稿.md`](../stock-docs/pp-d2c-原理_终稿.md)；开发者视角原文长文另见 `docs/pp-d2c-principles.md`。

## v1.2.0/v1.2.1 对账范式（校验从「抽查」升级为「逐节点对账」）

**背景**：v1.1.0 及以前，`check-rules.mjs` 是「黑名单抽查」——只找已枚举的坏味道（inline style、缺 url、flex-end 冒充 space-between），抓不到「没被列举的错误」（flex 方向反、padding 幻觉、绝对坐标猜测、双重渲染）。且 R02/R06 对「整体切图子树里的 TEXT/IMAGE」逐个校验会产生大量假阳性，agent 用「语义盲点/装饰性内容」批量豁免，把真遗漏（如 cd-num 背景漏切）一起放行。v1.2.0 转向「以 Figma cache 为唯一真值，逐节点对账」。

### 对账基座（`bin/lib/`）

- **`loadCache.mjs` 给每个节点打标**（对账规则据此跳过假阳性来源）：
  - `_inBakedSubtree`：祖先含 **`bg-`/`img-`（整体切图，像素进 PNG）或 `x-`（整体忽略）** 前缀 → 子孙不生成独立 DOM。**v1.2.1 起不含 `bgc-`**（bgc- 是盒级 CSS 写父、非切图，其子孙误放的 TEXT 应被 R06/R21 暴露而非静默吞）。
  - `_hidden`：自身或祖先 `visible === false` → 不渲染。
  - `_templateDup`：`.map()` 列表里**同构兄弟的非首个**（数据副本）→ 只校验代表项（variant a），副本跳过。
  - `_parentId`：供 R20 查父节点 bbox。
  - 标注是**内存态**：`walk()` 直接修改缓存 JSON 解析出的对象引用，**不回写** `.d2c-cache` 磁盘文件。同构判定用 `structureSig()`（type + 深度 3 子结构签名，不看具体文案）；**叶子节点不参与列表判定**（并排 TEXT「20」「元」不会误标为副本）；副本标记向整棵子树传播（副本项的子孙全部跳过对账）。
- **`cssMatch.mjs` 共享 SCSS 嵌套匹配**：产物按 `config.styleFormat` 可能是平铺 `.page__foo` 或 SCSS `&__foo`/`&-foo` 嵌套；R01/R02/R06/R18/R19 统一走它，修掉「产物用嵌套写法、规则用平铺正则 → 整体匹配不到」的全线假阳性盲区。

### 五条新硬规则（R17–R21，全部 exit 1 拦截）

| 规则 | 抓什么 |
|------|--------|
| **R17 no-baked-dom** | baked 子孙（`_inBakedSubtree`）又出现在产物 DOM = 双重渲染（典型：bg-main 的 title/subtitle 既进 main.png 又出 `<span>`） |
| **R18 flex-direction** | `layoutMode: VERTICAL` 却写 `flex-direction: row`（或反之） |
| **R19 padding** | padding 凭空捏造 / 漏写 / 数值 ≠ Figma paddingT/R/B/L × scale |
| **R20 absolute-position** | `layoutPositioning: ABSOLUTE` 子节点 top/left ≠ (子bbox − 父bbox) × scale（排斥 `fixed-`，那走 R01/constraints） |
| **R21 node-id-coverage** | 应渲染节点（TEXT / autolayout 容器 / ABSOLUTE / img-·btn-·input-）在产物里漏挂 `data-node-id` → 逃出全部对账。**优先级最高**：没 id 则 R06/R18/R19/R20 全绑定不上 |

### 配套的三条硬约束（SKILL.md）

- **§6.0.2 封逃逸口**：禁「语义盲点/装饰性内容/父层整体切图承载」批量豁免话术；「需人工核对」不再适用于可机械计算量（坐标/尺寸/flex 方向/padding）；**生成流程禁用 `--force-skip`**（仅维护者调试用），唯一合法豁免是 assets.txt 的 `[脚本误判]` 三段证据（单次 ≤ 3 条）。
- **§5.1.1 data-node-id 全覆盖铁律**：凡承载 Figma 语义、会渲染的 DOM 必挂 `data-node-id`；`.map()` 模板挂**代表项（variant a）**的 nodeId。R21 是它的机械执行体。
- **§4.3 含 TEXT 容器「压平 vs 拆」唯一裁决树**：`bg-`/`img-` 前缀 → 压平（整体切图，子孙禁 DOM）；普通含 TEXT 容器 → 拆结构（R16，TEXT 出 DOM + 背景不含文字）；**二选一，禁止「既烤又留」**。附 **bg- 背景直接挂父 vs 独立层**判定：背景 bbox ≤ 容器 → 直接 `background` 挂父（默认）；溢出 → 独立 `position:absolute` 层。

### 核心哲学

> **允许兜底的路径就是错误来源；校验以 cache 为唯一真值逐节点对账，而非抽查已知坏味道。**

完整规则定义见 `templates/skills/pp-d2c/rules/R17~R21.md` 与 `rules/README.md`；对账基座实现见 `bin/lib/loadCache.mjs` / `bin/lib/cssMatch.mjs`。

## 软防线闭环与 rule-hits 档案

软规则（v1.2.3 后剩 R07/R10/R11/R13/R15）**没有机械比对**，靠三段清单对账闭环：

1. **Rule-Scan 记账**：每个 sub- block 出码前派独立 Rule-Scan（只识别不写 UI），落盘 `rule-hits.json`，每条 hit 带 nodeId/trigger/expected；只按规则文档触发条件**字面判定**，禁止按设计意图猜测。
2. **UI sub-agent 销账**：按每条 hit 的 expected 落地，`assets.txt` 写「rule-hits 消费证明」（输入 N 条 vs 处理 M 条逐条对号）；发现漏扫允许自补但必须记 `[遗漏补捕]`。
3. **主 agent 查账**：§6.0.2 合并前聚合读所有 rule-hits 与消费证明，输出 N/M diff（fast 版不手写消费证明，消费到位由 check-rules exit 0 保证）。

软规则出错由三层兜底：**硬规则接力**（v1.2.3 后 R03/R04/R09/R12/R14 本身已是硬防线；剩余软规则如 R07 多层 fills 由 R02 切图对账部分兜、R13 漏乘 scale 会被 R19/R20 数值对账暴露）、**视觉验收**、**降级链**（Rule-Scan 挂→重派一次→二次挂写 `v0.3.21-fallback` 占位 + UI 侧自读全量规则库；硬防线不受影响）。

- **落盘位置**：`<output.dir>/<页面>/blocks/<sub>/rule-hits.json`（与该 block 的 index.tsx / assets.txt 同级；嵌套 sub- 在父 block 的 `blocks/` 子目录）；v1.2.2 起无 sub- 页面落**页面根目录**。本仓库是 skill 模板源，仓内不存在该文件——它是业务项目运行产物。
- **生命周期**：flat 合并后 `blocks/` **保留所有层级不删除**（QA 审计档案，与消费证明 / 遗漏补捕互为对照）；**不放** `.d2c-tmp`（该目录语义为「跨会话不保留」，步骤 7 清理）。
- **排障口径**：稿子有 sub- 却无 `blocks/` 目录 = 执行偏离；稿子无 sub- 时无 `blocks/` 属正常（产物仅 index.jsx / index.scss / assets.txt，v1.2.2 起页面根应有 rule-hits.json）。

## v1.2.4 生成过程要点（防线之外的流程变更）

- **步骤 2.6 硬门禁**：reskin-slice 切图失败即 hard stop（禁手工绕过续跑）；切图完成后**确认暂停**——config 新键 `slice.confirmBeforeContinue` 默认 `true`，切完停下等用户确认再出码；`sizeWarning` 非空时不受该开关豁免，一律必停。
- **micro-sub 快路径与同构 sub- 合并**：满足 ≤8 节点等 4 条件的微型 sub- block 由主 agent 内联出码（免独立派发的固定成本）；同构 sub- 合并为代表项模板 `.map()` 渲染，只出一份代码。
- **figma.mjs 截断修复**：修复"全量请求复用深度截断 cache"bug，并新增 `truncatedSuspects` 截断检测——背景是 test24 `btn-qiang` 因 depth=8 截断丢内容退化成透明热区，全页 41 个截断嫌疑节点。

## v1.2.5 生成过程要点（确认留痕与单 agent 模式）

- **切图确认留痕**：reskin-slice 完成后在 slice-manifest 落 `confirmed:false`，用户确认切图结果后由 `figma.mjs confirm-slices` 翻为 `true`；GATE-slice-confirm 据此机械校验，用户口头"别问了"不构成豁免，跳过确认的唯一通道是 config `slice.confirmBeforeContinue: false`（此时 reskin-slice 直接落 `confirmed:true`）。
- **单 agent 执行模式**：无 sub-agent 能力的平台（如 Codex）由主 agent 串行完成 Rule-Scan、出码、check-rules 等同等动作——单 agent 模式是合法路径，禁止以"平台没有 sub-agent"为由用占位绕过任何步骤。

## 关键执行约束（按重要度排序）

### 1. 图片导出必须带 `use_absolute_bounds=true`（v0.2 必须）

**位置**：SKILL.md §477-501（含 v0.2 修订说明）。

```bash
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2&use_absolute_bounds=true"
```

**忽略此参数会同时触发两个 bug**：
- "图都带画板背景色"——Figma 默认导出包含父容器 fills，PNG 里印着上一级背景色
- "切图带光晕 / gap 算不准"——默认导出包含图层 effect（drop-shadow / outer-stroke / blur）的可见外扩，PNG 比 bbox 大一圈，CSS 对齐用的负 margin 必须人为放大才能视觉贴合（设计稿 -25px 实际写 -50px 是错的，根因就是这个）

**例外**：仅当某张图就是要把 effect 烤进位图（极少，例如复杂渐变蒙版），把 nodeId 列入 config `images.preserveEffectIds` 数组。

### 2. `sub-scrollx-` / `sub-scrolly-` 禁止整体导出（v0.2 新增）

**位置**：SKILL.md §463-470（自检 4 行）+ §728（禁止项）。

scroll 容器的子层是**同构列表项**（`.map()` 渲染），按主 SKILL §416-417 必须**继续递归子层**。sub-agent 偷懒把整个 scroll 容器当作 `bg-` 整张导出（生成 `tripList { background-image: url(bg-list.png) }`）会让运行时无法绑定数据、列表内容变成静态图。

sub-agent 在生成 scroll 容器代码前**必须输出自检 4 行**：

```
· 子层数：{N}
· 同构判断：{是否 ≥ 2 个同名 / 同结构子层} → {是 = .map() 渲染 / 否 = 异构内容逐个生成}
· 背景层来源：{bgc- 子节点 / bg- 子节点 / 父层 fills / 无} → 不允许"无来源时 fallback 整体导出"
· 内部 DOM 节点数（不含背景）：{M}（M 必须 ≥ N，否则说明把列表项压平了，回头重写）
```

任意一项无法明确填写 → **停下问主 agent，不允许猜测后整体导出**。

### 3. Token 过期兜底链 L0→L1→L2→L3（v0.2 新增）

**位置**：SKILL.md §4.4.1。

| 级别 | 动作 | 触发 |
|------|------|------|
| **L0** 主路径 | REST API + `figma.token`（带 `use_absolute_bounds=true`） | 默认 |
| **L1** 兜底 | 调用 MCP `download_assets`，curl 下载返回的 `url` 到本地 | L0 返回 401/403/`invalid_token`/超时；或 token 为空 |
| **L2** 兜底 | 退化用 MCP url 直接进 `<img src>` + 红色 QA 告警 | L1 也失败（极少） |
| **L3** | 终止，让用户介入 | 全失败 |

**关键 trade-off**：MCP `download_assets` **不支持** `use_absolute_bounds`，走 L1 兜底拿到的图会重新带回"画板背景色 + 光晕外扩"两个副作用。这不是退步，是 token 不可用时的能力上限。**强制 QA 段落输出告警**，列出受影响文件名 + 提示"补 token 后用 L0 重跑能彻底解决"。

**禁止**（v0.2 修订旧约定）：
- ❌ 禁止 token 过期时跳过下载（旧版写的"用 MCP 临时链接占位"作废——临时链接 24h 过期，代码上线就 404）
- ❌ 禁止 MCP 临时链接（`figma.com/api/mcp/asset/...`）直接进 `<img src>`，只能作为下载源
- ❌ 禁止 L1 走通后省略 QA 告警

### 4. bgc- 覆盖父元素全套盒级 CSS 属性（v0.2 修订，范围扩展）

**位置**：SKILL.md §`bgc-` 取值规则。

旧规则只让 bgc- 取 fills，导致设计师把"渐变填充 + 描边 + 圆角 + 阴影"理解为"一个 bgc-"是合理的（这就是父级 box 的全套装饰），但生成端描边/圆角/阴影全丢。**v0.2 起 bgc- 覆盖**：

| Figma 属性 | CSS 属性 |
|-----------|---------|
| `fills` SOLID / GRADIENT_LINEAR / GRADIENT_RADIAL | `background-color` / `background-image: linear-gradient(...)` / `radial-gradient(...)` |
| `strokes` Outside | `outline: {weight}px solid #xxx`（不影响盒模型，向外延伸） |
| `strokes` Inside | `border: {weight}px solid #xxx` + `box-sizing: border-box`（占用内部空间） |
| `strokes` Center | 没有完美对应，退化 outline 偏移一半 + QA 标注 |
| `cornerRadius` / `rectangleCornerRadii` | `border-radius` |
| `effects` DROP_SHADOW / INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR | `box-shadow` / `box-shadow: inset` / `filter: blur()` / `backdrop-filter: blur()` |

所有属性写到 **bgc- 的父元素**（bgc- 不生成独立 HTML）。

### 5. bg- 内嵌 bgc- 的"摘出来"处理（v0.2 新增）

**位置**：SKILL.md §`bg-` 内嵌 `bgc-` 的处理。

切 bg- 前**必须**扫描子树（递归全部子孙）查找 bgc-：

| 子树 bgc- 数 | 处理 |
|-------------|------|
| 0（推荐结构） | 正常切 bg- |
| 1 | 把这个 bgc- "摘出来"按 §4 全套规则写父元素 CSS；bg- 子树其他装饰随 bg- 整体切图（Figma `/v1/images` API 限制无法切图时排除子节点）；输出告警 |
| ≥ 2 | 取第一个 bgc-，其余忽略，输出 error 级告警 |

**bg- 兄弟也有 bgc- 时的优先级**：兄弟 bgc- 优先（更符合"父级 CSS 属性"语义），嵌套那个 bgc- 的 CSS 属性不重复声明，避免和兄弟 bgc- 打架。doctor NAM013 仍 warn 提示嵌套那个应改成兄弟。

**Figma API 物理限制**：`/v1/images` 不支持切图时排除某个子节点，所以 bg- 内嵌 bgc- 时位图里仍有 bgc- 视觉副本（渐变 + 描边都烤进去）——CSS 端的属性会盖在最上层，视觉对齐 OK，但位图体积浪费。要彻底干净只能让设计师把 bgc- 移出 bg- 子树。

### 6. bg- 切图前的 CSS-able 自检（v0.2 新增）

**位置**：SKILL.md §`bg-` 切图前的"CSS-able 自检"。

切 bg- 之前**必须** `get_design_context` 拿节点完整属性，按下表判定该节点是不是其实更适合用 CSS 实现：

| 条件（全部满足才命中 CSS-able） | 行动 |
|-------------------------------|------|
| fills 全是 SOLID / GRADIENT_LINEAR / GRADIENT_RADIAL，无 IMAGE | 命中 → **跳过切图**，按 bgc- 规则用 CSS 实现 + 输出告警建议改名为 bgc- |
| strokes 空或全是 SOLID | |
| effects 空或单一 DROP_SHADOW（INNER_SHADOW/LAYER_BLUR/BACKGROUND_BLUR 让节点 CSS-unable） | |
| 子树纯净（无可见子节点） | |

**为什么必须做**：位图渲染的渐变会因缩放产生 banding（视觉劣化）；含 effects 时切出来的 PNG 边缘会"沾染"画板底色泄漏的视觉假象（实际是渐变浅色端 + 描边在圆角抗锯齿处的混合）；位图无法运行时主题切换。

### 7. `fixed-` 视口固定定位（v0.2 新增）

**位置**：主 SKILL §`fixed-` 定位规则（§4.3 末尾） + doctor §3.6d NAM014 + §3.9e LAY013。

`fixed-` 是**定位修饰前缀**——只改 `position`，不决定渲染方式。可与所有"生成节点"的前缀叠加（`sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-`），**不可**与"不生成节点"的前缀叠加（`bg-`/`bgc-`/`x-`，doctor NAM014 命中后 error）。典型用途：吸顶 nav、吸底 tab、悬浮回顶按钮、固定浮层入口。

**top/bottom/left/right 取值**（依赖 Figma `constraints`，**不是**直接读坐标）：

| Figma constraint | CSS 写法 |
|------------------|---------|
| `vertical: 'TOP'` | `top: <figma top>px` |
| `vertical: 'BOTTOM'` | `bottom: <viewport.h - figma bottom>px` |
| `vertical: 'CENTER'` | `top: 50%; transform: translateY(-50%)` |
| `horizontal: 'LEFT'` / `'RIGHT'` / `'CENTER'` | 同理（参见 SKILL §`fixed-` 定位规则表） |

设计师没设 constraints 时退化为绝对坐标，**强制 QA 告警**。

**已知 CSS 副作用 LAY013（warn）**：祖先链有 `transform` / `filter` / `perspective` 时，子代 `position: fixed` 退化为"相对该祖先定位"。生成端**不自动用 Portal 外挂**（重量副作用），由设计师把 fixed- 节点上提到根 frame 或祖先去掉 transform；业务必须保留祖先效果时由开发手动加 React Portal。

**z-index 默认 100**：同页面多个 fixed- 按设计稿前后顺序递增（100/101/102…），sub-agent 在 QA 段落标注实际取值。

**典型踩坑（doctor NAM014 阻止）**：
- ❌ `fixed-bg-banner`：bg- 不生成节点，fixed- 落空
- ❌ `fixed-bgc-header`：同上
- ❌ `fixed-x-mark`：x- 跳过，fixed 失效
- ✅ 想做"固定背景"：把 fixed- 加在**父节点**上（如 `fixed-sub-banner` 里再放 `bg-banner`）

### 8. `end-` 逆向布局（贴父末端，v0.3.2 新增）

**位置**：主 SKILL §`end-` 逆向布局规则（§4.3 fixed- 章节后） + doctor §3.6e NAM016 + §3.9f-i LAY017/018/019/020。

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-`/`bgc-`/`x-`，doctor NAM016 命中后 error）。

**主线机制（唯一实现路径）**：wrapper + `justify-content: space-between`。父容器把 end- 节点前面的所有兄弟包一层虚拟 wrapper（className 用父类名 + `__front-group`，不写 data-node-id），父 CSS 设 `justify-content: space-between`，天然把 end- 推到末端。end- 节点本身保持原生成逻辑不变。

```jsx
<parent>                          {/* justify-content: space-between */}
  <wrapper-of-front>              {/* v0.3.2 虚拟 wrapper */}
    <A /> <B /> <C />
  </wrapper-of-front>
  <D />                           {/* end- 节点，贴到父末端 */}
</parent>
```

**与 `fixed-` 的区别**：`fixed-` 相对**视口**贴边，`end-` 相对**父容器**贴末端。两者同现（`fixed-end-x-btn`）时 fixed- 优先，end- 忽略（doctor LAY020 warn）。

**与 Figma 原生 `SPACE_BETWEEN` 的区别**：设计师把 Auto Layout 间距设为 Auto 时，REST API 返回 `primaryAxisAlignItems: "SPACE_BETWEEN"`，R05 将其翻译为 `justify-content: space-between`——但它把**全部子项**均分拉开；`end-` 通过虚拟 wrapper 让前组保持设计稿固定 gap、**只推末项**。父容器恰好 2 个子项且已设 Auto 间距时两者效果等价，不必加 `end-`；子项 ≥3 只想推最后一个、或需要「贴真实屏底」（运行时视口语义，Figma 静态几何表达不了）时必须用 `end-`。

**触发前提**（doctor 校验四类不合规）：
- `end-` 必须是父的**最后一个可见子**（LAY017 error，不在末位）
- 同一父下**只允许一个** `end-` 子（LAY018 warn，多个只有末位生效）
- 父必须是 autoLayout（LAY019 error，`layoutMode` 缺失 / `NONE` 时无方向可判）
- 不与 `fixed-` 同现（LAY020 warn）
- 不与 `bg-` / `bgc-` / `x-` 同现（NAM016 error，不生成节点无法应用）

**父容器主轴必须有确定长度**：`space-between` 只有在父 `layoutSizingHorizontal/Vertical: FIXED` / `FILL` 时才能真正把 end- 推到末端；父是 `HUG`（内容撑开）时会退化——**强制 QA 告警**，建议父改 FIXED / FILL 或根容器加 `min-height: 100vh`。

**典型场景**：底部品宣（`end-img-pinxuan`）在设备高度大于设计稿基准时贴屏底；两栏按钮组"取消 / 确认"分居左右（`[btn-cancel, end-btn-confirm]` 父 `HORIZONTAL`）；卡片头右侧"更多 >"链接（`[title, end-more]` 父 `HORIZONTAL`）。

### 9. 页面根容器 `min-height: max(..., 100vh)`（v0.3.3 新增）

**位置**：主 SKILL §4.1.1 §A 表 FIXED 行例外 + §4.3 判定优先级第 6 条 + §6.0 checklist 第 9 项。

**痛点**：D2C 默认把 Figma 顶层 Frame 的高度死值（例如 812 × 2 = 1624px）翻译成 `min-height: 1624px`。设备视口 >1624px 时，页面底下露白（项目全局兜底色）；`end-` 前缀的贴屏底效果也失效（只贴到 1624 那个死高度的底部,不是屏幕底部）。

**判定"页面根容器"3 信号 AND**（缺一不成立）：

| 信号 | 内容 | 用途 |
|------|------|------|
| A | 该节点是主 agent `fetchNode` 入口 nodeId 本身（不是子孙） | 排除 sub-agent 派发进来的内层 block |
| B | 父在 Figma REST 里查不到 或 父 `type` 是 `PAGE`/`DOCUMENT`/`CANVAS` | 排除嵌套在其他 Frame 里的次级容器 |
| C | `absoluteBoundingBox.height` ≈ 视口常见值（667/736/812/844/896/926/932/1024，±20 容差） | 排除长图页面（例如 375×2000） / 卡片子模块 |

**命中后覆写**：

```scss
.root {
  /* 保留 1-5 判定产出的 CSS(flex/gap/padding/align-items) */
  min-height: max({figmaH * scale}px, 100vh);   /* 至少设计稿高度,长屏撑到 100vh */
  width: {figmaW * scale}px;                    /* 宽度死值保留 */
  margin: 0 auto;
  position: relative;                           /* 若已存在保留 */
}
.root__bg {                                     /* 根内部 layoutPositioning:ABSOLUTE 的 bg- 层 */
  position: absolute;
  inset: 0;                                     /* 覆写 top:0 left:0 width/height:{死值} */
  background-size: cover;                       /* 从 {w}px {h}px 改成 cover */
  background-position: top center;
}
```

**为什么放在判定优先级第 6 条（覆写位而不是分支）**：本条不改变 1-5 对根容器**内部结构**的判定（是 flex 还是 flex、padding 还是 padding），只覆写高度和背景。所以先走完 1-5 拿到基础 CSS，再叠加本条覆写。

**与 `end-` 的联动**：`end-` 想真正贴屏底，必须依赖根容器能撑到 `100vh`；否则 `space-between` 只把 end- 推到 1624px 的底部而不是屏幕底部。两条规则组合起来才能做到"长屏时 end- 贴屏底"。

**豁免场景**（3 信号任一不成立时走普通 FIXED 规则，不覆写）：
- Sub-agent 单独处理某个 block 时（信号 A 命中但 C 因高度不匹配排除）
- URL 直接指向非根子节点（例如 `?node-id=163-2302` 指向 `sub-cardopen`，信号 C 排除）
- 长图页面（例如 375×2000，信号 C 排除，死值 `min-height: 4000px` 是正确的）

### 10. `input-` 输入框（v0.3.4 新增）

**位置**：主 SKILL §`input-` 输入框规则（§4.3 end- 章节后） + doctor §3.6f-i NAM017/018/019/020。

`input-` 是**独立前缀**（决定生成什么元素,不是修饰）。命中即输出 `<input type="text">` 标签,**不再向内递归**（子层 TEXT/vector 都被消化用于填 placeholder/icon）。可与 `fixed-`/`end-`/`sub-` 叠加,**不可**与 `bg-`/`bgc-`/`x-`（NAM019 error）或 `img-`/`btn-`（NAM020 error）叠加。

**Figma 侧图层结构约定**：

```
input-{name}              ← Frame,自身 fills(输入框底色) + strokes + cornerRadius
  ├─ [vector | RECT | 子 Frame]   ← 可选,左侧图标
  └─ TEXT "请输入..."              ← 必须,characters 是 placeholder 文本,fills 是 placeholder 颜色
```

**生成机制**：
- `<input type="text" placeholder="{TEXT.characters}" />`（单标签,无 wrapper）
- 输入框视觉从 `input-` 节点自身 fills/strokes/cornerRadius 读
- 左侧图标切图作 `background-image` + `padding-left` 腾位置(不生成独立 DOM)
- `::placeholder` 颜色取自 TEXT 子的 `fills[0]`
- 字体从 TEXT 子的 `style` 读

**doctor 校验**：
- **NAM017**（error）:input- 内无 TEXT 子层 → placeholder 无来源
- **NAM018**（warn）:input- 内 ≥2 个 TEXT → 只取第一个,其他忽略
- **NAM019**（error）:input- 与 bg-/bgc-/x- 叠加 → 不生成节点无法挂
- **NAM020**（error）:input- 与 img-/btn- 叠加 → 语义冲突,需拆父子结构

**类型限定**：v0.3.4 只支持 `<input type="text">`。密码/数字/邮箱等特殊 type 由 agent 输出 QA 告警提示手工改,不自动推断。多行输入(`textarea`)、下拉选择(`select`)本版不覆盖,后续按需扩 `layers.textarea` / `layers.select`。

**典型场景**：登录表单(手机号/密码)、订单填写(乘车人姓名/身份证/备注)、搜索框、评论框。

## 视觉验收机制（截图对比）

步骤 6 视觉验收有**两条截图链路**，工具化程度不同：

- **设计稿侧（脚本化）**：`bin/figma.mjs screenshot <fileKey> <nodeId> --tag=leaf|block|whole [--scale=2]` 调 Figma REST `/v1/images` 导出**设计稿节点**的 PNG，落 `.d2c-tmp/screenshots/`（不入 `.d2c-cache/`），SKILL 结束由 `cleanup-tmp` 统一 `rm -rf`。三档 tag：`leaf`（§6.0 逐叶子 block）/ `block`（§4.8 sub-agent 自验）/ `whole`（§6.1 整页）。这是视觉对比的**真值来源**。
- **产物侧（软要求，无工具支撑）**：§6.0 第 2 步要求「在浏览器或 dev-server 中定位渲染出的 DOM 区域，截图相同区域」，再与设计稿并排比对（尺寸 / 颜色 ΔE≤3 / 字号字重 / 位置）。产物截图**如何获得无任何规定**——无无头浏览器（puppeteer / playwright / headless）、无 dev-server 启动脚本、无自动截图与 diff 工具（全仓 SKILL + bin 无相关实现）。

**薄弱点**：产物侧截图依赖 agent 手动操作，缺工具支撑时易被"脑补"跳过，是 §6.0 视觉对比不可靠的根因。要把该环节从软要求变为可机器执行，需补「无头浏览器自动截产物图 + 与设计稿 diff」能力，方向与 v1.2 对账「质量从 agent 自觉搬到工具」一致。

## 工具链注意事项（install.js / config 完整性）

**install.js `runInit()` 写 config 时必须包含完整字段**（v0.2 修订）。历史 bug：`runInit()` 只写了 project / figma / merge / unit / images / output 六大段，**漏了 layers / health / images.preserveEffectIds**，导致用户项目 config 缺关键字段。

修复后 `runInit()` 写默认字段时采用 **spread merge** 模式 `{ ...默认值, ...(existing.X || {}) }`（v0.2.1 改自原"`existing.X || 默认`"短路写法）：

- `images.preserveEffectIds`：默认 `[]`（所有图严格按 bbox 导出）
- `layers`：完整 11 类前缀（sub/block/img/bg/bgColor/font/but/scrollX/scrollY/fixed/ignore）
- `health`：enabled=true / blockOnError=true / report 段 / thresholds 全套

**升级老项目**：spread merge 让 re-init 自动补缺失字段（典型场景：老项目 layers 块没有 `fixed`，re-init 时会自动补上 `fixed: "fixed-"`），同时**用户已自定义的字段保持不变**（spread 顺序"默认在前 + 现有在后"覆盖默认值）。

> **为什么改写法**：原 `existing.layers || 默认` 是**整体短路**——只要老项目有 `layers` 块（哪怕缺 `fixed`），就完全跳过默认值，导致新加的字段补不上去。spread merge 是**字段级 merge**，加新前缀字段后 re-init 即可平滑升级所有历史项目，无需用户手改 config。

**Config 完整性自检脚本**（出问题时排查用）：

```bash
# 检查项目 config 是否含 health 段、preserveEffectIds、scrollX/fixed 前缀
cat pp-d2c.config.json | grep -E "health\.enabled|images\.preserveEffectIds|layers\.scrollX|layers\.fixed"
```

缺任何一个 → re-init 或手动补段。**老项目 `layers.fixed` 缺失最常见**（v0.2.1 才加），重跑一次 `install.js runInit()` 会自动补上。

## 配置项要点（详见 SKILL.md §0）

| 字段 | 用途 | 备注 |
|------|------|------|
| `figma.token` | REST API 鉴权 | 缺失/过期触发 L1 兜底 |
| `images.assetsDir` / `images.imageBaseUrl` | 图片 URL 拼接 | 三段字面拼接铁律，禁止补/删字符（§510-545） |
| `images.preserveEffectIds` | 例外清单 | 仅当某张图就是要烤 effect 进 PNG 时使用 |
| `health.enabled` / `health.blockOnError` | 是否在 §0.5 调用 doctor + 是否阻塞 | doctor 内部见 [[pp-doctor]] |
| `unit.figmaBase` / `unit.outputBase` / `unit.scale` | 尺寸换算 | 设计稿 → 输出代码必经路径 |
| `layers.*` | 11 类前缀（sub/block/img/bg/bgc/font/btn/x/scrollx/scrolly/**fixed**） | 多前缀组合解析见 §398-438；**fixed- 是修饰前缀**，可叠加

## 边界与禁止（高频踩坑）

- **不递归类前缀**：`img-` / `bg-` / `bgc-` / `x-` 命中即"整体导出 / 忽略",**不再向内递归**(§412-413 / §705)。子孙节点不会被生成代码——doctor 已落地这条作为"形态/容器"类规则的全局过滤标 `inNonRecursiveSubtree`
- **scroll 互斥**:`scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存禁止(§448 / §718);同节点 `scrollx + scrolly` 共存也禁止
- **sub- 单独拆 + 允许嵌套**(v0.2 修订):哪怕只有 1 个 `sub-` 节点也必须分发独立 sub-agent(§108 / §717),分块是质量保证而非性能优化;**sub- 允许嵌套**(典型场景:`sub-content / sub-card + sub-scrolly-车票列表`),深度上限 3 层,执行走"主 agent 派发 + sub-agent 上报 + placeholder 展开"链路(§107-145 / §4.0.5 / §5.0)
- **block- 不嵌套**:`block-` 是"顶层独立布局块"(§409),doctor NAM001 fix 已修订为只建议 `sub-`,不再建议 `block-`
- **fixed- 是修饰前缀**:可与 `sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-` 叠加(只改 `position: fixed`,不改渲染方式);**不可**与 `bg-`/`bgc-`/`x-` 叠加(这三个不生成节点,fixed 无处可挂——doctor NAM014 error);top/bottom 必须读 Figma constraints 推断,不是直接读坐标;祖先链有 transform/filter/blur 时 fixed 退化为相对祖先定位(doctor LAY013 warn)
- **end- 是修饰前缀(v0.3.2 新增)**:表达"贴父末端",方向由父 `layoutMode` 决定(VERTICAL→贴底 / HORIZONTAL→贴右);可与 `sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-` 叠加,**不可**与 `bg-`/`bgc-`/`x-` 叠加(doctor NAM016 error);唯一实现路径是 wrapper + `justify-content: space-between`;必须是父的最后一个可见子(LAY017 error)且父必须是 autoLayout(LAY019 error);与 fixed- 同现时 fixed- 优先(LAY020 warn)
- **页面根容器 min-height: max(..., 100vh)(v0.3.3 新增)**:3 信号 AND 判定(入口 nodeId + 父是 Page/Document + 高度接近视口),命中后覆写根 CSS min-height 为 `max({figmaH*scale}px, 100vh)`,内部 `layoutPositioning: ABSOLUTE` 的 bg- 层同步改 `height: 100%` + `background-size: cover`;不改动根内部结构判定(1-5 优先级已产出的 flex/gap/padding 保留);解决设备视口 >1624px 时页面底下露白 + end- 无法真正贴屏底的问题
- **input- 是独立前缀(v0.3.4 新增)**:生成 `<input type="text" placeholder=... />` 单标签(不包 wrapper),placeholder 取子 TEXT 节点 characters,左侧图标切图作 CSS background-image + padding-left(不生成独立 DOM);可叠加 fixed-/end-/sub-,**不可**叠加 bg-/bgc-/x-(NAM019 error) 或 img-/btn-(NAM020 error);子层无 TEXT 报 NAM017 error,多 TEXT 报 NAM018 warn;命中即停止向内递归;当前只覆盖 `<input type="text">`,textarea/select/密码/数字等 type 由 agent 输出 QA 告警提示手工改
- **页面级背景必须探测项目特征**:`*.module.{scss,less,css}` 里直接写 `body { ... }` 会被 hash 化失效;普通 stylesheet（非 module 的 scss/less/css）里写 `:global(...)` 不识别。详见 §2.5(强制不可跳过)。**v0.2.1 新增**：install.js 把样式方案拆成两题（`[2a]` 样式方式 + `[2b]` 预处理语法 + `[2c]` 是否走 module），styleFormat 取值扩展到 `scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline / RN 三选`，详见主 SKILL §0「样式方案标识符」

## 已知历史 bug 与修订（v0.2）

| 现象 | 根因 | 修订位置 |
|------|------|---------|
| 切出来的图都带紫色画板背景 | `/v1/images` 默认导出包含父 fills | §487-501 加 `use_absolute_bounds=true` |
| `bg-list.png` 把行程项内容都印进背景 | sub-agent 把 `sub-scrolly-` 整体导出 | §463-470 自检 4 行 + §728 禁止项 |
| `ticketCard` 设计稿 -25px gap 必须写 -50px 才贴合 | effect 外扩让 PNG 比 bbox 大一圈 | 同 #1，`use_absolute_bounds=true` 一并解决 |
| token 过期生成失败 / 用临时链接占位上线 24h 后 404 | 旧约定"跳过下载" | §4.4.1 新增 L0→L3 兜底链 |
| `card-bg.png` 把 bg-bg + bgc-选中框 揉成一张图，4px Outside 描边丢失 | bgc- 嵌在 bg- 子树内，旧 bgc- 规则只取 fills 丢 strokes/cornerRadius/effects | §`bgc-` 取值规则扩展 + §`bg-` 内嵌 `bgc-` 的处理 + doctor NAM004 扩展覆盖 bgc- + doctor NAM013 新增 |
| `bg-box.png` 切图带紫色"画板底色"假象 | bg-box 是简单 GRADIENT + DROP_SHADOW，应改 bgc- 用 CSS 实现，但被切成位图 | §`bg-` 切图前的"CSS-able 自检" + doctor NAM012 新增 |
| 用户项目 config 缺 health / layers / preserveEffectIds 段，跑 SKILL 时靠默认值兜底 | install.js `runInit()` 写 config 时漏写这三段 | install.js 修复 + 业务项目 config patch |
| `doctor.run({...})` 函数找不到，agent 等待返回值卡死 | 误把 SKILL.md 里的伪代码当真函数调用 | 主 SKILL 顶部加「执行模型说明」总纲 + doctor §5.4 / §6 改写自然语言 |
| 设计稿里有"吸顶/吸底/悬浮"语义但没有对应前缀，AI 全部生成 `position: absolute` 跟随滚动 | layer 前缀体系缺"视口固定定位"语义 | 新增 `fixed-` 修饰前缀（SKILL §`fixed-` 定位规则 + doctor NAM014/LAY013 + design-guide.md 同步） |
| init 第 2 题「样式方案」单选 `scss/css-modules/tailwind/inline`，less 项目无法表达；"scss + module" 也勾不出来 | 两个独立维度（预处理语法 / 是否走 module）压到一个单选里 | install.js 拆成 [2a] 样式方式 + [2b] 预处理语法 + [2c] 是否走 module；styleFormat 扩展到 8 种值；SKILL §0 加「样式方案标识符」表，§2.5 探测分支泛化到 scss/less/css，§4.6 框架适配表补全 |
| init 第二阶段所有题目都显示「沿用现有配置」，但项目里其实没 config 文件 | `runInit()` 先调 `installFiles(true)` 把 templates 模板复制过去，再读 existing，读到的是 templates 默认值 | `runInit()` 调换顺序：先读 existing → 再 `installFiles(true, true)`（init 模式不复制 templates config 模板） |
| MCP 没装时 Claude 跑半套流程才回退报错；原 §步骤 -1 只区分"成功 / 失败"两态，分不清「未装 / 未认证 / 无权限」 | 探针太粗（只描述"尝试调用 MCP 工具"）+ install.js 阶段一假装"检测"实际只打印说明 | SKILL §步骤 -1 改为调 `whoami` 最便宜探针，按错误类型精准分 4 态（未装 / 未认证 / 无权限 / 业务错误），每种给独立提示文案；install.js 阶段一改名「安装提示」并明示无法验证 |

## 不在本 topic 覆盖的内容

- doctor 的体检规则、报告格式、阈值 → 见 [[pp-doctor]]
- 通用 D2C 设计意图（如何写图层名 / Auto Layout 怎么用） → 见 `docs/design-guide.md`
- 项目级配置示例（`pp-d2c.config.json` 全字段） → 见 SKILL.md §0
- `templates/pp-d2c.config.json` 模板源 → 见 `templates/` 目录
