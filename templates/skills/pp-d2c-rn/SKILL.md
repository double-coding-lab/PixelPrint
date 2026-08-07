# pp-d2c-rn Skill

> **v0.3.10（2026-08-08）**：与 pp-d2c 对齐——新增 3 组强制溯源证明块（字色 fills 溯源 §4.1.1 / sub 容器 min-height 尺寸源 §4.3 / 页面根 paddingTop 尺寸源 §4.3.1）；§6.0.3 合并忠实度证明块 4 组扩到 7 组（RN 侧字色断言含 `color:` 属性无引号 / 有引号 / 数字色三种形式）；禁止项 +3；配套 doctor CLR030 / DIM031 / DIM032。RN 侧统一 `styleFormat=stylesheet`（无 h5 style 大类分歧，不引入新 page 空档兜底）。

> **v0.3.9（2026-08-07）**：与 pp-d2c 对齐——新增 §4.4.pre.b「子树结构禁切规则」（结构维度优先于前缀维度）；§4.4 前置自检 5 行 → 7 行；§4.8 checklist + §6.0.3 忠实度证明块 + 禁止项 各追加 1 条；配套 doctor SUB029.

> **v0.3.8（2026-08-07）**：与 pp-d2c 对齐——新增「问题边界」章节（顶部执行模型说明内）；配套 §4.8 checklist +1 条 + §6.0.3 忠实度证明块 +「未打断用户核查」段 + 禁止项 +1 条。RN 特有决策（LinearGradient / shadow*+elevation / rpx 包装等）均属"skill 已定死"范畴，禁止问用户。

> **v0.3.7（2026-08-07）**：与 pp-d2c 对齐——新增「flat 合并忠实度契约」（§5.0.pre）、「data-node-id 守恒律」（§5.1）、「节点整体切图适格性」（§4.4.pre）、「assets.txt 消费契约」（§6.0.2）、「合并忠实度证明块」（§6.0.3 强制主 agent 交付前 grep 自证输出）；RN 侧引用形式覆盖 `require` / `source={{uri}}` / `<ImageBackground>` / `<FastImage>` 全套。配套 doctor SUB027 / IMG028。

> **v0.3.6（2026-08-07）**：与 pp-d2c 对齐——新增「父容器盒级装饰兜底」（§4.3，渐变走 `LinearGradient`）、「TEXT 多层 fills 取末位」（§4.1.1）、「切图强制忠实执行 + images.json md5 复用」（§4.4.0）、「`btn-` 内嵌 TEXT 双写防护」（§4.3）；§4.3.rn 退化表更新渐变父容器处理策略。

> **独立 SKILL**:本 SKILL 专为 React Native 端产出代码。目标框架:**React Native**(原生 `react-native`)以及一切 RN-like 框架(如 `@tarojs/components`、`expo`、`react-native-web`,或组织内部的 RN 组件库,通过 adapter 配置接入)。
>
> 与现有 h5 SKILL `pp-d2c` **完全独立并列**:h5 SKILL 一字不改。用户根据项目类型选装 h5 SKILL / rn SKILL / 两者共存。
>
> **核心机制**:内核以 RN 原生标签(View / Text / Image / Pressable / TextInput / ScrollView + StyleSheet)描述一切,再通过 `config.adapter` 配置(tagMap + importMap + propMap)映射到具体框架标签。

## 触发条件
- 用户提供 Figma 设计稿 URL,且**项目 config `project.framework === 'rn'`**
- 用户说「帮我用 RN 还原这个设计稿」「D2C RN」「生成 React Native 代码」
- 用户明确说明目标是移动端原生(iOS / Android),而非 H5 网页

---

## 执行模型说明(先于一切,避免误读)

**SKILL.md 是给 LLM 读的自然语言操作手册,不是可执行代码。**

下文出现的 `派发新 sub-agent`、`sub-agent 上报` 等表述都是**伪代码 / 隐喻**,不是真函数调用、不是真多进程通信。**全程只有当前这一个 LLM agent**(即此对话里的 Claude)按 SKILL 步骤顺序执行:

| 文档表述 | 实际操作 |
|---------|---------|
| "派发新 sub-agent 处理 sub-X" | 当前 agent 重新进入 §4.0 流程,把根节点重置为 sub-X 的 nodeId、depth +1,重走一遍 |
| "sub-agent 上报 subslots.json" | 当前 agent 把 JSON 内容写到磁盘文件,下一轮处理时自己读 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**,要字面写进 JSX 文件作占位符 |
| `subslots.json` 文件 | **真实磁盘文件**,与 `assets.txt` 同级写入 block 目录 |

**唯一真正"被执行"的事情有两类**:(1)调用 Figma REST API(通过 Bash 执行 curl)读取节点属性 / 导出图片 / 截图,以及本地文件读写;(2)在对话里产出文本(包括代码、JSON、决策)。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

> **本 SKILL 是从 h5 SKILL 复制起步的独立 SKILL**。**不接 doctor 卫星 SKILL**(rn config 默认 `health.enabled=false`);**不做 styleFormat 探测**(rn 侧统一 StyleSheet + inline style,`project.styleFormat: 'stylesheet'` 即固定行为)。原 h5 SKILL 中步骤 0.5 doctor 调用、步骤 2.5 样式方案探测已在本 SKILL 中移除。

> 误把伪代码当真函数会卡死流程(等待一个永远不会到来的"返回值")。

## 问题边界（v0.3.8 新增，硬约束）

agent 在跑 pp-d2c-rn 全流程时 **只允许问用户业务问题，禁止问 skill 已定死的技术决策问题**。

### ✅ 允许问的业务问题（设计稿无法推断的产品/交互/数据）

| 类型 | 举例 |
|-----|------|
| **交互状态** | "登录/未登录态展示不一样，默认展示哪个？"、"已购/未购下卡片状态怎么切换？" |
| **数据来源** | "这个价格从哪个字段取？"、"埋点参数取什么？" |
| **跳转链接** | "按钮点击跳哪里？RN 是 navigate 到什么路由？" |
| **时效规则** | "活动时间外怎么展示？"、"券过期展示什么？" |
| **命名域 / 依赖** | "组件放哪个 page 目录？"、"用户端有 `react-native-linear-gradient` 依赖吗？"（若已装则默认引；若未装则告知需 install） |

### ❌ 禁止问的技术决策（skill 已在章节里定死）

| 类型 | 举例（对应 skill 章节） |
|-----|---------------------|
| **前缀语义** | "`btn-` 要不要切图？" → §4.3 + §4.4.pre 已定；"`bg-` 切自身还是父容器？" → §4.3 `bg-` 切图源约束已定 |
| **兜底判定** | "纯色父容器要 View style 还是切图？" → §4.3 父容器盒级装饰兜底默认开；"渐变父容器怎么处理？" → §4.3.rn 退化表已定"引 LinearGradient"（不问，直接引） |
| **合并策略** | "这块要整体切一张图吗？" → §4.4.pre 禁 `sub-*` / `block-*` 整体切图；"flat 合并展开还是简化？" → §5.0.pre 禁"简化" |
| **尺寸单位** | "要不要包 `rpx()`？" → §4.1.1 §C 已定白名单；"vh 怎么处理？" → §4.3.rn 已定退化 |
| **切图忠实度** | "同名文件已存在，要复用还是重切？" → §4.4.0 md5 校验复用契约已定 |
| **RN 特有退化** | "iOS 阴影 vs Android elevation 怎么处理？" → §4.3 父容器兜底已定"两个都写"；"box-shadow inset 怎么办？" → §4.3.rn 退化表已定"注释 TODO + QA error" |

### 遇到 skill 未覆盖的边界情形怎么办（**不打断用户**）

按下面顺序**自主处理**：

1. **先按 skill 最接近的规则兜底**（如未见过的前缀走"无前缀兜底"）
2. **把决策 + 兜底理由 + 影响范围写入 `assets.txt` QA 段落**：
   ```
   [需人工核对] 遇到 skill 未覆盖的情形 X（图层名 {name} nodeId {id}），
     已按 Y 兜底处理（引用 skill §Z），
     可能影响 Z（例：视觉差 / 交互失效 / 无障碍缺失），
     请复核后决定是否补前缀或调整设计稿。
   ```
3. **仅当**决策会导致**产物完全不可用**时才停下问用户——严格限定：
   - Figma Token 缺失 / 过期
   - Figma 稿完全无法访问
   - 关键 assets 下载失败超过重试次数
   - config 缺失或语法错误
   - RN 缺失关键依赖且用户未预置（如渐变必须引 `react-native-linear-gradient`，若 `package.json` 无此依赖且无法确认用户端是否已装 → 问一次；已装则直接引 + QA 告警）

**其他任何"技术选择犹豫"都不允许打断用户**——不确定就按最接近规则兜底 + 写 QA 告警。

## 执行流程

### 步骤 -1（前置预检）：检测 Figma Token 可用性

在任何操作前执行，不可跳过。

**做法**：调用脚本探针（脚本会自动 Read config、发 `/v1/me`、按状态码判定）：

```bash
node .claude/skills/pp-d2c-rn/bin/figma.mjs verify-token
```

**返回约定**：
- 退出码 `0` + stdout `{"ok":true,"data":{"email":...,"handle":...}}` → 继续步骤 0
- 退出码非 0 + stdout `{"ok":false,"error":"..."}` → 把 `error` 显示给用户并终止；建议提示：

  ```
  ❌ Figma Token 探针失败：<error 内容>

  请检查项目根 `.env` 里的 `FIGMA_TOKEN`：
  1. 是否已配置且未过期（Figma 网页版右上角头像 → Settings → Security → Personal access tokens）
  2. Token 权限是否包含 File content: Read-only
  3. 网络能否访问 api.figma.com
  ```

> **变更**：本 SKILL 已完全移除 MCP 依赖，所有 Figma 数据读取都走 `figma.mjs` 脚本（内部调 REST API）。不再需要在 Claude Code 里装 Figma 插件或走 OAuth。

---

### 步骤 0：读取配置

```
Read("pp-d2c.config.json")
```

**同时缓存 `projectRoot`**：即 `pp-d2c.config.json` 所在目录的**绝对路径**（例如 `/Users/xxx/Desktop/项目/xxx-function`）。后续所有涉及**本地文件写入**的路径（图片下载、代码产出）都必须以 `projectRoot` 为基点拼绝对路径，**禁止**依赖当前 cwd 使用相对路径——sub-agent 可能切换 cwd，相对路径会落到错误位置。

缓存以下字段，后续步骤全部以此为准：

| 字段 | 用途 |
|------|------|
| `project.framework` | 生成代码的目标框架（react / rn） |
| `project.styleFormat` | 样式方案标识符（取值见下表） |
| `FIGMA_TOKEN` (项目根 `.env`) | Figma Personal Access Token，用于 REST API 导出图片（v1.0.2 起从 config 迁到 .env） |
| `merge.mode` | 合并模式（flat / component） |
| `images.assetsDir` | 图片下载目录 |
| `images.imageBaseUrl` | 代码中图片 src 前缀 |
| `images.preserveEffectIds` | 数组，可选；列出"导出时**保留** Figma effect / 父背景"的 nodeId（即不带 `use_absolute_bounds`）。默认空数组 = 所有图都按 bbox 严格导出 |
| `unit.figmaBase` | 设计稿基准宽度，默认 `375` |
| `unit.outputUnit` | 输出单位,rn 侧固定为 `px`(数字模式,写 StyleSheet 时不带字符串单位) |
| `unit.outputBase` | 输出基准宽度,rn 侧 = `figmaBase` |
| `unit.scale` | 换算倍数(outputBase / figmaBase),rn 侧固定 `1` |
| `unit.responsive.enabled` | 是否启用 rpx() 响应式包装(按屏宽线性缩放尺寸),默认 `true` |
| `unit.responsive.helperImport` | rpx helper 的 import 路径,默认 `@/utils/rpx`;SKILL 生成产物时按此写 `import { rpx } from '<helperImport>'` |
| `unit.responsive.helperName` | rpx helper 的导出函数名,默认 `rpx`;SKILL 用它包装白名单属性(如 `paddingLeft: rpx(16)`) |
| `layers.sub` | 分块触发前缀，默认 `sub-` |
| `layers.block` | 独立布局块前缀，默认 `block-` |
| `layers.img` | 图片前缀，默认 `img-` |
| `layers.bg` | 背景图前缀，默认 `bg-` |
| `layers.but` | 可点击区域前缀，默认 `btn-` |
| `layers.scrollX` | 横向滚动容器前缀，默认 `scrollx-` |
| `layers.scrollY` | 纵向滚动容器前缀，默认 `scrolly-` |
| `layers.fixed` | 视口固定定位前缀，默认 `fixed-` |
| `layers.end` | 逆向布局前缀（贴父末端），默认 `end-` |
| `layers.input` | 输入框前缀，默认 `input-` |
| `layers.ignore` | 忽略前缀，默认 `x-` |
| `output.dir` | 代码输出根目录 |
| `health.enabled` | **rn SKILL 默认 false 且忽略此字段**(rn 不接 doctor) |
| `adapter.enabled` | 是否启用 adapter 映射(把 RN 原生标签替换为其他框架标签),默认 `false` |
| `adapter.tagMap` | RN 标签 → 目标框架标签 的映射表(如 `{ View: "MyView" }`),仅 6 大 RN 标签作为 key 合法 |
| `adapter.importMap` | 目标标签 → import from 路径(如 `{ MyView: "my-rn-lib" }`),未列的标签走 `react-native` |
| `adapter.propMap` | RN 原标签 → prop 名重命名规则(如 `{ Image: { source: "src" } }`),用于目标框架 prop 语义与 RN 不一致的场景;key 是 RN 原标签名(不是 tagMap 映射后的名字);**只做纯改名**,不改 prop 值 |
| `adapter.referenceDoc` | 可选,预设参考手册的相对文件名(如 `xtaro.reference.md`,相对于 preset 目录);SKILL 在 §5.5.3c 读该文件处理**超出改名**的复杂差异(值域映射 / 布尔取反 / 事件签名 / 结构变化 / 丢弃属性);未声明或文件不存在 → 跳过 §5.5.3c |
| `adapter._presetSource` | CLI init 阶段自动写入(不必手改),值是选中的 preset 目录绝对路径(如 `<repo>/templates/adapter-presets/`),SKILL 用它拼接 referenceDoc 的实际路径 |
| `adapter.reactImport` | React 本体 import 源,默认 `"react"` |

#### 样式方案标识符(`project.styleFormat` 取值表)

**rn SKILL 只关心 stylesheet 一种**(默认且强烈建议):

| styleFormat | 含义 | 生成形态 |
|------------|------|---------|
| `stylesheet` | `StyleSheet.create({...})` + `style={styles.xxx}` | **默认;本 SKILL 主流程按这个走** |
| `styled-components` | `styled.View` template literal | 需要 `styled-components/native` 依赖;本版仅识别,产物模板待完善 |
| `nativewind` | NativeWind className | 需要 `nativewind` 依赖;本版仅识别,产物模板待完善 |

**关键说明**(与 h5 SKILL 不同):

- rn 侧**不需要**探测 css-modules / plain scss 等分支(那是 h5 SKILL 步骤 2.5.3 的事)
- rn 侧样式统一走 `StyleSheet.create({...})` + `style={styles.xxx}` 内联,camelCase 属性名,数字无单位
- **老 config 里如果 styleFormat 是 `scss` / `less` 等 h5 值,自动降级到 `stylesheet`**(rn 项目不该出现 scss 值,仅兼容误配置)

#### adapter 配置示例

> **预设定义在哪**:CLI 层的预设列表在 `templates/adapter-presets/*.json`(每个 JSON 是一个预设,`install.js init` 扫目录列成选项)。SKILL 自身**只消费** `pp-d2c.config.json` 里最终写好的 `adapter` 段,不读预设目录。新增框架映射(taro / nativewind / 组织内部 RN 组件库)加 preset 文件即可,不用改本 SKILL。

**未启用 adapter**(输出原生 RN):

```json
{ "adapter": { "enabled": false, "tagMap": {}, "importMap": {}, "propMap": {} } }
```

**启用某个预设后 config 长这样**(以下用中性占位 `MyView` / `my-rn-lib` 展示结构,真实预设的具体值见 `adapter-presets/*.json`):

```json
{
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "MyView", "Text": "MyText", "Image": "MyImage",
      "Pressable": "MyPressable", "TextInput": "MyInput", "ScrollView": "MyScrollView"
    },
    "importMap": {
      "MyView": "my-rn-lib", "MyText": "my-rn-lib", "MyImage": "my-rn-lib",
      "MyPressable": "my-rn-lib", "MyInput": "my-rn-lib", "MyScrollView": "my-rn-lib"
    },
    "propMap": {
      "Image": { "source": "src" }
    }
  }
}
```

**adapter 边界**:
- tagMap 只支持 6 大 RN 标签作为 key(`View / Text / Image / Pressable / TextInput / ScrollView`),其他 key 忽略 + QA 告警
- tagMap value 必须匹配 `/^[A-Z][A-Za-z0-9]*$/`(JSX 大写标识符),否则忽略该条 + QA 告警
- importMap 未覆盖的映射后标签,自动 fallback 到 `react-native`
- propMap key 必须是 6 大 RN 原标签(不是 tagMap 映射后的名字);value 是 `{ 原 prop 名: 新 prop 名 }` 的对象;命中的 JSX 属性会被重命名,`style` / `key` / `ref` 等 React 保留 prop **不参与重命名**
- `StyleSheet` / `Dimensions` 等 RN API **始终从 `react-native` 导入**,不进 tagMap

#### 跨框架屏宽 / 系统信息 API 差异(§SCREEN-API)

SKILL 内核默认按 pure React Native 描述,用 `Dimensions.get('window').width` / `.height` 取屏宽和视口高。**但某些 RN-like 框架的 H5 端 webpack 不解析 `react-native` 的 Flow 语法,直接 `import from 'react-native'` 会在构建期崩**。这类框架必须走各自的 API,由 adapter 预设的 `helperTemplate`(参见 `adapter-presets/README.md`)承接:

| 框架 | 屏宽取法 | 视口高取法 | 落地位置 |
|-----|---------|-----------|---------|
| pure React Native / Expo | `Dimensions.get('window').width` | `Dimensions.get('window').height` | rpx helper 内、页面根 minHeight;SKILL 默认举例 |
| 携程 xtaro | `xGetSystemInfoSync().windowWidth`(降级 `.screenWidth`) | `xGetSystemInfoSync().windowHeight`(降级 `.screenHeight`) | 预设 helperTemplate=`xtaro.rpx.ts`;`import { xGetSystemInfoSync } from '@ctrip/xtaro'` — 项目只依赖 @ctrip/xtaro 一个包 |
| taro / 小程序 | `getSystemInfoSync().windowWidth`(from `@tarojs/taro`) | `getSystemInfoSync().windowHeight` | 自定义预设时参考 xtaro.rpx.ts,改 import 源为 `@tarojs/taro` |
| react-native-web | `Dimensions.get('window').*`(RN-web 层已 shim) | 同左 | pure RN 默认即可 |

**agent 生成产物时的判定**:

1. 若 config `unit.responsive.enabled === true` → 尺寸类走 `rpx()` 包装(见 §4.1.1 §C.1 白名单),helper 内部已经处理好屏宽 API 差异,agent **不需要**在业务代码里直接调 `Dimensions` 或 `xGetSystemInfoSync`
2. 若必须在业务代码里直接读屏宽/视口高(典型:§4.3 判定优先级第 6 条的"页面根 minHeight"):
   - 有预设且预设声明了 `helperTemplate` → 参考 helper 里的写法(用 Taro / getSystemInfo 之类),**不要**硬编码 `Dimensions.get('window')`
   - 无预设或预设未声明 → 默认用 `Dimensions.get('window')`(pure RN 语义)
3. **不要**跨框架乱引:xtaro 项目里写 `import { Dimensions } from 'react-native'` 是硬错误 — H5 端会 crash;taro 项目写也一样

**agent 判定当前项目属于哪类框架**的信号(按优先级):

1. config `adapter.importMap` 里的 value 命中 `@ctrip/xtaro` / `@tarojs/*` → 走 Taro API
2. config `adapter.enabled === false` + 项目 `package.json` 有 `expo` 依赖 → pure RN(Expo 兼容 Dimensions)
3. 都识别不出 → 保守默认 pure RN 写法,但**必须**在 QA 段落 warn 一句"项目未识别到框架类型,页面根 minHeight 用了 Dimensions.get('window'),xtaro 项目请手动改为 `xGetSystemInfoSync from @ctrip/xtaro`,taro 项目改为 `getSystemInfoSync from @tarojs/taro`"

**本节仅约束"屏宽 / 视口高"这两个值**。其他 RN API(如 `StyleSheet` / `PixelRatio` / `Platform`)不在此约束范围,继续按内核默认 `import from 'react-native'`(若目标框架也不支持,由 adapter 预设的 helperTemplate 内部处理,不由 SKILL 主流程负责)。

---

### 步骤 0.3：初始化缓存(不可跳过)

**目的**：把 Figma REST API 拿到的节点属性 / 图片文件缓存到本地，避免同一稿子每次跑 SKILL 都重拉。

**做法**：主 agent 在解析 URL（步骤 1）拿到 `fileKey` 后，立即调：

```bash
node .claude/skills/pp-d2c-rn/bin/figma.mjs cache-check <fileKey>
```

脚本会：拉远端 `lastModified` → 与本地 `.d2c-cache/{fileKey}/meta.json` 比对 → **命中**直接返回 `{"status":"hit"}`；**未命中或首次**自动清空并重建 `.d2c-cache/{fileKey}/`（内部结构 `meta.json` / `nodes/*.json` / `images.json`）。

**后续所有 Figma 数据都走 `figma.mjs` 子命令**，不直接 curl：

| 需要什么 | 调什么 | 说明 |
|---------|--------|------|
| 节点属性 JSON | `fetch-node <fileKey> <nodeId> [--depth=N]` | 自动查/回写 `nodes/` 缓存；stdout 返回 `{cached, node}` |
| 导出图片到 assetsDir | `export-image <fileKey> <nodeId> --filename=<name> [--format=png\|svg] [--scale=2] [--preserve-effect]` | 自动"存在即跳过"、两步式下载、3 次指数退避、`use_absolute_bounds=true` 默认开、回写 `images.json`；stdout 返回 `{path, reused, format}` |
| QA 对比截图 | `screenshot <fileKey> <nodeId> [--tag=leaf\|whole\|block]` | 落到 `.d2c-tmp/screenshots/`，不入缓存 |
| SKILL 结束时清临时截图 | `cleanup-tmp` | 步骤 7 收尾时调用 |

**约定**：脚本 stdout 是**一行 JSON**（`{"ok":true,"data":{...}}` 或 `{"ok":false,"error":"..."}`），退出码 0 = 成功、非 0 = 失败。LLM 用 `Bash` 拿 stdout 后自己 parse 即可。

**gitignore 兜底**（老项目升级到  首次跑时可能没有 gitignore 条目）：

调 `cache-check` 前先自查一次 `{projectRoot}/.gitignore`，缺 `.d2c-cache/` 或 `.d2c-tmp/` 就追加。install.js 已在 init 时处理，此步是**已存在老项目**的兜底。

**禁止项**：
- 禁止跳过 `cache-check`（会让缓存在设计稿改过后仍被复用）
- 禁止在同一次 SKILL 运行里多次 `cache-check`（主 agent 校验一次即可，sub-agent 只读缓存不校）
- 禁止绕过脚本直接手写 curl 或手动管理 `.d2c-cache/` 内容
- 禁止把 QA 截图落到 `.d2c-cache/`（脚本 `screenshot` 命令固定落 `.d2c-tmp/`，别改）

---

### 步骤 0.5:doctor 体检(rn SKILL 中已移除)

**rn SKILL 不接 doctor 卫星**。config 默认 `health.enabled=false`,即便老 config 里遗留 `health.enabled=true` 字段,本 SKILL 也**忽略**该字段直接跳过体检。理由:doctor 卫星 SKILL 当前只覆盖 h5 场景的图层规则(前缀命名 / 布局配对 / 结构层级),rn 端并未针对性适配;rn 侧直接进入解析流程即可。

如需静态体检 rn 项目的图层规范,请手动调用 h5 版 `pp-doctor`(与本 SKILL 独立并列,前缀识别规则是等价的),或后续版本再引入 rn 专属 doctor。

---

### 步骤 1：解析 Figma URL

从用户输入提取：
- `fileKey`：URL 中 `/design/` 后的路径段
- `nodeId`：`node-id=` 参数值，将 `-` 替换为 `:`

---

### 步骤 2：扫描图层结构，生成执行清单

**拉节点树**：

```bash
node .claude/skills/pp-d2c-rn/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=2
```

stdout 是 `{"ok":true,"data":{"cached":<bool>,"node":{...}}}`。`node` 就是目标节点的完整子孙树（含 `type` / `name` / `children` / `visible` / `absoluteBoundingBox` 等）。脚本已处理缓存查/写，LLM 不用管。

**分块判断逻辑**：

唯一的分块触发条件是图层名带有 `sub-` 前缀。其他前缀（`img-`、`bg-`、`btn-` 等）不触发分块，由主 agent 直接处理。

**`sub-` 必须分发 sub-agent（无任何例外）**：

- 哪怕整稿只有 **1 个** `sub-` 节点，也必须分发 1 个 sub-agent，**禁止**以"无并行收益 / 单块"为由让主 agent 直接处理
- 哪怕 sub- 内容看起来"很简单"，也必须分发；判定简单与否是 sub-agent 的事，不是主 agent 的事
- 主 agent 只负责：分块识别、清单维护、合并、QA；**不负责** sub- 内部的 JSX/CSS 生成

> **理由**：sub-agent 拆分是质量保证，不是性能优化。把 sub- 内容塞进主 agent 上下文会让主 agent 同时处理"全局协调 + 局部细节"，细节准确度急剧下降（实测：单 agent 串行生成的 sub-card 内部尺寸/对齐/字号偏差比拆分后高 3-5 倍）。

**`sub-` 嵌套 `sub-`**：

允许且支持。典型场景：外层 `sub-content` 含两个内层独立模块 `sub-card` + `sub-scrolly-车票列表`，两个内层异构、各自复杂度都值得独立 agent。

执行模型（**主 agent 派发 + sub-agent 上报**，不允许 sub-agent 自己派孙）：

1. 步骤 2 主 agent 扫描时**只识别第一层 sub-**，写入清单时记录 `nodeId` + 占位 `parentBlock`（顶层时为空）
2. 主 agent 派发该层 sub-agent
3. **sub-agent 拿到 nodeId 后第一件事**：扫描自己子树，找出**直接子层**里的 sub-（不递归更深，深的让对应 sub-agent 自己再扫）
4. sub-agent 把发现的内层 sub- 列表**上报主 agent**，自己**不处理这些内层 sub- 的内容**——在自己的 JSX 里把它们留作占位（`<__SUBSLOT__ nodeId="69:1763" />` 这种 placeholder）
5. 主 agent 收到上报后，把内层 sub- 加入清单，标 `parentBlock` 为外层 block 名，再派发新 sub-agent 处理
6. 重复 3-5 直到所有 sub- 都被处理；**嵌套深度上限 3 层**（外层 sub- 算第 1 层，内层 sub- 第 2 层，再内层第 3 层），超过由 doctor NAM008 警告但不阻塞
7. 合并阶段（§5）按嵌套层级展开 placeholder（component 模式生成嵌套目录，flat 模式按树深度遍历 JSX）

> **为什么是"主 agent 派发"而不是"sub-agent 自己派"**：主 agent 全局清单维护更简单，合并逻辑更线性；sub-agent 自己派孙会让主 agent 失去全局视角，合并阶段的接缝检查（§6.0）容易漏。串行等待的成本可接受——D2C 不是性能敏感场景。

**扫描前先过滤**：`visible: false` 的隐藏图层直接跳过，不参与分块，不进入执行清单。

```
扫描目标节点的所有子层（仅可见图层）：

sub-*   → 独立 block，分发 sub-agent
bg-*    → 主 agent 处理，设为根容器 background-image
img-*   → 主 agent 处理，生成 <img>
其他     → 主 agent 处理
隐藏图层 → 跳过，不生成任何代码
```

**步骤 2 结束后，主 agent 必须输出执行清单并写入文件 `{output.dir}/.d2c-tasks.md`：**

