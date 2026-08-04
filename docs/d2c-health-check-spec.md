# D2C 设计稿健康检测 · Spec（草案 v0.1）

> 目的：在 D2C 生成代码**之前**，对 Figma 设计稿做一次自动体检，提前暴露命名、布局、结构、样式、资产等层面的问题。
>
> 对象：所有送入 `pp-d2c` 还原流程的设计稿。
>
> 关系：与 `templates/skills/pp-d2c/SKILL.md` 同源，规则前缀完全沿用 `pp-d2c.config.json` 的 `layers` 段。

---

## 0. 待确认项（先于 spec 主体）

下面三个问题在动工前需要你拍板，spec 后续章节先给推荐方案：

| # | 决策 | 推荐方案 | 备选 |
|---|---|---|---|
| A | 规则范围 | **完整版**（6 个维度共 ~30 条规则），但每条标 P0/P1/P2，**首期只实现 P0**（命名 + AL + 结构核心 ~12 条） | 仅基础版 / 全量首期上 |
| B | 集成方式 | **独立 SKILL，协议向 D2C 主流程兼容**（独立可跑，主流程也能调用并阻塞致命错误） | 仅独立 / 仅集成 |
| C | 阈值与开关 | **全部走 `pp-d2c.config.json` 的 `health` 段**，每条规则三态 `off / warn / error`，阈值可调；规则 ID 写死 | 阈值写死 / 单独 health.config.json |
| D | 报告归档 | **同时输出** `.d2c-health-{slug}-{timestamp}.md`（人读）+ `.d2c-health-{slug}-{timestamp}.json`（机器读，供未来仪表盘），同步刷新 `.d2c-health-latest.*` 指针 | 仅 md / 仅 json |

> 下文按 A=完整版/首期 P0、B=独立可集成、C=config 化、D=md+json 写。如有调整，spec 主体相应章节会改。

---

## 1. 触发与定位

### 1.1 SKILL 名称

`pp-doctor`

理由：跟 `pp-d2c` 同前缀，`doctor` 比 `lint` / `check` 更直观（"体检"），且与 ESLint 风格规则区分（避免误以为是代码 lint）。

### 1.2 触发条件

- 用户提供 Figma 设计稿 URL 并说：
  - 「体检一下」「健康检测」「检查设计稿」「跑个 d2c 体检」「看看这个稿能不能还原」
  - 直接 `$pp-doctor`
- 被 `pp-d2c` 主 SKILL 在步骤 0 之后调用（B 模式集成）

### 1.3 与生成 SKILL 的关系

```
独立调用模式：           集成调用模式：
   用户                     用户
    │                        │
    ▼                        ▼
  doctor                  pp-d2c
    │                       │
    ▼                       ├─ 步骤 -1 MCP 预检
  报告 md+json              ├─ 步骤 0 读 config
                            ├─ 步骤 0.5 调用 doctor ←──┐
                            │   └─ 致命问题 → 终止     │
                            │   └─ 仅警告 → 继续       │  同一份 SKILL，
                            ├─ 步骤 1 解析 URL          │  通过参数区分
                            └─ ...                     │  调用方
                                                       │
                            doctor.run(fileKey,nodeId,
                              { mode: 'integrated' })──┘
```

集成模式下 doctor 不写报告文件（避免污染 output 目录），改为 return JSON 给主 SKILL；主 SKILL 决定是否阻塞 / 是否提示用户。

---

## 2. 执行流程

```
步骤 -1：Figma Token 预检（同主 SKILL,调 `figma.mjs verify-token`）
步骤 0 ：读取 config（含 layers 段 + health 段）
步骤 1 ：解析 URL → fileKey, nodeId
步骤 2 ：扫描图层结构（拆为 4 个子步骤，避免大稿"长时间无响应"）
        2.0 输出可见进度提示
        2.1 调用 `figma.mjs fetch-node` 拉取完整子树
        2.2 规模快检（先于任何遍历，nodeCount > 5000 直接终止）
        2.3 属性打标（visible / autoLayout / paddings / itemSpacing 等）
步骤 3 ：按 health.rules 逐条扫描 → 收集 issues[]
步骤 4 ：评分 → 生成 score
步骤 5 ：输出报告
        - 独立模式：写 `.d2c-health-{slug}-{timestamp}.md` + `.d2c-health-{slug}-{timestamp}.json`（同步刷新 `-latest.*`），并在对话里打印摘要
        - 集成模式：return { score, issues } 给调用方
```

### 2.1 关键 MCP 调用

| 调用 | 用途 |
|---|---|
| `figma.mjs fetch-node <fileKey> <nodeId>` | 主要数据源。返回完整图层树，含 name / visible / type / 位置尺寸 |
| `get_design_context(fileKey, nodeId)` | 仅当 metadata 不足以判定时按需调用（如读取 fills、styles、variables） |
| `get_variable_defs(fileKey, nodeId)` | 用于"颜色/字号 token 化覆盖率"维度（P2） |

> ⚠️ doctor 不调用 REST API 导出图片，不产生临时下载，纯只读分析。

### 2.2 性能边界

- 单次扫描限 1000 个图层节点，超过则**对每个 sub- 块独立扫描**，最后汇总
- 单次执行预计 < 30 秒（不含 MCP 网络延迟）

### 2.3 步骤 2 卡顿与拆分（v0.2 新增）

**现象**：原步骤 2 是"一次性同步拉全树 + 遍历打标 + 后置阈值判断"，超过 2000 节点的稿子在外部表现为"卡住数十秒到几分钟"，且 5000 阈值的提前止损被埋在打标之后才生效。

