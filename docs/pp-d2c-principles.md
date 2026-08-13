# pp-d2c 原理

> 本文讲 **pp-d2c（H5 主 D2C skill）为什么这样设计、内部如何运转**。面向想理解或改造 skill 的开发者。
> 使用手册见 [`pixel-print-guide.md`](./pixel-print-guide.md)；图层命名规范见 [`design-guide.md`](./design-guide.md)；规则明细以 `templates/skills/pp-d2c/SKILL.md` + `rules/*.md` 为准（冲突时以 `rules/` 为准）。

---

## 目录

1. [核心哲学](#1-核心哲学)
2. [四层架构](#2-四层架构)
3. [执行流水线（步骤 -1 → 7）](#3-执行流水线步骤--1--7)
4. [图层前缀：设计师意图的机读协议](#4-图层前缀设计师意图的机读协议)
5. [sub-agent 分块模型](#5-sub-agent-分块模型)
6. [双防线：Rule-Scan 软防线 + check-rules 硬防线](#6-双防线rule-scan-软防线--check-rules-硬防线)
7. [以 cache 为真值的逐节点对账（v1.2 校验范式）](#7-以-cache-为真值的逐节点对账v12-校验范式)
8. [data-node-id：贯穿全流程的追溯锚点](#8-data-node-id贯穿全流程的追溯锚点)
9. [缓存体系与防污染](#9-缓存体系与防污染)
10. [合并阶段的忠实度契约](#10-合并阶段的忠实度契约)
11. [关键设计取舍](#11-关键设计取舍)

---

## 1. 核心哲学

pp-d2c 的所有机制都收敛到一句话：

> **允许兜底的路径就是错误来源；校验以 cache 为唯一真值逐节点对账，而非抽查已知坏味道。**

拆开是三条原则：

1. **忠实翻译，不做推断**。Figma REST API 返回的节点 JSON 是唯一事实源：`layoutMode=VERTICAL` 就写 `flex-direction: column`，`paddingTop=166` 就写 `332px`（×scale），`SPACE_BETWEEN` 就写 `justify-content: space-between`。凡是能从 Figma 机械计算的量（坐标、尺寸、方向、间距、色值），必须算对，禁止"看起来差不多"、禁止用「需人工核对」兜底交付。
2. **封死逃逸口**。LLM 生成代码的典型失败不是"不会写"，而是"遇到麻烦时悄悄绕过规则"（整体切图代替拆结构、凭空搓渐变代替切图、幻觉 padding）。skill 的应对是把每条已知逃逸路径显式列为禁止项，并用机械脚本拦截——豁免必须留下三段证据且单次 ≤3 条。
3. **自证代替信任**。每个环节交付前都要输出可复核的证明（grep 自证、md5 溯源、守恒律差集），"我做了"不算数，"这是证据"才算数。

## 2. 四层架构

| 层 | 载体 | 职责 | 确定性 |
|---|---|---|---|
| **数据层** | `bin/figma.mjs` | Figma REST API 封装：token 探针、节点拉取、图片导出、截图、缓存管理。stdout 一行 JSON（`{ok, data}` / `{ok, error}`），退出码 0/非 0 | 命令式代码，完全确定 |
| **规则层** | `SKILL.md` + `rules/R01-R22.md` | 自然语言操作手册：前缀语义、布局判定树、切图契约、单位换算、验收清单。SKILL.md 保留总概表，硬规则详情在 `rules/`（冲突以 rules/ 为准） | 文档，靠 LLM 遵守 |
| **执行层** | LLM（Claude Code / Codex） | 读规则 → 调数据层 → 产出 JSX/SCSS → 自检 → 视觉对比 | 概率性，是所有防线要约束的对象 |
| **校验层** | `bin/check-rules.mjs` + `bin/lib/*` | 硬防线：以 `.d2c-cache` 节点 JSON 为真值，逐节点对账产物代码，违规 exit 1 强制回滚 | 命令式代码，完全确定 |

设计意图：**把机械动作从 LLM 手里拿走**（HTTP、缓存、下载、校验都是脚本），LLM 只做它擅长的"理解结构 + 产出代码"；而 LLM 产出的正确性再交还给确定性脚本验收。两个确定层夹住一个概率层。

关键契约：

- **SKILL.md 是 LLM 操作手册，不是可执行代码**。文中"派发 sub-agent"、"上报"都是隐喻——全程只有一个 LLM agent 按步骤顺序执行，"派发"= 重新进入 §4.0 流程换根节点，"上报"= 写磁盘文件下一轮自己读。`<__SUBSLOT__>` 占位符和 `subslots.json` 是真实落盘的字符串/文件。
- 完全走 Figma REST（一枚 Personal Access Token），无 MCP、无 OAuth；REST 只返回原始节点 JSON，前缀规则永远优先，不受任何"AI 生成的参考代码"干扰。

## 3. 执行流水线（步骤 -1 → 7）

```
-1  verify-token        Token 探针（/v1/me），失败即终止
 0  读 pp-d2c.config.json  缓存 projectRoot / styleFormat / unit.scale / 输出目录等
 0.5 询问输出路径        锁定 <output.dir>/<slug> 与 <assetsDir>/<slug>，写入 .d2c-tasks.md
 0.7 cache-check        比对远端 lastModified，决定复用或重建 .d2c-cache/<fileKey>/
 1  解析 URL            提取 fileKey + nodeId
 2  扫图层树            fetch-node --depth=2；识别第一层 sub-；生成 .d2c-tasks.md 执行清单
 2.5 页面级背景          顶层 frame 背景写 body（按 styleFormat×多/单页 五档策略 P-A/P-B/M-A/M-B/J）
 2.6 前置切图            一次性切完全部 img-/bg- 节点 → slice-manifest；sub-agent 只消费清单
 3  并行分发 sub-agent   每个 sub- block 一个
 3.5 Rule-Scan 派发      每 block 先扫规则命中 → rule-hits.json（软防线）
 4  sub-agent 出码       按前缀规则 + rule-hits 生成 JSX/SCSS；交付前跑 check-rules --block
 5  主 agent 合并        flat/component 两种模式；展开 <__SUBSLOT__>；守恒律自证
 6  合并验收             逐叶子 block 视觉对比 → 忠实度证明块 → 整 page check-rules --merge
                        → 整体视觉 QA → 图片 URL 逐字符自检 → 写 last-page.json
 7  交付清单            汇总产物/待人工项/清理提示；cleanup-tmp 清临时截图
```

几个流水线设计点：

- **前置切图（2.6）**：切图从"sub-agent 现切现挂"改为"主 agent 一次切完、sub-agent 只查清单"。收益：切图源 nodeId 统一由脚本按前缀扫描，杜绝 sub-agent 拿父容器 nodeId 切图把兄弟文字烤进 PNG；清单带尺寸断言（png 实际尺寸 vs bbox×scale 差 >4px 写 `sizeWarning`），溢出图必须停下问用户而非直接用。**v1.2.4 起步骤 2.6 是硬门禁**：reskin-slice 切图失败即 hard stop，禁止手工绕过续跑；切图完成后进入**确认暂停**——config 新键 `slice.confirmBeforeContinue` 默认 `true`，切完停下等用户确认切图结果再出码；`sizeWarning` 非空时不受该开关豁免，一律必停。
- **micro-sub 快路径与同构 sub- 合并（v1.2.4）**：满足 ≤8 节点等 4 条件的微型 sub- block 由主 agent 内联出码，砍掉小 block 独立派发的固定成本（实测约 4 分钟/块）；同层同构的 sub- block 合并为代表项模板 `.map()` 渲染，只出一份代码。分块模型（§5）的质量收益保留给真正复杂的 block。
- **`.d2c-tasks.md` 是流程的持久化状态机**：输出路径锁定、样式大类锁定（P/M/J 三选一，config `styleFormat` 唯一权威）、block 树状清单、页面背景决策依据，全部落盘。sub-agent 开工前必须先读锁定段，禁止各自重新判定——防止多 agent 判断漂移。
- **验收有序不可调换**：先逐叶子 block 局部对比（sub-agent 的自我验收有 self-blind 偏差，主 agent 必须重看），再整体对比（看 block 间协调），两者关注点正交。

## 4. 图层前缀：设计师意图的机读协议

D2C 最难的不是翻译样式，是**猜意图**：哪块该切图、哪块该拆 DOM、哪块可点击。pp-d2c 的答案是不猜——让设计师用图层名前缀把意图显式写进稿子，前缀是 skill **硬编码的内置常量**（config 里没有 `layers` 段，不可配置）：

| 前缀 | 语义 | 关键行为 |
|---|---|---|
| `sub-` | 分块边界 | 唯一触发 sub-agent 分发的前缀；仅用于分块，不影响渲染 |
| `block-` | 独立布局块 | 类名命名空间隔离 |
| `img-` | 图片内容 | 整层导出 `<img>`，**不递归子层** |
| `bg-` | 背景图 | 切图挂**父元素** `background-image`，自身不生成 DOM，不递归 |
| `bgc-` | 盒级装饰 | fills/strokes/cornerRadius/effects 全套 CSS 写父，自身不生成 DOM |
| `btn-` | 可点击 | 永远 CSS 化（不切图） |
| `input-` | 输入框 | 生成 `<input type="text">`，子 TEXT 变 placeholder，不递归 |
| `scrollx-`/`scrolly-` | 滚动容器 | overflow + 隐藏滚动条，**继续递归**；同构 ≥3 强制 `.map()` |
| `fixed-` | 视口固定 | 修饰前缀，`position: fixed` + constraints 推方位 |
| `end-` | 贴父末端 | 修饰前缀，wrapper + `space-between` 机制 |
| `x-` | 忽略 | 跳过整层，优先级最高 |

配套机制：

- **多前缀组合**：从左到右扫描全名提取所有前缀，各自贡献语义（`sub-btn-img-hero` = 分块 + 可点击 + 图片）。组合有优先级（`x-` > `img-` > `bg-` > `bgc-` > `btn-` > 滚动 > 无前缀兜底），互斥组合（如 `fixed-`×`bg-`）由 doctor 报错。
- **裸词三态判定**：`bg`/`bgc`/`btn`/`img`/`input` 五个词允许独立裸词（whole word）等同前缀；`background`/`button` 这类"含词非裸词"不识别，走无前缀兜底——防止子串误匹配。
- **无前缀兜底**是收敛的：TEXT → `<span>`；fills 含 IMAGE → 切图挂父；其余一律 CSS 化。没有"agent 自由发挥"的空间。

**含 TEXT 容器的「压平 vs 拆」唯一裁决树**（v1.2.0）：`bg-`/`img-` 前缀 → 压平（文字烤进 PNG，子孙禁止再出 DOM，R17 拦双重渲染）；其余含 TEXT 容器 → 拆结构（R16 禁止整体切图，TEXT 必须出 DOM）。二选一，没有中间态，不允许 agent 两头下注。

## 5. sub-agent 分块模型

**为什么拆**：不是性能优化，是**质量保证**。单 agent 同时处理"全局协调 + 局部细节"时细节准确度急剧下降（实测单 agent 串行生成的 sub-card 内部尺寸/对齐/字号偏差比拆分后高 3-5 倍）。因此 `sub-` 必须分发 sub-agent **无任何例外**——哪怕整稿只有 1 个 sub-、哪怕内容看起来简单。

**职责边界**：

- 主 agent：分块识别、清单维护、前置切图、合并、QA。**不写** sub- 内部的 JSX/CSS。
- sub-agent：单个 block 的出码 + 自验收。**不派孙**、不改 `todo/清单`、不绕清单自切图。

**嵌套 sub-（最深 3 层）的"上报-派发"协议**：sub-agent 只扫自己**直接子层**的 sub-，在 JSX 里写真实占位符 `<__SUBSLOT__ nodeId="..." name="..." />`，同时落盘 `subslots.json` 上报；主 agent 读到后把内层 sub- 加入清单、下一轮重新进入 §4.0 处理。**不允许 sub-agent 递归看更深**——每层独立上下文，避免单个 agent 把整棵子树都装进头里重蹈"细节退化"覆辙。合并时从最深层开始深度优先展开占位，最终 `grep __SUBSLOT__` 必须为 0。

**sub-agent 产物结构**：`blocks/{label}/index.tsx + index.scss + assets.txt (+ subslots.json + rule-hits.json)`。`assets.txt` 兼任 QA 档案：切图 3 行溯源（API 参数/返回 URL/落盘尺寸+md5）、rule-hits 消费证明、`[遗漏补捕]`/`[脚本误判]`/`[需人工核对]` 告警。

**问题边界**：agent 全程**只允许问业务问题**（交互状态、数据来源、跳转链接——设计稿推不出来的），**禁止问 skill 已定死的技术决策**（要不要切图、取哪层 fills、类名冲突怎么办）。未覆盖的边界情形按最接近规则兜底 + 写 `[需人工核对]` 告警，仅当产物完全不可用（token 失效、稿子 404、config 缺失）才停下问用户。

## 6. 双防线：Rule-Scan 软防线 + check-rules 硬防线

22 条规则（R01-R22）按"可否机械判定"分成两道防线。**v1.2.3 起**：软防线里机械可判的 5 条（R03/R04/R09/R12/R14）下沉硬防线，软防线只剩需 LLM 语义判定的 R07/R10/R11/R13/R15。**v1.2.4 起**：新增 R22（warning 级）与 GATE-rule-hits / IMG-reconcile 两道门禁，exit-1 规则数维持 16 条。

**软防线 = Rule-Scan sub-agent**（步骤 3.5，覆盖 R07/R10/R11/R13/R15 语义类规则）。每个 block 出码前，先派一个只做规则识别、不写 UI 的 agent：读软防线 `rules/*.md` + block 的 cache JSON，输出 `rule-hits.json`（每条 hit 带 nodeId/trigger/expected）。UI sub-agent 按 hits 的 `expected` 落地，发现漏扫允许自补但必须记 `[遗漏补捕]`。挂了先重派一次，二次挂降级为 UI sub-agent 自己读规则库（硬防线不受影响）。**页面无 sub- 时同样触发**（v1.2.2）：主 agent 出码前把「页面根」当虚拟 block 对整页跑一次 Rule-Scan，`rule-hits.json` 落页面根目录——软防线覆盖不依赖设计师是否标了 sub-。**v1.2.4 恢复全量扫描出指引**：Rule-Scan 对全部规则（含已硬化条目）扫描并写入 rule-hits 作生成前作业指引——软 5 条仍是唯一判定点，硬防线规则的命中只帮出码 agent 提前避坑，判决权在 check-rules（指引与判决分离，扫多不越权）。

> 为什么软规则要独立 agent：识别"复合 mask CSS 表达不了该切图"（R11）、"同层 ≥3 同构该 `.map()`"（R15）这类判断需要 LLM 语义能力，但**让出码 agent 边写边判会漏**——先扫出作业指引再动笔，识别与实现解耦。R03/R15 这类"是不是同构""算不算隐式图"曾是软防线的模糊地带，v1.2.3 把其中触发条件可机械收窄的（R03 用 ≥3 真矢量路径阈值等）下沉硬防线，真正判不了的（R11 表达可能性、R15 同构度）留软。

**硬防线 = check-rules.mjs**（16 条）。纯代码判定，两个时机强制执行：sub-agent 交付前 `--block blocks/{sub}/`，主 agent 合并后 `--merge pages/{page}/`。exit 1 = 回滚重做，禁止带违规进入交付。

**硬防线 16 条**（`check-rules.mjs` 机械判定，违规 exit 1 回滚；详情 `rules/README.md`）：

| 规则 | 触发条件（cache 侧） | 做什么 / 拦什么 |
|---|---|---|
| R01 fixed-position | 节点名以 `fixed-` 开头 | 产物 CSS 必须含 `position: fixed`，方位按 Figma constraints 推导 |
| R02 fills-image | fills 含可见 `IMAGE` | 必须有切图记录（assets.txt）且产物实际引用该图；拦"凭空搓 gradient 代替切图" |
| R03 implicit-image | 无前缀 + 子树含 ≥3 真矢量路径（VECTOR/BOOL），无 TEXT/交互子层 | 极保守判"该整体切图却没切"；RECTANGLE/ELLIPSE 等可 CSS 化形状不计入"必切"信号 |
| R04 text-gradient | TEXT 末位可见 fill 为 `GRADIENT_*`/`IMAGE` | 必须走 `background-clip: text`；拦 solid color 冒充渐变/图案字（与 R06 同机制） |
| R05 space-between | `primaryAxisAlignItems === 'SPACE_BETWEEN'` | 必须写 `justify-content: space-between`；对 margin-auto / flex-end 等模拟写法报 warning |
| R06 text-solid-last | TEXT 节点末位可见 fill 为 `SOLID` | `color` 必须取末位可见 SOLID 的色值；拦多层 fills 取错层 |
| R08 bg-landing-form | 节点名以 `bg-` 开头（或裸词 `bg`） | 只能落成父元素 `background-image`；拦 `<img>` / inline style / 伪元素 / 空 div 挂载 |
| R09 btn-bgc-取值 | `btn-` 子树含 `bgc-` 且其末位可见 fill 是 `GRADIENT_*` | btn/bgc 的 CSS background 必须用 gradient 形态；拦 solid 冒充渐变（不校验具体色值，保守） |
| R12 flat-mode-naming | `merge.mode === 'flat'` | 同名 class 顶层定义 ≥2 次即冲突（合并覆盖）；拦跨 block 重名 |
| R14 fixed-z-index | ≥2 个 `fixed-` 节点 | 保守只拦"全部缺 z-index"或"全部 z-index 相同"；不强求具体递增序 |
| R16 no-flatten-text | 容器子树含 TEXT 且前缀不在 `img-`/`bg-` 白名单 | 禁止整体切成 `<img>`（文字烤进 PNG），必须拆结构、TEXT 出 DOM |
| R17 no-baked-dom | 节点 `_inBakedSubtree`（祖先是 `bg-`/`img-`/`x-`） | 像素已烤进父层 PNG（或被 x- 忽略），产物不得再出现其 data-node-id；拦双重渲染 |
| R18 flex-direction | autolayout 容器（`layoutMode` 存在） | VERTICAL → `flex-direction: column`，HORIZONTAL → 不得写 column；拦方向写反 |
| R19 padding | autolayout 容器声明了 padding，或产物写了 padding | CSS 四值 ≈ Figma paddingT/R/B/L × scale（容差 2px）；拦凭空捏造 / 漏写 / 数值错 |
| R20 absolute-position | `layoutPositioning === 'ABSOLUTE'`（非 fixed-） | top/left ≈ (子 bbox − 父 bbox) × scale（容差 4px）；拦坐标靠猜。v1.2.4 增强：同时强制该节点 CSS 声明 `position: absolute`（此前只对数值，`position: relative` 也能混过） |
| R21 node-id-coverage | 应渲染节点（TEXT / autolayout 容器 / ABSOLUTE / img-·btn-·input-） | 产物 JSX 必须挂 data-node-id，否则 R06/R18/R19/R20 全绑定不上、bug 静默逃逸；优先级最高的兜底规则 |

> v1.2.3 新硬化的 5 条一律**保守判定**（宁漏报不误判）：触发不确定、不可追溯（无 className）、baked/hidden/模板副本一律 skip，只在铁证违规时 exit 1——因为硬防线误判会阻断正确产物，比软防线漏报更伤。

**v1.2.4 加固**（exit-1 规则数维持 16 条）：

- **R22 empty-visual-btn（warning 级）**：`btn-` 节点在产物里既无文字又无任何视觉声明（背景/边框/切图）时报"空视觉按钮嫌疑"——典型根因是内容在数据侧被截断丢失，按钮退化成透明热区。空视觉在少数设计里合法（如纯热区叠加在 bg- 上），故保守用 warning 进 `warnings` 不阻断，不计入 16 条 exit-1 规则。
- **GATE-rule-hits 门禁（error）**：`rule-hits.json` 缺失即 exit 1（二次降级也须落 `v0.3.21-fallback` 占位）；并检测捏造——文件缺失但 assets.txt 已写"rule-hits 消费证明"时在违规详情点名"疑似捏造"。背景：test24-27 实测 agent 跳过 Rule-Scan 并在 assets.txt 捏造"§3.5 允许合并到 UI 侧"许可，文本约束拦不住，此处机械兜底。
- **IMG-reconcile 三方对账（--merge 时执行）**：产物图片引用必须来自 slice-manifest（步骤 2.6 只消费清单契约）——产物引用 ∉ manifest 即 violation（疑似绕清单手工切图）；manifest 条目未被引用报 warning（可能隐藏层/被裁，不阻断）；动态拼接的文件名碎片按后缀匹配保守放行；manifest 缺失时 warning 跳过（旧项目/无图页面不硬卡）。
- **`--block` 局部化**：`--root <nodeId>` 显式指定或从产物 data-node-id 推断 LCA，把 cache 裁剪到 block 子树再对账——R21/R03 等全树规则只看 block 内节点，消除对 block 外节点的全量误报（此前 --block 校验单个 block 却拿整页 cache 遍历，报出的多是别的 block 的"违规"）。

**软防线 5 条**（Rule-Scan sub-agent 语义识别，输出 `rule-hits.json` 作 UI sub-agent 的作业指引，不 exit 1）：

| 规则 | 触发条件 | 做什么 |
|---|---|---|
| R07 multi-fills | fills ≥2 层可见且不全是 SOLID | 多层填充按 Figma 叠加顺序合成 CSS 多值 background，不丢层 |
| R10 no-fake-solid-color | 产物 CSS 色值在 cache 里找不到源头节点 | 拦"幻觉色"——渐变插值/半透明叠加/hover 态使代码难判，故留软 |
| R11 mask-vector-css-able | 复合 mask / 多层 vector，CSS 表达不了 | 判定"该切图"而非硬写 CSS 近似（简单矩形/圆形除外） |
| R13 unit-scale | `unit.scale ≠ 1` 而产物 px 与 Figma 原值相同 | 强制单位换算（× outputBase/figmaBase）；与 R19/R20 对账重叠，故留软 |
| R15 同构 map 渲染 | 同层 ≥3 个同构子节点 | 必须 `.map()` 模板渲染；"同构度"边界模糊难机械判，故留软 |

## 7. 以 cache 为真值的逐节点对账（v1.2 校验范式）

v1.2 之前的校验是"黑名单抽查"——列举已知坏味道去 grep。问题：抽查永远滞后于新逃逸方式，且假阳性靠人肉甄别，agent 会借"脚本误判"话术批量豁免真违规。

v1.2 的升级是把校验换成**对账**：`.d2c-cache/<fileKey>/nodes/*.json` 是真值账本，产物代码是待核账目，`data-node-id` 是把两者关联起来的凭证号。对每个应渲染节点核对：flex 方向对不对（R18）、padding 数值对不对（R19）、绝对定位坐标对不对（R20）、字色取的哪层（R06）、切图有没有落地（R02）。

对账可信的前提是**假阳性从根源清除**，由 `bin/lib/loadCache.mjs` 在加载 cache 时给每个节点打三个标注：

| 标注 | 含义 | 效果 |
|---|---|---|
| `_inBakedSubtree` | 祖先是 `bg-`/`img-`/`x-`（整体切图/忽略） | 像素已进 PNG，R02/R06 不再逐个溯源；反过来 R17 保证这些节点**不出 DOM** |
| `_hidden` | 自身或祖先 `visible=false` | 不参与对账 |
| `_templateDup` | `.map()` 列表同构兄弟的非首个数据副本 | 只校验代表项（variant a），副本忠实度由"同一模板"保证 |

（v1.2.1 特意把 `bgc-` 移出 `_inBakedSubtree`：bgc- 是盒级 CSS 写父、不是切图，其子孙误放的 TEXT 应被 R06/R21 暴露而非静默吞掉。）

再配 `bin/lib/cssMatch.mjs` 统一处理 SCSS `&__foo`/`&-foo` 嵌套写法的类名匹配——修掉"产物用嵌套写法、正则找平铺类"的全线盲区。实测假阳性 89 → 14（test13）。

**推论：报数即真值**。既然假阳性来源已在 loadCache 层清除，"语义盲点/装饰性内容/父层整体切图承载"这些批量豁免叙事失去事实基础——R02 报的就是真遗漏、R17 报的就是真双渲染。配套门禁：violations > 0 一律禁止交付；`[整体切图兜底]` 标签废除；`[脚本误判]` 豁免单次 ≤3 条且必须附三段证据（文件:行号 + grep 命令 + 命中内容）；生成流程禁用 `--force-skip`（仅供维护者本地调试）。

## 8. data-node-id：贯穿全流程的追溯锚点

每个承载 Figma 语义的 DOM 元素都挂 `data-node-id="<figma nodeId>"`，它同时服务四件事：

1. **对账绑定**（§7）：check-rules 靠它把产物元素绑回 cache 节点。没挂 id = 逃出全部对账，所以 R21 把"全覆盖"变成硬规则（应渲染节点漏挂即 exit 1）。`.map()` 模板项挂代表项（variant a）的 id；唯一例外是 Figma 里不存在源节点的虚拟 wrapper（如 `end-` 机制的 `__front-group`）。
2. **守恒律**（§10）：合并阶段用 id 集合差集机械判定"主 agent 有没有偷换 sub-agent 产物"。
3. **review 反查**：看产物任意 DOM 直接拿 id 回 Figma 定位图层。
4. **局部修复定位**：上线前 `pp-strip-nodeid` 剥离属性时顺手把 nodeId → (file, startLine, endLine) 存进 `.d2c-cache/anchors/`，后续 `pp-fix-partial` 靠锚点精确定位要重跑的代码块。

生命周期：生成时注入 → 验收时对账 → 上线前剥离（转存锚点档案）→ 修复时消费锚点。

## 9. 缓存体系与防污染

```
.d2c-cache/
├── <fileKey>/
│   ├── meta.json            ← lastModified 快照（cache-check 比对依据）
│   ├── nodes/<nodeId>.json  ← 节点子树 JSON（对账真值）
│   ├── images.json          ← nodeId → {path, md5, bboxHash} 切图台账
│   └── slice-manifest-<slug>.json  ← 前置切图清单
├── anchors/<pageDirSlug>.json      ← pp-strip-nodeid 写，pp-fix-partial 读
└── last-page.json                  ← 主 SKILL 写（QA 通过才写），pp-fix-partial 无参定位用
```

防污染四条硬规则：

1. **fileKey 前缀隔离**：所有缓存路径带 `<fileKey>`，换稿子天然不串。
2. **覆写不追加**：cache 是"当前真相"快照，不留历史队列（last-page.json 同理，QA 失败不写，避免把失败结果标成"最近实现"）。
3. **单一写入源**：`last-page.json` 只主 SKILL 写、`anchors/` 只 pp-strip-nodeid 写、pp-fix-partial 只读；`cache-check` 每次运行只主 agent 调一次，sub-agent 只读。
4. **失效靠比对不靠猜**：文件级 `lastModified`、图片级 md5 + bboxHash（同 nodeId 但导出参数变了也算失效）、修复场景 hash 对比 target 子树 + 7 天 mtime TTL。

切图复用契约（§4.4.0）：查 `images.json` → 无记录直接切；有记录算磁盘 md5 与台账比对，相等才复用，不等/缺文件强制重切。**禁止**"看到 assetsDir 里有同名文件就跳过"——文件名相同不代表内容正确。导出默认带 `use_absolute_bounds=true`（严格按 bbox 裁掉 effect 外扩和画板底色，否则 gap/margin 全算不准）。

## 10. 合并阶段的忠实度契约

合并（步骤 5-6）是历史事故高发区：主 agent 拿到 N 份 sub-agent 产物后，倾向于"觉得复杂就简化"——用父容器一张大图替代拆好的结构。skill 用四份机械契约封死：

1. **flat 合并忠实度**（§5.0.pre）：sub-agent 落盘的 `blocks/*/index.tsx` 是唯一输入源，逐字展开；禁止替换成整体切图、禁止把 `<button>` 折叠成 `<img>`。每展开一个 block 前输出反向自检 4 行。
2. **data-node-id 守恒律**（§5.1）：S₁（sub-agent 产物 id 集）⊆ S₂（最终产物 id 集），grep + comm 差集自证，丢一个即回滚。
3. **assets.txt 消费契约**（§6.0.1）：F₁（声明切了的图）⊆ F₂（产物实际引用的图），未引用 = 被偷换，同样差集自证。
4. **合并忠实度证明块**（§6.0.2）：交付前必须在对话输出结构化证明（守恒律、消费契约、硬规则聚合、字色溯源、min-height/padding-top 尺寸源断言……），任一 ❌ 即回滚。未输出证明块本身就视为交付不合格。

之后整 page 复跑 `check-rules --merge`（防合并引入类名冲突/幻觉色）、逐叶子 block 视觉对比（±2px/±1px/ΔE≤3 容忍表）、图片 URL 逐字符自检（唯一公式 `imageBaseUrl + assetsDir + filename` 字面拼接，不修剪不补斜杠），全部通过才写 `last-page.json` 进入交付。

## 11. 关键设计取舍

**为什么不做 AST Codegen**：传统 codegen 要覆盖"所有 Figma 节点形态 × 所有目标框架 × 所有样式方案"，组合爆炸；而 LLM 天生擅长"规则 + 例子 → 代码"。代价是 LLM 不可靠——所以架构重心不在生成而在**约束**：规则写成禁止项清单、校验交给确定性脚本、豁免要证据。演化成本也低：改规则 = 改 md 文件。

**为什么前缀不可配置**：v1.0 前 `layers` 段可配，结果是规则文档、校验脚本、doctor、Rule-Scan 四处要同步读配置，任何不一致都是漏洞。硬编码后全链路一个常量表（`rules/README.md`），设计师-开发者-脚本三方共享同一份协议。

**为什么"数字量禁止人工核对兜底"**：`[需人工核对]` 只留给设计稿语义歧义（如"这文案是装饰还是要动态替换"）；坐标/尺寸/方向/间距都能从 Figma 字段机械推导，允许兜底就等于允许 agent 把算错的数交给用户擦屁股——这正是"允许兜底的路径就是错误来源"的由来。

**为什么校验层持续变厚**（v1.0 五条硬规则 → v1.2.1 十一条 → v1.2.3 十六条 + 对账基座 → v1.2.4 维持 16 条 exit-1 规则 + R22 warning + GATE-rule-hits / IMG-reconcile 两道门禁）：每条新硬规则都对应一起真实事故（test10-13 系列）。事故 → 归因 → 先清假阳性来源（loadCache 标注）→ 再上硬规则（报数即真值）→ 封话术豁免口，是这个 skill 的标准演化回路。防线厚度是用事故换来的，不是预设计出来的。

---

## 相关文件索引

| 文件 | 内容 |
|---|---|
| `templates/skills/pp-d2c/SKILL.md` | 主流程操作手册（本文的规则事实源） |
| `templates/skills/pp-d2c/rules/README.md` | 22 条规则索引 + 前缀常量表 + 排斥关系图 |
| `templates/skills/pp-d2c/rules/R01-R22.md` | 每条规则的触发条件/期望产物/反例 |
| `templates/skills/pp-d2c/bin/figma.mjs` | 数据层：verify-token / cache-check / fetch-node / export-image / screenshot / cleanup-tmp |
| `templates/skills/pp-d2c/bin/check-rules.mjs` | 硬防线：`--block` / `--merge` 两种模式，exit 0/1/2 |
| `templates/skills/pp-d2c/bin/lib/loadCache.mjs` | 对账基座：`_inBakedSubtree` / `_hidden` / `_templateDup` 标注 |
| `templates/skills/pp-d2c/bin/lib/cssMatch.mjs` | SCSS 嵌套类名匹配（R01/R02/R06/R18/R19 共享） |
| `docs/pixel-print-guide.md` | 产品级完整指南（安装/配置/CLI/案例） |
| `docs/design-guide.md` | 给设计师的图层命名规范 |