```markdown
# D2C 执行清单
> 生成时间：{时间}，设计稿：{figma url}

## 根容器
- [ ] 根元素 class 命名：{name}

## 背景节点（主 agent 处理）
- [ ] bg-body (nodeId: 95:19385) → 根容器 background-image

## Sub-agent Blocks（树状，缩进表示嵌套）
- [ ] Block 1: sub-content (nodeId: 69:1758) → agentIndex=1, depth=1, parent=ROOT
  - [ ] Block 1.1: sub-card (nodeId: 69:1763) → agentIndex=2, depth=2, parent=sub-content
  - [ ] Block 1.2: sub-scrolly-车票列表 (nodeId: 69:1844) → agentIndex=3, depth=2, parent=sub-content
- [ ] Block 2: sub-img-QA (nodeId: 25:4263) → agentIndex=4, depth=1, parent=ROOT

> 子项缩进 2 空格 + `-` 表示嵌套；`depth` 从 1 起，上限 3；`parent` 写父 block 名（顶层为 ROOT）。
> sub-agent 完成自己后**只标自己的行**为 `[x]`，父行等所有子项完成才能标。

## 主 agent 直接处理节点
- [ ] img-分享 (nodeId: 25:4416) → <img>
- [ ] img-footer (nodeId: 25:4449) → <img>

## 合并验收
- [ ] 所有 sub-agent 完成（含嵌套）
- [ ] 背景节点已写入根容器
- [ ] 直接处理节点已写入主文件
- [ ] **主 agent 逐叶子 block 单独视觉对比（§6.0；非叶子 block 不单独对比，由其叶子覆盖）**
- [ ] 整体视觉 QA 完成（§6.1）
- [ ] 图片 URL 自检完成（§6.2）
```

**清单规则**：
- 每完成一项，立即将 `[ ]` 改为 `[x]`
- 步骤 5 合并前，逐项检查清单，有 `[ ]` 未完成的不得进入合并
- sub-agent 完成自己的 block 后，将对应清单项标为 `[x]`

产出：block 列表 + `.d2c-tasks.md` 文件。

---

### 步骤 2.5:页面级背景 + 根骨架(rn SKILL 简化版)

**与 h5 SKILL 不同**:rn 侧没有 `body` 概念,不存在"页面根容器有固定 750px 会露白"的问题。但 rn 有另一个 h5 没有的问题:**RN 的 `<View>` 天然不滚**,内容比屏高时会被裁掉,用户看不到底部。所以 rn 页面必须**强制**采用 `<ScrollView>` 骨架。

#### 页面根骨架(rn 强制,一律套用,无判定分支)

**agent 无法准确判断"内容是否超过视口"**(视口高度是运行时值,figmaBase 与视口高度不联动;顶层 frame 高度也不总等于内容真实高度)。所以本 SKILL **不做判断**——**所有 rn 页面**产物,顶层入口节点(用户 URL 的 `node-id` 指向的那一层)**一律**按下方骨架生成,不看设计稿高度、不看 layoutMode、不看视口尺寸。

> **下方示例用 RN 内核标签(View / ScrollView / Image)描述规则**;配置了 `adapter.enabled = true` 时,§5.5 会在合并阶段按 `tagMap` 自动把 `View → XView` / `ScrollView → XScrollView` / `Image → XImage`(xtaro 预设),以及按 `propMap` 把 `Image.source → src`。SKILL 内核只讲 RN,不绑定任何具体框架。

```tsx
import { Image, ScrollView, View, StyleSheet } from 'react-native'
import { rpx } from '@/utils/rpx'  // 或项目 alias

export default function PageName() {
  return (
    <View style={styles.root}>
      {/* 主滚动区:承载所有顺流内容 + layoutPositioning:ABSOLUTE 但跟随内容滚动的角标(如 djs 抽奖胶囊) */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {/* bg-body 全屏背景层(ABSOLUTE 铺满 scrollContent 头部) */}
          <Image source={require('...bg-body.png')} style={styles.bgBody} resizeMode="cover" />

          {/* Figma 顶层 frame 的所有顺流子在这里(sub-*、img-*、Rectangle spacer 等) */}
          {/* ...按 §4.3 判定优先级正常生成... */}

          {/* 底部占位:给屏底 fixed-* 让空间避免遮挡末尾内容 */}
          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* 真 fixed 层:navbar / 状态栏图标 / 底部购票按钮等 → 放 ScrollView 外贴屏 */}
      {/* ...fixed-* 按下方"fixed-* 分层规则"生成... */}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,               // 撑满 SafeAreaView / 屏幕
    position: 'relative',  // 承接 fixed-* 绝对定位
    backgroundColor: '<顶层 frame fills[0] 转 hex>',  // 顶层 frame 的 fills → 根背景色
  },
  scroll: {
    flex: 1,               // 撑满剩余空间
  },
  scrollContent: {
    position: 'relative',  // 承接内部 layoutPositioning:ABSOLUTE 子层(如 bg-body、跟随滚动的角标)
    width: rpx(<figmaW>),
    minHeight: rpx(<figmaH>),  // 内容不足时至少这么高;超出自动增高
    paddingTop: rpx(<顶层 frame paddingTop>),
    alignItems: '<顶层 frame counterAxisAlignItems 映射>',
    alignSelf: 'center',   // 移动端画布水平居中(适配大屏)
  },
  bgBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(<figmaW>),
    height: rpx(<figmaH>),  // 事实值,不用 '100%'(见 §4.1.1 §A FIXED 塌陷防御)
  },
  bottomPadding: {
    height: rpx(80),       // 常量:留给屏底 fixed-btn 之类;若页面无屏底 fixed 可省略
  },
})
```

#### fixed-* 分层规则(rn 强制)

Figma 里所有 `fixed-*` / `layoutPositioning: ABSOLUTE` 且贴屏语义的节点(navbar / 底部购票按钮 / 状态栏 back/share 图标),**必须**放在 `<ScrollView>` **外面**,作为根 `<View>` 的直接子:

```tsx
<View style={styles.root}>
  <ScrollView>...主滚动区...</ScrollView>

  {/* 真 fixed:navbar 贴屏顶,按钮贴屏底 */}
  <Image source={...} style={styles.fixedNavbar} />  {/* top: 0 */}
  <Pressable style={styles.fixedBtnHit} onPress={...}>  {/* bottom: 0 */}
    <Image source={...} style={styles.fixedBtn} />
  </Pressable>
</View>
```

对应 styles:
```ts
fixedNavbar: {
  position: 'absolute',
  top: 0, left: 0,
  width: rpx(375), height: rpx(<navbarH>),
  zIndex: 100,   // 高于 ScrollView 内容
},
fixedBtnHit: {
  position: 'absolute',
  bottom: 0, left: 0,      // 贴屏底(不是 Figma 里的 top=1505,那是相对页面高度)
  width: rpx(375), height: rpx(<btnH>),
  zIndex: 100,
},
```

**铁律:所有 `fixed-` 前缀节点一律放 `<ScrollView>` 外**——RN 里根本没有 CSS `position: fixed`,而 `<ScrollView>` 内部的 `position: 'absolute'` 元素**相对内容容器定位**,滚动时会一起动。要模拟"贴屏"只有一条路:放外层,`position: 'absolute'` + zIndex。

**位置换算(按 Figma constraints 分三档,不看设计师意图,不 agent 二次揣测)**:

| Figma constraints `vertical` | CSS 写法 | 说明 |
|---|---|---|
| `TOP`(默认) | `top: rpx(<Figma y - 顶层frame y>)` | 用 Figma 事实相对坐标,不是页面绝对 y |
| `BOTTOM` | `bottom: rpx(<顶层frame 底 - Figma 节点底>)` | 贴屏底常见值 `bottom: 0`(设计师就把节点画到屏底) |
| `CENTER` | `top: 50%` + `transform: [{ translateY: -<h/2> }]` | 少见,慎用 |

**关键**:不做"这个 fixed- 是不是设计师本意贴屏"的推断。**只要图层名带 `fixed-` 前缀,就贴屏**——设计师主动加前缀 = 明确表达"这个元素相对屏幕定位,不是相对文档"。反过来,设计师用 `layoutPositioning: ABSOLUTE` 但**不带 `fixed-` 前缀**的节点(如视频右上角角标 / 卡片角标 / 装饰徽章)才走"跟内容滚"——正常处于父容器 flex 顺流之外,但相对父定位,滚动时随父一起动。

**为什么不用 Portal / Modal 层**:RN 里 Portal 会破坏 zIndex 语义与 JSX 顺序直观性,不如全部放根 `<View>` 直接子层用 zIndex 排序。

#### 顶层 frame 属性映射

Figma 顶层 frame 的属性 → 根骨架各处:

| Figma 字段 | 落到 | 说明 |
|-----------|------|------|
| `fills[0].type === 'SOLID'` | `styles.root.backgroundColor` | 转 HEX |
| `fills[0].type === 'IMAGE'` | 拆独立 bg-body `<Image>` 挂 `scrollContent` 内头部 | 见上骨架 |
| `fills[0].type === 'GRADIENT_*'` | 退化纯色(gradientStops[0]) → `styles.root.backgroundColor` + QA warn | 见 §4.3.rn 退化表 |
| `paddingTop/Right/Bottom/Left` | `styles.scrollContent.padding*` | 常见 rn 顶层 frame 有 paddingTop 给状态栏留位 |
| `counterAxisAlignItems` | `styles.scrollContent.alignItems` | CENTER → 'center' |
| `absoluteBoundingBox.width` | `styles.scrollContent.width` / `styles.bgBody.width` | rpx 包装 |
| `absoluteBoundingBox.height` | `styles.scrollContent.minHeight` / `styles.bgBody.height` | rpx 包装;用 `minHeight` 让内容可撑开 |

**禁止**:
- 禁止在 rn 侧写 `body { ... }`(RN 无 body 概念)
- 禁止在 rn 侧写 `:global`(RN 无 CSS 作用域概念)
- 禁止在 rn 侧引用 `css-modules` / `scss` / `less` 类 h5 概念
- **禁止让根 `<View>` 直接装内容而不套 `<ScrollView>`**——即便设计稿高度 < 视口高度,也强制套用(套了不滚也没副作用;不套则超长内容被裁)
- **禁止把贴屏 fixed-* 放进 `<ScrollView>` 内部**——那会导致它们跟着内容滚动,变成"贴内容顶/底"而不是"贴屏顶/底",视觉硬伤
- **禁止把根 View 或 scrollContent 写 `overflow: 'hidden'`**——这会阻止 ScrollView 滚动

---

### 步骤 3：并行分发 sub-agent

向每个 block 分发一个 sub-agent，**全部并行执行**。

每个 sub-agent 收到以下上下文：
- 目标 block 的 `fileKey` 和 `nodeId`
- 图层解析规则（完整规则见步骤 4）
- `agentIndex`
- config 快照：`framework`、`styleFormat`、`images`、`layers`、`output.dir`

---

### 步骤 4：sub-agent 实现单个 block

#### 4.0 根节点前缀检查（优先于一切）

sub-agent 拿到根节点后，**第一步**检查根节点自身的图层名前缀（去掉 `sub-` 后剩余的前缀）：

| 根节点剩余前缀 | 处理方式 |
|--------------|---------|
| 含 `img-` | 整个节点导出为一张图片，生成单个 `<img>`，**不解析任何子层，直接结束** |
| 含 `bg-` | **`bg-` 节点自身**（不是父容器！）导出为图片，设为**父容器**的 `background-image`，**不解析任何子层**。**切图源 nodeId 必须是 `bg-` 节点自己的 nodeId**，详见下面 §4.4「`bg-` 切图源约束」；违反这一条会把兄弟节点的文字/图标烤进 PNG |
| 含 `x-` | 跳过，不生成任何代码 |
| 无上述前缀 | 正常进入 4.0.5 嵌套 sub- 检测 |

**示例**：`sub-img-QA` → 去掉 `sub-` 后剩 `img-QA` → 命中 `img-` → 整体导出为 `qa.png`，生成 `<img src=".../qa.png" />`，不解析内部任何子图层。

#### 4.0.5 嵌套 sub- 检测与上报

> **执行模型说明（先于一切，避免误读）**：本节里的"sub-agent"、"派发"、"上报"都指的是 **同一个 LLM agent 顺序处理多层 SKILL 流程**——LLM 没有真正的多进程或函数调用能力。"派发新 sub-agent"实际操作是：当前 agent 处理完外层 sub- 的占位输出后，**自己重新进入 §4.0 流程**处理内层 sub- 的 nodeId（每次重新进入 §4.0 时把根节点重置为新的 nodeId、把 depth +1）。"上报到主 agent"实际操作是：当前 agent 把要交接的信息（subslots.json 内容）写到磁盘文件，下一段流程读这个文件继续。

进入子层解析前，sub-agent **必须**先扫描自己子树（仅扫到自己直接子层为止），找出**所有带 `sub-` 前缀的直接子孙节点**（不递归更深，更深的层由对应 sub-agent 自己再扫）：

1. 收集内层 sub- 节点：记录每个节点的 `nodeId` / `name` / `直接父节点 name`（用于在 JSX 里定位 placeholder）
2. **不允许 sub-agent 自己处理这些内层 sub- 的内容**——它们必须由主流程下一轮重新进入 §4.0 处理
3. 在自己生成的 JSX 里，对每个内层 sub- 的位置写 placeholder（**这是要写进文件的真实字符串**）：
   ```tsx
   <__SUBSLOT__ nodeId="69:1763" name="sub-card" />
   <__SUBSLOT__ nodeId="69:1844" name="sub-scrolly-车票列表" />
   ```
4. sub-agent 完成自己的 JSX/CSS 后，**写一个真实的 `subslots.json` 文件**到 block 目录里（与 `assets.txt` 同级），内容如下：
   ```json
   {
     "parent": { "nodeId": "69:1758", "name": "sub-content" },
     "slots": [
       { "nodeId": "69:1763", "name": "sub-card", "parentInJsx": "div.content > div:nth-child(2)" },
       { "nodeId": "69:1844", "name": "sub-scrolly-车票列表", "parentInJsx": "div.content > div:nth-child(3)" }
     ]
   }
   ```
5. **嵌套深度检查**：当前 sub-agent 自己 depth + 1 = 内层 depth；若内层 depth > 3，写 `subslots.json` 时多加一个字段 `"depthExceeded": true`，主流程下一轮**仍继续处理**但在 QA 段落里告警（不阻塞，doctor NAM008 的运行时表达）

**主流程读取 `subslots.json` 后**：
- 把每个 slot 加入 `.d2c-tasks.md` 的"Sub-agent Blocks"树状清单（缩进表示嵌套，标 `parent`）
- **重新进入 §4.0 流程**处理每个内层 sub- 的 nodeId（每次进入 §4.0 都会再走一遍 §4.0.5 检测）
- 等所有内层 sub- 都处理完后，进入 §5 合并

> **关键约束**：sub-agent 在子树扫描中遇到嵌套 sub- 时，**不能自己继续向内递归扫描**。它只负责"上报到自己直接子层为止"——更深层的 sub- 由下一轮处理那个 sub- 时由当时的 agent 自己再扫。这是为了避免单个 sub-agent 把整棵子树都看到，违反"每层独立上下文"原则。

#### 4.1 读取设计上下文

调脚本拿节点属性（含子树）：

```bash
node .claude/skills/pp-d2c-rn/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=8
```

`node` 里含图层树、以下几类字段必须读全（脚本自动查/写缓存）：

- **视觉属性**：`fills` / `strokes` / `strokeWeight` / `strokeAlign` / `effects` / `cornerRadius` / `rectangleCornerRadii` / `opacity` / `blendMode`
- **布局属性（autoLayout，强调）**：`layoutMode` / `itemSpacing` / `paddingLeft` / `paddingRight` / `paddingTop` / `paddingBottom` / `primaryAxisAlignItems` / `counterAxisAlignItems` / `layoutWrap` / `layoutSizingHorizontal` / `layoutSizingVertical`
- **子节点尺寸行为**：`layoutGrow` / `layoutAlign` / `layoutPositioning`（`AUTO` = 参与父 autoLayout 顺流；`ABSOLUTE` = 脱离父顺流，用 `absoluteBoundingBox` 独立定位。缺失视为 `AUTO`）
- **定位**：`constraints` / `absoluteBoundingBox`
- **文本**：`characters` / `style`（TEXT 节点）
- **可见性**：`visible`

> **铁律：不再使用 MCP `get_design_context` 返回的"参考代码"字段**。REST API 只返回原始节点 JSON，agent 按项目前缀规则（§4.0 / §4.3）自主判断如何渲染，不受任何"AI 生成的通用 D2C 参考代码"干扰。

> **强调**：`layoutMode` 字段是 Figma autoLayout 的核心信号。**每处理一个 Frame 节点，必须先读 `layoutMode`**（`HORIZONTAL` / `VERTICAL` / 缺失 = 无 autoLayout）；这是 §4.3 布局判定的入口条件，跳过读它会直接退化成 absolute 定位泛滥。

> **补丁：`layoutPositioning`（读每个子节点时必读）**：Figma auto-layout 支持"子节点脱离父顺流"——子节点 `layoutPositioning === 'ABSOLUTE'` 表示该子在父 autoLayout 里挖了个洞独立定位；其他兄弟仍按 flex 顺流。**读子节点时必读此字段**，值为 `ABSOLUTE` 时子走绝对定位、父仍走 flex（见 §4.3 判定优先级第 0 条）。

#### 4.1.1 REST 原始 JSON 字段取值指引(rn 版:输出 RN StyleSheet 对象)

Figma REST API 返回的原始 JSON 字段名与结构比 MCP 加工过的多一层壳;agent 从中取值时按下表映射。**注意 h5 SKILL 里"CSS 属性名 kebab-case + px 字符串"的输出形式,在 rn SKILL 里统一改成 camelCase + 数字**(RN StyleSheet 规范)。

**A. 布局 / autoLayout → RN flex(每个 Frame 都必须先读这一段)**

| 目标 RN StyleSheet 属性 | Figma REST 字段 | 取值细节 |
|---------|----------------|---------|
| (RN 默认 `display: 'flex'`,通常可省) | `layoutMode`:`HORIZONTAL` / `VERTICAL` / (缺失或 `NONE` = 无 autoLayout) | 只要 `layoutMode ∈ {HORIZONTAL, VERTICAL}` → 该 Frame **必须**用 flex;缺失/`NONE` → 走 §4.3 决策树后续步骤 |
| `flexDirection` | `layoutMode` | `HORIZONTAL → 'row'`;`VERTICAL → 'column'`;RN 默认就是 `'column'`,VERTICAL 时可省 |
| `gap` | `itemSpacing` (px) | 直接映射;数值按 §4.5 单位换算 × scale;**RN 0.71+ 才支持 gap**,低版本需退化为 `marginRight` / `marginBottom`(输出 QA info 告警) |
| `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` (数字) | `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` (px) | 缺失字段视为 0;数字无单位 |
| `justifyContent` (主轴对齐) | `primaryAxisAlignItems` | `MIN → 'flex-start'`;`CENTER → 'center'`;`MAX → 'flex-end'`;`SPACE_BETWEEN → 'space-between'`(**两端对齐**) |
| `alignItems` (交叉轴对齐) | `counterAxisAlignItems` | `MIN → 'flex-start'`;`CENTER → 'center'`;`MAX → 'flex-end'`;`BASELINE → 'baseline'` |
| `flexWrap` | `layoutWrap` | `WRAP → 'wrap'`;`NO_WRAP` 或缺失 → 不写(RN 默认 `'nowrap'`) |
| 容器**自身**尺寸行为 | `layoutSizingHorizontal` / `layoutSizingVertical` | `FIXED → width/height: <数字>` 固定值;`HUG → 不写 width/height`(RN 默认按内容 hug);`FILL → flex: 1` 或 `alignSelf: 'stretch'`。**FIXED 高度的塌陷防御**(v1.0.2 新增,**必读**):当 vertical `FIXED` 且节点带 `sub-` / `block-` 前缀,或节点内部有 `layoutPositioning: 'ABSOLUTE'` 且 `height: '100%'` 的兄弟层(典型 bg- 铺满)→ 写 `minHeight: <N>` 而非 `height: <N>`;死高会因内容异步渲染时收缩,让 `height: '100%'` 兄弟层跟着塌成一条。详见下面「FIXED 塌陷防御」补充。**页面根容器例外**(§4.3 判定优先级第 6 条):vertical `FIXED` 时不写 `height: <死值>`,改写 `minHeight: Dimensions.get('window').height`(内核默认;RN-like 框架的替代 API 见 §SCREEN-API) |
| **子节点**主轴伸缩 | `layoutGrow` (0 或 1) | `1 → flex: 1`;0 或缺失 → 不写 |
| **子节点**交叉轴对齐(覆盖父 alignItems) | `layoutAlign` | `STRETCH → alignSelf: 'stretch'`;`INHERIT` / 缺失 → 不写 |
| **子节点**是否脱离父 autoLayout 顺流 | `layoutPositioning` | `AUTO` 或缺失 → 参与父 flex 顺流,不写 position;`ABSOLUTE` → 子代 `position: 'absolute'` + `top` / `left` 数值(相对父原点,用 `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` 算得),同时**父容器必须加** `position: 'relative'`。仅当父 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 时此字段有意义 |

> **rn 铁律**:`layoutMode` 是 `HORIZONTAL` / `VERTICAL` 时,**禁止**对该 Frame 使用 `position: 'absolute'` + `top` / `left`;主 agent §6.0 验收命中此违反 → 回退整块重写。
>
> **两端对齐提醒**:`primaryAxisAlignItems === 'SPACE_BETWEEN'` **直接翻译成 `justifyContent: 'space-between'`**,不要用其他手段模拟。
>
> **`layoutPositioning` vs `layoutMode`**:一个节点可以自己是 autoLayout 容器(`layoutMode = 'VERTICAL'`),同时又在父的 autoLayout 里绝对定位(`layoutPositioning = 'ABSOLUTE'`)。

> **FIXED 塌陷防御**(v1.0.2 新增,容器高度写法的第 3 个补充规则):Figma `layoutSizingVertical: FIXED N` 到 RN StyleSheet 有 3 种落地方式,按下表选:
>
> | 场景 | 高度写法 | 理由 |
> |---|---|---|
> | 页面根容器(三信号 AND 命中,见 §4.3 优先级 6) | `minHeight: Dimensions.get('window').height`(RN 内核默认;RN-like 框架按 §SCREEN-API 替换,如 xtaro 走 `xGetSystemInfoSync().windowHeight`) | 长屏时撑满视口 |
> | **`sub-` / `block-` 容器且内部有 `layoutPositioning: 'ABSOLUTE' + height: '100%'` 兄弟层**(典型:`main` 含 `mainBg` 铺满) | **`minHeight: <N>`** | 死高 `height` 会因内容异步渲染 / 数据少时压缩到 HUG 表现,让 `height: '100%'` 兄弟层跟着塌成一条 |
> | **`sub-` / `block-` 容器普通场景**(无绝对定位背景兄弟) | **`minHeight: <N>`** | 设计师给 FIXED = 兜底"至少这么高",业务内容多时允许撑开;死高会裁切超长内容 |
> | 叶子/装饰元素(`img-` / `bg-` / `btn-` / 图标 / 卡片装饰等) | `height: <N>` | 尺寸严格匹配设计稿,超出属于设计问题 |
>
> **判定顺序**:先看是否命中"页面根容器例外"→ 再看是否命中"sub-/block- 容器"→ 都不是走"叶子/装饰"。
>
> **兼容点**:`minHeight` 相较 `height` 只是"下限保底",不影响设计稿本意。旧产物用 `height` 出现的塌陷问题(bg 层跟着塌成一条)全部由本规则统一收敛。

> **sub 容器 minHeight 尺寸源证明（v0.3.10 强制）**：`sub-` / `block-` 容器写 `minHeight` 时，尺寸源**必须**取节点**自身**的 `absoluteBoundingBox.height`，**禁止**取兄弟 `bg-` / `bgc-` 层的高度（哪怕兄弟层比自身高——bg 兄弟层在 Figma 里常"溢出到下方指南区"作装饰）。
>
> **sub-agent 交付每个 `sub-` / `block-` 容器前必须在 `blocks/{sub}/assets.txt` QA 段写一行**：
>
> ```
> · SUB容器 {nodeId} name="{nodeName}" 自身h={H1} bg兄弟层h={H2 或 "无"} minHeight写入={H1}（scale=1，RN 侧无 h5 的 scale=2 换算）
> ```
>
> RN 侧 `scale=1`（数值直接来自 Figma），`minHeight 写入` 值必须严格等于 `H1`，**不允许**是 `H2`。若响应式 rpx 启用（`unit.responsive.enabled === true`），实际产物写法是 `minHeight: rpx(H1)`——溯源行的 `minHeight 写入` 仍记裸数值 `H1`（rpx 包装是**渲染层**，与**尺寸源**是两回事）。
>
> **主 agent 合并前 grep 自证命令**（§6.0.3 证明块「sub 容器 minHeight 尺寸源」段引用）：
>
> ```bash
> grep -Eho '^· SUB容器 [0-9]+:[0-9]+ .* minHeight写入=[0-9.]+' {output.dir}/blocks/**/assets.txt 2>/dev/null \
>   > /tmp/rn-sub-minh-declared.txt
>
> ERRORS=0
> while read line; do
>   H1=$(echo "$line" | sed -E 's/.*自身h=([0-9.]+).*/\1/')
>   WROTE=$(echo "$line" | sed -E 's/.*minHeight写入=([0-9.]+).*/\1/')
>   if [ "$H1" != "$WROTE" ]; then
>     echo "❌ SUB minHeight 尺寸源错：$line 应写入 $H1"
>     ERRORS=$((ERRORS + 1))
>   fi
> done < /tmp/rn-sub-minh-declared.txt
>
> if [ "$ERRORS" = "0" ]; then
>   echo "✅ RN sub 容器 minHeight 尺寸源契约通过：$(wc -l < /tmp/rn-sub-minh-declared.txt) 个容器全部按自身尺寸写入"
> else
>   echo "❌ $ERRORS 个容器把 bg 兄弟层高度错写为 minHeight（触发 doctor DIM031）"
> fi
> ```
>
> **doctor 关联规则**：DIM031（v0.3.10 新增，error），见 pp-doctor §3.6s。

> **冗余嵌套 autoLayout 的属性下穿**(v1.0.2 新增,判定/取值层的隐藏 bug 修复):Figma 里设计师有时为了"分组"多包一层 autoLayout,但内部只有一个真正的顺流子(其他都是 abs 兄弟)。直译成 RN 组件树时**保留双层结构没错**(abs 兄弟需要挂在外层),但**布局属性(padding/gap/align)应该整体下穿到内层**,因为设计师改的是内层。
>
> **触发条件(全部满足才命中)**:
>
> 1. 外层节点 A 是 autoLayout(`layoutMode ∈ {HORIZONTAL, VERTICAL}`)
> 2. A 的直接子里,`layoutPositioning !== 'ABSOLUTE'` 的顺流子**只有 1 个**(记为 B),其他兄弟都是 `layoutPositioning === 'ABSOLUTE'`
> 3. B 也是 autoLayout(否则下穿失去意义)
> 4. A 和 B **不属于同一个 sub-agent 的边界**(即 A 或 B 中有 `sub-` 前缀时**不下穿**,`sub-` 边界要保持 A/B 各自独立的样式命名空间)
>
> **命中后的取值 / 落地规则**:
>
> | 属性 | A(外层) | B(内层) |
> |---|---|---|
> | `flexDirection` / `flexWrap` | **删除**(A 不再当 flex 容器,RN 里 View 默认 flex 但设置 `flexDirection: 'column'`/`'row'` 是"当 flex 用") | 保留 B 自己的 |
> | `padding` / `paddingHorizontal` / `paddingVertical` / `gap` / `justifyContent` / `alignItems` | **删除**,值下穿到 B(若 B 已有同名属性→**保留 B 的**,A 的值写入 §7 QA info 段) | 用 B 自己的值;B 没写就用 A 下穿的值 |
> | `width` / `height` / `minHeight` / `maxWidth` / `maxHeight` | 保留 A 自己的(容器骨架) | 保留 B 自己的 |
> | `position` / `overflow` / `backgroundColor` / `borderRadius` / `shadowXxx` | 保留 A 自己的(容器骨架) | 保留 B 自己的 |
> | `position: 'relative'`(为 abs 兄弟挂载) | **强制加**(若 A 有 abs 兄弟) | 不动 |
>
> **典型场景**(欧暑二级页面 Frame 703 / 702 tab 滚动列表,RN 版):
>
> ```
> // Figma:
> Frame 703 (autoLayout HORIZONTAL, gap=0 padding=14 0)                     ← 外层,内容仅 1 顺流子 + 1 abs fade 遮罩
> ├── Frame 702 (autoLayout HORIZONTAL, gap=112 padding=40 40)              ← 内层,真正排布 tab 项
> │   ├── tab 1 / tab 2 / ...
> └── img-xz fade 遮罩 (layoutPositioning: ABSOLUTE)
> ```
>
> ```ts
> // 命中"冗余嵌套下穿"规则,产物 StyleSheet:
> tabScroll: {
>   position: 'relative',                  // 保留(abs 兄弟需要挂载)
>   width: rpx(720), height: rpx(98),      // 保留(A 骨架)
>   // ⚠️ 删除:flexDirection / gap / padding / alignItems(全部下穿到 B)
> }
> tabList: {
>   flexDirection: 'row',                  // 来自 B 自己
>   gap: rpx(112),                         // 来自 B(不是 A 的 0)
>   paddingHorizontal: rpx(40),            // 来自 B(不是 A 的 14 0)
>   alignItems: 'center',                  // 来自 B
> }
> fade: { position: 'absolute', ... }      // abs 兄弟仍挂 A(tabScroll)
> ```
>
> **不下穿的例外**:A 或 B 命中 `sub-` 前缀 → 不下穿,双层各自输出。`sub-` 是"独立 agent 边界",样式命名空间要各自独立才好维护。
>
> **QA 输出**:命中下穿时,§7 报告段追加一行:`<A 节点名>(外层) → <B 节点名>(内层) 触发冗余嵌套下穿,padding/gap 已合并到内层`。若发生"A 和 B 同名属性冲突,以 B 为准",另加一行:`<属性名>: A 值 <VA> 被 B 值 <VB> 覆盖`。

