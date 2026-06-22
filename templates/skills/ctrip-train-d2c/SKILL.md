# ctrip-train-d2c Skill

## 触发条件
- 用户提供 Figma 设计稿 URL
- 用户说「帮我还原这个设计稿」「D2C」「生成代码」

---

## 执行模型说明（先于一切，避免误读）

**SKILL.md 是给 LLM 读的自然语言操作手册，不是可执行代码。**

下文出现的 `doctor.run({...})`、`return X`、`派发新 sub-agent`、`sub-agent 上报` 等表述都是**伪代码 / 隐喻**，不是真函数调用、不是真多进程通信。**全程只有当前这一个 LLM agent**（即此对话里的 Claude）按 SKILL 步骤顺序执行：

| 文档表述 | 实际操作 |
|---------|---------|
| "调用 doctor SKILL" / `doctor.run({...})` | 当前 agent `Read .claude/skills/ctrip-train-d2c-doctor/SKILL.md` 并按其步骤执行 |
| "doctor 集成模式 return JSON" | 当前 agent 在对话里输出 §5.4 描述的 JSON 字符串，下一段步骤自己读 |
| "派发新 sub-agent 处理 sub-X" | 当前 agent 重新进入 §4.0 流程，把根节点重置为 sub-X 的 nodeId、depth +1，重走一遍 |
| "sub-agent 上报 subslots.json" | 当前 agent 把 JSON 内容写到磁盘文件，下一轮处理时自己读 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**，要字面写进 JSX 文件作占位符 |
| `subslots.json` 文件 | **真实磁盘文件**，与 `assets.txt` 同级写入 block 目录 |

**唯一真正"被执行"的事情有两类**：（1）调用 MCP 工具（Figma get_metadata / get_screenshot / get_design_context / 文件读写）；（2）在对话里产出文本（包括代码、JSON、报告、决策）。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

> 误把伪代码当真函数会卡死流程（等待一个永远不会到来的"返回值"），或者绕过关键步骤（"既然 SKILL 里说 doctor.run() 就行，那直接跳到 §1"）。

---

## 执行流程

### 步骤 -1（前置预检）：检测 Figma MCP 可用性

在任何操作前执行，不可跳过。

尝试调用 Figma MCP 工具，根据结果判断：

| 结果 | 处理 |
|------|------|
| 调用成功 | 继续步骤 0 |
| 工具不存在 / 调用失败 | 输出提示并终止 |

**失败时输出**：
```
Figma MCP 未就绪，请先在 Claude Code 中安装 Figma 官方插件并完成认证后再重试。
```

---

### 步骤 0：读取配置

```
Read("ctrip-train-d2c.config.json")
```

缓存以下字段，后续步骤全部以此为准：

| 字段 | 用途 |
|------|------|
| `project.framework` | 生成代码的目标框架（react / rn） |
| `project.styleFormat` | 样式方案 |
| `figma.token` | Figma Personal Access Token，用于 REST API 导出图片 |
| `merge.mode` | 合并模式（flat / component） |
| `images.assetsDir` | 图片下载目录 |
| `images.imageBaseUrl` | 代码中图片 src 前缀 |
| `images.preserveEffectIds` | 数组，可选；列出"导出时**保留** Figma effect / 父背景"的 nodeId（即不带 `use_absolute_bounds`）。默认空数组 = 所有图都按 bbox 严格导出 |
| `unit.figmaBase` | 设计稿基准宽度，默认 `375` |
| `unit.outputUnit` | 输出单位，`px` / `vw` / `rem`，默认 `px` |
| `unit.outputBase` | 输出基准宽度（px 模式有效），默认 `750` |
| `unit.scale` | 换算倍数（outputBase / figmaBase），默认 `2` |
| `layers.sub` | 分块触发前缀，默认 `sub-` |
| `layers.block` | 独立布局块前缀，默认 `block-` |
| `layers.img` | 图片前缀，默认 `img-` |
| `layers.bg` | 背景图前缀，默认 `bg-` |
| `layers.font` | 文字前缀，默认 `font-` |
| `layers.but` | 可点击区域前缀，默认 `btn-` |
| `layers.scrollX` | 横向滚动容器前缀，默认 `scrollx-` |
| `layers.scrollY` | 纵向滚动容器前缀，默认 `scrolly-` |
| `layers.fixed` | 视口固定定位前缀，默认 `fixed-` |
| `layers.ignore` | 忽略前缀，默认 `x-` |
| `output.dir` | 代码输出根目录 |
| `health.enabled` | 是否启用前置体检（默认 true） |
| `health.blockOnError` | 体检 grade=F 时是否阻塞生成（默认 true） |

---

### 步骤 0.5：调用设计稿体检（health 启用时）

`health.enabled === true` 时，**在解析 URL 前**先做一次设计稿体检。

**不要把下面当成函数调用**——SKILL.md 里没有任何函数会真的被运行。这一步的实际行为是：

> **同一个主 agent**（你这个 LLM）做以下事情：
> 1. `Read .claude/skills/ctrip-train-d2c-doctor/SKILL.md`，按其 §-1 → §5.4 流程执行体检
> 2. 把"集成模式（integrated）"作为这次体检的执行约束（来自 doctor §5.4）：
>    - 不写 `.d2c-health.md` / `.d2c-health.json` 磁盘文件（避免污染 output 目录）
>    - 体检完毕后，按 doctor §5.4 给出的字段结构（见下）**在对话里以 JSON 形式输出体检摘要**，作为本步骤的"返回值"
> 3. 主 agent 自己读这份 JSON 摘要，按下面的决策表决定下一步

**体检摘要 JSON 结构**（来自 doctor §5.4，必填字段）：

