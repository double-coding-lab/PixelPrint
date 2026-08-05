# PixelPrint(像素打印)技术讲解文档

> **PixelPrint / 像素打印** — 寓意「像素级还原」,把 Figma 每一像素、每一间距、每一个圆角原样"打印"成前端代码。

讲清「PixelPrint 到底是怎么把 Figma 稿子变成前端代码的」——架构、执行模型、关键抽象、演化历史。README 是用户视角的操作手册,本文是**开发/维护者视角**的技术剖析。

**读者假设**:熟悉 Figma 概念(node/frame/auto layout/constraints),用过 Claude Code 或类似 LLM CLI 工具,能读 JS/TS 代码。

---

## 目录

1. [一句话定位](#1-一句话定位)
2. [整体架构](#2-整体架构)
3. [核心抽象:SKILL 是 LLM 操作手册,不是可执行代码](#3-核心抽象skill-是-llm-操作手册不是可执行代码)
4. [3 层责任分工](#4-3-层责任分工)
5. [图层前缀体系:让设计师能标注、让 LLM 能理解](#5-图层前缀体系让设计师能标注让-llm-能理解)
6. [Figma REST API 调用链](#6-figma-rest-api-调用链)
7. [缓存分层与防污染](#7-缓存分层与防污染)
8. [Adapter 机制:一套 SKILL 覆盖多框架](#8-adapter-机制一套-skill-覆盖多框架)
9. [响应式 rpx() 包装(RN 分支)](#9-响应式-rpx-包装rn-分支)
10. [出码流程 7 大步骤](#10-出码流程-7-大步骤)
11. [SKILL 之间的协作图](#11-skill-之间的协作图)
12. [演化史(为什么是今天的样子)](#12-演化史为什么是今天的样子)
13. [常见误解答疑](#13-常见误解答疑)

---

## 1. 一句话定位

**PixelPrint 是一套让 Claude Code 学会「按项目规范把 Figma 稿子还原成代码」的知识包**。

- 不是 Codegen 工具:没有传统意义上的 AST 生成引擎、模板系统
- 不是 Figma 插件:装在设计师那边的什么都没有,全在开发者本地跑
- 不是 MCP 服务器:v0.3 起去掉了 MCP 依赖,现在走原生 Figma REST API

它把三样东西打包给 Claude Code:
1. **SKILL.md**:自然语言写的操作手册,教 LLM 每一步该干什么
2. **bin/figma.mjs**:把机械动作(HTTP 请求、缓存、图片下载)固化下来,LLM 通过 Bash 调用
3. **图层命名规范**(`sub-` / `img-` / `bg-` / …):给设计师看的合约,让 LLM 能理解意图

装到用户项目后,用户说「把这张稿子转成代码」,Claude Code 自动读 SKILL.md → 按流程调用 figma.mjs → 按命名规范拆分 → 出码 → 视觉验收。

---

## 2. 整体架构

```
                        ┌──────────────────────────────────────────┐
                        │        PixelPrint npm 包                 │
                        │   (@double-coding/pixel-print)           │
                        │                                          │
                        │   ├── bin/install.js  ← npx 入口         │
                        │   ├── templates/                         │
                        │   │   ├── skills/                        │
                        │   │   │   ├── pp-d2c/         (h5 主)   │
                        │   │   │   │   ├── SKILL.md              │
                        │   │   │   │   └── bin/figma.mjs         │
                        │   │   │   ├── pp-d2c-rn/      (rn 主)   │
                        │   │   │   │   ├── SKILL.md              │
                        │   │   │   │   └── bin/figma.mjs         │
                        │   │   │   ├── pp-strip-nodeid/          │
                        │   │   │   │   ├── SKILL.md              │
                        │   │   │   │   └── strip-node-id.mjs     │
                        │   │   │   ├── pp-fix-partial/           │
                        │   │   │   │   └── SKILL.md              │
                        │   │   │   ├── pp-doctor/  (opt-in)      │
                        │   │   │   └── pp-style/   (opt-in)      │
                        │   │   ├── adapter-presets/              │
                        │   │   │   ├── xtaro.{json,rpx.ts,ref.md}│
                        │   │   │   ├── taro.{json,rpx.ts,ref.md} │
                        │   │   │   └── rn.{json,rpx.ts,ref.md}   │
                        │   │   ├── pp-d2c.config.json  (h5 模板) │
                        │   │   ├── pp-d2c.rn.config.json         │
                        │   │   └── rn-helpers/rpx.ts             │
                        │   └── docs/design-guide.md              │
                        └──────────────────────────────────────────┘
                                          │
                          npx @double-coding/pixel-print init
                                          ▼
                        ┌──────────────────────────────────────────┐
                        │        用户业务项目根                    │
                        │                                          │
                        │   ├── pp-d2c.config.json  ← 唯一配置源   │
                        │   ├── .env                ← FIGMA_TOKEN  │
                        │   ├── .claude/skills/                    │
                        │   │   ├── pp-d2c/     (h5) 或            │
                        │   │   ├── pp-d2c-rn/  (rn)               │
                        │   │   ├── pp-strip-nodeid/               │
                        │   │   └── pp-fix-partial/                │
                        │   ├── src/utils/rpx.ts  (rn only)        │
                        │   ├── pages/ 或 src/pages/  ← 出码目标   │
                        │   ├── static/ 或 assets/    ← 图片目标   │
                        │   └── .d2c-cache/   (.gitignored)        │
                        │       ├── figma/                         │
                        │       ├── images/                        │
                        │       ├── anchors/                       │
                        │       ├── last-page.json                 │
                        │       └── <fileKey>/  (meta+bbox)        │
                        └──────────────────────────────────────────┘
                                          │
                                    Claude Code
                                          │
                                          ▼
                             Figma REST API (api.figma.com)
```

**关键分离**:
- npm 包是**只读模板库**,通过 `install.js init` 拷贝到用户项目
- 用户项目的 SKILL 文件是**副本**,不会随 npm 包更新自动同步(升级需重跑 init)
- 所有跨会话状态存在 `.d2c-cache/`,git 不追踪,可随时用 `clean-cache` 清空

---

## 3. 核心抽象:SKILL 是 LLM 操作手册,不是可执行代码

**这是理解 PixelPrint 的第一原则**。SKILL.md 里所有类似 `doctor.run({...})` / `partial.replace(file, str)` 的写法都是**给 LLM 的操作描述**,不是可运行 API。

对比:

```markdown
### 步骤 4:sub-agent 实现单个 block

#### 4.1 读取设计上下文
1. 用 fetch-node 拉当前 block nodeId 的完整子树
2. 递归遍历子层...
```

上面这段在 SKILL.md 里,LLM 读到会**理解为**:
> 「我需要用 Bash 调 `node figma.mjs fetch-node <fileKey> <nodeId>`,拿到返回的 JSON 后按自然语言里说的规则递归处理」

它**不会**期望有一个叫 `readDesignContext()` 的函数存在。

**为什么这么设计**:
- 传统 Codegen 用 AST 需要覆盖所有 Figma 节点类型 × 所有目标框架,组合爆炸维护成本极高
- LLM 天生能理解"规则 + 例子",让它自己看设计稿产 JSX 是更少代码路径的实现
- SKILL 演化只需改 md 文件,不用重构引擎

**代价**:
- 依赖 LLM 遵守指令(所以 SKILL 里大量"禁止"条款 + 强制自检 4 行)
- 不同版本 LLM 表现有差异,SKILL 迭代很大一部分是"堵漏 + 反幻觉"

---

## 4. 3 层责任分工

| 层 | 角色 | 承载 | 谁写 |
|---|------|------|------|
| **数据层** | figma.mjs | HTTP、缓存、图片下载、图片元数据(bbox / lastModified) | 开发者(命令式代码) |
| **规则层** | SKILL.md | 图层前缀语义、单位换算、图片处理规则、adapter 应用步骤、视觉验收 | 开发者(自然语言) |
| **执行层** | Claude Code | 读 SKILL → 调 figma.mjs → 出 JSX → 自检 → 视觉对比 | LLM |

**关键契约**:
- **数据层的输入输出必须是 JSON**(figma.mjs stdout 一行 JSON,`{ok: true, data: ...}` 或 `{ok: false, error: ...}`),LLM 拿到能直接解析
- **规则层不做任何计算**,只描述规则、给例子、列禁止项
- **执行层没有代码可执行**,靠 LLM 遵守规则层

---

## 5. 图层前缀体系:让设计师能标注、让 LLM 能理解

设计师用 Figma 图层名传递意图,SKILL 按前缀分派处理规则。这是 PixelPrint 的核心接口。

### 12 类前缀

| 前缀 | 语义 | 生成行为 |
|------|------|---------|
| `sub-` | 独立模块 | 派发独立 sub-agent,生成独立组件文件 |
| `block-` | 独立布局块 | HTML/CSS 隔离容器,不递归到别的 block |
| `img-` | 整块图片 | 整层导出 PNG,**不递归子孙** |
| `bg-` | 背景图 | 写父元素 `background-image`,不递归子孙 |
| `bgc-` | 父级盒级装饰 | 写父元素 fills / strokes / cornerRadius / effects,不递归 |
| `btn-` | 可点击区域 | 包裹可点击容器(H5:`<button>` 或 `onClick` div;RN:`<Pressable>`) |
| `input-` | 输入框 | 生成 `<input>` / `<TextInput>`,子 TEXT 变 placeholder |
| `scrollx-` / `scrolly-` | 滚动容器 | overflow + 隐藏滚动条,**继续递归子层**(列表项按 `.map()` 处理) |
| `fixed-` | 视口固定 | `position: fixed`,H5 读 Figma constraints 推断 top/bottom;RN 退化为 absolute + info |
| `end-` | 贴父末端 | auto-layout 里贴向末端(纵→贴底 / 横→贴右) |
| `x-` | 忽略 | 完全不生成代码 |

### 修饰前缀可叠加

如 `fixed-btn-back-top` = 固定定位 + 可点击按钮,`sub-scrollx-cards` = 独立模块 + 横向滚动。

**禁止组合**:
- `scrollx-` / `scrolly-` × `img-` / `bg-` / `bgc-` / `btn-` / `x-`(语义冲突)
- `fixed-` × `bg-` / `bgc-` / `x-`(bg/bgc 不生成节点,fixed 无处可挂;x- 直接不生成)
- `input-` × 大部分修饰前缀(输入框语义原子化)

### 为什么这么设计

- **设计师侧成本低**:图层重命名即可,不用装 Figma 插件
- **LLM 侧不用推理**:前缀直接决定处理策略,不用"根据视觉猜"
- **doctor 可校验**:前缀命名可编程化检查(NAM001-NAM020 系列规则)

规范全文见 `docs/design-guide.md`(给设计师看的版本)。

---

## 6. Figma REST API 调用链

### figma.mjs 提供 6 个原子命令

```
node figma.mjs verify-token             # 探活 Token 有效性
node figma.mjs cache-check <fileKey>    # 对比 lastModified 决定复用/作废缓存
node figma.mjs fetch-node <fileKey> <nodeId> [--depth=N]   # 拉子树 JSON
node figma.mjs export-image <fileKey> <nodeId> --filename=<name>  # 导 PNG/SVG
node figma.mjs screenshot <fileKey> <nodeId> [--tag=leaf|whole|block]  # QA 截图
node figma.mjs cleanup-tmp              # 清 .d2c-tmp/screenshots/
```

每条命令都幂等 + 自带重试 + 返回结构化 JSON。SKILL 里只写"调这条命令",不管 HTTP、鉴权、错误分类。

### 一次完整调用的链路

```
用户: 把这份稿子转成代码 https://figma.com/design/AAA?node-id=138-1797

Claude Code(读 pp-d2c/SKILL.md):
  步骤 -1: node figma.mjs verify-token        → 200 OK
  步骤 0.3: node figma.mjs cache-check AAA    → { fresh: true, lastModified: ... }
  步骤 2.5: node figma.mjs fetch-node AAA 138:1797 --depth=full
    ↓ (拿到整棵子树 JSON)
  按前缀切分 sub-block:sub-header / sub-banner / sub-cards ...
  步骤 3: 派发 3 个 sub-agent,每个处理一个 sub-block
    ↓
  每个 sub-agent:
    - node figma.mjs fetch-node AAA <subBlockId> --depth=full   (子块细节)
    - 按前缀规则出 JSX + 样式
    - 遇到 img-/bg- 节点:
        node figma.mjs export-image AAA <imgNodeId> --filename=xxx --format=png --scale=2
      → 图片落到 static/xxx.png,URL 拼接进 JSX
    - 独立验收
  步骤 5: 主 agent 合并 sub-block 到主入口文件
  步骤 6.0: 逐叶子 sub-block 单独视觉对比
    - node figma.mjs screenshot AAA <subBlockId> --tag=leaf   → figma 截图
    - 渲染代码 → 截图
    - LLM 对比两张图
  步骤 6.3: 写 .d2c-cache/last-page.json
  步骤 7: 输出交付物清单(含"上线前跑 pp-strip-nodeid")
```

**关键**:每步之间的输入输出都在 stdout(figma.mjs)或文件系统(缓存 / 输出目录),LLM 只做「读取 → 推理 → 调命令」,不承担 IO 复杂度。

---

## 7. 缓存分层与防污染

### `.d2c-cache/` 目录结构

```
.d2c-cache/
├── figma/
│   └── <fileKey>-<nodeId>.json         # 节点子树 REST JSON + { figmaTreeHash, mtime }
├── images/
│   └── <fileKey>-<nodeId>-<idx>.png    # 切图缓存
├── anchors/
│   └── <pageDirSlug>.json              # 由 pp-strip-nodeid 生成
├── last-page.json                       # 主 SKILL 写,pp-fix-partial 读
└── <fileKey>/
    ├── meta.json                        # cache-check 的 lastModified 记录
    └── bbox/*.json                      # 图片 bbox 元数据
```

### 4 条防污染硬规则

1. **所有缓存路径必带 `<fileKey>` 前缀**:换 fileKey 天然隔离,不会跨稿子污染
2. **每次覆写不追加**:cache 是"当前真相"的快照,不留历史队列
3. **单一写入源**:`last-page.json` 只有主 SKILL §6.3 写,`anchors/` 只有 pp-strip-nodeid 写,pp-fix-partial **只读**
4. **hash 对比 + mtime TTL 双保险**:hash 校子树是否变过,mtime 兜底"figma 侧静默 30 天不动"的场景

### 缓存作废 3 触发

| 触发 | 场景 |
|---|---|
| **hash 不一致** | 拉最新子树算 fingerprint(递归 SHA1: id+name+style+children),与缓存 hash 对比,变了就 invalidate 该 nodeId 全部文件 |
| **mtime 超 7 天 TTL** | 兜底 figma 侧静默变化;7 天没跑过就当作可能过期 |
| **`clean-cache` 手动** | `npx @double-coding/pixel-print clean-cache` 清整个 `.d2c-cache/` |

---

## 8. Adapter 机制:一套 SKILL 覆盖多框架

**问题**:H5 用 `<div>` / `<img>`;RN 用 `<View>` / `<Image>`;xtaro 用 `<XView>` / `<XImage>`;taro 用 `<View>`(来源不同)。同一份规则要覆盖这 4 种目标,直接在 SKILL 里硬编码框架标签会污染规则本身。

**方案**:RN 分支的 SKILL **只用 6 大 RN 内核标签**描述规则:

```
View / Text / Image / Pressable / TextInput / ScrollView
```

出码时先按 RN 内核标签产 JSX,合并阶段(§5.5)读 config.adapter 应用 tagMap/importMap/propMap,把内核标签**机械替换**成目标标签。

### adapter 3 段配置

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
      "XView": "@ctrip/xtaro",
      "XText": "@ctrip/xtaro",
      ...
    },
    "propMap": {
      "Image": { "source": "src" }
    },
    "referenceDoc": "xtaro.reference.md"
  }
}
```

- **tagMap**:key 是 6 大 RN 内核标签之一,value 是目标标签
- **importMap**:每个目标标签的 import 源
- **propMap**:**纯 prop 改名**(如 `<Image source={...} />` → `<XImage src={...} />`)
- **referenceDoc**:超出机械改名的复杂差异(值域映射 / 布尔取反 / 事件签名 / 结构变化 / 无跨端支持) → 单独一份 md,§5.5.3c 步骤按需 Read

### 内置 3 个预设

| 预设 | 目标 | 关键差异 |
|---|---|---|
| `rn` | pure React Native / Expo | 6 大标签保留原名,`from 'react-native'` |
| `xtaro` | `@ctrip/xtaro` | `View→XView / TextInput→XInput`,rpx helper 走 xGetSystemInfoSync |
| `taro` | `@tarojs/components` | `TextInput→Input / Pressable→View`,rpx helper 走 Taro.getSystemInfoSync |

**预设文件不复制到用户项目**:preset 的 adapter 段在 init 时被"展开"写入用户 config,不留副本。

### 加自己的预设

新建 `templates/adapter-presets/<framework>.json`(结构见该目录 README.md),CLI init 时自动出现在 `[1/8] 项目框架 + 方案` 平铺选项里。

---

## 9. 响应式 rpx() 包装(RN 分支)

**问题**:RN 数值默认是 dp/pt(iOS pt / Android dp),同一个数字在 iPhone SE(375pt)和 iPhone 15 Pro Max(430pt)物理尺寸不同 → 视觉稿是按 375 画的,直接落 375 到代码,大屏机上元素偏小。

**方案**:所有 layout / spacing / borderRadius / fontSize 类属性用 `rpx()` 包装,helper 按当前屏宽线性缩放:

```ts
// src/utils/rpx.ts(pure RN 版本)
import { Dimensions } from 'react-native'

const DESIGN_BASE = 375
const width = Dimensions.get('window').width

export function rpx(size: number) {
  return size * (width / DESIGN_BASE)
}
```

出码后:

```tsx
<View style={{ paddingLeft: rpx(16), paddingRight: rpx(16), gap: rpx(12) }}>
  <Text style={{ fontSize: rpx(14), lineHeight: rpx(20) }}>Hello</Text>
</View>
```

### 白名单机制

不是所有数值都 rpx() —— 比如 `opacity: 0.5` / `flex: 1` / `zIndex: 100` 明显不该缩放。SKILL §5.4 定义白名单:

- ✅ 包装:width/height/margin*/padding*/gap/borderRadius/borderWidth/fontSize/lineHeight/top/left/right/bottom
- ❌ 跳过:opacity/flex/zIndex/scale/rotation/aspectRatio/等无单位属性

### 屏宽 API 跨框架差异

xtaro / taro 项目 webpack 不解析 `react-native` 的 Flow 语法 → 不能用 `Dimensions.get('window').width`。预设自带 helper 模板解决:

- `xtaro.rpx.ts` → 走 `xGetSystemInfoSync from '@ctrip/xtaro'`
- `taro.rpx.ts` → 走 `Taro.getSystemInfoSync from '@tarojs/taro'`

init 时按选中预设复制对应 helper 到 `src/utils/rpx.ts`。

---

## 10. 出码流程 7 大步骤

以 h5 主 SKILL(`pp-d2c/SKILL.md`)为例,rn 分支结构对称。

```
步骤 -1  可用性预检   verify-token → 200 OK 才继续
步骤  0  读 config    project.framework/styleFormat/unit/output/layers/health/adapter
        缓存初始化   cache-check → 决定 .d2c-cache/<fileKey>/ 复用或重建
步骤  1  拉整棵子树   fetch-node <rootNodeId> --depth=full
步骤  2  Doctor 体检  (h5 默认开;rn 默认关) 命名/布局/结构/资产 4 大类
步骤  2.5 页面级背景  识别顶层 frame 的 fills → 决定写到哪个全局样式文件
步骤  3  分块        按 sub- 前缀拆 sub-block,派发独立 sub-agent
步骤  4  出码        每个 sub-agent:
                      4.0 前缀检查(叶子/枝子/img/bg/bgc/scroll/fixed/input/x)
                      4.1 读取子树 fetch-node
                      4.2 隐藏图层处理
                      4.3 图层解析(按前缀规则)
                      4.4 图片导出 export-image(强制 use_absolute_bounds=true)
                      4.5 单位换算(figmaBase → outputBase × scale)
                      4.6 框架适配(h5)/ 或延后到 §5.5(rn)
                      4.7 输出文件结构
                      4.8 sub-agent 独立视觉验收
步骤  5  主 agent 合并  按 merge.mode 走 component / flat 模式
                      5.4 rn 分支:应用 rpx()
                      5.5 rn 分支:应用 adapter(tagMap/importMap/propMap/referenceDoc)
步骤  6  主 agent 验收
                      6.0 逐叶子 sub-block 单独视觉对比(不可跳)
                      6.0.1 反幻觉:手工调整数值必须溯源
                      6.1 整体视觉验收
                      6.2 图片 URL 自检
                      6.3 写 .d2c-cache/last-page.json  (v1.1.0+)
步骤  7  输出交付物   assets.txt / QA 报告 / 上线前清 data-node-id 提示
                      清 .d2c-tmp/screenshots/
```

### 几个关键的"强制不可跳"

- **步骤 -1 verify-token**:Token 挂了 SKILL 全流程无意义,必须最先验
- **步骤 4.4 强制 use_absolute_bounds=true**:不带此参数会把 effect(阴影/blur)和父背景色一起 render 进 PNG(踩过多次)
- **步骤 4.4 curl 前的自检 4 行**:图层前缀类型 / 切图源 nodeId / name / 交叉验证 → 反"把兄弟节点烤进 bg- 位图"的唯一防线
- **步骤 6.0 逐叶子对比**:整体大图分辨率被压缩,叶子内部偏差看不见 → 必须逐块单独对比
- **步骤 6.0.1 反幻觉溯源**:LLM 有可能"觉得这个数值应该是 X"而不查 Figma;要求任何非直接来自 Figma 的数值都必须列出溯源根据

---

## 11. SKILL 之间的协作图

```
             ┌──────────┐
             │  用户    │
             │  意图    │
             └────┬─────┘
                  │
     ┌────────────┼─────────────┬─────────────────┬────────────────┐
     ▼            ▼             ▼                 ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ pp-d2c   │ │ pp-d2c-rn│ │ pp-strip-    │ │ pp-fix-      │ │ pp-doctor    │
│ (H5 主)  │ │ (RN 主)  │ │ nodeid       │ │ partial      │ │ (opt-in)     │
└────┬─────┘ └────┬─────┘ └──────┬───────┘ └──────┬───────┘ └──────────────┘
     │            │              │                │
     │  出码成功  │              │                │  局部修复
     │  写 last-  │              │                │  读 last-page.json
     │  page.json │              │                │  读 anchors/*.json
     ├────────────┤              │                │
     ▼            ▼              │                │
  .d2c-cache/last-page.json      │                │
                                 │  剥 data-node- │
                                 │  id 前先存     │
                                 ▼                │
                     .d2c-cache/anchors/*.json ◄──┤
                                                  │
                                                  ▼
                                       Edit(file, oldSlice, newSlice)
                                       精确替换 sub-block
```

### 依赖关系

- **pp-d2c / pp-d2c-rn**:独立可用,是入口
- **pp-strip-nodeid**:依赖主 SKILL 出码时注入 `data-node-id`(生成阶段强制)
- **pp-fix-partial**:依赖 `.d2c-cache/last-page.json`(主 SKILL 写)+ `anchors/*.json`(strip 写)+ `data-node-id`(未剥时的兜底)
- **pp-doctor / pp-style**:opt-in,不默认落到用户项目;主 SKILL 引用它们的规则但内容有大量重叠(将来会合并)

---

## 12. 演化史(为什么是今天的样子)

选择性列 milestone,不是编年史。目的是让维护者理解"这个设计不是拍脑袋"。

| 版本 | 变化 | 触发原因 |
|---|---|---|
| v0.2 系列 | 引入图层前缀体系 | 早期版本让 LLM 猜"哪块是独立组件",错误率高 → 改成显式前缀 |
| v0.2 中期 | 加 `bgc-` 前缀 | 发现 `bg-` 图片 + 描边/圆角混在一起时无法单独还原 → 拆出盒级 CSS 前缀 |
| v0.2 后期 | doctor 加 `use_absolute_bounds` 检查 | 遇到 3 次"切出来的图带画板背景色"事故 → 强制此参数 + doctor 校验 |
| v0.3.0 | Figma MCP → REST API 迁移 | MCP 需 OAuth,团队级授权流程繁琐;换 Personal Access Token + REST 简化 |
| v0.3.2 | 加 `end-` 前缀 | auto-layout 里"贴底"用 space-between wrapper 太丑 → 显式 `end-` |
| v0.3.3 | 页面根 `min-height: max(..., 100vh)` | 短稿子在长屏底部露白 → 覆写 h5 页面根 |
| v0.3.4 | 加 `input-` 前缀 | 输入框语义独特(placeholder / focus / value bind)→ 独立前缀 |
| v0.4.0 | 分家:pp-d2c 与 pp-d2c-rn | 两端规则从 30% 重叠上涨到 60% → 强行合并会导致规则文档双端污染,拆分 |
| v0.4.0 | Adapter 机制引入 | 一份 SKILL 要覆盖 3 个 RN 系框架(pure RN / xtaro / taro),硬编码不可扩展 |
| v0.4.0 | rpx() 响应式包装 | RN 数值默认是 dp,大屏机偏小 → 白名单 + rpx() helper |
| v1.0.0 | 从 `ctrip-train-d2c` rebrand 到 PixelPrint | 开源准备,取中性品牌 + `@double-coding` npm scope |
| v1.0.2 | FIXED 高度写 `min-height` 防塌陷 | 遇到 sub-block 高度用 `height` 时,内部 `height: 100%` 的 abs 兄弟无参照系塌陷 → 改 `min-height` |
| v1.0.2 | 冗余嵌套 autoLayout 属性下穿 | Frame 703 + 只有 1 个子 Frame 702,703 是"薄壳",gap/padding 应该取 702 的 |
| v1.0.3 | RN 页面根强制 ScrollView 骨架 + fixed 分层 | RN `<View>` 内容超屏不滚,需要 `<ScrollView>` 包裹;fixed-* 必须放 ScrollView 外 |
| v1.1.0 | 新增 pp-fix-partial | 局部修复需求 → 需要 last-page 定位 + anchor 档案 + hash 对比缓存 |
| v1.1.0 | anchor 档案(pp-strip-nodeid 副产物) | fix-partial 剥了 data-node-id 就失去定位锚 → 剥前先存档案 |
| v1.1.0 | clean-cache 子命令 | 缓存出问题(如手动动过 `.d2c-cache/`)时,给用户"重启大法"入口 |
| v1.1.0 | init [1/8] framework + 方案平铺一层 | 原来"先选 framework 再嵌套选样式/adapter"要 3-4 层 → 13 项一次性铺开 |

### 观察

- 大部分演化都是"踩了坑加个禁止条款/自检"→ SKILL.md 里"禁止项"越来越长
- 前缀体系没变过(只在加新前缀,没删过) → 说明这个抽象扛住了
- 主流程 7 步没变过(只在里面填新的子步骤) → 说明架构骨架是稳的
- 换 MCP → REST 是唯一一次大改数据层,证明"数据层能替换"这个隔离设计有价值

---

## 13. 常见误解答疑

### Q1: 为什么 SKILL.md 里的 `doctor.run({...})` 不能执行?

因为 SKILL.md 是**给 LLM 看的自然语言操作手册**,不是可执行代码。任何看起来像"函数调用"的写法都是让 LLM 理解「这里应该做什么」的伪代码。真正可执行的只有 `bin/*.mjs`。

### Q2: 为什么不做一个 Figma 插件?

- 插件生态在设计师侧,开发者不方便更新
- 插件跑在 Figma 沙盒里,访问不了本地文件系统 / npm 项目结构
- 图层命名规范用文档教就够,不用工具强制

### Q3: 为什么放弃 MCP?

- MCP 需 OAuth,团队级授权 + 定期续期繁琐
- Personal Access Token 一次生成永久有效(除非用户主动作废)
- REST API 覆盖所有需要的能力(拉节点 / 导图 / 元数据),不比 MCP 少

### Q4: adapter 为什么区分 propMap 和 referenceDoc?

- **propMap**:纯 prop 改名(`source → src`)LLM 机械替换 = 确定性,写 JSON
- **referenceDoc**:值域映射 / 布尔取反 / 事件签名 / 结构变化 → LLM 需要判断上下文,写 md 让它"看情况处理"

强行把 referenceDoc 里的内容塞进 propMap 会导致 schema 复杂化(v2 object 语法),LLM 出错率上升。拆开更简单。

### Q5: 为什么 pp-doctor / pp-style 是 opt-in?

- 内容与主 SKILL 重复度 > 80%
- 没有独立触发入口(触发词都被主 SKILL 吃了)
- 装了不用反而增加 LLM 上下文压力

需要用时可手动从 npm 包 templates/skills/ cp 过来。将来会合并到主 SKILL。

### Q6: 为什么图片文件名带 `<fileKey>-<nodeId>` 前缀?

- **跨稿子隔离**:同个业务项目可能同时对接多张设计稿,不同稿子的 nodeId 会重复(都是 138:1830 之类)
- **缓存命中**:图片文件名与缓存 key 同构,不用二次映射
- **无冲突并存**:局部修复引入新图 → 老图仍在,不会互相覆盖

### Q7: 如果我的图层不按前缀规范命名,能出码吗?

能,但质量下降。SKILL 有"无前缀兜底"规则(§4.0 尾部),但会:
- Doctor 打分 grade 降到 C/D(NAM001-NAM020 系列 warning)
- sub-agent 无法自动分派 → 主 agent 处理整棵子树
- 图片 vs 背景 vs 盒级装饰无法自动区分 → 大概率整块导成 PNG(视觉能对,但代码是"图片壳")

**建议**:接项目前把 `docs/design-guide.md` 发给对接设计师,让他们按规范命名。开发去改图层名比设计师本地改效率低 10 倍以上。

---

## 相关文档

- [`README.md`](../README.md) — 用户视角的操作手册
- [`docs/design-guide.md`](./design-guide.md) — 给设计师的图层命名规范
- [`docs/d2c-health-check-spec.md`](./d2c-health-check-spec.md) — Doctor 体检规则完整定义
- [`templates/adapter-presets/README.md`](../templates/adapter-presets/README.md) — 加自己的 adapter 预设
- [`.Knowledge/topics/pp-d2c.md`](../.Knowledge/topics/pp-d2c.md) — 主 SKILL 执行约定(KB)
- [`.Knowledge/topics/pp-fix-partial.md`](../.Knowledge/topics/pp-fix-partial.md) — 局部修复 SKILL(KB)
- 各 SKILL 的 `SKILL.md` — LLM 操作手册全文

---

**贡献者**:改这份文档前请先读一遍 §3(SKILL 是操作手册不是代码)。加新 milestone 到 §12 时保持"触发原因"一列填写,避免"因为想加就加了"式的更新。
