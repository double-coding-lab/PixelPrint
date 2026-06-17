# D2C 设计稿健康检测 · Spec（草案 v0.1）

> 目的：在 D2C 生成代码**之前**，对 Figma 设计稿做一次自动体检，提前暴露命名、布局、结构、样式、资产等层面的问题。
>
> 对象：所有送入 `ctrip-train-d2c` 还原流程的设计稿。
>
> 关系：与 `templates/skills/ctrip-train-d2c/SKILL.md` 同源，规则前缀完全沿用 `ctrip-train-d2c.config.json` 的 `layers` 段。

---

## 0. 待确认项（先于 spec 主体）

下面三个问题在动工前需要你拍板，spec 后续章节先给推荐方案：

| # | 决策 | 推荐方案 | 备选 |
|---|---|---|---|
| A | 规则范围 | **完整版**（6 个维度共 ~30 条规则），但每条标 P0/P1/P2，**首期只实现 P0**（命名 + AL + 结构核心 ~12 条） | 仅基础版 / 全量首期上 |
| B | 集成方式 | **独立 SKILL，协议向 D2C 主流程兼容**（独立可跑，主流程也能调用并阻塞致命错误） | 仅独立 / 仅集成 |
| C | 阈值与开关 | **全部走 `ctrip-train-d2c.config.json` 的 `health` 段**，每条规则三态 `off / warn / error`，阈值可调；规则 ID 写死 | 阈值写死 / 单独 health.config.json |
| D | 报告归档 | **同时输出** `.d2c-health-{slug}-{timestamp}.md`（人读）+ `.d2c-health-{slug}-{timestamp}.json`（机器读，供未来仪表盘），同步刷新 `.d2c-health-latest.*` 指针 | 仅 md / 仅 json |

> 下文按 A=完整版/首期 P0、B=独立可集成、C=config 化、D=md+json 写。如有调整，spec 主体相应章节会改。

---

## 1. 触发与定位

### 1.1 SKILL 名称

`ctrip-train-d2c-doctor`

理由：跟 `ctrip-train-d2c` 同前缀，`doctor` 比 `lint` / `check` 更直观（"体检"），且与 ESLint 风格规则区分（避免误以为是代码 lint）。

### 1.2 触发条件

- 用户提供 Figma 设计稿 URL 并说：
  - 「体检一下」「健康检测」「检查设计稿」「跑个 d2c 体检」「看看这个稿能不能还原」
  - 直接 `$ctrip-train-d2c-doctor`
- 被 `ctrip-train-d2c` 主 SKILL 在步骤 0 之后调用（B 模式集成）

### 1.3 与生成 SKILL 的关系

