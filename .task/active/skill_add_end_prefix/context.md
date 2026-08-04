# skill_add_end_prefix Context

## Involved Files
- `templates/skills/pp-d2c/SKILL.md`(主档,4 处改动)
- `templates/skills/pp-doctor/SKILL.md`(doctor 校验)
- `templates/skills/pp-style/SKILL.md`(速查手册)
- `.Knowledge/stock-docs/end-prefix.md`(新增)
- `.Knowledge/index.md`(补行)
- 测试项目同步:`figma-plugin-test-function/.claude/skills/{pp-d2c,pp-doctor,pp-style}/SKILL.md`

## Related Materials
- 触发场景:`img-pinxuan` 底部品宣,设备高度大于设计稿 812 时想让 pinxuan 贴屏底显示
- 参考前缀:`fixed-`(v0.2 已加,修饰前缀模式,LAY013 校验),做 end- 时按同一模式复刻
- Figma REST 依赖字段:父 `layoutMode`(HORIZONTAL/VERTICAL)决定 end- 方向

## User Todo List
- 见 user-todos.md

## Acceptance
- 见 acceptance.md
