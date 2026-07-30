# ctrip-train-d2c-doctor Skill

> D2C 设计稿健康检测：在生成代码前对 Figma 设计稿做体检，提前暴露命名、布局、结构、资产层面的问题。
>
> 完整规则定义见 `docs/d2c-health-check-spec.md`。本文件为可执行步骤。

## 触发条件

- 用户提供 Figma 设计稿 URL 并说：「体检一下」「健康检测」「检查设计稿」「跑个 d2c 体检」「看看这个稿能不能还原」
- 直接 `$ctrip-train-d2c-doctor`
- 被 `ctrip-train-d2c` 主 SKILL 在步骤 0 之后以集成模式调用

> **执行模型重申**：SKILL.md 是自然语言操作手册，不是代码。"被主 SKILL 调用"实际是**同一个 agent 顺序读两份 SKILL.md 并按步骤执行**——没有真正的函数调用、跨进程通信。"集成模式 return JSON"指的是当前 agent 在对话里输出 §5.4 描述的 JSON 摘要，主 SKILL 后续步骤自己读这段输出继续推进。完整说明见主 SKILL 顶部「执行模型说明」。

---

## 执行流程

### 步骤 -1（前置预检）：检测 Figma MCP 可用性

在任何操作前执行，不可跳过。

| 结果 | 处理 |
|------|------|
| Figma MCP 调用成功 | 继续步骤 0 |
| 工具不存在 / 调用失败 | 输出失败提示并终止 |

**失败时输出**：
```
Figma MCP 未就绪，请先在 Claude Code 中安装 Figma 官方插件并完成认证后再重试。
```

---

### 步骤 0：读取配置

```
Read("ctrip-train-d2c.config.json")
```

读取并缓存以下字段（缺省时使用括号内默认值）：

| 字段 | 默认值 | 用途 |
|------|--------|------|
| `layers.sub` | `sub-` | 分块前缀 |
| `layers.block` | `block-` | 独立块前缀 |
| `layers.img` | `img-` | 图片前缀 |
| `layers.bg` | `bg-` | 背景图前缀 |
| `layers.bgColor` | `bgc-` | 背景色前缀 |
| `layers.font` | `font-` | 文字前缀 |
| `layers.but` | `btn-` | 按钮前缀 |
| `layers.fixed` | `fixed-` | 视口固定定位前缀（修饰） |
| `layers.end` | `end-` | 逆向布局前缀（贴父末端，修饰） |
| `layers.ignore` | `x-` | 忽略前缀 |
| `health.enabled` | `true` | 总开关，false 时直接退出 |
| `health.blockOnError` | `true` | 集成模式下 error 是否阻塞生成 |
| `health.report.markdown` | `true` | 是否输出 `.d2c-health-{slug}-{timestamp}.md`（同时刷新 `.d2c-health-latest.md`） |
| `health.report.json` | `true` | 是否输出 `.d2c-health-{slug}-{timestamp}.json`（同时刷新 `.d2c-health-latest.json`） |
| `health.report.dir` | `output.dir` | 报告输出目录（命名规则见步骤 5.1） |
| `health.thresholds.maxDepth` | `6` | STR001 嵌套深度上限 |
| `health.thresholds.subBlockMin` | `3` | NAM009 sub- 内最少子层 |
| `health.thresholds.subBlockMax` | `20` | FEA004 sub- 块最多数量 |
| `health.thresholds.totalNodesMax` | `1500` | FEA003 节点总数上限 |
| `health.thresholds.hiddenRatioMax` | `0.2` | NAM010 隐藏图层占比上限 |
| `health.thresholds.paddingAsymmetryMax` | `32` | LAY003 padding 不对称阈值 |
| `health.thresholds.bgSizeMin` | `0.8` | AST002 bg- 尺寸下限比例 |
| `health.thresholds.bgSizeMax` | `1.2` | AST003 bg- 尺寸上限比例 |
| `health.rules` | `{}` | 规则等级覆盖表 |

**`health.enabled === false` 时**：直接输出 `设计稿健康检测已禁用 (health.enabled=false)`，终止流程。

---

### 步骤 1：解析参数

#### 独立模式（用户直接调用）

从用户输入的 Figma URL 提取：
- `fileKey`：URL 中 `/design/` 后的路径段
- `nodeId`：`node-id=` 参数值，将 `-` 替换为 `:`

设置 `mode = 'standalone'`。

#### 集成模式（被主 SKILL 调用）

调用方传入 `{ fileKey, nodeId, config, mode: 'integrated' }`。

---

### 步骤 2：扫描图层结构

> 设计原则：把"一次性同步拉全树"拆成 **2.0 进度提示 → 2.1 拉取 → 2.2 规模快检 → 2.3 属性打标** 四个子步骤。每步前输出一行可见进度，**避免外部表现为"长时间无响应"**；规模阈值判断必须紧跟在 2.1 返回之后，先于任何遍历。

#### 步骤 2.0：宣告即将进入网络调用

在调用 `get_metadata` 之前，**必须**在对话里输出（仅独立模式输出；集成模式由主 SKILL 自行决定提示形式）：

```
📥 正在拉取图层树（子树越大耗时越长，预计 5s ~ 2min）...
   · 若超过 2 分钟仍无响应，请按 ESC 中断，并改选更小的 nodeId 后重试
   · 常见原因：选中了整页（page）或一个包含多张设计稿的大容器
```

> **不可省略**：这是用户能区分"程序卡死 / 程序在干活"的唯一信号。

#### 步骤 2.1：拉取图层树

调用 `get_metadata(fileKey, nodeId)` 获取目标节点的完整子孙图层树。

**调用失败时**：直接输出错误信息并终止 doctor 流程，**不重试**（避免叠加等待）：

```
⛔ 拉取图层树失败：{原始错误信息}
   · 请确认 fileKey / nodeId 正确，且当前账号对该设计稿有访问权限
```

#### 步骤 2.2：规模快检（先于任何遍历）

`get_metadata` 返回后**第一件事**：仅统计 `节点总数 nodeCount` 与 `最大深度 depthMax`，不打任何标。

输出可见进度：

```
📊 图层树拉取完成：{nodeCount} 个节点（最大深度 {depthMax}）
```

**立即按规模分流**：

| 条件 | 处理 |
|------|------|
| `nodeCount > 5000` | **终止**：输出 `图层数过多 ({nodeCount} > 5000)，建议拆分设计稿后再体检：在 Figma 里挑一个具体的需求 frame，重新复制带 node-id 的链接` 并退出，**不进入步骤 2.3** |
| `nodeCount > 1500` | 记录 `oversizeWarning = true`，继续 2.3；后续在步骤 3 命中 FEA003（仍按原规则） |
| 其他 | 直接进入 2.3 |

#### 步骤 2.3：属性打标

**遍历整棵树，给每个节点打上以下属性，存入扫描上下文 `ctx`**：