**B. 视觉属性(rn 版:CSS → RN StyleSheet)**

| 目标 RN StyleSheet 属性 | Figma REST 字段 | 取值细节 |
|---------|----------------|---------|
| `backgroundColor: '#hex'` 或 `'rgba(...)'` (SOLID) | `fills[i].color = {r, g, b, a}` (0-1 浮点) + `fills[i].opacity` (可选) | HEX = `#` + `Math.round(r*255).toString(16).padStart(2,'0')` 三段拼接;`a` 或 `opacity` < 1 时改用 `'rgba(R,G,B,A)'` |
| 线性 / 径向渐变 | `fills[i].type = 'GRADIENT_LINEAR'` / `'GRADIENT_RADIAL'` | **RN 原生无渐变支持**。退化策略:取 `gradientStops[0].color` 作为纯色 `backgroundColor`,QA 输出 warn 告警"渐变需接 `react-native-linear-gradient` 或 `expo-linear-gradient` 手改" |
| 图片背景 | `fills[i].type = 'IMAGE'` + `fills[i].imageRef` | **RN 无 backgroundImage**。拆成独立 `<Image source={require('...')} style={StyleSheet.absoluteFillObject} />` 置于父兄弟最前,父加 `position: 'relative'`(详见 §4.3 退化表) |
| 内描边 | `strokes[i]` + `strokeWeight` + `strokeAlign = 'INSIDE'` | `borderWidth: <数字>, borderColor: '#hex'` (RN 无 outside / inside 区分,近似渲染;strokeAlign=OUTSIDE 也走此规则并 QA warn) |
| gradient stroke | strokes 是 GRADIENT_* | 退化为纯色 border + QA warn |
| `borderRadius` | 单值 `cornerRadius`,或四角 `rectangleCornerRadii = [tl, tr, br, bl]` | 单值直接 `borderRadius: <数字>`;四角分别用 `borderTopLeftRadius` / `borderTopRightRadius` / `borderBottomRightRadius` / `borderBottomLeftRadius` |
| 阴影 | `effects[i].type = 'DROP_SHADOW'` + `offset.{x,y}` + `radius` + `color` | **RN 拆成 4-5 个属性**:`shadowColor: '#hex'`, `shadowOffset: { width: x, height: y }`, `shadowRadius: <radius>`, `shadowOpacity: <color.a>`, `elevation: <radius>`(Android 端)。**iOS 只看前 4 个,Android 只看 `elevation`,同时写才两端可见** |
| INNER_SHADOW | `effects[i].type = 'INNER_SHADOW'` | **RN 无原生对应**。不出 style,产物注释 `// TODO: RN no INNER_SHADOW support` + QA error 告警 |
| filter blur | `effects[i].type = 'LAYER_BLUR'` | **RN 无原生 filter**。同上,QA error 告警提示"需接 `@react-native-community/blur` 或 `expo-blur`" |
| backdrop-filter blur | `effects[i].type = 'BACKGROUND_BLUR'` | 同上,QA error |
| `position: 'fixed'` 定位来源 | `constraints = {horizontal, vertical}` + `absoluteBoundingBox` | **RN 无 fixed**。退化为 `position: 'absolute'` + top/left/right/bottom 数值,QA warn 告警"滚动时不保持屏幕位置" |
| 字体 / 字号 / 字重 / 行高 | `style.{fontFamily, fontSize, fontWeight, lineHeightPx}`(TEXT 节点) | `fontFamily: '...'`, `fontSize: <数字>`, `fontWeight: '500'`(**字符串!RN 只认 `'normal'/'bold'/'100'-'900'`**), `lineHeight: <数字>` |
| 文本颜色 | TEXT 节点 `fills[]`——**按下面「TEXT 多层 fills 处理」取值**（禁止直接取 `fills[0]`） | `color: '#hex'`(在 Text 组件的 style 里,不是父 View) |
| 文本对齐 | `style.textAlignHorizontal` | `LEFT/CENTER/RIGHT/JUSTIFIED → 'left'/'center'/'right'/'justify'`,写作 `textAlign: '<value>'`(仅 Text 组件) |
| 字间距 | `style.letterSpacing` | `letterSpacing: <数字>` |
| 是否可见 | `visible`(缺失时视为 `true`) | `false` 直接跳过 |
| 子树 | `children[]` | 递归结构 |

**颜色转换代码模板**:

```python
def rgb_to_hex(c):
    r, g, b = round(c['r']*255), round(c['g']*255), round(c['b']*255)
    a = c.get('a', 1)
    if a < 1:
        return f"rgba({r},{g},{b},{a})"
    return f"#{r:02x}{g:02x}{b:02x}"
```

**TEXT 多层 fills 处理（v0.3.6 新增）**：

Figma 里一个 TEXT 节点可以叠多层 `fills`。取字色规则（详细同 pp-style §八）：

| fills 情形 | 取值 |
|-----------|------|
| 单层 SOLID | 直接取 |
| 多层 SOLID，都 `visible !== false` | **按 fills[] 顺序取最末位**（Figma 渲染顺序） |
| 多层 SOLID，部分 `visible === false` | **跳过 visible:false**，取剩下的最末位 |
| 单层 GRADIENT | RN 无原生渐变文字，退化为末位近似 SOLID + QA 告警（Web 侧走 `background-clip: text`） |
| 多层混合 | 按渲染顺序合成；最上层是 GRADIENT → 退化为该渐变的近似 SOLID + QA 告警；最上层是 SOLID → 取 SOLID 色 |
| fills 为空 | 用默认黑 `#000` + QA 告警 |

**反向自检 1 行**（sub-agent 生成 `<Text>` 前必须输出）：

```
· TEXT 字色：{finalColor}（fills 有 {N} 层可见 SOLID，取末位；例：#492b0d 被 #ffffff 覆盖时最终视觉是白色）
```

**典型案例**：`136:45728`（"去看看"）fills = `[#492b0d visible:true, #ffffff visible:true]` → 取 `#ffffff`。

**doctor NAM025（v0.3.6 新增）**：TEXT 节点 `fills` 有 ≥2 个可见 SOLID → info 提示。

**字色 fills 溯源证明（v0.3.10 强制，每个 TEXT 交付前写 assets.txt QA 一行）**：

sub-agent 交付每个 block 前，必须在 `blocks/{sub}/assets.txt` QA 段末尾追加**每个 TEXT 节点一行**溯源，格式：

```
· TEXT {nodeId} "{text}" fills层数={N} 可见SOLID列表=[#hex1, ..., #hexN] 末位可见色={#hexN} 最终写入={#final}
```

`{#final}` 必须严格等于 `{#hexN}`（GRADIENT 退化为近似 SOLID 时以退化后色为准）。

**主 agent 合并前 grep 自证命令**（§6.0.3 证明块中「字色 fills 溯源」段引用，RN 版覆盖 3 种 color 写法）：

```bash
# 1. 从 assets.txt 提取所有 TEXT 溯源行的最终写入色
grep -Eho '^· TEXT [0-9]+:[0-9]+ .* 最终写入=#[0-9a-fA-F]{3,8}' {output.dir}/blocks/**/assets.txt 2>/dev/null \
  | sed -E 's/.*最终写入=(#[0-9a-fA-F]{3,8}).*/\1/' | sort -u > /tmp/rn-text-color-declared.txt

# 2. 从产物提取 color 值（RN 3 种写法：color: '#hex' | color: "#hex" | color: #hex）
grep -rEho "color:\s*['\"]#[0-9a-fA-F]{3,8}['\"]|color:\s*#[0-9a-fA-F]{3,8}" {output.dir}/ \
  --include='*.tsx' --include='*.jsx' --include='*.ts' --include='*.js' 2>/dev/null \
  | grep -oE '#[0-9a-fA-F]{3,8}' | sort -u > /tmp/rn-text-color-used.txt

# 3. 差集 declared - used
comm -23 /tmp/rn-text-color-declared.txt /tmp/rn-text-color-used.txt > /tmp/rn-text-color-lost.txt
LOST=$(wc -l < /tmp/rn-text-color-lost.txt)

if [ "$LOST" = "0" ]; then
  echo "✅ RN TEXT 字色溯源契约通过：$(wc -l < /tmp/rn-text-color-declared.txt) 种末位色全部在产物中出现"
else
  echo "❌ 声明取末位但产物没写入的色：$(cat /tmp/rn-text-color-lost.txt | tr '\n' ' ')（触发 doctor CLR030）"
fi
```

**doctor 关联规则**：CLR030（v0.3.10 新增，error），见 pp-doctor §3.6s。

**C. 单位规则(rn 特有)**

- **响应式 rpx() 包装(默认启用)**:config `unit.responsive.enabled === true` 时,以下"像素属性"必须用 `<helperName>(数值)` 包装(见 `unit.responsive.helperName`,默认 `rpx`),从 `unit.responsive.helperImport` 引入(默认 `@/utils/rpx`)。**非像素属性**保持原始数值,不得包装。
- 关闭响应式(`unit.responsive.enabled === false`)时,所有值都直接写数字。
- 所有数值先经 `figmaValue * unit.scale` 得到基准值(rn 分支下 `scale=1`,值就是 figma 原值),再判断是否走 `<helperName>()` 包装。
- `unit.outputUnit` 在 rn 侧固定为 `'px'`(表示"数字模式",实际输出的是"密度无关像素" DP,与 web px 语义不同但数值可直接用)。写 StyleSheet 时**不带 `'px'` 字符串**,RN 只认数字。
- 若 config 里 `unit.outputUnit === 'vw'` / `'rem'` → 强制退化到 `'px'`(数字)+ QA info 告警。

**C.1 rpx() 包装白名单**(启用响应式时的强制规则)

**必须包装**(视为"像素属性",按屏宽线性缩放):

| 属性组 | 具体字段 |
|-------|---------|
| 尺寸 | `width` / `height` / `minWidth` / `minHeight` / `maxWidth` / `maxHeight` |
| 定位 | `top` / `left` / `right` / `bottom` |
| 间距 | `padding` / `paddingHorizontal` / `paddingVertical` / `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` |
| 间距 | `margin` / `marginHorizontal` / `marginVertical` / `marginTop` / `marginRight` / `marginBottom` / `marginLeft` |
| flex 间距 | `gap` / `rowGap` / `columnGap` |
| 边框 | `borderRadius` / `borderTopLeftRadius` / `borderTopRightRadius` / `borderBottomLeftRadius` / `borderBottomRightRadius` / `borderWidth` / `borderTopWidth` / `borderRightWidth` / `borderBottomWidth` / `borderLeftWidth` |
| 文字 | `fontSize` / `lineHeight` / `letterSpacing` |
| 阴影 | `shadowRadius` / `elevation` / `shadowOffset.width` / `shadowOffset.height` |
| transform | `translateX` / `translateY`(数值型,不含 `%` 字符串) |

**禁止包装**(视为"非像素属性",保持原样):

| 属性组 | 具体字段 | 理由 |
|-------|---------|------|
| 透明度 | `opacity` / `shadowOpacity` | 0-1 比例 |
| 布局系数 | `flex` / `flexGrow` / `flexShrink` / `flexBasis`(数值 0-1) / `zIndex` | 布局系数 |
| 颜色 | `color` / `backgroundColor` / `borderColor` / `shadowColor` / `tintColor` | 颜色 |
| 字重 | `fontWeight`(字符串如 `'500'`) | 字重字符串 |
| 枚举 | `flexDirection` / `justifyContent` / `alignItems` / `alignSelf` / `flexWrap` / `position` / `textAlign` / `textAlignVertical` / `overflow` / `resizeMode` / `display` | 枚举字符串 |
| 百分比 / auto | 任何字符串型值(如 `'100%'` / `'auto'` / `'50%'`) | 已经是响应式表达 |
| Dimensions API | `Dimensions.get('window').width` / `.height` 及其计算 | 已经是屏幕相关 |
| transform matrix | `scale` / `scaleX` / `scaleY` / `rotate` / `skewX` / `skewY` | 变换系数或角度 |

**判定优先级**:同一字段先查"禁止包装"表,命中 → 保留原样;否则查"必须包装"表,命中 → 用 `<helperName>()` 包装;都不命中 → 保留原样 + QA info 告警"字段 X 未在响应式白名单,已保留原始值,请人工核对是否遗漏"。

**C.2 生成形态对比**

同一 Figma 节点(`paddingLeft: 16`, `fontSize: 14`, `opacity: 0.8`):

```js
// 响应式禁用(unit.responsive.enabled === false)
foo: { paddingLeft: 16, fontSize: 14, opacity: 0.8 }

// 响应式启用(默认)
import { rpx } from '@/utils/rpx'
// ...
foo: { paddingLeft: rpx(16), fontSize: rpx(14), opacity: 0.8 }
//     ~~~~~~~~~~~~~~~~~~~~  ~~~~~~~~~~~~~~~~   ~~~~~~~~~~~
//     像素属性,包装         像素属性,包装      非像素属性,不动
```

**D. 完整示例**

Figma 节点:

```json
{ "layoutMode": "HORIZONTAL", "paddingLeft": 16, "paddingRight": 16, "paddingTop": 12, "paddingBottom": 12,
  "counterAxisAlignItems": "CENTER", "itemSpacing": 8, "cornerRadius": 8,
  "fills": [{ "type": "SOLID", "color": { "r": 0.036, "g": 0.734, "b": 0.028 } }] }
```

h5 SKILL 输出(参考,不在本 SKILL 生效):

```css
.btnLogin { display: flex; flex-direction: row; padding: 24px 32px; gap: 16px;
  align-items: center; border-radius: 16px; background-color: #09bb07; }
```

**rn SKILL 输出**(本 SKILL 主流程,响应式启用时,`figmaBase=375`):

```js
import { rpx } from '@/utils/rpx'
// ...
btnLogin: { flexDirection: 'row', paddingLeft: rpx(16), paddingRight: rpx(16), paddingTop: rpx(12), paddingBottom: rpx(12),
  gap: rpx(8), alignItems: 'center', borderRadius: rpx(8), backgroundColor: '#09bb07' }
```

> 说明:`flexDirection` / `alignItems` / `backgroundColor` 是"非像素属性",不包装。`figmaValue * unit.scale`(此处 scale=1)后再传给 rpx()。响应式关闭时,`rpx(N)` 全部退化为纯数字 `N`。

#### 4.2 隐藏图层处理

**在解析任何图层之前，先检查图层的可见性**：

- Figma 中设置为**隐藏**（`visible: false`）的图层 → 直接跳过，不生成任何代码
- 隐藏图层的所有子图层一并跳过，无论子图层是否可见

> 这包括设计师用于备选方案、模板、草稿的隐藏图层，以及任何临时隐藏的元素。

#### 4.3 图层解析规则

前缀值从 config `layers` 读取，未配置时使用括号内默认值。

**解析方式：多前缀组合**

图层名从左到右扫描，提取所有已知前缀，每个前缀贡献独立语义，组合生效。例如：
- `btn-img-hero` → 可点击容器 + 内容为图片
- `sub-btn-img-hero` → 分块边界（步骤 2 用）+ 可点击容器 + 内容为图片

**前缀语义表**

| 前缀 | 语义 | 对生成代码的影响 |
|------|------|----------------|
| `sub-`（`layers.sub`） | 分块边界 | 仅用于步骤 2 分块，不影响渲染 |
| `block-`（`layers.block`） | 独立布局块 | HTML 上作为独立根元素，CSS 类名以块名做命名空间，不与其他块共享样式 |
| `x-`（`layers.ignore`） | 忽略 | 跳过整个图层，不生成任何代码，**优先级最高** |
| `btn-`（`layers.but`） | 可点击区域 | 在内容外包一层可点击容器，不限定组件类型 |
| `img-`（`layers.img`） | 图片内容 | 生成 `<img>` 引用，**不再向内递归**，命中即停止 |
| `bg-`（`layers.bg`） | 背景图 | 将图片设置为**父元素**的 `background-image`，自身不生成独立 HTML 元素，**不再向内递归** |
| `bgc-`（`layers.bgColor`） | 背景纯色 | 将颜色设置为**父元素**的 `background-color`，自身不生成独立 HTML 元素 |
| `scrollx-`（`layers.scrollX`） | 横向滚动容器 | 容器开 `overflow-x: auto`、子元素 `flex-shrink: 0`、隐藏滚动条；**继续递归子层** |
| `scrolly-`（`layers.scrollY`） | 纵向滚动容器 | 容器开 `overflow-y: auto`、隐藏滚动条；**继续递归子层** |
| `fixed-`（`layers.fixed`） | 视口固定定位 | 在当前节点对应的容器上加 `position: fixed`，相对视口定位；top/bottom/left/right 根据 Figma constraints 推断；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加（这三个不生成节点，没法 fixed） |
| `end-`（`layers.end`） | 逆向布局（贴父末端） | 让节点在父 autoLayout 里贴向末端：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。**主线机制**：把该 end- 节点前面的兄弟包成一个 wrapper，父 `justify-content: space-between`，天然把 end- 推到末端；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-` / `input-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加；具体规则见 §4.3 "`end-` 逆向布局规则" 子章节 |
| `input-`（`layers.input`） | 输入框（`<input type="text">`） | 生成语义化 `<input type="text">` 标签而非 `<div>`，取子 TEXT 节点 `characters` 作为 `placeholder`，左侧图标（若存在 vector/img 子）切图作为 `background-image` + `padding-left` 腾位置；**独立前缀**（决定生成什么元素，不是修饰），**不可**与 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加（doctor NAM019/NAM020 error），**可**与 `fixed-` / `end-` / `sub-` 叠加；命中即停止向内递归；具体规则见 §4.3 "`input-` 输入框规则" 子章节 |

**独立裸词规则（v0.3.5 新增）**

图层名与已知前缀的匹配走**三态判定**（whole word 完全匹配，不做子串匹配）：

| 图层名形态 | 判定 | 举例 |
|------------|------|------|
| **完全等于**前缀去掉 `-` 后的裸词 | ✅ 等同该前缀语义（**独立前缀**才允许，见下面白名单） | `bg` = `bg-` / `btn` = `btn-` / `bgc` = `bgc-` / `img` = `img-` / `input` = `input-` |
| **以 `xxx-` 开头**且后面有字符 | ✅ 沿用当前规则 | `bg-header` / `btn-submit` |
| **含前缀词但不是完全裸词**（如 `background` / `bgheader` / `button`） | ❌ 不识别，按普通图层走无前缀兜底 | `background` → 兜底为 `<Image>` 切图 |

**裸词白名单**（仅这些独立/内容前缀允许裸词形式）：`bg` / `bgc` / `btn` / `img` / `input`

**修饰前缀不允许裸词**：`sub` / `block` / `x` / `scrollx` / `scrolly` / `fixed` / `end` 这些前缀必须写 `xxx-...` 完整形式，**不允许**独立裸词。理由:修饰前缀本身不表达"内容/角色",脱离被修饰目标没有意义(例如"`sub` 什么?"),语义歧义会诱导 agent 意会。裸词 `sub` / `block` 等一律走无前缀兜底,doctor 会 warn 提示(NAM022)。

**裸词不允许与其他前缀组合**:`sub-bg` / `block-btn` 这类"修饰前缀 + 裸词"命名一律**报错**(doctor NAM023)。要组合就写完整语义 `sub-bg-{purpose}` / `block-btn-{purpose}`——单裸词只服务"就这一个背景/按钮"的直觉命名场景,一旦要组合,已经离开"设计师自然命名"的语境,必须写规范。

**filename 派生规则**(裸词没有"后缀部分"可用做 filename,需要从上下文派生):

| 裸词 | filename 派生 |
|------|--------------|
| `bg` | `{父节点 name 或 clean-id}-bg.png` |
| `btn` | `{子内容主 name 或 clean-id}-btn.{ext}`(btn 里通常含 img 子层,取其 name;无则用 clean-id) |
| `img` | `{父节点 name 或 clean-id}-img.{ext}`(父命名兜底) |
| `bgc` | 无 filename(`bgc-` 本来就不切图,只取 fills/strokes/effects 色值) |
| `input` | `{父节点 name 或 clean-id}-input`(复用当前 input 规则) |

`clean-id` 定义:nodeId 去冒号(例:`189:36862` → `189_36862`),当父名/子名不适合当 filename(含中文特殊字符、空图层名等)时兜底。

**无前缀兜底规则**

| 条件 | 处理 |
|------|------|
| 图层类型为 TEXT | 生成文字节点 |
| 其他所有情况 | 生成 `<img>` 引用，不再向内递归 |

**组合优先级**

1. 含 `x-` → 直接跳过，其余前缀无效
2. 含 `img-` → 生成 `<img>`，**立即停止**，不再处理任何子图层（无论子图层有什么前缀）
3. 含 `bg-` → 将图片写入父元素 `background-image`，自身不生成 HTML，**不递归**
4. 含 `bgc-` → 将颜色写入父元素 `background-color`，自身不生成 HTML
5. 提取 `btn-` → 记录"需要包可点击容器"
6. 提取 `scrollx-` / `scrolly-` → 记录"需要包滚动容器"（容器层级；继续递归子层）
7. 无内容前缀 → 走兜底规则
8. **父容器盒级装饰兜底（v0.3.6 新增，默认开）**：任何会生成 View 容器的节点（含 `btn-` / `sub-` / `block-` / 无前缀 FRAME/GROUP），若命中 §4.3「父容器盒级装饰兜底判定」→ 直接把节点自身的 fills/strokes/cornerRadius/effects 按 §4.1.1 RN 映射（`backgroundColor` / `borderRadius` / `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius` / `elevation`）写到**当前 View 的 style**；**不切图**、**不要求 `bg-` 子层**
9. 若有 `btn-`，将渲染结果包裹在可点击容器内（`Pressable` / `TouchableOpacity`，若第 8 步已命中 → 容器 style 已含背景/圆角/投影，不必再建 `bg-*` 子层）
10. 若有 `scrollx-` / `scrolly-`，给当前容器加 overflow 样式（**不新增 wrapper**，直接作用在当前节点对应的容器上）
11. 若有 `fixed-`，在最终容器上加 `position: fixed` + 根据 Figma constraints 推断 top/bottom/left/right（详见下文 **`fixed-` 定位规则**）

**`bg-` 的额外规则**

- 一个父元素下只应有**一个** `bg-` 子图层，多个时取第一个，其余忽略
- `bg-` 图层的**高度不代表父元素高度**，父元素高度由其他内容决定
- `bg-` 与 `bgc-` 可同时存在，`bgc-` 作为背景色兜底，`bg-` 作为背景图覆盖
- **切图源 nodeId 是 `bg-` 节点本身，不是父容器**

**`bg-` 切图源约束**：

`bg-` 切图时调用 Figma REST API 的 nodeId **必须是该 `bg-` 节点自己的 nodeId**，**不允许**用父容器的 nodeId 当切图源。

| 情况 | ❌ 错误做法 | ✅ 正确做法 |
|------|-----------|------------|
| 父 `card` 含 `bgc-选中框` + `bg-bg` + 其他文本/图层 | 把整个 `card` 节点切成 `card-bg.png`，导致 `bgc-` 颜色、`bg-` 装饰、其他内容融合到一张图里 | 切 `bg-bg` 节点本身（nodeId = 69:1946）→ `bg.png`；`bgc-选中框` 取 fill 色值写 `background-color`；文本/图层独立处理 |
| 父 `body` 含 `bg-body` + 主内容 | 把 `body` 父节点整张切下当全屏背景 | 切 `bg-body` 节点本身 |

**为什么会错**：sub-agent 看到 `bg-` 命中"整体导出图片"，**误以为"整体"指的是包括兄弟节点的整个父容器**——其实"整体"指的是**`bg-` 节点自己 + 它的子树**（`bg-` 不再向内递归，但 `bg-` 自身的子树会被一起 render 成位图）。父容器和兄弟节点（`bgc-` / 其他 `block-` / 文本）**绝不**参与切图。

**反向自检 4 行**（sub-agent 切 `bg-` 类图片前必须输出）：

```
· 切图源 nodeId：{bgNodeId}（必须是带 bg- 前缀的节点自己，不是父容器）
· 切图源 name：{bgNodeName}（必须以 bg- 开头）
· 父容器内是否还有 bgc-？{是/否}；若是 → bgc- 取 fill 色值单独写 background-color，不参与切图
· 父容器内是否还有其他 sub-/block-/img-/btn-/文本？{是/否}；若是 → 它们独立处理，不参与切图
```

任意一项答错即停下重做——这是 `card-bg.png` 这类 bug 的唯一防线。

**父容器盒级装饰兜底判定（v0.3.6 新增，默认开）**：

对任何会生成 View 容器的节点（含 `btn-` / `sub-` / `block-` / 无前缀 FRAME/GROUP）执行判定；命中 → **不切图**，把节点自身的 fills/strokes/cornerRadius/effects 按 §4.1.1 RN 字段映射写到 **View 的 style**。

| 检查项 | 命中条件 |
|-------|---------|
| 前缀 | 不含 `img-` / `bg-` / `x-` |
| fills | 空 / 单层或多层 SOLID / 单层 GRADIENT_LINEAR / GRADIENT_RADIAL；**不允许任何一层是 IMAGE** |
| strokes | 空 / 单层 SOLID |
| effects | 空 / 全部是 DROP_SHADOW / INNER_SHADOW / LAYER_BLUR |
| cornerRadius / rectangleCornerRadii | 任意值（含 0） |
| 子树 | 不含 BOOLEAN_OPERATION / VECTOR / MASK / ELLIPSE 复合形状；不含内层 `img-`/`bg-` 命中的位图节点 |

**RN 特殊处理**：

- **纯色 fills**：`backgroundColor: '#xxx'`（原生支持）
- **单层 GRADIENT_LINEAR / GRADIENT_RADIAL**：RN 无原生渐变，必须引入 `react-native-linear-gradient`（`import LinearGradient from 'react-native-linear-gradient'`），生成 `<LinearGradient colors={['#a', '#b']} start={{x:0,y:0}} end={{x:1,y:0}} style={...}>` 包裹原 View 内容；同时在 assets.txt / QA 段落输出退化告警："命中渐变父容器，需 `npm install react-native-linear-gradient` 并 iOS `pod install` / Android `gradle sync`"
- **strokes INSIDE**：`borderWidth` + `borderColor`（RN 只支持 INSIDE 语义）
- **strokes OUTSIDE / CENTER**：RN 无 outline，退化为 `borderWidth` + QA 告警"设计使用 OUTSIDE stroke，RN 退化为 INSIDE，可能有 1-2px 视觉偏差"
- **DROP_SHADOW**：iOS 用 `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius`；Android 用 `elevation`。**两个必须同时写**才能双端一致
- **INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR**：RN 无原生支持 → 退化告警，不生成
- **cornerRadius**：`borderRadius` 单值 / `borderTopLeftRadius` 等四角分别

**反向自检 3 行**（sub-agent 处理此类容器节点前必须输出）：

```
· 节点前缀：{prefixes}（非 img-/bg-/x- 才可能命中）
· fills/strokes/effects/子树是否纯净？{是/否}（对照 5 项条件逐一勾选）
· 走 style 还是切图？{style / 切图}（命中 → style；若含渐变，还需引 LinearGradient + QA 告警）
```

