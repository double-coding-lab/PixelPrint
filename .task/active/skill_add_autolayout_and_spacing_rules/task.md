# skill_add_autolayout_and_spacing_rules

## Steps
- [x] 1. §4.1 (line ~573) `node` 字段清单增加 autoLayout 相关字段：`layoutMode / itemSpacing / paddingLeft / paddingRight / paddingTop / paddingBottom / primaryAxisAlignItems / counterAxisAlignItems / layoutWrap / layoutSizingHorizontal / layoutSizingVertical / layoutGrow / layoutAlign`
- [x] 2. §4.1.1 (line ~577) REST→CSS 字段表在表格开头插入 autoLayout → flex 完整映射（10 行）+ SPACE_BETWEEN 特别说明 + "布局判定优先级"提示
- [x] 3. §4.3 (line ~810) "布局规则：禁止使用绝对定位"整段重写为 4 步决策树（autoLayout / fixed-/ 特殊前缀 / 重叠 / 兜底 flex）+ 3 条间距单一来源铁律 + padding/gap/margin/absolute 选用说明
- [x] 4. §6.0 (line ~1213) 主 agent 逐叶子对比段追加"双重间距检测 checklist"(4 项自检)
- [x] 5. 交叉验证：grep 全文确认没有旧的"禁止使用绝对定位"孤立表述残留 / 各引用都对得上
- [x] 6. 更新 acceptance.md（步骤 1-5 全 [x] 后再写终稿）
- [x] 7. 【追加补丁 2026-07-30】§4.3 判定优先级第 1 条追加"父 autoLayout + 子层混有 fixed- 兄弟"的边界说明 + 正确/错误写法示例；§6.0 checklist 追加"常见触发原因与修复方向"表 4 行。同步到测试项目 SKILL.md。触发原因：用户在 `dKc9NQvjTgHe9sZzg4zFOL / 163:2291` 上跑新规则后产物 `.notify` 仍出现 `position: absolute + padding-top` 混用——agent 因根容器有 `fixed-状态栏` 子层而保守把父写成 relative，暴露 v0.3.1 首版规则对这一场景没有明确指引。
- [x] 8. 【追加补丁 2026-07-30】补 `layoutPositioning` 通用规则（不限前缀）：§4.1 字段清单加此字段 + 语义说明；§4.1.1 §A 表新增"子节点是否脱离父 autoLayout 顺流"行 + "父/子视角互不冲突"注解；§4.3 判定优先级顶部新增**第 0 条**（子视角先于父视角判定）；§6.0 checklist 新增第 6 项 + 修复方向表新增一行。同步到测试项目并保留 init 追加段。触发原因：用户发现 `.mainWrap` 出现 absolute 是因为 agent 未读 `layoutPositioning`——Figma 支持任何子节点脱离父 autoLayout 顺流（不限 bg-/fixed- 前缀），规则里此前完全没提。

## Notes
- 项目基础：v0.3 REST 迁移已完成（未提交），本次是 v0.3.1 提示词补丁
- 触发原因：用户核对测试稿 `dKc9NQvjTgHe9sZzg4zFOL / 163:2085` 产物发现 9 处定位（明明 Figma 全是 autoLayout）
- 根因：v0.3 REST 迁移时 §4.1 / §4.1.1 遗漏了 autoLayout 字段，agent 没信号可读
- flow2spec.config: subAgent=true 但本次是单文件高耦合改动（4 处互相引用），主 agent 独立完成，不拆 sub-agent
- switchAgentVerification=true 但没有 sub-agent 分工，所以按 f2s-flow2spec-unified-entry"当前 agent 是写入方就在当前 agent 验收"处理
