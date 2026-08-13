# pp-d2c 原理设计

> pp-d2c（H5 主 D2C skill）的设计哲学与内部运转机制。面向理解或改造 skill 的开发者。
> 规则明细以 `templates/skills/pp-d2c/SKILL.md` + `rules/*.md` 为准（冲突以 `rules/` 为准）；使用手册见 `docs/pixel-print-guide.md`；图层命名规范见 `docs/design-guide.md`。

---

## 核心概念

| 概念 | 说明 |
|------|------|
| 四层架构 | 数据层（`bin/figma.mjs`）/ 规则层（`SKILL.md` + `rules/`）/ 执行层（LLM）/ 校验层（`bin/check-rules.mjs`）。两个确定性层夹住一个概率性层。 |
| 图层前缀协议 | 设计师用图层名前缀把「切图 / 拆 DOM / 可点击」意图机读化写进稿子；前缀是 skill 硬编码常量（config 无 `layers` 段，不可配置）。 |
| `sub-` 分块 | 唯一触发 sub-agent 分发的前缀；每个 `sub-` block 独立一个 sub-agent 出码，最深 3 层嵌套。 |
| sub-agent | 出码 + 自验收单个 block 的执行单元；SKILL.md 中「派发 / 上报」是隐喻，全程只有一个 LLM agent 顺序执行，靠磁盘文件（`subslots.json` / `<__SUBSLOT__>` 占位符）传递状态。 |
| `data-node-id` | 每个承载 Figma 语义的 DOM 元素挂 `data-node-id="<figma nodeId>"`，是对账绑定、守恒律差集、review 反查、局部修复定位的公共锚点。 |
| 对账（v1.2 范式） | 以 `.d2c-cache/<fileKey>/nodes/*.json` 为唯一真值账本，产物代码为待核账目，`data-node-id` 为凭证号，逐节点核对而非黑名单抽查。 |
| 软防线 / 硬防线 | 软 = Rule-Scan sub-agent（LLM 语义识别，提示性可漏）；硬 = check-rules.mjs（代码判定，exit 1 强制回滚）。 |
| 忠实翻译 | Figma REST API 返回的节点 JSON 是唯一事实源，凡可机械计算的量（坐标 / 尺寸 / 方向 / 间距 / 色值）必须算对，禁止「需人工核对」兜底数字量。 |

**前缀常量表**（硬编码，事实源 `rules/README.md`）：

| 前缀 | 语义 | 关键行为 |
|------|------|----------|
| `sub-` | 分块边界 | 唯一触发 sub-agent 分发；仅分块，不影响渲染 |
| `block-` | 独立布局块 | 类名命名空间隔离 |
| `img-` | 图片内容 | 整层导出 `<img>`，不递归子层 |
| `bg-` | 背景图 | 切图挂父 `background-image`，自身不生成 DOM，不递归 |
| `bgc-` | 盒级装饰 | fills/strokes/cornerRadius/effects 全套 CSS 写父，自身不生成 DOM |
| `btn-` | 可点击 | 永远 CSS 化（不切图） |
| `input-` | 输入框 | 生成 `<input type="text">`，子 TEXT 变 placeholder，不递归 |
| `scrollx-` / `scrolly-` | 滚动容器 | overflow + 隐藏滚动条，继续递归；同构 ≥3 强制 `.map()` |
| `fixed-` | 视口固定 | 修饰前缀，`position: fixed` + constraints 推方位 |
| `end-` | 贴父末端 | 修饰前缀，wrapper + `space-between` 机制 |
| `x-` | 忽略 | 跳过整层，优先级最高 |

前缀组合优先级：`x-` > `img-` > `bg-` > `bgc-` > `btn-` > 滚动 > 无前缀兜底；互斥组合（如 `fixed-`×`bg-`）由 doctor 报错。`bg`/`bgc`/`btn`/`img`/`input` 五个词允许裸词（whole word）等同前缀；`background`/`button` 等含词非裸词不识别，走兜底。

---

## 状态与流转

### 执行流水线（步骤 -1 → 7）