**对策**（已落地到 `templates/skills/pp-doctor/SKILL.md`）：

1. **步骤 2.0**：进入 `figma.mjs fetch-node` 之前必须输出可见进度提示（`📥 正在拉取图层树 ...`），让用户能区分"程序卡死 / 程序在干活"。
2. **步骤 2.1**：`figma.mjs fetch-node` 不重试，失败直接终止（重试会让用户多等一倍）。
3. **步骤 2.2**：metadata 返回后**第一件事**就是统计 `nodeCount` 与 `depthMax`，按 `> 5000 终止 / > 1500 标记 oversizeWarning / 其他放行` 三档分流，**先于任何打标**。
4. **步骤 2.3**：原有打标逻辑保持不变，只在打标完成后追加一行进度（`🏷  属性打标完成`）。

**为什么不做"先浅扫再全量"**：Figma REST API `/v1/files/:key/nodes` 没有 depth/limit 参数,无法做真正的浅扫;多调用一次 `export-image`(截图)做规模预估反而双倍延迟。从输入侧(用户改选更小的 nodeId)规避是更便宜的解。

**对应排查清单**：见 SKILL.md 末尾"步骤 2 卡住排查清单"。

### 2.4 不递归子树前置过滤（v0.2 修订）

**现象**：原 NAM001 / LAY001 / LAY009 / STR001 等"形态/容器"类规则只显式排除了 `sub-` 祖先，对 `img-` / `bg-` / `bgc-` / `x-` 子树内的子孙节点照报不误。但主 SKILL（`templates/skills/pp-d2c/SKILL.md` §412/429/705）已经明文约定：这四类前缀命中即"整体导出 / 忽略"、**不再向内递归**。给这些子孙报"加 sub-"等于让设计师改一个永远不会被读到的图层。

典型 false positive：`img-kv` 里有个 `step` 容器 → doctor 报"NAM001：建议改 `sub-step`"。这是错的，整个 `img-kv` 子树会作为单张 PNG 导出，里面叫什么都无所谓。

**对策**（已落地到 `templates/skills/pp-doctor/SKILL.md`）：

1. **步骤 2.3**：每个节点新增一个布尔标 `inNonRecursiveSubtree`，定义为"祖先链上存在 `img` / `bg` / `bgc` / `x` 前缀节点"。`sub-` 和 `btn-` 不算（这两类内部仍然要继续解析）。
2. **步骤 3 全局过滤**：执行任何规则前先看这个标。`true` 且节点本身不带不递归前缀 → 整批跳过 NAM001 / NAM002 / LAY001 / LAY009 / STR001 / STR002 / AST002。
3. **保留例外**：AST004（应导出但内容为空）即使在不递归子树内也要报——子树为空会让导出图本身是空白，是有效问题。
4. **报告聚合**：每条相关规则下方注明"已自动忽略 N 项位于不递归子树内的命中"，让设计师知道 doctor 没有视而不见，只是按主 SKILL 递归规则做了过滤。

**为什么用全局标而不是逐条加判断**：每条规则各自写"且不在 X 子树内"容易漏（旧 LAY009 已经只排了 `sub-img-` / `img-`，漏了 `bg-` / `bgc-` / `x-`）。一处定义、全局过滤更不易出错。

### 2.5 NAM001 列表项与 block- 误导修订（v0.2 修订）

**现象 1：`scrolly-车票列表` 内部的 `编组` 被报"加 sub-trip-item"**。但 `scrollx-` / `scrolly-` 容器的直接子节点天然是**同构列表项**（被 `.map()` 渲染），每一项加 `sub-` = N 个 sub-agent 干同一件事。

**现象 2：NAM001 fix 写"加 `sub-` 或 `block-`"**。但 `block-` 是主 SKILL §409 定义的"顶层独立布局块（命名空间隔离）"，没有"嵌套使用"的定义；在 `block-banner` 里再加 `block-` 没有任何语义。

**对策**（已落地到 `templates/skills/pp-doctor/SKILL.md` §3.1）：

1. NAM001 触发条件追加："**父节点不是 `scrollx-` / `scrolly-` 列表容器**"。如果父就是滚动容器、且子节点数 ≥ 2，跳过本规则。如果只有 1 个子节点（不是列表，是 wrapper），仍然报。
2. NAM001 fix 改为"加 `sub-` 前缀"，不再提 `block-`。
3. 报告里在 NAM001 表格上方加一行说明：`> scrolly-/scrollx- 容器内的列表项已自动忽略，列表项请用 Figma Component/Instance 表达差异化`。

**为什么不直接放进 `inNonRecursiveSubtree`**：`scrollx-` / `scrolly-` 子层**仍要生成代码**（主 SKILL §416-417 明确"继续递归子层"），不属于"不递归子树"族。它只是"NAM001 不适用"，不是"所有规则不适用"。所以这是 NAM001 自己的局部排除，不进全局过滤。

### 2.6 NAM/LAY 规则补全（v0.2 修订）

补全 doctor 与主 SKILL（`templates/skills/pp-d2c/SKILL.md`）约定不一致的几条规则：

#### NAM003 冲突表补全

旧规则只列了 `img×bg` / `img×font` / `x×any` 三组冲突，遗漏了：

- **`scrollx`/`scrolly` 与 `img`/`bg`/`bgc`/`x`/`btn` 共存**：主 SKILL §448 / §712 明确禁止
- **`scrollx` + `scrolly` 共存**：与 LAY012 重叠，但 NAM003 也应捕获（前缀冲突视角）

→ 修订后冲突表与主 SKILL §428-432 / §448 / §712 完全对齐。

