# D2C RN 独立 SKILL + 可配置 Adapter 技术方案

> 澄清文档:`.Knowledge/req-docs/d2c-rn-adapter_需求澄清.md`
>
> 本文档是**详细方案**,面向后续 `f2s-req-plan` 拆任务和 `implement-tech-design` 直接实现。

---

## 需求概览

- 新增独立 SKILL `pp-d2c-rn`,和现有 `pp-d2c`(H5)平行,能出 React Native 原生代码
- 支持用户在 config 里配置 adapter(tagMap + importMap),把 RN 标签映射到 xtaro / taro / expo / react-native-web 等任意 RN-like 框架
- 现有 H5 SKILL、doctor SKILL、style SKILL、strip-nodeid SKILL **一字不改**,零回归
- **非目标**:不做 preset(含 xtaro preset)、不做行为组件(Modal/Switch)、不做动画、不做增量生成/产物缓存、不为 rn 侧新建 doctor/style 卫星

---

## 关键问题概览

| 问题 | 决策 | 备注 |
|------|------|------|
| SKILL 独立度 | A 方案(完全独立,代码复制) | 摸索阶段的成本最优选择 |
| 决策逻辑与 H5 是否共享 | 不共享,复制一份 | 前缀识别 / 布局判定 / 图片处理逻辑复制到 rn SKILL |
| target 参数怎么表达 | **不引入 target 参数**,直接以 SKILL 存在与否表达 | 用户装了 rn SKILL 就调 rn SKILL;两者可共存 |
| adapter 配置形态 | JSON 声明式(tagMap + importMap) | 不允许写 JS 逻辑,避免加载外部代码 |
| adapter 未覆盖的标签 | 走 `react-native` 默认导入 | 部分映射合法 |
| CLI 引导 | 复用现有 `install.js runInit` 的 `framework: 'react' \| 'rn'` 分叉 | rn 分支下的题目要补齐 adapter 引导 |
| RN 无对应 CSS 特性 | 退化 + QA 告警 | fixed → absolute;vh → Dimensions;bg-image → 拆 Image;overflow → ScrollView;box-shadow → shadow* props |
| 缓存(`.d2c-cache/`) | 与 H5 SKILL 完全共享 | 缓存的是 Figma REST JSON + 下载的位图,与 target 无关 |
| 产物目录 | 沿用 `output.dir`,由用户在 config 里管控 | 用户可以给 h5 / rn 项目分开 config 文件 |
| doctor 是否新建 | **不新建**。rn SKILL 内 `health.enabled=false` 默认关闭 | rn 侧不引入新的卫星依赖 |

---

## SKILL 独立性拆分

### 目录结构

```
templates/skills/
├── pp-d2c/               ← 现有 h5 SKILL,一字不改
│   ├── SKILL.md
│   └── bin/figma.mjs
├── pp-doctor/        ← 现有卫星,一字不改
│   └── SKILL.md
├── pp-style/         ← 现有卫星,一字不改
│   └── SKILL.md
├── pp-strip-nodeid/  ← 现有卫星,一字不改
│   └── SKILL.md
└── pp-d2c-rn/            ← 【新增】
    ├── SKILL.md                     ← 从 pp-d2c/SKILL.md 复制起步,按下节改造
    └── bin/figma.mjs                ← 从 pp-d2c/bin/figma.mjs 复制,零改动
```

### rn SKILL 内容 = h5 SKILL 复制 + 定点改造

**保留(不改)**:

- 步骤 -1 探针
- 步骤 0 读配置(除多加几个 rn 字段)
- 步骤 0.3 缓存初始化(`.d2c-cache/` 完全复用 h5 侧)
- 步骤 1 解析 URL
- 步骤 2 拉稿
- 步骤 4.0 前缀识别决策(sub/img/bg/bgc/btn/input/fixed/end 全体保留)
- 步骤 4.1 布局判定决策(autoLayout / gap / padding / align 全体保留)
- 图片处理逻辑(`use_absolute_bounds` / 兜底链 / bg 内嵌 bgc 摘取 / CSS-able 自检)

**改造(共 6 处)**:

