# adapter-presets

D2C RN skill 的 adapter 预设目录。每个 `.json` 文件是一个"框架预设",CLI(`bin/install.js init`)会扫本目录并把文件名(不含扩展)列成选项,让用户在 RN 分支的 `[2.2/8] 选择预设 adapter` 那步选取。

## 现有预设

| 预设 id | 名称 | 目标框架 | 说明 |
|---|---|---|---|
| `xtaro` | 携程 xtaro | `@ctrip/xtaro` | 6 大 RN 标签映射到 xtaro 组件;`Pressable → XView`(XView 自身可点击);`Image.source → src`;rpx helper 走 `xGetSystemInfoSync from @ctrip/xtaro`(xtaro H5 端 webpack 不解析 react-native Flow 语法) |
| `taro` | Taro (@tarojs/components) | `@tarojs/components` | 6 大 RN 标签映射到 taro 组件;`Pressable → View`;`TextInput → Input`;`Image.source → src`;rpx helper 走 `Taro.getSystemInfoSync from @tarojs/taro`(taro 覆盖多端时统一屏蔽) |
| `rn` | pure React Native / Expo | `react-native` | 6 大 RN 原生标签保留原名(identity 映射);全部从 `react-native` 导入;rpx helper 走 `Dimensions.get('window').width`。适合纯 RN / Expo,不做跨组件库替换 |

每个预设由 3 个文件组成:

- `<id>.json` — 映射规则(tagMap / importMap / propMap)
- `<id>.rpx.ts` — 该预设专属的 rpx helper(不同框架屏宽 API 不同)
- `<id>.reference.md` — 超出 propMap 声明式改名的复杂差异手册(SKILL §5.5.3c 读取)

CLI 里始终有一个 `自定义` 兜底选项 — 选它写空 adapter,用户后续在 `pp-d2c.config.json` 手改 tagMap / importMap / propMap 即可,不必先建 preset 文件。

## 加自己的预设

新建一个 `<framework-id>.json`,结构如下:

```json
{
  "id": "<framework-id>",
  "name": "<CLI 里显示的名字>",
  "description": "<一句话说清映射策略,给自己或其他人看>",
  "helperTemplate": "<framework-id>.rpx.ts",
  "referenceDoc": "<framework-id>.reference.md",
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "<目标 View 标签>",
      "Text": "<目标 Text 标签>",
      "Image": "<目标 Image 标签>",
      "Pressable": "<目标可点击容器>",
      "TextInput": "<目标 Input 标签>",
      "ScrollView": "<目标 ScrollView 标签>"
    },
    "importMap": {
      "<目标标签>": "<import 源(如 npm 包名或相对路径)>"
    },
    "propMap": {
      "Image": { "source": "<目标 Image 的图片 prop 名>" }
    },
    "reactImport": "react"
  }
}
```

**helperTemplate 说明**(可选字段):

- 值是相对本目录的文件名(如 `xtaro.rpx.ts`),表示该预设**自带一份 rpx helper 模板**;CLI init 时会用它替换默认的 `templates/rn-helpers/rpx.ts` 落到项目
- 不同框架的 helper 里屏宽获取方式可能不同 — pure RN 用 `Dimensions.get('window')`;xtaro 走 `xGetSystemInfoSync from @ctrip/xtaro`(H5 端 webpack 不解析 react-native Flow 语法);taro / 小程序用 `getSystemInfoSync from @tarojs/taro`;expo 直接用 `Dimensions` 无异
- **helper 文件里必须导出**一个函数,名字与 `install.js` init 时用户填的 `helperName`(默认 `rpx`)一致;`DESIGN_BASE` 常量会被 CLI 替换成 `unit.figmaBase` 的实际值
- 不写 helperTemplate → CLI 回退到 `templates/rn-helpers/rpx.ts`(pure RN 版)

**referenceDoc 说明**(可选字段):