**`btn-` 内嵌 TEXT 双写防护（v0.3.6 新增）**：

- **`btn-` 命中兜底** → 内部 TEXT 正常出 `<Text>` + 字色走 §4.1.1 「TEXT 多层 fills 处理」
- **`btn-` 未命中兜底（fills 含 IMAGE / 子树含复合形状 → 必须切图为 `<Image>`）** → 内部 TEXT 默认 `x-` 忽略，避免图字 + `<Text>` 双写（doctor NAM024 error）
- **例外**：设计师给内部 TEXT 加了独立前缀（如塞在 `sub-` 里）→ 按前缀语义正常处理

**`bgc-` 取值规则**：

`bgc-` **绝对不切图**，永远只取**节点自身的盒级 CSS 属性**写到父元素。`bgc-` 节点本身不生成独立 HTML，它只是个"父元素 CSS 装饰描述符"。

**取值流程**：

1. 用 `figma.mjs fetch-node <fileKey> <bgcNodeId>` 拿节点完整属性（脚本自动查/写缓存）
2. 按以下表逐项映射到父元素 CSS：

| Figma 属性 | CSS 属性 | 说明 |
|-----------|---------|------|
| `fills[*].type === 'SOLID'` | `background-color: #xxx` | 取 HEX |
| `fills[*].type === 'GRADIENT_LINEAR'` / `'GRADIENT_RADIAL'` | `background-image: linear-gradient(...)` / `radial-gradient(...)` | gradient 必须用 background-image，不是 background-color |
| `fills[*].type === 'IMAGE'` | 不该出现 | bgc- 是"颜色/渐变"角色，含 IMAGE 应改成 bg-；如果出现 → 报错并提示设计稿改名 |
| 多重 fills | 按 Figma 渲染顺序合成 `background` 复合属性 | |
| `strokes[*].position === 'OUTSIDE'`（含 4px Outside 之类） | **`outline`**：`outline: {weight}px solid #xxx`（gradient stroke 用 `outline-color` 不可——降级为 `box-shadow: 0 0 0 {weight}px ...`） | Outside stroke 不影响盒模型，outline 是最准等价物 |
| `strokes[*].position === 'INSIDE'` | **`border`**：`border: {weight}px solid #xxx` + `box-sizing: border-box` | 占用内部空间 |
| `strokes[*].position === 'CENTER'` | 没有完美对应 | 退化为 `outline` 偏移一半，或在 QA 段落标注让用户决定 |
| `cornerRadius` / `rectangleCornerRadii` | `border-radius` | 单值或四角分别 |
| `effects[*].type === 'DROP_SHADOW'` | `box-shadow` | offset/radius/color 全套对应 |
| `effects[*].type === 'INNER_SHADOW'` | `box-shadow: inset ...` | |
| `effects[*].type === 'LAYER_BLUR'` | `filter: blur(Xpx)` | 注意是 filter 不是 backdrop-filter |
| `effects[*].type === 'BACKGROUND_BLUR'` | `backdrop-filter: blur(Xpx)` | |

3. 所有上述 CSS 属性都写到 **`bgc-` 的父元素**（不是 bgc- 节点自身——bgc- 不生成独立 HTML 元素）

**为什么  要扩展 bgc- 范围**：之前规则只让 bgc- 处理 fills，导致设计师把"渐变填充 + 4px 描边 + 圆角 + box-shadow"理解为"一个 bgc-"是合理的（这就是一个父级 box 的全套装饰），但生成端只写了 fills，描边/圆角/阴影全丢。**bgc- 现在覆盖父级 box 的所有非内容 CSS 属性**。

**`bg-` 内嵌 `bgc-` 的处理**：

切 `bg-` 之前，sub-agent **必须**扫描 `bg-` 节点的子树，查找**直接子孙**里是否有 `bgc-` 节点（递归全部子孙，不止直接子层）：

| 子树 bgc- 数量 | 处理方式 |
|--------------|---------|
| **0 个**（推荐结构） | 正常切 bg-，按"`bg-` 切图前的 CSS-able 自检"流程走 |
| **1 个** | **必须把这个 bgc- "摘出来"**——按上面 bgc- 取值规则把它的 fills/strokes/cornerRadius/effects 写到 **`bg-` 的父元素**；bg- 子树其他装饰节点（Subtract / Mask group / 其他形状）**不再单独解析**，随 bg- 整体切图（这是 Figma `/v1/images` API 限制，无法切图时排除子节点）。**输出告警**："`bgc-{name}` 嵌在 `bg-{name}` 子树内，结构不规范，建议设计稿把它改成 bg- 的兄弟节点（位于 bg- 父元素的同级）" |
| **≥ 2 个** | **错误结构**（违反"一个父元素最多 1 个 bgc-"的 CSS 限制）。**取第一个** bgc- 按上述处理，其余忽略，**输出 error 级告警**指出额外的 bgc- 节点 |

**bg- 兄弟有 bgc- 的优先级**：

如果 `bg-` 节点的**兄弟节点**也有 `bgc-`（即 bg- 父元素的另一个直接子层），**兄弟 bgc- 优先**：

- 兄弟 bgc- 走正常 bgc- 流程，把属性写到**父元素**（bg- 的父元素）
- bg- 子树内嵌的 bgc-（如果存在）**不再单独取值**——位图里它的视觉是 bg- 切图的物理副产物，CSS 端不重复声明（避免和兄弟 bgc- 的 CSS 属性打架）
- doctor 仍 warn 提示嵌套那个 bgc- 应改成兄弟关系

**禁止做法**：

- ❌ 把 `bgc-` 节点切成 PNG（永远只取属性写 CSS）
- ❌ 把 `bgc-` + `bg-` 视觉融合到一张切图里（颜色/描边/阴影烤进位图后无法修改 / 主题切换失效）
- ❌ 把 `bgc-` 节点的 nodeId 传给 `/v1/images` API
- ❌ 父容器同时有 `bgc-` 和 `bg-` 时，**只**写 `background-image` 不写 `background-color`/`outline`/`box-shadow` 等其他 bgc- 属性
- ❌ `bgc-` 节点的属性只取 fills（必须取齐 fills/strokes/cornerRadius/effects 全套盒级属性）
- ❌ sub-agent 切 `bg-` 时跳过子树 bgc- 扫描——这是切图前自检的强制延伸

**`bg-` 切图前的"CSS-able 自检"**：

切 `bg-` 之前，sub-agent **必须**先用 `figma.mjs fetch-node <fileKey> <bgNodeId>` 拿该节点的 `fills` / `strokes` / `effects` / `cornerRadius`，然后判断**这个节点是不是其实更适合用 CSS 实现**（即应该改成 `bgc-`）。

判断标准：

| 节点属性组合 | 判定 | 行动 |
|------------|------|------|
| `fills` 全是 SOLID 颜色 / 单层 GRADIENT_LINEAR / 单层 GRADIENT_RADIAL，**且** `strokes` 为空或 SOLID，**且** `effects` 为空或单一 DROP_SHADOW，**且**子树内**只有自己**（无嵌套形状/位图） | **该节点 CSS 完全可表达** | **不切图**，输出告警（见下），按 `bgc-` 规则处理：fills 写 `background-color` / `background-image: linear-gradient(...)`，strokes 写 `border`，effects 写 `box-shadow`，cornerRadius 写 `border-radius` |
| `fills` 含 IMAGE 类型（位图） / 多层渐变叠加 / 子树内含其他形状（boolean-operation / vector / mask） | CSS 表达不了 | 走 `bg-` 切图正常流程 |
| 介于两者之间（例如单 GRADIENT + 一个 inner-shadow + 一个 outer-shadow） | 边缘场景 | 切图走正常流程，但在 QA 段落记录"该节点接近 CSS-able 边界，可考虑设计稿改 `bgc-`" |

**告警输出格式**（CSS-able 命中时强制输出，不能省略）：

```
⚠️ bg- 节点 CSS-able 检测命中
   节点: {bgNodeName} ({bgNodeId})
   原因: fills={SOLID/GRADIENT_LINEAR}, strokes={...}, effects={DROP_SHADOW}, 子树纯净
   行动: 跳过切图，按 bgc- 规则用 CSS 实现（gradient + shadow + border-radius）
   建议: 设计稿里把 {bgNodeName} 改成 bgc-{kebab(name)}，下次跑生成更高效
```

**为什么要这一步**：位图渲染的渐变会因缩放产生 banding（视觉劣化），渐变 + 阴影外扩还会让切出来的 PNG 边缘"沾染"看起来像画板底色泄漏（实际是渐变浅色端 + 描边在圆角处的混合）。这种节点应该走 CSS——CSS 渐变在所有缩放下都是矢量级清晰，且支持运行时主题切换。

**判定的实操步骤**：

1. `figma.mjs fetch-node <fileKey> <bgNodeId>` 拿节点完整 JSON（脚本自动查/写缓存）
2. 检查 `fills`：所有 fill 的 `type` 必须 ∈ `{SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL}`，且无 IMAGE
3. 检查 `strokes`：要么空，要么所有 stroke 的 `type` 是 SOLID
4. 检查 `effects`：要么空，要么只有 1 个 DROP_SHADOW（INNER_SHADOW、LAYER_BLUR、BACKGROUND_BLUR 都让节点 CSS-unable）
5. 检查子树（`node.children[]` 列表）：当前节点必须**没有可见子节点**（boolean-operation / vector / 子 frame 等），或子节点都是隐藏的
6. 全部通过 → 命中 CSS-able，输出告警，按 `bgc-` 规则处理；任一不通过 → 正常切图

**`scrollx-` / `scrolly-` 的额外规则**

- 同一节点**只能含一个滚动方向**：同时含 `scrollx-` 和 `scrolly-` → error，按 `scrollx-` 处理并在 QA 中标注
- 与 `img-` / `bg-` / `bgc-` / `x-` 互斥（不递归类前缀本来也不需要滚动）
- 与 `btn-` 互斥（滚动容器整体可点击会冲突）
- **生成的容器样式**（横向示例，纵向把 x/y 调换即可）：
  ```scss
  .<class> {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;  // iOS 惯性滚动
    scrollbar-width: none;              // Firefox 隐藏滚动条
    &::-webkit-scrollbar { display: none; } // Webkit 隐藏滚动条
    > * { flex-shrink: 0; }             // 子项禁止压缩
  }
  ```
- **前置条件**：容器必须有"被限定的宽度"（横向）或"被限定的高度"（纵向），否则 overflow 不会触发。Figma 中宽/高模式 = "Hug Contents" 或 fill 100% 父宽（且父也未限宽）时**仍生成代码**，但在 QA / doctor 中标注：「`scrollx-` 容器宽度不固定，运行时滚动可能不触发」。
- **强制递归生成 DOM 列表项**（不允许整体导出走 `background-image` 偷懒）：sub-agent 在生成 `scrollx-` / `scrolly-` 容器代码前，必须先输出**自检 4 行**：
  ```
  · 子层数：{N} 个可见子节点
  · 同构判断：{是否存在 ≥ 2 个同名 / 同结构子层} → {是 = 列表项需 .map 渲染 / 否 = 异构内容逐个生成}
  · 背景层来源：{bgc- 子节点 / bg- 子节点 / 父层 fills / 无} → 不允许"无来源时 fallback 整体导出"
  · 内部 DOM 节点数（不含背景）：{M}（M 必须 ≥ N，否则说明把列表项压平了，回头重写）
  ```
  自检中任意一项无法明确填写时，**先停下问主 agent**，不允许猜测后整体导出。这是质量保证，不是性能优化——错误的整体导出会让"列表渲染"退化为"一张静态图片背景"，运行时无法绑定数据。

**布局规则：每 Frame 独立走判定优先级 + 间距单一来源**

**判定优先级**（每个 Frame 节点**独立按顺序判定**，命中一条即用该分支，不再往下走）：

**判定角度说明**：判定分为**子视角**（当前节点在父容器里的定位方式）和**父视角**（当前节点自己内部子代的排布方式）。**子视角先于父视角**——因为 CSS 里 `position` / `top` / `left` 决定该元素相对父的位置，`display: flex` 决定其内部子代的排布，两者互不冲突可共存。

0. **`node.layoutPositioning === 'ABSOLUTE'`**（子视角；补丁）
   → 该节点在父 autoLayout 里**脱离顺流**，CSS 写 `position: absolute` + `top` / `left`（值 = `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` × scale）
   → **父容器必须加** `position: relative`（若父本来是 flex，`relative` 与 flex 可以共存，不影响 flex 顺流的其他兄弟）
   → 该节点自身**内部**如何布局，接着走下面第 1-5 条判定（子视角处理完，接着处理父视角）
   → **触发场景通用**：设计师在 Figma 属性面板勾选"Absolute position"的任何节点都会返 `ABSOLUTE`——不限前缀。常见场景：`bg-` 背景层要铺满、`fixed-` 状态栏、卡片角标、悬浮徽章、需要精确定位的装饰元素
   → **优先级**：若节点前缀是 `fixed-`（判定优先级第 2 条），CSS 用 `position: fixed`（不是 `absolute`），走各自 constraints 规则；`fixed-` 优先于本条

1. **`node.layoutMode ∈ {HORIZONTAL, VERTICAL}`**（父视角；Figma autoLayout）
   → **强制** `display: flex`，其余字段严格按 §4.1.1 §A 表映射（`flex-direction` / `gap` / `padding-*` / `justify-content` / `align-items` / `flex-wrap`）
   → **禁止**对该 Frame 用 `position: absolute` + `top/left`；子代不写任何 `margin-*`（间距由父的 `gap` / `padding-*` 唯一负责）
   → 违反此条 = §6.0 验收不合格，回退整块 sub-agent 重写

   > **边界：父层 `layoutMode` 是 autoLayout，但子层里混有 `fixed-` 前缀节点时怎么办？**
   >
   > `fixed-` 子层在 Figma JSON 里作为父 autoLayout 的顺流子节点存在（占 flex 顺流的一个"位置"），但在 CSS 里 `position: fixed` 会让它脱离文档流。**父容器仍然走 flex，不因此回退到 absolute**——CSS 的 `position: fixed` 子元素会**自动**从父的 flex 排布中脱出，不占位置、不参与 gap 分配，跟"该子元素不存在"效果等价。
   >
   > 正确写法（父 = flex column，子层 statusBar 是 fixed-）：
   >
   > ```scss
   > .root {
   >   display: flex;              /* 父 layoutMode 是 VERTICAL */
   >   flex-direction: column;
   >   gap: 20px;
   >   padding: 0;
   > }
   > .statusBar {                  /* fixed- 子层 */
   >   position: fixed;            /* 自动脱离父 flex 顺流 */
   >   top: 100px; left: 22px;
   >   /* 不影响 .notify / .mainWrap 的顺流位置 */
   > }
   > .notify, .mainWrap {          /* 其余顺流子层 */
   >   /* 内部按各自 layoutMode 走本判定树，不写任何 top/left */
   > }
   > ```
   >
   > **错误写法（本次 修订前的典型 bug）**：父 layoutMode 明明是 autoLayout，因看到子层混有 fixed- 兄弟就把父写成 `relative` + 其他子层全部 `absolute + top/left`。这**同时违反**判定优先级第 1 条 和 §6.0 checklist 第 3 项（absolute + padding 冲突）。

2. **前缀是 `fixed-`**
   → `position: fixed`，走本节下方"`fixed-` 定位规则"（`constraints` → `top/right/bottom/left`）

3. **前缀是 `bg-` / `sub-` / `scrollx-` / `scrolly-` / `bgc-` / `x-` / `img-` / `btn-`**
   → 按各前缀在 §4.3 的专属规则处理，不走本决策树

4. **`layoutMode` 缺失 / `NONE`，且子节点坐标（`absoluteBoundingBox`）存在重叠**
   → `position: relative` (父) + `position: absolute` + `top` / `left` (子)，坐标按 §4.5 单位换算
   → 典型场景：切图 + DOM 叠加层（如 `img-card` 上叠 `Frame 263` 表单）

5. **`layoutMode` 缺失 / `NONE`，子节点坐标无重叠、顺流排布**
   → 允许两种写法，二选一：
     - **推荐**（简单堆叠、纯文字段落）：父 `padding-*` + 子代 `margin-{top|bottom}`（顺流轴向）+ `:last-child { margin-*: 0 }` 收尾
     - **兜底**（结构较复杂、需要精确对齐）：`display: flex` + `flex-direction` 推断 + `gap`（父负责间距）
   → **禁止**同时用两套（父 `gap` + 子 `margin-*` 混合）

6. **页面根容器**

   > **rn 分支不走本条覆写规则**——rn 侧顶层入口节点一律套用 §2.5「页面根骨架」的强制 ScrollView 结构(根 `<View>` flex:1 + 内部 `<ScrollView>` + `scrollContent` 用 `minHeight`),不做"高度是否接近视口"的判定,不写 `Dimensions.get('window').height`。本条完整保留仅供 h5 SKILL 参考(rn 侧忽略)。

   判定"当前节点是页面根容器"—— **三信号 AND，缺一不成立**：

   - 信号 A：**该节点是 sub-agent（或主 agent）此次流程入口的 nodeId 本身**（不是它的孙子）。等价说法：处理的是 `fetchNode` 的目标节点，不是子树里更深的节点
   - 信号 B：**父不是普通 Frame**——`figma.mjs fetch-node` 拿目标节点时父信息通常缺失，或者查到父的 `type` 是 `PAGE` / `DOCUMENT` / `CANVAS`。**换句话说，这个节点就是用户 URL `node-id` 参数指向的那一层**
   - 信号 C：**高度接近视口常见值**——`absoluteBoundingBox.height` ∈ `[647..687, 716..756, 792..832, 824..864, 876..916, 906..946, 912..952, 1004..1044]`（分别对应 iPhone SE 667、iPhone 8+ 736、iPhone X 812、iPhone 14 844、iPhone 11 Pro Max 896、iPhone 14 Pro 926、iPhone 14 Pro Max 932、iPad 竖版 1024，允许 ±20 容差）

   **三条都命中** → 该节点是"页面根容器"，走本条覆写规则：

   ```scss
   .root {
     /* 保留判定优先级 1-5 已生成的 CSS(display: flex / gap / padding / align-items ...) */
     /* 覆写高度相关字段 */
     min-height: max({figmaH * scale}px, 100vh);   /* 至少设计稿基准高度，视口更大时撑到 100vh */
     /* 不写 height */
     width: {figmaW * scale}px;                     /* 宽度保留死值（移动端画布宽度设计上就是恒定的） */
     margin: 0 auto;
     /* 若已存在 position: relative（判定 4 触发）保留；否则加上 position: relative */
     position: relative;
   }
   ```

   **额外副作用（一并覆写）**：该根容器内部**直接子**如果 `layoutPositioning: ABSOLUTE` 且尺寸也是 `FIXED`（典型是全屏背景 `bg-`），把 `height: {h}px` 一并覆写为 `height: 100%`，让背景跟着根容器撑：

   ```scss
   .root__bg {
     position: absolute;
     inset: 0;                                       /* 或 top:0 left:0 width:100% height:100% */
     background-size: cover;                         /* 从 background-size: {w}px {h}px 改为 cover */
     background-position: top center;
     z-index: 0;
   }
   ```

   **为什么放在第 6 条而不是第 1 条**：本条是"页面根覆写"，不改变前面 1-5 条对该节点内部结构的判定（该 flex 还是 flex、该 padding 还是 padding、该 space-between 还是 space-between），只覆写该节点自己的高度和背景。所以先走完 1-5 得到基础 CSS，再检查是否是页面根，是则叠加本条覆写。

   **边界与豁免**：
   - **信号 A 不成立**（是 sub-agent 派发的内层 block）：整段跳过。`sub-cardopen` / `Frame 250` 等永远不是根，即使 sub-agent 单独打开处理时它的 nodeId 是"入口"，因为它高度不接近视口值，信号 C 排除
   - **用户 URL 直接指向 sub-frame**（例如 `?node-id=163-2302` 指向 `sub-cardopen`）：信号 A 命中，但信号 C（高度 794px 不在视口列表容差内）排除 → 走普通 FIXED 规则
   - **设计稿高度不是标准视口尺寸**（例如设计师画了 375×2000 长图）：信号 C 排除 → 走普通 FIXED 规则（长图页面本身就该有 2000px 死高度，滚动查看）
   - **`html, body` 全局兜底**：本 SKILL 不涉及全局样式；用户如果发现 iOS Safari 上 `100vh` 计算异常（含底部 tab bar），需要在项目全局 CSS 里加 `html, body { height: 100%; margin: 0 }`——这不是 SKILL 职责，doctor 也不检查

**间距单一来源铁律**（每一段间距只能有一个 owner；三条铁律，任一违反 = §6.0 回退）：

- **兄弟间距**：父容器负责。用 flex 就是 `gap`；用 block 就是子代 `margin-*`。**同一父级下二选一，禁止混用**。
- **容器内边距**：只写 `padding-*` 在该容器上。**禁止**用 `:first-child { margin-top }` / `:last-child { margin-bottom }` 去凑容器边距。
- **绝对定位下无 margin**：`position: absolute` / `fixed` 的元素**禁止**同时写 `margin-*`（`margin: auto` 用于居中除外）；位置由 `top` / `right` / `bottom` / `left` 唯一表达。

> **选 flex 还是 block+margin？**
> - Figma 里父 Frame 是 autoLayout（`layoutMode` 非空）→ 无条件 flex。这是 §4.1.1 §A 表的直接翻译，不做推断。
> - Figma 里父 Frame 不是 autoLayout → 看子节点关系：重叠 → absolute；顺流简单堆叠（如"标题 + 一段说明 + 一段协议"）→ block+margin；顺流但需对齐控制 → flex 兜底。
> - **选择依据是 Figma 属性（`layoutMode` / 坐标关系），不是图层名前缀**。图层名前缀只在 Figma 属性无法表达 D2C 语义时使用（切图 / 独立组件 / fixed / 跳过节点等，见 §4.3 各前缀章节）。

> `layers.sub`（`sub-`）前缀仅用于步骤 2 的分块判断，sub-agent 拿到的 nodeId 已是该节点本身，内部按上述规则正常解析。

**`fixed-` 定位规则**

`fixed-` 是**定位修饰前缀**——只改 `position` 属性，不决定渲染方式。可与所有"生成节点"的前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-`），不可与"不生成节点"的前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM014 命中后 error）。

**top/bottom/left/right 的取值（依赖 Figma `constraints`）**：

1. `figma.mjs fetch-node <fileKey> <fixedNodeId>` 拿节点属性，读 `node.constraints = {horizontal, vertical}`
2. 按下表把 Figma 坐标换算成 CSS 定位（换算遵循步骤 4.5 单位换算规则）：

| Figma constraint | CSS 写法 | 取值来源 |
|------------------|---------|---------|
| `vertical: 'TOP'` | `top: <figma top>px` | 节点 `absoluteBoundingBox.y` |
| `vertical: 'BOTTOM'` | `bottom: <viewport.h - figma bottom>px` | viewport 用顶层 frame 高度近似 |
| `vertical: 'CENTER'` | `top: 50%; transform: translateY(-50%)` | — |
| `vertical: 'TOP_BOTTOM'` / `SCALE` | 退化为 `top: <figma top>px` + QA 告警 | constraints 表达不了 fixed 语义 |
| `horizontal: 'LEFT'` | `left: <figma left>px` | 节点 `absoluteBoundingBox.x` |
| `horizontal: 'RIGHT'` | `right: <viewport.w - figma right>px` | viewport.w = `unit.figmaBase`（默认 375） |
| `horizontal: 'CENTER'` | `left: 50%; transform: translateX(-50%)` | — |
| `horizontal: 'LEFT_RIGHT'` / `SCALE` | 退化为 `left: <figma left>px` + QA 告警 | 同上 |

**示例**：`fixed-btn-back-top`（回顶按钮，Figma 中 constraints = `{vertical: 'BOTTOM', horizontal: 'RIGHT'}`，坐标 right=24 / bottom=120）

```scss
.fixed-btn-back-top {
  position: fixed;
  right: 48px;     // 24 * scale=2
  bottom: 240px;   // 120 * scale=2
  z-index: 100;    // 见下方 z-index 规则
  // ...其他从图层提取的样式
}
```

**z-index**：fixed- 元素默认 `z-index: 100`（高于内容层但低于 PopLayer 等浮层）。同页面多个 fixed- 时按设计稿前后顺序递增（100 / 101 / 102 …），sub-agent 在 QA 段落里标注实际取值。

**祖先 transform 警告**：CSS 规范里祖先元素若有 `transform` / `filter` / `perspective`，子代 `position: fixed` 会退化成相对该祖先定位（不再相对视口）。生成端**不自动用 Portal 外挂**，但 doctor LAY013 会扫描 fixed- 节点的祖先链，命中时 warn 提示设计师/开发把 fixed- 节点上提到根 frame 或祖先去掉 transform。

**Figma 中没设 constraints**：退化为"按 absoluteBoundingBox 算 left/top"，**强制输出 QA 告警**："`fixed-{name}` 未设 Figma constraints，已退化为绝对坐标定位，滚动场景下可能错位，建议设计师补 constraints"。

**`end-` 逆向布局规则**

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM016 命中后 error）。

**触发前提**（缺一不可，任一缺失走 doctor 兜底）：

1. **父 Frame 必须是 autoLayout**（`layoutMode ∈ {HORIZONTAL, VERTICAL}`）。父不是 autoLayout → doctor LAY019 error，"父不是 autoLayout，end- 无方向可判"
2. **`end-` 节点必须是父的最后一个可见子**。出现在中间或第一个 → doctor LAY017 error，"end- 位置不合规"
3. **同一父下只允许一个 `end-` 子**。多个 → doctor LAY018 warn，"只有最后一个 end- 生效，前面的 end- 会被忽略"
4. **不能同时是 `fixed-`**（`fixed-end-x-btn` 这种叠加）。同现 → doctor LAY020 warn，"fixed- 优先，end- 忽略（fixed 已脱离父流）"

**生成机制**（wrapper + `space-between` 主线， 采用）：

假设父 Frame `layoutMode: VERTICAL`，子层顺序是 `[A, B, C, end-D]`（4 个子，最后一个是 end-）。生成结构：

```jsx
<parent>                                        {/* 父容器 */}
  <wrapper-of-front>                            {/* 新增虚拟 wrapper，包 A/B/C */}
    <A /> <B /> <C />
  </wrapper-of-front>
  <D />                                         {/* end- 节点，作为父的第 2 个（也是最后一个）flex 子项 */}
</parent>
```

对应 CSS：

```scss
.parent {
  display: flex;
  flex-direction: column;                       /* 或 row，由父 layoutMode 决定 */
  justify-content: space-between;               /* ← 关键：把 wrapper 和 D 分居两端 */
  /* 其余按 §4.1.1 §A 表映射:padding / align-items / gap 不变 */
  /* gap 依然生效于 wrapper 内部；wrapper 与 D 之间的间距由 space-between 决定 */
}
.wrapper-of-front {
  display: flex;
  flex-direction: column;                       /* 继承父方向 */
  gap: ...;                                     /* 沿用父原本的 itemSpacing */
  align-items: ...;                             /* 沿用父原本的 counterAxisAlignItems */
  /* 不需要 flex: 1；wrapper 按内容尺寸,space-between 天然把 D 顶到末端 */
}
```

**父 `HORIZONTAL` 时**：同上把 `column` 换成 `row`，`justify-content: space-between` 语义完全一致（D 会贴到父的右端）。

**如果父原本就有 `primaryAxisAlignItems`**：以 end- 生成的 `justify-content: space-between` **优先**（覆盖原值）；QA 告警："父 `primaryAxisAlignItems: {原值}` 因 end- 触发被覆盖为 `space-between`"。

**如果父原本就是 `SPACE_BETWEEN` 且只有 2 个直接子（`[A, end-B]`）**：wrapper 步骤可以**省略**（因为已经是两个 flex 子项分居两端），直接对 B 保留原生成逻辑；这是主线机制的一个优化短路，不影响正确性。

**wrapper 的 className / data-node-id 处理**：wrapper 是  生成的**虚拟节点**（Figma 里不存在），所以：

- className 用父类名 + `__front-group` 后缀（如父类是 `.card-open`，wrapper 是 `.card-open__front-group`）
- **不写** `data-node-id`（因为对应不到任何 Figma 节点，写了会误导反查）
- SCSS 里 wrapper 段紧跟父段书写，视觉上一眼能看出这是 end- 触发的虚拟包裹

**用哪个 CSS 长度容器？**`space-between` 生效需要**父容器有确定的主轴长度**（或 `min-height: 100vh`），否则 wrapper 和 end- 会挤在一起。**若父的 `layoutSizingVertical: HUG`（vertical 场景下）或 `layoutSizingHorizontal: HUG`（horizontal 场景下）**，agent **强制输出 QA 告警**："end- 触发 space-between 布局，但父容器主轴是 HUG（内容撑开），会导致 end- 无法真正贴末端；建议父容器改为 FIXED / FILL，或者根容器加 `min-height: 100vh`"。

**`input-` 输入框规则**

`input-` 是**独立前缀**（决定生成什么元素，不是修饰）。命中即输出 `<input type="text">` 标签，**不再向内递归**（子层的 TEXT / vector 都是被 `input-` 节点"消化"用来填 placeholder / icon）。**可**与 `fixed-` / `end-` / `sub-` 叠加（例如 `fixed-input-search`、`end-input-remark`、`sub-input-people`）；**不可**与 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加（doctor NAM019 / NAM020 error）。

**Figma 侧图层结构约定**（设计师参照）：

```
input-{name}   Frame          ← 输入框容器,layoutSizingHorizontal 通常 FIXED/FILL,带 fills:白 + strokes + cornerRadius
  ├─ [vector | RECTANGLE | 子 Frame 里的 vector]   ← 可选,左侧图标,任何非 TEXT 的图形都当图标
  └─ TEXT "请输入..."                              ← 必须有,filles 是 placeholder 颜色,characters 是 placeholder 文本