> **撤回错误判定**：上一版本曾把 `bg×bgc` 也列为冲突,理由是"都写父级 background 没定义先后"——这是错的。`bg-` 写父级 `background-image`、`bgc-` 写父级 `background-color`,**两者是父级 CSS 的不同属性,可以共存**。已从冲突表移除。

#### NAM002 拼写正则补 scroll 前缀

旧正则只覆盖 `bg|img|font|btn|sub|block|bgc|x`，遗漏 `scrollx` / `scrolly`。设计师写成 `Scroll-X-` / `scroll_y-` doctor 抓不到。

→ 修订后正则增加 `scrollx|scrolly` 及其大小写变体；额外补 `scroll-x-` / `scroll_x-` / `scroll x-` 等拼写错位的覆盖。

#### LAY011 / LAY012 字段大小写歧义

旧表述混用了 config 字段名（驼峰 `scrollX`）和图层前缀值（小写连字符 `scrollx-`），易在实现时做错匹配。

→ 修订后明确：`prefixes` 数组里只存**小写前缀字符串**（`'scrollx'` / `'scrolly'`），与 config 字段名（`layers.scrollX`）严格区分。

#### LAY011 / LAY012 补入 spec §3.2 LAY 表

SKILL.md 已实现这两条规则，但 spec §3.2 LAY 表只列到 LAY010，文档与实现脱节。

→ 修订后在 spec §3.2 表格补入 LAY011 / LAY012 条目，并附 scroll 字段命名约定提示。

---

### 2.7 sub- 嵌套 sub- 从禁止改为支持（v0.2 修订）

**现象**：原 NAM008 把 `sub- 嵌套 sub-` 列为 error，强制设计师"仅保留外层或仅保留内层"。但实际项目中存在合法的真嵌套场景：

> 例：`sub-content`（整个内容主区）含两个内层独立模块 `sub-card`（票卡轮播）+ `sub-scrolly-车票列表`（滚动列表）。两个内层异构、各自复杂度都值得独立 agent，展平会让外层 sub-agent 同时处理两类完全不同的实现，违反"每层独立上下文"原则。Component/Instance 也不适用——两个内层不是同构。

**对策**（已落地到主 SKILL `templates/skills/pp-d2c/SKILL.md` §107-145 / §385-455 / §707-820 / 禁止项）：

1. **主 SKILL §107**：明确"sub- 允许嵌套"，描述执行模型：主 agent 派发 + sub-agent 上报，深度上限 3 层
2. **主 SKILL §385**：sub-agent 进入子层解析前**必须** §4.0.5 扫一遍直接子层的 sub-，写 `<__SUBSLOT__>` placeholder + `subslots.json`，自己**不处理**内层 sub- 内容
3. **主 SKILL §707**：合并阶段 §5.0 placeholder 展开（深度优先），component 模式生成嵌套目录，flat 模式按树深度递归展开 JSX
4. **主 SKILL §6.0**：视觉对比改为只对比**叶子 sub-block**（非叶子父 block 由叶子覆盖），避免重复
5. **主 SKILL 禁止项**：禁止 sub-agent 自己派孙、禁止跨层扫描、禁止合并后残留 `__SUBSLOT__`
6. **doctor NAM008**：error → warn，触发条件改为"嵌套深度 ≥ 3"（以前是"任何嵌套即报错"），fix 文案改为"拍平一层"
7. **spec §3.1 NAM008 行**：同步上述修订

**为什么深度上限 3 层而不是无限**：一是嵌套越深主 agent 派发链路越长（串行等待时间累加）；二是真业务场景里 3 层已能覆盖（外层"内容主区" + 中层"独立模块" + 内层"独立子模块"），更深通常是设计师过度组织图层的信号，应该拍平。

**为什么"主 agent 派发 + sub-agent 上报"而不是"sub-agent 自己派孙"**：主 agent 全局清单维护更简单，合并阶段的 placeholder 展开和接缝检查更线性；sub-agent 自己派孙会让主 agent 失去全局视角，合并逻辑复杂度爆炸。串行等待的成本可接受——D2C 不是性能敏感场景。

### 2.8 bg- 应改为 bgc- 识别（v0.2 新增）

**现象**：`bg-box` 节点是个简单 GRADIENT_LINEAR + DROP_SHADOW 的 vector，按规则切成 PNG。但切出来的图四角圆角带 #DCD7FF 紫色"画板底色"——其实是渐变浅色端 + 灰色描边 + 阴影外扩在圆角抗锯齿处的混合，被误读为画板底色泄漏。

**根因**：`bg-` 语义是"切位图作为父元素 background-image"，但**这个节点完全可以用 CSS 表达**（线性渐变 + 阴影 + 圆角全是 CSS 原生支持的）。设计师按"反正都是背景"的直觉用了 `bg-`，没意识到：

- 位图渲染的渐变会因缩放产生 banding（视觉劣化），CSS 渐变在所有缩放下矢量级清晰
- DROP_SHADOW 即使带 `use_absolute_bounds=true` 裁掉外扩，但圆角处的抗锯齿已经包含阴影渐隐部分，永远裁不干净
- 位图无法运行时主题切换 / 暗黑模式动态适配
- 位图文件大、HTTP 请求多，影响首屏

**对策**（A + B 双管，已落地到主 SKILL 和 doctor）：

#### A. doctor 加 NAM012 规则（治本：让设计师改命名）

doctor 体检时检测：`bg-` 节点的 fills 全是 SOLID/简单 GRADIENT、strokes 空或 SOLID、effects 空或单一 DROP_SHADOW、子树纯净 → 命中 → warn 提示"改成 bgc- 用 CSS 实现"。详见 spec §3.1 NAM012。