| 步骤 | 名称 | 职责 |
|------|------|------|
| -1 | verify-token | Token 探针（`/v1/me`），失败即终止 |
| 0 | 读 config | 缓存 projectRoot / styleFormat / unit.scale / 输出目录 |
| 0.5 | 询问输出路径 | 锁定 `<output.dir>/<slug>` 与 `<assetsDir>/<slug>`，写入 `.d2c-tasks.md` |
| 0.3 | cache-check | 比对远端 lastModified，决定复用或重建 `.d2c-cache/<fileKey>/` |
| 1 | 解析 URL | 提取 fileKey + nodeId |
| 2 | 扫图层树 | `fetch-node --depth=2`，识别第一层 `sub-`，生成执行清单 |
| 2.5 | 页面级背景 | 顶层 frame 背景写 body（按 styleFormat × 多/单页 五档策略 P-A/P-B/M-A/M-B/J） |
| 2.6 | 前置切图 | 一次性切完全部 `img-`/`bg-` 节点 → slice-manifest；sub-agent 只消费清单 |
| 3 | 分发 sub-agent | 每个 `sub-` block 一个 |
| 3.5 | Rule-Scan 派发 | 每 block 先扫规则命中 → `rule-hits.json`（软防线） |
| 4 | sub-agent 出码 | 按前缀规则 + rule-hits 生成 JSX/SCSS；交付前跑 `check-rules --block` |
| 5 | 主 agent 合并 | flat/component 两种模式；展开 `<__SUBSLOT__>`；守恒律自证 |
| 6 | 合并验收 | 逐叶子 block 视觉对比 → 忠实度证明块 → 整 page `check-rules --merge` → 整体视觉 QA → 图片 URL 逐字符自检 → 写 `last-page.json` |
| 7 | 交付清单 | 汇总产物 / 待人工项 / 清理提示；cleanup-tmp 清临时截图 |

**验收有序不可调换**：先逐叶子 block 局部对比（修 sub-agent self-blind 偏差），再整体对比（看 block 间协调），两者关注点正交。

### data-node-id 生命周期

生成时注入 → 验收时对账 → 上线前 `pp-strip-nodeid` 剥离属性（同时把 nodeId →（file, startLine, endLine）转存 `.d2c-cache/anchors/`）→ 修复时 `pp-fix-partial` 消费锚点精确定位。

### cache 节点对账标注（loadCache 加载时打）

| 标注 | 含义 | 效果 |
|------|------|------|
| `_inBakedSubtree` | 祖先是 `bg-`/`img-`/`x-` | 像素已进 PNG，R02/R06 不再逐个溯源；R17 保证这些节点不出 DOM |
| `_hidden` | 自身或祖先 `visible=false` | 不参与对账 |
| `_templateDup` | `.map()` 列表同构兄弟的非首个数据副本 | 只校验代表项（variant a） |

> v1.2.1 特意把 `bgc-` 移出 `_inBakedSubtree`：bgc- 是盒级 CSS 写父、不是切图，其子孙误放的 TEXT 应被 R06/R21 暴露而非静默吞掉。

---

## 业务规则

### 三条核心原则

1. **忠实翻译，不做推断**：Figma 节点 JSON 是唯一事实源，可机械计算的量必须算对，禁止「看起来差不多」、禁止用「需人工核对」兜底数字量。
2. **封死逃逸口**：把每条已知逃逸路径（整体切图代替拆结构、凭空搓渐变代替切图、幻觉 padding）显式列为禁止项并用脚本拦截；豁免须留三段证据且单次 ≤3 条。
3. **自证代替信任**：每个环节交付前输出可复核证明（grep 自证、md5 溯源、守恒律差集），「我做了」不算数，「这是证据」才算。

### 双防线规则清单（R01–R22）

**硬防线 16 条**（check-rules.mjs，纯代码判定，exit 1 回滚；`--block` sub 交付前 + `--merge` 合并后两个时机）：

