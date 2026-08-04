# skill_page_root_min_height_100vh

## Steps
- [x] 1. 主 SKILL.md §4.1.1 §A 表:`layoutSizingVertical: FIXED` 行加"页面根容器例外"说明(min-height: max(...px, 100vh))
- [x] 2. 主 SKILL.md §4.3 判定优先级新增第 6 条(页面根容器识别 3 信号 AND + 覆写规则)
- [x] 3. 主 SKILL.md §6.0 checklist 新增第 9 项(根容器用死值 height 检测)
- [x] 4. .Knowledge/topics/pp-d2c.md 新增第 9 段 + 关键前缀清单加一条
- [x] 5. .Knowledge/matchers/m-pp-d2c.json 加 min-height/vh/根容器等关键词
- [x] 6. 同步主 SKILL 到测试项目(保留 init 尾部段)
- [x] 7. 交叉验证 grep + 写 acceptance.md 终稿

## Notes
- v0.3.3 提示词补丁,不改产物、不改脚本
- 判定"页面根容器"3 信号 AND:①是主 agent fetchNode 入口 nodeId ②父是 Page/Document 层 ③高度接近视口常见值(667/736/812/844/896/926/932/1024,±20 容差)
- 效果:根容器 min-height: max({figmaH*scale}px, 100vh) + 内部 layoutPositioning:ABSOLUTE 背景图 height: 100%;短屏保留设计稿最小高度,长屏撑到视口
- 边界:sub-agent 派发进去处理的 block 永远不是根,靠信号 3 排除;URL 直接指向 sub-frame 也靠信号 3 排除
- 触发原因:用户在 `d3c-ticket-fillin` 页面上看到 min-height: 1624px 死值,长屏底下露白;单独修产物治标不治本,提示词层面根除