1. 顶部备注段落改成 RN 独立说明
2. 步骤 0 config 字段表**新增 `adapter` 段**
3. **删除步骤 2.5 样式方案探测**(RN 侧统一 StyleSheet,无需探测)
4. **删除步骤 0.5 doctor 调用**(rn 侧不接 doctor)
5. **改造步骤 4 §A 表格**:把"Figma → CSS"映射改成"Figma → RN StyleSheet 对象"
6. **改造步骤 5 合并输出**:JSX 标签用 RN 六件套,末尾加 adapter 映射步骤

**注意**:上述改造完成后,rn SKILL 内所有"决策规则的自然语言描述"仍然引用统一的前缀名(`img-`/`btn-`/`input-`/...),不做重命名。前缀含义等价,仅"输出形态"不同。

### install.js 分叉逻辑

现有 `runInit` 已经有 `framework: 'react' | 'rn'` 分叉。**当前 rn 分支基本是 stub**(只让用户选了 styleFormat 就走完 config),真正让 rn 跑起来还需:

1. rn 分支下,`installFiles` 增加"复制 rn SKILL 目录"的动作
2. rn 分支下,新增 3 道题:是否接 adapter → tagMap → importMap
3. rn 分支下,写 config 时新增 `adapter` 段的 spread merge 逻辑

---

## Config Schema 定义

### rn 侧新增字段(在现有 config 结构上扩展)