#### B. 主 SKILL sub-agent 切图前 CSS-able 自检（治标：兜底）

即使设计师没改命名，sub-agent 在切 `bg-` 之前必须先调用 `get_design_context` 拿 fills/strokes/effects/cornerRadius，按同 NAM012 的判定标准检查：

- 命中 CSS-able → **跳过切图**，输出告警，按 `bgc-` 规则用 CSS 实现（gradient + box-shadow + border + border-radius）
- 不命中 → 走 `bg-` 切图正常流程

详见主 SKILL §`bg-` 切图前的"CSS-able 自检"。

#### 为什么不让 sub-agent 自动改 fallback 不报警

更激进的方案是让 sub-agent 静默把所有 CSS-able 的 `bg-` 当 `bgc-` 处理。否决理由：

- agent 自作主张改语义会让设计意图丢失，出事难追（设计师以为切了图，实际 CSS 表达，但 CSS 不支持某些复杂渐变细节时差异不可见）
- 强制告警让设计师知道"这个本来该用 CSS"，下次设计稿能修正命名（治本）
- 自检 + 告警的组合既保证了输出质量（不切错图），又驱动设计稿质量提升（命名规范化）

---

### 2.9 bgc- 范围扩展 + bg- 内嵌 bgc- 处理（v0.2 修订）

**现象**：`sub-card > card > bg-bg > bgc-选中框` 这种结构里，`bg-bg` 是个 GROUP 容器（自身无视觉），子树里包着 `bgc-选中框`（GRADIENT_LINEAR fill + 4px Outside 渐变描边 + 1px 圆角）和装饰子层。生成出来 `card-bg.png` 把所有视觉揉成一张图，**4px 描边烤进位图**（无法主题化、无法选中态切换）、**bgc- 完全没起到 background-color 角色**。

**根因**：

1. **bgc- 范围太窄**（旧规则只取 fills）：设计师把"渐变填充 + 描边 + 圆角 + 阴影"理解为"一个 bgc-"是合理的——这就是父级 box 的全套装饰 CSS 属性。但旧规则只让 bgc- 处理 fills，描边/圆角/阴影全丢。
2. **bgc- 嵌在 bg- 子树内时无处理逻辑**：sub-agent 看到 `bg-` 命中"整体导出图片"，调用 `/v1/images?ids=bg-id`——Figma 把整个 GROUP 子树（含 bgc- 那个矩形）一起 render 进 PNG。bgc- 的渐变/描边/圆角全烤进位图，CSS 端 0 处理。
3. **NAM004 旧规则只检查 bg- 唯一性**：实际 CSS 限制是"一个父元素只能有一个 background-image **和一个** background-color"，bgc- 唯一性同样必须检查。

**对策**（已落地到主 SKILL §`bgc-` 取值规则 / §`bg-` 内嵌 `bgc-` 的处理 / 禁止项；以及 doctor §3.4 NAM004 / §3.6c NAM013）：

#### 修订 1：扩展 bgc- 范围到全套盒级 CSS 属性

bgc- 不只是 `background-color`/`background-image`，还覆盖：

| Figma 属性 | CSS 属性 |
|-----------|---------|
| fills（SOLID / GRADIENT_LINEAR / GRADIENT_RADIAL） | `background-color` / `background-image: linear-gradient(...)` / `radial-gradient(...)` |
| strokes Outside | `outline: {weight}px solid #xxx` |
| strokes Inside | `border: {weight}px solid #xxx` + `box-sizing: border-box` |
| strokes Center | 退化 outline 偏移一半，QA 标注让用户决定 |
| cornerRadius / rectangleCornerRadii | `border-radius` |
| effects（DROP_SHADOW / INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR） | `box-shadow` / `box-shadow: inset` / `filter: blur()` / `backdrop-filter: blur()` |

#### 修订 2：bg- 内嵌 bgc- 的处理流程

sub-agent 切 bg- 之前**必须**扫描子树（递归全部子孙）查找 bgc-：

| 子树 bgc- 数量 | 处理 |
|--------------|------|
| 0 个（推荐） | 正常切 bg- |
| 1 个 | 把 bgc- "摘出来" 按修订 1 规则写父元素 CSS；bg- 子树其他装饰随 bg- 整体切图（Figma API 限制无法切图时排除子节点）；输出告警 |
| ≥ 2 个 | 取第一个 bgc-，其余忽略，输出 error 级告警 |

**bg- 兄弟也有 bgc- 的优先级**：兄弟 bgc- 优先（更接近"父级 CSS 属性"语义），嵌套 bgc- 的 CSS 属性不重复声明（避免和兄弟 bgc- 打架），doctor 仍 warn 提示嵌套那个改成兄弟。

#### 修订 3：NAM004 扩展覆盖 bgc- + 新增 NAM013

- **NAM004**（已有）扩展为"同父级最多 1 个 bg- **和** 1 个 bgc-"——CSS 物理限制
- **NAM013**（新增）"bgc- 嵌在 bg- 子树内"——结构错误，warn 提示改成兄弟关系

#### 为什么不改 Figma API 切图行为

Figma `/v1/images` API 不支持切图时排除某个子节点，这是 API 层面的物理限制。生成端只能：
- 让设计师把 bgc- 移出 bg- 子树（治本，doctor NAM013 治理）
- 兜底"摘出来"按 bgc- 规则写 CSS（治标，主 SKILL §`bg-` 内嵌 `bgc-` 的处理）
- 即使兜底，位图里仍有 bgc- 视觉副本——CSS 生效但视觉重复，不影响最终视觉但浪费切图体积；这是物理限制下的最优解