| 属性 | 来源 |
|------|------|
| `id` | 节点 id |
| `name` | 节点 name |
| `type` | 节点 type（FRAME/GROUP/TEXT/VECTOR/COMPONENT/INSTANCE/...） |
| `visible` | 节点 visible（默认 true） |
| `parentId` | 父节点 id |
| `path` | 从根节点到当前节点的 name 链 |
| `depth` | 路径深度（根=0） |
| `bbox` | `{ x, y, width, height }` |
| `prefixes` | 从 `name` 中识别出的所有已知前缀（多前缀组合，按 SKILL 主流程规则） |
| `nameClean` | 去掉所有已知前缀后的剩余名 |
| `autoLayout` | `{ mode, padding, itemSpacing }`，无 AL 时为 null |
| `rotation` | 旋转角度 |
| `childCount` | 子节点数 |

**前缀识别**：从 `name` 左到右扫描，提取所有匹配 `layers.*` 配置值的前缀；前缀之间允许有 `-` 连接。如：
- `sub-img-qa` → `[sub, img]`，nameClean = `qa`
- `sub-btn-img-banner` → `[sub, btn, img]`，nameClean = `banner`
- `fixed-btn-back-top` → `[fixed, btn]`，nameClean = `back-top`
- `end-img-pinxuan` → `[end, img]`，nameClean = `pinxuan`（v0.3.2 新增 end- 修饰前缀）

**额外打一个标：`inNonRecursiveSubtree`**（布尔，在打标完成后第二轮算，O(n)）：

主 SKILL 约定 `img-` / `bg-` / `bgc-` / `x-` 命中即"整体导出 / 忽略，**不再向内递归**"——这些前缀节点**本身**仍然受所有规则约束，但它们的**子孙节点**因为不会被生成代码，对这些子孙报"容器无前缀 / 缺 Auto Layout / 嵌套过深 / 子层重叠"等问题是无意义的（让设计师改一个永远不会被读到的图层）。

判定规则：

```
inNonRecursiveSubtree(node) =
  存在祖先节点 a（不含 node 自身），a.prefixes 含 'img' / 'bg' / 'bgc' / 'x' 中任一
```

> 注意：**不**包含 `sub-` 和 `btn-`。
> - `sub-` 内部仍然要继续解析（sub-agent 要生成代码）
> - `btn-` 仅"包一层可点击区域"，内部仍按其他前缀继续解析

打标完成后输出可见进度：

```
🏷  属性打标完成，进入规则扫描
```

> **节点数阈值之所以放在 2.2**：避免大稿用户必须等"打标 + 规则扫描"全部跑完才被告知"图层数过多"。原 SKILL 把阈值判断埋在打标之后，等于让用户多等一次无意义的 CPU 消耗。

---

### 步骤 3：执行规则检查

按以下顺序逐条扫描，命中即向 `issues[]` 追加一条。每条 issue 结构：

```
{
  id: 'NAM001',
  level: 'error' | 'warn' | 'info',
  nodeId, nodeName, nodePath,
  problem: '...',          // 客观事实，描述"出了什么"
  consequence: '...',       // 不修会怎样
  fix: '...',               // 怎么修
  figmaUrl: 'https://figma.com/design/{fileKey}/?node-id={nodeId 替换 : 为 -}'
}
```

> **写作约束**：`problem` 只描述事实（"X 节点没有前缀"），`fix` 只给动作（"加 sub-"），`consequence` 给后果（"AI 会拍平到上一级"）。**禁止**把建议、事实、后果混写在 `problem` 字段里。

**等级取值优先级**：`config.health.rules[ruleId]` > 本文档默认值。`'off'` 时跳过该规则。

**全局过滤（先于所有规则执行）**：

对每个候选节点，在执行任何规则前先判断：

| 节点条件 | 处理 |
|---------|------|
| `inNonRecursiveSubtree === true` 且节点本身**不**带 `img-` / `bg-` / `bgc-` / `x-` 前缀 | **整批跳过**所有"形态/容器"类规则（NAM001 / NAM002 / LAY001 / LAY009 / STR001 / STR002 / AST002）。这些子孙不会被生成代码，问题报了也是无效噪音 |
| `inNonRecursiveSubtree === true` 且节点本身**带** `img-` / `bg-` / `bgc-` / `x-` 前缀 | 仍照常执行所有规则（嵌套的 `bg-` / `img-` 等本身就是 NAM004 / NAM003 要捕获的问题） |
| 其他 | 照常执行所有规则 |

> **聚合提示**：报告生成时统计"被自动忽略的子孙节点数"，在每条相关规则下方注明：`> 已自动忽略 N 项位于 img-/bg-/bgc-/x- 不递归子树内的命中`，让设计师知道 doctor 没有视而不见，只是按主 SKILL 的递归规则做了过滤。

> **资产/导出类规则不在此列**：AST004（应导出但内容为空）即使在不递归子树内也要报——子树为空会导致**导出图本身**是空白，是有效问题。

#### 3.0 规则元信息表（决定报告里每条规则的"谁来修 / 多紧迫"）

| 规则 ID | 角色 | 修复成本 | 忽略后果（一句话） |
|---|---|---|---|
| NAM001 | 👤 设计师 | 低（5 分钟改图层名） | AI 无法识别独立模块，生成出来的 JSX 会拍平嵌套，少 sub-agent 拆分 |
| NAM002 | 👤 设计师 | 低（改拼写） | 前缀不被识别，按"无前缀"处理 |
| NAM003 | 👤 设计师 | 低（删一个前缀） | 多前缀冲突时按优先级裁掉，行为可能违反设计意图 |
| NAM004 | 👤 设计师 | 低（合并/改名） | 同父级多个 bg- 或 bgc- 时只保留第一个，其余被丢弃（CSS 父元素只能有一个 background-image 和一个 background-color） |
| NAM005 | 👤 设计师 | 低（重命名） | 资产文件名冲突，后导出的图覆盖前一张 |
| NAM008 | 👤 设计师 | 中（拍平一层 sub-） | sub- 嵌套深度 ≥ 3，主 agent 派发链路变长，通常可以去掉一层 |
| NAM012 | 👤 设计师 | 低（改一个字母 b→bc） | bg- 但视觉可 CSS 表达，切位图会 banding / effect 外扩 / 文件冗余；改 bgc- 用 CSS 实现更优 |
| NAM013 | 👤 设计师 | 低（移到 bg- 兄弟位置） | bgc- 嵌在 bg- 子树内，视觉会被位图化；移到 bg- 的同级位置才能正确挂到父元素 CSS |
| NAM014 | 👤 设计师 | 低（拆分前缀 / 移位） | fixed- 叠加在 bg-/bgc-/x- 上，没有节点可挂，定位失效 |
| NAM016 | 👤 设计师 | 低（拆分前缀 / 移位） | end- 叠加在 bg-/bgc-/x- 上，没有节点可挂，逆向布局失效 |
| LAY001 | 👤 设计师 | 中（启用 Auto Layout） | AI 靠坐标推断方向，间距/对齐易偏 |
| LAY002 | 👤 设计师 | 低（padding 改非负） | 生成代码 padding 错乱 |
| LAY009 | 👤 设计师 | 中（拆分叠层 / 改前缀） | AI 分不清叠层顺序，常猜错谁在上 |
| LAY010 | 👤 设计师 | 低（加 fill）/ 可忽略 | 顶层无背景，整屏由项目兜底色（通常是白底） |
| LAY011 | 👤 设计师 | 低（固定宽/高） | scroll 容器宽/高不固定，运行时滚动不触发 |
| LAY012 | 👤 设计师 | 低（删一个方向） | 双向滚动冲突，生成代码 scrolly 失效 |
| LAY013 | 👤 设计师 | 中（移位 / 去除祖先 transform） | fixed- 祖先链含 transform/filter/blur，CSS 规范下 fixed 退化为相对祖先定位，跟着祖先滚动 |
| LAY017 | 👤 设计师 | 低（移到末位 / 去前缀） | end- 不在父末位，wrapper + space-between 机制无法生成 |
| LAY018 | 👤 设计师 | 低（保留末位 end-） | 多个 end- 只有末位生效，其他被视为普通前缀 |
| LAY019 | 👤 设计师 | 低（父开 auto-layout） | end- 的父不是 auto-layout，无方向可判 |
| LAY020 | 👤 设计师 | 低（二选一） | end- 与 fixed- 同现，fixed- 优先，end- 忽略 |
| STR001 | 👤 设计师 | 中（拍平 wrapper） | 生成的 DOM 多余嵌套，调试不便（不影响视觉） |
| STR002 | 👤 设计师 | 低（删壳） | 同上 |
| AST002 | 👤 设计师 | 低（调 bg- 尺寸） | bg- 露白，背景图未铺满父容器 |
| AST004 | 👤 设计师 | 低（删空节点） | 导出空白图，视觉缺失 |
| FEA002 | 👤 设计师 | 高（恢复可见图层） | 生成完全失败 |
| FEA003 | 🤝 共同 | 中（拆稿 / 调整范围） | 生成耗时和出错率高 |