| 规则 | 拦什么 |
|------|--------|
| R01 fixed-position | `fixed-` 节点缺 `position: fixed` |
| R02 fills-image | fills 含 IMAGE 却凭空搓 gradient 代替切图 |
| R03 implicit-image | 无前缀子树含 ≥3 真矢量路径却没整体切图（极保守，排除可 CSS 化形状） |
| R04 text-gradient | TEXT 末位 GRADIENT/IMAGE 却用 solid 冒充（须 `background-clip:text`，与 R06 同机制） |
| R05 space-between | `SPACE_BETWEEN` 被 margin-auto/flex-end 模拟 |
| R06 text-solid-last | TEXT 多层 fills 取错层（应取末位可见 SOLID） |
| R08 bg-landing-form | `bg-` 用 `<img>`/inline/伪元素/空 div 挂载 |
| R09 btn-bgc-取值 | btn- 子树 bgc- 末位 GRADIENT 却用 solid 背景冒充 |
| R12 flat-mode-naming | flat 模式同名 class 顶层定义 ≥2 次（合并覆盖） |
| R14 fixed-z-index | ≥2 个 fixed- 却全缺 z-index 或全相同 |
| R16 no-flatten-text | 含 TEXT 容器被整体切图（文字烤进 PNG） |
| R17 no-baked-dom | baked 子树的子孙又出 DOM（双重渲染） |
| R18/R19/R20 | flex 方向 / padding / 绝对定位坐标 与 Figma×scale 不符 |
| R21 node-id-coverage | 应渲染节点漏挂 `data-node-id`（逃出全部对账） |

> **v1.2.3 起** R03/R04/R09/R12/R14 由软防线下沉硬防线，一律**保守判定**：触发不确定 / 无 className / baked·hidden·模板副本一律 skip，只在铁证违规时 exit 1（硬防线误判会阻断正确产物，比软防线漏报更伤）。

**软防线 5 条**（Rule-Scan sub-agent，LLM 语义识别，R07/R10/R11/R13/R15）：多层 fills、幻觉色、mask CSS 可表达性、单位换算、同构 map——判定需 LLM 语义或边界模糊（如"同构度""色是否幻觉"），故留软。

### 含 TEXT 容器的「压平 vs 拆」唯一裁决树（v1.2.0）

`bg-`/`img-` 前缀 → 压平（文字烤进 PNG，子孙禁止再出 DOM，R17 拦双重渲染）；其余含 TEXT 容器 → 拆结构（R16 禁止整体切图，TEXT 必须出 DOM）。二选一，无中间态。

### 缓存防污染四条硬规则

1. **fileKey 前缀隔离**：所有缓存路径带 `<fileKey>`，换稿子天然不串。
2. **覆写不追加**：cache 是当前真相快照，不留历史队列（`last-page.json` QA 失败不写）。
3. **单一写入源**：`last-page.json` 只主 SKILL 写、`anchors/` 只 pp-strip-nodeid 写、`cache-check` 每次只主 agent 调一次。
4. **失效靠比对不靠猜**：文件级 `lastModified`、图片级 md5 + bboxHash、修复场景 hash 对比 + 7 天 mtime TTL。

### 合并阶段忠实度四契约

1. **flat 合并忠实度**：sub-agent 落盘的 `blocks/*/index.tsx` 是唯一输入源，逐字展开，禁止替换成整体切图。
2. **data-node-id 守恒律**：S₁（sub 产物 id 集）⊆ S₂（最终产物 id 集），grep + comm 差集自证，丢一个即回滚。
3. **assets.txt 消费契约**：F₁（声明切了的图）⊆ F₂（产物实际引用的图），未引用 = 被偷换。
4. **合并忠实度证明块**：交付前必须输出结构化证明（守恒律、消费契约、硬规则聚合、字色溯源、尺寸源断言），任一 ❌ 即回滚；未输出证明块本身视为交付不合格。

### 门禁

violations > 0 一律禁止交付；`[整体切图兜底]` 标签废除；`[脚本误判]` 豁免单次 ≤3 条且须附三段证据（文件:行号 + grep 命令 + 命中内容）；生成流程禁用 `--force-skip`（仅维护者本地调试）。

---

## 关键流程

1. **前置切图（步骤 2.6）**：切图由「sub-agent 现切现挂」改为「主 agent 一次切完、sub-agent 只查清单」。切图源 nodeId 统一由脚本按前缀扫描，杜绝 sub-agent 拿父容器 nodeId 把兄弟文字烤进 PNG；清单带尺寸断言（png 实际尺寸 vs bbox×scale 差 >4px 写 `sizeWarning`），溢出图必须停下问用户。

