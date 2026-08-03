# adapter-presets

D2C RN skill 的 adapter 预设目录。每个 `.json` 文件是一个"框架预设",CLI(`bin/install.js init`)会扫本目录并把文件名(不含扩展)列成选项,让用户在 RN 分支的 `[2.2/8] 选择预设 adapter` 那步选取。

## 现有预设

| 文件 | 目标框架 | 说明 |
|-----|---------|------|
| `xtaro.json` + `xtaro.rpx.ts` | 携程 xtaro | 6 大 RN 标签映射到 `@ctrip/xtaro`;`Pressable → XView`(XView 自身可点击,不引 XClickableSimplified);`Image.source → src`(xtaro 走 taro 语义);自带 rpx helper 走 `xGetSystemInfoSync from @ctrip/xtaro`(xtaro H5 端 webpack 不解析 react-native Flow 语法) |

CLI 里始终有个 `自定义` 兜底选项 — 选它写空 adapter,用户后续在 `ctrip-train-d2c.config.json` 手改 tagMap / importMap / propMap 即可,不必先建 preset 文件。

## 加自己的预设

新建一个 `<framework-id>.json`,结构如下:

```json
{
  "id": "<framework-id>",
  "name": "<CLI 里显示的名字>",
  "description": "<一句话说清映射策略,给自己或其他人看>",
  "helperTemplate": "<framework-id>.rpx.ts",
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

### 字段约束(CLI 和 SKILL 都会校验,不合规会被 QA 告警丢弃)

- **tagMap**:key **必须**是 6 大 RN 标签(`View / Text / Image / Pressable / TextInput / ScrollView`)之一;value 必须匹配 `/^[A-Z][A-Za-z0-9]*$/`(合法 JSX 大写标识符)。不需要映射的标签**留空即可**,留空 = 保持 RN 原名。
- **importMap**:key 必须是"tagMap 里出现过的目标标签名"或"6 大 RN 原生标签",value 是任意非空字符串(import from 路径)。未列的映射后标签自动 fallback 到 `react-native`。
- **propMap**:key **必须**是 6 大 RN 原生标签(不是 tagMap 映射后的名字);value 是 `{ 原 prop: 新 prop }`;禁止重命名 `style` / `key` / `ref` / `children` / `className`。
- **reactImport**:极少数场景需要覆盖(如自家 React fork),默认 `react`,不填也行。

### 举例:接 `taro` 的预设

```json
{
  "id": "taro",
  "name": "Taro",
  "description": "映射到 @tarojs/components,复用 taro Image 语义(source → src)",
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "View",
      "Text": "Text",
      "Image": "Image",
      "Pressable": "View",
      "TextInput": "Input",
      "ScrollView": "ScrollView"
    },
    "importMap": {
      "View": "@tarojs/components",
      "Text": "@tarojs/components",
      "Image": "@tarojs/components",
      "Input": "@tarojs/components",
      "ScrollView": "@tarojs/components"
    },
    "propMap": {
      "Image": { "source": "src" }
    }
  }
}
```

## 加了预设之后的生效路径

1. 项目里跑 `node bin/install.js init`
2. framework 选 `rn`,adapter 选 `Yes`
3. `[2.2/8] 选择预设 adapter` 出现你新加的 `<name>` 选项
4. 选中后,该预设的 `adapter` 段完整写入项目根的 `ctrip-train-d2c.config.json`
5. SKILL(`.claude/skills/ctrip-train-d2c-rn`)在生成代码合并阶段(§5.5)读 config.adapter 应用映射

## 不做的事

- **预设文件不复制到项目**:CLI 用完就够了,项目 config 已经是"应用后的结果",不留 preset 副本减少同步负担
- **不做版本号 / hash 校验**:摸索阶段过度设计
- **不引入 schema 依赖**:字段约束靠 README + SKILL §5.5 校验步骤兜底
