# skill_add_rn_skill

## Steps

- [x] 1. 创建 rn 模板 config: `templates/ctrip-train-d2c.rn.config.json`(D3)
- [x] 2. install.js 改造:`installFiles` 增加 `options.skipRn`(D4 改动 1)
- [x] 3. install.js 改造:`runInit` 顺序调整,先问 framework 再决定 skipRn(D4 改动 2)
- [x] 4. install.js 改造:rn 分支新增 adapter 引导 3 题 + 内置 xtaro adapter 常量(D4 改动 3)
- [x] 5. install.js 改造:写 config 时分叉 h5/rn,合并 adapter 段(D4 改动 4)
- [x] 6. 骨架:复制 `templates/skills/ctrip-train-d2c/` → `templates/skills/ctrip-train-d2c-rn/`,含 SKILL.md 和 bin/figma.mjs(D1+D2)
- [x] 7. rn SKILL 改造 M2a:顶部说明段落改成 RN 独立;config 字段表新增 adapter 段说明;删除步骤 0.5 doctor 调用;删除步骤 2.5 样式方案探测
- [x] 8. rn SKILL 改造 M2b:步骤 4 §A 表从"Figma → CSS"改成"Figma → RN StyleSheet"(尺寸/布局/颜色/装饰/文字五类);步骤 4.3 追加 RN 特性退化表(fixed/vh/bg-image/gradient/blur/box-shadow)
- [x] 9. rn SKILL 改造 M2c:步骤 5 合并输出用 RN 六件套(View/Text/Image/Pressable/TextInput/ScrollView);新增步骤 5.5 adapter 应用(tag 替换 + import 分组);步骤 6/7 QA 段落追加退化告警格式
- [x] 10. 知识库同步 D5.a:新增 `.Knowledge/topics/ctrip-train-d2c-rn.md`(参考现有 topic 结构,rn 独有内容:style 字典/退化表/adapter 应用)
- [x] 11. 知识库同步 D5.b:新增 `.Knowledge/matchers/m-ctrip-train-d2c-rn.json`(关键词覆盖 rn/xtaro/adapter/StyleSheet/RN 生成等)
- [x] 12. 知识库同步 D5.c:更新 `.Knowledge/manifest-routing.json`(新增 taskToTopicRules 条目 + topicPaths + topicMetadata)
- [x] 13. 知识库同步 D5.d:更新 `.Knowledge/index.md` topic overview 表新增 rn 行
- [x] 14. 交叉验证:grep + 行数核对 rn SKILL 是否满足验收清单 6.1/6.2/6.4
- [x] 15. install.js 端到端 dry-run:模拟 rn 分支跑一次,确认 skipRn / adapter 合并逻辑正确
- [x] 16. 生成最终 acceptance.md(在归档前)
- [x] 17. 迁移到 dev_V3 分支 + 清理版本号残留

## Notes

- 技术方案文档:`.Knowledge/req-docs/d2c-rn-adapter_技术方案.md`
- 澄清文档:`.Knowledge/req-docs/d2c-rn-adapter_需求澄清.md`
- **不引入 target 参数**:通过 SKILL 存在与否表达(装了 rn SKILL 就调 rn SKILL)
- **rn 侧默认 `health.enabled=false`**:不接 doctor,rn config 里显式写出
- **rn SKILL 从 h5 SKILL 复制起步**:前缀识别 / 布局判定 / 图片处理逻辑等价保留,只改输出层
- **h5 SKILL 一字不改**:零回归是硬约束
- 分支:今天所有改动都在 `dev_V3`,dev_V2 上老 5 组 commit 保持不动
- 文档内不使用版本号描述(D2C 迭代过程不需要版本号标记)
