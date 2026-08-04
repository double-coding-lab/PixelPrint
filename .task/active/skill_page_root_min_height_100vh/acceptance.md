# Acceptance — skill_page_root_min_height_100vh

> v0.3.3 提示词补丁:让页面根容器自动生成 `min-height: max({figmaH*scale}px, 100vh)` 而不是死值 `height: {figmaH}px`。

## 一、SKILL 静态核对

### 主 SKILL `templates/skills/pp-d2c/SKILL.md`

- [ ] §4.1.1 §A 表 "容器自身尺寸行为" 行末尾出现 "**页面根容器例外**（v0.3.3 新增）" 说明
- [ ] §4.3 判定优先级新增第 6 条 "**页面根容器（v0.3.3 新增,特殊覆写规则）**",含:
  - 3 信号 AND 判定表(A/B/C)
  - CSS 覆写模板(min-height: max + 内部 bg 层 inset:0)
  - "为什么放在第 6 条而不是第 1 条" 说明
  - 4 类边界与豁免场景
- [ ] §6.0 checklist 第 9 项:根容器用死值 height 未覆写检测
- [ ] §6.0 修复方向表最后一行:根容器死值 → min-height:max 覆写指引

### 知识库

- [ ] `.Knowledge/topics/pp-d2c.md` 新增 §9 "页面根容器 min-height: max(..., 100vh)(v0.3.3 新增)"
- [ ] 同 topic "关键前缀清单" 段(约 line 285)新增一条 v0.3.3 说明
- [ ] `.Knowledge/matchers/m-pp-d2c.json` 加 12 个 v0.3.3 关键词(页面根容器/根容器/100vh/min-height 等);JSON 语法有效

### 测试项目

- [ ] `figma-plugin-test-function/.claude/skills/pp-d2c/SKILL.md` 已同步(1578 行,保留 init 尾部段)

## 二、端到端回归验证(用户执行)

- [ ] 清缓存:`rm -rf figma-plugin-test-function/.d2c-cache/dKc9NQvjTgHe9sZzg4zFOL`
- [ ] 让 Claude 重跑 `dKc9NQvjTgHe9sZzg4zFOL / 163:2291` 设计稿
- [ ] 观察产物 `pages/D3CTicketFillIn/index.scss` 根 CSS:
  - [ ] `.d3c-ticket-fillin` 出现 `min-height: max(1624px, 100vh)`,**不是** `min-height: 1624px`
  - [ ] 根内部 `.d3c-ticket-fillin__bg`(layoutPositioning:ABSOLUTE 的背景层)出现 `height: 100%` 或 `inset: 0`,**不是** `height: 1624px`
  - [ ] `background-size` 从死值 `750px 1624px` 改成 `cover`(或类似值)
- [ ] 手机不同设备验证:
  - [ ] iPhone SE(667pt)高度小于 1624/2=812,页面按 1624px min-height 显示不被压缩
  - [ ] iPhone 14 Pro Max(932pt)高度大于设计稿,页面撑到视口,底部品宣(`end-img-pinxuan` 如已配)真正贴屏底

## 三、回归验证(不能误伤)

- [ ] 拿一个 `sub-cardopen`(163:2302) 单独跑,产物 `.card-open` 不出现 `100vh`(高度 794px 不接近视口,信号 C 排除)
- [ ] 拿一个长图页面(如 375×2000)测试,产物根容器 `min-height: 4000px` 保留死值(信号 C 排除,不覆写)
- [ ] 已有 v0.3.2 `end-` 前缀行为不受影响
- [ ] 已有 v0.3.1 flex 判定优先级 1-5 结果不受影响(第 6 条只覆写高度和背景,不改内部结构)

## 四、归档条件

上述 1-3 通过 → 用户在此文件顶部补 `已验收 YYYY-MM-DD`,agent 归档到 `.task/completed/<YYYYMMDD>-skill_page_root_min_height_100vh/`。