**角色含义**：
- 👤 **设计师**：必须由设计师在 Figma 中改图层 / 调结构，开发改不了
- 👨‍💻 **开发**：开发侧自行处理（如调整 config）
- 🤝 **共同**：双方协商决定如何处理

**修复成本**：低 = 5 分钟内 / 中 = 半小时内 / 高 = 需要重新设计

#### 3.1 NAM001 容器无前缀（默认 warn）

- 节点 `type` ∈ {FRAME, GROUP, COMPONENT, INSTANCE}
- 子节点（仅可见）数 ≥ 2
- `prefixes` 不含任何已知前缀
- 且当前节点的祖先链上**没有**任何 `sub-` 前缀节点（避免 sub- 内部一级容器误报）
- **`inNonRecursiveSubtree === false`**（由步骤 3 全局过滤兜底，此处仅冗余声明，便于单条阅读）
- **父节点不是 `scrollx-` / `scrolly-` 列表容器**（即父 `prefixes` 不含 `'scrollx'` / `'scrolly'`，**或**父的可见子节点数 = 1 时仍报）。理由见下方"为什么要排除 scroll- 列表项"

→ message: `容器无 sub- 前缀，AI 无法识别为独立模块`
→ fix: `加 sub- 前缀（不要加 block-，block- 是顶层独立块，嵌套使用没有语义）`

> **为什么要排除 `scroll-` 列表项**：`scrollx-` / `scrolly-` 容器的直接子节点天然是**同构列表项**（典型场景：车票列表、推荐位、横向卡片流）。它们被 `.map()` 渲染，每一项加 `sub-` = N 个 sub-agent 重复干同一件事。如果列表项需要差异化，把它们做成 Figma Component/Instance，doctor 不会报；如果只有一个子节点（不是列表，是 wrapper），NAM001 仍然会报。
>
> **为什么 fix 不再建议 `block-`**：`block-` 是"顶层独立布局块"（主 SKILL §409），表示"和其他块完全独立、命名空间隔离"。容器内部继续嵌 `block-` 没有定义过的语义，应该只用 `sub-`。

#### 3.2 NAM002 前缀拼写错误（默认 error）

逐节点扫描 `name`，匹配以下任一变体（大小写不敏感、含下划线/全角短横/多余空格）：

```
^(?:bg|img|font|btn|sub|block|bgc|x|scrollx|scrolly)[ _—–]
^(?:Bg|BG|Img|IMG|Font|FONT|Btn|BTN|Sub|SUB|Block|BLOCK|Bgc|BGC|X|ScrollX|SCROLLX|Scrollx|ScrollY|SCROLLY|Scrolly)-
```

**额外补丁**（覆盖 scroll 前缀的常见拼写错位）：

| 错误形式 | 应该的形式 |
|---------|----------|
| `scroll-x-` / `scroll_x-` / `scroll x-` | `scrollx-` |
| `scroll-y-` / `scroll_y-` / `scroll y-` | `scrolly-` |
| `Scroll-X-` / `Scroll-Y-` 等含 `-`/`_`/空格 的大小写变体 | 同上小写连字符形式 |

且该 name 不已经命中标准前缀。→ message: `前缀拼写不规范：{matched}`
→ fix: `改为标准小写连字符前缀（bg-/img-/font-/btn-/sub-/block-/bgc-/x-/scrollx-/scrolly-）`

#### 3.3 NAM003 前缀语义冲突(默认 error)

`prefixes` 命中以下任一组合即报错。**冲突表**与主 SKILL `templates/skills/ctrip-train-d2c/SKILL.md` §428-432 / §448 / §712 完全对齐:

| 冲突组合 | 根因(来自主 SKILL) |
|---------|--------|
| `img` + `bg` | 一个生成 `<img>`、一个写父级 `background-image`,互斥 |
| `img` + `font` | 一个整体导出图、一个生成文字节点,互斥 |
| `x` + 任意其他前缀 | `x-` 直接跳过,其他前缀全部失效,组合无意义 |
| `scrollx` + `img` / `bg` / `bgc` / `x` / `btn` | scroll 容器不能是图片 / 背景 / 忽略节点 / 可点击区域(主 SKILL §448 / §712 禁止) |
| `scrolly` + `img` / `bg` / `bgc` / `x` / `btn` | 同上 |
| `scrollx` + `scrolly` | 一个元素只能一个滚动方向(主 SKILL §447 / §712),由 LAY012 单独覆盖;NAM003 此处只标"前缀冲突",等级与 LAY012 保持一致 |
| `fixed` + `bg` / `bgc` / `x` | `fixed-` 需要"挂在节点上"才能生效;`bg-` / `bgc-` 不生成节点(写父元素 CSS),`x-` 跳过整层。由 NAM014 单独覆盖(error);NAM003 此处只标"前缀冲突",等级与 NAM014 保持一致 |
| `end` + `bg` / `bgc` / `x` | `end-` 需要"挂在节点上"才能生效(生成 wrapper + space-between 结构);`bg-` / `bgc-` 不生成节点,`x-` 跳过整层。由 NAM016 单独覆盖(error);NAM003 此处只标"前缀冲突",等级与 NAM016 保持一致 |
| `fixed` + `end` | 两个修饰前缀同现,`fixed-` 让节点脱离父流走 position:fixed,`end-` 的"贴父末端"语义无法叠加。由 LAY020 单独覆盖(warn);生成时 fixed- 优先,end- 前缀被忽略 |

> **`bg` + `bgc` 不冲突**(v0.2 修订):两者写的是父级 CSS 的不同属性(`background-image` vs `background-color`),可以共存。同一父级同时有 `bg-` 和 `bgc-` 子节点是合法设计——分别贡献父级背景图和背景色。

→ message: `前缀语义冲突:{冲突的前缀对}`
→ fix: `参考主 SKILL 组合优先级,二选一;scroll 容器内部用单独子节点表达图片/背景/可点击区域`

