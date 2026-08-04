# Acceptance — skill_migrate_to_rest_api_with_cache

> 用户核对项：本轮改动产出的 SKILL/install.js 是否真的把 MCP 依赖清干净、缓存机制成立、gitignore 兜底可靠。逐项核对通过即可归档。

## 一、SKILL.md v0.3 核对

- [ ] 打开 `templates/skills/pp-d2c/SKILL.md`，用编辑器查找 `mcp__plugin_figma_figma`，剩余 4 处全部在"解释为什么废弃 MCP"的说明性引用里，没有一处是要求 agent 实际调用 MCP 工具
- [ ] 步骤 -1 变成 token 探针（`GET /v1/me`），失败提示是"Figma Token 探针失败"（不再是 MCP 未装/未认证/无权限三档）
- [ ] 步骤 0.3（新增）出现在步骤 0 与步骤 0.5 之间，含 `.d2c-cache/{fileKey}/` 目录结构、`lastModified` 校验、gitignore 兜底、缓存读写约定、禁止项
- [ ] 步骤 2 调用 `GET /v1/files/:key/nodes?ids=xxx&depth=2`，前面说"先查缓存"
- [ ] 步骤 2.5.1 明确"复用步骤 2 已拿的节点 JSON，不再单独发 API 请求"
- [ ] 步骤 4.1 走 REST + 缓存，且明确"不再使用 MCP `get_design_context` 返回的参考代码字段"
- [ ] 步骤 4.1.1（新增）"REST 原始 JSON 字段取值指引"完整覆盖：颜色、渐变、stroke position（`strokeAlign`）、cornerRadius、box-shadow、blur、constraints、font
- [ ] 步骤 4.4 加了"图片缓存存在即跳过"（4 分支逻辑）+ 两步式 REST 下载 + 3 次指数退避重试
- [ ] 步骤 4.4.1 变成"v0.3 修订"，只有 REST 一条路径，token 失败即终止，不再有 L1/L2/L3 MCP 兜底表
- [ ] 步骤 4.8 / 6.0 / 6.1 三处 `get_screenshot` 全部改为 REST + 落 `.d2c-tmp/screenshots/`
- [ ] 步骤 7 交付物清单末尾多了两条：临时截图目录自动清理 + 缓存目录保留
- [ ] "禁止项"末尾新增 3 条：禁止 MCP 调用 / 禁止绕过 `lastModified` 校验 / 禁止不清理 `.d2c-tmp/`

## 二、figma.mjs 脚本核对（v0.3 追加）

- [ ] 存在 `templates/skills/pp-d2c/bin/figma.mjs`，`node --check` 语法通过
- [ ] `node figma.mjs --help` 输出 6 个子命令：verify-token / cache-check / fetch-node / export-image / screenshot / cleanup-tmp
- [ ] 脚本内置：自动向上查找 `pp-d2c.config.json`、3 次指数退避、`use_absolute_bounds=true` 默认开、两步式下载、`images.json` 回写、nodeId 冒号转下划线
- [ ] 输出统一为 stdout 一行 JSON（`{ok, data|error}`），退出码 0/非 0
- [ ] Node 18+ 原生 fetch，无 npm install 依赖

## 三、install.js 核对

- [ ] `node -c bin/install.js` 语法通过（已在本轮 `Bash` 中验证过）
- [ ] 阶段一提示改为"Figma Personal Access Token 说明"，含 5 步生成 token 的引导
- [ ] 阶段五（新增）在 mappings.json 之后调用 `ensureGitignoreEntries()`
- [ ] `ensureGitignoreEntries()` 函数逻辑：不存在则创建，已存在但缺项则追加，全存在则 skip；输出 `create`/`append`/`skip` 三种日志
- [ ] 收尾提示新增一行 `✓ .gitignore 已追加 .d2c-cache/ / .d2c-tmp/`

## 四、端到端跑一遍（用户执行）

- [ ] 在一个测试项目里 `npx @double-coding/pixel-pilot init`，确认：
  - [ ] 阶段一显示 token 生成引导，没有 MCP 提示
  - [ ] 阶段五输出 gitignore 追加日志
  - [ ] 项目根 `.gitignore` 里能看到 `.d2c-cache/` 和 `.d2c-tmp/`
- [ ] 把测试项目原有 `.claude/skills/pp-d2c/SKILL.md` 换成新版，跑一次真实设计稿：
  - [ ] SKILL 步骤 -1 用 curl 打 `/v1/me`（观察 token 探针是否正常返回 200）
  - [ ] 步骤 0.3 生成 `.d2c-cache/{fileKey}/meta.json`，含 `lastModified` 和 `cachedAt`
  - [ ] 步骤 2 后 `.d2c-cache/{fileKey}/nodes/{rootNodeId_safe}.json` 有内容
  - [ ] 步骤 4.4 命中已存在图片时跳过 curl，日志显示"复用旧文件"
  - [ ] SKILL 结束后 `.d2c-tmp/screenshots/` 被清空/删除
  - [ ] 二次运行同一 fileKey：`lastModified` 一致时缓存命中，重新拉取 API 的次数显著减少
  - [ ] 把设计稿改一处再跑：`lastModified` 变化，整份 `.d2c-cache/{fileKey}/` 被作废重建

## 五、回归验证（关键 bug 防线）

- [ ] `bg-` 前缀节点仍然遵守 §4.0/§4.3 规则（不生成 HTML、切图源必须是 bg- 自己），不会因 REST 迁移而回归
- [ ] curl 前 4 行前置自检段落未被误删（§4.4 图片处理段落中部）
- [ ] `use_absolute_bounds=true` 参数在两步式 curl 中保留
- [ ] `strokeAlign` vs 老的 `position` 字段差异在 §4.1.1 里明确标注

## 六、归档条件

上述 1-5 全部通过 → 用户在此文件顶部补一句 `已验收 YYYY-MM-DD`，随后 agent 可把 `.task/active/skill_migrate_to_rest_api_with_cache/` 归档到 `.task/completed/<YYYYMMDD>-skill_migrate_to_rest_api_with_cache/`。