```jsonc
{
  "passed": true,                  // grade !== 'F'
  "score": {
    "total": 85,
    "grade": "B",
    "dimensions": { /* NAM/LAY/STR/STY/AST/FEA 各维度得分 */ },
    "coverage": { /* namedPrefixCoverage / autoLayoutCoverage 等 */ }
  },
  "issues": [ /* 每条含 id / level / nodeId / problem / consequence / fix / figmaUrl */ ],
  "summary": { "error": 0, "warn": 5, "info": 2 },
  "todoByRole": {
    "designer": [ /* 设计师待办 */ ],
    "developer": [ /* 开发待办 */ ]
  }
}
```

**根据这份 JSON 摘要决策**：

| 条件 | 处理 |
|------|------|
| `passed === false && config.health.blockOnError === true` | 输出阻塞提示，**等待用户输入「强制继续」/「跳过体检」/「先去修设计稿」**；用户不明确同意则终止流程 |
| `passed === false && config.health.blockOnError === false` | 输出警告但继续生成 |
| `passed === true && summary.error > 0` | 输出 error 数量提示并继续（罕见，通常 error 会让 grade=F） |
| `passed === true && summary.warn > 0` | 输出一句简短提示并继续，例如：`⚠️ 体检发现 N 个警告，详情见对话上方报告，继续生成。` |
| `passed === true && summary.error === 0 && summary.warn === 0` | 静默继续 |

**用户主动跳过**：用户在调用主 SKILL 时明确说"跳过体检/不要 doctor"，可跳过本步骤。

---

### 步骤 1：解析 Figma URL

从用户输入提取：
- `fileKey`：URL 中 `/design/` 后的路径段
- `nodeId`：`node-id=` 参数值，将 `-` 替换为 `:`

---

### 步骤 2：扫描图层结构，生成执行清单

调用 `get_metadata(fileKey, nodeId)` 获取目标节点的子孙图层树。

**分块判断逻辑**：

唯一的分块触发条件是图层名带有 `sub-` 前缀。其他前缀（`img-`、`bg-`、`font-`、`btn-` 等）不触发分块，由主 agent 直接处理。

**`sub-` 必须分发 sub-agent（无任何例外）**：

- 哪怕整稿只有 **1 个** `sub-` 节点，也必须分发 1 个 sub-agent，**禁止**以"无并行收益 / 单块"为由让主 agent 直接处理
- 哪怕 sub- 内容看起来"很简单"，也必须分发；判定简单与否是 sub-agent 的事，不是主 agent 的事
- 主 agent 只负责：分块识别、清单维护、合并、QA；**不负责** sub- 内部的 JSX/CSS 生成

> **理由**：sub-agent 拆分是质量保证，不是性能优化。把 sub- 内容塞进主 agent 上下文会让主 agent 同时处理"全局协调 + 局部细节"，细节准确度急剧下降（实测：单 agent 串行生成的 sub-card 内部尺寸/对齐/字号偏差比拆分后高 3-5 倍）。

**`sub-` 嵌套 `sub-`（v0.2 新增，原 NAM008 禁止已撤销）**：

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
- [ ] 图片 URL 自检完成（§6.1）
```

**清单规则**：
- 每完成一项，立即将 `[ ]` 改为 `[x]`
- 步骤 5 合并前，逐项检查清单，有 `[ ]` 未完成的不得进入合并
- sub-agent 完成自己的 block 后，将对应清单项标为 `[x]`

产出：block 列表 + `.d2c-tasks.md` 文件。

---

### 步骤 2.5：采集页面级背景（必做，不可跳过）

设计稿的**顶层 frame**（即用户传入的 `nodeId` 对应节点）代表整张活动页，其 `backgroundColor` / `fills` 表示**整屏页面背景**。

这层背景必须设到 **`body`** 上，不能设到组件根容器上——组件根容器一般有固定宽度（如 750px），超出部分在真机上会露白底。

#### 2.5.1 采集

调用 `get_design_context(fileKey, nodeId)` 取顶层节点的 `fills` / `backgroundColor`，判定类型：

| 顶层节点情况 | 类型 tag | 值 |
|---|---|---|
| `fills` 含 SOLID color | `bgColor` | HEX 值，如 `#dcd7ff` |
| `fills` 含 GRADIENT_LINEAR/RADIAL | `bgGradient` | CSS gradient 字符串 |
| `fills` 含 IMAGE | `bgImage` | 通过 REST API 导出为 `body-bg.{ext}`，记录 URL |
| `fills` 为空 / 透明 / 缺失 | `none` | 显式记录"无页面级背景"，**仍要执行后续步骤的"显式确认"动作**，但不写入任何 body 样式 |

#### 2.5.2 项目特征探测

执行写入前**必须先探测项目类型**，决定写入策略。按以下顺序检查（**逐项 Read 文件 / Grep 实证，不要凭印象判定**）：

1. **判定该 page 的 scss 是否走 css-modules**（最关键）：
   - 看页面入口的 import 形式：`import './index.scss'` → **普通 scss（全局作用）**；`import styles from './index.module.scss'` → **css-modules**
   - 看文件名：`*.module.scss` → css-modules；`*.scss` 且非 module → 普通 scss
   - 看周边页面的引法：如果项目里既有普通 scss 又有 module.scss，**以本页面实际写法为准**
   - **结论二选一：`普通 scss` / `css-modules`**
   > ⚠️ **关键**：`:global(body)` 语法**只在 css-modules 下有效**。在普通 scss 文件里写 `:global(...)`，浏览器会原样接收选择器并解析失败，**body 背景不会生效**——这是 D2C 最常见的"我明明写了 body 背景但页面还是白底"的根因。

2. **检查 `output.dir` 同级（或父级 1-2 层内）有几个 page 入口**：
   - `pages/` 下多个 `*.jsx` / `*.tsx`（Next.js / nfes 多页面） → 多页
   - react-router / SPA 多 route → 多页
   - 只有一个入口 → 单页

3. **检查全局样式入口是否已有 `body { background }` 规则**：
   - 候选文件：`pages/style/base.scss`、`src/styles/global.scss`、`app.scss`、`_app.js` 引入的全局 css
   - 用 grep 实证（**禁止猜**）

