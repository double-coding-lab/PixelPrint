# Flow2Spec Knowledge Index

> **路径约定**：下文 **`.Knowledge/`**、**`manifest-routing.json`** 等路径均相对于**本仓库根目录**（即已运行 `flow2spec init` 的当前项目）。

本文件是 **人读导航**：主题说明、关联文档摘要、语义边界。  
**机读事实源** 以 `.Knowledge/manifest-routing.json` + `taskToTopicRules[].matcherPath` 指向的 `.Knowledge/matchers/*.json` 分片为准（不再使用 `.Knowledge/manifest-matchers.json`）。

---

## 推荐阅读顺序

1. `.Knowledge/manifest-routing.json`（任务路由、`topicPaths`、`topicDependencies`、`fallbackTopic`）
2. 按需：由 `matcherPath` 读取 `.Knowledge/matchers/<id>.json`（`includeAny` 关键词）
3. 按需：本 `index.md`（主题语义与边界）
4. `.Knowledge/topics/<topic>.md`（执行约束与流程）
5. 按需：`.Knowledge/stock-docs/`、`.Knowledge/req-docs/`
6. 仍不足再下钻业务代码

---

## 主题一览

| 主题 | 路径 | 适用场景 | 关联文档（摘要） |
| --- | --- | --- | --- |
| implement-tech-design | `.Knowledge/topics/f2s-implement-tech-design.md` | 按技术方案实现代码 | req：[技术方案](.Knowledge/req-docs/<技术方案>.md)（必填） |
| f2s-doc-routing | `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` | stock-docs / req-docs 目录分工 | stock：[目录边界说明](.Knowledge/stock-docs/<目录边界说明>.md)（可选） |
| fallback-triage | `.Knowledge/topics/f2s-fallback-triage.md` | 未命中或低置信度：分诊与澄清 | stock：[路由分诊说明](.Knowledge/stock-docs/<分诊说明>.md)（可选） |
| config-precheck | `.Knowledge/topics/f2s-config-precheck.md` | 执行 `f2s-*` 前读 `flow2spec.config.json` / 编排开关 | Codex 长文：仓库根 `.codex/topics/f2s-config-check.md`；[路由摘要](topics/f2s-config-precheck.md) |
| f2s-task | `.Knowledge/topics/f2s-task.md` | 变更追踪、`.task/` 任务清单与跨会话续作 | 长文：配置根 `rules/f2s-task.*`；Codex：`.codex/topics/f2s-task.md` |
| f2s-req-plan | `.Knowledge/topics/f2s-req-plan.md` | 需求/方案规划与实现；始终维护 `.task/` | 技能：`skills/f2s-req-plan/SKILL.md`；依赖 `f2s-task` |
| pp-doctor | `.Knowledge/topics/pp-doctor.md` | D2C 设计稿体检 SKILL 的执行约定、步骤 2 卡顿排查、阈值与边界 | SKILL：`templates/skills/pp-doctor/SKILL.md`；spec：`docs/d2c-health-check-spec.md` |
| pp-d2c | `.Knowledge/topics/pp-d2c.md` | D2C 主 SKILL 的执行约定、图层前缀体系（sub-/img-/bg-/bgc-/fixed-/end-/input- 等）、图片导出参数、scroll 容器规则、token 兜底链与避坑 | SKILL：`templates/skills/pp-d2c/SKILL.md`；关联：[[pp-doctor]] |
| pp-d2c-rn | `.Knowledge/topics/pp-d2c-rn.md` | D2C RN SKILL（v0.4 独立）的执行约定、6 大 RN 内核标签映射（View/Text/Image/Pressable/TextInput/ScrollView）、adapter 配置（tagMap+importMap）、RN 特性退化规则、StyleSheet 强制样式方案、**v1.0.3 起页面根一律 ScrollView 骨架（adapter 映射到 XScrollView 等目标标签）+ fixed-* 分层贴屏 / bg- 铺满用 Figma 事实尺寸**；SKILL 规则描述严格用 RN 内核标签，xtaro/taro 等目标框架标签仅出现在 §SCREEN-API 表格、preset 示例、adapter §5.5 应用段 | SKILL：`templates/skills/pp-d2c-rn/SKILL.md`；关联：[[pp-d2c]] |
| pp-fix-partial | `.Knowledge/topics/pp-fix-partial.md` | 整页已 D2C 出码后，某一小块 sub-block 不满意的局部修复流程：3 种目标定位形态（user-url / auto-child / fuzzy match）、`.d2c-cache/` 缓存分层（figma / images / anchors / last-page.json）、hash 对比 + mtime TTL 双重防污染、`data-node-id` 反查兜底 | SKILL：`templates/skills/pp-fix-partial/SKILL.md`；关联：[[pp-d2c]] / [[pp-d2c-rn]] |
| pp-install-dispatch | `.Knowledge/topics/pp-install-dispatch.md` | `bin/install.js` 把 `templates/skills/` 分发到下游 `.claude/skills/` 的规则：遍历所有目录 + framework 过滤 + `OPT_IN_ONLY` 黑名单，不是白名单；新 skill 默认自动落地，不需要在 install.js 里登记 | 源码：`bin/install.js:202-234`；用户可见清单：`docs/pixel-print-guide.md §7` |
| pp-d2c-reskin | `.Knowledge/topics/pp-d2c-reskin.md` | 多套换肤稿按 `img` / `bg` 前缀批量切图 SKILL：aligned-to-base / standalone 双模式、同名跨父不再静默丢图（自动加父路径前缀）、`--dedupe-siblings` 兜底、renderBounds 排查硬规；完全独立不依赖兄弟 skill | SKILL：`templates/skills/pp-d2c-reskin/SKILL.md`；关联：[[pp-d2c]] / [[pp-d2c-rn]] |
| pp-image-compress | `.Knowledge/topics/pp-image-compress.md` | 纯 Pillow 无损压缩 PNG / JPEG，输出到 `<folder>/compressed/`，保留 ICC / EXIF，无收益自动 fallback 复制原图 | SKILL：`templates/skills/pp-image-compress/SKILL.md` + `compress.py` |