```jsonc
{
  "version": "2.0.0",
  "project": {
    "framework": "rn",              // 现有,rn 分支下必填
    "styleFormat": "stylesheet"     // 现有,rn 分支下取值 stylesheet / styled-components / nativewind
  },
  "figma": { "token": "..." },      // 现有,rn / h5 共用
  "unit": { /* 现有 */ },
  "images": {
    "assetsDir": "assets/",         // 现有,rn 项目建议改成 assets/ 或 images/
    "imageBaseUrl": ""              // rn 项目一般为空,走 require('./assets/xxx.png') 而非 URL
  },
  "layers": { /* 现有前缀体系,rn 完全沿用 */ },
  "output": {
    "dir": "src/pages/"             // 现有,rn 项目一般是 src/pages/ 或 src/screens/
  },
  "health": {
    "enabled": false                // rn 侧默认关闭 doctor
  },

  // ─── 【新增】adapter 段 ──────────────────────────────────
  "adapter": {
    "enabled": false,               // 是否启用 adapter 映射;false 时输出原生 RN
    "tagMap": {
      // "View": "XView",              // 例:接携程 xtaro
      // "Text": "XText",
      // "Image": "XImage",
      // "Pressable": "XView",
      // "TextInput": "XInput",
      // "ScrollView": "XScrollView"
    },
    "importMap": {                  // key 是"映射后的标签名"
      // "XView": "@myxx/xtaro",
      // ...
    },
    "reactImport": "react"          // 可选,默认 'react',允许覆盖(极少数场景)
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `adapter.enabled` | boolean | 否 | `false` | `false` 时无视 tagMap/importMap,输出原生 RN;`true` 时按下表映射 |
| `adapter.tagMap` | `Record<string, string>` | 否 | `{}` | key 是 RN 原始标签(View/Text/Image/Pressable/TextInput/ScrollView),value 是任意合法 JSX 标识符 |
| `adapter.importMap` | `Record<string, string>` | 否 | `{}` | key 是**映射后的标签名**,value 是 import from 的字符串;未列的标签走 `react-native` |
| `adapter.reactImport` | string | 否 | `"react"` | React 本体的 import 源,几乎不用改 |

### tagMap 边界

- 只支持 6 个 RN 原生标签作为 key:`View / Text / Image / Pressable / TextInput / ScrollView`。写其他 key 忽略并 QA 告警
- value 必须匹配 `/^[A-Z][A-Za-z0-9]*$/`(JSX 标识符,大写开头)。不符合的 QA 告警并丢弃该条
- 允许"标签名相同,只改 import 路径"的场景(tagMap 不写,只写 importMap 用 RN 原名做 key)

### importMap 边界

- 允许多个标签共用一个 import 源(每个 key 单独写一行,value 一样即可)
- 未在 importMap 出现的映射后标签,自动 fallback 到 `react-native`
- 未映射的原生标签(比如用户没映射 Image,adapter.enabled=true),Image 保持原名,从 `react-native` 导入

### 与 h5 config 隔离

**不做**:不引入 `d2cRn.*` 命名空间。理由是 rn 项目的 config 里 `project.framework = 'rn'` 已经表明是 rn 项目,同一份 config 文件不会同时是 h5 又是 rn。用户如果要同时用两套,建议**开两个项目 / 两份 config 文件**。

如果用户坚持在同一项目 config 里做 h5 + rn 混合,`adapter` 段对 h5 SKILL 是**未知字段被忽略**(h5 SKILL 从不读 `adapter`),不会引发问题。

---

## Style 转换字典

**位置**:rn SKILL §4 §A 表(替换 h5 版 §A 表)

### 尺寸类

| Figma REST 字段 | h5 输出(参考) | rn 输出 |
|-----------------|--------------|---------|
| `absoluteBoundingBox.width` 20 | `width: 40px`(scale=2) | `width: 40` |
| `absoluteBoundingBox.height` 44 | `height: 88px` | `height: 88` |
| `paddingLeft/Right/Top/Bottom` | `padding: 20px 16px 20px 16px` | `paddingLeft: 32, paddingRight: 32, paddingTop: 40, paddingBottom: 40` |
| `itemSpacing` 10 | `gap: 20px` | `gap: 20`(RN 0.71+ 支持) |
| `cornerRadius` 8 | `border-radius: 16px` | `borderRadius: 16` |

**规则**:

- 所有 px 数值 = `figmaValue * unit.scale`,写数字不写单位
- 属性名统一 camelCase(`paddingLeft` 不是 `padding-left`)
- padding 四值不能简写(RN 支持 `padding: [num]` 但不支持"上下左右"简写字符串)

### 布局类

| Figma auto layout | h5 输出 | rn 输出 |
|-------------------|---------|---------|
| `layoutMode: HORIZONTAL` | `display: flex; flex-direction: row` | `flexDirection: 'row'`(RN 默认 flex,`display: 'flex'` 可省) |
| `layoutMode: VERTICAL` | `display: flex; flex-direction: column` | (RN 默认 column,可全省) |
| `primaryAxisAlignItems: SPACE_BETWEEN` | `justify-content: space-between` | `justifyContent: 'space-between'` |
| `counterAxisAlignItems: CENTER` | `align-items: center` | `alignItems: 'center'` |
| `layoutSizingHorizontal: FILL` | `width: 100%` 或 `flex: 1` | `flex: 1` 或 `alignSelf: 'stretch'` |
| `layoutSizingHorizontal: HUG` | (自然内容宽) | (不写 width,RN 自然 hug) |
| `layoutPositioning: ABSOLUTE` | `position: absolute; top/left...` | `position: 'absolute', top: N, left: N` |

### 颜色 / 装饰类

| Figma | h5 输出 | rn 输出 |
|-------|---------|---------|
| `fills[0]: SOLID color rgb` | `background-color: #hex` | `backgroundColor: '#hex'` |
| `fills[0]: GRADIENT_LINEAR` | `background-image: linear-gradient(...)` | **无原生支持**,详见退化表 |
| `strokes[0]` Outside | `outline: 2px solid #xxx` | `borderColor: '#xxx', borderWidth: 2`(近似,无 outside/inside 区分) |
| `strokes[0]` Inside | `border: 2px solid; box-sizing: border-box` | 同上 |
| `effects DROP_SHADOW` | `box-shadow: 0 2px 4px rgba(...)` | 拆成 4 个属性:`shadowColor: '#hex', shadowOffset: {width:0, height:2}, shadowRadius: 4, shadowOpacity: 0.3` + `elevation: 4`(Android) |
| `effects LAYER_BLUR` | `filter: blur(10px)` | **无原生支持**,QA 告警 |
| `effects INNER_SHADOW` | `box-shadow: inset ...` | **无原生支持**,QA 告警 |

### 文字类