---

### 2.10 fixed- 视口固定定位前缀新增（v0.2 新增）

**根因**：旧前缀体系只有"渲染前缀"（决定怎么画）和"分块前缀"（决定怎么拆 sub-agent），缺"定位修饰前缀"。设计稿里"吸顶 nav / 吸底 tab / 悬浮回顶 / 固定浮层入口"语义无法表达，AI 一律按 `position: absolute` 跟随滚动，运行时表现不符设计意图。

**对策**：

1. **主 SKILL §`fixed-` 定位规则**：新增"修饰前缀"概念——`fixed-` 只改 `position`，不改渲染方式，可与所有"生成节点"的前缀叠加（sub-/block-/btn-/img-/scrollx-/scrolly-），不可与"不生成节点"的前缀叠加（bg-/bgc-/x-，doctor NAM014 命中后 error）
2. **top/bottom/left/right 取值依赖 Figma `constraints`**：按 horizontal / vertical 的 TOP / BOTTOM / LEFT / RIGHT / CENTER 推断 CSS 定位，不直接读 absoluteBoundingBox 坐标。constraints 缺失时退化为绝对坐标 + 强制 QA 告警
3. **doctor §3.6d NAM014**（error）：识别 `fixed-` + `bg-`/`bgc-`/`x-` 叠加的命名错误
4. **doctor §3.9e LAY013**（warn）：识别祖先链含 `transform`/`filter`/`perspective`/blur 导致 fixed 退化为相对祖先定位的 CSS 副作用
5. **install.js runInit() 改 spread merge**：从 `existing.layers || 默认` 整体短路改为 `{ ...默认, ...(existing.layers || {}) }` 字段级 merge，让老项目 re-init 时自动补 `fixed: "fixed-"`（以及未来新增的任何字段），无需用户手改 config
6. **design-guide.md / topic / matcher 同步**：设计师指南加 fixed- 段落 + 速查表行 + 组合示例；topic 加 §7 + 工具链/配置项/边界/历史 bug 段同步；matcher 加 14 个新关键词

---

---

## 3. 规则清单

> **图例**：
> - 等级（默认）：🔴 error / 🟡 warn / 🔵 info
> - 优先级：P0=首期实现 / P1=二期 / P2=远期
> - 所有规则可在 config 中改等级或关闭

### 3.1 命名规范（NAM）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `NAM001` | 容器无前缀 | 🟡 | P0 | 节点为 FRAME/GROUP/COMPONENT，子层 ≥ 2，名称不含任何已知前缀，**且不在 `img-` / `bg-` / `bgc-` / `x-` 不递归子树内**，**且父节点不是 `scrollx-` / `scrolly-` 列表容器**，且非 `sub-` 内部一级容器 | 加 `sub-`（不再建议 `block-`，避免嵌套语义混乱） |
| `NAM002` | 前缀拼写错误 | 🔴 | P0 | 名称含 `bg_` / `Bg-` / `IMG-` / `img -` / `Scroll-X-` / `scroll_y-` 等已知前缀（含 `scrollx` / `scrolly`）的拼写变体 | 改为标准小写连字符 |
| `NAM003` | 前缀语义冲突 | 🔴 | P0 | `img×bg`、`img×font`、`x` 与任意其他前缀；以及 `scrollx`/`scrolly` 与 `img`/`bg`/`bgc`/`x`/`btn`/对方滚动方向 共存（参见主 SKILL §428-432 / §448 / §712）。**注意：`bg`+`bgc` 不冲突**——分别写父级 `background-image` / `background-color`，可共存 | 参考主 SKILL 组合优先级，二选一；scroll 容器内部用单独子节点表达图片/背景/可点击区域 |
| `NAM004` | bg- / bgc- 唯一性违反 | 🔴 | P0 | 同一父级下出现 ≥ 2 个 `bg-` 或 ≥ 2 个 `bgc-` 子层 | 仅保留一个 bg- 和一个 bgc-（CSS 父元素只能有一个 background-image 和一个 background-color） |
| `NAM005` | 同级重名 | 🟡 | P0 | 同父级两个图层去前缀后 kebab-case 相同（如 `img-hero` 与 `bg-hero`） | 加业务后缀区分 |
| `NAM006` | 命名质量差 | 🔵 | P1 | 去前缀后为：纯数字 / `Group \d+` / `Frame \d+` / `编组\d+` / 仅含 node-id | 改为语义化命名（kebab-case，英文优先） |
| `NAM007` | 裸名图层（兜底警告） | 🔵 | P1 | 非 TEXT、无任何前缀、且子层 = 0 | 明确加 `img-` 或 `x-` |
| `NAM008` | sub- 嵌套深度过深 | 🟡 | P0 | `sub-` 节点祖先链上已有 ≥ 2 个 `sub-`（嵌套深度 ≥ 3） | 拍平一层（外层是分组容器就去外层；内层能平就去内层） |
| `NAM009` | sub- 粒度过细 | 🔵 | P2 | `sub-` 内可见图层 < 3 个 | 合并到父级 |
| `NAM010` | 隐藏图层堆积 | 🔵 | P1 | 整稿 `visible:false` 节点占比 > 20% | 清理废稿 |
| `NAM012` | bg- 应改为 bgc- | 🟡 | P0 | `bg-` 节点的 fills 全是 SOLID/简单 GRADIENT、strokes 空或 SOLID、effects 空或单一 DROP_SHADOW、子树纯净（无可见子节点） | 改名为 `bgc-{name}`，生成端用 CSS 实现（gradient + box-shadow + border-radius），不切位图 |
| `NAM013` | bgc- 嵌在 bg- 子树内 | 🟡 | P0 | `bgc-` 节点祖先链上存在 `bg-` 节点 | 把 bgc- 移出 bg- 子树，作为 bg- 的兄弟节点，让 bgc- 直接挂在 bg- 的父元素下 |
| `NAM014` | fixed- 与不生成节点的前缀叠加 | 🔴 | P0 | 节点 `prefixes` 同时含 `fixed` 和 `bg` / `bgc` / `x` 中任一个 | 拆分前缀：若要"固定背景"，把 `fixed-` 移到父节点（父变 `fixed-{name}`），`bg-`/`bgc-` 保留为子节点 |