4. **检查 config 的 `project.styleFormat`**：
   - `scss` / `css-modules` / `tailwind` / `inline` / `styled-components`

把以上 4 项探测结果**全部**写入 `.d2c-tasks.md` 的"页面级背景"段，作为选档的事实依据。

#### 2.5.3 写入策略（**先按 styleFormat / module 状态选大类，再按多/单页选档**）

##### 第一层：按 styleFormat / 当前 page 的 scss 是否走 module，二选一

| 当前 page 的样式真实形态 | 大类 |
|---|---|
| 普通 scss（`import './x.scss'`），可写全局选择器 | **大类 P：plain scss** |
| css-modules（`import s from './x.module.scss'`），需 `:global(...)` 才能写全局选择器 | **大类 M：css-modules** |
| tailwind / inline / styled-components / RN stylesheet（不允许写全局选择器） | **大类 J：JS-only**（必走 useEffect） |

**判定来源**：步骤 2.5.2 第 1、4 项的实证结果。**禁止**仅依赖 config 的 `styleFormat` 判定大类——同一项目里 page A 是 module、page B 是 plain 的情况存在，必须看**当前 page** 的实际 import 形式。

##### 第二层：在大类下按"多页 / 单页"选策略

**大类 P（普通 scss）**：

| 多/单页 | 策略 | 实现 |
|---|---|---|
| 多页 | **P-A：直接写页面级 `body.<page-class>` 选择器**（本页 scss 顶部）+ **useEffect 加 / 移 class** | 见下方「策略 P-A」 |
| 单页（无论是否有全局兜底） | **P-B：直接写裸 `body { ... }`**（本页 scss 顶部） | 见下方「策略 P-B」 |

**大类 M（css-modules）**：

| 多/单页 | 策略 | 实现 |
|---|---|---|
| 多页 | **M-A：`:global(body.<page-class>)`** + useEffect 加 / 移 class | 见下方「策略 M-A」 |
| 单页 | **M-B：`:global(body) { ... }`** | 见下方「策略 M-B」 |

**大类 J（JS-only）**：

| 多/单页 | 策略 |
|---|---|
| 都用 | **J：useEffect 操作 `document.body.style.background`**（见下方「策略 J」） |

**`bgImage` 时**：无论哪一档，URL 都使用 `$asset-prefix` / `ASSET_PREFIX`（见步骤 4.3 的图片 URL 规则），**不允许在 body 样式中硬编码完整 URL**。

##### 策略 P-A：plain scss + 多页

**`.scss`**（页面 scss 顶部）：
```scss
body.<page-class>-page-bg {
  background: <值>;
}
```

**`.tsx`**：
```tsx
import { useEffect } from 'react';

useEffect(() => {
  const cls = '<page-class>-page-bg';
  document.body.classList.add(cls);
  return () => document.body.classList.remove(cls);
}, []);
```

##### 策略 P-B：plain scss + 单页

**`.scss`**（页面 scss 顶部）：
```scss
body {
  background: <值>;
}
```

不需要 useEffect。即使全局 base.scss 已有 `body { background: ... }`，本页 scss 的同名选择器**通过加载顺序自然覆盖**（page scss 在 `_app.js` import 的 base.scss 之后被引入）。

##### 策略 M-A：css-modules + 多页

**`.module.scss`**（页面 module scss 顶部）：
```scss
:global(body.<page-class>-page-bg) {
  background: <值>;
}
```

**`.tsx`**：与策略 P-A 完全相同（操作 body class）。

##### 策略 M-B：css-modules + 单页

**`.module.scss`**：
```scss
:global(body) {
  background: <值>;
}
```

不需要 useEffect。

##### 策略 J：useEffect inline style（tailwind / inline / styled-components / RN）

```tsx
useEffect(() => {
  const prev = document.body.style.background;
  document.body.style.background = '<值>';
  return () => { document.body.style.background = prev; };
}, []);
```

不写 css，直接操作 DOM。

##### 决策核对（写代码前必做的最后一次自检）

| 你写的代码 | 当前 page 的 scss 形态必须是 |
|---|---|
| `body { ... }` | 普通 scss |
| `body.xxx-page-bg { ... }` | 普通 scss |
| `:global(body) { ... }` | **css-modules** |
| `:global(body.xxx-page-bg) { ... }` | **css-modules** |

**对不上 → body 背景百分百不生效**。如果不确定，宁可走策略 J（useEffect）也不要写错。

#### 2.5.4 SSR 首屏闪白处理（可选）

若项目是 SSR（Next.js / nfes 的服务端渲染），多页策略（P-A / M-A）和 J 策略在客户端 hydrate 后才生效，可能出现首屏从全局兜底色 → 稿色的一帧闪烁。

如需消除：在该页面对应的 `getInitialProps` / `getServerSideProps` 返回的 props 里加 body class 字段，或在 `_document` 的 body 元素上根据路由 pathname 加 class。**默认不做这项优化**，除非用户明确说"避免首屏闪烁"。

#### 2.5.5 写入清单（必须勾完才进步骤 5）

`.d2c-tasks.md` 的"页面级背景"段：

```markdown
## 页面级背景（写入 body）
- [ ] 已采集顶层 frame 背景：类型 = <bgColor/bgGradient/bgImage/none>，值 = <值或 "none">
- [ ] 已探测当前 page 样式形态：scss 形态 = <普通 scss / css-modules / JS-only>，多/单页 = <多/单>，全局 body 规则 = <存在/不存在>，config.styleFormat = <scss/...>
- [ ] 已选定策略：<P-A / P-B / M-A / M-B / J>
- [ ] 已按策略写入对应文件（路径：<file>）；scss 选择器形式 = <body / body.xxx-page-bg / :global(body) / :global(body.xxx-page-bg) / 不写 scss>
- [ ] 已通过决策核对表（2.5.3 末尾）：选择器形式 vs scss 形态 一致
- [ ] 未改动任何项目全局样式文件
```

