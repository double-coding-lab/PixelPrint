# Acceptance — skill_add_rn_skill

> 新增独立 SKILL `pp-d2c-rn`,以 React Native 原生标签(View/Text/Image/Pressable/TextInput/ScrollView + StyleSheet)为内核,通过 `config.adapter`(tagMap + importMap)映射到 xtaro / taro / 其他 RN-like 框架。h5 SKILL 一字不改。

## 一、SKILL 独立性验收

### 新增文件

- [ ] `templates/skills/pp-d2c-rn/SKILL.md`
- [ ] `templates/skills/pp-d2c-rn/bin/figma.mjs`(与 h5 版一模一样)
- [ ] `templates/pp-d2c.rn.config.json`
- [ ] `.Knowledge/topics/pp-d2c-rn.md`
- [ ] `.Knowledge/matchers/m-pp-d2c-rn.json`

### h5 SKILL 零回归

- [ ] `git diff --stat -- templates/skills/pp-d2c/ templates/skills/pp-doctor/ templates/skills/pp-style/ templates/skills/pp-strip-nodeid/` 返回空(除本次任务前的已有改动外无新增)
- [ ] `.claude/skills/f2s-*` 未动
- [ ] `templates/pp-d2c.config.json`(h5 模板)未改

## 二、功能验收(rn SKILL 内容)

### 2.1 顶部说明

- [ ] `# pp-d2c-rn Skill`(独立标题)
- [ ] 说明段:独立 SKILL、目标是 RN + 各 RN-like 框架、通过 adapter 映射
- [ ] 执行模型说明表:删除 `doctor.run` 一行
- [ ] 触发条件明确要求 `project.framework === 'rn'`

### 2.2 config 字段表

- [ ] 新增 `adapter.enabled` / `adapter.tagMap` / `adapter.importMap` / `adapter.reactImport` 四行
- [ ] `health.enabled` 行标注 "rn SKILL 默认 false 且忽略此字段"
- [ ] 新增 adapter 配置示例段(未启用 + 携程 xtaro 两种)
- [ ] 新增"tagMap 只支持 6 大 RN 标签"等边界说明

### 2.3 步骤 0.5 doctor(移除)

- [ ] 整段替换为"rn SKILL 不接 doctor 卫星,即便 config `health.enabled=true` 也忽略"

### 2.4 步骤 2.5 样式方案探测(替换)

- [ ] 从 190+ 行的 h5 P-A/P-B/M-A/M-B/J 五档策略简化为几十行 rn 版说明:"根 View 加 backgroundColor"
- [ ] 明确禁止 rn 侧写 `body { ... }` / `:global` / css-modules

### 2.5 §4.1.1 §A + §B 表(核心改造)

- [ ] §A 表列名从"目标 CSS"改成"目标 RN StyleSheet 属性"
- [ ] 单位:`20px` → `20`(数字);属性名 kebab-case → camelCase
- [ ] `layoutMode` / `flexDirection` / `gap` / `padding*` / `justifyContent` / `alignItems` 全部改成 RN 版
- [ ] `flex-wrap` → `flexWrap`;`layoutSizingHorizontal FILL` → `flex: 1`
- [ ] 页面根特例:`min-height: max(...)` → `minHeight: Dimensions.get('window').height`
- [ ] §B 表 SOLID / GRADIENT / IMAGE 三种 fills 分别退化
- [ ] `box-shadow` 单行 → `shadowColor` / `shadowOffset` / `shadowRadius` / `shadowOpacity` / `elevation` 五个属性
- [ ] 字重 `fontWeight` 必须写字符串
- [ ] 新增 §C 单位规则说明;§D 完整示例(h5 vs rn 对照)

### 2.6 §4.3.rn 退化表(新增)

- [ ] 表格完整覆盖 11 类退化:`fixed-` / `100vh` / `bg-` / GRADIENT / `overflow` / `box-shadow` / `filter blur` / `backdrop-filter` / `INNER_SHADOW` / outline / gradient stroke / strokeAlign CENTER / blend-mode / `gap` / `vw/rem/vh`
- [ ] 每行有触发条件 + rn 退化策略 + QA 告警级别(error/warn/info)
- [ ] QA 段落输出格式示例

