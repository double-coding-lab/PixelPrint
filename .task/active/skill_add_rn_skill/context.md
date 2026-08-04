# skill_add_rn_skill Context

## Involved Files

### 新增
- `templates/pp-d2c.rn.config.json` — rn 默认 config 模板(D3)
- `templates/skills/pp-d2c-rn/SKILL.md` — 新 SKILL 主文档(D1,从 h5 复制起步)
- `templates/skills/pp-d2c-rn/bin/figma.mjs` — 从 h5 复制,零改动(D2)
- `.Knowledge/topics/pp-d2c-rn.md` — 独立 topic(D5.a)
- `.Knowledge/matchers/m-pp-d2c-rn.json` — 独立 matcher(D5.b)

### 修改
- `bin/install.js` — installFiles 加 skipRn,runInit 加 adapter 引导,写 config 分叉(D4)
- `.Knowledge/manifest-routing.json` — 新增 taskToTopicRules / topicPaths / topicMetadata(D5.c)
- `.Knowledge/index.md` — topic overview 表加 rn 行(D5.d)

### 参考(不改)
- `templates/skills/pp-d2c/SKILL.md` — h5 SKILL,rn SKILL 从这里复制起步
- `templates/skills/pp-d2c/bin/figma.mjs` — 直接复制到 rn SKILL
- `templates/pp-d2c.config.json` — h5 默认 config,rn 模板参考它结构
- `.Knowledge/topics/pp-d2c.md` — h5 topic,rn topic 参考它结构

## Related Materials

- `.Knowledge/req-docs/d2c-rn-adapter_需求澄清.md` — 需求澄清文档(定型的决策清单)
- `.Knowledge/req-docs/d2c-rn-adapter_技术方案.md` — 详细技术方案(D1-D6 交付单元 + 里程碑)
- `.Knowledge/topics/pp-d2c.md` — 现有 h5 topic,rn topic 会引用它的前缀/布局部分,不重复
- `.Knowledge/topics/f2s-task.md` + `.claude/rules/f2s-task.md` — 任务追踪规则

## User Todo List

- 见同目录 `user-todos.md`

## Acceptance

- 见同目录 `acceptance.md`(每个 task.md 步骤都 [x] 后,归档前填终稿)
