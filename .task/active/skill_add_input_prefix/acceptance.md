# Acceptance — skill_add_input_prefix

> v0.3.4 新增 `input-` 独立前缀:让 D2C 直接生成 `<input type="text">` 标签,而不是 `<div>+<span>` 堆砌。

## 一、SKILL 静态核对

### 主 SKILL `templates/skills/pp-d2c/SKILL.md`

- [ ] Config 表新增 `layers.input` 行(line 94),默认 `input-`
- [ ] §4.3 图层前缀总表新增 `input-` 行(line 683),说明独立前缀 + 不可叠加 bg/bgc/x/img/btn + 可叠加 fixed/end/sub
- [ ] §4.3 end- 章节后新增独立子章节 **"`input-` 输入框规则(v0.3.4 新增)"** (line 1059),含:
  - Figma 图层结构约定(input- Frame + 可选图标 + 必需 TEXT)
  - placeholder / 颜色 / 视觉 / 图标 / 宽高来源
  - 生成机制(JSX 单标签 + SCSS 模板)
  - 图标切图约定(独立切图作 background-image,不生成 DOM)
  - 类型限定说明(仅 text,其他 QA 告警)
  - doctor 4 条规则概览
  - 典型场景
- [ ] §6.0 checklist 第 10 项(line 1546)
- [ ] §6.0 修复方向表最后一行(input- 生成 div+span 而不是 input)

### doctor `templates/skills/pp-doctor/SKILL.md`

- [ ] Config 表新增 `layers.input` 行(line 54)
- [ ] 前缀识别段例子加 `input-people` + `fixed-input-search`
- [ ] 规则总览表新增 4 行 NAM017/018/019/020
- [ ] NAM003 冲突表新增 2 行(`input`+`bg/bgc/x` / `input`+`img/btn`)
- [ ] §3.6f NAM017 无 TEXT 子层(error) — line 435
- [ ] §3.6g NAM018 多 TEXT 子层(warn) — line 448
- [ ] §3.6h NAM019 与 bg/bgc/x 叠加(error) — line 461
- [ ] §3.6i NAM020 与 img/btn 叠加(error) — line 474

### style `templates/skills/pp-style/SKILL.md`

- [ ] Config 速查表新增 `layers.input` 行

### 知识库

- [ ] `.Knowledge/topics/pp-d2c.md` §10 段"input- 输入框(v0.3.4 新增)"完整
- [ ] 同 topic 关键前缀清单段追加 input- 说明行
- [ ] `.Knowledge/index.md` topic overview 表前缀清单补 `input-`
- [ ] `.Knowledge/matchers/m-pp-d2c.json` 加 11 个关键词(input-,输入框,input 标签,placeholder,text field,表单输入,NAM017/018/019/020,input 前缀),JSON 语法有效

### 测试项目

- [ ] `figma-plugin-test-function/.claude/skills/` 三份 SKILL 已同步(1654 / 998 / 392 行)

## 二、端到端回归验证(用户执行)

- [ ] Figma 里把 `Frame 256`(163:2321) → `input-people`;`Frame 258`(163:2328) → `input-idcard`;`Frame 260`(163:2335) → `input-city`
- [ ] 清缓存:`rm -rf figma-plugin-test-function/.d2c-cache/dKc9NQvjTgHe9sZzg4zFOL`
- [ ] 重跑 SKILL,验证产物 `pages/D3CTicketFillIn/index.jsx`:
  - [ ] 3 个输入框都是 `<input type="text" placeholder="..." />` 单标签
  - [ ] placeholder 值分别是"请输入乘车人真实姓名"/"请填写真实信息..."/"请选择"
  - [ ] 不再有 `<div class="...field-input">` + `<span class="...field-icon">` + `<span>...</span>` 三层结构
- [ ] 验证 `pages/D3CTicketFillIn/index.scss`:
  - [ ] `.d3c-ticket-fillin__input-people/idcard/city` 有 `background-image: url(...icon.svg)` 挂在左侧
  - [ ] `padding-left` 腾出图标位置
  - [ ] `::placeholder { color: #c3a57e }` 存在
- [ ] doctor 侧不报 error/warn(正确用法应通过)

## 三、错误用法抽测(可选)

- [ ] 起名 `input-people`,内部无 TEXT → doctor NAM017 error
- [ ] 起名 `input-people`,内部 3 个 TEXT → doctor NAM018 warn
- [ ] 起名 `input-bg-search` → doctor NAM019 error
- [ ] 起名 `input-img-avatar` → doctor NAM020 error

## 四、回归验证

- [ ] 没有 `input-` 前缀的节点行为不变(依旧生成 div/span)
- [ ] 已有 v0.3.1-v0.3.3 判定优先级 0-6 保持不变
- [ ] 已有 fixed-/end- 前缀行为不变
- [ ] `input-` 与 `fixed-`/`end-`/`sub-` 叠加合法(agent 应能正确处理,不报错)

## 五、归档条件

上述 1-4 通过 → 用户在此文件顶部补 `已验收 YYYY-MM-DD`,agent 归档到 `.task/completed/<YYYYMMDD>-skill_add_input_prefix/`。