| Figma text style | h5 输出 | rn 输出 |
|------------------|---------|---------|
| `fontSize: 14` | `font-size: 28px` | `fontSize: 28` |
| `fontWeight: 500` | `font-weight: 500` | `fontWeight: '500'`(字符串!RN 只认 `'normal'/'bold'/'100'-'900'`) |
| `textAlignHorizontal: CENTER` | `text-align: center` | `textAlign: 'center'` |
| `lineHeightPx: 20` | `line-height: 40px` | `lineHeight: 40` |
| `letterSpacing: 0.5` | `letter-spacing: 1px` | `letterSpacing: 1` |
| `fills[0]` on TEXT node | `color: #hex` | `color: '#hex'` |

### 完整示例

Figma 节点(某按钮):

```json
{
  "layoutMode": "HORIZONTAL",
  "paddingLeft": 16, "paddingRight": 16, "paddingTop": 12, "paddingBottom": 12,
  "counterAxisAlignItems": "CENTER",
  "cornerRadius": 8,
  "fills": [{ "type": "SOLID", "color": { "r": 0.036, "g": 0.734, "b": 0.028 } }]
}
```

h5 输出(现状):

```css
.btnLogin { display: flex; flex-direction: row; padding: 24px 32px; align-items: center; border-radius: 16px; background-color: #09bb07; }
```

rn 输出(本方案):

```js
btnLogin: { flexDirection: 'row', paddingLeft: 32, paddingRight: 32, paddingTop: 24, paddingBottom: 24, alignItems: 'center', borderRadius: 16, backgroundColor: '#09bb07' }
```

---

## RN 特性退化表

**位置**:rn SKILL §4.3 判定优先级末尾追加

| Figma / h5 语义 | 触发条件 | rn 退化策略 | QA 告警级别 |
|-----------------|---------|-----------|-----------|
| `fixed-` 前缀 | 图层名带 `fixed-` | 生成 `position: 'absolute'`,constraints 转 `top/left/right/bottom` 数值;告警说明 fixed 语义在 RN 端不完全等价 | warn |
| 页面根 `min-height: max(x, 100vh)` | 3 信号 AND 命中 | 生成 `minHeight: Dimensions.get('window').height`;需 `import { Dimensions } from 'react-native'` | info |
| `bg-` 背景图 | 图层名带 `bg-` | 拆成 `<Image source={require('./xxx.png')} style={StyleSheet.absoluteFillObject} />`,置于兄弟节点数组最前,原容器改为 `position: relative` | info |
| GRADIENT_LINEAR / RADIAL 填充 | `fills[0].type` = GRADIENT_* | 退化为纯色(取渐变第一个 stop)+ QA 告警提示"渐变需接 `react-native-linear-gradient` 手改" | warn |
| `overflow: scroll` 容器 | `scrollx-` / `scrolly-` 前缀 | 标签强制换 `<ScrollView>`(rn SKILL 里本来就是这样,不算退化;这里列出是为文档完整) | 无 |
| `box-shadow` | effect DROP_SHADOW | 拆成 4-5 个 shadow* 属性(见 style 字典) | 无 |
| `filter: blur` | effect LAYER_BLUR | 生成 `// TODO: RN needs 'expo-blur' or '@react-native-community/blur'`;不出 style | error |
| `backdrop-filter: blur` | effect BACKGROUND_BLUR | 同上 | error |
| INNER_SHADOW | effect INNER_SHADOW | 无 RN 原生支持;不出 style | error |
| `outline` 类描边 | strokes Outside | 退化为普通 border + QA 告警"RN 无 outside 描边概念,已按普通 border 渲染" | warn |

### QA 告警输出格式

rn SKILL §7 自检段落末尾追加:

```
### RN 端退化告警

- [warn] nodeId 163:2321 `fixed-btn-回顶`:fixed 已退化为 absolute,滚动时不保持屏幕位置
- [info] nodeId 163:2300 页面根:已使用 Dimensions.get('window').height 作 minHeight
- [warn] nodeId 163:2350 `bg-page-gradient`:线性渐变已退化为纯色 #ff6600,如需真渐变请手动接 react-native-linear-gradient
- [error] nodeId 163:2400 `sub-blur-modal`:effect LAYER_BLUR 在 RN 无原生对应,请手动接 @react-native-community/blur
```

---

## Adapter 应用步骤