- 值是相对本目录的 md 文件名(如 `xtaro.reference.md`)。SKILL 在 §5.5.3c 步骤 Read 该文件,处理**超出 propMap 声明式改名**的复杂差异
- 分工原则:**prop 名不同、值和语义一样** → 写 `propMap`(JSON 声明式);**任何超出机械改名的差异**(值域映射 / 布尔取反 / 事件签名转换 / 结构变化 / 丢弃属性)→ 写 md
- md 结构建议按 5 类章节:`一、值域映射` / `二、布尔取反` / `三、事件签名转换` / `四、结构变化` / `五、无跨端支持`。末尾建议加一节 `六、agent 快速参考` 给出 checklist 顺序
- md **不复制**到项目,只留在 preset 目录作为 SKILL 输入(与 preset JSON 本身一样,用户项目 config 已经是"应用后的结果",不留副本)
- 不写 referenceDoc → SKILL 跳过 §5.5.3c(所有映射只走 propMap 声明式)

### 字段约束(CLI 和 SKILL 都会校验,不合规会被 QA 告警丢弃)

- **tagMap**:key **必须**是 6 大 RN 标签(`View / Text / Image / Pressable / TextInput / ScrollView`)之一;value 必须匹配 `/^[A-Z][A-Za-z0-9]*$/`(合法 JSX 大写标识符)。不需要映射的标签**留空即可**,留空 = 保持 RN 原名。
- **importMap**:key 必须是"tagMap 里出现过的目标标签名"或"6 大 RN 原生标签",value 是任意非空字符串(import from 路径)。未列的映射后标签自动 fallback 到 `react-native`。
- **propMap**:key **必须**是 6 大 RN 原生标签(不是 tagMap 映射后的名字);value 是 `{ 原 prop: 新 prop }`(**只字符串**,不接受 v2 object 语法);禁止重命名 `style` / `key` / `ref` / `children` / `className`。复杂差异请走 `referenceDoc`。
- **referenceDoc**(可选):值是相对本目录的 md 文件名;文件不存在 → CLI init 时 warn(不阻塞),SKILL 侧 §5.5.3c 静默跳过 + QA warn。
- **reactImport**:极少数场景需要覆盖(如自家 React fork),默认 `react`,不填也行。

### 举例:接 `native-base` 的预设(假想,示意结构)

```json
{
  "id": "native-base",
  "name": "NativeBase (@native-base)",
  "description": "映射到 native-base 组件库,提供 Box / VStack / HStack / Image / Pressable / Input / ScrollView 等",
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "Box",
      "Text": "Text",
      "Image": "Image",
      "Pressable": "Pressable",
      "TextInput": "Input",
      "ScrollView": "ScrollView"
    },
    "importMap": {
      "Box": "native-base",
      "Text": "native-base",
      "Image": "native-base",
      "Pressable": "native-base",
      "Input": "native-base",
      "ScrollView": "native-base"
    },
    "propMap": {
      "Image": { "source": "source" }
    }
  }
}
```

> **想接的框架已有预设**?先看 `现有预设` 表,直接选就行。上面示例只演示"如何加一个新框架"。真实 taro / xtaro / pure RN 见目录里现成的 3 个预设。

## 加了预设之后的生效路径

1. 项目里跑 `node bin/install.js init`
2. framework 选 `rn`,adapter 选 `Yes`
3. `[2.2/8] 选择预设 adapter` 出现你新加的 `<name>` 选项
4. 选中后,该预设的 `adapter` 段完整写入项目根的 `pp-d2c.config.json`
5. SKILL(`.claude/skills/pp-d2c-rn`)在生成代码合并阶段(§5.5)读 config.adapter 应用映射

## 不做的事

- **预设文件不复制到项目**:CLI 用完就够了,项目 config 已经是"应用后的结果",不留 preset 副本减少同步负担
- **不做版本号 / hash 校验**:摸索阶段过度设计
- **不引入 schema 依赖**:字段约束靠 README + SKILL §5.5 校验步骤兜底
