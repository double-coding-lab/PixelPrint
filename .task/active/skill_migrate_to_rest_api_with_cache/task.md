# skill_migrate_to_rest_api_with_cache

## Steps
- [x] 1. 改步骤 -1：MCP 探针 → `GET /v1/me` token 探针（两档错误分类）
- [x] 2. 新增步骤 0.3：`.d2c-cache/{fileKey}/` 缓存初始化 + `lastModified` 校验
- [x] 3. 改步骤 2：`get_metadata` → `GET /v1/files/:key/nodes?ids=xxx&depth=2` + 缓存读写
- [x] 4. 改步骤 2.5.1:复用步骤 2 已拿的节点 JSON,不再单独调 API
- [x] 5. 改步骤 4.1:`get_design_context` → `GET /v1/files/:key/nodes` + 缓存读写
- [x] 6. 新增字段取值指引段落(REST 原始 JSON → CSS 属性映射)
- [x] 7. 改步骤 4.4:图片"存在即跳过"逻辑
- [x] 8. 改步骤 4.4.1:删除 L1 `download_assets` 兜底段落
- [x] 9. 改步骤 4.8/6.0/6.1:`get_screenshot` → 走脚本
- [x] 10. 改步骤 7:交付物清单末尾加临时截图清理提示
- [x] 11. 追加禁止项:禁止绕过 `.d2c-cache` 的 lastModified 校验
- [x] 12. install.js:新初始化项目自动写 `.gitignore` 追加 `.d2c-cache/` 和 `.d2c-tmp/`
- [x] 13. SKILL 兜底:老项目首次跑时自动追加 `.gitignore`
- [x] 14. 交叉验证:重读 SKILL.md 检查所有 `mcp__plugin_figma_figma__*` 引用是否全部替换
- [x] 15. 【追加】新建 `templates/skills/pp-d2c/bin/figma.mjs` CLI 脚本(verify-token / cache-check / fetch-node / export-image / screenshot / cleanup-tmp)
- [x] 16. 【追加】SKILL.md 瘦身:把裸 curl + python3 一行式 + 缓存读写伪代码全换成 `figma.mjs xxx` 命令

## Notes
- 脚本位置:`templates/skills/pp-d2c/bin/figma.mjs`
- 分发路径:install.js 会通过 copyDir 同步到 `.claude/skills/pp-d2c/bin/figma.mjs`
- 调用统一:`node .claude/skills/pp-d2c/bin/figma.mjs <cmd> [args] [--flags]`
- 脚本输出:stdout 一行 JSON `{ok, data|error}`,退出码 0/非 0
- Node 18+ 内置 fetch,零 npm install
- SKILL.md 保留 LLM 需要判断的部分(前缀规则、切图源自检、bg- CSS-able 判断、视觉对比 QA);删除所有机械动作(curl 拼串、缓存目录管理、nodeId 冒号转义、指数退避重试等)
- 行数:v0.3 前 1273 → 加 rest 迁移后 1445 → 瘦身脚本化后 1340
