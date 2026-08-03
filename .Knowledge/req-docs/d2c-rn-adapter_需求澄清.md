# D2C RN 独立 SKILL + 可配置 Adapter 需求澄清

> 文档定位:让 ctrip-train-d2c 生态从"只能出 H5"扩展到"能出 React Native 原生代码,并通过配置映射到 xtaro / taro / 其他 RN-like 框架"。写给后续技术方案 (`f2s-req-tech`) 作输入。

## 一、背景与目标

**背景**:当前 `ctrip-train-d2c` SKILL 只支持把 Figma 设计稿翻译成 Web (H5) 代码。业务场景已扩展到需要出 React Native 端代码,以及基于 RN 的携程内部封装 `@ctrip/xtaro`,后续可能还有其他 RN-like 框架(通用 taro / react-native-web / expo 等)。

**目标**:
1. 新增独立 SKILL `ctrip-train-d2c-rn`,以 React Native 原生语义为内核,输出可直接跑通的 RN 代码
2. 通过用户可配置的 adapter 层,把 RN 代码映射到 xtaro / taro / 其他框架
3. 现有 `ctrip-train-d2c` (H5) SKILL 完全不受影响,继续独立演进

**非目标**:
- 不做 RN 官方以外的行为交互组件(Modal / Switch / ActivityIndicator 等)
- 不做平台专有语义的内核集成(如 XBoxShadow,走 style 原生属性即可)
- 不做动画支持(Figma 无信号)
- 不做增量生成 / 产物缓存(独立能力,与本次需求不耦合)

## 二、范围

### 包含

1. **新增独立 SKILL 目录 `templates/skills/ctrip-train-d2c-rn/`**,包含 `SKILL.md`,不复用现有 h5 SKILL 文件
2. **RN 内核标签清单**:View / Text / Image / Pressable / TextInput / ScrollView 六个,对应现有六个前缀槽位
3. **StyleSheet 样式方案**:强制使用 `StyleSheet.create` + `style={styles.xxx}`,camelCase 属性名,数字无单位
4. **Adapter 配置层**:用户可通过 config 自定义 tagMap + importMap,把 RN 标签映射到任意目标框架
5. **CLI 改动**:`bin/install.js` 新增"是否安装 rn SKILL"的引导,rn 分支下的 config 引导题目

### 排除

1. **不改动现有 `ctrip-train-d2c` (H5) SKILL 及其卫星 SKILL**(doctor / style),保持零回归
2. **不预置任何 preset**(包括不预置 xtaro preset):用户需要 xtaro / taro / expo / react-native-web,自己在 config 里写 adapter
3. **不纳入行为类 RN 组件**:FlatList / SectionList / Modal / Switch / ActivityIndicator / SafeAreaView / KeyboardAvoidingView 等
4. **不做代码后处理脚本**(codemod / babel plugin):使用实时映射机制,一次生成即输出目标代码
5. **不为 rn SKILL 新建 doctor SKILL**:rn 侧不做前置体检 SKILL,由主 SKILL 直接生成

## 三、关键流程

### 3.1 使用流程

用户在 config 里指定 `d2c-rn` 相关字段,直接调用 `ctrip-train-d2c-rn` SKILL(与 h5 SKILL 是并列关系,不通过 target 参数切换)。CLI 在 `runInit()` 时引导用户选择安装哪套 SKILL。

### 3.2 生成流程

```
Figma URL
  ↓ (拉稿 + 前缀识别 + 布局判定 + 图片处理,rn SKILL 内独立完成)
RN 原生代码 (View/Text/Image/Pressable/TextInput/ScrollView + StyleSheet.create)
  ↓ (若 config.d2cRn.adapter 存在)
按 tagMap + importMap 替换标签名与 import 路径
  ↓
最终产物代码
```

### 3.3 Adapter 未配置时(纯 RN)

```jsx
import React from 'react';
import { View, Text, Image, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  root: { padding: 20, backgroundColor: '#f0f0f0', borderRadius: 8 },
  title: { fontSize: 14, color: '#333' },
});

export default function Index() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>示例</Text>
    </View>
  );
}
```

### 3.4 Adapter 配置为携程 xtaro 时

用户 config:

```json
{
  "d2cRn": {
    "adapter": {
      "tagMap": {
        "View": "XView",
        "Text": "XText",
        "Image": "XImage",
        "Pressable": "XView",
        "TextInput": "XInput",
        "ScrollView": "XScrollView"
      },
      "importMap": {
        "XView": "@ctrip/xtaro",
        "XText": "@ctrip/xtaro",
        "XImage": "@ctrip/xtaro",
        "XInput": "@ctrip/xtaro",
        "XScrollView": "@ctrip/xtaro"
      }
    }
  }
}
```