#### 3.4 NAM004 bg- / bgc- 唯一性违反（默认 error，v0.2 扩展覆盖 bgc-）

按父节点分组，统计每个父节点下：
- 含 `bg` 前缀的可见子节点数（不含 `bgc`）
- 含 `bgc` 前缀的可见子节点数

任一类型 > 1 时，对**第二个及以后**的同类节点逐一报错。

> **CSS 物理限制**：一个父元素只能有一个 `background-image` 和一个 `background-color`/`background: gradient`。同父级 ≥ 2 个 `bg-` 或 ≥ 2 个 `bgc-` 都会让生成端必须丢弃多余的，行为不可预期。

→ message: `同父级下出现多个 {bg/bgc}- 子层（{count} 个），CSS 父元素只能有一个 background-image 和一个 background-color，按规则将忽略本节点`
→ fix: `仅保留一个 {bg-/bgc-}，其他改名（如 img- 用 <img> 表达 / 拆到不同父容器 / 移除冗余装饰）`

#### 3.5 NAM005 同级重名（默认 warn）

按父节点分组，统计每个父节点下子节点的 `nameClean.toLowerCase()`。同名出现 ≥ 2 次时，对**第二个及以后**报警告。

→ message: `同级重名：{nameClean}，资产文件名将冲突`
→ fix: `加业务后缀区分（如 hero-top / hero-bottom）`

#### 3.6 NAM008 sub- 嵌套深度过深（默认 warn，原"sub- 嵌套 sub- error"已废弃）

> **v0.2 修订**：sub- 嵌套 sub- 不再禁止——主 SKILL §107-145 已支持嵌套场景（外层 `sub-content` 含内层 `sub-card` + `sub-scrolly-车票列表` 是合法且推荐的设计模式）。本规则改为只在嵌套**过深**时告警。

- 节点 `prefixes` 含 `sub`
- 祖先链上已有 ≥ 2 个 `sub-` 节点（即当前节点的 sub- 深度 ≥ 3）

→ problem: `sub- 嵌套深度 {depth}（当前节点 + 祖先 sub- 链 = {depth} 层），超过推荐上限 3 层`
→ consequence: `深嵌套会让主 agent 派发链路变长，合并阶段 placeholder 展开成本高；通常意味着可以拍平一层（外层 sub- 拆细 / 内层 sub- 上提）`
→ fix: `检查嵌套是否必要：若外层 sub- 仅是"分组容器"无独立模块语义，去掉外层 sub-；若内层独立模块完全可以平到外层，去掉内层 sub-`

#### 3.6b NAM012 bg- 应改为 bgc-（默认 warn，v0.2 新增）

> **目的**：识别"命名为 `bg-` 但视觉属性其实可以用 CSS 完全表达"的节点，提示设计师改成 `bgc-` 以避免位图渲染（banding / effect 外扩 / 文件冗余）。

判定条件（**全部满足**才命中）：

- 节点 `prefixes` 含 `bg`
- 节点 `fills` 全部 ∈ `{SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL}`，且不含 `IMAGE` 类型
- 节点 `strokes` 为空 或 全部是 SOLID 类型
- 节点 `effects` 为空 或 只有单一 `DROP_SHADOW`（INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR 都让节点 CSS-unable，不命中）
- 节点子树内**没有可见子节点**（boolean-operation / vector / 子 frame 都是空，或全部隐藏）

→ problem: `bg- 节点 {nodeName} 的视觉属性（fills/strokes/effects）可以用 CSS 完全表达，无需切位图`
→ consequence: `位图渲染的渐变会因缩放产生 banding（视觉劣化）；含 effects 时切出来的 PNG 边缘会"沾染"画板底色泄漏的视觉假象（实际是渐变浅色端 + 描边在圆角处的混合）；位图无法运行时主题切换`
→ fix: `把图层名从 bg-{name} 改为 bgc-{name}。生成端会自动取 fills 写 background-color/background-image:linear-gradient(...)，strokes 写 border，effects 写 box-shadow，cornerRadius 写 border-radius，不再切图`

> **配套兜底**：即使设计师没改，主 SKILL 的"`bg-` 切图前 CSS-able 自检"也会在生成时跳过切图、用 CSS 实现。但仍建议在设计稿层面修正命名——那是最干净的做法。

#### 3.6c NAM013 bgc- 嵌在 bg- 子树内（默认 warn，v0.2 新增）

> **目的**：识别"`bgc-` 节点错误地嵌在 `bg-` 子树内"的结构问题，提示设计师改成兄弟关系。

判定条件：

- 当前节点 `prefixes` 含 `bgc`
- 祖先链上存在 `prefixes` 含 `bg`（不含 `bgc`）的节点

**为什么是错误结构**：

- bgc- 写父元素 CSS 的盒级属性（background-color / outline / box-shadow / border-radius），需要直接挂在父元素的同级位置才能"自然映射到父元素"
- 嵌在 bg- 子树内意味着 bgc- 的视觉会被 bg- 整体切图位图化（无法用 CSS 单独控制 / 主题切换 / 选中态切换）
- 即使生成端兜底"摘出来"按 bgc- 规则处理（详见主 SKILL §`bg-` 内嵌 `bgc-` 的处理），位图里仍有 bgc- 的视觉副本——CSS 生效但视觉重复，不影响最终视觉但浪费切图体积

→ problem: `bgc-{name} 嵌在 bg-{ancestor name} 子树内（祖先链：{path}），结构不规范`
→ consequence: `bgc- 视觉会被 bg- 整体切图位图化，CSS 端兜底处理也无法消除位图里的视觉副本（切图体积浪费 + 主题切换时 CSS 改了但位图不变）`
→ fix: `在 Figma 中把 bgc-{name} 移出 bg-{ancestor name} 子树，作为 bg- 的兄弟节点（同级位置），让 bgc- 直接挂在 bg- 的父元素下`

> **生成端兜底**：即使设计师不改，主 SKILL §`bg-` 内嵌 `bgc-` 的处理 会把 bgc- "摘出来"按 bgc- 规则写父元素 CSS，并强制输出告警。bg- 子树外（兄弟）也有 bgc- 时，按"兄弟优先"取兄弟那个。

#### 3.6d NAM014 fixed- 与不生成节点的前缀叠加（默认 error，v0.2 新增）

> **目的**：识别 `fixed-` 错误地叠加在 `bg-` / `bgc-` / `x-` 上的命名，提示设计师拆分。

判定条件：

- 节点 `prefixes` 含 `fixed`
- 同节点 `prefixes` 还含 `bg` 或 `bgc` 或 `x`

**为什么是错误结构**：

- `fixed-` 通过给生成的 HTML 节点加 `position: fixed` 起作用，需要"有节点"才能生效
- `bg-` / `bgc-` 不生成独立 HTML 节点（写到父元素 CSS），`fixed-` 落不到节点上
- `x-` 跳过整层，`fixed-` 直接随之失效
- 如果设计师想做"固定位置的背景"，应该把 `fixed-` 加在父节点上，而不是叠到 `bg-` / `bgc-` 上

