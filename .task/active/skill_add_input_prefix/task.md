# skill_add_input_prefix

## Steps
- [x] 1. 主 SKILL config 表加 `layers.input`(默认 `input-`)
- [x] 2. 主 SKILL §4.3 图层前缀总表加 input- 行
- [x] 3. 主 SKILL §4.3 新增独立子章节"`input-` 输入框规则(v0.3.4)"
- [x] 4. 主 SKILL §6.0 checklist 加第 10 项 + 修复方向表加行
- [x] 5. doctor: config 表 / 前缀识别例 / 规则总览表 4 行 / NAM003 冲突表 / 3.6f-i NAM017-020 四条规则
- [x] 6. style: config 速查表加 layers.input 行
- [x] 7. .Knowledge/topics/ctrip-train-d2c.md 新增 §10 段 + 关键前缀清单加行
- [x] 8. .Knowledge/matchers/m-ctrip-train-d2c.json 加关键词
- [x] 9. 同步 3 份 SKILL 到测试项目(主 SKILL 保留 init 尾部段)
- [x] 10. 交叉验证 grep + acceptance.md 终稿

## Notes
- v0.3.4 用户选定方案 A(最小版):
  - 前缀名 `input-`
  - 覆盖范围 只做 `<input type="text">`(textarea/select 以后按需)
  - DOM 单标签,不包 wrapper
  - placeholder 取子 TEXT 节点 characters
  - 左侧图标 background-image + padding-left
  - **独立前缀**(不像 fixed-/end- 是修饰),不允许与 img-/btn-/bg-/bgc-/x- 叠加,允许与 fixed-/end- 叠加
- 4 条 doctor 规则:NAM017 无 TEXT 子层(error) / NAM018 多 TEXT 子层(warn) / NAM019 与 bg-/bgc-/x- 叠加(error) / NAM020 与 img-/btn- 叠加(error)
- 触发场景:pages/D3CTicketFillIn 里 3 个 Frame 256/258/260 是输入框,当前生成为 <div>+<span> DOM,应改为 <input type="text"> 语义