**位置**:rn SKILL §5 步骤末尾,合并生成产物后追加

### 步骤 5.5:应用 adapter(仅 `adapter.enabled === true` 时执行)

假设 rn SKILL 生成的原始产物是:

```jsx
import React from 'react';
import { View, Text, Image, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

const styles = StyleSheet.create({ /* ... */ });

export default function Index() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>标题</Text>
      <Pressable style={styles.btn}><Text style={styles.btnText}>登录</Text></Pressable>
    </View>
  );
}
```

Adapter 应用逻辑(agent 按顺序执行):

1. **构建标签替换表**:遍历 `config.adapter.tagMap`,产生 `{ View → XView, Text → XText, Pressable → XView }` 等映射对(未映射的标签保持原名;xtaro 里 Pressable 也归到 XView,因为 XView 自身可点击,不再走 XClickableSimplified)
2. **构建 import 分组表**:对"最终使用的所有标签"按 import 源分组:
   - 每个映射后的标签(如 XView),查 `importMap[XView]` → `@myxx/xtaro`
   - 每个未映射标签(如 StyleSheet,如果 tagMap 里没写),用默认源 `react-native`
   - 无 importMap 命中的映射后标签也 fallback 到 `react-native`
3. **重写 JSX**:全文查找替换 `<View ` → `<XView `、`</View>` → `</XView>`(注意区分开闭标签、自闭合标签)
4. **重写 import 段**:按 import 分组表重新生成 import 语句
5. **其他不变**:styles 定义、business 逻辑、Dimensions 调用等全部保留

**应用后产物**:

```jsx
import React from 'react';
import { XView, XText, XImage, XInput, XScrollView } from '@myxx/xtaro';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({ /* ... */ });

export default function Index() {
  return (
    <XView style={styles.root}>
      <XText style={styles.title}>标题</XText>
      <XView style={styles.btn}><XText style={styles.btnText}>登录</XText></XView>
    </XView>
  );
}
```

### Adapter 应用边界

- **只重写标签名与 import**:不动 props、不动 style、不动 children
- **StyleSheet / Dimensions 等 API 保留从 `react-native` 导入**:这些是"工具"不是"标签",不进 tagMap
- **只对 rn SKILL 生成的产物应用**:h5 SKILL 完全不感知 adapter 段的存在

---

## CLI 引导题目

**位置**:`bin/install.js runInit` 内 `framework === 'rn'` 分支

### 现有 rn 分支的题目(保留)

- `[1/8] 项目框架`:react / rn
- `[2/8] 样式方案`:stylesheet / styled-components / nativewind

### 【新增】rn 分支的题目

- `[2.1/8] 是否启用 adapter 映射` (No / Yes,默认 No)
  - 选 No → adapter 段写 `{ enabled: false, tagMap: {}, importMap: {} }`,进入下一大项
  - 选 Yes → 继续问 2.2

- `[2.2/8] 选择预设 adapter`(仅 adapter 启用时问)
  - 选项:`携程 xtaro` / `自定义`
  - 选携程 xtaro → 内置写入 tagMap + importMap(见下方"内置携程 xtaro adapter")
  - 选自定义 → 只写 `{ enabled: true, tagMap: {}, importMap: {} }`,提示用户后续手改 config

### 内置携程 xtaro adapter 的 config 片段

**注意**:虽然澄清文档说"不做 preset",但 CLI 侧作为"便利选项"允许用户"一键写入"一份 xtaro 映射作为**起点**。用户后续可手改。这不等于内核层集成 xtaro。

```json
{
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "XView",
      "Text": "XText",
      "Image": "XImage",
      "Pressable": "XView",
      "TextInput": "XInput",
      "ScrollView": "XScrollView"
    },
    "importMap": {
      "XView": "@myxx/xtaro",
      "XText": "@myxx/xtaro",
      "XImage": "@myxx/xtaro",
      "XInput": "@myxx/xtaro",
      "XScrollView": "@myxx/xtaro"
    }
  }
}
```

---

## install.js 改造

### 改动 1:`installFiles(force, skipConfig)` 支持按需复制 rn SKILL

**位置**:`bin/install.js:73`