#### 2.5.6 禁止项

- 禁止把页面级背景设到组件根容器（如 `.fan-ticket-unlocked`）
- 禁止跳过本步骤；即使顶层 frame 是 `none`，也必须在清单里**显式记录** `none`，不允许沉默
- 禁止改动项目已有的全局样式文件（`base.scss` / `global.css` / `_app` 引入的全局 css）
- 禁止凭印象判定项目特征（必须 Read / Grep 文件实证后再选档）
- 禁止在 body 背景里硬编码完整图片 URL（`bgImage` 时必须用 `$asset-prefix` / `ASSET_PREFIX`）
- 禁止多页面项目使用 P-B / M-B（单页策略，会互相污染）
- 禁止在普通 scss（非 module）文件里写 `:global(...)`（语法不识别，body 背景不会生效）
- 禁止在 `*.module.scss` 里直接写 `body { ... }`（会被 hash 化变成 `.body-xxx`，不会作用到真正的 body）

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
| 含 `bg-` | 整个节点导出为图片，设为父容器 background-image，**不解析任何子层** |
| 含 `x-` | 跳过，不生成任何代码 |
| 无上述前缀 | 正常进入 4.0.5 嵌套 sub- 检测 |

**示例**：`sub-img-QA` → 去掉 `sub-` 后剩 `img-QA` → 命中 `img-` → 整体导出为 `qa.png`，生成 `<img src=".../qa.png" />`，不解析内部任何子图层。

#### 4.0.5 嵌套 sub- 检测与上报（v0.2 新增）

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

```
get_design_context(fileKey, nodeId)
```

获取：图层树、颜色/间距/字体属性、参考代码、节点截图。

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
| `font-`（`layers.font`） | 文字内容 | 生成文字节点，继续递归 |
| `scrollx-`（`layers.scrollX`） | 横向滚动容器 | 容器开 `overflow-x: auto`、子元素 `flex-shrink: 0`、隐藏滚动条；**继续递归子层** |
| `scrolly-`（`layers.scrollY`） | 纵向滚动容器 | 容器开 `overflow-y: auto`、隐藏滚动条；**继续递归子层** |
| `fixed-`（`layers.fixed`） | 视口固定定位 | 在当前节点对应的容器上加 `position: fixed`，相对视口定位；top/bottom/left/right 根据 Figma constraints 推断；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `font-` / `scrollx-` / `scrolly-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加（这三个不生成节点，没法 fixed） |

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
7. 提取 `font-` → 生成文字节点
8. 无内容前缀 → 走兜底规则
9. 若有 `btn-`，将渲染结果包裹在可点击容器内
10. 若有 `scrollx-` / `scrolly-`，给当前容器加 overflow 样式（**不新增 wrapper**，直接作用在当前节点对应的容器上）
11. 若有 `fixed-`，在最终容器上加 `position: fixed` + 根据 Figma constraints 推断 top/bottom/left/right（详见下文 **`fixed-` 定位规则**）

**`bg-` 的额外规则**

- 一个父元素下只应有**一个** `bg-` 子图层，多个时取第一个，其余忽略
- `bg-` 图层的**高度不代表父元素高度**，父元素高度由其他内容决定
- `bg-` 与 `bgc-` 可同时存在，`bgc-` 作为背景色兜底，`bg-` 作为背景图覆盖
- **切图源 nodeId 是 `bg-` 节点本身，不是父容器**（v0.2 修订，下面详细说明）

**`bg-` 切图源约束（v0.2 必读）**：

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
· 父容器内是否还有其他 sub-/block-/img-/font-/btn-/文本？{是/否}；若是 → 它们独立处理，不参与切图
```

任意一项答错即停下重做——这是 `card-bg.png` 这类 bug 的唯一防线。

**`bgc-` 取值规则（v0.2 修订，覆盖 fills/strokes/cornerRadius/effects 全套盒级 CSS 属性）**：

`bgc-` **绝对不切图**，永远只取**节点自身的盒级 CSS 属性**写到父元素。`bgc-` 节点本身不生成独立 HTML，它只是个"父元素 CSS 装饰描述符"。

**取值流程**：

1. 调用 `get_design_context(fileKey, bgcNodeId)` 拿节点完整属性
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

**为什么 v0.2 要扩展 bgc- 范围**：之前规则只让 bgc- 处理 fills，导致设计师把"渐变填充 + 4px 描边 + 圆角 + box-shadow"理解为"一个 bgc-"是合理的（这就是一个父级 box 的全套装饰），但生成端只写了 fills，描边/圆角/阴影全丢。**bgc- 现在覆盖父级 box 的所有非内容 CSS 属性**。

**`bg-` 内嵌 `bgc-` 的处理（v0.2 新增，必读）**：

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

**禁止做法**（v0.2 强约束）：

- ❌ 把 `bgc-` 节点切成 PNG（永远只取属性写 CSS）
- ❌ 把 `bgc-` + `bg-` 视觉融合到一张切图里（颜色/描边/阴影烤进位图后无法修改 / 主题切换失效）
- ❌ 把 `bgc-` 节点的 nodeId 传给 `/v1/images` API
- ❌ 父容器同时有 `bgc-` 和 `bg-` 时，**只**写 `background-image` 不写 `background-color`/`outline`/`box-shadow` 等其他 bgc- 属性
- ❌ `bgc-` 节点的属性只取 fills（必须取齐 fills/strokes/cornerRadius/effects 全套盒级属性）
- ❌ sub-agent 切 `bg-` 时跳过子树 bgc- 扫描——这是切图前自检的强制延伸

**`bg-` 切图前的"CSS-able 自检"（v0.2 必读，强制执行）**：

