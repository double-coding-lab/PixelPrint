# refactor_rn_skill_pure_rn 上下文

## 涉及文件
- `templates/skills/pp-d2c-rn/SKILL.md` 主战场（~2192 行）
- `.Knowledge/topics/pp-d2c-rn.md` topic 同步
- `.Knowledge/index.md` 摘要行同步

## 相关资料
- SKILL 第 26 行分层设计原意："rn SKILL 内部只知道 6 个 RN 原生标签，Adapter 在合并阶段应用到产物 JSX"
- adapter 边界见 SKILL §5.5，preset 定义在 `templates/adapter-presets/*.json`
- §SCREEN-API 表格（SKILL 第 167 行起）是唯一允许写 xtaro API 的例外
- 上一版 v1.0.3 修补 fixed-* 铁律时（commit 8242892、a8690a9）没做分层清理，本次是收尾

## 用户代办清单
- 见同目录 `user-todos.md`（本次纯文档改动，预计无用户代办）

## 验收
- 见同目录 `acceptance.md`（task.md 全部 [x] 后、归档前生成）