**现状**:`copyDir(TEMPLATES_DIR/skills, CWD/.claude/skills, forceSkills)` 一把梭复制**全部** SKILL 目录

**改动**:

- 默认行为不变(全复制),兼容存量用户
- 新增 `installFiles(force, skipConfig, options)` 的 `options.skipRn: boolean`
- `runInit` 里根据用户是否选了 `framework = 'rn'` 决定是否 `skipRn`

**伪代码**:

```js
function installFiles(forceSkills = false, skipConfig = false, options = {}) {
  const skipRn = options.skipRn || false
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills')
  const skillsDst = path.join(CWD, '.claude/skills')

  fs.readdirSync(skillsSrc).forEach(name => {
    if (skipRn && name === 'pp-d2c-rn') return
    copyDir(path.join(skillsSrc, name), path.join(skillsDst, name), forceSkills)
  })

  if (!skipConfig) copyFile(...)
  copyFile(...)  // mappings.json
}
```

### 改动 2:`runInit` 顺序调整,先问 framework 再决定 skipRn

**位置**:`bin/install.js:172-179`

**现状**:

```js
async function runInit() {
  let existing = {}
  if (fs.existsSync(CONFIG_PATH)) existing = JSON.parse(...)
  installFiles(true, true)              // ← 这里已经把全部 SKILL 复制过去了
  const framework = await pickOrUse(..., ['react', 'rn'], 'react')
  // ...
}
```

**改动**:

```js
async function runInit() {
  let existing = {}
  if (fs.existsSync(CONFIG_PATH)) existing = JSON.parse(...)

  // 先问 framework,再决定是否复制 rn SKILL
  const p = existing.project || {}
  const framework = await pickOrUse('[1/8] 项目框架', p.framework, ['react', 'rn'], 'react')

  installFiles(true, true, { skipRn: framework !== 'rn' })

  // 继续原有交互(styleFormat / merge / images / ...)
  // ...
}
```

### 改动 3:rn 分支下多问 adapter 3 题

参考 CLI 引导题目一节。

### 改动 4:写 config 时把 adapter 合并进去

**位置**:`bin/install.js:277` 附近,拼装 `newConfig` 对象处

```js
const newConfig = {
  version: '2.0.0',
  project: { name: ..., framework, styleFormat },
  figma: { ...defaults.figma, ...(existing.figma || {}) },
  merge: { mode: mergeMode },
  unit: { ... },
  images: { ...defaults.images, ...(existing.images || {}) },
  layers: { ...defaults.layers, ...(existing.layers || {}) },
  output: { dir: outputDir },
  health: framework === 'rn'
    ? { enabled: false }                    // rn 侧默认关 doctor
    : { ...defaults.health, ...(existing.health || {}) },

  // 【新增】adapter 段
  ...(framework === 'rn' ? { adapter: adapterCfg } : {})
}
```

### 改动 5:模板 config 文件同步

**位置**:`templates/pp-d2c.config.json`

**改动**:

- **不动主模板**(现有 h5 版本保持不变)
- **新增** `templates/pp-d2c.rn.config.json`,内容是 rn 默认 config(含空的 adapter 段)。install.js 在 rn 分支下改从这个模板读默认值

---

## 交付单元清单

### D1:rn SKILL 主文档

**路径**:`templates/skills/pp-d2c-rn/SKILL.md`

**产出方式**:从 `templates/skills/pp-d2c/SKILL.md` 复制,按 SKILL 独立性拆分 里的"改造(共 6 处)"逐条修改

**验证方式**:

- `wc -l` 应在 1500-1800 行之间(与 h5 SKILL 相当)
- `grep -c "React Native\|StyleSheet\|Pressable\|TextInput"` 应 ≥ 20
- `grep -c "adapter\|tagMap\|importMap"` 应 ≥ 10
- `grep -c "doctor.run\|health.enabled"` 应 = 0(证明 doctor 依赖已剥离)

### D2:rn SKILL 的 figma.mjs

**路径**:`templates/skills/pp-d2c-rn/bin/figma.mjs`

**产出方式**:从 `templates/skills/pp-d2c/bin/figma.mjs` **原封复制**,内容一字不改

### D3:rn 模板 config

