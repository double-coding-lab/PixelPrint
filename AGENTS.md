# Flow2Spec Project Entry

This file is written by `flow2spec init` to repository-root **`./AGENTS.md`** as the Codex project entry. **`./.codex/AGENTS.md`** is only a pointer. The knowledge-base root is **`./.Knowledge/`**.

## Do These Two Things First

1. **On the first repository-related turn in this conversation, read `./.Knowledge/manifest-routing.json`.**
2. **Before executing any `f2s-*` skill, `Read("flow2spec.config.json")`.**

```text
Must execute: Read(".Knowledge/manifest-routing.json")
Must execute: Read("flow2spec.config.json")  <- only before entering an f2s-* skill
```

Do not enter any `f2s-*` skill-body step before reading `flow2spec.config.json`.

## Configuration Switches (disk is authoritative)

The table below explains field semantics and the defaults written by `flow2spec init`; the source of truth is the result of `Read("flow2spec.config.json")` in this turn (the user may have edited values).

| 配置项 | init 默认 | 说明 |
| --- | --- | --- |
| `subAgent` | `true` | 技能正文写明某步可用子 agent 时，`true` 才允许拆子；`false` 一律主会话完成。用户「动态判断谁用子 agent」仅当本项为 `true` 时有效。 |
| `switchAgentVerification` | `true` | 切换 agent 校验。仅当本项为 `true` 且当前技能正文明确绑定该字段时启用交叉校验；否则仍是谁落盘谁自验。旧键 `subAgentVerification` 仍可被解析。 |
| `intentRecognition` | `true` | `true` 时可按 `f2s-intent-routing` 对高置信操作意图自动进入对应 `f2s-*` 技能；`false` 或缺失时不自动分流。 |
| `changeTracking.feat` | `true` | `true` 时 `f2s-kb-feat` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |
| `changeTracking.fix` | `false` | `true` 时 `f2s-kb-fix` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |
| `changeTracking.implement` | `true` | `true` 时 `f2s-implement-tech-design` 写入任务清单并在满足归档门禁后归档；`false` 时跳过变更追踪部分。 |
| `collaboration.enabled` | `true` | `true` 时按 developerId 隔离任务根 `.task/<id>/`；`false` 时始终 legacy 单根 `.task/`。 |
| `collaboration.developerId` | `""` | 非空则作为任务进度目录名；空则尝试 git user.email/name 规范化；仍无则 legacy `.task/`。解析顺序：config → git → legacy。 |

- When `subAgent=true`, the main agent must make **one explicit split/no-split decision** near the start of the skill body and state why; even when deciding not to split, it must output the no-split reason. When `subAgent=false`, do not split to sub-agents.
- When `intentRecognition=false` or the field is missing, do not auto-enter any skill; enter only on explicit user trigger or high-confidence routing allowed by current rules.

For the detailed config table and supplemental rules, see **`./.codex/topics/f2s-config-check.md`**.

## KB Routing Rules

- The machine-readable source of truth is only **`./.Knowledge/manifest-routing.json`** plus the **`./.Knowledge/matchers/*.json`** file pointed to by each `matcherPath`.
- Execute `match -> expand -> verify -> act`: after the primary match, expand `topicDependencies`, then check for missing critical context.
- Cross-matcher full supplemental search is allowed only when there is no hit, the top candidates are too close, the gap check fails, or the user explicitly asks for a full check.
- `fallbackTopic` is only a low-confidence fallback and is not final execution authority.

## Ordinary-Q&A Closing Gate

- If ordinary Q&A / troubleshooting / explanation needs to drill into business source code, first follow **`./.codex/topics/f2s-knowledge-preflight.md`** for the initial read and gap note.
- If this turn read business source code and the final answer cites source-code facts, run the four-case closing in **`./.codex/topics/f2s-kb-feedback-closing.md`** before sending the answer; the answer must explicitly append either **`Knowledge-base follow-up suggestion`** or **`Knowledge base already covers this`**. Do not silently omit the closing marker.
- If this turn already entered an `f2s-*` skill, `implement-tech-design`, `f2s-git-commit`, or another existing follow-up flow, do not append the ordinary-Q&A closing prompt again.

## Progressive Reading Order