→ problem: `fixed- 与 {bg/bgc/x}- 叠加在同一节点（{nodeName}），fixed 无法挂载到不生成节点的前缀`
→ consequence: `生成端忽略 fixed-；位图/装饰仍按父元素 CSS 表达，无法定位到视口`
→ fix: `如需"固定位置的背景"：把 fixed- 移到父节点（父节点变成 fixed-Container），bg-/bgc- 保留为子节点。如需"固定的可点击/可滚动区域"：fixed-btn-/fixed-sub-/fixed-scrolly- 都合法`

#### 3.6e NAM016 end- 与不生成节点的前缀叠加（默认 error，v0.3.2 新增）

> **目的**：识别 `end-` 错误地叠加在 `bg-` / `bgc-` / `x-` 上的命名，与 NAM014（fixed- 同类问题）逻辑一致。

判定条件：

- 节点 `prefixes` 含 `end`
- 同节点 `prefixes` 还含 `bg` 或 `bgc` 或 `x`

**为什么是错误结构**：

- `end-` 通过在生成的 DOM 结构里"包 wrapper + `justify-content: space-between`"起作用，需要"有节点"才能生效
- `bg-` / `bgc-` 不生成独立 HTML 节点（写到父元素 CSS），`end-` 落不到节点上
- `x-` 跳过整层，`end-` 直接随之失效
- 如果设计师想做"贴底的背景"，应该把 `end-` 加在父节点上，或者让 `bg-` 保持在父容器上通过 `background-position: bottom` 表达

→ problem: `end- 与 {bg/bgc/x}- 叠加在同一节点（{nodeName}），end 无法挂载到不生成节点的前缀`
→ consequence: `生成端忽略 end-；位图/装饰仍按父元素 CSS 表达，无法通过 wrapper + space-between 表达"贴末端"`
→ fix: `如需"贴底的背景图"：改用 CSS background-position: bottom，或把 end- 移到父节点上。如需"贴底的独立元素"：end-btn-/end-img-/end-sub- 都合法（这些前缀生成节点）`

#### 3.7 LAY001 容器缺 Auto Layout（默认 warn）

- 节点 `type === 'FRAME'`
- `autoLayout` 为 null
- 可见子节点数 ≥ 2
- 且子节点 bbox 不在严格的同行/同列（行：所有 y 重叠区 > 50%；列：所有 x 重叠区 > 50%）

→ message: `容器未启用 Auto Layout，子层位置需靠坐标推断方向`
→ fix: `在 Figma 中对该 Frame 启用 Auto Layout`

#### 3.8 LAY002 AL padding 含负值（默认 error）

- `autoLayout` 非 null
- `autoLayout.padding` 任一方向值 < 0

→ message: `Auto Layout padding 含负值: {方向}={值}`
→ fix: `padding 改为 ≥ 0`

#### 3.9 LAY009 绝对定位嫌疑（默认 warn）

- 节点 `type === 'FRAME'` 或 `'GROUP'`
- 可见子节点数 ≥ 2
- 子节点之间存在 bbox 重叠（重叠面积 > 任一参与方面积的 10%）
- **`inNonRecursiveSubtree === false`**（已由步骤 3 全局过滤兜底；自身带 `img-` / `bg-` / `bgc-` / `x-` 的不算"嫌疑"，是设计意图）

→ message: `子元素 bbox 重叠，可能用了绝对定位思路`
→ fix: `改用 Auto Layout 的 absoluteBoundingBox 或拆分为独立 sub-`

#### 3.9b LAY010 顶层 frame 背景缺失（默认 info）

- 节点 = 检查目标根节点（用户传入的 nodeId）
- `fills` 为空 / 全透明 / `backgroundColor` 缺失

→ message: `顶层 frame 没有任何背景色或背景图，整屏页面背景将由项目全局样式（base.scss 等）兜底`
→ fix: `若设计意图就是用项目兜底色，可忽略；否则在 Figma 中给顶层 frame 加 fill`

> **配套提醒**（不在规则清单里，是主流程行为）：当顶层 frame **有**背景色/图时，主 SKILL 会按"步骤 2.5 页面级背景采集"将其写入 body，doctor 不重复报告。

#### 3.9c LAY011 scroll 容器尺寸不固定（默认 warn）

> **命名约定**：`prefixes` 数组里存放的是从图层 `name` 提取的**小写前缀字符串**（`'scrollx'` / `'scrolly'`），不是 config 字段名（`layers.scrollX` / `layers.scrollY`）。下面所有规则的判断都以 `prefixes` 内容（小写）为准。

- 节点 `prefixes` 含 `'scrollx'` 或 `'scrolly'`
- 滚动方向上的尺寸不固定：
  - `'scrollx'`：宽度模式 = "Hug Contents" 或 fill 100% 父宽（且祖先链上没有任何节点是固定宽度）
  - `'scrolly'`：高度模式 = "Hug Contents" 或 fill 100% 父高（且祖先链上没有任何节点是固定高度）

→ problem: `scroll{x|y}- 容器在滚动方向上没有固定尺寸`
→ consequence: `运行时浏览器不会触发 overflow，滚动不生效`
→ fix: `在 Figma 中把容器对应方向的尺寸改为固定值；或确保父容器有限宽/限高`

#### 3.9d LAY012 scroll 方向冲突（默认 error）

- 节点 `prefixes` 同时含 `'scrollx'` 和 `'scrolly'`

→ problem: `同一节点同时含 scrollx- 和 scrolly-`
→ consequence: `生成代码按 scrollx- 处理，scrolly- 失效；运行时滚动行为不可预期`
→ fix: `在 Figma 中只保留一个滚动方向；如确实需要二维滚动，请拆成两层嵌套（外层 scrolly + 内层 scrollx）`

#### 3.9e LAY013 fixed- 祖先链含 transform（默认 warn，v0.2 新增）

> **目的**：识别 `fixed-` 节点的祖先链上有可能让 `position: fixed` 退化为"相对祖先定位"的 CSS 属性来源。

判定条件（**任一满足**即命中）：

- 节点 `prefixes` 含 `fixed`
- 祖先链上存在节点带以下属性（按以下顺序优先级判断）：
  - Figma `effects` 含 `LAYER_BLUR` / `BACKGROUND_BLUR`（生成端转 `filter: blur()` / `backdrop-filter: blur()`，触发 fixed 退化）
  - 祖先节点本身也是 `bgc-` 且取到的 effects 含 `LAYER_BLUR`（同上）
  - 祖先节点带可能让生成端写 `transform` 的特征：rotation ≠ 0（生成 `transform: rotate(...)`）/ scale ≠ 1（生成 `transform: scale(...)`）

**为什么命中也只是 warn**：

- CSS 规范里祖先有 `transform` / `filter` / `perspective` 时，`position: fixed` 退化为"相对该祖先定位"。运行时表现是"fixed 节点跟着祖先滚动 / 不相对视口"
- 但 D2C 大多数场景祖先链不会有这些属性（设计稿少用 rotation/blur），所以是 warn 不是 error
- 生成端**不自动用 Portal 外挂**（重量级 + 跨组件副作用），由设计师/开发把 fixed- 节点上提到根 frame 或祖先去掉 transform