### 3.2 Auto Layout / 布局合理性（LAY）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `LAY001` | 容器缺 Auto Layout | 🟡 | P0 | FRAME 子层 ≥ 2，未启用 AL，子层位置不在同一行/列 | 设计师启用 Auto Layout |
| `LAY002` | AL padding 含负值 | 🔴 | P0 | AL 容器任一 padding < 0 | 改为 ≥ 0 |
| `LAY003` | AL padding 严重不对称 | 🔵 | P1 | AL 容器同向 padding 差值 > 32px（如 left=8, right=120） | 检查是否设计意图 |
| `LAY004` | 子元素溢出父容器 | 🟡 | P1 | 子元素 bbox 超出父容器（且父无 `overflow: visible` 设计意图） | 调整尺寸或开启 clip |
| `LAY005` | Hug + Fill 父子矛盾 | 🟡 | P2 | 父 Hug Contents，唯一子 Fill Container | 二选一 |
| `LAY006` | 容器 padding > 内容尺寸 | 🟡 | P1 | padding 和 ≥ 容器对应方向尺寸的 80% | 多半是设计师误操作 |
| `LAY007` | gap 与实际间距不一致 | 🔵 | P2 | AL 容器 itemSpacing ≠ 子元素实测间距（差 > 2px） | 设计师未对齐 AL |
| `LAY008` | 旋转 / 倾斜 | 🔵 | P1 | 节点 rotation ≠ 0 | D2C 不还原旋转，需手动确认 |
| `LAY009` | 绝对定位嫌疑 | 🟡 | P0 | 容器多子且子之间有重叠（且不在 sub- 内） | 检查是否用了 absolute 思路 |
| `LAY010` | 顶层 frame 背景缺失 | 🔵 | P0 | 检查目标根节点 fills 为空/全透明 | Figma 顶层 frame 加 fill；否则确认走项目兜底色 |
| `LAY011` | scroll 容器尺寸不固定 | 🟡 | P0 | `prefixes` 含 `'scrollx'` / `'scrolly'`，对应方向尺寸为 Hug Contents 或 fill 100% 父容器（且祖先链上没有固定值） | 把容器对应方向尺寸改为固定值；或确保父容器有限宽/限高 |
| `LAY012` | scroll 方向冲突 | 🔴 | P0 | `prefixes` 同时含 `'scrollx'` 和 `'scrolly'` | 只保留一个滚动方向；二维滚动用两层嵌套 |
| `LAY013` | fixed- 祖先链含 transform | 🟡 | P1 | 节点 `prefixes` 含 `fixed`，且祖先链上存在节点带可生成 `transform`/`filter`/`backdrop-filter` 的属性（rotation ≠ 0、scale ≠ 1、effects 含 `LAYER_BLUR` / `BACKGROUND_BLUR`） | 把 `fixed-` 节点上提到根 frame 的直接子节点；或去掉祖先的 rotation/scale/blur；业务必须保留时由开发手动加 React Portal |

> **scroll 字段命名约定**：`prefixes` 数组里存放从 `name` 提取的**小写前缀字符串**（`'scrollx'` / `'scrolly'`），不是 config 字段名（`layers.scrollX` / `layers.scrollY`）。规则判断以 `prefixes` 内容为准。

### 3.3 图层结构合理性（STR）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `STR001` | 嵌套深度过深 | 🟡 | P0 | 单条路径深度 > 6（默认阈值，可调） | 拍平不必要的 wrapper |
| `STR002` | 单子嵌套（套娃） | 🔵 | P0 | FRAME 仅含 1 个 FRAME 子层，且自身无填充/描边/圆角/effect | 删除外层 |
| `STR003` | 空容器 | 🔵 | P1 | FRAME/GROUP 子层数 = 0，且无填充/背景 | 删除 |
| `STR004` | Group 应改 Frame | 🔵 | P1 | 节点是 GROUP 且子层 ≥ 2 | 改 Frame 才能用 AL |
| `STR005` | 锁定图层 | 🔵 | P2 | `locked: true` | 仅信息提示 |
| `STR006` | Component Instance 跨文件引用 | 🔵 | P2 | 实例 mainComponent 在外部文件 | 可能拿不到完整属性 |
| `STR007` | mask / blend mode | 🟡 | P1 | 节点含 mask 或非 NORMAL blend mode | D2C 不还原，建议拍扁为 img |

### 3.4 样式 / Token 一致性（STY）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `STY001` | 颜色未绑定变量 | 🔵 | P2 | fill 为 SOLID 但未绑定 Variable / Style | 绑定 Token |
| `STY002` | 字号未绑定文字样式 | 🔵 | P2 | TEXT 字号未绑定 Text Style | 绑定 Token |
| `STY003` | 邻近 HEX 色冗余 | 🔵 | P2 | 同稿出现 ΔE < 3 的不同色值 ≥ 2 组 | 统一色值 |
| `STY004` | 邻近字号冗余 | 🔵 | P2 | 出现 27px / 28px / 29px 这种相差 1-2px 的字号 | 归并 |
| `STY005` | 单 TEXT 多样式段 | 🟡 | P1 | 一个 TEXT 节点含多段不同字号/颜色/字重 | 拆成多个 TEXT |