```

- **placeholder 文本来源**：`input-` 节点子树里第一个可见 `TEXT` 节点的 `characters`
- **placeholder 颜色来源**：该 TEXT 节点的 `fills[0].color`（转 rgba，见 §4.1.1 §B 表）
- **输入框视觉（背景/边框/圆角）来源**：`input-` 节点自己的 `fills` / `strokes` + `strokeWeight` + `cornerRadius`
- **左侧图标来源**：`input-` 节点子树里**除 TEXT 外**的第一个可见节点（VECTOR / RECTANGLE / 内含 vector 的子 Frame 等，任意）。若无图标节点，跳过 `background-image`
- **输入框宽高**：`input-` 节点的 `absoluteBoundingBox.{width, height}` × scale

**生成机制**：

```jsx
<input
  type="text"
  className="{父类名}__input-{clean-name}"
  placeholder="{TEXT.characters}"
  data-node-id="{input-nodeId}"
/>
```

```scss
.{父类名}__input-{clean-name} {
  /* 尺寸：来自 input- 节点 bbox */
  width: {w * scale}px;
  height: {h * scale}px;
  box-sizing: border-box;

  /* 视觉：来自 input- 节点自身 fills/strokes */
  background: {fill.color} {icon 存在时: url('{icon-path}') no-repeat {iconLeftOffset}px center / {iw}px {ih}px};
  border: {strokeWeight * scale}px solid {stroke.color};
  border-radius: {cornerRadius * scale}px;

  /* 内边距：结合图标位置。有图标时 padding-left 从"图标右边缘 + gap"算起 */
  padding: 0 {右侧 padding}px 0 {(iconLeftOffset + iw + gap) * scale}px;
  /* 无图标时 padding-left = Figma padding + 首行 vector 位置的等价距离 */

  /* 字体：读 input- 节点的 TEXT 子节点 style */
  font-family: "{TEXT.style.fontFamily}", sans-serif;
  font-size: {TEXT.style.fontSize * scale}px;
  color: #333;                                     /* 输入文字默认色(可覆盖) */

  /* placeholder 颜色：来自 TEXT.fills */
  &::placeholder { color: {TEXT.fills[0].color}; }
}
```

**图标切图约定**：

- 图标节点作为**独立切图**通过 `figma.mjs export-image` 导出（走 §4.4 流程），文件名建议 `input-{clean-name}-icon.svg`（矢量优先 SVG，位图 PNG 兜底）
- 切图源 nodeId 是**图标节点自己**，不是 `input-` 节点整体
- 导出后作为 `background-image` 挂到 `input-` 节点的 CSS 上，**不生成独立 DOM 节点**（这就是为什么不递归子层）

**类型限定**： 只支持 `<input type="text">`。若设计稿有明显的密码/数字/邮箱语义，agent 可在 QA 告警里提示"建议手工改 `type='password' | 'number' | 'email'`"，不自动推断。textarea / select 场景本版不覆盖，后续按需扩展 `layers.textarea` / `layers.select`。

**doctor 校验**（详见 doctor SKILL §3.6f-i）：

- **NAM017 error**：`input-` 节点子树内**没有可见 TEXT 节点**，placeholder 无来源
- **NAM018 warn**：`input-` 节点子树内**有 ≥2 个可见 TEXT 节点**，只取第一个可见，其他忽略
- **NAM019 error**：`input-` 与 `bg-` / `bgc-` / `x-` 叠加（不生成节点无法挂）
- **NAM020 error**：`input-` 与 `img-` / `btn-` 叠加（语义冲突）

**典型场景**：登录表单（手机号、密码）、订单填写（乘车人姓名、身份证、备注）、搜索框、评论框。

#### 4.3.rn RN 特性退化表(rn SKILL 关键)

**背景**:h5 SKILL 生成的 CSS 特性(fixed / vh / background-image / linear-gradient / filter / overflow / outline / box-shadow)在 RN 端**部分或完全无对应**。rn SKILL 生成时按下表退化,并在末尾 QA 段落输出告警。

| Figma / h5 语义 | 触发条件 | rn 退化策略 | QA 告警级别 |
|-----------------|---------|-----------|-----------|
| `fixed-` 前缀 | 图层名带 `fixed-` | **一律**放 `<ScrollView>` **外**作为根 `<View>` 直接子(RN 无 CSS fixed,ScrollView 内的 absolute 会跟内容滚 → 必须放外);`position: 'absolute'` + zIndex 100+;位置按 constraints 换算:TOP → `top: rpx(<相对顶层 y>)`,BOTTOM → `bottom: rpx(...)`;**agent 不推断"这个 fixed- 是不是本意贴屏"**——只要图层名带前缀就贴屏 | info(rn 侧默认策略) |
| 页面滚动骨架 | 所有 rn 页面 | 顶层入口节点一律套用 §2.5 强制 ScrollView 结构(根 flex:1 + ScrollView + scrollContent minHeight),不判定"高度是否超视口",一律套用 | info |
| `bg-` 背景图 | 图层名带 `bg-` 或 fills 是 IMAGE | 拆成独立 `<Image source={require(...)} style={styles.bgBody} resizeMode="cover" />`,放 `scrollContent` 内头部;**不用 `StyleSheet.absoluteFillObject` 或 `width/height: '100%'`**,而是写 Figma 事实固定尺寸 `width: rpx(w), height: rpx(h)` + `top: 0, left: 0`(避免父 minHeight 时 % 值跟着塌陷);父容器加 `position: 'relative'` | info |
| GRADIENT_LINEAR / GRADIENT_RADIAL | `fills[0].type` 是 GRADIENT_* | **v0.3.6 修订**：命中 §4.3「父容器盒级装饰兜底」时 → 生成 `<LinearGradient>`（`react-native-linear-gradient`）包裹原 View 内容，`colors={[...]}`、`start={{x:0,y:0}}`、`end={{x:1,y:0}}`（或按 gradientHandlePositions 推）；未命中兜底（如 fills 是渐变但节点带 `img-`/`bg-` 前缀走切图） → 走原切图流程 | warn:"命中渐变父容器已使用 `<LinearGradient>`（`react-native-linear-gradient`）表达。请 `npm install react-native-linear-gradient` 并 iOS `pod install` / Android `gradle sync`。裸 RN / Expo 用户可能需要选择对应发行版" |
| `overflow: scroll` 容器 | `scrollx-` / `scrolly-` 前缀 | 标签强制换 `<ScrollView>`,加 `horizontal={true}`(scrollx)或不加(scrolly);无 `overflow` CSS 属性 | 无(这是 rn 的正确写法) |
| `box-shadow` | effect DROP_SHADOW | 拆成:`shadowColor`, `shadowOffset: { width, height }`, `shadowRadius`, `shadowOpacity`, `elevation`(Android) | 无(rn 原生支持) |
| `filter: blur(...)` | effect LAYER_BLUR | 不出 style;产物注释 `// TODO: RN needs 'expo-blur' or '@react-native-community/blur'`;继续生成其他属性 | error |
| `backdrop-filter: blur(...)` | effect BACKGROUND_BLUR | 同上,注释 + QA error | error |
| `INNER_SHADOW` | effect INNER_SHADOW | 无 RN 原生对应,不出 style + 注释 `// TODO: RN no INNER_SHADOW support` | error |
| `outline` (Outside stroke) | strokes strokeAlign=OUTSIDE | 退化为普通 `borderWidth` + `borderColor`(和 INSIDE 视觉一致,不占据外部空间) | warn:"RN 无 outside 描边概念,已按普通 border 渲染" |
| Gradient stroke | strokes 是 GRADIENT_* | 退化为纯色 border + QA warn | warn |
| `strokeAlign: CENTER` | strokes 中线描边 | 退化为普通 border + QA info | info |
| `background-blend-mode` / `mix-blend-mode` | h5 特有,rn 无对应 | 不出 style + QA error | error |
| `gap` 布局属性 | `itemSpacing` > 0 | RN 0.71+ 支持 `gap`;低版本 QA info 告警"若 RN < 0.71 请手动改用 marginRight / marginBottom" | info(仅提示,不阻塞) |
| `vw` / `rem` / `vh` 单位 | config.unit.outputUnit != 'px' | rn 强制退化为 `'px'`(即数字 DP),QA info 告警"rn 侧无 vw/vh/rem,已按 px 数值输出" | info |

**QA 段落输出格式**(rn SKILL 步骤 7 收尾时统一输出):

```markdown
### RN 端退化告警

- [info] nodeId 163:2321 `fixed-btn-回顶`:已按 §2.5「fixed-* 分层规则」放 ScrollView 外,constraints=BOTTOM 用 bottom:0 贴屏底
- [info] nodeId 163:2300 页面根:已套用 rn 强制 ScrollView 骨架
- [warn] nodeId 163:2350 `bg-page-gradient`:线性渐变已退化为纯色 #ff6600,如需真渐变请手动接 react-native-linear-gradient
- [error] nodeId 163:2400 `sub-blur-modal`:effect LAYER_BLUR 在 RN 无原生对应,请手动接 @react-native-community/blur
```

**说明**:
- **info**:合理的默认退化(比如 vh → Dimensions),告知即可,业务通常不用改
- **warn**:视觉近似或语义变化(fixed → absolute / 渐变 → 纯色),建议业务复核并手工调整
- **error**:无对应无法退化(blur / INNER_SHADOW),必须业务手工引入第三方库或改设计

---

#### 4.3.1 页面根 paddingTop 尺寸源证明（v0.3.10 强制）

**目的**：页面顶层容器（用户传入的 nodeId 对应的 Figma 节点）的 `paddingTop` **必须**取该节点自身 `paddingTop` 字段值，**禁止**取 `fixed-` 状态栏 / 顶部导航栏子层的高度替代。

**背景**：Figma 页面顶层 frame 常常同时有：
- **自身 `paddingTop` 字段**（例：166）：设计师给主内容区上方预留的间距
- **`fixed-` 状态栏子层**（例：118 高）：绝对定位在顶部的固定栏

这两个值**大概率就是不等的**。RN 侧的差异是 `fixed-*` 全部放在根 `<View>` 直接子层（不在 ScrollView 内），主内容区在 `<ScrollView>` 的 `scrollContent` 里，`scrollContent.paddingTop` 来自 Figma 节点的 `paddingTop` 字段。**主 agent 必须从 Figma 节点的 `paddingTop` 字段本身取值**，禁止用"上方的 fixed 子层高度"脑补替代。

**溯源证明格式**（主 agent 交付主页面前必须写一行到主 assets.txt 或对话）：

```
· PAGE根 {pageNodeId} name="{pageName}" figmaPaddingTop={P} fixed状态栏h={S 或 "无"} paddingTop写入={P}（scale=1）
```

`paddingTop 写入` 值必须严格等于 `figmaPaddingTop`（RN 侧 scale=1）。若响应式 rpx 启用，实际写法 `paddingTop: rpx(P)`，溯源行仍记裸数值 `P`。

**主 agent 合并前 grep 自证命令**（§6.0.3 证明块「页面根 paddingTop 尺寸源」段引用）：

```bash
grep -Eho '^· PAGE根 [0-9]+:[0-9]+ .* paddingTop写入=[0-9.]+' {output.dir}/**/assets.txt 2>/dev/null \
  > /tmp/rn-page-padt-declared.txt

ERRORS=0
while read line; do
  P=$(echo "$line" | sed -E 's/.*figmaPaddingTop=([0-9.]+).*/\1/')
  WROTE=$(echo "$line" | sed -E 's/.*paddingTop写入=([0-9.]+).*/\1/')
  if [ "$P" != "$WROTE" ]; then
    echo "❌ 页面 paddingTop 尺寸源错：$line 应写入 $P"
    ERRORS=$((ERRORS + 1))
  fi
done < /tmp/rn-page-padt-declared.txt

if [ "$ERRORS" = "0" ]; then
  echo "✅ RN 页面根 paddingTop 尺寸源契约通过"
else
  echo "❌ $ERRORS 个页面把 fixed 状态栏高度错写为 paddingTop（触发 doctor DIM032）"
fi
```

**doctor 关联规则**：DIM032（v0.3.10 新增，error），见 pp-doctor §3.6t。

**为什么不写"取二者中较大值 / 二者之和"**：agent 一旦被允许"综合推断"就会脑补——skill 的忠实度契约要求每个数值有明确的字段出处，禁止综合演算。

---

#### 4.4 图片处理

##### 4.4.pre 节点整体切图适格性（v0.3.7 新增，前置约束）

**目的**：明确"允许整体切图"和"永远禁止整体切图"两类节点的边界，防止主 agent / sub-agent 把父容器（含多个子层）整体切一张大图当替代品。

| 节点前缀 / 类型 | 是否允许整体切图 | 说明 |
|--------------|--------------|------|
| `img-` | ✅ 允许 | 命中即整体切图（含节点自身及子树），**不再向内递归** |
| `bg-` / 裸词 `bg` | ✅ 允许（切**自身**及其子树） | 切图源 nodeId **必须**是 `bg-` 节点自己 |
| 无前缀非文本图层 | ✅ 允许（兜底） | 命中 §4.3 无前缀兜底规则；命中「父容器盒级装饰兜底」（§4.3）则走 View style，不切图 |
| **`sub-` / `block-`** | ❌ **永远禁止** | 分块边界节点，**必须递归子层**由 sub-agent 独立处理 |
| **`btn-`（未命中兜底）** | ❌ 只切自身，禁止吃父容器 | 若 `btn-` 命中兜底走 View style（渐变走 LinearGradient）；否则只切 `btn-` 自身及其子树 |
| `bgc-` / `x-` | ❌ 禁止 | 均不切图 |

**违反后果**：doctor SUB027（v0.3.7 新增，error），见 pp-doctor §3.6p。

##### 4.4.pre.b 子树结构禁切规则（v0.3.9 新增，前缀维度的**必要补丁**）

**背景**：v0.3.7 §4.4.pre 上表只从**前缀维度**判定"禁切"，只覆盖了 `sub-*` / `block-*` 命名节点。但 sub-agent 内部会遇到**没打前缀但结构上就是内部分块**的节点——这种节点如果落回"无前缀非文本图层兜底整体切图"路径，sub-agent 就能借"figma 图层名字不叫 sub-XXX"绕过 §4.4.pre 主表。

**核心公式**：**只要子树命中以下任一结构信号，即使前缀是"无前缀"或没打 `sub-` / `block-` 也永远禁止整体切图**，必须递归子层。

| 结构信号 | 判定条件 | 理由 |
|---------|---------|------|
| **多文本禁切** | 子树含 **≥2 个可见 TEXT** 节点，且**分属不同视觉行**（任两个 TEXT 的 `absoluteBoundingBox.y` 差 ≥ 4px） | 文字必须可选中、可翻译、可无障碍朗读、可埋点、可动态替换（RN 侧 `<Text>` 组件承载） |
| **多按钮禁切** | 子树含 **≥2 个**下列任一：`btn-` 前缀节点 / 裸词 `btn` 节点 / INSTANCE / COMPONENT 型子节点 | 按钮必须独立生成 `<Pressable>` / `<TouchableOpacity>` 才能挂 `onPress`；烤图后无法点击 |
| **同构列表禁切** | 子树含 **≥3 个**同层同构子节点（同类型 + bbox 相近 ±10% + 图层名同前缀或数字后缀差 1） | 同构结构应 `.map()` 生成，`<FlatList>` / `<ScrollView>` 等 RN 列表组件才有意义 |

**判定优先级**：结构信号维度**优先于**前缀维度——即使节点前缀允许整体切图（`img-` / `bg-` / 无前缀），只要命中上表任一条件，一律禁止整体切图。**唯一例外**：`img-` / `bg-` 是设计师显式指定"这就是一张图"的信号，agent 应尊重（否则前缀就没意义了）；但此时 doctor SUB029 会告警。

**违反后果**：doctor SUB029（v0.3.9 新增，error），见 pp-doctor §3.6r。

**反向自检**（sub-agent 决定"整体切图"前，除 §4.4 5 行自检外，额外必须扫描子树输出 2 行）：

```
· 子树可拆分子节点数：{可见 TEXT 数 x / btn 数 y / 同层同构组数 z}
· 结构维度禁切判定：{通过：均低于阈值 / 命中禁切: 具体条件（多文本 x≥2, 多按钮 y≥2, 同构 z≥3 任一）}
```

任一命中 → 立即停下重做，回归 §4.3 递归子层解析（RN 侧生成 `<View>` + `<Text>` + `<Pressable>` + `.map(...)` 结构）。

##### 4.4.0 切图强制忠实执行（v0.3.6 新增）

**核心原则**：命中 `img-` / `bg-` / 裸词 `img` / 裸词 `bg` 时，必须调 `figma.mjs export-image`（走 REST API）产出图片；**不允许**"看到 assetsDir 里有同名文件就跳过"或"从其他来源复用"。这是防止"skill 假装切了图，其实用了缓存/上一轮产物/同名老图"这类忠实度事故的核心约束。

**流程（每张 img-/bg-/裸词 类图片必走）**：

1. **查 images.json**：读 `.d2c-cache/<fileKey>/images.json`，看当前 nodeId 是否已有记录：
   - **无记录** → 直接调 `figma.mjs export-image`
   - **有记录** → md5 校验

2. **md5 校验复用**（有记录时）：
   - 读磁盘文件算 md5，与 `images.json` 里记录的 md5 对比
   - **相等** → 复用；**不等 / 文件不存在** → 强制重切并覆盖旧记录

3. **images.json 写入契约**：
   ```json
   {
     "<nodeId>": {
       "path": "<绝对路径>",
       "format": "png | svg",
       "filename": "<basename>.<ext>",
       "md5": "<32 位 hex>",
       "bboxHash": "<nodeId>|<w>x<h>|<scale>|<use_absolute_bounds>"
     }
   }
   ```
   `bboxHash` 用于识别"同 nodeId 但导出参数变了"的情况（scale/bounds 变化），hash 不同 → 视作缓存失效强制重切。

4. **assets.txt 3 行溯源**（每张图切完必写）：
   ```
   - {filename}.{ext}                       ← {figmaNodeName} ({nodeId})
     · API 参数：ids={nodeId} format={png|svg} scale={2} use_absolute_bounds={true|false}
     · 返回 URL：{figma S3 临时 URL}
     · 落盘尺寸：{width}x{height} md5={md5}
   ```

**doctor IMG026（v0.3.6 新增）**：`img-`/`bg-`/裸词 img/bg 命中，但 images.json 里对应 nodeId 缺失 → **error**（说明本次 skill 没走 REST 就落图，属于严重忠实度事故）。

**为什么加这一小节**：历史事故 `gengduofuli-quan-jinqing.png` 出现"顶部有大片空白"，追查 md5 发现磁盘产物和 API 实测导出根本对不上——skill 那一轮实际上没调 REST，而是从上一轮的 `jingqingqidai.png` 直接改名复用了。

##### 4.4 图片处理（原节，v0.3.6 起以 §4.4.0 为前提）

所有图片（`img-` / `bg-` / 无前缀兜底）通过 `figma.mjs export-image` 导出。脚本内置：两步式下载 / `use_absolute_bounds=true` 默认开 / 存在即跳过 / 3 次指数退避 / 回写 `images.json` / 绝对路径写入 `{projectRoot}/{assetsDir}/{filename}.{ext}`。

**⚠️ 调脚本前的强制前置自检（sub-agent 每张图都必须做，且必须把 7 行输出到对话，不允许省略）**：

```
· 图层前缀类型：{img- / bg- / 无前缀}（裸词 img / bg 视同对应前缀）
· 切图源 nodeId：{要写进 --ids 的值}
· 切图源 name：{该 nodeId 对应节点的图层名}
· 交叉验证：切图源 name 是否以「{前缀}」开头，或完全等于「{裸词}」？{是/否}
· 切图范围：{仅节点自身及子树 / 意图切父容器}（v0.3.7 新增，见 §4.4.pre 适格性表；答"意图切父容器"立即停下重做）
· 子树可拆分子节点数：{可见 TEXT 数 x / btn 数 y / 同层同构组数 z}（v0.3.9 新增）
· 结构维度禁切判定：{通过：均低于阈值 / 命中禁切: 具体条件（多文本 x≥2, 多按钮 y≥2, 同构 z≥3 任一）}（v0.3.9 新增，见 §4.4.pre.b；命中即立即停下重做，走 §4.3 递归子层解析）
```

**交叉验证判定**：
- 前缀是 `bg-` → 切图源 name **必须**以 `bg-` 开头（如 `bg-piao` / `bg-body`），**或完全等于裸词 `bg`**（whole word，不含前后其他字符）。**若为「否」，立即停止**，返回 §4.0.5 重新在 `bg-` 命中节点的子树里定位真正的 `bg-` 节点 id。
- 前缀是 `img-` → 切图源 name 必须以 `img-` 开头，**或完全等于裸词 `img`**。
- 无前缀（兜底非文本图层）→ 切图源 name 与当前节点 name 一致。
- **裸词识别范围**：仅 `bg` / `bgc` / `btn` / `img` / `input` 五个独立/内容前缀允许裸词（见 §4.3「独立裸词规则」），修饰前缀（`sub` / `block` / `x` / `scrollx` / `scrolly` / `fixed` / `end`）**不允许**裸词，遇到直接走无前缀兜底。

**这是 `card-bg.png` / `piao.png` 把兄弟节点文字烤进 PNG 这类 bug 的唯一防线**——历史事故根因就是 sub-agent 拿了 `bg-` 的**父容器 nodeId** 传给 API，Figma 会把父容器**整棵子树**（含兄弟节点的文字/图标/其他 block）一起 render 成位图。前置自检就是为了让这一步走不通。**脚本不知道你传的 nodeId 是否合法**，这个判断只能 LLM 自己做。

**调用**：

```bash
# PNG 2 倍图（默认，含透明通道）
node .claude/skills/pp-d2c-rn/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name>

# SVG（矢量图层优先）
node .claude/skills/pp-d2c-rn/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --format=svg

# 极少数场景:需要把 Figma effect 烤进位图(通常不用)
node .claude/skills/pp-d2c-rn/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --preserve-effect
```

stdout 返回 `{"ok":true,"data":{"path":"<绝对路径>","reused":<bool>,"format":"png|svg"}}`。`reused=true` 表示命中缓存跳过下载。

> **`use_absolute_bounds=true` 是默认开的**：
> - 默认导出会包含图层 effect（drop-shadow / outer-stroke / blur）的可见范围与父容器背景色，PNG 会比 bbox 大一圈并带画板底色 → 导致 `gap`/`margin` 算不准 + 图带背景色两个历史 bug。
> - 加此参数后，Figma 严格按节点 `absoluteBoundingBox` 导出，effect 和父背景被裁掉。**代价**：Figma effect 实现的阴影/光晕不会烤进 PNG——但这本来就是要的（应用 CSS `filter: drop-shadow` 实现）。
> - 若某张图**就是要**把 effect 烤进位图（极少见），加 `--preserve-effect` 覆盖。也可在 config `images.preserveEffectIds` 数组里列出该 nodeId（LLM 端根据 config 决定是否加 flag）。

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ `--format=svg`
- 其他 → 默认 PNG 2 倍图

**前提**：项目根 `.env` 里 `FIGMA_TOKEN` 必须已配置（v1.0.2 起从 `pp-d2c.config.json` 迁到 `.env`）。**当 token 缺失或过期时（HTTP 403 / 401 / `invalid_token`）**，本 SKILL  起**不再有 MCP 兜底路径**——直接终止并要求用户补 token 后重跑。原因见下文 §4.4.1。

#### 4.4.1 Token 过期 / 缺失时的处理

起本 SKILL 完全不依赖 MCP，图片导出**只有 REST API 一条路径**：

| 情况 | 处理 |
|------|------|
| Token 有效，导出成功 | 正常流程 |
| Token 缺失 / 过期（HTTP 401/403） | **立即终止**，输出下方错误提示，由用户补 token 后重跑 |
| `/v1/images` 返回 `err` 字段或临时 URL 404 | 3 次指数退避重试（1s/2s/4s），三次都失败 → 终止并输出错误 |

**错误提示文案**：

```
❌ 图片导出失败：Figma Token 无效或过期

请检查项目根 `.env` 里的 `FIGMA_TOKEN`：
1. Token 是否已过期或被撤销
2. Token 权限是否包含 File content: Read-only
3. Token 对应的账号是否有该 fileKey 的访问权限

修正后重新运行本 SKILL（缓存会因 lastModified 校验自动决定是否复用）。
```

**为什么删除 MCP `download_assets` 兜底**：

- MCP `download_assets` 不支持 `use_absolute_bounds=true` 参数，导出的图会带图层 effect 外扩 + 父背景色 → 直接导致 `card-bg.png` 类历史 bug 重现
- 保留兜底会让 agent 在 token 失败时"悄悄降级"，用户看不到严重的视觉退步
-  全流程走 REST，兜底路径与主路径**能力不对等**，与其藏 bug 不如显式失败

**禁止**：
- 禁止在 token 过期时直接跳过下载或用临时链接占位（Figma `/v1/images` 返回的 S3 临时 URL 约 30 分钟过期，代码上线就 404）
- 禁止把 Figma `/v1/images` 返回的 S3 临时 URL 写进代码 `<img src>`（同上，只能作为下载源，下载完立刻丢弃）
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具

**文件命名规则**：

图层名去掉所有已知前缀后，转为 kebab-case 作为文件名：

| 图层名 | 去前缀后 | 文件名 |
|--------|---------|--------|
| `img-hero-bg` | `hero-bg` | `hero-bg.png` |
| `bg-body` | `body` | `body.png` |
| `img-编组4` | `编组4` | `编组4.png`（含中文直接保留） |
| `btn-img-submit-btn` | `submit-btn` | `submit-btn.png` |

- 去掉前缀后为空或无法识别 → 使用图层原始名转 kebab-case
- 同一目录下有重名 → 追加父图层名前缀区分，如 `main-hero-bg.png`
- **禁止**使用 Figma node ID 作为文件名
- **禁止**使用 `101`、`201` 等数字序号作为文件名

**代码中图片引用(RN 铁律,与 h5 完全不同)**：

**唯一形式**:`require()` 编译期路径,不允许字符串拼接:

```tsx
// RN 内核语义(SKILL 主流程直接产出这个)
<Image source={require('@Images/<页面>/<filename>.<ext>')} />

// 启用 adapter(如 xtaro 预设)时,§5.5 合并阶段自动 tagMap Image→XImage + propMap source→src:
<XImage src={require('@Images/<页面>/<filename>.<ext>')} />
```

**为什么必须 require**:

- RN Metro **只在编译期**解析 `require('./x.png')`,把它转成资源模块 ID;运行时才能拿到真实资源
- 字符串拼接的 URL(`` source={`${prefix}${name}`} ``)在 RN 里**无法解析**,产物跑起来图片 404 / 白屏
- 这是 RN 与 h5 最大的图片处理差异 — h5 走网络 URL,RN 走编译期资源打包

**alias `@Images/` 说明**:

- 多数 RN 项目在 `webpack.config` / `metro.config` / `tsconfig.paths` 里配了 `@Images` alias 指向 `./src/Images`(项目自己的约定,SKILL 不管配置)
- 若项目没配 alias,可用相对路径 `require('../../Images/<页面>/xxx.png')`(不推荐,层级深了难维护)
- **agent 判定项目 alias 前缀**:先 grep `tsconfig.json` / `config/index.js` / `webpack.config.js` 里的 `Images` alias 定义;找不到默认写 `@Images/`(多数 RN 项目这样),同时 QA info 告警"未在项目配置里读到 alias,产物默认写 @Images/,请人工核对"

**config 字段语义**(rn 分支与 h5 有别):

- `images.assetsDir`:图片**落地目录**(相对 projectRoot),推荐 `src/Images/`(常见 RN 项目通行) 或 `assets/`(裸 RN);agent 生成产物时按此路径写 require
- `images.imageBaseUrl`:**rn 分支应为空**;若非空,说明项目走"运行时 URL"路径(极少见,如自建 CDN 分发),此时 agent 才拼字符串,但**默认不这么做**
- rn 分支的 assetsDir 通常按 `src/Images/<页面 kebab-name>/`(每个页面独立子目录),避免多个页面切图 name 冲突

**产物示例**:Figma 页面 `AirportBus` 有 6 张切图(title.png / tabs.png / arrow-to.svg / ...),config `images.assetsDir = "src/Images/"`,agent 生成:

```tsx
// RN 内核语义(SKILL 主流程输出的中间产物):
import { Image, View } from 'react-native'
import { styles } from './styles'

export default function AirportBus() {
  return (
    <View style={styles.root}>
      <Image source={require('@Images/AirportBus/title.png')} style={styles.bgTitle} />
      <Image source={require('@Images/AirportBus/tabs.png')} style={styles.tabs} />
      {/* ... */}
    </View>
  )
}

// 启用 xtaro 预设后,§5.5 合并阶段自动改成:
import { XImage, XView } from '@ctrip/xtaro'

export default function AirportBus() {
  return (
    <XView style={styles.root}>
      <XImage src={require('@Images/AirportBus/title.png')} style={styles.bgTitle} />
      <XImage src={require('@Images/AirportBus/tabs.png')} style={styles.tabs} />
    </XView>
  )
}
```

对应 export-image 的 `--filename` 参数拼接页面子目录,让图片直接落到 `{projectRoot}/{assetsDir}/<页面>/`:

```bash
node .claude/skills/pp-d2c-rn/bin/figma.mjs export-image <fileKey> <nodeId> \
  --filename=AirportBus/title
```

若 figma.mjs 不支持在 --filename 里带子目录,SKILL 主流程在 export 之后把图 `mv` 到正确子目录再生成 require 路径。

**禁止**:

- 禁止 `` src={`${imageBaseUrl}${assetsDir}${filename}`} `` 字符串拼接(那是 h5 SKILL 的写法,RN 跑起来 404)
- 禁止 `const ASSET_PREFIX = '...'`(rn 侧无用变量)
- 禁止在 rn 产物里出现任何 `.scss` / `$asset-prefix` 定义(rn 无 SCSS)
- SKILL 主流程内核输出 `<Image source={require(...)}>`;是否再改成 `<XImage src={...}>` 由 adapter §5.5 阶段决定(见 §5.5.3b propMap),agent 生成主流程不要跳过内核直接写目标框架标签

#### 4.4.2 字体处理（阿里巴巴普惠体固定 CDN）

设计稿中若出现 **Alibaba PuHuiTi**（阿里巴巴普惠体）Bold / Heavy 字重的文本节点，**统一使用固定 CDN 地址**，不下载到本地、不走 `assetsDir`：

| Figma 字体名 | font-family 值 | 字体 URL |
|--------------|----------------|----------|
| `Alibaba PuHuiTi` / `AlibabaPuHuiTi` **Bold** | `AlibabaPuHuiTi-Bold` | `https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Bold.woff2` |
| `Alibaba PuHuiTi` / `AlibabaPuHuiTi` **Heavy** | `AlibabaPuHuiTi-Heavy` | `https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Heavy.woff2` |

**声明位置**：`@font-face` 写在**页面根样式**（即当前 page 目录下的入口 scss/less/css），**每个 font-family 只声明一次**；多个 sub-agent block 不重复声明。

**声明写法**（SCSS/LESS/CSS 通用）：

```scss
@font-face {
  font-family: 'AlibabaPuHuiTi-Bold';
  src: url('https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Bold.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'AlibabaPuHuiTi-Heavy';
  src: url('https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Heavy.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

**引用写法**：

```scss
.title-bold {
  font-family: 'AlibabaPuHuiTi-Bold', sans-serif;
}
.title-heavy {
  font-family: 'AlibabaPuHuiTi-Heavy', sans-serif;
}
```

**Figma 字重映射规则**：
- Figma `Bold` → `AlibabaPuHuiTi-Bold`
- Figma `Heavy` / `Black` → `AlibabaPuHuiTi-Heavy`
- Figma 其他字重（Regular / Medium / Light / Thin 等）→ **不引入 Alibaba PuHuiTi**，退化为系统默认字体栈；若设计确有需要，在 QA 段落里标注"设计使用了 <字重> 字重，当前仅提供 Bold / Heavy 两档"，由用户决策是否补 CDN

**禁止**：
- 禁止把阿里巴巴普惠体 woff2 下载到本地 `assetsDir`：这两个字重是团队固定 CDN，全项目复用，本地化只会增大产物
- 禁止用 `imageBaseUrl + assetsDir` 拼字体 URL：字体不走图片资源公式，直接写 CDN 完整地址
- 禁止在多个 sub-agent 的组件样式里各自重复 `@font-face`：必须集中到页面根样式声明一次

#### 4.5 单位换算

Figma 设计稿的所有尺寸值(宽、高、间距、字号等)在写入代码前必须先乘 `unit.scale`,然后按 §4.1.1 §C.1 白名单决定是否用 `rpx()` 包装。

**换算公式**:`基准值 = Figma值 × scale`(`scale = outputBase / figmaBase`)

**rn 分支默认配置**(见 `templates/pp-d2c.rn.config.json`):

```
figmaBase: 375   outputBase: 375   scale: 1   outputUnit: 无(RN 数值单位是逻辑点)
```

**scale=1 的含义**:figma 数值**直接就是**基准值,不做 ×2。RN 的 `StyleSheet` 数字单位是逻辑点(dp/pt),iPhone 上 1 pt ≈ 1 CSS px,天然与 figma 375 稿对齐,不需要像 H5 那样为兼容 750 基准 ×2。

**示例**(响应式启用,`figmaBase=375`,`scale=1`):

| Figma 读到 | × scale | 白名单命中? | 产物 |
|---|---|---|---|
| `16` (paddingLeft) | 16 | 是 | `paddingLeft: rpx(16)` |
| `14` (fontSize) | 14 | 是 | `fontSize: rpx(14)` |
| `0.8` (opacity) | 0.8 | 否 | `opacity: 0.8` |
| `'row'` (flexDirection) | — | 否(枚举) | `flexDirection: 'row'` |

**⚠️ 严禁把 figma 值提前 ×2 再传给 `rpx()`**(例如 `paddingLeft: rpx(32)` 表示 figma 16):
- rn 分支 `scale=1` 是硬约定(config 强制,install.js 已跳过单位选择题)
- rpx helper 内部基准与 `figmaBase` 联动,helper 会按运行时屏宽做正确缩放
- 提前 ×2 会**双重缩放**:agent ×2 一次 + helper 按 750 基准缩一次 → 若用户 rpx.ts 是 375 基准则视觉放大 2 倍,若是 750 基准则视觉正确但语义与 config 脱节,后续维护踩坑
- 例外:h5 分支才走 `scale=2`(见 h5 SKILL §4.5);本 SKILL 只覆盖 rn 分支,不要照抄 h5 惯例

**禁止直接把 Figma 原始值写入代码**——白名单命中的字段必须用 `rpx()` 包装(即使 `scale=1` 值不变,包装形式不能省)。

#### 4.6 框架适配

| framework + styleFormat | 组件语法 | 样式输出 |
|------------------------|---------|---------|
| react + scss | TSX + className | `.scss` 文件 |
| react + scss-modules | TSX + styles.xxx | `.module.scss` 文件 |
| react + less | TSX + className | `.less` 文件 |
| react + less-modules | TSX + styles.xxx | `.module.less` 文件 |
| react + css | TSX + className | `.css` 文件 |
| react + css-modules | TSX + styles.xxx | `.module.css` 文件 |
| react + tailwind | TSX + className | 无独立样式文件 |
| react + inline | TSX + style={{}} | 无独立样式文件 |
| rn + stylesheet | RN JSX | `StyleSheet.create({})` 内联 |
| rn + styled-components | styled-components/native | 无独立样式文件 |
| rn + nativewind | TSX + className | 无独立样式文件 |

#### 4.7 sub-agent 输出文件结构

```
{output.dir}/blocks/{label}/
├── index.tsx        ← 组件主体
├── index.scss       ← 样式文件（按 styleFormat 决定格式）
└── assets.txt       ← 本 block 图片清单（文件名 + 原始临时链接）
```

#### 4.8 sub-agent 独立验收

代码生成完成后，sub-agent 对自己负责的 block 做视觉验收：

1. 调 `figma.mjs screenshot <fileKey> <blockNodeId> --tag=block` 获取本 block 的截图；stdout 返回 `{path}` 即本地绝对路径（`{projectRoot}/.d2c-tmp/screenshots/block-<nodeId_safe>.png`）
2. 与生成代码做视觉差异分析
3. 可自动修正的差异（颜色偏差、间距误差）直接修正
4. 不可自动修正的差异记入 `assets.txt` 底部的 `QA` 段落

```
# QA
- [可自动修正] 已修正：...
- [需手动处理] 字体缺失：...
```

**§4.8 独立验收 checklist（v0.3.6 起必查，RN 侧对齐 pp-d2c）**：

- [ ] **NAM024 双写防护**：产物 JSX 里出现 `<Image>` / `<ImageBackground source={btn-*.png}>` 的 `btn-` 节点，其 sibling / child 是否**同时存在**渲染同一段文字的 `<Text>`？若是 → **error**（正确做法：走 §4.3 父容器兜底用 View style 表达按钮背景；渐变按钮加 `LinearGradient` 包裹；`<Text>` 保留文字）
- [ ] **NAM025 多层 fills 取末位**：产物里所有 `<Text>` 的字色，是否按 §4.1.1「TEXT 多层 fills 处理」取的末位可见 SOLID？
- [ ] **父容器盒级装饰兜底覆盖率**：产物里所有 `btn-*` / 无前缀 FRAME 是否命中 §4.3 判定时都走了 style？含渐变的父容器是否引入了 `LinearGradient`？QA 是否输出了"需 install react-native-linear-gradient"退化告警？
- [ ] **IMG026 切图忠实性**：产物 `assets.txt` 里每张图是否都有 §4.4.0 定义的 3 行溯源？images.json 里是否有对应 nodeId 的记录？md5 是否与磁盘文件一致？
- [ ] **未主动问用户技术决策（v0.3.8 新增）**：sub-agent 本轮跑完是否**没有向用户提任何 skill 已定死的技术决策问题**（切图/兜底/合并/尺寸/RN 特有退化等，见「问题边界」章节）？若遇 skill 未覆盖的边界情形，是否已按最接近规则兜底 + 在 `assets.txt` QA 段落写「[需人工核对]」告警，而**不是**打断用户提问？
- [ ] **结构维度禁切核查（v0.3.9 新增）**：本 block 是否有任何节点被 sub-agent 决定"整体切图"？若有，其子树是否命中 §4.4.pre.b 任一禁切条件（≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点）？命中即视为 sub-agent 交付不合格，必须回滚该节点，改走 §4.3 递归子层解析（RN 侧生成 `<View>` + `<Text>` + `<Pressable>` + `.map(...)` 结构）

验收通过后 sub-agent **立即将 `.d2c-tasks.md` 中对应的 `[ ]` 改为 `[x]`**，主 agent 方可进入步骤 5。

---

### 步骤 5：主 agent 合并

**合并前必须检查 `.d2c-tasks.md`，确认以下所有项均为 `[x]`**：
- 所有 Sub-agent Blocks（含嵌套层级，深度优先逐项检查）
- 所有主 agent 直接处理节点
- 背景节点

有任何 `[ ]` 未完成，必须先补齐再合并，不得跳过。

等待所有 sub-agent 完成后，按 `merge.mode` 合并。

#### 5.0.pre flat 模式合并忠实度契约（v0.3.7 新增，最高优先级）

**核心原则**：sub-agent 已经落盘的 `blocks/{sub}/index.tsx` 是**主 agent 的唯一输入源**。主 agent 合并时**必须**逐字使用 sub-agent 交付的 JSX 结构，**禁止**：

1. **禁止用父容器整体切图（如 `sub-ui-frame734.png` / `sub-{name}.png`）替代 sub-agent 的拆分产物**——sub-agent 已经把 3 行任务/独立按钮/独立文字拆开了，主 agent 不允许"合并阶段觉得复杂"就把这些拆分产物删掉换成一张父容器大图
2. **禁止在 sub-agent 落盘后再切父容器整体图**——主 agent 步骤 5 阶段不允许调 `figma.mjs export-image` 切任何 `sub-*` / `block-*` 前缀的父容器 nodeId（那属于 sub-agent 范畴，且违反节点整体切图适格性，见 §4.4 前置）
3. **禁止在 flat 展开时"简化"sub-agent 产物**——不允许把 sub-agent 产出的 `<Pressable>` / `<TouchableOpacity>` 结构折叠成 `<Image>`，不允许把 `<View><Text>去看看</Text></Pressable>` 折叠成 `<Image source={require('...btn-qukankan.png')} />`；即使二者视觉等价，也违反守恒律

**反向自检 4 行**（主 agent 每展开一个 sub-block 前必须输出）：

```
· 待展开 sub-name：{blocks/{sub}/index.tsx 路径}
· 已读取该文件？{是/否}（如否，立即读，禁止继续）
· 是否用父容器整体切图替代？{否 / 意图替代}（如"意图替代"，立即停下，回归 sub-agent 产物）
· sub-agent 已交付的 data-node-id 数：{N}（合并后必须 ≥ N，见 §5.1 data-node-id 守恒律）
```

任意一项答错即停下重做——这是"主 agent 绕过 sub-agent 产物"这类事故的唯一防线。

#### 5.0 placeholder 展开

合并前先做一次 **`<__SUBSLOT__>` 展开**：

1. 对每个父 block，读取其 `subslots.json`
2. 找到 JSX 里的 `<__SUBSLOT__ nodeId="..." name="..." />` 占位
3. 按 merge.mode 决定替换形式：
   - **component 模式** → 替换为 `<ChildBlockName />` 的 JSX 元素，并在父 block 的 index.tsx 顶部 `import ChildBlockName from './blocks/{child-name}'`（嵌套目录路径见下）
   - **flat 模式** → 替换为子 block 的完整 JSX 内容（递归展开后的最终 HTML 树），子 block 的 SCSS 内容追加到父 block 的 index.scss
4. **从最深层开始展开**（深度优先）：先展开 depth=3 的占位 → 再展开 depth=2 → 最后 depth=1。这样合并时不会出现"展开后又冒出新的占位"
5. 展开完成后 `__SUBSLOT__` 标签必须 0 个残留——验收脚本：`grep -r "__SUBSLOT__" {output.dir}` 应为空

#### component 模式(默认,rn 版)

嵌套 sub- 生成嵌套目录结构:

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx                ← 主文件,import 顶层 block 子组件 + StyleSheet
│   └── styles.ts                ← 主文件 StyleSheet.create({...}) 的 styles 定义(可选,也可写在 index.tsx 底部)
└── blocks/
    ├── content/                 ← Block 1: sub-content (depth=1)
    │   ├── index.tsx
    │   └── styles.ts (可选)
    │   └── blocks/              ← 嵌套:内层 sub- 在父 block 的 blocks/ 子目录
    │       ├── card/            ← Block 1.1: sub-card (depth=2)
    │       │   └── index.tsx
    │       └── scrolly-车票列表/ ← Block 1.2: sub-scrolly-车票列表 (depth=2)
    │           └── index.tsx
    └── img-QA/                  ← Block 2: sub-img-QA (depth=1)
        └── ...
```

**注意与 h5 的差异**:
- 无独立样式文件(`.scss` / `.module.scss` 都没有);样式写在 `index.tsx` 同文件底部的 `const styles = StyleSheet.create({...})`,或抽到同级 `styles.ts`
- 无 `<div>`,统一用 `<View>` / `<Text>` / `<Image>` / `<Pressable>` / `<TextInput>` / `<ScrollView>` 六件套
- 无 `className`,统一用 `style={styles.xxx}`

主文件示例(顶层):

```tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Content from './blocks/content'
import ImgQA from './blocks/img-QA'

export default function ComponentName() {
  return (
    <View style={styles.componentName}>
      <Content />
      <ImgQA />
    </View>
  )
}

const styles = StyleSheet.create({
  componentName: {
    flex: 1,
    backgroundColor: '#ff6600',
    // ... 其余属性
  }
})
```

父 block index.tsx 示例(含嵌套):

```tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Card from './blocks/card'
import ScrollyList from './blocks/scrolly-车票列表'

export default function Content() {
  return (
    <View style={styles.content}>
      {/* 上半区... */}
      <Card />
      <ScrollyList />
      {/* 下半区... */}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { /* ... */ }
})
```

#### flat 模式(rn 版)

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 所有 block JSX 递归展开后平铺 + 合并的 StyleSheet
│   └── styles.ts        ← 所有 block 样式合并后的 StyleSheet.create 对象(可选)
└── blocks/              ← 保留所有层级,不删除
    └── content/
        └── blocks/
            ├── card/
            └── scrolly-车票列表/
```

合并规则:
- JSX 按嵌套树**深度优先展开**:父 block 的 placeholder 替换成子 block 完整 JSX,子 block 的 placeholder 再展开(递归)
- 每段保留注释,标明嵌套关系:`{/* --- block: sub-content > sub-card --- */}`
- **样式合并到统一的 `styles` 对象**:各 block 的 styles 键名保持各自命名空间(命名空间规则不变),平铺后拼进同一个 `StyleSheet.create({...})`
- 键名冲突时自动加 block 名前缀解决(嵌套 block 用 `parentChild` camelCase 前缀)

---

### 步骤 5.4:应用响应式 rpx()(仅 `config.unit.responsive.enabled === true` 时执行)

合并完成后、进入 adapter 阶段(§5.5)之前,若 config 里 `unit.responsive.enabled` 为 `true`,主 agent 按下述顺序**重写所有 index.tsx / styles.ts** 中的 `StyleSheet.create({...})` 对象:

**步骤 5.4.1 加 import 段**

在每个含 `StyleSheet.create` 的文件顶部 import 区,追加一行(如果已存在则跳过):

```tsx
import { <helperName> } from '<helperImport>'
```

`<helperName>` 和 `<helperImport>` 从 config `unit.responsive.helperName` / `helperImport` 读取(默认 `rpx` + `@/utils/rpx`)。

**步骤 5.4.2 遍历 style 对象包装数值**

对每个 `StyleSheet.create({ blockName: { ...props } })` 里的每一条 `key: value`,按 §4.1.1 §C.1 白名单判定:

- key 命中"必须包装"表 且 value 是**数值型字面量**(如 `16`,不是字符串 `'100%'` / 变量引用 / 表达式) → 改写成 `<helperName>(<value>)`
- key 命中"禁止包装"表 → 跳过
- key 都不命中 → 跳过 + 累计到 QA info 告警"字段 X 未在响应式白名单,已保留原始值"

**边界**:

- **只包装数值型字面量**:`paddingLeft: 16` → `paddingLeft: rpx(16)`;`paddingLeft: '50%'` / `paddingLeft: someVar` / `paddingLeft: Dimensions.get('window').width` **保持原样**
- **`shadowOffset` 嵌套对象**:内部的 `width` / `height` 按白名单包装(`shadowOffset: { width: rpx(0), height: rpx(2) }`)
- **`transform` 数组**:内部对象 `translateX` / `translateY` 数值型的按白名单包装;`scale` / `rotate` 不包装
- **零值**:`padding: 0` **不包装**(rpx(0) 恒为 0,只增噪),直接保留 `0`

**步骤 5.4.3 输出前统计**

主 agent 在 §7.3 报告里写入本次包装了多少属性、跳过多少非白名单字段。

**响应式关闭时**:整个 §5.4 跳过,产物就是纯数字 StyleSheet。SKILL 不写 rpx import,不改数值。

---

### 步骤 5.5:应用 adapter(仅 `config.adapter.enabled === true` 时执行)

合并完成后、写盘前,若 config 里 `adapter.enabled` 为 `true`,主 agent 按下述顺序**重写所有 index.tsx**(嵌套 block 都要走一遍):

**步骤 5.5.1 校验 tagMap**

遍历 `config.adapter.tagMap`,过滤掉不合法的条目:
- key 不在 6 大 RN 标签中(`View / Text / Image / Pressable / TextInput / ScrollView`)→ 丢弃 + QA warn 告警
- value 不匹配 `/^[A-Z][A-Za-z0-9]*$/` → 丢弃 + QA warn 告警
- 处理后得到"合法 tagMap"

**步骤 5.5.2 校验 importMap**

遍历 `config.adapter.importMap`:
- key 必须是"合法 tagMap 的 value"或 6 大 RN 原生标签
- value 是任意非空字符串
- 不合法的丢弃 + QA info 告警

**步骤 5.5.2b 校验 propMap**

遍历 `config.adapter.propMap`(可选字段,不存在则跳过本步):
- key 必须是 6 大 RN 原生标签(`View / Text / Image / Pressable / TextInput / ScrollView`)之一,其他 key 丢弃 + QA warn
- value 必须是对象 `{ 原 prop: 新 prop }`;`原 prop` / `新 prop` 都必须匹配 `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`(合法 JSX 标识符)
- **禁止重命名 React 保留 prop**:`style` / `key` / `ref` / `children` / `className` — 命中即丢弃该条 + QA warn
- 处理后得到"合法 propMap"

**步骤 5.5.3 重写 JSX 标签**

对每个 index.tsx:
- 全文查找 `<View ` / `<View>` / `</View>` / `<View/>`(注意区分开闭标签、自闭合、带属性的 `<View style=`),替换为映射后的标签(如 `<MyView `)
- 6 大标签逐个处理(**只处理 6 大**,其他 JSX 标识符保持原样)
- StyleSheet / Dimensions / Fragment(`<>`)等**不动**

**步骤 5.5.3b 应用 propMap(prop 名重命名)**

对每个 index.tsx,基于**合法 propMap**逐个 RN 原标签遍历重写 JSX 属性:

- 对于 `propMap[原标签] = { 原 prop: 新 prop }` 的每一条:
  - 定位所有该"原标签"对应的 JSX 元素(注意此时标签名已在 5.5.3 被 tagMap 替换,匹配时用**映射后的标签名**,例如 `Image` 的 propMap 应作用到 `<MyImage ...>`)
  - 逐个元素扫属性:命中 `原 prop=` 的属性(含 `原 prop={...}` / `原 prop="..."` / 自闭合 `<MyImage 原 prop={...} />` 三种写法),将属性名整体替换为 `新 prop`
  - **不动属性值**:值是 JSX 表达式(`{require('./x.png')}`)/字符串字面量(`"foo"`)/变量引用(`{iconUrl}`)都保持原样
  - **不动 style / key / ref / children / className**:即便 propMap 声明了这些 key(5.5.2b 已过滤),这里也**再次跳过**作为兜底
- **未在 propMap 声明的属性一律保留原样**:例如 `<MyImage source={...} style={...} resizeMode="cover" />`,若 propMap 声明 `Image.source → src`,只把 `source` 改成 `src`,`style` 和 `resizeMode` 保持不动

**示例**(设 propMap 为 `{ Image: { source: "src" } }`,某预设把 `Image` 映射成 `MyImage`):

```tsx
// 5.5.3 tagMap 之后、5.5.3b propMap 之前
<MyImage source={require('./assets/icon.png')} style={styles.icon} resizeMode="contain" />