切 `bg-` 之前，sub-agent **必须**先调用 `get_design_context(fileKey, bgNodeId)` 拿该节点的 `fills` / `strokes` / `effects` / `cornerRadius`，然后判断**这个节点是不是其实更适合用 CSS 实现**（即应该改成 `bgc-`）。

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

1. `get_design_context(fileKey, bgNodeId)` 拿到节点完整 JSON
2. 检查 `fills`：所有 fill 的 `type` 必须 ∈ `{SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL}`，且无 IMAGE
3. 检查 `strokes`：要么空，要么所有 stroke 的 `type` 是 SOLID
4. 检查 `effects`：要么空，要么只有 1 个 DROP_SHADOW（INNER_SHADOW、LAYER_BLUR、BACKGROUND_BLUR 都让节点 CSS-unable）
5. 检查子树（用 `get_metadata` 的子节点列表）：当前节点必须**没有可见子节点**（boolean-operation / vector / 子 frame 等），或子节点都是隐藏的
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
  · 同构判断：{是否存在 ≥ 2 个同名 / 同结构子层} → {是 = 列表项需 .map() 渲染 / 否 = 异构内容逐个生成}
  · 背景层来源：{bgc- 子节点 / bg- 子节点 / 父层 fills / 无} → 不允许"无来源时 fallback 整体导出"
  · 内部 DOM 节点数（不含背景）：{M}（M 必须 ≥ N，否则说明把列表项压平了，回头重写）
  ```
  自检中任意一项无法明确填写时，**先停下问主 agent**，不允许猜测后整体导出。这是质量保证，不是性能优化——错误的整体导出会让"列表渲染"退化为"一张静态图片背景"，运行时无法绑定数据。

**布局规则：禁止使用绝对定位**

- 生成的元素**默认使用 flex 布局**，不使用 `position: absolute`
- Figma 中通过 Auto Layout 表达的间距，用 `gap` / `padding` 还原
- Figma 中无 Auto Layout 的 Frame，推断其内容排列方向（横向/纵向），用 `flex-direction` 还原
- 只有**明确的浮层/弹窗/角标**（设计上确实需要脱离文档流的元素）才允许使用 `position: absolute`

> `layers.sub`（`sub-`）前缀仅用于步骤 2 的分块判断，sub-agent 拿到的 nodeId 已是该节点本身，内部按上述规则正常解析。

**`fixed-` 定位规则（v0.2 新增）**

`fixed-` 是**定位修饰前缀**——只改 `position` 属性，不决定渲染方式。可与所有"生成节点"的前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `font-` / `scrollx-` / `scrolly-`），不可与"不生成节点"的前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM014 命中后 error）。

**top/bottom/left/right 的取值（依赖 Figma `constraints`）**：

1. 调用 `get_design_context(fileKey, fixedNodeId)` 拿 `constraints` 字段（包含 `horizontal` / `vertical`）
2. 按下表把 Figma 坐标换算成 CSS 定位（换算遵循步骤 4.4 单位换算规则）：

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

#### 4.3 图片处理

所有图片（`img-` / `bg-` / 无前缀兜底）通过 **Figma REST API** 导出，保留透明通道：

```bash
# PNG 2倍图，保留透明，严格按图层 bbox 导出（不含 effect / 父背景色）
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2&use_absolute_bounds=true" \
  -o {assetsDir}/{filename}.png

# SVG（矢量图层优先）
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=svg&use_absolute_bounds=true" \
  -o {assetsDir}/{filename}.svg
```

> **`use_absolute_bounds=true` 是必须的**（v0.2 修订）：
> - 默认导出会包含**图层 effect（drop-shadow / outer-stroke / blur）的可见范围**，PNG 会比 bbox 大一圈（多出来的部分是半透明阴影），导致 DOM 里对齐用的 `gap` / `margin` 算不准。例如设计稿 `gap: -25px`，因 PNG 多了 25px 视觉外扩，CSS 必须写 `gap: -50px` 才能视觉贴合——不可接受。
> - 默认导出在节点位于**带背景色父容器**内时，会把父背景一起 render 进 PNG（哪怕图层本身是透明的）。这就是"切出来的图都带画板背景色"的根因。
> - 加上此参数后，Figma 严格按节点 `absoluteBoundingBox` 导出，effect 和父背景被裁掉。**代价**：图层用 Figma effect 实现的阴影/光晕**不会**烤进 PNG——但这本来就是要的（阴影应该用 CSS `filter: drop-shadow()` 实现，不该烤进位图）。
> - 若某张图**就是要把 effect 烤进位图**（极少见，例如复杂渐变蒙版），单独在 config `images.preserveEffectIds` 数组里列出该 nodeId，那一张图省略此参数。

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ **SVG**
- 其他 → **PNG 2倍图**

**前提**：`figma.token` 必须在 config 中配置。**当 token 缺失或过期时（HTTP 403 / 401 / `invalid_token`），不允许跳过下载或仅用 MCP 临时链接占位**——必须按下面的兜底链拿到真实 PNG / SVG 文件。

#### 4.3.1 Token 过期 / 缺失时的兜底链（v0.2 新增）

按以下顺序逐级兜底，**任意一级成功就停止**：

| 级别 | 动作 | 何时用 |
|------|------|--------|
| **L0 主路径** | REST API + `figma.token`（上面 curl 模板） | 默认 |
| **L1 兜底** | 调用 Figma MCP **`download_assets(fileKey, nodeId, defaultFormat, defaultScale)`**，把返回的 export `url` 用 curl 拉下来存到 `{assetsDir}/{filename}.{ext}` | L0 返回 401/403/`invalid_token`/超时；或 config 里 `figma.token` 为空 |
| **L2 兜底** | 调用 Figma MCP **`upload_assets`** 走不通就直接退化为：用 `download_assets` 的 `url` **作为 `<img src>` 写进代码**（仅当用户明确说"先跑通再补图"），并在 QA 列表标红 | L1 也失败（极少：MCP 工具不可用） |
| **L3 兜底** | 终止：输出 `图片下载链路全部失败：检查 figma.token 与 MCP 可用性`，由用户决策 | 全失败 |

**关键 trade-off（必须在 QA 中标注）**：MCP `download_assets` **不支持** `use_absolute_bounds=true` 参数。走 L1 兜底拿到的图：
- **会**包含图层 effect（drop-shadow / outer-stroke / blur）的可见外扩范围，PNG 比 bbox 大一圈
- **会**包含父容器背景色（如果父有 fills）
- **结果**：会重新出现 #1（图带画板背景色）/ #3（gap 算不准）的现象，**这不是退步，而是 token 不可用时的能力上限**

走完 L1 后，QA 段落必须输出（强制）：

```
⚠️ Token 不可用，本次走 MCP download_assets 兜底导出（{N} 张）
   · 这些图未应用 use_absolute_bounds=true，可能带画板背景 / effect 外扩
   · 影响：跨 sub- 模块的对齐 gap 可能算不准，建议补 figma.token 后用 L0 重跑
   · 受影响文件：{filename1}, {filename2}, ...