### 3.5 资产可导出性（AST）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `AST001` | 矢量被命名为 img- | 🔵 | P1 | 节点子树纯矢量（VECTOR/BOOLEAN/ICON），名为 `img-` | 改 `svg-`（如启用）或仅信息提示 |
| `AST002` | bg- 尺寸 ≠ 父尺寸 | 🟡 | P0 | `bg-` 节点宽或高 < 父容器对应尺寸 80% | 调整 bg- 节点为满父尺寸 |
| `AST003` | bg- 尺寸 > 父尺寸 | 🔵 | P1 | `bg-` 节点宽或高 > 父容器对应尺寸 120% | 设计师容易误以为父也变高 |
| `AST004` | 应导出但内容为空 | 🔴 | P0 | `img-` / `bg-` 节点子树无任何可见内容 | 删除或补内容 |

### 3.6 生成可行性（FEA） · P0 闸口

最严的一组规则，命中 error 时**集成模式下直接终止生成**。

| ID | 名称 | 默认 | P | 触发条件 |
|---|---|---|---|---|
| `FEA001` | 没有 sub- 块 | 🟡 | P0 | 整稿无任何 `sub-` 节点（D2C 退化为单 agent） |
| `FEA002` | 全是隐藏图层 | 🔴 | P0 | 目标节点子树可见图层 = 0 |
| `FEA003` | 单稿图层数过多 | 🟡 | P0 | 子树节点数 > 1500（性能预警） |
| `FEA004` | sub- 块过多 | 🟡 | P1 | 单稿 `sub-` 节点 > 20（并发压力大） |

---

## 4. 评分算法

### 4.1 维度得分

每个维度独立评分，0-100，加权汇总：

| 维度 | 权重 | 满分构成 |
|---|---|---|
| 命名规范（NAM） | 30% | 命中 error -10 / warn -3 / info -1，下限 0 |
| 布局合理性（LAY） | 25% | 同上 |
| 结构合理性（STR） | 15% | 同上 |
| 样式一致性（STY） | 10% | 同上 |
| 资产可导性（AST） | 10% | 同上 |
| 生成可行性（FEA） | 10% | 任一 error → 0 分（一票否决） |

### 4.2 等级映射

| 总分 | 等级 | 含义 |
|---|---|---|
| 90-100 | A | 优秀，可直接生成 |
| 75-89  | B | 良好，少量警告 |
| 60-74  | C | 可生成但偏差风险高 |
| < 60   | D | 不建议生成，先修设计稿 |
| 任何 FEA error | F | 阻塞，集成模式下终止 |

### 4.3 覆盖率指标（独立展示，不参与扣分）

- 命名前缀覆盖率：`带前缀图层数 / (总可见图层数 - 文本图层数)`
- Auto Layout 覆盖率：`AL 容器数 / (总容器数 - 子层<2的容器)`
- Token 引用率：`绑定 Variable/Style 的样式属性数 / 全部样式属性数`
- 嵌套深度：平均 / 最大
- 隐藏图层占比：`visible:false 节点 / 总节点`

---

## 5. config schema 扩展

在 `pp-d2c.config.json` 顶层新增 `health` 段：

```jsonc
{
  // ... 既有字段
  "health": {
    "enabled": true,                     // 总开关
    "blockOnError": true,                // 集成模式下，命中 error 是否阻塞生成
    "report": {
      "markdown": true,                  // 输出 .d2c-health-{slug}-{timestamp}.md（每次新建文件，避免覆盖）
      "json": true,                      // 输出 .d2c-health-{slug}-{timestamp}.json（同上）
      "dir": "{output.dir}"              // 报告输出目录，默认与 output.dir 同
    },
    "thresholds": {
      "maxDepth": 6,                     // STR001
      "subBlockMin": 3,                  // NAM009
      "subBlockMax": 20,                 // FEA004
      "totalNodesMax": 1500,             // FEA003
      "hiddenRatioMax": 0.2,             // NAM010
      "paddingAsymmetryMax": 32,         // LAY003
      "bgSizeMin": 0.8,                  // AST002
      "bgSizeMax": 1.2,                  // AST003
      "colorDeltaEMin": 3                // STY003
    },
    "rules": {
      // 任一规则可改等级或关闭
      // "NAM001": "warn",  // 默认值
      // "NAM006": "off",
      // "STY001": "info"
    }
  }
}
```

> 未在 `rules` 中显式声明的规则使用本 spec 第 3 节的默认等级。

---

## 6. 报告输出

### 6.0 文件命名规则（v0.2 修订）

报告文件名格式：

```
{health.report.dir}/.d2c-health-{slug}-{timestamp}.md
{health.report.dir}/.d2c-health-{slug}-{timestamp}.json
```

并同时维护"最近一次"指针（软链或复制覆盖）：

```
{health.report.dir}/.d2c-health-latest.md
{health.report.dir}/.d2c-health-latest.json
```

| 字段 | 取值 |
|------|------|
| `{slug}` | `nodeId` 把 `:` 替换为 `-`；超过 32 字符截断后追加 `-` 和 nodeId 8 位 hash 前缀 |
| `{timestamp}` | 本地时间 `YYYYMMDD-HHmmss`（如 `20260618-143052`） |