// 5.5.3b propMap 之后
<MyImage src={require('./assets/icon.png')} style={styles.icon} resizeMode="contain" />
```

**步骤 5.5.3c 查预设参考手册(处理复杂差异)**

`propMap`(§5.5.3b)只做**声明式的 prop 名机械改名**(左侧 → 右侧,不动值,不改回调体,不动结构)。目标框架与 RN 内核的差异往往超出这个范畴,例如:

- **值域映射**:`Image.resizeMode='contain'` → xtaro `mode='aspectFit'`(prop 值也变)
- **布尔取反**:`TextInput.editable={false}` → xtaro `disabled={true}`
- **事件签名转换**:`TextInput.onChangeText={(text)=>...}` → xtaro `onInput={(e)=>...}`,回调体要读 `e.detail.value`
- **结构变化**:`ScrollView.horizontal={true}` → xtaro `scrollX={true}` + 删除 horizontal + 显式补 `scrollY={true}` for 纵滚场景
- **无跨端支持**:`Text.numberOfLines` 在某些框架 rn 端不支持,需删除属性 + QA warn

这些"超改名"的差异由**预设参考手册**承载,不进 preset JSON,也不进 SKILL 本体(避免 SKILL 与具体框架耦合)。

**触发条件**:`config.adapter` 命中的 preset(见 §5.5.2 前置)里含 `referenceDoc` 字段,且该字段值指向的 md 文件真实存在。

**执行动作**:

1. 从 `config.adapter._presetSource` 拿到 preset 目录路径(CLI 已在 init 阶段把选中的 preset 完整字段写入 config,SKILL 从 config 读即可)
2. `Read(<preset 目录>/<referenceDoc>)`——例如 `templates/adapter-presets/xtaro.reference.md`
3. 按参考手册顶部的"§六 agent 快速参考"给出的顺序,遍历本文件所有 index.tsx 的 JSX 逐条对照:
   - 值域映射 → 改 prop 值(必要时同步改 prop 名);无 valueMap 命中的值退化为默认值 + QA warn
   - 布尔取反 → 改 prop 名 + 值取反(字面 boolean 对换、变量引用加 `!`)
   - 事件签名转换 → 改 prop 名 + 改回调函数体(例如 `(text)=>...` 改成 `(e)=>...,e.detail.value` 替代 `text`)
   - 结构变化 → 按手册规则重塑 JSX(拆 prop / 包 XView / 删 prop)
   - 无跨端支持 → 直接删属性 + 写入 §7 QA warn 段(列文件名 + 行号 + 属性名 + 手册对应节号)
4. 未在参考手册出现的属性**一律保留原样**;`style / key / ref / children / className` 永远不改(与 §5.5.3b 兜底一致)

**若 preset 未声明 referenceDoc 或文件不存在**:跳过本步(§5.5.3c 无副作用),继续 §5.5.4;若声明但读取失败,写入 §7 QA warn:"预设 <name> 声明 referenceDoc=<path> 但读取失败,已跳过复杂差异处理"。

**与 §5.5.3b 的分工**:

| 差异形态 | 处理载体 | 生效步骤 |
|---|---|---|
| prop 名不同,值和语义一样(如 `maxLength → maxlength`) | `xtaro.json` `propMap` | §5.5.3b(声明式) |
| prop 名可能相同,取值域不同 | `xtaro.reference.md` §一 值域映射 | §5.5.3c(查手册) |
| 值需要布尔取反(如 `editable → disabled`) | `xtaro.reference.md` §二 布尔取反 | §5.5.3c |
| 回调签名不同,回调体要改 | `xtaro.reference.md` §三 事件签名转换 | §5.5.3c |
| 一个 prop 拆多个 / 需要包一层 | `xtaro.reference.md` §四 结构变化 | §5.5.3c |
| 目标框架不支持,需删属性 + warn | `xtaro.reference.md` §五 无跨端支持 | §5.5.3c |

**为什么不把复杂差异也放 JSON**:v1 语法保持简单,任何 preset 作者靠看 README 就能写正确;复杂差异走 md 让作者用**表格 + code snippet** 讲清楚,SKILL 读 md 拿到明确的 case + before/after,比"猜 v2 JSON schema 语义"稳。

**步骤 5.5.3d 产物自检(RN 残留属性扫描,防 §5.5.3c 漏执行)**

`propMap`(§5.5.3b) + `referenceDoc`(§5.5.3c) 都跑完后,agent 必须对**每个改写后的 index.tsx** 做一次残留扫描:如果目标框架已经把某个 RN 原生属性/取值改成了别的名字,产物里**不该再出现原 RN 写法**。

**触发条件**:`config.adapter.enabled === true` 且 tagMap 里至少存在一条**目标标签名不是 RN 原名**的映射(例如 `View → XView`,即"启用了非 RN 目标框架";纯 RN preset `rn.json` 全部 tagMap 保持原名 → 不触发本自检)。

**执行动作**:

1. 拉全本次生成的所有 tsx/jsx 文件文本(step 5.5.3c 已完成改写)
2. 逐文件逐行按下表 grep(允许属性名前后有空格/换行,值形态含字面量 / `{true}` / `{变量}`):

| 命中模式 | 严重级 | 语义 | 应做的处理 |
|---|---|---|---|
| `resizeMode=` 出现在目标标签(如 XImage/MyImage) | **error** | §5.5.3b propMap 或 §5.5.3c §1.1 未执行 | 强制回改:按 §1.1 valueMap 改值并按 propMap 改名(preset 未配 propMap.Image.resizeMode 时也要在此步补齐) |
| `horizontal=` / `horizontal ` / `horizontal>` 出现在目标 ScrollView 标签 | **error** | §5.5.3c §4.1 未执行 | 强制回改:按 §4.1 拆成 `scrollX/scrollY` |
| `contentContainerStyle=` 出现在目标 ScrollView 标签 | **error** | §5.5.3c §4.2 未执行 | 强制回改:按 §4.2 包一层目标 View 标签 |
| `showsHorizontalScrollIndicator=` / `showsVerticalScrollIndicator=` | **warn** | §5.5.3c §五(ScrollView 不支持) 未执行 | 删属性 + §7 QA warn |
| `editable=` 出现在目标 Input 标签 | **error** | §5.5.3c §2.1 未执行 | 强制回改:按 §2.1 改成 `disabled` + 值取反 |
| `onChangeText=` 出现在目标 Input 标签 | **error** | §5.5.3c §3.1 未执行 | 强制回改:按 §3.1 改成 `onInput` + 回调体读 `e.detail.value` |
| `onPress=` / `onPressIn=` / `onPressOut=` 出现在目标标签(非 RN 原生 Pressable) | **error** | §5.5.3c §3.2/§3.3 未执行 | 强制回改:按 §3.2/§3.3 改成 `onClick` / `onTouchStart` / `onTouchEnd` |
| `keyboardType=` 出现在目标 Input 标签 | **error** | §5.5.3b propMap 或 §5.5.3c §1.2 未执行 | 强制回改 |
| `returnKeyType=` 出现在目标 Input 标签 | **error** | §5.5.3b propMap 或 §5.5.3c §1.3 未执行 | 强制回改 |
| `source=` 出现在目标 Image 标签 | **error** | §5.5.3b propMap.Image.source→src 未执行 | 强制回改 |
| `maxLength=` / `secureTextEntry=` / `autoFocus=` / `onSubmitEditing=` / `onEndReached=` / `onEndReachedThreshold=` 出现在目标标签 | **error** | §5.5.3b propMap 未执行 | 强制回改 |

3. 命中 **error** 级 → agent **必须**回到 §5.5.3b/c 对该文件重跑一遍,直到自检干净;若因某种原因确实无法改(例如目标框架实际就叫 `resizeMode`,preset 也没声明改名),必须在 §7 QA 段用 **error** 级列出文件名 + 行号 + 属性名 + 原因,不允许静默留残留。
4. 命中 **warn** 级 → agent 删属性 + §7 QA 段 warn。
5. 自检结果无论是否命中都必须在 §7.3 输出**一行汇总**:"§5.5.3d 自检:扫描 X 个文件,发现 error N 条 / warn M 条(具体见 §7 QA 段);已回改 K 条"。

**为什么加这一步**:preset 声明了改名 / reference 声明了值域映射,但 §5.5.3b/c 是"按规则改",没有"改完再验一次"的兜底。历史事故:XImage 保留 `resizeMode="cover"` 与 XScrollView 保留 `horizontal + contentContainerStyle + showsHorizontalScrollIndicator` 三连,都属于 §5.5.3c 阶段直接跳过、产物按 RN 原写法交付。这一步用产物 grep 兜住整个链路,是漏执行的唯一防线,不允许跳过。

**豁免**:若 tagMap 全部保持 RN 原名(如 pure RN preset `rn.json`),整步跳过 —— 此时保留 `resizeMode=` 等属性是正确的。判据是"至少一条 tagMap value ≠ key"。

**步骤 5.5.4 重写 import 段**

原始 import(未启用 adapter 时):

```tsx
import { View, Text, Image, Pressable, TextInput, ScrollView, StyleSheet, Dimensions } from 'react-native'
```

应用 adapter 后按下述分组重新生成:

1. 收集本文件用到的所有映射后的标签(如 `MyView` / `MyText` / `MyImage`)
2. 收集本文件用到的所有未映射的原生标签(如 `Pressable`,若 tagMap 里没有映射)
3. 收集本文件用到的所有 RN API(如 `StyleSheet` / `Dimensions`)
4. 按 importMap 把每个标签归到目标 import 源:
   - 映射后标签 + importMap 有条目 → 用条目里的路径(如 `my-rn-lib`)
   - 映射后标签 + importMap 无条目 → 用 `react-native` fallback + QA info 告警
   - 未映射的原生标签 → 用 `react-native`
   - RN API(StyleSheet / Dimensions) → 用 `react-native`
5. 每个 import 源合并为一条 import 语句

**示例:启用某个 adapter 预设后**(下面用中性占位 `MyView` / `MyText` / `MyPressable` / `my-rn-lib` 展示合并逻辑,具体标签名由项目 config 里的 tagMap / importMap 决定,某预设可能把 `Pressable` 直接归到 `MyView`,SKILL 侧照配置执行即可)

原始产物:

```tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'

export default function Login() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>标题</Text>
      <Pressable style={styles.btn}>
        <Text style={styles.btnText}>登录</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({ /* ... */ })
```

应用 adapter 后(设 tagMap 三个都映射到 `MyView / MyText / MyPressable`,importMap 都指向 `my-rn-lib`):

```tsx
import React from 'react'
import { MyView, MyText, MyPressable } from 'my-rn-lib'
import { StyleSheet, Dimensions } from 'react-native'

export default function Login() {
  return (
    <MyView style={styles.root}>
      <MyText style={styles.title}>标题</MyText>
      <MyPressable style={styles.btn}>
        <MyText style={styles.btnText}>登录</MyText>
      </MyPressable>
    </MyView>
  )
}

const styles = StyleSheet.create({ /* ... */ })
```

**步骤 5.5.5 adapter 应用禁止项**

- **禁止改动 style 对象内容**:adapter 只改标签名 + import 路径 + 声明过的 prop 名,不改 style 属性
- **禁止改动未声明的 props**:如 `<TextInput placeholder="..." />` 若 propMap 里没声明 `placeholder`,adapter 后仍是 `<MyInput placeholder="..." />`,保留原样
- **禁止改动 propMap 未覆盖的属性值**:propMap 只重命名 prop 名(左侧),不动 prop 值(右侧)
- **禁止改动 children**:文本 / 嵌套组件都保留
- **禁止对 StyleSheet / Dimensions 等 API 应用 tagMap / propMap**:这些是"工具"不是"标签"
- **禁止重命名 React 保留 prop**:`style` / `key` / `ref` / `children` / `className` 即便声明在 propMap 里也必须跳过

#### 5.1 data-node-id 守恒律（v0.3.7 新增，flat 模式必查，强制 grep 自证）

**核心公式**：设 sub-agent 全部产物的 `data-node-id` 集合为 S₁，主 agent 合并后最终产物的 `data-node-id` 集合为 S₂，**必须满足** `S₁ ⊆ S₂`（sub-agent 交付的每一个 nodeId 都必须出现在最终产物中；主 agent 可以新增，但不允许丢失）。

**grep 自证命令模板**（主 agent §6.0 前必须运行并把结果输出到对话）：

```bash
# 1. 提取 sub-agent 全部产物的 data-node-id 集合 S₁
grep -ho 'data-node-id="[^"]*"' {output.dir}/blocks/**/index.tsx 2>/dev/null | sort -u > /tmp/sub-ids.txt

# 2. 提取最终产物的 data-node-id 集合 S₂
grep -ho 'data-node-id="[^"]*"' {output.dir}/{ComponentName}/index.tsx | sort -u > /tmp/final-ids.txt

# 3. 差集 S₁ - S₂（必须为空）
comm -23 /tmp/sub-ids.txt /tmp/final-ids.txt > /tmp/lost-ids.txt
LOST=$(wc -l < /tmp/lost-ids.txt)

if [ "$LOST" = "0" ]; then
  echo "✅ data-node-id 守恒律通过：$(wc -l < /tmp/sub-ids.txt) 个 sub-agent 产出的 nodeId 全部保留"
else
  echo "❌ 丢失 $LOST 个 data-node-id：$(cat /tmp/lost-ids.txt | tr '\n' ' ')"
  echo "   合并失败：必须回滚，重新按 sub-agent 产物逐字展开，禁止用父容器整体切图替代"
fi
```

**RN 侧特别说明**：RN 产物一样在生成的组件根节点上打 `data-node-id="{figma nodeId}"`（作为 debug 属性，最终由 adapter 阶段或 `pp-strip-nodeid` 清理）；grep 逻辑与 H5 完全一致。

**doctor 关联规则**：SUB027（v0.3.7 新增，error）—— 参见 pp-doctor §3.6p。

---

### 步骤 6：主 agent 合并验收

合并完成后，主 agent **必须**做两轮视觉验收（顺序不可调换）：

#### 6.0 逐叶子 sub-block 单独视觉对比

> **核心原则**：无论 `merge.mode` 是 `component` 还是 `flat`，**主 agent 都必须对每个叶子 sub-agent 产出的 block 做单独的视觉对比**，而不是只对合并整体看一眼大图。
>
> **叶子 sub-block 的定义**：在 `.d2c-tasks.md` 树状清单中**没有任何子 sub-** 的 block。父 block 不单独对比（其视觉效果 = 内层叶子的总和，会重复检查）；父 block 的协调由 §6.1 整体验收兜底。

**为什么必须逐叶子对比**：

- sub-agent 在 §4.8 做的是**自我验收**——同一上下文里写完代码再看截图，视觉差异极易"看不到自己的盲点"（self-blind）。这是大模型生成代码的已知 bias，不是某个 sub-agent 的能力问题
- flat 模式合并后子组件结构被打散在同一文件里，**整体大图扫一眼很难定位到具体某个 block 的局部偏差**（尺寸 1px / 颜色 #abc vs #abd / 字号差 1pt）
- component 模式虽然 block 还在独立目录，但主 agent §6 整体验收时，目标节点 nodeId 是页面根，得到的截图分辨率被压缩到容纳整页，**单个 block 内部细节在大图里像素不够看**
- `switchAgentVerification=true` 的本意就是 sub 写、主验，本节落地这条配置在 D2C 主流程里的意义
- **嵌套 sub- 场景**：父 block 含若干内层 sub-，父 block 的视觉效果 = 内层叶子 sub- 的拼接 + 父 block 自己的非 sub 内容。逐叶子对比 + §6.1 整体验收 已能覆盖；额外对比父 block 是冗余

**步骤**：

对 `.d2c-tasks.md` 中**每个叶子 sub-block**（无内层 sub- 的 block），主 agent 依次执行：

1. 调脚本获取该 block 原始设计稿截图：

   ```bash
   node .claude/skills/pp-d2c-rn/bin/figma.mjs screenshot <fileKey> <leafBlockNodeId> --tag=leaf --scale=2
   ```

   stdout 返回 `{path}`，本地绝对路径 `{projectRoot}/.d2c-tmp/screenshots/leaf-<nodeId_safe>.png`。用图片查看器 zoom 100% 看即可对齐细节。SKILL 结束时统一清理。
2. 在浏览器或 dev-server 中定位合并后该 block 渲染出的 DOM 区域，截图相同区域（可用浏览器开发者工具的 element capture / 或本地起 dev-server 后用 puppeteer/playwright 截图）
3. 两张图并排对比，聚焦四类差异：
   - **尺寸**：宽 / 高 / padding / margin / gap 是否对齐（对齐铁律见下）
   - **颜色**：色值偏差（允许 ΔE ≤ 3，即视觉等同）
   - **字号 / 字重 / 行高**：文本节点逐项核对
   - **位置 / 排列**：子元素相对父容器的位置、子元素之间的相对关系
4. 任何差异：先尝试主 agent 自动修正（改 scss 数值）；改不了的写入交付清单 `## 待人工核对`，标明"block 名 + nodeId + 具体差异 + 建议修复方向"
5. 验收通过后，在 `.d2c-tasks.md` 对应叶子 block 行后追加 `(主验通过)` 标记；非叶子父 block 等其所有叶子子项都标 `(主验通过)` 后，自动标 `(子项已主验)`

**对齐铁律**（逐叶子 block 对比时遵守）：

| 检查项 | 容忍区间 | 超出怎么办 |
|--------|---------|-----------|
| 宽 / 高 | ±2px | 改对应 css 数值，不允许靠 transform / scale 凑 |
| 间距（padding/margin/gap） | ±1px | 同上；若用了负 margin 凑，先核对图片是否带光晕外扩（见 §4.4 use_absolute_bounds） |
| 颜色 | ΔE ≤ 3 | 用 Figma 取色值替换，不允许"看起来差不多" |
| 字号 | 完全相等 | 设计稿是真值，不允许改 |
| 字重 | 完全相等 | 同上 |

**叶子 sub-block 之间的"接缝"也要看**：flat 模式下相邻叶子在 JSX 里挨着，但视觉上可能有意外的间距（因为各自的 margin/padding 叠加）。整体验收时容易漏看，**这一步逐叶对比时也要把当前叶子的"上边界"和"下边界"与原稿对齐**。父 block 内多个叶子之间的接缝同理。

#### 6.0.1 手工调整数值的溯源铁律(反幻觉)

**核心规则**:§6.0 阶段主 agent 手工调 style 数值(改 `marginLeft` / `marginTop` / `padding*` / `top` / `left` / `width` / `height` / `gap`)前,**必须先输出 3 行溯源自答到对话**,答不齐禁止改数值。

**溯源自答模板**(每次改数值前粘贴到对话):

```
调整目标: <block 名>#<nodeId> 的 <属性名>,从 <原值> 改为 <新值>
1. Figma bbox(必答): 该节点的 absoluteBoundingBox.{x,y,width,height} = ?(来自 fetch-node,不允许凭截图估)
2. 父容器布局(必答): 父 Frame 的 layoutMode / primaryAxisAlignItems / counterAxisAlignItems / itemSpacing / padding* = ?
3. 视觉幻觉排查(必答): "看起来错位"是不是子 TEXT 节点自己 textAlignHorizontal=CENTER,而容器本身靠左?或者子层某个 img/bg 带光晕导致视觉外扩?
```

**判定标准**:

| 自答情况 | 允许操作 |
|---------|---------|
| 3 行都能从 Figma JSON 事实回答 | 可改数值,新值必须等于"Figma 事实计算结果",不允许四舍五入或凑整 |
| 第 1 行答不出(没拉过 fetch-node) | **禁止改**,先 `fetch-node <fileKey> <nodeId>` 拿真值 |
| 第 2 行答不出(不知道父 layout) | **禁止改**,同上先 fetch |
| 第 3 行发现是文字居中幻觉 / 光晕外扩 | **禁止改容器 marginLeft**,应改文字节点 `textAlign` 或重切图去光晕 |
| 无法从 Figma 事实推出新值,只是"看着舒服" | **禁止改**,写入 `## 待人工核对`,标明"视觉判断,需设计确认" |

**为什么需要这一步**: 大模型在 §6.0 对比截图时容易触发两类"视觉幻觉":

1. **文字居中幻觉**: 子 TEXT 节点 `textAlignHorizontal=CENTER` 让文字视觉居中,但容器本身 `absoluteBoundingBox.x` 靠左。agent 误判"整个容器该居中",在容器上加 `marginLeft: <(父宽 - 容器宽)/2>` — 数值编造,不来自 Figma。
2. **光晕外扩幻觉**: `bg-` / `img-` 切图未加 `use_absolute_bounds=true` 导致 drop-shadow / outer-stroke 烤进 PNG,视觉边缘外扩几像素,agent 误判"该加负 margin 或减 padding" — 应该重切图,不是改数值。

**违反本节的后果**: 手工调的数值无 Figma 溯源 → §6.1 整体验收看不出问题(因为 agent 自己改的自己看不出错),但**上线后与其他 block 拼接时错位显现**。所以本节是 §6.0 的强制前置,不是可选。

**豁免场景**(不需要 3 行自答):

- 只改颜色 / 字号 / 字重 / 圆角 / 阴影这类"值型属性",且新值直接取自 Figma JSON 的 fills/strokes/style(不涉及位置尺寸计算)
- 修正 §6.0 双重间距 checklist 命中的结构性问题(如删掉 flex + margin 混用中的 margin) — 这类是"改错误结构",不是"手工调数值"

**双重间距 / 布局违反检测 checklist**：

对每个叶子 block 产出的 `.tsx` / `.scss` 文件（或对应片段），**逐项静态扫描**：

1. **flex + margin 混用**：是否存在父级同时出现 `display: flex` 且直接子代出现 `margin-{top|right|bottom|left}`？（`margin: auto` / 居中用途除外）
2. **padding + first/last-child margin 冲突**：是否存在父级 `padding-{side}` 且子代规则 `:first-child { margin-{same-side} }` 或 `:last-child { margin-{same-side} }`？
3. **absolute + margin 冲突**：是否存在元素同时具有 `position: absolute` 或 `position: fixed` 且 `margin-*`？（`margin: auto` 用于居中除外）
4. **autoLayout 违反 flex 强制**：对照 Figma 原始 JSON，是否存在 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 的 Frame，输出的 CSS 却用了 `position: absolute` + `top/left`？（此项是 §4.3 判定优先级第 1 条的硬红线）
5. **space-between 表达不忠实**：是否存在 Figma `primaryAxisAlignItems === 'SPACE_BETWEEN'`，输出的 CSS 却用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟？
6. **`layoutPositioning` 未落地**：是否存在 Figma `layoutPositioning === 'ABSOLUTE'` 的子节点，输出的 CSS 却没写 `position: absolute` + `top` / `left`（结果被塞进父 flex 顺流，视觉错位）？或反之：`layoutPositioning === 'AUTO'` / 缺失的子节点被误加 `position: absolute`？
7. **子节点 `FILL` / `STRETCH` 未落地**：是否存在 Figma 子节点 `layoutSizingHorizontal === 'FILL'` 或 `layoutAlign === 'STRETCH'`，输出的 CSS 却没写 `width: 100%` / `align-self: stretch`？典型表现：子内容明明该撑满父可用宽（Figma 里子和父同宽或仅差 padding），实际渲染却按内容宽度收缩，父上还常常错配 `align-items: center` 挡着——**父视角必须**用 `align-items: stretch` 或**删除** `align-items` 行让 flex column 走默认（stretch），子视角**加 `width: 100%`**（一并加 `box-sizing: border-box` 让 padding 不撑破容器）。反向也查：`FIXED` / `INHERIT` 的子被误加 `width: 100%` 也算错。
8. **`end-` 前缀未生成 wrapper + `space-between` 结构**：图层名带 `end-` 的节点（不含 `bg-` / `bgc-` / `x-` 叠加，且不含 `fixed-` 叠加），产物 JSX 里其父容器是否有虚拟 wrapper 包裹前面兄弟、父 CSS 是否设置 `justify-content: space-between`？若父 layoutMode = `VERTICAL` 但产物用 `absolute + bottom: 0` / `margin-top: auto` 等其他手段模拟，也算不合规（本方案唯一实现路径是 wrapper + space-between，见 §4.3）。反向查：`end-` 节点是否是父的最后一个子（不是则不合规）、父是否 autoLayout（不是则不合规）。
9. **rn 页面根未套用强制 ScrollView 骨架 / fixed-* 未全部放外层**（本项 rn 分支强制）：顶层入口节点（用户 URL `node-id` 指向的那一层，非 sub-agent 派发进来的 block）产物是否是 `<View flex:1 relative> > <ScrollView flex:1> > <View scrollContent minHeight> > 内容` + `<View>` 根下 **所有** `fixed-*` 兄弟？是否漏套 ScrollView 让根 `<View>` 直接装内容？是否把 `overflow: 'hidden'` 写到根或 scrollContent（会阻止滚动）？**是否有任何 `fixed-` 前缀节点被留在 ScrollView 内部**（RN 内没有 fixed，ScrollView 内的 absolute 会跟内容滚 → 必须全部放外，不区分 constraints、不判"设计师是不是本意贴屏"）？scrollContent 是否用 `minHeight: rpx(figmaH)` 而非 `height`（用 `height` 会硬裁）？见 §2.5「页面根骨架」+「fixed-* 分层规则」。反向查：sub-agent 派发进来的内层 block **不应**套 ScrollView 骨架（那是主入口才做的事），若被误套也算不合规。<br/>本检查针对**内核语义**;若 adapter §5.5 已应用(如 xtaro tagMap `View→XView` / `ScrollView→XScrollView`),用目标标签名做等价对照即可。
10. **`input-` 前缀未生成 `<input>` 标签**：图层名带 `input-` 的节点（不含 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加），产物 JSX 是否输出 `<input type="text" placeholder="..." />`？是否漏输出 `<div>` + `<span>` 结构而绕过 `input-` 语义？CSS 是否把左侧图标切图挂在 `background-image`（不生成独立 `<img>` 子节点）？`::placeholder` 颜色是否取自 TEXT 子节点的 `fills[0]`？反向查:图层里没有 `input-` 前缀却被误改成 `<input>` 标签也不合规。同时校验 doctor 侧 4 条 NAM 规则是否触发(NAM017 无 TEXT / NAM018 多 TEXT / NAM019 与 bg 系叠加 / NAM020 与 img/btn 叠加)。
11. **sub-/block- 容器 FIXED 高度未写 `minHeight` 导致塌陷 / 绝对定位背景层用了 `%` 而非 Figma 事实尺寸**：两方面同查——**a) 容器高度**：图层名带 `sub-` / `block-` 前缀、Figma `layoutSizingVertical: FIXED`,且该容器内部有 `layoutPositioning: 'ABSOLUTE'` 且铺满的兄弟子节点(典型:`main` 内含 `mainBg` 绝对铺满作背景层),产物 StyleSheet 是否用了 `height: <N>` 死值? 必须改成 `minHeight: <N>`。**b) 背景层尺寸**：铺满兄弟层是否用了 `width/height: '100%'` 或 `StyleSheet.absoluteFillObject`? 当父用 `minHeight` 时,`%` 值会引用父的**计算高度**（可能小于 Figma 设计稿高度）,导致背景层跟着塌陷或与父尺寸不同步。必须写 Figma 事实固定尺寸 `width: rpx(w), height: rpx(h)` + `top: 0, left: 0`。反向查:叶子/装饰元素(`img-` / `bg-` / `btn-` 等)不应误用 `minHeight`,那些场景仍写 `height`。参见 §4.1.1 §A 表下方「FIXED 塌陷防御」+ §4.3.rn 退化表 `bg-` 条目。
12. **冗余嵌套 autoLayout 的属性未下穿到内层(v1.0.2 新增)**:外层 A 是 autoLayout 且仅有 1 个顺流子 B(其他都是 abs 兄弟),B 也是 autoLayout,且 A/B 都不带 `sub-` 前缀 → 检查产物:A 的 StyleSheet 里是否残留 `flexDirection` / `padding*` / `gap` / `justifyContent` / `alignItems` / `flexWrap`?这些**必须**全部下穿到 B,A 只保留 `position / overflow / width / height / backgroundColor / borderRadius / shadow*` 等骨架属性;A/B 同名冲突时以 B 为准,A 的值写入 §7 QA info。反向查:命中"A 或 B 带 sub- 前缀"时**不该**下穿(sub- 边界要保持样式命名空间独立),若被误下穿也算不合规。参考 §4.1.1 §A 表下方「冗余嵌套 autoLayout 的属性下穿」补充说明。

**任一项命中 → 该叶子 sub-agent 交付不合格,主 agent 必须回退该块重写**(不是自己改 scss 数值糊过去;这是结构性问题,改数值没用)。回退命令:把该叶子 nodeId 重新按 §4.0 派发一次 sub-agent,把本节 checklist 内容作为额外约束附加进去。

**常见触发原因与修复方向**：

| 触发原因 | 修复方向 |
|---------|---------|
| 父 Frame `layoutMode` 是 autoLayout，但子层混有 `fixed-` 兄弟 → agent 保守把父写成 `relative` + 其他子层全 `absolute` | 父仍走 flex，`fixed-` 子层作为普通 flex 子项写在 DOM 里；其 `position: fixed` 会自动从 flex 顺流脱出，不占位置、不影响其他兄弟 |
| 父 Frame `layoutMode` 是 autoLayout，但子层坐标看起来"重叠"（其实是 padding 撑开的） | Figma padding 已经把子层推到位置，父走 flex + padding 即可；不要把父的 padding 翻译成子的 `top` |
| Agent 把 Figma `paddingTop` 同时翻成父 `padding-top` 和子 `position: absolute + top` | 只保留父 `padding-top`（间距单一来源铁律第 2 条），删掉子的 `absolute + top` |
| Figma `primaryAxisAlignItems: SPACE_BETWEEN` 被翻成 `margin-left: auto` / `justify-content: flex-end` | 直译成 `justify-content: space-between`（§4.1.1 §A 表最后一列） |
| Figma 子节点 `layoutPositioning: ABSOLUTE` 被漏读，agent 按父 autoLayout 顺流处理该子层 → 视觉错位 / 覆盖关系错 | 该子层写 `position: absolute` + `top`/`left`（父.bbox 减出来）；父容器加 `position: relative`；其他 `AUTO` 兄弟保持 flex 顺流不变 |
| Figma 子节点 `layoutSizingHorizontal: FILL` / `layoutAlign: STRETCH` 被漏读，且父错配 `align-items: center` → 子按内容宽度显示，看起来"width:100% 没生效" | 子加 `width: 100%`（`layoutSizingHorizontal: FILL`）或 `align-self: stretch`（`layoutAlign: STRETCH`）；父的 `align-items` 从 `center` 改成 `stretch` 或删除（flex column 默认 stretch）；父有 `padding-*` 时同时加 `box-sizing: border-box`，避免 padding 撑破 fixed 宽度 |
| Figma 图层名带 `end-`（表达"贴父末端"），agent 用 `margin-top: auto` / `position: absolute; bottom: 0` / 增大最后一项 gap 等其他方式模拟 | 按 §4.3 "`end-` 逆向布局规则" 唯一实现路径：把前面兄弟包成 wrapper，父加 `justify-content: space-between`。禁止其他实现方式（会绕过 doctor 校验）。父不是 autoLayout / end- 不在末位 / 多个 end- / end- 与 fixed- 同现 → 走 doctor LAY017-020 分支处理，不生成 wrapper |
| 页面根容器用 `height: 1624px` / `min-height: 1624px` 死值 → 设备高度 >812pt 时底部露白、`end-` 节点无法真正贴屏底 | 判定"页面根容器"三信号 AND（入口 nodeId + 父是 Page/Document + 高度接近视口）通过后，覆写根 CSS：`min-height: max({figmaH * scale}px, 100vh)`；内部 `layoutPositioning: ABSOLUTE` 背景层同步改 `height: 100%` + `background-size: cover`（见 §4.3 判定优先级第 6 条）|
| Figma 图层名带 `input-`（表达输入框），agent 生成 `<div>` + `<span placeholder-text>` + `<span icon>` 结构而不是 `<input type="text">` → 表单无实际输入能力、语义缺失、无障碍差 | 按 §4.3 "`input-` 输入框规则" 生成 `<input type="text" placeholder="..." />` 单标签,图标切图作 `background-image`,`::placeholder` 颜色取自 TEXT 子节点 fills;不再递归子层。命中 doctor NAM017-020 时按各自 fix 处理(补 TEXT / 保留一个 TEXT / 拆分冲突前缀) |

#### 6.0.2 assets.txt 消费契约（v0.3.7 新增，强制 grep 自证，RN 版）

**核心公式**：设所有 `blocks/*/assets.txt` 声明切了的文件名集合为 F₁，最终产物（`.tsx`/`.jsx`/`.ts`/`.js`）中被引用的文件名集合为 F₂，**必须满足** `F₁ ⊆ F₂`。

**RN 侧引用形式**（比 H5 多两种写法）：

- `<Image source={require('...xxx.png')} />` （静态 require）
- `<Image source={{uri: `${ASSET_PREFIX}xxx.png`}} />` （动态 URI）
- `<ImageBackground source={...} />` （同上两种）
- `<FastImage source={{uri: '...xxx.png'}} />` （第三方库）
- `require('.../assets/xxx.png')` （单独 require 语句）

