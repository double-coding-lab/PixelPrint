# pp_d2c_rule_scan_split Context

## Involved Files

**需求 / 设计文档**:
- `.Knowledge/req-docs/pp-d2c-rule-scan_需求澄清.md` (本轮澄清成果)
- `.Knowledge/req-docs/pp-d2c-rule-scan_技术方案.md` (待 f2s-req-tech 生成)

**待改造 SKILL**:
- `templates/skills/pp-d2c/SKILL.md` (v0.3.21 → v0.3.22,预计 2040 → 2200 行)

**待新建**:
- `templates/skills/pp-d2c/rules/` (目录)
- `templates/skills/pp-d2c/rules/README.md`
- `templates/skills/pp-d2c/rules/R01-fixed-position.md`
- `templates/skills/pp-d2c/rules/R02-fills-image.md`
- `templates/skills/pp-d2c/rules/R03-implicit-image.md`
- `templates/skills/pp-d2c/rules/R04-text-gradient.md`
- `templates/skills/pp-d2c/rules/R05-space-between.md`
- `templates/skills/pp-d2c/rules/R06-text-solid-last.md`
- `templates/skills/pp-d2c/rules/R07-multi-fills.md`
- `templates/skills/pp-d2c/rules/R08-bg-landing-form.md`
- `templates/skills/pp-d2c/rules/R09-btn-bgc-取值.md`
- `templates/skills/pp-d2c/rules/R10-no-fake-solid-color.md`
- `templates/skills/pp-d2c/rules/R11-mask-vector-css-able.md`
- `templates/skills/pp-d2c/rules/R12-flat-mode-naming.md`
- `templates/skills/pp-d2c/rules/R13-unit-scale.md`
- `templates/skills/pp-d2c/rules/R14-fixed-z-index.md`
- `templates/skills/pp-d2c/rules/R15-同构 map 渲染.md`
- `templates/skills/pp-d2c/bin/check-rules.mjs` (新脚本)
- `templates/skills/pp-d2c/bin/rules/R01-fixed-position.js` (脚本子模块,可选)
- ...

**下游同步**:
- `/Users/temptrip/Desktop/项目/携程/增长及活动/figma-plugin-test-function/.claude/skills/pp-d2c/` (改造后同步)

**测试稿子** (验收用):
- test1: `https://www.figma.com/design/s7ILyhLgFeLlgM66vQ1RXG/亚洲中秋?node-id=211-31` (topbar 缺 fixed + cdBlock 缺 IMAGE + 立即预约字色错)
- test8: `https://www.figma.com/design/2VHQW1W22UNsYn84g82m2b/国庆欧铁?node-id=136-45655` (btn 背景色 + 领取字色)
- test2: `https://www.figma.com/design/2VHQW1W22UNsYn84g82m2b/国庆欧铁?node-id=136-45655` (renwuInviteIcon 该切没切)

## Related Materials

- **前置版本 skill 源码**: `templates/skills/pp-d2c/SKILL.md` (v0.3.21)
- **历史事故会话**:
  - test1 v0.3.19 事故 session: `2f806d80-1407-41f9-b275-76765edfd69f`
  - test1 v0.3.20 事故 session: `b44cd6b1-f329-4ee6-b0d2-dc2e7445dcaa`
  - test2 v0.3.20 session: `9e7c3ef7-1752-45a6-b9ca-f706ddb71004`
  - test8 v0.3.20 session: `9355b733-26c5-4f3c-b9cd-60edb7a85859`
- **Figma cache**: `figma-plugin-test-function/.d2c-cache/<fileKey>/nodes/*.json`

## User Todo List

- 见 `user-todos.md`

## Acceptance

- 见 `acceptance.md` (待 task 所有 [x] 后由 Agent 填)