### 2.7 §4.4 图片处理

- [ ] JSX 示例从 `<img>` 改成 `<Image source={{uri}}>` 或 `require(...)`
- [ ] SCSS `$asset-prefix` 示例整段删除,改为"禁止 rn 侧写 SCSS 变量"
- [ ] 明确 rn 侧无 `background-image`,背景图必须拆 Image + absoluteFillObject

### 2.8 §4.4.2 字体处理(整改)

- [ ] 删除 `@font-face` CDN 加载方案
- [ ] 替换为 `expo-font Font.loadAsync` / `react-native-asset` 两种方案
- [ ] 引用示例用 StyleSheet + `fontFamily`
- [ ] 明确禁止 rn 侧生成 `@font-face` 代码

### 2.9 §4.6 框架适配(简化)

- [ ] 删除 h5 8 种 styleFormat 表格
- [ ] 保留 rn 3 种(stylesheet / styled-components / nativewind)
- [ ] 明确 stylesheet 为主流程

### 2.10 §4.7 输出文件结构

- [ ] 删除 `.scss` 后缀
- [ ] 说明"styles 定义放 index.tsx 底部或抽 styles.ts"

### 2.11 §5 合并输出

- [ ] JSX 示例从 `<div className="...">` 改成 `<View style={styles.xxx}>`
- [ ] flat/component 模式说明保留,但样式合并逻辑改为"合并到 StyleSheet 对象"

### 2.12 §5.5 应用 adapter(新增)

- [ ] 5.5.1 校验 tagMap(6 大标签白名单 + JSX 标识符正则)
- [ ] 5.5.2 校验 importMap
- [ ] 5.5.3 重写 JSX 标签
- [ ] 5.5.4 重写 import 段(按 import 源分组)
- [ ] 5.5.5 adapter 应用禁止项
- [ ] 完整 xtaro adapter 前后对照示例

### 2.13 §7 输出交付物 + 退化告警

- [ ] `🎯 Adapter 应用:...` 行新增
- [ ] §7.1 RN 端退化告警块(error/warn/info 三级分组)
- [ ] §7.2 Adapter 应用报告

### 2.14 禁止项(整段重写)

- [ ] 删除 h5 特有禁止:`body 背景`/`:global`/多页 P-B M-B/scss 相关
- [ ] 新增 rn 特有禁止:`<div>`/`<span>`/`.scss`/`className`/`'20px'` 字符串/`fontWeight: 500` 非字符串/`display: 'block'`/`overflow`/`background-image`/`::placeholder`/`@font-face`
- [ ] 新增 adapter 相关禁止:改动 style/props/children;对 StyleSheet 应用 tagMap

## 三、CLI 验收

### 3.1 install.js `installFiles`

- [ ] 签名扩展为 `installFiles(forceSkills, skipConfig, options = {})`
- [ ] `options.skipRn` 控制是否复制 pp-d2c-rn 目录
- [ ] 逐个 SKILL 目录复制,通过 `readdirSync + isDirectory` 遍历

### 3.2 install.js `runInit` 顺序

- [ ] 先问 framework(react/rn),再调 `installFiles(true, true, { skipRn: framework !== 'rn' })`
- [ ] react 分支:`.claude/skills/pp-d2c-rn/` 不被复制
- [ ] rn 分支:`.claude/skills/pp-d2c-rn/` 被复制

### 3.3 rn 分支 adapter 引导

- [ ] `[2.1/8] 是否启用 adapter 映射` 题目存在,默认 No
- [ ] 选 Yes 后进 `[2.2/8] 选择预设 adapter`(携程 xtaro / 自定义)
- [ ] 选携程 xtaro → 写入 XTARO_ADAPTER 常量的 6 组映射
- [ ] 选自定义 → 写入 `{ enabled: true, tagMap: {}, importMap: {} }` + 提示手工填
- [ ] 沿用现有 adapter 配置的分支正确工作

### 3.4 config 写入分叉