**grep 自证命令模板**（主 agent §6.1 前必须运行并把结果输出到对话）：

```bash
# 1. 从 assets.txt 提取 F₁
grep -Eho '^- +[^ ]+\.(png|svg|jpg|jpeg|webp)' {output.dir}/blocks/**/assets.txt 2>/dev/null \
  | sed 's/^- *//' | sort -u > /tmp/declared-assets.txt

# 2. 从产物提取 F₂（RN 版：require + uri + ASSET_PREFIX 模板字面量都覆盖）
grep -rEho '(require\([`"'\''][^`"'\'']*|source=\{\{uri:\s*[`"'\''][^`"'\'']*|source=\{require\([`"'\''][^`"'\'']*)' {output.dir}/ --include='*.tsx' --include='*.jsx' --include='*.ts' --include='*.js' 2>/dev/null \
  | grep -oE '[A-Za-z0-9_-]+\.(png|svg|jpg|jpeg|webp)' | sort -u > /tmp/used-assets.txt

# 3. 差集 F₁ - F₂（必须为空）
comm -23 /tmp/declared-assets.txt /tmp/used-assets.txt > /tmp/unused-assets.txt
UNUSED=$(wc -l < /tmp/unused-assets.txt)

if [ "$UNUSED" = "0" ]; then
  echo "✅ assets.txt 消费契约通过：$(wc -l < /tmp/declared-assets.txt) 张切图全部在产物中引用"
else
  echo "❌ $UNUSED 张切图未被引用：$(cat /tmp/unused-assets.txt | tr '\n' ' ')"
  echo "   可能原因：主 agent 用父容器整体切图（如 sub-ui-frame734.png）替代了这些拆分产物 → 触发 SUB027 / IMG028"
fi
```

**doctor 关联规则**：IMG028（v0.3.7 新增，error）—— 参见 pp-doctor §3.6q。

#### 6.0.3 合并忠实度证明块（v0.3.7 强制，主 agent 交付前必写）

主 agent 在步骤 7（输出交付物清单）**之前**必须在对话中输出以下证明块，**未输出即视为交付不合格**：

```markdown
=== 合并阶段忠实度证明（RN 版）===

## data-node-id 守恒律（§5.1）
- sub-agent 产物 nodeId 数：{count(S₁)}
- 最终产物 nodeId 数：{count(S₂)}
- 差集 S₁ - S₂：{"空" 或 "lost: id1, id2, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## assets.txt 消费契约（§6.0.2）
- sub-agent 声明切图数：{count(F₁)}
- 最终产物引用切图数：{count(F₂)}（含 require + uri + ASSET_PREFIX 三种形式）
- 差集 F₁ - F₂：{"空" 或 "unused: file1.png, file2.png, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## 节点整体切图适格性核查（§4.4.pre + §4.4.pre.b）
- 本轮切图节点是否包含 `sub-*` / `block-*` 前缀？{否 / 是: node list}（前缀维度）
- 本轮切图节点中，是否存在其 Figma 子树含 ≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点？{否 / 是: node list}（v0.3.9 结构维度）
- 结果：{✅ 通过 / ❌ 失败}

## 未打断用户核查（v0.3.8 新增，§问题边界）
- 本轮 agent 是否向用户提过任何 skill 已定死的技术决策问题？（切图/兜底/合并/尺寸/RN 退化等）{否 / 是: 问题清单}
- 若遇 skill 未覆盖的边界情形，是否已按最接近规则兜底 + 写 QA 告警而非打断用户？{是 / 否: 说明}
- 结果：{✅ 通过 / ❌ 失败}

## 字色 fills 溯源（v0.3.10 新增，§4.1.1）
- 所有 TEXT 溯源行的 `最终写入=#hex` 集合大小：{count(declared)}
- 产物中 `color:` 字段（3 种写法：`'#hex'` / `"#hex"` / 裸 `#hex`）集合大小：{count(used)}
- 差集 declared - used：{"空" 或 "lost: #hex1, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## sub 容器 minHeight 尺寸源（v0.3.10 新增，§4.3）
- 逐 sub-/block- 容器 `minHeight 写入 == 自身h`（RN scale=1）断言错项数：{count(errors)}
- 错项列表（若非零）：{"[节点名] 应写 XXX 实写 YYY（把兄弟 bg 层高度错写为 minHeight）"}
- 结果：{✅ 通过 / ❌ 失败}

## 页面根 paddingTop 尺寸源（v0.3.10 新增，§4.3.1）
- 逐页面 `paddingTop 写入 == figmaPaddingTop` 断言错项数：{count(errors)}
- 错项列表（若非零）：{"[页面名] 应写 XXX 实写 YYY（把 fixed 状态栏高度错写为 paddingTop）"}
- 结果：{✅ 通过 / ❌ 失败}
```

任意一条 ❌ 失败 → 合并阶段不算完成，主 agent 必须回滚，重新按 sub-agent 产物逐字展开。

#### 6.1 整体视觉验收

1. 调 `figma.mjs screenshot <fileKey> <rootNodeId> --tag=whole` 获取原始设计稿**整体**截图，stdout 返回 `{path}`（`.d2c-tmp/screenshots/whole-<nodeId_safe>.png`）
2. 与合并后的完整组件做视觉差异分析
3. 汇总各 block QA 段落中未解决的差异 + §6.0 写入 `## 待人工核对` 的项
4. 可自动修正的整体差异（对齐偏差、间距）直接修正
5. 不可自动修正的差异输出到最终交付清单

> §6.0 和 §6.1 不是冗余：§6.0 看每个 block 内部的局部差异，§6.1 看 block 之间的整体协调差异（如全页背景在不同 block 上是否连续、整页滚动定位是否符合预期）。两者关注点正交。

#### 6.2 图片 URL 自检（强制）

合并完成后，对生成的所有 `.tsx` / `.jsx` / `.scss` / `.less` / `.css` / `.module.scss` / `.module.less` / `.module.css` 文件做一次 URL 自检：

1. 用 grep 扫描所有 `url(` 和 `src=` 出现位置，提取完整 URL 字符串
2. 对每个 URL，按字面公式 `imageBaseUrl + assetsDir + filename` 重新拼接预期值
3. 与实际 URL **逐字符比对**，不一致即修复
4. 检查 SCSS：是否每个 URL 都通过 `$asset-prefix` 变量引用？散落的硬编码完整 URL 必须改为变量引用

> 这一步不依赖视觉对比，是纯字符串校验，**不允许跳过**。

如需跳过，用户可明确说「跳过 QA」。

#### 6.3 记录 last-page(供 pp-fix-partial 定位)

QA 全部通过后,主 agent **必须**把本轮出码的元数据写到 `.d2c-cache/last-page.json`,覆盖旧值(单值语义,不留历史队列)。目的:后续 `pp-fix-partial` 无参调用能定位到"最近实现的那张稿子"。

写入内容(rn 版):

```json
{
  "figmaUrl": "<步骤 -1 用户传入的 figma URL 原文>",
  "fileKey": "<步骤 0.3 解析出的 fileKey>",
  "rootNodeId": "<步骤 -1 用户传入的 nodeId,注意冒号形式 138:1797>",
  "outputDir": "<步骤 5 实际写入的组件目录,如 src/pages/Italo>",
  "outputEntryFile": "<主入口文件,如 src/pages/Italo/index.tsx>",
  "figmaTreeHash": "<对子树 REST JSON 求 shasum -a 1>",
  "generatedAt": "<ISO8601,如 2026-08-05T10:23:44Z>",
  "framework": "rn",
  "styleFormat": "stylesheet"
}
```

写入方式:

```bash
mkdir -p .d2c-cache
cat > .d2c-cache/last-page.json <<'EOF'
{ ... 上面结构 ... }
EOF
```

**注意**:
- 如果 `.d2c-cache/last-page.json` 已存在(用户上次跑过别的页面),**直接覆写**,不追加、不合并
- 如果本轮 QA 未通过、用户手动终止 → **不写** last-page.json(避免把失败结果标记成"最近实现")

---

### 步骤 7:输出交付物清单

```
✅ 生成文件:{output.dir}/ComponentName/
📦 需下载图片:(汇总 assets.txt,含原始临时链接)
⚠️  需手动处理:(QA 发现的不可自动修正差异)
🎯 Adapter 应用:{已启用 <预设名> / 已启用自定义 / 未启用,输出原生 RN}
📐 rpx 响应式:{已启用 helper=<helperImport>,包装 X 处属性,跳过 Y 处非白名单 / 未启用,输出纯数字}
🧹 上线前清理:产物已注入 `data-node-id="..."` 调试锚点(用于反查 Figma 节点、方便 review 逐 block 对比),
   上线前请运行 `pp-strip-nodeid` skill 一键清理,或直接执行:
     node .claude/skills/pp-strip-nodeid/strip-node-id.mjs --dry-run   # 先预览
     node .claude/skills/pp-strip-nodeid/strip-node-id.mjs             # 确认后清理
🗑️  临时截图目录:{projectRoot}/.d2c-tmp/screenshots/ 已自动清理(QA 阶段的对比截图,跨会话不保留)
💾 缓存目录:{projectRoot}/.d2c-cache/{fileKey}/ 保留(下次跑同一 fileKey 会自动比对 lastModified 决定复用或作废)
```

#### 7.1 RN 端退化告警(必须输出;若无告警需显式声明"无退化")

按 §4.3.rn "RN 特性退化表"汇总本轮生成产生的所有告警,按级别分组:

```markdown
### RN 端退化告警

**error(必须业务手改)**
- [error] nodeId 163:2400 `sub-blur-modal`:effect LAYER_BLUR 在 RN 无原生对应,请手动接 @react-native-community/blur 或 expo-blur
- [error] nodeId 163:2450 `sub-inner-shadow-card`:INNER_SHADOW 在 RN 无原生对应

**warn(视觉近似,建议复核)**
- [warn] nodeId 163:2321 `fixed-btn-回顶`:fixed 已退化为 absolute,滚动时不保持屏幕位置
- [warn] nodeId 163:2350 `bg-page-gradient`:线性渐变已退化为纯色 #ff6600,如需真渐变请手动接 react-native-linear-gradient
- [warn] nodeId 163:2380 `sub-outline-card`:outside stroke 已按普通 border 渲染

**info(合理默认,通常无需处理)**
- [info] nodeId 163:2300 页面根:已使用 Dimensions.get('window').height 作 minHeight
- [info] nodeId 163:2500 :gap 属性依赖 RN >= 0.71,若使用低版本 RN 请手改为 marginRight/marginBottom
```

**无告警时**:显式输出"✅ 本轮无退化告警,产物在 RN 端语义完整"

#### 7.2 Adapter 应用报告(启用时必须输出)

若 `config.adapter.enabled === true`,输出:

```markdown
### Adapter 应用报告

- Preset:<预设名>(取自 config 或 CLI 选择,如无预设写"自定义")
- tagMap 命中标签:View → <目标>, Text → <目标>, ...(共 X 个)
- propMap 命中属性:Image.source → src(共 X 条,若未启用 propMap 写"未启用")
- 参考手册命中(§5.5.3c):共 X 条(值域映射 A / 布尔取反 B / 事件签名 C / 结构变化 D / 丢弃属性 E);若 preset 未声明 referenceDoc 写"未启用参考手册"
- importMap 应用:<import 源>(合并了 X 个 import)
- 未映射的原生标签:StyleSheet, Dimensions(保留从 react-native 导入)
- 无效条目:0 条(若有,列出并附 QA warn)
```

**SKILL 结束时的清理动作**:

1. `node .claude/skills/pp-d2c-rn/bin/figma.mjs cleanup-tmp`(脚本会 `rm -rf` 掉 `{projectRoot}/.d2c-tmp/screenshots/`)
2. 不清 `.d2c-cache/`——那是持久化缓存,等 `lastModified` 变化时才失效

#### 7.3 响应式 rpx 应用报告(启用时必须输出)

若 `config.unit.responsive.enabled === true`,输出:

```markdown
### 响应式 rpx 应用报告

- Helper:`<helperImport>`(函数名 `<helperName>`,基准 `figmaBase=<N>pt`)
- 已包装属性:width / height / padding* / margin* / gap / borderRadius / fontSize / lineHeight(共 X 处)
- 保留原样(非像素属性):opacity / flex* / color / backgroundColor / fontDirection 等(共 Y 处)
- 白名单未命中(需人工核对):字段 A(nodeId N)、字段 B(nodeId N)(共 Z 处,若为 0 写"无")
- 零值跳过:padding: 0 等零值已保留纯数字,未包装(共 W 处)
```

**未启用时**:显式输出"✅ 未启用响应式 rpx 包装,产物为纯数字 StyleSheet(iPhone SE / 大屏设备物理尺寸会有差异,请手动接响应式方案或改回 rpx)"

---

## 禁止项

- 禁止对"非像素属性"应用 rpx() 包装(见 §4.1.1 §C.1 白名单):`opacity` / `flex*` / `zIndex` / `color` / `backgroundColor` / `fontWeight` / 枚举值(`flexDirection` / `justifyContent` / …)/ 已经是 `'50%'` `'auto'` 的字符串型值 / `Dimensions.get('window').*` / transform 里的 `scale` / `rotate` — 命中这些字段仍写 rpx() 是硬错误,视觉/逻辑都会崩
- 禁止在响应式启用时写 `paddingLeft: rpx('16')` / `paddingLeft: rpx("50%")` 这种非数值字面量传入(rpx 只接受数字);字符串型 / 表达式型的值保留原样
- 禁止修改项目里已存在的 rpx helper 文件(`unit.responsive.helperImport` 指向的路径):SKILL init 阶段"存在则跳过",跑 SKILL 阶段更不允许改;用户可能已定制无障碍逻辑
- 禁止把 `img-` / `bg-` 前缀图层拆解为 CSS 实现
- 禁止在代码中写 HEX 色值或 px 魔法数字（使用 Token 变量，若项目有）
- 禁止跳过步骤 -1 的预检
- 禁止使用 Figma node ID 作为图片文件名
- 禁止 x- / img- / bg- / 无前缀非文本图层向内递归子图层
- 禁止把 `sub-` 前缀当作图层解析规则处理，sub- 仅用于分块判断
- 禁止把 `block-` 块内的元素与其他块的元素合并到同一 HTML 容器或共享 CSS 类名
- 禁止只匹配第一个前缀就停止，必须扫描完整图层名提取所有已知前缀
- 禁止脱离 `images.imageBaseUrl + images.assetsDir + filename` 公式拼接图片 URL；禁止补/删任何字符（包括末尾 `/`）；禁止在 SCSS 中分散硬编码完整 URL，必须先定义 `$asset-prefix` 变量再引用
- 禁止用相对路径下载图片：`curl -o` 落地路径必须是 `{projectRoot}/{assetsDir}/{filename}.{ext}` 绝对路径（`projectRoot` = 步骤 0 缓存的 config 文件所在目录绝对路径）。禁止写 `-o {assetsDir}/{filename}.png` 或 `-o ./static/xxx.png` 等相对形式——sub-agent 的 cwd 未必是项目根，相对路径会把图片落到代码产出目录下的错误相对位置，导致 URL 拼接后 404
- 禁止跳过步骤 2.5「页面根骨架」的强制 ScrollView 结构：所有 rn 页面顶层入口一律 `<View flex:1> > <ScrollView> > <View scrollContent minHeight>`(内核语义;adapter 阶段自动改目标标签名)，不判定"高度是否超视口"；禁止让根 `<View>` 直接装内容而不套 `<ScrollView>`；禁止把根或 scrollContent 写 `overflow: 'hidden'`（会阻止滚动）；**禁止把任何带 `fixed-` 前缀的节点放进 `<ScrollView>` 内部**（RN 内没有 CSS fixed，ScrollView 内的 absolute 会跟内容滚 → 所有 fixed-* 必须放根 `<View>` 直接子层，不区分 constraints，不 agent 推断"设计师是不是本意贴屏"）；禁止在根骨架里用 `Dimensions.get('window').height` / `xGetSystemInfoSync().windowHeight`（那是旧的"三信号 AND 页面根覆写"规则，rn 分支已删）；禁止改动项目已有的 rpx helper 文件（`unit.responsive.helperImport` 指向的路径）
- 禁止 `bg-` 铺满层用 `StyleSheet.absoluteFillObject` 或 `width/height: '100%'`：父容器用 `minHeight` 时，`%` 值引用父的**计算高度**（可能小于 Figma 设计稿高度）会跟着塌陷；必须写 Figma 事实固定尺寸 `width: rpx(w), height: rpx(h)` + `top: 0, left: 0`（见 §4.3.rn 退化表 `bg-` 条目）
- 禁止"sub- 只有 1 个就退化为主 agent 处理"；任何 `sub-` 节点都必须分发独立 sub-agent，**单 sub 也必须拆**（分块是质量保证而非性能优化）
- 禁止 `scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存（语义冲突）；禁止同一节点同时含 `scrollx-` 和 `scrolly-`（一个元素只能一个滚动方向）；禁止省略隐藏滚动条样式（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）
- 禁止把 `sub-scrollx-` / `sub-scrolly-` 节点**整体导出为单张背景图**作为容器 `background-image`：scroll 容器必须**继续递归子层**（§416-417），子层是同构列表项；只有标了 `bgc-` / `bg-` 的子节点才作为背景。即便子层结构复杂、识别困难，也不允许"省事 fallback 到整体导出"——需要时把识别失败的子树标 `x-` 或拆分稿子，不能用整体导出绕过。
- 禁止调用 Figma `/v1/images` 时省略 `use_absolute_bounds=true`：不带此参数会把图层 effect（drop-shadow / outer-stroke / blur）和父背景色一起 render 进 PNG，导致"图都带画板背景色"+"对齐用的 gap / margin 算不准（视觉外扩）"两个 bug 同时发生。仅当某张图明确要把 effect 烤进位图（在 config `images.preserveEffectIds` 列出 nodeId）时才省略。
- 禁止 `FIGMA_TOKEN` 无效时直接跳过图片下载或用 Figma S3 临时链接占位（约 30 分钟过期，代码上线就 404）； 起 token 失败即终止，由用户补 token 后重跑，不再有 MCP 兜底路径
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具；禁止把 MCP `get_design_context` 返回的"参考代码"字段作为渲染依据——项目前缀规则（§4.0 / §4.3）的优先级永远高于任何"AI 生成的通用 D2C 参考代码"
- 禁止跳过步骤 0.3 缓存初始化；禁止绕过 `.d2c-cache/{fileKey}/meta.json` 的 `lastModified` 校验直接读旧缓存（设计稿改过必须整份作废重拉）；禁止 sub-agent 独立校验 `lastModified`（主 agent 校验一次即可）；禁止把 QA 临时截图写进 `.d2c-cache/`（该目录只放跨会话可复用的数据，QA 截图属于 `.d2c-tmp/screenshots/`）
- 禁止 SKILL 结束时不清理 `.d2c-tmp/screenshots/`（跨会话不保留 QA 对比截图，避免污染仓库和 `git status`）
- 禁止把 `bg-` 节点的**父容器**当成切图源传给 `/v1/images` API：切图源 nodeId 必须是 `bg-` 节点自己。把父容器整体切下会导致 `bgc-` 颜色、其他兄弟节点（block-/img-/文本）融合到一张 PNG，违反"`bgc-` 写 CSS 颜色、`bg-` 写 CSS 背景图、内容层独立处理"的分离原则
- 禁止跳过 §4.4 curl 前的**强制前置自检 4 行**（图层前缀类型 / 切图源 nodeId / 切图源 name / 交叉验证 name 是否以对应前缀开头）：这是防止把兄弟文字/图标烤进 bg- 位图的唯一防线，sub-agent 每张图都必须把 4 行输出到对话，交叉验证为"否"必须停 curl 回 §4.0.5 重找 nodeId。**任意一张图省略此自检，视为该 sub-agent 交付不合格，主 agent §6.0 逐叶子对比时必须回退重做整块**
- 禁止把 `bgc-` 节点切成 PNG：`bgc-` 永远只取节点自身的盒级 CSS 属性（fills/strokes/cornerRadius/effects）写父元素，切图是错误实现
- 禁止只取 `bgc-` 节点的 fills 而忽略 strokes/cornerRadius/effects：bgc- 覆盖父元素**全套**盒级 CSS 属性，不只是颜色（参见 §`bgc-` 取值规则）
- 禁止父容器同时有 `bgc-` 和 `bg-` 时只写 `background-image` 不写 bgc- 的其他属性：bgc- 必须独立完整写到 CSS（颜色/渐变/描边/圆角/阴影），不允许靠 `bg-` 图片自带的视觉"代替"——这会让 bgc- 属性无法主题化/动态切换/选中态切换
- 禁止 sub-agent 在切 `bg-` 节点前跳过子树 bgc- 扫描：bg- 内嵌 bgc- 时必须把 bgc- "摘出来"按 bgc- 规则处理（见 §`bg-` 内嵌 `bgc-` 的处理）
- 禁止跳过步骤 6.0「主 agent 逐叶子 sub-block 单独视觉对比」：无论 `merge.mode` 是 `component` 还是 `flat`，每个**叶子** sub-agent 产出的 block 都必须由主 agent 单独逐一对比设计稿截图与代码渲染结果，**禁止用整体大图 §6.1 替代逐块对比**——整体大图分辨率被压缩，单 block 内部的尺寸/颜色/字号偏差在大图里看不见。这是 `switchAgentVerification=true` 在 D2C 主流程里的落地点，不可绕过。父 block（含内层 sub-）不单独对比，由其叶子覆盖
- 禁止 sub-agent 在切 `bg-` 节点前跳过"CSS-able 自检"（详见 `bg-` 切图前的"CSS-able 自检" 章节）：自检命中（fills 是 SOLID/简单 gradient + 子树纯净 + 无复杂 effect）的节点必须改用 CSS 实现，不允许切图。位图渲染的渐变会 banding，外加 effect 会让切出来的 PNG 边缘"沾染"画板底色泄漏的视觉假象
- 禁止 sub-agent 自己派发孙 sub-agent（即 sub-agent 直接发起新 agent 处理内层 sub-）：嵌套 sub- 必须走「sub-agent 写 placeholder + subslots.json → 主 agent 收集 → 主 agent 派发」的链路。sub-agent 自己派孙会让主 agent 失去全局清单视角，合并阶段的 placeholder 展开和 §6.0 接缝检查易漏
- 禁止 sub-agent 在子树扫描时递归到比"自己直接子层"更深的 sub-：每个 sub-agent 只上报自己直接发现的内层 sub-，更深的层由对应内层 sub-agent 自己扫描上报。这保证「每层独立上下文」，避免单个 sub-agent 看到整棵子树
- 禁止合并阶段（§5）残留任何 `<__SUBSLOT__>` 标签：合并完成后必须运行 `grep -r "__SUBSLOT__" {output.dir}` 检查，有命中即合并失败，必须排查 placeholder 未展开的 block
- 禁止 `fixed-` 与 `bg-` / `bgc-` / `x-` 叠加：这三个前缀不生成节点（bg- / bgc- 写到父元素 CSS，x- 跳过），没有节点就没法 `position: fixed`。doctor NAM014 命中后 error。要做"固定背景"请把 fixed- 加在父节点上，bg- 仍写父节点 background
- 禁止 `fixed-` 节点写代码时省略 z-index：fixed 元素脱离文档流，没有 z-index 在不同浏览器栈顺序不稳定；默认 100，多个 fixed- 时按设计稿前后顺序递增（100/101/102…）
- 禁止 `fixed-` 节点跳过 Figma constraints 读取：top/bottom/left/right 必须按 constraints 推断（详见 §`fixed-` 定位规则）；只在 constraints 缺失时退化为绝对坐标 + 强制 QA 告警
- 禁止组件函数名、组件文件目录名以 `sub-` / `Sub` 开头：图层名 `sub-foo` 对应的组件函数名必须去掉 `sub-` 前缀后再转 PascalCase（`sub-card` → `Card`，`sub-login-form` → `LoginForm`），目录名保留原始图层名（`blocks/card/`）用于文件系统寻址，函数名严禁带 `sub-` 前缀
- 禁止 TEXT 节点有多层可见 SOLID fills 时直接取 `fills[0]`：必须按 §4.1.1「TEXT 多层 fills 处理」按 Figma 渲染顺序取末位可见 SOLID
- 禁止父容器命中「父容器盒级装饰兜底」（§4.3）时仍要求设计师额外建 `bg-*` 子层：默认打开，两种命名都合法；命中渐变时必须引 `LinearGradient` 而不是退化纯色（RN 侧 v0.3.6 修订）
- 禁止 `btn-` 节点必须切图（fills 含 IMAGE / 子树含形状）时，内部 TEXT 仍生成 `<Text>` 并写入相同文字：造成"图片里有字 + `<Text>` 也有字"双写事故（doctor NAM024 error）
- 禁止 `img-` / `bg-` / 裸词 `img` / 裸词 `bg` 命中但跳过 REST API 调用：必须按 §4.4.0 走，即使 assetsDir 有同名文件也要按 images.json md5 校验决定复用还是重切。doctor IMG026 未记录 nodeId → error
- 禁止在 assets.txt 中省略 §4.4.0 定义的 3 行溯源（API 参数 / 返回 URL / 落盘尺寸+md5）
- 禁止 flat 模式合并时用父容器整体切图（如 `sub-{name}.png` / `sub-ui-frame734.png`）替代 sub-agent 的拆分产物：必须逐字读 `blocks/{sub}/index.tsx` 展开到父文件（v0.3.7 §5.0.pre）
- 禁止对 `sub-*` / `block-*` 前缀节点调用 `figma.mjs export-image` 整体切图（v0.3.7 §4.4.pre 适格性表）
- 禁止 flat 模式合并跳过「data-node-id 守恒律」的 grep 自证（v0.3.7 §5.1）：必须运行差集比对命令并把结果输出到对话；差集非空即合并失败必须回滚
- 禁止跳过「assets.txt 消费契约」的 grep 自证（v0.3.7 §6.0.2）：必须运行差集比对命令并把结果输出到对话；未引用即代表主 agent 替代了 sub-agent 产物，触发 SUB027 / IMG028
- 禁止跳过步骤 7 之前的「合并忠实度证明块」输出（v0.3.7 §6.0.3）：主 agent 必须在对话里写"data-node-id 守恒律 / assets.txt 消费契约 / 节点整体切图适格性"三组结果；未输出即视为交付不合格
- 禁止向用户提 skill 已定死的技术决策问题（v0.3.8 §问题边界）：包括但不限于"要不要整体切图 / 用不用 View style 表达 / 渐变引不引 LinearGradient / 多层 fills 取哪个 / 尺寸要不要包 rpx / 合并这块用什么方式"等。遇 skill 未覆盖的边界情形，必须按最接近规则兜底 + 写 QA 告警，禁止打断用户；仅在产物完全不可用时才允许问用户
- 禁止对子树含 ≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点的容器整体切图（v0.3.9 §4.4.pre.b 结构维度禁切）——即使该节点前缀不是 `sub-*` / `block-*`。sub-agent 每次切图前必须完成 §4.4 前置自检 7 行的最后 2 行子树扫描；命中即立即停下重做，走 §4.3 递归子层解析（RN 侧生成 `<View>` + `<Text>` + `<Pressable>` + `.map(...)` 结构）
- 禁止 TEXT 节点交付时省略字色 fills 溯源（v0.3.10 §4.1.1）：sub-agent 每个 `<Text>` 必须在 `blocks/{sub}/assets.txt` QA 段写一行 `· TEXT {nodeId} "..." fills层数=N 可见SOLID列表=[...] 末位可见色=#hexN 最终写入=#final`，`#final` 必须严格等于 `#hexN`；产物 StyleSheet 中 `color:` 字段（含 3 种写法）集合必须覆盖 declared 集合每一项 —— doctor CLR030 error
- 禁止 sub-/block- 容器 `minHeight` 写入值 = 兄弟 bg 层高度而非自身高度（v0.3.10 §4.3）：sub-agent 每个 sub-/block- 容器必须在 assets.txt QA 段写一行 `· SUB容器 {nodeId} name=... 自身h=H1 bg兄弟层h=H2 minHeight写入=H1`，且写入值必须严格等于 `H1` —— doctor DIM031 error
- 禁止页面根 `paddingTop` 写入值 ≠ `figmaNode.paddingTop`（v0.3.10 §4.3.1）：主 agent 必须在主页面 assets.txt 或对话输出一行 `· PAGE根 {pageNodeId} name=... figmaPaddingTop=P fixed状态栏h=S paddingTop写入=P`，禁止用 fixed 状态栏高度替代 `paddingTop` 字段 —— doctor DIM032 error