1. `./.Knowledge/manifest-routing.json`
2. The matched `./.Knowledge/matchers/<id>.json`
3. The relevant `./.Knowledge/topics/<topic>.md`
4. Only if the topic points there or context is still missing, read `./.Knowledge/index.md` / `stock-docs` / `req-docs`
5. Drill into business code last

Do not skip `manifest-routing.json` and jump straight to full-repository search.  
Do not use `./.Knowledge/stock-docs/` as the direct input for implementing code from a spec.  
Within the same task line, do not repeatedly reread the full manifest unless the user explicitly says routing/knowledge changed.

## Execution Authority

Flow2Spec execution authority is limited to:

- repository-root **`./AGENTS.md`**
- **`./.codex/topics/f2s-*.md`**
- **`./.codex/skills/`**

**`.codex/AGENTS.md`** is only a pointer and cannot replace root `AGENTS.md`.

## Codex Rule Mirrors (open on demand)

These files are mirrored by `flow2spec init codex` from rule templates into `.codex/topics/`. They are not automatically loaded in full; open them only when the current task needs the details.

| Rule | Path | When to read |
| --- | --- | --- |
| Unified entry | `./.codex/topics/f2s-flow2spec-unified-entry.md` | When executing an `f2s-*` skill or deciding KB routing, sub-agent, or verification semantics |
| Config preflight | `./.codex/topics/f2s-config-check.md` | When checking `flow2spec.config.json`, `subAgent`, or `changeTracking` details |
| Ordinary-Q&A initial gate | `./.codex/topics/f2s-knowledge-preflight.md` | Before ordinary Q&A drills into source code |
| Ordinary-Q&A closing | `./.codex/topics/f2s-kb-feedback-closing.md` | After ordinary Q&A reads source code and may need a KB follow-up suggestion |
| Intent routing | `./.codex/topics/f2s-intent-routing.md` | Only when `intentRecognition=true` and deciding whether to auto-enter a skill |

Open long-form topics such as `implement-tech-design` or `f2s-doc-routing` only when the matched topic requires them.

## Codex Hooks

`flow2spec init codex` writes **`.codex/hooks.json`**. In Codex, Flow2Spec currently uses hooks only for:

- `SessionStart` configuration-summary reminder: `.codex/hooks/f2s-config-session.js`
- `SessionStart` knowledge-base version check: `.codex/hooks/f2s-update-check.js`

These hooks are only reminders / checks. They do not replace `Read("flow2spec.config.json")` or the KB routing gate.

## Flow2Spec Skills

Available skills live under **`./.codex/skills/`**. Enter a skill only when the user explicitly triggers it or the current routing rules allow automatic entry.