- [ ] rn 分支:`health` 段写 `{ enabled: false }`(或沿用 existing.health)
- [ ] rn 分支:config 顶层多一段 `adapter: adapterCfg`
- [ ] react 分支:config 不含 `adapter` 字段
- [ ] `layers` 段补齐 `end` / `input` 前缀

### 3.5 SKILL 个性化规则注入

- [ ] `skillPath` 按 framework 分叉:react → `.claude/skills/pp-d2c/SKILL.md`;rn → `.claude/skills/pp-d2c-rn/SKILL.md`
- [ ] 单位规则注入到正确的 SKILL

### 3.6 dry-run

- [ ] `node -c bin/install.js` 语法通过
- [ ] `installFiles(true, true, { skipRn: true })` react 分支实际不复制 rn(dry-run 已验)
- [ ] `installFiles(true, true, { skipRn: false })` rn 分支两个都复制(dry-run 已验)

## 四、知识库验收

### 4.1 topic 新增

- [ ] `.Knowledge/topics/pp-d2c-rn.md` 完整可读
- [ ] 内容涵盖:适用场景/触发词 / 与 h5 SKILL 分工 / RN 六件套 / adapter 配置 / 样式方案 / 退化表 / 与 h5 共享规则 / rn 特有执行步骤 / 边界与禁止

### 4.2 matcher 新增

- [ ] `.Knowledge/matchers/m-pp-d2c-rn.json` 存在
- [ ] `includeAny` 包含 70+ 关键词,覆盖 rn/xtaro/adapter/StyleSheet/RN 内核/退化 等场景
- [ ] JSON 语法有效

### 4.3 manifest-routing.json 更新

- [ ] `topicPaths` 新增 `pp-d2c-rn` 键
- [ ] `taskToTopicRules` 新增一条(matcherId `m-pp-d2c-rn`,topics `pp-d2c-rn`)
- [ ] `topicMetadata` 新增 `pp-d2c-rn: { primary: 'feature', tags: ['module', 'config'], confidence: 'manual' }`
- [ ] JSON 语法有效

### 4.4 index.md 更新

- [ ] Topic Overview 表新增一行 `pp-d2c-rn`
- [ ] 描述提及 6 大 RN 内核标签 + adapter + StyleSheet
- [ ] `关联: [[pp-d2c]]` 交叉引用

## 五、端到端回归(用户执行)

- [ ] 用户手动跑 `node bin/install.js init`,选 framework=rn,确认:
  - [ ] `.claude/skills/pp-d2c-rn/` 被复制
  - [ ] `.claude/skills/pp-d2c/` 也被复制(现有行为,五个 SKILL 都装)
  - [ ] 交互中出现 `[2.1/8] 是否启用 adapter 映射` 题目
  - [ ] 选携程 xtaro,config 里 adapter 段是完整 xtaro 映射
  - [ ] config `health.enabled` 是 `false`
  - [ ] SKILL.md 底部有"项目个性化规则"注入
- [ ] 用户手动跑一次 rn 项目 D2C:
  - [ ] 拿一份 Figma 稿(可与 h5 测试稿相同)
  - [ ] 触发 rn SKILL
  - [ ] 验证产物是 `<View>` / `<Text>` 六件套 + StyleSheet.create
  - [ ] 启用 xtaro adapter 后,产物是 `<XView>` from `@myxx/xtaro`
  - [ ] QA 段落有退化告警(fixed / gradient 之类的常见退化)
- [ ] 用户手动跑一次 react 项目 D2C(回归确认):
  - [ ] `install.js` 选 react,`.claude/skills/pp-d2c-rn/` 不被复制
  - [ ] Figma 稿产物与之前完全一致(h5 SKILL 未回归)

## 六、归档条件

上述 1-4 通过 → 用户在此文件顶部补 `已验收 YYYY-MM-DD`,agent 归档到 `.task/completed/<YYYYMMDD>-skill_add_rn_skill/`。

第五组(端到端)可由用户自行验证,不阻塞归档 — 但归档前必须已经完成 1-4 组的静态核对。