**为什么不用固定 `.d2c-health.md`**：同一项目会跑多张稿、同一稿会在改图前后多次体检，固定文件名会被后一次覆盖，丢失对比信息。带 `slug + timestamp` 后多次执行不冲突，`-latest` 仅作为"读最新"的入口，不参与归档。

> 配套建议：在 `.gitignore` 添加 `.d2c-health-*.md` / `.d2c-health-*.json`（不入库）。

### 6.1 Markdown（人读）

文件：`{health.report.dir}/.d2c-health-{slug}-{timestamp}.md`（同步刷新 `-latest.md`）

```markdown
# D2C 设计稿健康度报告

- 设计稿：火车票 618 活动主页 (fileKey/nodeId)
- 检测时间：2026-06-17 14:32
- 总分：**78 / 100**  (B 级 · 良好)

## 维度得分
| 维度 | 得分 | 权重 | 主要扣分 |
|---|---|---|---|
| 命名规范 | 85 | 30% | 1 个 error / 4 个 warn |
| 布局合理性 | 62 | 25% | 5 个 warn (AL 缺失) |
| ...

## 覆盖率
- 命名前缀：85% (43 / 51)
- Auto Layout：62% (8 / 13)
- Token 引用：31%
- 嵌套深度：平均 3.2 / 最大 5
- 隐藏图层占比：4%

## 问题清单

### 🔴 错误（必须修复）
1. **[NAM003] 前缀语义冲突** — 节点 `sub-img-bg-card` (95:19385) 同时含 `img-` 和 `bg-`
   修复：二选一
   跳转：[在 Figma 中打开](https://figma.com/...)

### 🟡 警告（建议修复）
...

### 🔵 信息（可选优化）
...
```

### 6.2 JSON（机器读）

文件：`{health.report.dir}/.d2c-health-{slug}-{timestamp}.json`（同步刷新 `-latest.json`）

```jsonc
{
  "version": "1.0.0",
  "checkedAt": "2026-06-17T06:32:00Z",
  "target": { "fileKey": "...", "nodeId": "...", "name": "..." },
  "score": {
    "total": 78,
    "grade": "B",
    "dimensions": {
      "NAM": { "score": 85, "weight": 0.30 },
      "LAY": { "score": 62, "weight": 0.25 }
      // ...
    },
    "coverage": {
      "namedPrefix": 0.85,
      "autoLayout": 0.62,
      "tokenized": 0.31,
      "depthAvg": 3.2,
      "depthMax": 5,
      "hiddenRatio": 0.04
    }
  },
  "issues": [
    {
      "id": "NAM003",
      "level": "error",
      "nodeId": "95:19385",
      "nodeName": "sub-img-bg-card",
      "nodePath": "page/sub-main/sub-img-bg-card",
      "message": "前缀语义冲突：同时含 img- 和 bg-",
      "fix": "二选一",
      "figmaUrl": "https://figma.com/design/.../?node-id=95-19385"
    }
  ],
  "summary": { "error": 3, "warn": 12, "info": 8 }
}
```

---

## 7. 集成调用协议

主 SKILL 在步骤 0.5 调用 doctor 时使用如下协议：

**输入**：
```js
doctor.run({
  fileKey, nodeId,
  config,                  // 完整 pp-d2c.config.json
  mode: 'integrated'       // 'integrated' | 'standalone'
})
```

**输出**：
```js
{
  passed: true | false,    // 是否通过（依据 health.blockOnError）
  score: { ... },          // 同 6.2 中的 score
  issues: [ ... ],          // 同 6.2 中的 issues
  // mode: 'standalone' 时额外写两个文件，integrated 不写
}
```

**主 SKILL 决策**：
```
if (!passed && config.health.blockOnError) {
  print '设计稿体检未通过，已生成报告。是否强制继续？(y/N)'
  return  // 等待用户确认
}
if (warn > 0) {
  print '设计稿体检发现 N 个警告，详见 .d2c-health-latest.md，已继续生成。'
}
```

---

## 8. 首期实现范围（P0 共 ~13 条）

按 A 选项推荐，首期只实现以下规则，覆盖 80% 痛点：

- 命名：NAM001 / NAM002 / NAM003 / NAM004 / NAM005 / NAM008
- 布局：LAY001 / LAY002 / LAY009
- 结构：STR001 / STR002
- 资产：AST002 / AST004
- 可行性：FEA002 / FEA003

**首期不做**：
- STY 维度全部（涉及 token 体系，等项目 token 化推进后再做）
- AST001（svg- 前缀目前 SKILL 还未引入）
- LAY007（gap 测算成本高）

**首期评分**：仍按完整公式计算，未实现的规则视为不扣分。

---

## 9. 待你确认

- [ ] **A** 范围：首期 P0 ~13 条 是否合适？需要加/减哪些？
- [ ] **B** 集成方式：是否同意"独立 SKILL + 协议兼容主流程"双模式？
- [ ] **C** config 化：`health` 段 schema 是否可接受？阈值默认值是否合理？
- [ ] **D** 输出：md + json 双输出，文件名 `.d2c-health-{slug}-{timestamp}.md` / `.d2c-health-{slug}-{timestamp}.json` + `.d2c-health-latest.*` 指针，是否 OK？
- [ ] **E** 评分权重：30/25/15/10/10/10 是否需要调整？
- [ ] **F** SKILL 名称：`pp-doctor` 还是另起一个？
- [ ] **G** 报告输出目录：默认与 `output.dir` 同，还是放项目根 `.d2c/`？

确认后我再写正式的 `templates/skills/pp-doctor/SKILL.md`，并按 P0 列表开始实现。
