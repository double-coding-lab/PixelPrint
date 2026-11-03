# pp_d2c_rule_scan_split

## Steps

- [x] f2s-req-clarify 澄清对话完成
- [x] 写入 `.Knowledge/req-docs/pp-d2c-rule-scan_需求澄清.md`
- [x] auto-chain 到 f2s-req-tech 生成技术方案 `.Knowledge/req-docs/pp-d2c-rule-scan_技术方案.md`
- [x] 用户 review 技术方案
- [x] 用户确认技术方案后走 f2s-req-plan 拆任务
- [x] 走 f2s-implement-tech-design 实施
- [x] check-rules.mjs 骨架 (仅 R01/R02 先跑通)
- [x] check-rules.mjs 补齐 R05/R06/R08
- [x] rules/ 目录建立 (R01-R15 15 个 md + README)
- [x] SKILL.md v0.3.22 改造 (顶部总概表 + 步骤 3.5 + 步骤 4/5 调整 + §6.0.2 扩)
- [x] 同步下游 figma-plugin-test-function
- [x] 重跑 test1/test8/test2 三张事故稿验证
- [x] 走 uniai-commit 提交 (tech 项目 `[tech]` 前缀)
- [ ] 建 PR 并合入 main
- [ ] 归档到 completed/

## Notes

- v0.3.21 已提交 (本地 branch `tech/pp-d2c-v0.3.20-implicit-image-slice` 上,未 push)
- **本轮不做**: pp-doctor 集成 / rules/ 分子目录 / 一次性删除 SKILL.md 老规则
- **重要决策**: 硬防线 5 条 (R01/R02/R05/R06/R08) + 软防线 10 条 (R03/R04/R07/R09-R15) + 补漏防线 (UI sub-agent 自补 + assets.txt 备注) + 兜底防线 (主 agent §6.0.2 聚合)
- **降级路径**: Rule-Scan sub-agent 挂了 → 二次尝试;二次挂 → 降级到 v0.3.21 流程 + QA 告警
- flow2spec.config.json: subAgent=true / switchAgentVerification=true / changeTracking.feat=true / intentRecognition=true → 完整走 f2s-* 流程

## T1 落地 (2026-08-11)

- bin/lib/{loadCache,loadProduct,nodeIdToClassName,report}.mjs — 4 个工具模块
- bin/rules/R01-fixed-position.mjs — 触发 name.startsWith('fixed-'),反查 className,scss 里检查 position: fixed
- bin/rules/R02-fills-image.mjs — 触发 fills[].type=='IMAGE',反查 assets.txt + 产物引用
- bin/check-rules.mjs — CLI 主入口,--block/--merge/--cache-key/--force-skip
- 首次冒烟 (test1/s7IL cache):
  - R01 精确拦到 `.topbar` (211:32 fixed-状态栏) 缺 position: fixed ✅
  - R02 拦到 8 个 fills IMAGE 节点未切图或未引用 ✅
- 修复过 1 处 bug:cache JSON 顶层是 `{ _depth, node: {...} }`,loadCache 需递归 `node.node` 字段