```

**禁止**：
- 禁止在 token 过期时直接跳过下载（旧 SKILL 写过"跳过下载，仅用 MCP 临时链接占位"，**v0.2 起作废**——临时链接 24h 过期，代码上线就 404）
- 禁止用 MCP 临时链接（`figma.com/api/mcp/asset/...`）写进代码 `<img src>`，只允许作为下载源
- 禁止在 L1 走通后省略 QA 标注（必须让用户知道这次切的图未严格按 bbox）


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

**代码中图片可访问地址（铁律）**：

唯一公式：

```
最终 URL = images.imageBaseUrl + images.assetsDir + filename
```

- **原样字符串拼接**，不要修剪 / 不要补 / 不要"规整化"末尾斜杠
- `imageBaseUrl` 和 `assetsDir` 由项目自己配置，配置者已经决定了斜杠位置
- 不允许根据"看起来对不对"调整任何一段
- 不允许在 SCSS / CSS 里手写完整 URL；必须用 SCSS 变量统一定义后引用，**且变量值即上述公式的字面拼接结果**

**TSX/JSX 写法**：

```tsx
const ASSET_PREFIX = `${imageBaseUrl}${assetsDir}`;  // ← 直接字面拼接两个 config 字符串
// ...
<img src={`${ASSET_PREFIX}${filename}`} />
```

**SCSS 写法（强制）**：

```scss
$asset-prefix: '<imageBaseUrl 字面值><assetsDir 字面值>';  // ← 把 config 两段字符串原样首尾拼接，不动任何字符

.foo {
  background-image: url('#{$asset-prefix}filename.png');
}
```

> 反例（绝对禁止）：
> - `url('http://.../static_xxx.png')`（漏 `/`）
> - `url('http://.../static//xxx.png')`（自作主张补 `/`）
> - `url('http://.../xxx.png')`（自作主张省略 `assetsDir`）
> - 在 SCSS 中直接硬编码完整 URL，每个图各写一遍 → 容易写错且改 config 改不动

**自检**：写完任何引用图片的代码后，**逐个 URL 在大脑中重新拼一遍**：取 config 里的 `imageBaseUrl`（连带末尾字符）+ `assetsDir`（连带末尾字符）+ 文件名，三段字符串按字面值连起来，与生成出来的 URL 字符串**逐字符比对**，不一致就改。

#### 4.4 单位换算

Figma 设计稿的所有尺寸值（宽、高、间距、字号等）在写入代码前必须换算，规则如下：

**换算公式**：`输出值 = Figma值 × scale`（`scale = outputBase / figmaBase`）

**按 `outputUnit` 决定最终写法**：

| outputUnit | 写法 | 示例（Figma值=16，scale=2） |
|------------|------|--------------------------|
| `px` | 直接写 px | `32px` |
| `vw` | `Figma值 × scale / outputBase × 100` vw | `32 / 750 × 100 = 4.267vw` |
| `rem` | `Figma值 × scale / outputBase` rem | `32 / 750rem` |

**默认配置**（`figmaBase=375`，`outputBase=750`，`outputUnit=px`，`scale=2`）下：
- Figma 读到 `16px` → 生成 `32px`
- Figma 读到 `375px`（满屏宽）→ 生成 `750px`

**禁止直接把 Figma 原始值写入代码**，所有尺寸必须经过换算。

#### 4.5 框架适配

| framework + styleFormat | 组件语法 | 样式输出 |
|------------------------|---------|---------|
| react + scss | TSX + className | `.scss` 文件 |
| react + css-modules | TSX + styles.xxx | `.module.css` 文件 |
| react + tailwind | TSX + className | 无独立样式文件 |
| react + inline | TSX + style={{}} | 无独立样式文件 |
| rn + stylesheet | RN JSX | `StyleSheet.create({})` 内联 |
| rn + styled-components | styled-components/native | 无独立样式文件 |
| rn + nativewind | TSX + className | 无独立样式文件 |

#### 4.6 sub-agent 输出文件结构

```
{output.dir}/blocks/{label}/
├── index.tsx        ← 组件主体
├── index.scss       ← 样式文件（按 styleFormat 决定格式）
└── assets.txt       ← 本 block 图片清单（文件名 + 原始临时链接）
```

#### 4.7 sub-agent 独立验收

代码生成完成后，sub-agent 对自己负责的 block 做视觉验收：

1. 调用 `get_screenshot(fileKey, nodeId)` 获取本 block 的截图
2. 与生成代码做视觉差异分析
3. 可自动修正的差异（颜色偏差、间距误差）直接修正
4. 不可自动修正的差异记入 `assets.txt` 底部的 `QA` 段落

```
# QA
- [可自动修正] 已修正：...
- [需手动处理] 字体缺失：...
```

验收通过后 sub-agent **立即将 `.d2c-tasks.md` 中对应的 `[ ]` 改为 `[x]`**，主 agent 方可进入步骤 5。

---

### 步骤 5：主 agent 合并

**合并前必须检查 `.d2c-tasks.md`，确认以下所有项均为 `[x]`**：
- 所有 Sub-agent Blocks（含嵌套层级，深度优先逐项检查）
- 所有主 agent 直接处理节点
- 背景节点

有任何 `[ ]` 未完成，必须先补齐再合并，不得跳过。

等待所有 sub-agent 完成后，按 `merge.mode` 合并。

#### 5.0 placeholder 展开（v0.2 新增，嵌套 sub- 必经步骤）

合并前先做一次 **`<__SUBSLOT__>` 展开**：

1. 对每个父 block，读取其 `subslots.json`
2. 找到 JSX 里的 `<__SUBSLOT__ nodeId="..." name="..." />` 占位
3. 按 merge.mode 决定替换形式：
   - **component 模式** → 替换为 `<ChildBlockName />` 的 JSX 元素，并在父 block 的 index.tsx 顶部 `import ChildBlockName from './blocks/{child-name}'`（嵌套目录路径见下）
   - **flat 模式** → 替换为子 block 的完整 JSX 内容（递归展开后的最终 HTML 树），子 block 的 SCSS 内容追加到父 block 的 index.scss
4. **从最深层开始展开**（深度优先）：先展开 depth=3 的占位 → 再展开 depth=2 → 最后 depth=1。这样合并时不会出现"展开后又冒出新的占位"
5. 展开完成后 `__SUBSLOT__` 标签必须 0 个残留——验收脚本：`grep -r "__SUBSLOT__" {output.dir}` 应为空

#### component 模式（默认）

嵌套 sub- 生成嵌套目录结构：

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx                ← 主文件，import 顶层 block 子组件
│   └── index.scss               ← @import 顶层 block 样式
└── blocks/
    ├── content/                 ← Block 1: sub-content (depth=1)
    │   ├── index.tsx            ← 父 block 主体，import 内层
    │   ├── index.scss
    │   └── blocks/              ← 嵌套：内层 sub- 在父 block 的 blocks/ 子目录
    │       ├── card/            ← Block 1.1: sub-card (depth=2)
    │       │   ├── index.tsx
    │       │   └── index.scss
    │       └── scrolly-车票列表/ ← Block 1.2: sub-scrolly-车票列表 (depth=2)
    │           ├── index.tsx
    │           └── index.scss
    └── img-QA/                  ← Block 2: sub-img-QA (depth=1)
        └── ...
```