```
独立调用模式：           集成调用模式：
   用户                     用户
    │                        │
    ▼                        ▼
  doctor                  ctrip-train-d2c
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
步骤 -1：Figma MCP 预检（同主 SKILL）
步骤 0 ：读取 config（含 layers 段 + health 段）
步骤 1 ：解析 URL → fileKey, nodeId
步骤 2 ：扫描图层结构（拆为 4 个子步骤，避免大稿"长时间无响应"）
        2.0 输出可见进度提示
        2.1 调用 get_metadata 拉取完整子树
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
| `get_metadata(fileKey, nodeId)` | 主要数据源。返回完整图层树，含 name / visible / type / 位置尺寸 |
| `get_design_context(fileKey, nodeId)` | 仅当 metadata 不足以判定时按需调用（如读取 fills、styles、variables） |
| `get_variable_defs(fileKey, nodeId)` | 用于"颜色/字号 token 化覆盖率"维度（P2） |

> ⚠️ doctor 不调用 REST API 导出图片，不产生临时下载，纯只读分析。

### 2.2 性能边界

- 单次扫描限 1000 个图层节点，超过则**对每个 sub- 块独立扫描**，最后汇总
- 单次执行预计 < 30 秒（不含 MCP 网络延迟）

### 2.3 步骤 2 卡顿与拆分（v0.2 新增）

**现象**：原步骤 2 是"一次性同步拉全树 + 遍历打标 + 后置阈值判断"，超过 2000 节点的稿子在外部表现为"卡住数十秒到几分钟"，且 5000 阈值的提前止损被埋在打标之后才生效。

**对策**（已落地到 `templates/skills/ctrip-train-d2c-doctor/SKILL.md`）：

1. **步骤 2.0**：进入 `get_metadata` 之前必须输出可见进度提示（`📥 正在拉取图层树 ...`），让用户能区分"程序卡死 / 程序在干活"。
2. **步骤 2.1**：`get_metadata` 不重试，失败直接终止（重试会让用户多等一倍）。
3. **步骤 2.2**：metadata 返回后**第一件事**就是统计 `nodeCount` 与 `depthMax`，按 `> 5000 终止 / > 1500 标记 oversizeWarning / 其他放行` 三档分流，**先于任何打标**。
4. **步骤 2.3**：原有打标逻辑保持不变，只在打标完成后追加一行进度（`🏷  属性打标完成`）。

**为什么不做"先浅扫再全量"**：Figma MCP 的 `get_metadata` 没有 depth/limit 参数，无法做真正的浅扫；多调用一次 `get_screenshot` 做规模预估反而双倍延迟。从输入侧（用户改选更小的 nodeId）规避是更便宜的解。

**对应排查清单**：见 SKILL.md 末尾"步骤 2 卡住排查清单"。

### 2.4 不递归子树前置过滤（v0.2 修订）

**现象**：原 NAM001 / LAY001 / LAY009 / STR001 等"形态/容器"类规则只显式排除了 `sub-` 祖先，对 `img-` / `bg-` / `bgc-` / `x-` 子树内的子孙节点照报不误。但主 SKILL（`templates/skills/ctrip-train-d2c/SKILL.md` §412/429/705）已经明文约定：这四类前缀命中即"整体导出 / 忽略"、**不再向内递归**。给这些子孙报"加 sub-"等于让设计师改一个永远不会被读到的图层。

典型 false positive：`img-kv` 里有个 `step` 容器 → doctor 报"NAM001：建议改 `sub-step`"。这是错的，整个 `img-kv` 子树会作为单张 PNG 导出，里面叫什么都无所谓。

**对策**（已落地到 `templates/skills/ctrip-train-d2c-doctor/SKILL.md`）：

1. **步骤 2.3**：每个节点新增一个布尔标 `inNonRecursiveSubtree`，定义为"祖先链上存在 `img` / `bg` / `bgc` / `x` 前缀节点"。`sub-` 和 `btn-` 不算（这两类内部仍然要继续解析）。
2. **步骤 3 全局过滤**：执行任何规则前先看这个标。`true` 且节点本身不带不递归前缀 → 整批跳过 NAM001 / NAM002 / LAY001 / LAY009 / STR001 / STR002 / AST002。
3. **保留例外**：AST004（应导出但内容为空）即使在不递归子树内也要报——子树为空会让导出图本身是空白，是有效问题。
4. **报告聚合**：每条相关规则下方注明"已自动忽略 N 项位于不递归子树内的命中"，让设计师知道 doctor 没有视而不见，只是按主 SKILL 递归规则做了过滤。

**为什么用全局标而不是逐条加判断**：每条规则各自写"且不在 X 子树内"容易漏（旧 LAY009 已经只排了 `sub-img-` / `img-`，漏了 `bg-` / `bgc-` / `x-`）。一处定义、全局过滤更不易出错。

### 2.5 NAM001 列表项与 block- 误导修订（v0.2 修订）

**现象 1：`scrolly-车票列表` 内部的 `编组` 被报"加 sub-trip-item"**。但 `scrollx-` / `scrolly-` 容器的直接子节点天然是**同构列表项**（被 `.map()` 渲染），每一项加 `sub-` = N 个 sub-agent 干同一件事。

**现象 2：NAM001 fix 写"加 `sub-` 或 `block-`"**。但 `block-` 是主 SKILL §409 定义的"顶层独立布局块（命名空间隔离）"，没有"嵌套使用"的定义；在 `block-banner` 里再加 `block-` 没有任何语义。

**对策**（已落地到 `templates/skills/ctrip-train-d2c-doctor/SKILL.md` §3.1）：

1. NAM001 触发条件追加："**父节点不是 `scrollx-` / `scrolly-` 列表容器**"。如果父就是滚动容器、且子节点数 ≥ 2，跳过本规则。如果只有 1 个子节点（不是列表，是 wrapper），仍然报。
2. NAM001 fix 改为"加 `sub-` 前缀"，不再提 `block-`。
3. 报告里在 NAM001 表格上方加一行说明：`> scrolly-/scrollx- 容器内的列表项已自动忽略，列表项请用 Figma Component/Instance 表达差异化`。

**为什么不直接放进 `inNonRecursiveSubtree`**：`scrollx-` / `scrolly-` 子层**仍要生成代码**（主 SKILL §416-417 明确"继续递归子层"），不属于"不递归子树"族。它只是"NAM001 不适用"，不是"所有规则不适用"。所以这是 NAM001 自己的局部排除，不进全局过滤。

### 2.6 NAM/LAY 规则补全（v0.2 修订）

补全 doctor 与主 SKILL（`templates/skills/ctrip-train-d2c/SKILL.md`）约定不一致的几条规则：

#### NAM003 冲突表补全

旧规则只列了 `img×bg` / `img×font` / `x×any` 三组冲突，遗漏了：

- **`bg×bgc` 共存**：两者都写父级 background（一个 image、一个 color），主 SKILL §430-431 没定义谁先谁后
- **`scrollx`/`scrolly` 与 `img`/`bg`/`bgc`/`x`/`btn` 共存**：主 SKILL §448 / §712 明确禁止
- **`scrollx` + `scrolly` 共存**：与 LAY012 重叠，但 NAM003 也应捕获（前缀冲突视角）

→ 修订后冲突表与主 SKILL §428-432 / §448 / §712 完全对齐。

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
| `NAM003` | 前缀语义冲突 | 🔴 | P0 | `img×bg`、`img×font`、`bg×bgc`、`x` 与任意其他前缀；以及 `scrollx`/`scrolly` 与 `img`/`bg`/`bgc`/`x`/`btn`/对方滚动方向 共存（参见主 SKILL §428-432 / §448 / §712） | 参考主 SKILL 组合优先级，二选一；scroll 容器内部用单独子节点表达图片/背景/可点击区域 |
| `NAM004` | bg- 唯一性违反 | 🔴 | P0 | 同一父级下出现 ≥ 2 个 `bg-` 子层 | 仅保留一个 |
| `NAM005` | 同级重名 | 🟡 | P0 | 同父级两个图层去前缀后 kebab-case 相同（如 `img-hero` 与 `bg-hero`） | 加业务后缀区分 |
| `NAM006` | 命名质量差 | 🔵 | P1 | 去前缀后为：纯数字 / `Group \d+` / `Frame \d+` / `编组\d+` / 仅含 node-id | 改为语义化命名（kebab-case，英文优先） |
| `NAM007` | 裸名图层（兜底警告） | 🔵 | P1 | 非 TEXT、无任何前缀、且子层 = 0 | 明确加 `img-` 或 `x-` |
| `NAM008` | sub- 嵌套 sub- | 🔴 | P0 | `sub-` 节点的子树内还有 `sub-` 节点 | 仅保留外层或仅保留内层 |
| `NAM009` | sub- 粒度过细 | 🔵 | P2 | `sub-` 内可见图层 < 3 个 | 合并到父级 |
| `NAM010` | 隐藏图层堆积 | 🔵 | P1 | 整稿 `visible:false` 节点占比 > 20% | 清理废稿 |

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

在 `ctrip-train-d2c.config.json` 顶层新增 `health` 段：

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
  config,                  // 完整 ctrip-train-d2c.config.json
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
- [ ] **F** SKILL 名称：`ctrip-train-d2c-doctor` 还是另起一个？
- [ ] **G** 报告输出目录：默认与 `output.dir` 同，还是放项目根 `.d2c/`？

确认后我再写正式的 `templates/skills/ctrip-train-d2c-doctor/SKILL.md`，并按 P0 列表开始实现。