每主题保留 **1–3 条** 可点击摘要链接；全量路径对照写入 `.Knowledge/migration-report.md`（迁移场景）。  
其中 **`implement-tech-design`**、**`f2s-doc-routing`**、**`config-precheck`**、**`f2s-task`** 在 `topics/` 内为**路由摘要**；执行长文见配置根 **`rules/f2s-*.md(c)`**；使用 Codex 时见 **`.codex/AGENTS.md`**、**`.codex/topics/f2s-*.md`**（`f2s-config-check` 与 `AGENTS` 前置同源，按需打开）。**`f2s-knowledge-preflight`** 与 **`f2s-kb-feedback-closing`** 是普通问答首读 / 源码补答收口门禁，作为配置根规则 / Codex 专题长文生效，不写入 `topicPaths` 或 `taskToTopicRules`。

---

## 命中与执行（与统一入口一致）

- **路由**：`taskToTopicRules` 给出任务 → 主题集合；**关键词**在 matcher 分片的 `includeAny`。
- **依赖**：命中主主题前，按 `topicDependencies` 先读依赖主题。
- **兜底**：`fallbackTopic` 指向分诊主题（如 `fallback-triage`），仅低置信度上下文，**不得**当作最终命中直接改代码。
- **执行链**：`match → expand → verify → act`；`expand` 须含依赖展开，并保留次高候选做校验。
- **全量补检索**：仅当无命中、候选分差过小、缺口检查失败，或用户明确要求「全量检查」时允许跨 matcher 补检索。

---

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `topics/` | 专题规则与执行流程 |
| `matchers/` | matcher 分片（`matcherPath` 指向） |
| `stock-docs/` | 存量沉淀（架构、终稿等） |
| `req-docs/` | 需求与技术方案（驱动实现） |
| `template/` | 终稿与方案模版 |

路由清单由 `f2s-*` 技能链路维护，不依赖额外 CLI 子命令。

---

## 常见缺口怎么处理（与统一入口一致）

| 情况 | 你怎么做 |
| --- | --- |
| 有文档但没配到（1a） | 维护侧：`f2s-kb-build` / `f2s-kb-sync` / `f2s-kb-add` 补路由与 `includeAny`。执行侧：分诊主题澄清任务类型，**不**用全仓扫替代 manifest。 |
| 配到了但不够（1b） | 走依赖与次高候选 → `verify` 点名缺哪篇文档；仍缺则向用户要路径或补 `req-docs`。 |
| 库里没有（2） | 承认缺口 → 代码下钻或请用户补需求/方案文档。 |
| 反复读 manifest 费 token（2a） | 同一任务线内 routing 只当快照；只读命中项的单个 matcher；不遍历整个 `matchers/` 目录枚举；`index.md` 勿与 routing 循环互刷。 |

**说明**：「路由/知识已更新」指 `f2s-*`（如 `f2s-kb-build`、`f2s-kb-sync`、`f2s-kb-add`、`f2s-kb-fix` 等）产出或手改 `manifest-routing` / `matchers` 分片；**`flow2spec init` 不撰写业务文档**，以模板补齐与配置根落盘为主，勿与知识库内容更新混为一谈。