2. **sub-agent 分块与「上报-派发」协议**：`sub-` 必须分发 sub-agent 无例外（单 agent 同时处理全局协调 + 局部细节时细节准确度急剧下降）。sub-agent 只扫直接子层的 `sub-`，在 JSX 写占位符 `<__SUBSLOT__ nodeId="..." name="..." />` 并落盘 `subslots.json` 上报；主 agent 读到后把内层 sub- 加入清单、下一轮重新进入流程。不允许 sub-agent 递归看更深。合并时从最深层深度优先展开，最终 `grep __SUBSLOT__` 必须为 0。

3. **逐节点对账（v1.2 范式）**：对每个应渲染节点核对 flex 方向（R18）、padding 数值（R19）、绝对定位坐标（R20）、字色取层（R06）、切图落地（R02）。可信前提是假阳性从根源清除（loadCache 三标注 + cssMatch 处理 SCSS `&__`/`&-` 嵌套类名匹配，实测假阳性 89→14）。**推论「报数即真值」**：假阳性来源已清除，「语义盲点 / 装饰性内容 / 父层整体切图承载」等批量豁免叙事失去事实基础。

4. **合并验收（步骤 5-6）**：四份机械契约封死「觉得复杂就简化」的历史事故；整 page 复跑 `check-rules --merge`（防类名冲突/幻觉色）、逐叶子 block 视觉对比（±2px/±1px/ΔE≤3 容忍表）、图片 URL 逐字符自检（唯一公式 `imageBaseUrl + assetsDir + filename` 字面拼接），全部通过才写 `last-page.json`。

---

## 关键设计取舍

- **为什么不做 AST Codegen**：传统 codegen 要覆盖「所有 Figma 节点形态 × 目标框架 × 样式方案」组合爆炸；LLM 天生擅长「规则 + 例子 → 代码」。代价是 LLM 不可靠——架构重心不在生成而在**约束**（规则写成禁止项、校验交给确定性脚本、豁免要证据）。演化成本低：改规则 = 改 md。
- **为什么前缀不可配置**：v1.0 前 `layers` 段可配，导致规则文档 / 校验脚本 / doctor / Rule-Scan 四处要同步读配置，任何不一致都是漏洞。硬编码后全链路一个常量表，设计师-开发者-脚本三方共享同一份协议。
- **为什么数字量禁止人工核对兜底**：`[需人工核对]` 只留给设计稿语义歧义（如「这文案是装饰还是要动态替换」）；坐标 / 尺寸 / 方向 / 间距都能从 Figma 字段机械推导，允许兜底 = 允许 agent 把算错的数交给用户擦屁股。
- **为什么校验层持续变厚**（v1.0 五条硬规则 → v1.2.1 十一条 → v1.2.3 十六条 + 对账基座）：每条新硬规则对应一起真实事故（test10-13 系列）。标准演化回路：事故 → 归因 → 先清假阳性来源（loadCache 标注）→ 再上硬规则（报数即真值）→ 封话术豁免口。防线厚度是用事故换来的，不是预设计出来的。

---

## 实现位置与对接方式

| 文件 | 内容 |
|------|------|
| `templates/skills/pp-d2c/SKILL.md` | 主流程操作手册（规则事实源） |
| `templates/skills/pp-d2c/rules/README.md` | 22 条规则索引 + 前缀常量表 + 排斥关系图 |
| `templates/skills/pp-d2c/rules/R01-R22.md` | 每条规则的触发条件 / 期望产物 / 反例 |
| `templates/skills/pp-d2c/bin/figma.mjs` | 数据层：verify-token / cache-check / fetch-node / export-image / screenshot / cleanup-tmp |
| `templates/skills/pp-d2c/bin/check-rules.mjs` | 硬防线：`--block` / `--merge` 两种模式，exit 0/1/2 |
| `templates/skills/pp-d2c/bin/lib/loadCache.mjs` | 对账基座：`_inBakedSubtree` / `_hidden` / `_templateDup` 标注 |
| `templates/skills/pp-d2c/bin/lib/cssMatch.mjs` | SCSS 嵌套类名匹配（R01/R02/R06/R18/R19 共享） |

**对接方式**：`pp-d2c-fast` 为本 skill 的快速模式变体（砍 A 梯队自证块，保留 R04 GRADIENT 与决策类 C 梯队），bin/ 与 rules/ 与 pp-d2c 逐字节一致；改造原理详见对应 topic。

---

## 来源文件

> 生成本终稿时实际读取的原始路径，便于溯源与后续更新。

- `docs/pp-d2c-principles.md`
