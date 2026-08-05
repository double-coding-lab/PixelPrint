# refactor_rn_skill_pure_rn

## 步骤
- [x] §2.5 首段"XScrollView 骨架"表述改为 ScrollView（保留"RN 的 <View> 天然不滚"的动因说明）
- [x] §2.5 骨架代码示例：XView/XScrollView/XImage → View/ScrollView/Image；import from 'react-native'；顶部注释一句"adapter 阶段自动 tagMap"
- [x] §2.5 fixed-* 分层规则示例（JSX + styles）+ 铁律段 + "为什么不用 Portal / Modal" → 全部 View/ScrollView/Image；"xtaro/RN 里 Portal"→"RN 里 Portal"
- [x] §2.5 顶层 frame 属性映射表格 + 禁止条目：XView / XScrollView 措辞归位
- [x] §4.2.A FIXED 塌陷防御表"页面根容器"行：只留 `Dimensions.get('window').height` 内核语义 + 跳转 §SCREEN-API；xtaro 特化写法搬到 §SCREEN-API
- [x] §4.3 优先级 6 rn 分支说明段：XScrollView/XView → ScrollView/View
- [x] §4.3.rn 退化表：fixed- / 页面滚动骨架 / bg- 三行 X* → 内核
- [x] §6.0 QA 输出示例：XScrollView → ScrollView
- [x] §5.7 图片引用铁律：正文里"xtaro webpack" / "xtaro/RN 里" / "90% 的 xtaro/RN 项目" 措辞收敛为 RN 通用；双代码块保留（pure RN + xtaro 对照）；AirportBus 产物示例改为先内核后 adapter 对照
- [x] 全文 grep xtaro / X(View|ScrollView|Image|Text|Input) 收尾扫一遍，规则描述里剩余的都归位；preset 示例区、§SCREEN-API 表格、adapter 边界说明、adapter §5.5 段允许保留 xtaro 举例
- [ ] .Knowledge/topics/pp-d2c-rn.md：§"rn 页面根强制骨架 + fixed-* 分层" 骨架代码 + 铁律段 + bg- 示例 + 禁止条目 全部改为内核标签
- [ ] .Knowledge/index.md pp-d2c-rn 摘要行同步
- [x] 生成 acceptance.md（task.md 全部 [x] 后、归档前）
- [x] 归档 active → completed/<YYYYMMDD>-refactor_rn_skill_pure_rn/，删除 todo.json 对应条目

## 备注

本次是文档层一致性重构，不改 CLI / adapter / preset。目标：让 rn SKILL "内核 RN + 适配 Adapter" 的分层在规则描述里也严格生效——规则示例只用 View/Text/Image/Pressable/TextInput/ScrollView + StyleSheet，xtaro 相关只出现在 §SCREEN-API 表格、preset 示例、adapter §5.5 应用段。