**路径**:`templates/pp-d2c.rn.config.json`

**产出方式**:全新写入,内容见 install.js 改造 - 改动 5

### D4:install.js 改造

**路径**:`bin/install.js`

**改动量**:约 40-60 行(改动 1-4),集中在 `installFiles` 签名扩展、`runInit` 顺序调整、adapter 引导题目、config 写入分叉

**验证方式**:

- `node bin/install.js` 交互式跑一遍,选 rn framework,确认 `.claude/skills/pp-d2c-rn/` 被复制
- 再跑一遍选 react framework,确认 `.claude/skills/pp-d2c-rn/` **不**被复制
- 生成的 config 里 adapter 段合法

### D5:Topic 与 matcher

**路径**:

- `.Knowledge/topics/pp-d2c-rn.md`(新增)
- `.Knowledge/matchers/m-pp-d2c-rn.json`(新增)
- `.Knowledge/manifest-routing.json`(增量修改)
- `.Knowledge/index.md`(增量修改)

**产出方式**:

- **topics/pp-d2c-rn.md**:参考现有 `topics/pp-d2c.md` 结构,但内容聚焦"rn 分支特有的规则"(前缀识别 / 布局判定 / 图片处理引用原 topic,不重复;style 字典 / 退化表 / adapter 应用步骤是本 topic 独占内容)
- **matchers/m-pp-d2c-rn.json**:关键词包括 "d2c rn / react native d2c / xtaro / RN 生成代码 / StyleSheet / adapter / tagMap / importMap / Pressable / TextInput ScrollView RN / D2C 多端"
- **manifest-routing.json**:`taskToTopicRules` 新增一条 rn 匹配规则;`topicPaths` 新增 rn topic 路径;`topicMetadata` 新增 `pp-d2c-rn: { primary: 'feature', tags: ['module'], confidence: 'manual' }`
- **index.md**:topic overview 表新增一行

---

## 调用 / 交互流程(仅一页级)

用户视角,一次典型的 rn 项目 D2C 流程:

1. 用户 `npx pp-d2c init`,选 framework=rn → CLI 复制 `pp-d2c-rn` SKILL 到 `.claude/skills/`,写 config(含 adapter 段)
2. 用户在 Claude Code 里说"帮我把这个 Figma 稿还原成 xtaro 代码" → agent 匹配到 `pp-d2c-rn` topic,读 rn SKILL
3. rn SKILL 步骤 -1 验 Token → 步骤 0.3 缓存 → 步骤 1-4 前缀识别 + 布局判定 + 图片处理(与 h5 逻辑等价) → 步骤 5 生成原生 RN JSX + StyleSheet
4. 步骤 5.5 读 config.adapter,若 `enabled=true` 则应用 tagMap + importMap 重写 JSX 与 import
5. 步骤 6 QA 段落输出退化告警(fixed 已 absolute / vh 已 Dimensions / 渐变已退化 / ...)
6. 用户拿到可运行的 xtaro 页面代码,`npm run android` 或 `run ios` 直接跑

---

## 异常处理

### 配置类

| 异常 | 处理 |
|------|------|
| rn SKILL 找不到 `config.adapter` 段 | 视为 `{ enabled: false, tagMap: {}, importMap: {} }`,继续 |
| `config.adapter.enabled = true` 但 tagMap 全空 | QA 告警"adapter 已启用但 tagMap 为空,产物仍是原生 RN";继续 |
| `config.adapter.tagMap` 里出现非 6 大标签的 key(比如 `Button`) | 忽略该条 + QA 告警(附上"支持的 key 列表:View/Text/Image/Pressable/TextInput/ScrollView") |
| tagMap value 非合法 JSX 标识符(如小写开头 / 含特殊字符) | 忽略该条 + QA 告警 |
| importMap 里某个 key 找不到对应的 tagMap 目标 | 忽略该条(可能是用户改了 tagMap 后忘删 importMap) |

### 生成类