产物:

```jsx
import React from 'react';
import { XView, XText, XImage, XInput, XScrollView } from '@ctrip/xtaro';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({ ... });

export default function Index() {
  return (
    <XView style={styles.root}>
      <XText style={styles.title}>示例</XText>
    </XView>
  );
}
```

## 四、边界与异常

### 4.1 前缀槽位映射

| 前缀 | RN 内核标签 |
|------|-----------|
| (容器默认,FRAME/GROUP 无特殊前缀) | View |
| (TEXT 节点) | Text |
| `img-` | Image |
| `btn-` | Pressable |
| `input-` | TextInput |
| `scrollx-` / `scrolly-` | ScrollView |

前缀识别、布局判定、图片处理的**决策逻辑与 h5 SKILL 相同**(rn SKILL 从 h5 SKILL 复制而来),但**输出层完全不同**:标签换成 RN 六种,样式换成 StyleSheet 对象。

### 4.2 style 语法差异(与 h5 SKILL 的核心区别)

| 维度 | h5 SKILL (现有) | rn SKILL (新增) |
|------|----------------|----------------|
| 单位 | `20px` 字符串 | `20` 数字 |
| 属性名 | `background-color` kebab-case | `backgroundColor` camelCase |
| 载体 | scss / less / css / tailwind 等 8 种 (config.styleFormat) | 强制 StyleSheet.create + 内联 style |
| 布局默认 | `display: block` | 全部默认 flex(column) |
| 单位换算 | `unit.scale` (figmaBase → outputBase) | `unit.scale` 保留,数字 * scale 后写入 |

### 4.3 RN 不支持的 CSS 特性(退化规则)

| Figma / h5 语义 | rn 输出 | 备注 |
|----------------|---------|------|
| `fixed-` 前缀 | `position: 'absolute'` + QA 告警 | RN 无 fixed,退化为 absolute |
| 页面根 `min-height: max(x, 100vh)` | `minHeight: Dimensions.get('window').height` | RN 无 vh,运行时算 |
| `bg-` 背景图 | 拆成独立 `<Image>` + absolute 分层 | RN 无 background-image |
| `overflow: scroll` | 强制换 `<ScrollView>` 标签 | RN 无 overflow |
| Box shadow | `shadowColor` / `shadowOffset` / `shadowRadius` / `elevation` | RN 原生 style 属性,不用 wrapper 组件 |

每一条退化都在生成产物末尾的 QA 段落输出告警。

### 4.4 Adapter 配置边界

- **tagMap 是可选映射**:未在 tagMap 中出现的标签保持 RN 原名(例如用户只映射了 View / Text,Image 就保持 `<Image>` 从 `react-native` 导入)
- **importMap 支持"多个标签共用一个包"**:map value 为字符串即可,不需要嵌套结构
- **importMap 未覆盖的标签走默认 `react-native` 导入**
- **不支持 JS 逻辑映射**:tagMap / importMap 都是纯声明式 JSON,不允许用户写函数
- **tagMap value 允许任意合法 JSX 标识符**:大写开头即可,不校验目标包是否真的 export 了该标签

### 4.5 与 h5 SKILL 的关系

- **完全独立**:rn SKILL 和 h5 SKILL 平行存在,不共享任何 SKILL 内容
- **CLI 层可以共存**:用户 `install.js` 引导时可选择安装 h5 / rn / 两者都装
- **config 分开**:h5 相关字段保持现状,rn 新增独立字段(如 `d2cRn.adapter`),避免互相污染
- **产物目录建议分开**:h5 产物写 `output.dir`,rn 产物写 `d2cRn.output.dir`(或用同一个 dir 但文件名区分),避免覆盖

## 五、关键概念定义

| 术语 | 定义 |
|------|------|
| **rn SKILL** | 新增的独立 SKILL `ctrip-train-d2c-rn`,路径 `templates/skills/ctrip-train-d2c-rn/SKILL.md`。以 RN 原生标签和 StyleSheet 为输出规范 |
| **RN 内核标签清单** | View / Text / Image / Pressable / TextInput / ScrollView。这六个覆盖当前六个前缀槽位,是 rn SKILL 唯一认识的组件集合 |
| **Adapter** | 用户在 config 里定义的映射规则,把 RN 标签转成任意 RN-like 框架代码。由两张声明式表组成:`tagMap` 和 `importMap` |
| **前缀槽位** | 沿用 h5 SKILL 的前缀体系(sub- / img- / bg- / bgc- / btn- / input- / scrollx- / scrolly- / fixed- / end- 等),识别逻辑复制到 rn SKILL |
| **preset** | ~~不引入~~。不做内置 preset,包括不做 xtaro preset。用户需要什么框架就自己写 adapter |

