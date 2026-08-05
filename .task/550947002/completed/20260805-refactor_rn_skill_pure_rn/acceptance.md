# 验收清单

> Agent 整理；用户核对后可将对应 `- [ ]` 改为 `- [x]`。

## SKILL 规则层

- [ ] `templates/skills/pp-d2c-rn/SKILL.md` §2.5 首段：读一遍应为"RN 的 `<View>` 天然不滚"+"强制采用 `<ScrollView>` 骨架"（验收方式：`grep -n "XScrollView 骨架" templates/skills/pp-d2c-rn/SKILL.md` 应无命中）
- [ ] §2.5 页面根骨架代码块用 RN 内核标签：`import { Image, ScrollView, View, StyleSheet } from 'react-native'` + `<View> > <ScrollView> > <View>`（验收方式：读 SKILL.md L344-405）
- [ ] §2.5 fixed-* 分层规则示例改为 View / ScrollView / Image / Pressable；"为什么不用 Portal / Modal" 段"RN 里 Portal..."（验收方式：读 SKILL.md L410-450）
- [ ] §2.5 顶层 frame 属性映射表 `<Image>` + 禁止条目内核标签（验收方式：读 SKILL.md L456-472）
- [ ] §4.2.A FIXED 塌陷防御表"页面根容器"行只留 RN 内核 API + 指向 §SCREEN-API（验收方式：`grep -n "Dimensions.get" templates/skills/pp-d2c-rn/SKILL.md` §4.2 附近）
- [ ] §4.3 优先级 6 rn 分支说明段用 ScrollView / View（验收方式：读 SKILL.md L1022 附近）
- [ ] §4.3.rn 退化表 fixed- / 页面滚动骨架 / bg- 三行用内核标签（验收方式：读 SKILL.md L1251-1253）
- [ ] §6.0 QA 输出示例 XScrollView → ScrollView（验收方式：读 SKILL.md L1272-1273）
- [ ] §5.7 图片引用铁律双代码块保留（RN 内核 + xtaro 对照），正文"xtaro webpack" / "90% xtaro/RN" 措辞收敛为 RN 通用；AirportBus 产物示例改为内核+adapter 对照（验收方式：读 SKILL.md L1381-1440）
- [ ] §6.0 checklist 第 9 项 XScrollView → ScrollView + 补一句"adapter 已应用时用目标标签等价对照"（验收方式：读 SKILL.md L2043）
- [ ] 禁止条目"禁止跳过 §2.5 骨架"改为内核标签（验收方式：读 SKILL.md L2182）
- [ ] 剩余 X* 只出现在允许位置（§SCREEN-API 表 / preset 示例 / adapter §5.5 应用段 / §5.7 双代码块对照）（验收方式：`grep -n -E "(XView|XImage|XScrollView|XText|XInput)" templates/skills/pp-d2c-rn/SKILL.md` 逐条对照，规则描述里应无残留）

## 知识库

- [ ] `.Knowledge/topics/pp-d2c-rn.md` §"rn 页面根强制骨架 + fixed-* 分层"骨架代码 + fixed-* 铁律段 + bg- 示例 + 禁止条目 全部用 RN 内核标签，只保留一句"启用 xtaro 预设后 adapter §5.5 自动 tagMap"作为对照（验收方式：`grep -n -E "(XView|XImage|XScrollView)" .Knowledge/topics/pp-d2c-rn.md` 只应命中 xtaro 预设 config 示例和 adapter 说明句）
- [ ] `.Knowledge/index.md` pp-d2c-rn 一行摘要更新为"页面根一律 ScrollView 骨架(adapter 映射到 XScrollView 等目标标签)"（验收方式：读 index.md 该行）
- [ ] `.Knowledge/.last-sync.json` 时间戳刷新到本次同步时刻（验收方式：`cat .Knowledge/.last-sync.json`）

## 任务清单本体

- [ ] `.task/550947002/completed/<YYYYMMDD>-refactor_rn_skill_pure_rn/` 目录齐全：`task.md` / `context.md` / `user-todos.md` / `acceptance.md`
- [ ] `.task/550947002/todo.json` 已删除对应条目（或文件已删除，若数组变空）
