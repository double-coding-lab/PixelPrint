# skill_page_root_min_height_100vh Context

## Involved Files
- `templates/skills/pp-d2c/SKILL.md`(3 处)
- `.Knowledge/topics/pp-d2c.md`(2 处)
- `.Knowledge/matchers/m-pp-d2c.json`(加关键词)
- 测试项目同步:`figma-plugin-test-function/.claude/skills/pp-d2c/SKILL.md`

## Related Materials
- 触发场景:`pages/D3CTicketFillIn/index.scss` `.d3c-ticket-fillin` 用 `min-height: 1624px` 死值,设备高度 >812pt 时底下露白
- 关联:end- 前缀(v0.3.2)贴底效果依赖根容器能撑到 100vh
- 3 信号判定引用 §2.5 已经做的"页面级背景"识别结果(如已有)

## User Todo List
- 见 user-todos.md

## Acceptance
- 见 acceptance.md
