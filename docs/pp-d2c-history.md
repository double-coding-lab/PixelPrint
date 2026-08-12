# pp-d2c skill 版本演进史（时间逆序）

> 从今天回溯到 2026-06-17 项目起点的 **pp-d2c skill 版本编年史**。考据源：`git log`（早期匿名 commit 按文件 diff 还原）+ 各时点 SKILL.md 快照。
> 本文只记 **pp-d2c skill 版本线**（`SKILL.md` 头部版本）与配套能力演进；npm 包（CLI / install / 分发）的发布版本不在本文范围，见 `package.json` 与 [`pixel-print-guide.md §14`](./pixel-print-guide.md#14-版本历史)。
> 原理性内容（防线设计、对账范式的为什么）见 [`pp-d2c-principles.md`](./pp-d2c-principles.md)。

---

## 2026-08-12 · pp-d2c-fast 快速模式 skill（开发中）

- `pp-d2c-fast`：拷 pp-d2c 砍冗余自证（A 梯队）的精简版，保留全部决策引导与硬防线，原 pp-d2c 不动、二者并存（未合入 main）
- 新增 `docs/pp-d2c-history.md`（本文）

## 2026-08-12 · 配套：SKILL 模板 frontmatter + Codex 支持 + 原理文档

- **9 个 SKILL 模板补 YAML frontmatter**（`name`/`description`）——`install.js` 双写是原样拷贝，模板缺 frontmatter 导致 Codex 认不出 skill；源头补齐后 `.claude/skills` 与 `.codex/skills` 两端都合规
- **init/install 支持 Codex**：skill 无条件双写 `.claude/skills/` 与 `.codex/skills/`（两处镜像），单位换算规则注入同步双写
- 新增 [`pp-d2c-principles.md`](./pp-d2c-principles.md) 原理文档；README / guide 同步 Codex 说明与文档入口

## 2026-08-12 · skill v1.2.1

- **R21 node-id-coverage**：应渲染节点漏挂 `data-node-id` 即 exit 1——堵住 R18/R19/R20 遇空 classMap 静默 continue 的逃逸口
- `_inBakedSubtree` 移除 `bgc-`（盒级 CSS 非切图，子孙误放 TEXT 应被 R06/R21 暴露而非静默吞）
- 生成流程禁用 `--force-skip`（仅留维护者本地调试）

## 2026-08-12 · skill v1.2.0（范式跃迁：抽查 → 对账）

- 校验范式从「黑名单抽查」升级为**以 cache 为真值的逐节点对账**：`loadCache.mjs` 三标注（`_inBakedSubtree`/`_hidden`/`_templateDup`）从根源清除假阳性（test13 实测 89→14），从此「报数即真值」
- `cssMatch.mjs` 统一 SCSS `&__foo` 嵌套匹配，修掉"产物嵌套写法、正则找平铺类"全线盲区
- 新增 4 条对账硬规则：**R17**（baked 子孙禁双重渲染）/ **R18**（flex 方向忠实）/ **R19**（padding 忠实）/ **R20**（绝对定位坐标忠实）
- §5.1.1 data-node-id 全覆盖铁律；§4.3 含 TEXT 容器「压平 vs 拆」唯一裁决树；封话术豁免口（可机械计算的量禁用「需人工核对」）

## 2026-08-11 · skill v1.1.0（堵第一批逃逸口）

- **R16 no-flatten-text**：含 TEXT 容器禁止整体切图（文字烤进 PNG 是当时最大事故源）
- **兜底门禁 N=0**：check-rules exit 1 一律禁止交付，废除 `[整体切图兜底]` 自签豁免；`[脚本误判]` 限三段证据 ≤3 条
- **Step 2.6 前置切图**：主 agent 一次切完出 slice-manifest（复用 reskin-slice.mjs）+ bg 溢出尺寸断言；sub-agent 只消费清单禁自切
- Step 0.5 询问输出路径并落盘锁定；`config.styleFormat` 成为样式大类唯一权威（废除"跟邻居 page 走"）

## 2026-08-11 · skill v1.0.0（防线奠基）+ 周边收编

- **散落各章节的硬规则收编为 `rules/R01-R15` 独立规则库**，SKILL.md 大砍细节只留总概表（冲突以 rules/ 为准）
- **`check-rules.mjs` 硬防线脚本诞生**（硬编码 R01/R02/R05/R06/R08，exit 1 拦截）+ **Rule-Scan 软防线**（出码前独立 agent 扫 `rule-hits.json` 作业指引）——合称「4 层防线」
- 图层前缀由 config 配置项**降级为内置常量**（四处同步读配置的不一致漏洞根除）
- 删掉步骤 0.5 前置体检（doctor 解耦出主流程）；同期新增 **pp-d2c-reskin**（换肤批量切图）与 **pp-image-compress**（无损压缩）两个配套 skill

## 2026-08-07 ~ 08-10 · skill v0.3.5-v0.3.21（事故修复冲刺）

**真实业务页面跑出来的事故密集期**，这四天几乎每个 skill 小版本都对应一次真实翻车。v1.0.0 防线体系里的机制几乎全部在这四天试炼成型：

| skill 版本 | 修了什么 |
|---|---|
| v0.3.5 | 独立裸词规则（`bg`/`btn`/`img` 等 whole-word 三态判定，堵 `background` 子串误匹配） |
| v0.3.6-0.3.9 | TEXT 多层 fills 取末位、切图 md5 复用契约、btn- 双写防护、子树结构禁切、问题边界（只问业务禁问技术）、冗余嵌套下穿 |
| v0.3.10 | 溯源证明升级：字色 fills / sub 容器 min-height / 页面根 padding-top 三组尺寸源强制自证 |
| v0.3.11 | bg- 独立切图契约（禁"祖先切图覆盖就省略后代 bg-"） |
| v0.3.12-0.3.13（rn） | bg-/img- 中间层递归越过、顺流子被 bbox 逆推成 absolute 两起 RN 事故 |
| v0.3.14 | P/M 样式大类混合事故（config scss 却生成 .module.scss） |
| v0.3.15 | bg- 落地形式漂移（`<img>`/inline/伪元素挂背景） |
| v0.3.16 | 结构禁切规则被绕过 |
| v0.3.17 | 一次修 5 起 D2C 事故 |
| v0.3.19 | **极简重写**（changelog 叙事清理 + 规则重组，为 rules/ 收编铺路） |
| v0.3.20 | 第 4 条切图硬规则（其他一切走 CSS）+ sub-agent 交付前四条硬规则自证 |
| v0.3.21 | TEXT fills 末位=GRADIENT/IMAGE 落地形态（span + background-clip:text） |

同期定型：flat 合并忠实度契约、data-node-id 守恒律、assets.txt 消费契约、合并忠实度证明块——「自证代替信任」的交付文化在此成型。

## 2026-08-05 ~ 08-06 · 配套：局部修复 skill + CLI 参数

- **pp-fix-partial 局部修复 skill 诞生**（hash 对比防污染 + 7 天 TTL）+ `last-page.json`（主流程写、修复流程读）+ `pp-strip-nodeid` 剥属性前存 anchors 档案 + `clean-cache` 子命令——「生成 → 剥离 → 定位 → 局部重跑」闭环成型；README 拆分出完整 guide + 3 个真实业务案例（AirportBus / GiveUpExchange / Italo）
- 新增 14 个 CLI 快捷参数（`--framework` / `--adapter-preset` / ...，优先级 CLI > config > 交互）；`merge.mode` 默认改 flat

## 2026-08-04 ~ 08-05 · 配套：adapter 预设 + Token 迁 .env + RN 侧规则（skill 仍 v0.3.4）

- 新增 taro / rn 两个 adapter 预设（补齐 xtaro 之外的选择）
- **Figma Token 从 config 迁到 `.env`**（`FIGMA_TOKEN`，敏感信息出配置文件）；`sub-`/`block-` 容器 FIXED 高度 → `min-height` 防塌陷；冗余嵌套 autoLayout 属性下穿；pp-style / pp-doctor 转 opt-in（默认不落盘，标记弃用向）
- RN 页面根强制 ScrollView 骨架 + 所有 `fixed-*` 一律放 ScrollView 外（简化分层判定）

## 2026-08-04 · 首个稳定版：PixelPrint 定名

- 品牌定名 **PixelPrint**（当天完成 PixelPilot → PixelPrint 二连改名），GitHub `double-coding-lab/PixelPrint` 上线，License MIT
- 5 个 SKILL 目录 `ctrip-train-*` → `pp-*`；知识库 / install / 文档全量 rebrand + 中性化（去业务域专名，为开源做准备）
- **注意：此时 pp-d2c skill 本体还在 v0.3.4**——「稳定版」稳定的是产品形态（包名/目录/分发），规则体系的大改造还在后头

---

## 2026-08-04 · RN 分支独立 + adapter 机制（rebrand pixel-pilot）

- **RN 独立 SKILL**（`ctrip-train-d2c-rn`，后来的 pp-d2c-rn）：不再一份 SKILL 条件分支伺候两端
- **adapter 机制**：内核用 6 大 RN 原生标签描述一切（`View/Text/Image/Pressable/TextInput/ScrollView`），末段读 config 换标签；预设 3 件套 = `<id>.json` + `<id>.rpx.ts` + `<id>.reference.md`（超改名的复杂差异手册）；一套内核覆盖 pure RN / Expo / xtaro / taro / 自定义
- rpx() 响应式包装引导；RN 强制 `require('@Images/...')`；scale 强制 1（修 h5 残留 ×2 污染）
- `font-` 前缀全量移除（TEXT 类型本身就是充分信号）；rebrand `@double-coding/pixel-pilot`

## 2026-07-30 ~ 08-03 · skill v0.3：甩掉 MCP（最大架构转折）

- **Figma MCP → 原生 REST API**：`bin/figma.mjs` 诞生（verify-token / fetch-node / export-image / screenshot / cache-check 全套子命令）；init 改 Personal Access Token 方案，token 探针取代 MCP 探活
- 迁移动机（塑造了今天的数据层）：MCP 的 `get_design_context` 返回「AI 参考代码」污染 agent 判断——REST 只给原始 JSON，前缀规则永远优先；故障面从"插件+认证状态"收敛到一枚 token；图片导出参数可控（`use_absolute_bounds=true` 修掉切图带底色/光晕外扩两个 bug）
- v0.3.1 强化布局判定（`layoutMode`/`layoutPositioning` 优先级判定树前身）；v0.3.2 `end-` 逆向布局；v0.3.3 页面根 `min-height: max(..., 100vh)`；v0.3.4 `input-` 前缀

## 2026-06 下旬 ~ 07 月 · skill v0.2：doctor 诞生 + 前缀泛化 + npm 化

git 上一串匿名 commit（`~`）的时代，按文件 diff 还原三条主线：

1. **doctor 体检体系诞生**（首版 469 行，连续多轮 +150~200 行加厚：NAM/LAY/STR/STY/AST 逐类补齐）——问题在生成前暴露，比生成后修补便宜
2. **前缀体系泛化成型**：`fixed-` ✨、`bgc-`、`btn-`/`x-`/`scrollx-`/`scrolly-`、嵌套 `sub-`（上报-派发协议 + `<__SUBSLOT__>` 占位符）；「执行模型说明」章节出现（明确伪代码 ≠ 真函数，被"agent 等待永远不会到来的返回值"卡死教育出来的）；`ctrip-train-d2c-style` 规则速查手册（+390 行，后来的 pp-style）
3. **从文档变成包**：`bin/install.js` + `package.json`（包结构成型）；README 36 → 275 行；`design-guide.md` 设计师指南成文——「设计师花 20 分钟改图层名，开发省 10 倍时间」的合约思想定型

## 2026-06-17 · skill v0.1：起点

- 项目名 **`ctrip-train-d2c`**（携程火车票内部提效工具），init commit 只有一份需求澄清文档，交付形态「SKILL.md + config 文件，后续可能改造为 npm 包」
- **走 Figma MCP**：步骤 -1 是"检测 Figma MCP 可用性"，数据靠 `get_metadata`/`get_screenshot`/`get_design_context`；认证 OAuth / 环境变量 PAT
- 前缀只有雏形四个：`img-` / `bg-` / `font-` / `sub-`；核心骨架已在（前缀解析、sub-agent 分块并行、flat/component 双合并模式、2 倍图下载）
- **零机械防线**——所有规则写在文档里，靠 LLM 自觉

---

## 三条贯穿始终的演化规律

1. **每次架构转折都在删依赖**：MCP 插件 → 一枚 REST token；配置化前缀 → 硬编码常量；靠 LLM 自觉 → 靠脚本拦截。依赖面越小，故障归因越快。
2. **机制先在事故里试炼，再进防线收编**：v0.3.x 四天冲刺试出溯源/契约散装机制 → skill v1.0.0 收编成规则库 → v1.2.0 升级成对账范式。没有一条防线是预先设计的。
3. **名字越改越通用，内核越改越收敛**：ctrip-train-d2c → pixel-pilot → PixelPrint；但前缀语义、sub-agent 分块、忠实翻译三个内核从 v0.1 起没变过。