主文件示例（顶层）：
```tsx
import Content from './blocks/content'
import ImgQA from './blocks/img-QA'

export default function ComponentName() {
  return (
    <div className="component-name">
      <Content />
      <ImgQA />
    </div>
  )
}
```

父 block index.tsx 示例（含嵌套）：
```tsx
import Card from './blocks/card'
import ScrollyList from './blocks/scrolly-车票列表'

export default function Content() {
  return (
    <div className="content">
      {/* 上半区... */}
      <Card />
      <ScrollyList />
      {/* 下半区... */}
    </div>
  )
}
```

#### flat 模式

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 所有 block JSX 递归展开后平铺
│   └── index.scss       ← 所有 block 样式递归追加
└── blocks/              ← 保留所有层级，不删除
    └── content/
        └── blocks/
            ├── card/
            └── scrolly-车票列表/
```

合并规则：
- JSX 按嵌套树**深度优先展开**：父 block 的 placeholder 替换成子 block 完整 JSX，子 block 的 placeholder 再展开（递归）
- 每段保留注释，标明嵌套关系：`{/* --- block: sub-content > sub-card --- */}`
- 样式按展开顺序追加，类名保持各自命名空间（命名空间规则不变）
- 类名冲突时自动加 block 名前缀解决（嵌套 block 用 `parent-child-` 前缀）

---

### 步骤 6：主 agent 合并验收

合并完成后，主 agent **必须**做两轮视觉验收（顺序不可调换）：

#### 6.0 逐叶子 sub-block 单独视觉对比（v0.2 强制，不分 merge.mode）

> **核心原则**：无论 `merge.mode` 是 `component` 还是 `flat`，**主 agent 都必须对每个叶子 sub-agent 产出的 block 做单独的视觉对比**，而不是只对合并整体看一眼大图。
>
> **叶子 sub-block 的定义**：在 `.d2c-tasks.md` 树状清单中**没有任何子 sub-** 的 block。父 block 不单独对比（其视觉效果 = 内层叶子的总和，会重复检查）；父 block 的协调由 §6.1 整体验收兜底。

**为什么必须逐叶子对比**：

- sub-agent 在 §4.7 做的是**自我验收**——同一上下文里写完代码再看截图，视觉差异极易"看不到自己的盲点"（self-blind）。这是大模型生成代码的已知 bias，不是某个 sub-agent 的能力问题
- flat 模式合并后子组件结构被打散在同一文件里，**整体大图扫一眼很难定位到具体某个 block 的局部偏差**（尺寸 1px / 颜色 #abc vs #abd / 字号差 1pt）
- component 模式虽然 block 还在独立目录，但主 agent §6 整体验收时，目标节点 nodeId 是页面根，得到的截图分辨率被压缩到容纳整页，**单个 block 内部细节在大图里像素不够看**
- `switchAgentVerification=true` 的本意就是 sub 写、主验，本节落地这条配置在 D2C 主流程里的意义
- **嵌套 sub- 场景**：父 block 含若干内层 sub-，父 block 的视觉效果 = 内层叶子 sub- 的拼接 + 父 block 自己的非 sub 内容。逐叶子对比 + §6.1 整体验收 已能覆盖；额外对比父 block 是冗余

**步骤**：

对 `.d2c-tasks.md` 中**每个叶子 sub-block**（无内层 sub- 的 block），主 agent 依次执行：

1. 调用 `get_screenshot(fileKey, leafBlockNodeId, maxDimension=1200)` 获取该 block 原始设计稿截图（分辨率拉满，看清细节）
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
| 间距（padding/margin/gap） | ±1px | 同上；若用了负 margin 凑，先核对图片是否带光晕外扩（见 §4.3 use_absolute_bounds） |
| 颜色 | ΔE ≤ 3 | 用 Figma 取色值替换，不允许"看起来差不多" |
| 字号 | 完全相等 | 设计稿是真值，不允许改 |
| 字重 | 完全相等 | 同上 |

**叶子 sub-block 之间的"接缝"也要看**：flat 模式下相邻叶子在 JSX 里挨着，但视觉上可能有意外的间距（因为各自的 margin/padding 叠加）。整体验收时容易漏看，**这一步逐叶对比时也要把当前叶子的"上边界"和"下边界"与原稿对齐**。父 block 内多个叶子之间的接缝同理。

#### 6.1 整体视觉验收

1. 调用 `get_screenshot(fileKey, nodeId)` 获取原始设计稿**整体**截图（目标 nodeId 是页面根）
2. 与合并后的完整组件做视觉差异分析
3. 汇总各 block QA 段落中未解决的差异 + §6.0 写入 `## 待人工核对` 的项
4. 可自动修正的整体差异（对齐偏差、间距）直接修正
5. 不可自动修正的差异输出到最终交付清单