→ problem: `fixed- 节点 {nodeName} 的祖先链上存在 transform/filter 来源（祖先：{ancestorName} → {属性}）`
→ consequence: `运行时 position: fixed 退化为相对该祖先定位，fixed- 节点会跟着祖先滚动，不再贴视口`
→ fix: `推荐：把 fixed- 节点在 Figma 中上提到顶层 frame 的直接子节点（避开有 transform/filter 的祖先）。次选：去掉祖先节点的 rotation / scale / blur 效果。如果业务场景必须保留祖先效果，开发端需要手动加 React Portal 把 fixed- 节点挂到 document.body`

#### 3.9f LAY017 end- 位置不在父末端（默认 error，v0.3.2 新增）

> **目的**：`end-` 语义是"贴父容器末端"，只在**父的最后一个可见子**位置才有意义；出现在中间或第一个属于命名错误。

判定条件：

- 节点 `prefixes` 含 `end`
- 节点在父的 `children` 数组中，**过滤掉不可见子节点后**，索引 ≠ 末位

→ problem: `end- 节点 {nodeName} 不是父容器 {parentName} 的最后一个可见子（当前位置 {i+1}/{总可见数}）`
→ consequence: `end- 主线机制"wrapper + space-between"只有在末位子才能正确表达贴父末端；位置不合规时无法生成有效代码，会退化`
→ fix: `在 Figma 中把该节点移动到父容器的最后位置，或者去掉 end- 前缀（如果本意不是贴末端）`

#### 3.9g LAY018 同父下多个 end- 子（默认 warn，v0.3.2 新增）

> **目的**：`end-` 主线机制"wrapper + `justify-content: space-between`"只能表达"一组前 vs 一个末尾"的两端布局；多个 end- 无法叠加语义。

判定条件：

- 父节点的可见子里 `prefixes` 含 `end` 的数量 ≥ 2

→ problem: `父节点 {parentName} 下有 {n} 个 end- 子（{childNames.join(", ")}）`
→ consequence: `只有最后一个 end- 生效走 wrapper + space-between，其他 end- 被视为普通节点忽略前缀`
→ fix: `保留末位那个 end-，前面的 end- 改成普通命名；如果确需多点分布，重新用 Figma auto-layout 的 primaryAxisAlignItems 或拆父容器解决`

#### 3.9h LAY019 end- 的父不是 autoLayout（默认 error，v0.3.2 新增）

> **目的**：`end-` 方向由父 `layoutMode` 决定；父不是 autoLayout 时无方向可判。

判定条件：

- 节点 `prefixes` 含 `end`
- 父节点 `autoLayout` 为 null（即父 `layoutMode` 缺失 / `NONE`）

→ problem: `end- 节点 {nodeName} 的父容器 {parentName} 不是 autoLayout，end- 无方向可判`
→ consequence: `无法确定该子应贴底还是贴右，主线机制 wrapper + space-between 无法生成`
→ fix: `在 Figma 中给父容器开启 auto layout（Shift+A），选择 vertical（贴底）或 horizontal（贴右）；或者去掉子节点的 end- 前缀改用其他布局手段`

#### 3.9i LAY020 end- 与 fixed- 同现（默认 warn，v0.3.2 新增）

> **目的**：`fixed-` 已经让节点脱离父流相对视口定位，`end-` 的"贴父末端"语义在 fixed 状态下无法叠加。

判定条件：

- 节点 `prefixes` 同时含 `fixed` 和 `end`

→ problem: `节点 {nodeName} 同时带 fixed- 和 end- 修饰前缀`
→ consequence: `fixed- 让该节点脱离父流走 position: fixed，end- 的父末端语义此时无意义；生成时 fixed- 优先，end- 前缀被忽略`
→ fix: `二选一：如果本意是相对视口贴底/贴右，保留 fixed- + 在 Figma 中设 constraints: BOTTOM/RIGHT；如果本意是相对父容器贴末端，去掉 fixed- 保留 end-`

#### 3.10 STR001 嵌套深度过深（默认 warn）

`depth > config.health.thresholds.maxDepth`（默认 6）。每条命中路径仅在**最深叶子节点**报一次。

→ message: `节点嵌套深度 {depth} 超过阈值 {maxDepth}`
→ fix: `拍平不必要的 wrapper`

#### 3.11 STR002 单子嵌套（默认 info）

- 节点 `type === 'FRAME'`
- 可见子节点数 = 1
- 唯一子节点 `type === 'FRAME'`
- 当前节点无 fills / strokes / cornerRadius / effects（外观属性）

→ message: `仅含一个子 Frame 且自身无样式，等于多套了一层壳`
→ fix: `删除外层 Frame 或将子内容上提`

#### 3.12 AST002 bg- 尺寸 ≠ 父尺寸（默认 warn）

- 节点 `prefixes` 含 `bg`
- 父节点存在
- `width / parent.width < bgSizeMin` 或 `height / parent.height < bgSizeMin`（默认 0.8）

→ message: `bg- 节点 {w}x{h} 小于父容器 {pw}x{ph} 的 80%，背景可能露白`
→ fix: `将 bg- 节点尺寸调整为撑满父容器`

#### 3.13 AST004 应导出但内容为空（默认 error）

- 节点 `prefixes` 含 `img` 或 `bg`
- 子树内无任何可见的栅格/矢量/文本/形状内容（即所有后代均为空 FRAME 或不可见）

→ message: `{img/bg}- 节点子树为空，导出图片将是空白`
→ fix: `删除该节点或补充内容`

#### 3.14 FEA002 全是隐藏图层（默认 error）

目标根节点子树内可见图层数 = 0。

→ message: `目标节点子树没有任何可见图层`
→ fix: `检查目标 nodeId 是否正确，或恢复必要图层的可见性`

> 命中 FEA002 时直接终止后续规则扫描，跳到步骤 4。

#### 3.15 FEA003 单稿图层数过多（默认 warn）

子树节点总数 > `config.health.thresholds.totalNodesMax`（默认 1500）。

→ message: `图层数 {n} 超过阈值 {max}，生成耗时和出错率会升高`
→ fix: `用 sub- 拆分为多个独立块，或精简设计稿层级`

---

### 步骤 4：计算覆盖率与评分

#### 4.1 覆盖率（独立展示）

```
namedPrefixCoverage = 含任一前缀的可见非 TEXT 节点 / (可见节点数 - 可见 TEXT 节点数)
autoLayoutCoverage  = autoLayout 非 null 的 FRAME / (子层 ≥ 2 的 FRAME 数)
depthAvg / depthMax = 路径深度均值 / 最大值（仅可见节点）
hiddenRatio         = visible:false 节点数 / 总节点数
```

> Token 引用率（STY 系列）首期不实现，置为 `null`。

#### 4.2 维度得分

每个维度初始 100 分，按命中规则的等级扣分：
- error: -10
- warn:  -3
- info:  -1

下限为 0。规则归属维度：

| 维度 | 包含规则 ID 前缀 | 权重 |
|---|---|---|
| NAM | NAM* | 30% |
| LAY | LAY* | 25% |
| STR | STR* | 15% |
| STY | STY* | 10% |（首期空，得 100） |
| AST | AST* | 10% |
| FEA | FEA* | 10% |（任一 error → 0 分） |

#### 4.3 总分与等级

```
total = sum(dimensionScore[d] * weight[d])
```

| 总分 | 等级 |
|---|---|
| ≥ 90 | A |
| 75-89 | B |
| 60-74 | C |
| < 60 | D |
| FEA 一票否决（任一 FEA error） | F |

