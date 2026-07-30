# Acceptance — skill_add_end_prefix

> 用户核对项：v0.3.2 新增 `end-` 逆向布局前缀。逐项核对通过即可归档。

## 一、SKILL 静态核对（Agent 已自查通过，用户复核）

### 主 SKILL `templates/skills/ctrip-train-d2c/SKILL.md`

- [ ] Config 字段速查表出现 `layers.end` 行（默认 `end-`），紧挨 `layers.fixed`
- [ ] §4.3 图层前缀总表新增 `end-` 行，描述"逆向布局（贴父末端）"及叠加规则
- [ ] §4.3 fixed- 章节后新增独立子章节 **"`end-` 逆向布局规则（v0.3.2 新增）"**，含：
  - 触发前提 4 条（父 autoLayout / 位置末端 / 不多个 / 不与 fixed 同现）
  - 生成机制 wrapper + `justify-content: space-between`（带 JSX 结构和 SCSS 例）
  - 父 HORIZONTAL 时的说明（`column` 换 `row`）
  - 覆盖 `primaryAxisAlignItems` 时的 QA 告警
  - 特殊短路：父原 `SPACE_BETWEEN` + 只 2 子时省略 wrapper
  - wrapper className `__front-group` + 不写 `data-node-id`
  - 父容器主轴必须 FIXED/FILL 的强制 QA 告警
- [ ] §6.0 checklist 第 8 项："end- 前缀未生成 wrapper + space-between 结构"检测
- [ ] §6.0 修复方向表新增一行：`end-` 触发被误用 margin-auto / absolute+bottom / gap 模拟 → 唯一实现 wrapper + space-between

### doctor `templates/skills/ctrip-train-d2c-doctor/SKILL.md`

- [ ] Config 表新增 `layers.end` 行（顺便补了漏掉的 `layers.fixed` 一行）
- [ ] 前缀识别段例子加 `end-img-pinxuan → [end, img]`
- [ ] 规则总览表新增 5 行：NAM016 / LAY017 / LAY018 / LAY019 / LAY020
- [ ] NAM003 前缀冲突表新增两行：`end + bg/bgc/x` 与 `fixed + end`
- [ ] §3.6e NAM016：end- 与 bg-/bgc-/x- 叠加（error）
- [ ] §3.9f LAY017：end- 不在父末位（error）
- [ ] §3.9g LAY018：多个 end- 子（warn）
- [ ] §3.9h LAY019：父不是 autoLayout（error）
- [ ] §3.9i LAY020：end- 与 fixed- 同现（warn）

### style `templates/skills/ctrip-train-d2c-style/SKILL.md`

- [ ] Config 表新增 `layers.end` 行

### 知识库

- [ ] `.Knowledge/topics/ctrip-train-d2c.md` 第 8 段"end- 逆向布局（贴父末端，v0.3.2 新增）"存在
- [ ] 同 topic 关键前缀清单段新增 end- 一条（紧挨 fixed- 说明）
- [ ] `.Knowledge/index.md` topic overview 表 `ctrip-train-d2c` 行的前缀清单补 `end-`
- [ ] `.Knowledge/matchers/m-ctrip-train-d2c.json` 新增 12 个关键词：end-, end 前缀, 逆向布局, 贴底, 贴右, 贴父末端, space-between wrapper, LAY017/018/019/020, NAM016
- [ ] JSON 语法有效（`node -e` 已验证过）

### 测试项目同步（用户可 diff 核对）

- [ ] `figma-plugin-test-function/.claude/skills/ctrip-train-d2c/SKILL.md`（1533 行，含 init 尾部）
- [ ] `figma-plugin-test-function/.claude/skills/ctrip-train-d2c-doctor/SKILL.md`（937 行）
- [ ] `figma-plugin-test-function/.claude/skills/ctrip-train-d2c-style/SKILL.md`（391 行）

## 二、端到端回归验证（用户执行）

在测试项目 `figma-plugin-test-function/` 里：

- [ ] 找一个真实需要"贴底"的节点。最简单的方式：让设计师（或用户自己）把 `img-pinxuan` 图层名在 Figma 里改成 `end-img-pinxuan`。或者创建一个测试节点。
- [ ] 清缓存：`rm -rf .d2c-cache/dKc9NQvjTgHe9sZzg4zFOL`
- [ ] 重跑 SKILL，观察产物：
  - [ ] JSX 结构里出现 wrapper 包裹前面兄弟节点（class 用父类名 + `__front-group` 后缀，没有 `data-node-id`）
  - [ ] 父容器 CSS 出现 `justify-content: space-between`
  - [ ] `end-` 节点自己没有额外 `position:absolute` / `margin-top:auto`（保持普通节点渲染）
  - [ ] doctor 报告里没有 LAY017-020 / NAM016 error 或 warn（正确使用场景不该报错）
- [ ] 手机上不同设备打开：设备高度 >812 时 end- 节点贴屏底显示
- [ ] 抽测错误用法（可选）：
  - [ ] 把 end- 加到不是末位的节点上 → doctor 报 LAY017
  - [ ] 把 end- 加到父不是 autoLayout 的节点上 → doctor 报 LAY019
  - [ ] 起名 `end-bg-xxx` → doctor 报 NAM016

## 三、回归验证（不能因新规则误伤老功能）

- [ ] 没有 end- 前缀的节点行为与之前 v0.3.1 完全一致（判定优先级 0-5 不受影响）
- [ ] `fixed-` 前缀独立可用，LAY013 / NAM014 仍生效
- [ ] `bg-` / `bgc-` / `x-` / `sub-` / `img-` / `btn-` 等前缀行为不变
- [ ] doctor 规则总览表新增的 5 行不影响老规则打分（NAM016 是新 ID，与老 NAM 系列不冲突）

## 四、归档条件

上述 1-3 全部通过 → 用户在此文件顶部补一句 `已验收 YYYY-MM-DD`，随后 agent 可把 `.task/active/skill_add_end_prefix/` 归档到 `.task/completed/<YYYYMMDD>-skill_add_end_prefix/`。
