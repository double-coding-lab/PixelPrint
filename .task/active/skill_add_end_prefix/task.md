# skill_add_end_prefix

## Steps
- [x] 1. 主 SKILL.md: config 表加 `layers.end`(默认 `end-`);§4.3 图层前缀总表加 `end-` 行;§4.3 新章节"`end-` 逆向布局规则"(wrapper + space-between 主线,父 VERTICAL/HORIZONTAL 两种方向);§4.3 fixed- 表下方"叠加限制"章节同步加 end-;§6.0 checklist 加"end- 未落地"检测项 + 修复方向表加行
- [x] 2. doctor SKILL.md: config 表加 `layers.end`;前缀识别段列出 end;新增 LAY017/LAY018/LAY019/LAY020 四条校验规则;NAM016 叠加互斥规则(不与 bg-/bgc-/x- 叠加)
- [x] 3. style SKILL.md: config 速查表加 `layers.end` 行
- [x] 4. KB: `.Knowledge/topics/pp-d2c.md` 新增第 8 段"end- 逆向布局(v0.3.2 新增)" + 关键前缀清单补 end- 一条;`.Knowledge/index.md` topic overview 表 pp-d2c 行补 end-;`.Knowledge/matchers/m-pp-d2c.json` 加 12 个 end- 相关关键词。stock-docs 跳过(topic 已充分)。manifest-routing.json 不变。
- [x] 5. 同步 3 份 SKILL 到测试项目 `figma-plugin-test-function/.claude/skills/`,保留 init 尾部段
- [x] 6. 交叉验证:grep 三份 SKILL 确保 end- 前缀在 config 表 / 总表 / 行为章节 / doctor 校验四处都存在,无遗漏
- [x] 7. 更新 acceptance.md(步骤 1-6 全 [x] 后写终稿)

## Notes
- 用户选定:前缀名 `end-`,处理机制"wrapper + justify-content: space-between"(不用 margin-auto),边界完整覆盖(LAY017-020 + NAM016)
- 主线行为:父 layoutMode 决定方向(VERTICAL→贴底 / HORIZONTAL→贴右);把前面兄弟节点(除 end- 外)包一层 wrapper,父加 justify-content: space-between
- 与 fixed- 类比:end- 也是修饰前缀,可叠加 sub-/block-/btn-/img-/font-/scrollx-/scrolly-,不可叠加 bg-/bgc-/x-
- 触发原因:pinxuan 需从底部布局但 D2C 生成固定高度产物,Figma 现有 auto-layout 语义在"父 auto-layout + 子想脱离"场景下需绕道 Absolute position + constraints,不够顺手;用前缀是更直接的表达方式
- 参考实现:v0.3.1 已加过 fixed- 前缀 + LAY013,可以复用同套 checklist/校验模式

## 用户决策快照(2026-07-30)
- 前缀名:`end-`
- 处理机制:wrapper + justify-content: space-between(前面兄弟单独包一组)
- 叠加规则:修饰前缀,可与所有"生成节点"前缀叠加
- doctor:与 fixed- 联销同步加规则(LAY017-020 + NAM016)