| 异常 | 处理 |
|------|------|
| Figma 稿里有 `filter: blur` / `backdrop-filter` / `INNER_SHADOW` | 不出 style,产物注释 `// TODO: no RN native support` + QA error 告警 |
| Figma 稿里有渐变填充 | 退化为纯色(取第一个 stop)+ QA warn 告警 |
| Figma 稿里 `fills` 是 IMAGE 但节点无前缀 | 走 `bg-` 兜底,拆成独立 `<Image>` + absolute 分层 |
| 节点 `strokes[0].strokeAlign` 是 CENTER | 退化为普通 borderWidth + QA warn 告警 |
| RN 版本低于 0.71 时 `gap` 属性不支持 | 生成 `gap`,附 QA info 告警建议升级 RN 或改用 `marginRight/marginBottom` 手改 |

### CLI 类

| 异常 | 处理 |
|------|------|
| 用户在 h5 项目 `install.js` 交互中选了 rn,但项目里已有 h5 config | 不合并,提示用户"选了 rn 但项目已配置 h5,建议开新项目 / 新 config 文件" |
| `.claude/skills/` 已有 `pp-d2c` SKILL,再装 rn SKILL | 允许两者共存 |

---

## 验收标准

沿用澄清文档 §六:

| 验收组 | 项 | 通过条件 |
|--------|----|---------|
| **独立性** | 6.1.1 | `templates/skills/pp-d2c-rn/SKILL.md` 存在且完整可读 |
| | 6.1.2 | 现有 h5 SKILL / doctor / style / strip-nodeid **一字未改** |
| | 6.1.3 | 只调用 rn SKILL 时不依赖 h5 SKILL 任何文件 |
| **功能** | 6.2.1 | adapter 未启用时,产物 `npx react-native run-ios` 可跑通 |
| | 6.2.2 | adapter 启用为 xtaro 时,产物 import from `@myxx/xtaro`,标签是 X 前缀 |
| | 6.2.3 | 6 个前缀槽位在 rn 侧全部正确映射 |
| | 6.2.4 | RN 无对应特性按退化表处理,QA 段落有告警 |
| | 6.2.5 | 前缀识别 / 布局判定与 h5 SKILL 决策等价(拿同一份 Figma 稿分别跑 h5 / rn,前缀识别结果一致) |
| **CLI** | 6.3.1 | install.js 新增 rn 引导题目 |
| | 6.3.2 | 选 rn 时 `.claude/skills/pp-d2c-rn/` 被复制 |
| | 6.3.3 | 选 react 时 `.claude/skills/pp-d2c-rn/` **不**被复制 |
| | 6.3.4 | rn config 字段(`adapter` 段)以 spread merge 写入 |
| | 6.3.5 | 三种模式(只 h5 / 只 rn / 两者共存)都能跑通 |
| **文档** | 6.4.1 | `.Knowledge/topics/pp-d2c-rn.md` 存在 |
| | 6.4.2 | `.Knowledge/manifest-routing.json` 新增 rn topic 路由 |
| | 6.4.3 | `.Knowledge/matchers/m-pp-d2c-rn.json` 存在且关键词覆盖场景 |
| | 6.4.4 | `.Knowledge/index.md` topic overview 表有 rn 行 |

---

## 里程碑与拆包建议

**给 `f2s-req-plan` 拆任务的参考顺序**(不强制,拆任务时可再调整):

| 里程碑 | 交付 | 依赖 |
|--------|------|------|
| M1 | rn 模板 config (D3) + install.js 支持 skipRn (D4 部分) | 无 |
| M2 | rn SKILL 主文档 (D1) 完成前 6 处改造 | M1 完成后可并行开始 |
| M3 | rn SKILL 的 bin/figma.mjs (D2) | 独立小任务,任意时间做 |
| M4 | install.js 完成 adapter 引导题目 (D4 剩余) | M2 完成后 |
| M5 | Topic / matcher / manifest / index (D5) | M2 完成后 |
| M6 | 端到端跑通(拿一份真实 Figma 稿测) | M4 + M5 完成后 |

**说明**:M2 是最大块,建议**内部再切**成 3 个小任务:

- M2a:骨架复制 + 顶部说明段落改写 + 步骤 -1/0/1/2 保留验证
- M2b:步骤 4 style 字典改造 + 退化表落地
- M2c:步骤 5 合并 + adapter 应用步骤 + QA 告警格式