#### 4.4 阻塞判定

```
passed = (grade !== 'F') && !(any error issue && config.health.blockOnError === false ? false : grade !== 'F')

# 简化：
passed = (grade !== 'F')
```

集成模式下，调用方根据 `health.blockOnError` 决定是否在 grade=F 时终止。

---

### 步骤 5：输出报告

#### 5.1 独立模式（standalone）

写入两个文件（依据 `health.report.markdown` / `health.report.json`）：

- `{health.report.dir}/.d2c-health-{slug}-{timestamp}.md`
- `{health.report.dir}/.d2c-health-{slug}-{timestamp}.json`

并同时维护一个**指向最近一次报告的软链/复制**（始终覆盖，方便用户/集成方读"最新"）：

- `{health.report.dir}/.d2c-health-latest.md`
- `{health.report.dir}/.d2c-health-latest.json`

> 不能用环境内置的 symlink 时（Windows / 工具不支持），改为**复制覆盖**同名文件。

**字段约定**：

| 字段 | 取值 | 说明 |
|------|------|------|
| `{slug}` | `nodeId` 把 `:` 替换为 `-`；超过 32 字符截断后追加 `-` 和 nodeId 的 8 位 hash 前缀 | 区分同一项目下的不同设计稿 |
| `{timestamp}` | 本地时间 `YYYYMMDD-HHmmss`（如 `20260618-143052`） | 区分同一稿的多次体检 |
| `{health.report.dir}` | 默认 = `output.dir` | 报告输出目录 |

**为什么不用固定文件名**：同一项目内会对多张稿、或同一张稿在改图前后多次体检，固定 `.d2c-health.md` 会被后一次覆盖、丢失对比信息。带 `slug + timestamp` 既保证不冲突，又让 `ls` 排序天然按时间倒序。`-latest` 只是指针，不参与归档。

**示例**（`nodeId = 1234:5678`、`output.dir = ./out`）：

```
out/
├── .d2c-health-1234-5678-20260618-143052.md
├── .d2c-health-1234-5678-20260618-143052.json
├── .d2c-health-1234-5678-20260618-150811.md         ← 同稿第二次体检
├── .d2c-health-1234-5678-20260618-150811.json
├── .d2c-health-9876-5432-20260618-160230.md         ← 另一张稿
├── .d2c-health-9876-5432-20260618-160230.json
├── .d2c-health-latest.md                             ← 指向最近一次
└── .d2c-health-latest.json
```

**清理建议（不在 doctor 里做）**：建议在 `.gitignore` 添加 `.d2c-health-*.md` / `.d2c-health-*.json`（这俩报告不应该入库）。

#### 5.2 报告写作总则（强制）

1. **每条规则下方表格的每一列都要明确目的**，列名用人话不用术语：
   - ❌ `path 末段`、`bbox`、`overflow`
   - ✅ `图层位置`、`所在路径`、`重叠面积`
2. **同一规则的所有命中合并到一张表里**，不要把"事实 + 建议 + 后果"塞进一个 `message` 列；分别用 `问题` / `修复` 两列展示。
3. **表格上方加一段 `📌 这是什么 / ⚠️ 不修会怎样 / 🛠 谁来修` 三行小卡片**，让读者 5 秒内决定要不要看下面的表。
4. **超过 5 行的表格折叠**：用 `<details>` 包起来，标题写"查看 N 个命中详情"。
5. **末尾分两个待办清单**：`👤 设计师待办` 和 `👨‍💻 开发待办`，按规则元信息表的角色字段聚合。
6. **NAM001 等"形态/容器"类规则**：自动剔除"位于 `img-` / `bg-` / `bgc-` / `x-` 不递归子树内的子孙节点"的命中（这些子孙不会被生成代码）。剔除后单列说明：`> 已自动忽略 N 项位于不递归子树（img-/bg-/bgc-/x-）内的命中`。

#### 5.3 报告 Markdown 模板

````markdown
# D2C 设计稿健康度报告

- 设计稿：{rootName}（{fileKey} / {nodeId}）
- 检测时间：{ISO 时间}
- 总分：**{total} / 100** （{grade} 级 · {gradeDesc}）
- 是否阻塞生成：{passed ? '✅ 不阻塞，可继续生成' : '⛔ 阻塞，请先处理 error'}

---

## 一句话结论

{自动生成的一句话，例如：
- 「整体良好（B 级），有 N 项设计稿命名建议优化，开发侧无需操作。」
- 「阻塞（F 级），FEA002 命中，目标节点子树没有任何可见图层。」
}

---

## 维度得分

| 维度 | 得分 | 权重 | 🔴 error | 🟡 warn | 🔵 info |
|---|---|---|---|---|---|
| 命名规范 (NAM) | {NAM.score} | 30% | {n} | {n} | {n} |
| 布局合理性 (LAY) | {LAY.score} | 25% | {n} | {n} | {n} |
| 结构合理性 (STR) | {STR.score} | 15% | {n} | {n} | {n} |
| 样式一致性 (STY) | {STY.score} | 10% | {n} | {n} | {n} |
| 资产可导性 (AST) | {AST.score} | 10% | {n} | {n} | {n} |
| 生成可行性 (FEA) | {FEA.score} | 10% | {n} | {n} | {n} |

## 覆盖率（仅供参考，不参与扣分）

- 命名前缀覆盖率：{namedPrefixCoverage * 100}%（{命中前缀的节点数} / {可计入分母的节点数}）
- Auto Layout 覆盖率：{autoLayoutCoverage * 100}%
- 嵌套深度：平均 {depthAvg} / 最大 {depthMax}
- 隐藏图层占比：{hiddenRatio * 100}%

---

## 问题清单

> 每条规则按"是什么 / 不修后果 / 谁来修"三栏说明；表格列只放可执行信息。

### 🔴 错误（必须修复，{errorCount} 项）

{若 errorCount === 0：输出 "无。"}

{对每个命中规则输出一段：}

#### {ruleId} {ruleName}（{命中数} 项）

> 📌 **是什么**：{一句话定义此规则}
> ⚠️ **不修会怎样**：{规则元信息表的"忽略后果"}
> 🛠 **谁来修**：{角色 emoji} {角色名}（修复成本：{cost}）

| 图层名 | Figma ID | 所在路径 | 问题 | 修复 |
|---|---|---|---|---|
| {nodeName} | `{nodeId}` | {abbreviatedPath} | {problem} | {fix} |

> {若有"不递归子树自动忽略"的}：已自动忽略 {N} 项位于 `img-` / `bg-` / `bgc-` / `x-` 不递归子树内的命中（这些子孙节点本来就不会生成代码）

{若超过 5 行 → 用 <details> 包前 5 行之后的部分}

### 🟡 警告（建议修复，{warnCount} 项）

{同上结构}

### 🔵 信息（可选优化，{infoCount} 项）

{同上结构}

---

## 待办清单

### 👤 设计师待办（请在 Figma 中处理后重跑体检）

{聚合所有角色 = 👤 设计师 的命中，按规则分组，给一个最小可执行清单：}

- **{ruleId}**：{命中数} 项 → {一句话动作}（详见上方表格）
  - 重点：{Top 3 nodeName}

> ⏱ 预估总耗时：{累加各规则修复成本}

