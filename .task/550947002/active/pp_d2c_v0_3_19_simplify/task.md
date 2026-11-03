# pp_d2c_v0_3_19_simplify

## Steps

- [x] 关闭 PR #14 (v0.3.18 方向作废)
- [x] 从 main 拉新分支 tech/pp-d2c-v0.3.19-css-first
- [x] sub-agent 后台重写 templates/skills/pp-d2c/SKILL.md 到 v0.3.19
- [x] 主 agent review sub-agent 产物 (行数 / grep 自证 / 顶部版本号)
- [x] switchAgentVerification=true 交叉验证: 主 agent 抽查 3 处硬规则是否真的落到文件
- [ ] 用户 cp SKILL.md 到 figmad2c-test2 测试
- [ ] 用户确认测试结果, 决定是否合入 main
- [ ] 走 uniai-commit skill 提交 (走 tech 项目 [tech] 前缀)
- [ ] 建 PR 并合入 main
- [ ] 发 npm 1.2.8 (等用户 --otp)
- [ ] 归档到 completed/

## Notes

- 基线不是 v0.3.16 而是 main 上的 v0.3.17 + changelog cleanup 状态; 因为要删的例外通道大部分在 v0.3.9-v0.3.16 已经加, 从 v0.3.17 做减法结果一样
- PR #13 (changelog cleanup) 已 merged 进 main, 保留成果
- PR #14 (v0.3.18) 已关闭, v0.3.18 方向作废, npm 1.2.7 不发布
- flow2spec.config.json: subAgent=true, switchAgentVerification=true, changeTracking.feat=true → 走 f2s-task 完整流程
- 用户核心哲学: "兼容的越多越容易错" — 删掉所有例外通道, 只留三条硬规则
- 用户明确要求: 只改 PixelPrint 项目, 不改下游 figmad2c-test2
