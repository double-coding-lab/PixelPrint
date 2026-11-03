# User Todo List

> 由 Agent 追加; 完成后用户可把对应 `- [ ]` 改为 `- [x]` 或删除该行。

## 2026-08-10

- [ ] 主 agent review 完毕后, 用户手动 `cp templates/skills/pp-d2c/SKILL.md ~/Desktop/项目/携程/增长及活动/figmad2c-test2/.claude/skills/pp-d2c/SKILL.md` (用户 CLAUDE.md 硬约束: PixelPrint 侧不改下游, 由用户亲手 cp)
- [ ] 在 figmad2c-test2 里跑一次真实设计稿 D2C, 验证三条硬规则效果
- [ ] 汇报测试结果给主 agent 决定是否合入 main
- [ ] 如果合入, 主 agent 会走 uniai-commit skill 生成 commit, 用户确认 commit message
- [ ] npm 发布时, 用户手动运行 `npm publish --otp=<6 位 2FA>` (Agent 无法拿到用户 2FA)