### 👨‍💻 开发待办

{若有开发侧动作（一般是 FEA003 的"调整 config"或 grade=F 的"暂缓生成"），列在此处；否则输出："无，等设计稿处理完后重跑体检即可。"}

---

## 是否可继续生成

{passed ? '✅' : '⛔'} **{passed ? '可以' : '不建议'}继续生成**（grade = {grade}）

{若 passed && warn > 0：'⚠️ 但建议至少处理「设计师待办」中的 Top 3 后再生成，否则生成质量会下降。'}
{若 !passed：'⛔ 必须先处理 error 项，否则 ctrip-train-d2c 主流程将拒绝执行。'}
````

#### 5.4 集成模式（integrated）

集成模式下不写文件（避免污染 output 目录）。"return"在这里**不是函数返回**——SKILL.md 里没有真函数。实际行为是：**当前正在执行 doctor 流程的 agent，在对话里输出下面这段 JSON 字符串作为体检摘要**，主 SKILL 后续步骤（§0.5 决策表）从同一个对话上下文读这段 JSON 继续推进：

```jsonc
{
  "passed": true,                  // grade !== 'F'
  "score": {
    "total": 85,
    "grade": "B",
    "dimensions": { /* NAM/LAY/STR/STY/AST/FEA */ },
    "coverage": { /* namedPrefixCoverage / autoLayoutCoverage / depthAvg / depthMax / hiddenRatio */ }
  },
  "issues": [
    {
      "id": "NAM001",
      "level": "warn",                                                    // error / warn / info
      "nodeId": "69:1846",
      "nodeName": "编组",
      "nodePath": "/.../scrolly-车票列表/编组",
      "problem": "...",                                                   // 客观事实
      "consequence": "...",                                               // 不修会怎样
      "fix": "...",                                                       // 怎么修
      "figmaUrl": "https://figma.com/design/{fileKey}/?node-id=69-1846"
    }
    // ...
  ],
  "summary": { "error": 0, "warn": 5, "info": 2 },
  "todoByRole": {
    "designer": [ /* 设计师待办（聚合后的精简清单）*/ ],
    "developer": [ /* 开发待办 */ ]
  }
}
```

> **不要尝试调用 `return X` 风格的语句**——这是 SKILL.md 描述输出契约的伪代码语法，不是 JavaScript。实际执行时，把这段 JSON 当文本写在对话里就够了。

#### 5.5 对话内摘要（两种模式都打印）

```
🩺 D2C 设计稿体检完成

  总分：{total} / 100  ({grade} 级)
  问题：🔴 {error} · 🟡 {warn} · 🔵 {info}
  阻塞：{passed ? '否，可继续生成' : '是，请先处理 error'}

  待办：
   👤 设计师：{N} 项（预估 {耗时}）
   👨‍💻 开发：{若无 → '无'；若有 → 列出'}

  Top 3 问题（按重要度）：
   1. [{id}] {problem}（{nodeName}）→ {fix}
   2. ...
   3. ...

  详细报告：{health.report.dir}/.d2c-health-{slug}-{timestamp}.md
            （或始终读最新：{health.report.dir}/.d2c-health-latest.md）
```


---

## 步骤 6：输出体检摘要给主 SKILL（仅集成模式）

集成模式下，doctor 流程到这一步要做的事：**当前 agent 在对话里输出 §5.4 描述的 JSON 摘要**。主 SKILL 的下一步（§0.5 决策表）会从同一对话上下文读这段 JSON 继续推进，不存在跨进程"return"。

> 独立模式（standalone）不走这一步——独立模式按 §5.1 / §5.3 写磁盘 .md / .json 文件 + 在对话里打印 §5.5 摘要即可。

---

## 步骤 2 卡住排查清单

doctor 在外部表现"长时间无响应"时，**99% 卡在步骤 2.1**（`get_metadata` 同步拉全树）。Figma MCP 没有 depth/limit 参数，无法做真正的"浅扫"，只能从输入侧规避。按下面顺序自查：

| 现象 | 多半原因 | 怎么办 |
|------|---------|--------|
| 输出"📥 正在拉取..."后超过 1min 无新输出 | nodeId 选中了整页（page）或包含多张稿的大容器 | 在 Figma 里点一个**具体需求 frame**，右键 → Copy link to selection 重新拿 URL 重试 |
| 同一稿之前能跑、现在卡住 | Figma 服务端波动 / 网络抖动 | 等 30s 重试一次；仍失败按 ESC 中断后换更小的 nodeId |
| 输出"📊 图层树拉取完成：N 个节点"后立刻终止 | 命中 `nodeCount > 5000` 硬上限 | 按提示拆稿；或在主 SKILL 里**只**对某个 sub- 子节点单独跑 doctor |
| 步骤 -1 就失败 | Figma MCP 未装 / 未认证 | 按步骤 -1 失败提示安装并认证 |
| 步骤 2.3 长时间不返回（已看到 "📊 图层树拉取完成"） | 极少见，理论上属性打标不会卡 | 中断后把 fileKey + nodeId 反馈给维护者 |

---

## 禁止项

- 禁止调用 Figma REST API 导出图片（doctor 是只读分析，不下载资产）
- 禁止修改设计稿（只读）
- 禁止跳过步骤 -1 的 MCP 预检
- 禁止扫描超过 5000 节点的子树（性能保护）
- 禁止把 issue 的 nodeId 写成 `-` 形式（统一用 `:`，仅 figmaUrl 字段做转换）
- 禁止在 `health.enabled === false` 时仍然执行检查
- 禁止在集成模式下写文件（避免污染 output 目录）

---

## 与主 SKILL 的协议

> **重申**：主 SKILL 与 doctor 之间没有真正的函数调用——只有同一个 agent 顺序读两份 SKILL.md 并执行步骤。下面"输入/输出"是描述**信息流约定**：主 SKILL 在 §0.5 准备好哪些上下文（即"输入"），doctor 流程结束时在对话里输出哪些字段（即"输出"），主 SKILL 后续步骤再读取继续推进。

集成调用约定：

| 字段 | 类型 | 说明 |
|------|------|------|
| 输入 `fileKey` | string | 必填，由主 SKILL §1 解析得到 |
| 输入 `nodeId` | string | 必填，`:` 形式（主 SKILL §1 已经把 URL 里的 `-` 转成 `:`）|
| 输入 `config` | object | 完整 ctrip-train-d2c.config.json，主 SKILL §0 已读取 |
| 输入 `mode` | `'integrated'` | 当前 agent 进入 doctor 流程时**自我设定**的执行约束:不写磁盘文件、最后输出 JSON 摘要 |
| 输出 `passed` | boolean | grade !== 'F' |
| 输出 `score` | object | 见步骤 4 |
| 输出 `issues` | array | 见步骤 3 |
| 输出 `summary` | object | `{ error, warn, info }` |
| 输出 `todoByRole` | object | `{ designer, developer }`，见步骤 5.4 |

主 SKILL §0.5 在读到这份 JSON 摘要后:
- `passed === false && config.health.blockOnError === true` → 输出阻塞提示，等用户确认是否强制继续
- `passed === true && error === 0 && warn > 0` → 简短提示警告数，继续生成
- `passed === true && error === 0 && warn === 0` → 静默继续生成