- `f2s-doc-arch`：Generate a first draft of project architecture documentation from user notes, documents, or code scanning; no fixed format is required as long as the explanation is clear. Triggers: 项目架构说明、f2s-doc-arch、架构初稿、architecture draft、project architecture
- `f2s-doc-final`：Convert a PDF or MD document into the `final-overview-template` standard format so f2s-kb-build can later sync topics/index/manifest; triggers: f2s-doc-final、转成概述模板、终稿模版、final-overview-template, final template、convert to final draft
- `f2s-doc-milestone`：Generate a milestone document (`project-milestone-template`) from req-docs, git log, `.task`, and knowledge-topic semantics; triggers: f2s-doc-milestone、生成项目里程碑、里程碑、project milestone、generate milestone. A semantic scope may be appended after the command. This skill always uses a sub agent for generation and the main agent for verification, regardless of flow2spec.config orchestration switches
- `f2s-doc-pdf`：Convert a PDF technical design into Markdown and save it under req-docs, with optional flow-description completion; triggers: PDF转MD、按方案实现前的 PDF、PDF to Markdown、technical design PDF
- `f2s-git-commit`：Commit completed code to Git: by default check both changes and knowledge-base coverage; when the user explicitly asks for "快捷提交" / quick commit, skip only the knowledge coverage check; **when the pending changes are pure docs / knowledge-base itself**, or **f2s-kb-sync / kb-feat / kb-fix / kb-add / kb-addRules / kb-distill ran within the last 30 min**, auto-skip the coverage check; after generating a commit message with an emoji first line, commit directly (the first line must be shown in the same reply; no separate confirmation is required); git pull-like fetch/merge operations require user confirmation first. Triggers: f2s-git-commit、提交代码、快捷提交、git commit、帮我提交、quick commit、commit code
- `f2s-kb-add`：Parse already implemented capabilities into the knowledge base during work (multi-file aggregation): draft -> final draft -> topics/index/manifest; triggers: f2s-kb-add、已有能力进知识库、多文件生成上下文、add existing capability to knowledge base、multi-file context generation
- `f2s-kb-addRules`：Capture user-spoken rules into the knowledge base, automatically decide "create new topic / merge into existing topic", and sync routing; does not write code or create `.task/`; triggers: f2s-kb-addRules、新增规则、口述规则、把这条记到知识库、add rule、capture spoken rule
- `f2s-kb-build`：Generate knowledge-routing topics and indexes from `.Knowledge/stock-docs` documents; triggers: 生成项目上下文、f2s-kb-build、终稿生成上下文、generate project context、build knowledge context
- `f2s-kb-distill`：Extract reusable knowledge facts from Q&A and auto-commit to KB; decide whether to create new topic or append to existing topic based on drill-down depth; trigger: f2s-kb-distill, extract knowledge from Q&A, distill knowledge from conversation
- `f2s-kb-feat`：Complete implementation and knowledge-base sync when adding a capability; if already implemented, only sync the knowledge base; triggers: f2s-kb-feat、新增能力、add capability、new feature
- `f2s-kb-fix`：Fix implementation or rule errors identified by the user, and sync the knowledge base by default; triggers: f2s-kb-fix、修正实现规则、fix implementation rules、fix kb rule
- `f2s-kb-merge`：Resolve editor-context conflicts after a Git merge; optionally accept conflict files; implementation-side conflicts are only summarized for user confirmation; triggers: 合并上下文冲突、f2s-kb-merge、merge context conflicts、resolve kb merge
- `f2s-kb-migrate`：Migrate a legacy knowledge base to `.Knowledge` in one pass: use the configuration-root `docs-index.md` plus the unified rule entry (legacy `rules/main.md(c)` or current package `rules/f2s-flow2spec-unified-entry.md(c)`) as primary index clues; fully process business `rules/` and business `skills/` (excluding `f2s-*` package skills), and fully migrate `stock-docs`/`req-docs`; **after migration acceptance, must write** `.Knowledge/migration-report.md` (migration mapping table + proposed deletion path list); **closing must delete** migrated legacy `rules/`, migrated business `skills/`, and legacy `docs-index.md`/`index-doc.md`; the user only **reviews/revises the deletion list (exclusions)**; triggers: f2s-kb-migrate、知识库迁移、旧版迁移、knowledge-base migration、legacy migration
- `f2s-kb-rm`：Remove the knowledge topics and index mappings associated with a stock-docs document; triggers: 删除项目上下文、f2s-kb-rm、remove project context、delete knowledge context
- `f2s-kb-sync`：Accept an explicit capability list or infer from zero input; first output a knowledge-base update outline, then write topics/index/manifest after confirmation; triggers: f2s-kb-sync、全局同步、知识库同步、已实现能力、global sync、sync knowledge base、implemented capability
- `f2s-kb-upgrade`：Knowledge-base template upgrade skill (this SKILL only): **V1 flow branch** must run f2s-kb-migrate first, then run flow2spec init inside the workflow; **current repositories (flow branch V2+, including Flow2Spec npm v3.x projects already using .Knowledge)** run init to align manifest-routing + matcher shards (package `manifest-matchers.json` is only an init merge seed and is not written into .Knowledge). Triggers: f2s-kb-upgrade、一键升级迁移、旧项目升级、知识库模板升级、upgrade knowledge base、template upgrade. Note: do not call standalone flow2spec init an "upgrade command"; **V1/V2+ are flow-branch labels inside this skill, not npm package major versions**.
- `f2s-req-clarify`：Clarify a PRD or requirement through follow-up questions until it is actionable, then use f2s-req-tech to produce a technical design; triggers: 需求澄清、PRD 澄清、requirement clarification、PRD clarification
- `f2s-req-plan`：Plan and implement tasks from a technical design, requirement description, or change description; always maintain `.task/` according to f2s-task; supports parallel sub-agent implementation. Triggers: f2s-req-plan、创建任务、任务规划、我需要任务清单、task planning、create task list
- `f2s-req-tech`：Generate a technical design document from clarified requirements using the project knowledge base, Skills, and Rules; triggers: 生成技术方案、技术方案、f2s-req-tech、generate technical design、technical design