> §6.0 和 §6.1 不是冗余：§6.0 看每个 block 内部的局部差异，§6.1 看 block 之间的整体协调差异（如全页背景在不同 block 上是否连续、整页滚动定位是否符合预期）。两者关注点正交。

#### 6.1 图片 URL 自检（强制）

合并完成后，对生成的所有 `.tsx` / `.jsx` / `.scss` / `.css` / `.module.css` 文件做一次 URL 自检：

1. 用 grep 扫描所有 `url(` 和 `src=` 出现位置，提取完整 URL 字符串
2. 对每个 URL，按字面公式 `imageBaseUrl + assetsDir + filename` 重新拼接预期值
3. 与实际 URL **逐字符比对**，不一致即修复
4. 检查 SCSS：是否每个 URL 都通过 `$asset-prefix` 变量引用？散落的硬编码完整 URL 必须改为变量引用

> 这一步不依赖视觉对比，是纯字符串校验，**不允许跳过**。

如需跳过，用户可明确说「跳过 QA」。

---

### 步骤 7：输出交付物清单

```
✅ 生成文件：{output.dir}/ComponentName/
📦 需下载图片：（汇总 assets.txt，含原始临时链接）
⚠️  需手动处理：（QA 发现的不可自动修正差异）
```

---

## 禁止项

- 禁止把 `img-` / `bg-` 前缀图层拆解为 CSS 实现
- 禁止在代码中写 HEX 色值或 px 魔法数字（使用 Token 变量，若项目有）
- 禁止跳过步骤 -1 的预检
- 禁止使用 Figma node ID 作为图片文件名
- 禁止 x- / img- / bg- / 无前缀非文本图层向内递归子图层
- 禁止把 `sub-` 前缀当作图层解析规则处理，sub- 仅用于分块判断
- 禁止把 `block-` 块内的元素与其他块的元素合并到同一 HTML 容器或共享 CSS 类名
- 禁止只匹配第一个前缀就停止，必须扫描完整图层名提取所有已知前缀
- 禁止脱离 `images.imageBaseUrl + images.assetsDir + filename` 公式拼接图片 URL；禁止补/删任何字符（包括末尾 `/`）；禁止在 SCSS 中分散硬编码完整 URL，必须先定义 `$asset-prefix` 变量再引用
- 禁止跳过步骤 2.5 页面级背景采集；禁止把顶层 frame 的页面级背景写到组件根容器；禁止改动项目已有的全局样式文件（base.scss / global.css）；禁止凭印象判定项目特征（必须 Read/Grep 实证后选 P-A / P-B / M-A / M-B / J 策略）；禁止多页面项目使用 P-B / M-B（单页策略，会互相污染）；**禁止在普通 scss 里写 `:global(...)`、禁止在 `*.module.scss` 里直接写 `body { ... }`（写错则 body 背景百分百不生效）**
- 禁止"sub- 只有 1 个就退化为主 agent 处理"；任何 `sub-` 节点都必须分发独立 sub-agent，**单 sub 也必须拆**（分块是质量保证而非性能优化）
- 禁止 `scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存（语义冲突）；禁止同一节点同时含 `scrollx-` 和 `scrolly-`（一个元素只能一个滚动方向）；禁止省略隐藏滚动条样式（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）
- 禁止把 `sub-scrollx-` / `sub-scrolly-` 节点**整体导出为单张背景图**作为容器 `background-image`：scroll 容器必须**继续递归子层**（§416-417），子层是同构列表项；只有标了 `bgc-` / `bg-` 的子节点才作为背景。即便子层结构复杂、识别困难，也不允许"省事 fallback 到整体导出"——需要时把识别失败的子树标 `x-` 或拆分稿子，不能用整体导出绕过。
- 禁止调用 Figma `/v1/images` 时省略 `use_absolute_bounds=true`：不带此参数会把图层 effect（drop-shadow / outer-stroke / blur）和父背景色一起 render 进 PNG，导致"图都带画板背景色"+"对齐用的 gap / margin 算不准（视觉外扩）"两个 bug 同时发生。仅当某张图明确要把 effect 烤进位图（在 config `images.preserveEffectIds` 列出 nodeId）时才省略。
- 禁止把 `bg-` 节点的**父容器**当成切图源传给 `/v1/images` API：切图源 nodeId 必须是 `bg-` 节点自己。把父容器整体切下会导致 `bgc-` 颜色、其他兄弟节点（block-/img-/font-/文本）融合到一张 PNG，违反"`bgc-` 写 CSS 颜色、`bg-` 写 CSS 背景图、内容层独立处理"的分离原则
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