## 六、验收标准

### 6.1 SKILL 独立性验收

1. `templates/skills/ctrip-train-d2c-rn/SKILL.md` 独立存在,完整可读
2. 现有 `templates/skills/ctrip-train-d2c/SKILL.md` 及其卫星 SKILL 一字未改
3. 只调用 rn SKILL 时,不依赖 h5 SKILL 的任何文件

### 6.2 功能验收

1. rn SKILL 未配置 adapter 时,产物是可以直接 `npx react-native run-ios` 跑起来的原生 RN 代码
2. rn SKILL 配置了 xtaro adapter 时,产物中所有 RN 标签替换为 X 前缀标签,import 路径替换为 `@ctrip/xtaro`
3. 六个前缀槽位(默认容器、TEXT、img-、btn-、input-、scrollx-/scrolly-)在 rn SKILL 下都能正确映射
4. RN 不支持的特性(fixed / vh / background-image / overflow / box-shadow)按 §4.3 表退化,并在 QA 段落输出告警
5. rn SKILL 内部前缀识别 / 布局判定 / 图片处理逻辑与 h5 SKILL 等价(从 h5 SKILL 复制而来,决策部分一致)

### 6.3 CLI 验收

1. `bin/install.js runInit()` 新增"是否安装 rn SKILL"的引导题目
2. 用户选安装 rn 时,`templates/skills/ctrip-train-d2c-rn/` 被复制到项目的 `.claude/skills/` 下
3. rn 引导题目独立于 h5 引导题目,不改动 h5 引导逻辑
4. rn config 字段(`d2cRn.*`)以 spread merge 方式写入 config,不影响 h5 字段
5. 用户可以只装 h5、只装 rn、两者都装(三种模式都能跑通)

### 6.4 文档验收

1. `.Knowledge/topics/` 新增独立 topic 文档描述 rn SKILL(不并入 `ctrip-train-d2c` topic)
2. `.Knowledge/manifest-routing.json` 新增 rn topic 路由,不改动 h5 topic 路由
3. `.Knowledge/matchers/` 新增 rn SKILL 的 matcher 关键词
4. `.Knowledge/index.md` topic overview 表新增 rn topic 行

## 七、开放问题

无。所有决策已在讨论中定型:
- 独立 SKILL vs 内核共享:独立 SKILL(A 方案)✓
- RN 标签清单:6 个 ✓
- adapter 配置形态:JSON 声明式(tagMap + importMap)✓
- 是否内置 preset(含 xtaro):不内置 ✓
- 样式方案:强制 StyleSheet.create + 内联 style ✓
- 平台专有语义(shadow 等):走 RN 原生 style 属性,不引入 wrapper 组件 ✓
- 行为组件(Modal/Switch 等):不纳入 ✓
- 是否为 rn SKILL 新建 doctor:不新建 ✓
- CLI 是否改动:改动,新增 rn 引导题目,与 h5 引导独立 ✓
- 缓存能力:不做,与本次需求解耦 ✓

## 八、架构约束(给后续技术方案作硬约束)

1. **rn SKILL 独立文件、独立目录、独立 topic**。h5 SKILL 一字不改
2. **rn SKILL 内容起点是复制 h5 SKILL**,然后按 §4.2 §4.3 修改输出层规则。前缀识别 / 布局判定 / 图片处理逻辑保持等价
3. **不为 rn 侧建 doctor 或 style 卫星 SKILL**。用户说"卫星 SKILL 未来可能整体删除",rn 侧不引入新的卫星依赖
4. **CLI 改动尽量薄**:install.js 新增 rn 引导逻辑,但不与 h5 引导代码耦合;h5 引导保持现状
5. **config 字段隔离**:rn 相关字段集中在 `d2cRn.*` 命名空间下,与 h5 字段完全隔离
6. **产物目录预留 target 区分**:即使不做缓存,产物路径也应保证 h5 和 rn 不互相覆盖(用不同 dir 或不同文件名)
7. **不做增量生成 / 产物缓存**:这是独立能力,与本次需求解耦。但 config schema 设计时可预留 target 维度(如缓存 key 未来加入 target),避免未来加缓存时要改 config 结构
