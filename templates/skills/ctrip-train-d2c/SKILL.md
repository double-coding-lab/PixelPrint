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

**唯一真正"被执行"的事情有两类**：（1）调用 Figma REST API（通过 Bash 执行 curl）读取节点属性 / 导出图片 / 截图，以及本地文件读写；（2）在对话里产出文本（包括代码、JSON、报告、决策）。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

> **v0.3 起本 SKILL 完全走 Figma REST API，不再依赖任何 `mcp__plugin_figma_figma__*` 工具**。这样做的理由：MCP 工具会附带"AI 生成的参考代码"字段，容易让 agent 信参考代码结构 > 信项目前缀规则（历史事故：`bg-` 节点被 MCP 参考代码展开成 `display: contents` 子结构，agent 跟着递归 DOM 化）。REST API 只返回原始节点 JSON，前缀规则永远优先。

> 误把伪代码当真函数会卡死流程（等待一个永远不会到来的"返回值"），或者绕过关键步骤（"既然 SKILL 里说 doctor.run() 就行，那直接跳到 §1"）。

---

## 执行流程

### 步骤 -1（前置预检）：检测 Figma Token 可用性

在任何操作前执行，不可跳过。

**做法**：调用脚本探针（脚本会自动 Read config、发 `/v1/me`、按状态码判定）：

```bash
node .claude/skills/ctrip-train-d2c/bin/figma.mjs verify-token
```

**返回约定**：
- 退出码 `0` + stdout `{"ok":true,"data":{"email":...,"handle":...}}` → 继续步骤 0
- 退出码非 0 + stdout `{"ok":false,"error":"..."}` → 把 `error` 显示给用户并终止；建议提示：

  ```
  ❌ Figma Token 探针失败：<error 内容>

  请检查 `ctrip-train-d2c.config.json` 里的 `figma.token`：
  1. 是否已配置且未过期（Figma 网页版右上角头像 → Settings → Security → Personal access tokens）
  2. Token 权限是否包含 File content: Read-only
  3. 网络能否访问 api.figma.com
  ```

> **v0.3 变更**：本 SKILL 已完全移除 MCP 依赖，所有 Figma 数据读取都走 `figma.mjs` 脚本（内部调 REST API）。不再需要在 Claude Code 里装 Figma 插件或走 OAuth。

---

### 步骤 0：读取配置

```
Read("ctrip-train-d2c.config.json")
```

**同时缓存 `projectRoot`**：即 `ctrip-train-d2c.config.json` 所在目录的**绝对路径**（例如 `/Users/xxx/Desktop/项目/xxx-function`）。后续所有涉及**本地文件写入**的路径（图片下载、代码产出）都必须以 `projectRoot` 为基点拼绝对路径，**禁止**依赖当前 cwd 使用相对路径——sub-agent 可能切换 cwd，相对路径会落到错误位置。

缓存以下字段，后续步骤全部以此为准：

| 字段 | 用途 |
|------|------|
| `project.framework` | 生成代码的目标框架（react / rn） |
| `project.styleFormat` | 样式方案标识符（取值见下表） |
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
| `layers.end` | 逆向布局前缀（贴父末端），默认 `end-` |
| `layers.input` | 输入框前缀，默认 `input-` |
| `layers.ignore` | 忽略前缀，默认 `x-` |
| `output.dir` | 代码输出根目录 |
| `health.enabled` | 是否启用前置体检（默认 true） |
| `health.blockOnError` | 体检 grade=F 时是否阻塞生成（默认 true） |

#### 样式方案标识符（`project.styleFormat` 取值表）

`styleFormat` 是**预处理语法 + 是否走 css-modules** 两个维度的复合标识符。由 `install.js` 交互式 init 写入（题号 [2a/8]/[2b/8]/[2c/8]，详见 install.js `runInit`），SKILL 跑时根据这个值决定**文件后缀 / import 语法 / className 写法**。

**React 项目（`framework: 'react'`）**：

| styleFormat | 样式方式 | 预处理 | 走 module | 生成文件 | import 语法 | className 写法 |
|------------|---------|--------|----------|---------|------------|--------------|
| `scss` | stylesheet | scss | 否 | `index.scss` | `import './index.scss'` | `className="card"` |
| `scss-modules` | stylesheet | scss | 是 | `index.module.scss` | `import styles from './index.module.scss'` | `className={styles.card}` |
| `less` | stylesheet | less | 否 | `index.less` | `import './index.less'` | `className="card"` |
| `less-modules` | stylesheet | less | 是 | `index.module.less` | `import styles from './index.module.less'` | `className={styles.card}` |
| `css` | stylesheet | css | 否 | `index.css` | `import './index.css'` | `className="card"` |
| `css-modules` | stylesheet | css | 是 | `index.module.css` | `import styles from './index.module.css'` | `className={styles.card}` |
| `tailwind` | tailwind | — | — | （无独立样式文件） | （无） | `className="flex items-center gap-4 p-8"` |
| `inline` | inline | — | — | （无独立样式文件） | （无） | `style={{display:'flex', padding:8}}` |

**React Native 项目（`framework: 'rn'`）**：

| styleFormat | 含义 |
|------------|------|
| `stylesheet` | `StyleSheet.create({...})` |
| `styled-components` | `styled.View\`...\`` |
| `nativewind` | NativeWind className |

**关键判定**：

- "是否走 module"看 styleFormat 后缀是否带 `-modules`（`scss-modules` / `less-modules` / `css-modules`），不依赖文件后缀猜
- 步骤 2.5.3 的 P-A/P-B/M-A/M-B 五档判定中，**M 系**（module）= styleFormat 带 `-modules`，**P 系**（plain）= 不带
- 同一项目里 page A 走 module / page B 不走 module 时，**以当前 page 的实际 import 形式为准**（步骤 2.5.2 实证），config.styleFormat 仅是 hint

---

### 步骤 0.3：初始化缓存（v0.3 新增，不可跳过）

**目的**：把 Figma REST API 拿到的节点属性 / 图片文件缓存到本地，避免同一稿子每次跑 SKILL 都重拉。

**做法**：主 agent 在解析 URL（步骤 1）拿到 `fileKey` 后，立即调：

```bash
node .claude/skills/ctrip-train-d2c/bin/figma.mjs cache-check <fileKey>
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

**gitignore 兜底**（老项目升级到 v0.3 首次跑时可能没有 gitignore 条目）：

调 `cache-check` 前先自查一次 `{projectRoot}/.gitignore`，缺 `.d2c-cache/` 或 `.d2c-tmp/` 就追加。install.js 已在 init 时处理，此步是**已存在老项目**的兜底。

**禁止项**：
- 禁止跳过 `cache-check`（会让缓存在设计稿改过后仍被复用）
- 禁止在同一次 SKILL 运行里多次 `cache-check`（主 agent 校验一次即可，sub-agent 只读缓存不校）
- 禁止绕过脚本直接手写 curl 或手动管理 `.d2c-cache/` 内容
- 禁止把 QA 截图落到 `.d2c-cache/`（脚本 `screenshot` 命令固定落 `.d2c-tmp/`，别改）

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

**拉节点树**：

```bash
node .claude/skills/ctrip-train-d2c/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=2
```

stdout 是 `{"ok":true,"data":{"cached":<bool>,"node":{...}}}`。`node` 就是目标节点的完整子孙树（含 `type` / `name` / `children` / `visible` / `absoluteBoundingBox` 等）。脚本已处理缓存查/写，LLM 不用管。

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
- [ ] 图片 URL 自检完成（§6.2）
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

**复用步骤 2 已拿的 `node` 对象**，取其 `fills` / `backgroundColor` 字段，不再单独发 API 请求。判定类型：

| 顶层节点情况 | 类型 tag | 值 |
|---|---|---|
| `fills` 含 SOLID color | `bgColor` | HEX 值，如 `#dcd7ff` |
| `fills` 含 GRADIENT_LINEAR/RADIAL | `bgGradient` | CSS gradient 字符串 |
| `fills` 含 IMAGE | `bgImage` | 通过 REST API 导出为 `body-bg.{ext}`，记录 URL |
| `fills` 为空 / 透明 / 缺失 | `none` | 显式记录"无页面级背景"，**仍要执行后续步骤的"显式确认"动作**，但不写入任何 body 样式 |

#### 2.5.2 项目特征探测

执行写入前**必须先探测项目类型**，决定写入策略。按以下顺序检查（**逐项 Read 文件 / Grep 实证，不要凭印象判定**）：

1. **判定该 page 的样式文件是否走 css-modules**（最关键）：
   - 看页面入口的 import 形式：
     - `import './index.scss'` / `'./index.less'` / `'./index.css'` → **普通 stylesheet（全局作用）**
     - `import styles from './index.module.scss'` / `'.module.less'` / `'.module.css'` → **css-modules**
   - 看文件名：`*.module.{scss,less,css}` → css-modules；`*.{scss,less,css}` 且非 module → 普通 stylesheet
   - 看周边页面的引法：如果项目里既有普通形态又有 module 形态，**以本页面实际写法为准**
   - **结论二选一：`plain stylesheet` / `css-modules`**（预处理语法用什么不影响这个结论）
   > ⚠️ **关键**：`:global(body)` 语法**只在 css-modules 下有效**。在普通 stylesheet（无论 scss/less/css）里写 `:global(...)`，浏览器会原样接收选择器并解析失败，**body 背景不会生效**——这是 D2C 最常见的"我明明写了 body 背景但页面还是白底"的根因。

2. **检查 `output.dir` 同级（或父级 1-2 层内）有几个 page 入口**：
   - `pages/` 下多个 `*.jsx` / `*.tsx`（Next.js / nfes 多页面） → 多页
   - react-router / SPA 多 route → 多页
   - 只有一个入口 → 单页

3. **检查全局样式入口是否已有 `body { background }` 规则**：
   - 候选文件：`pages/style/base.scss`、`src/styles/global.scss`、`pages/style/base.less`、`app.css`、`_app.js` 引入的全局样式入口
   - 用 grep 实证（**禁止猜**）

4. **检查 config 的 `project.styleFormat`**：
   - 取值参见 §0「样式方案标识符」表（`scss` / `scss-modules` / `less` / `less-modules` / `css` / `css-modules` / `tailwind` / `inline` / RN 的 `stylesheet`/`styled-components`/`nativewind`）
   - 结合第 1 项探测结果做交叉验证；不一致时**以第 1 项实证为准**

把以上 4 项探测结果**全部**写入 `.d2c-tasks.md` 的"页面级背景"段，作为选档的事实依据。

#### 2.5.3 写入策略（**先按 styleFormat / module 状态选大类，再按多/单页选档**）

##### 第一层：按 styleFormat / 当前 page 的 scss 是否走 module，二选一

| 当前 page 的样式真实形态 | 大类 |
|---|---|
| 普通 scss / less / css（`import './x.scss'` / `'.less'` / `'.css'`），可写全局选择器 | **大类 P：plain stylesheet** |
| css-modules（`import s from './x.module.scss'` / `'.module.less'` / `'.module.css'`），需 `:global(...)` 才能写全局选择器 | **大类 M：modules stylesheet** |
| tailwind / inline / styled-components / RN stylesheet（不允许写全局选择器） | **大类 J：JS-only**（必走 useEffect） |

**判定来源**：步骤 2.5.2 第 1、4 项的实证结果。**禁止**仅依赖 config 的 `styleFormat` 判定大类——同一项目里 page A 是 module、page B 是 plain 的情况存在，必须看**当前 page** 的实际 import 形式。

> **预处理语法不影响大类**：plain scss / plain less / plain css 都进 **P**；scss-modules / less-modules / css-modules 都进 **M**。下面策略示例统一用 `.scss` / `.module.scss` 表示——less 项目把后缀替换成 `.less` / `.module.less`，css 项目替换成 `.css` / `.module.css`，语义完全相同。

##### 第二层：在大类下按"多页 / 单页"选策略

**大类 P（plain stylesheet：scss / less / css 均适用）**：

| 多/单页 | 策略 | 实现 |
|---|---|---|
| 多页 | **P-A：直接写页面级 `body.<page-class>` 选择器**（本页样式文件顶部）+ **useEffect 加 / 移 class** | 见下方「策略 P-A」 |
| 单页（无论是否有全局兜底） | **P-B：直接写裸 `body { ... }`**（本页样式文件顶部） | 见下方「策略 P-B」 |

**大类 M（modules stylesheet：scss-modules / less-modules / css-modules 均适用）**：

| 多/单页 | 策略 | 实现 |
|---|---|---|
| 多页 | **M-A：`:global(body.<page-class>)`** + useEffect 加 / 移 class | 见下方「策略 M-A」 |
| 单页 | **M-B：`:global(body) { ... }`** | 见下方「策略 M-B」 |

**大类 J（JS-only）**：

| 多/单页 | 策略 |
|---|---|
| 都用 | **J：useEffect 操作 `document.body.style.background`**（见下方「策略 J」） |

**`bgImage` 时**：无论哪一档，URL 都使用 `$asset-prefix` / `ASSET_PREFIX`（见步骤 4.4 的图片 URL 规则），**不允许在 body 样式中硬编码完整 URL**。

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

| 你写的代码 | 当前 page 的样式形态必须是 |
|---|---|
| `body { ... }` | 普通 stylesheet（scss / less / css 均可） |
| `body.xxx-page-bg { ... }` | 普通 stylesheet（scss / less / css 均可） |
| `:global(body) { ... }` | **css-modules**（scss-modules / less-modules / css-modules 均可） |
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
- [ ] 已探测当前 page 样式形态：样式形态 = <plain stylesheet / css-modules / JS-only>，预处理语法 = <scss / less / css>，多/单页 = <多/单>，全局 body 规则 = <存在/不存在>，config.styleFormat = <scss/scss-modules/less/less-modules/css/css-modules/tailwind/inline/...>
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
- 禁止在普通 stylesheet（非 module 的 scss / less / css）里写 `:global(...)`（语法不识别，body 背景不会生效）
- 禁止在 `*.module.{scss,less,css}` 里直接写 `body { ... }`（会被 hash 化变成 `.body-xxx`，不会作用到真正的 body）

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

调脚本拿节点属性（含子树）：

```bash
node .claude/skills/ctrip-train-d2c/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=8
```

`node` 里含图层树、以下几类字段必须读全（脚本自动查/写缓存）：

- **视觉属性**：`fills` / `strokes` / `strokeWeight` / `strokeAlign` / `effects` / `cornerRadius` / `rectangleCornerRadii` / `opacity` / `blendMode`
- **布局属性（autoLayout，v0.3.1 强调）**：`layoutMode` / `itemSpacing` / `paddingLeft` / `paddingRight` / `paddingTop` / `paddingBottom` / `primaryAxisAlignItems` / `counterAxisAlignItems` / `layoutWrap` / `layoutSizingHorizontal` / `layoutSizingVertical`
- **子节点尺寸行为**：`layoutGrow` / `layoutAlign` / `layoutPositioning`（`AUTO` = 参与父 autoLayout 顺流；`ABSOLUTE` = 脱离父顺流，用 `absoluteBoundingBox` 独立定位。缺失视为 `AUTO`）
- **定位**：`constraints` / `absoluteBoundingBox`
- **文本**：`characters` / `style`（TEXT 节点）
- **可见性**：`visible`

> **v0.3 铁律：不再使用 MCP `get_design_context` 返回的"参考代码"字段**。REST API 只返回原始节点 JSON，agent 按项目前缀规则（§4.0 / §4.3）自主判断如何渲染，不受任何"AI 生成的通用 D2C 参考代码"干扰。

> **v0.3.1 强调**：`layoutMode` 字段是 Figma autoLayout 的核心信号。**每处理一个 Frame 节点，必须先读 `layoutMode`**（`HORIZONTAL` / `VERTICAL` / 缺失 = 无 autoLayout）；这是 §4.3 布局判定的入口条件，跳过读它会直接退化成 absolute 定位泛滥。

> **v0.3.1 补丁：`layoutPositioning`（读每个子节点时必读）**：Figma auto-layout 支持"子节点脱离父顺流"——子节点 `layoutPositioning === 'ABSOLUTE'` 表示该子在父 autoLayout 里挖了个洞独立定位；其他兄弟仍按 flex 顺流。**读子节点时必读此字段**，值为 `ABSOLUTE` 时子走绝对定位、父仍走 flex（见 §4.3 判定优先级第 0 条）。

#### 4.1.1 REST 原始 JSON 字段取值指引（v0.3 新增；v0.3.1 补 autoLayout）

Figma REST API 返回的原始 JSON 字段名与结构比 MCP 加工过的多一层壳；agent 从中取值时按下表映射：

**A. 布局 / autoLayout → flex（v0.3.1 新增，最高优先级；每个 Frame 都必须先读这一段）**

| 目标 CSS | Figma REST 字段 | 取值细节 |
|---------|----------------|---------|
| `display: flex` | `layoutMode`：`HORIZONTAL` / `VERTICAL` / (缺失或 `NONE` = 无 autoLayout) | 只要 `layoutMode ∈ {HORIZONTAL, VERTICAL}` → 该 Frame **必须**用 flex；缺失/`NONE` → 走 §4.3 决策树后续步骤 |
| `flex-direction` | `layoutMode` | `HORIZONTAL → row`；`VERTICAL → column` |
| `gap` | `itemSpacing` (px) | 直接映射；数值按 §4.5 单位换算 × scale |
| `padding-top` / `padding-right` / `padding-bottom` / `padding-left` | `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` (px) | 缺失字段视为 0 |
| `justify-content` (主轴对齐) | `primaryAxisAlignItems` | `MIN → flex-start`；`CENTER → center`；`MAX → flex-end`；`SPACE_BETWEEN → space-between`（**两端对齐**，设计师在 Figma 主轴对齐里选"两端对齐"时返回此值） |
| `align-items` (交叉轴对齐) | `counterAxisAlignItems` | `MIN → flex-start`；`CENTER → center`；`MAX → flex-end`；`BASELINE → baseline` |
| `flex-wrap` | `layoutWrap` | `WRAP → wrap`；`NO_WRAP` 或缺失 → 默认（`nowrap`） |
| 容器**自身**尺寸行为 | `layoutSizingHorizontal` / `layoutSizingVertical` | `FIXED → width/height 固定值`；`HUG → width/height 由内容撑开`（CSS 里对应 `width: fit-content` 或**不写宽度**）；`FILL → width: 100%`（在 flex 父下等价 `flex: 1`）。**页面根容器例外**（v0.3.3 新增）：vertical `FIXED` 时不写 `height: {figmaH}px` 死值，改写 `min-height: max({figmaH * scale}px, 100vh)`；判定见 §4.3 判定优先级第 6 条 |
| **子节点**主轴伸缩 | `layoutGrow` (0 或 1) | `1 → flex: 1`（在父 flex 下沿主轴撑满剩余空间）；0 或缺失 → 不写 |
| **子节点**交叉轴对齐（覆盖父 align-items） | `layoutAlign` | `STRETCH → align-self: stretch`；`INHERIT` / 缺失 → 不写（继承父 align-items） |
| **子节点**是否脱离父 autoLayout 顺流 | `layoutPositioning` | `AUTO` 或缺失 → 参与父 flex 顺流，不写 position；`ABSOLUTE` → 子代 `position: absolute` + `top/left`（相对父原点，用 `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` 算得），同时**父容器必须加** `position: relative`。**仅当父 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 时此字段有意义**。此机制通用（不限于 `bg-` / `fixed-` 前缀）——任何设计师在 Figma 里勾选"绝对定位"的子节点都会返 `ABSOLUTE` |

> **v0.3.1 铁律**：`layoutMode` 是 `HORIZONTAL` / `VERTICAL` 时，**禁止**对该 Frame 使用 `position: absolute` + `top/left`；主 agent §6.0 验收命中此违反 → 回退整块重写。
>
> **两端对齐特别提醒**：`primaryAxisAlignItems === 'SPACE_BETWEEN'` 是明确信号，**直接翻译成 `justify-content: space-between`**，不要用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟。设计师用两端对齐排 = REST 返 `SPACE_BETWEEN`；设计师用固定间距排 = REST 返 `MIN` + `itemSpacing`。忠实翻译即可，不做推断。
>
> **`layoutPositioning` vs `layoutMode` 谁决定 CSS 定位方式（看谁：看自己 or 看父）**：`layoutMode` 描述**该节点自己**的内部布局（父视角）；`layoutPositioning` 描述**该节点在父容器里**是否脱离顺流（子视角）。两者互不冲突：一个节点可以自己是 autoLayout 容器（`layoutMode = VERTICAL`），同时又在父的 autoLayout 里绝对定位（`layoutPositioning = ABSOLUTE`）——CSS 里写成 `position: absolute; top:...; left:...; display: flex; flex-direction: column; ...`。

**B. 视觉属性**

| 目标 CSS | Figma REST 字段 | 取值细节 |
|---------|----------------|---------|
| `background-color` (SOLID) | `fills[i].color = {r, g, b, a}` (0-1 浮点) + `fills[i].opacity` (可选，0-1) | HEX = `#` + `Math.round(r*255).toString(16).padStart(2,'0')` 三段拼接；`a` 或 `opacity` < 1 时改用 `rgba(R,G,B,A)`（R/G/B 是 0-255 整数） |
| `background-image: linear-gradient(...)` | `fills[i].type = 'GRADIENT_LINEAR'` + `gradientHandlePositions[3 点]` + `gradientStops[]` | 角度按 `gradientHandlePositions[0]→[1]` 向量算：`angle = Math.atan2(y1-y0, x1-x0) * 180 / Math.PI + 90`；stops 用 `gradientStops[i].position * 100%` + `gradientStops[i].color`（同上转 rgba） |
| `background-image: radial-gradient(...)` | `fills[i].type = 'GRADIENT_RADIAL'` | 类似，Figma 里 `[0]` 是圆心，`[1]` 决定 x 半径，`[2]` 决定 y 半径 |
| `background-image: url(...)` | `fills[i].type = 'IMAGE'` + `fills[i].imageRef` | 该节点需按 §4.4 走图片导出；`imageRef` 只是图片资源哈希，实际下载靠 `/v1/images` API |
| `border`（inside stroke） | `strokes[i]` + `strokeWeight` + `strokeAlign = 'INSIDE'` | `border: {strokeWeight}px solid {color}` + `box-sizing: border-box` |
| `outline`（outside stroke） | `strokes[i]` + `strokeWeight` + `strokeAlign = 'OUTSIDE'` | `outline: {strokeWeight}px solid {color}`；gradient stroke 降级为 `box-shadow: 0 0 0 {weight}px ...` |
| `border-radius` | 单值 `cornerRadius`，或四角 `rectangleCornerRadii = [tl, tr, br, bl]` | 优先 `rectangleCornerRadii`；只有 `cornerRadius` 时四角同值 |
| `box-shadow` | `effects[i].type = 'DROP_SHADOW'` + `offset.{x,y}` + `radius` + `color` + `spread` (可选) | `box-shadow: {x}px {y}px {radius}px {spread}px {rgba}`；`INNER_SHADOW` 加 `inset` 前缀 |
| `filter: blur(...)` | `effects[i].type = 'LAYER_BLUR'` + `radius` | 前景/自身模糊 |
| `backdrop-filter: blur(...)` | `effects[i].type = 'BACKGROUND_BLUR'` + `radius` | 背景模糊 |
| `position: fixed` 定位来源 | `constraints = {horizontal, vertical}` + `absoluteBoundingBox = {x, y, width, height}` | horizontal 取值：`LEFT` / `RIGHT` / `CENTER` / `LEFT_RIGHT` / `SCALE`；vertical 同理加 `TOP` / `BOTTOM`。**注意 REST 里字段就叫 `constraints`，值不是 `position` 而是 `LEFT`/`RIGHT` 等** |
| `font-family` / `font-size` / `font-weight` / `line-height` | `style.{fontFamily, fontSize, fontWeight, lineHeightPx / lineHeightPercent}`（TEXT 节点） | Figma 字重是数字（400/500/700/900）；`lineHeightPx` 优先，否则用 `lineHeightPercent` |
| 是否可见 | `visible`（缺失时视为 `true`） | `false` 直接跳过 |
| 子树 | `children[]` | 递归结构 |

**颜色转换代码模板**（LLM 可以按此思路手算，也可以让 Bash 跑 python 一次性算完）：

```python
def rgb_to_hex(c):
    r, g, b = round(c['r']*255), round(c['g']*255), round(c['b']*255)
    a = c.get('a', 1)
    if a < 1:
        return f"rgba({r},{g},{b},{a})"
    return f"#{r:02x}{g:02x}{b:02x}"
```

**stroke position 关键区分**：mcp 里叫 `position`（值 `INSIDE`/`OUTSIDE`/`CENTER`），REST 里字段名叫 `strokeAlign`（值一样）。**v0.3 起统一按 REST 字段名 `strokeAlign` 取**。

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
| `end-`（`layers.end`） | 逆向布局（贴父末端） | 让节点在父 autoLayout 里贴向末端：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。**主线机制**：把该 end- 节点前面的兄弟包成一个 wrapper，父 `justify-content: space-between`，天然把 end- 推到末端；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `font-` / `scrollx-` / `scrolly-` / `input-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加；具体规则见 §4.3 "`end-` 逆向布局规则" 子章节 |
| `input-`（`layers.input`） | 输入框（`<input type="text">`） | 生成语义化 `<input type="text">` 标签而非 `<div>`，取子 TEXT 节点 `characters` 作为 `placeholder`，左侧图标（若存在 vector/img 子）切图作为 `background-image` + `padding-left` 腾位置；**独立前缀**（决定生成什么元素，不是修饰），**不可**与 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加（doctor NAM019/NAM020 error），**可**与 `fixed-` / `end-` / `sub-` 叠加；命中即停止向内递归；具体规则见 §4.3 "`input-` 输入框规则" 子章节 |

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
  · 同构判断：{是否存在 ≥ 2 个同名 / 同结构子层} → {是 = 列表项需 .map() 渲染 / 否 = 异构内容逐个生成}
  · 背景层来源：{bgc- 子节点 / bg- 子节点 / 父层 fills / 无} → 不允许"无来源时 fallback 整体导出"
  · 内部 DOM 节点数（不含背景）：{M}（M 必须 ≥ N，否则说明把列表项压平了，回头重写）
  ```
  自检中任意一项无法明确填写时，**先停下问主 agent**，不允许猜测后整体导出。这是质量保证，不是性能优化——错误的整体导出会让"列表渲染"退化为"一张静态图片背景"，运行时无法绑定数据。

**布局规则：每 Frame 独立走判定优先级 + 间距单一来源（v0.3.1 重写）**

**判定优先级**（每个 Frame 节点**独立按顺序判定**，命中一条即用该分支，不再往下走）：

**判定角度说明**：判定分为**子视角**（当前节点在父容器里的定位方式）和**父视角**（当前节点自己内部子代的排布方式）。**子视角先于父视角**——因为 CSS 里 `position` / `top` / `left` 决定该元素相对父的位置，`display: flex` 决定其内部子代的排布，两者互不冲突可共存。

0. **`node.layoutPositioning === 'ABSOLUTE'`**（子视角；v0.3.1 补丁）
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
   > **错误写法（本次 v0.3.1 修订前的典型 bug）**：父 layoutMode 明明是 autoLayout，因看到子层混有 fixed- 兄弟就把父写成 `relative` + 其他子层全部 `absolute + top/left`。这**同时违反**判定优先级第 1 条 和 §6.0 checklist 第 3 项（absolute + padding 冲突）。

2. **前缀是 `fixed-`**
   → `position: fixed`，走本节下方"`fixed-` 定位规则"（`constraints` → `top/right/bottom/left`）

3. **前缀是 `bg-` / `sub-` / `scrollx-` / `scrolly-` / `bgc-` / `x-` / `img-` / `font-` / `btn-`**
   → 按各前缀在 §4.3 的专属规则处理，不走本决策树

4. **`layoutMode` 缺失 / `NONE`，且子节点坐标（`absoluteBoundingBox`）存在重叠**
   → `position: relative` (父) + `position: absolute` + `top` / `left` (子)，坐标按 §4.5 单位换算
   → 典型场景：切图 + DOM 叠加层（如 `img-card` 上叠 `Frame 263` 表单）

5. **`layoutMode` 缺失 / `NONE`，子节点坐标无重叠、顺流排布**
   → 允许两种写法，二选一：
     - **推荐**（简单堆叠、纯文字段落）：父 `padding-*` + 子代 `margin-{top|bottom}`（顺流轴向）+ `:last-child { margin-*: 0 }` 收尾
     - **兜底**（结构较复杂、需要精确对齐）：`display: flex` + `flex-direction` 推断 + `gap`（父负责间距）
   → **禁止**同时用两套（父 `gap` + 子 `margin-*` 混合）

6. **页面根容器（v0.3.3 新增，特殊覆写规则；不打断 1-5 判定，走完后追加覆写）**

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

**`fixed-` 定位规则（v0.2 新增）**

`fixed-` 是**定位修饰前缀**——只改 `position` 属性，不决定渲染方式。可与所有"生成节点"的前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `font-` / `scrollx-` / `scrolly-`），不可与"不生成节点"的前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM014 命中后 error）。

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

**`end-` 逆向布局规则（v0.3.2 新增）**

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `font-` / `scrollx-` / `scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM016 命中后 error）。

**触发前提**（缺一不可，任一缺失走 doctor 兜底）：

1. **父 Frame 必须是 autoLayout**（`layoutMode ∈ {HORIZONTAL, VERTICAL}`）。父不是 autoLayout → doctor LAY019 error，"父不是 autoLayout，end- 无方向可判"
2. **`end-` 节点必须是父的最后一个可见子**。出现在中间或第一个 → doctor LAY017 error，"end- 位置不合规"
3. **同一父下只允许一个 `end-` 子**。多个 → doctor LAY018 warn，"只有最后一个 end- 生效，前面的 end- 会被忽略"
4. **不能同时是 `fixed-`**（`fixed-end-x-btn` 这种叠加）。同现 → doctor LAY020 warn，"fixed- 优先，end- 忽略（fixed 已脱离父流）"

**生成机制**（wrapper + `space-between` 主线，v0.3.2 采用）：

假设父 Frame `layoutMode: VERTICAL`，子层顺序是 `[A, B, C, end-D]`（4 个子，最后一个是 end-）。生成结构：

```jsx
<parent>                                        {/* 父容器 */}
  <wrapper-of-front>                            {/* v0.3.2 新增虚拟 wrapper，包 A/B/C */}
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

**wrapper 的 className / data-node-id 处理**：wrapper 是 v0.3.2 生成的**虚拟节点**（Figma 里不存在），所以：

- className 用父类名 + `__front-group` 后缀（如父类是 `.card-open`，wrapper 是 `.card-open__front-group`）
- **不写** `data-node-id`（因为对应不到任何 Figma 节点，写了会误导反查）
- SCSS 里 wrapper 段紧跟父段书写，视觉上一眼能看出这是 end- 触发的虚拟包裹

**用哪个 CSS 长度容器？**`space-between` 生效需要**父容器有确定的主轴长度**（或 `min-height: 100vh`），否则 wrapper 和 end- 会挤在一起。**若父的 `layoutSizingVertical: HUG`（vertical 场景下）或 `layoutSizingHorizontal: HUG`（horizontal 场景下）**，agent **强制输出 QA 告警**："end- 触发 space-between 布局，但父容器主轴是 HUG（内容撑开），会导致 end- 无法真正贴末端；建议父容器改为 FIXED / FILL，或者根容器加 `min-height: 100vh`"。

**`input-` 输入框规则（v0.3.4 新增）**

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

**类型限定**：v0.3.4 只支持 `<input type="text">`。若设计稿有明显的密码/数字/邮箱语义，agent 可在 QA 告警里提示"建议手工改 `type='password' | 'number' | 'email'`"，不自动推断。textarea / select 场景本版不覆盖，后续按需扩展 `layers.textarea` / `layers.select`。

**doctor 校验**（详见 doctor SKILL §3.6f-i）：

- **NAM017 error**：`input-` 节点子树内**没有可见 TEXT 节点**，placeholder 无来源
- **NAM018 warn**：`input-` 节点子树内**有 ≥2 个可见 TEXT 节点**，只取第一个可见，其他忽略
- **NAM019 error**：`input-` 与 `bg-` / `bgc-` / `x-` 叠加（不生成节点无法挂）
- **NAM020 error**：`input-` 与 `img-` / `btn-` 叠加（语义冲突）

**典型场景**：登录表单（手机号、密码）、订单填写（乘车人姓名、身份证、备注）、搜索框、评论框（v0.3.4 只覆盖单行 input，多行留给后续 textarea 前缀）。

#### 4.4 图片处理

所有图片（`img-` / `bg-` / 无前缀兜底）通过 `figma.mjs export-image` 导出。脚本内置：两步式下载 / `use_absolute_bounds=true` 默认开 / 存在即跳过 / 3 次指数退避 / 回写 `images.json` / 绝对路径写入 `{projectRoot}/{assetsDir}/{filename}.{ext}`。

**⚠️ 调脚本前的强制前置自检（sub-agent 每张图都必须做，且必须把 4 行输出到对话，不允许省略）**：

```
· 图层前缀类型：{img- / bg- / 无前缀}
· 切图源 nodeId：{要写进 --ids 的值}
· 切图源 name：{该 nodeId 对应节点的图层名}
· 交叉验证：切图源 name 是否以「{前缀}」开头？{是/否}
```

**交叉验证判定**：
- 前缀是 `bg-` → 切图源 name **必须**以 `bg-` 开头（如 `bg-piao` / `bg-body`）。**若为「否」，立即停止**，返回 §4.0.5 重新在 `bg-` 命中节点的子树里定位真正的 `bg-` 节点 id。
- 前缀是 `img-` → 切图源 name 必须以 `img-` 开头。
- 无前缀（兜底非文本图层）→ 切图源 name 与当前节点 name 一致。

**这是 `card-bg.png` / `piao.png` 把兄弟节点文字烤进 PNG 这类 bug 的唯一防线**——历史事故根因就是 sub-agent 拿了 `bg-` 的**父容器 nodeId** 传给 API，Figma 会把父容器**整棵子树**（含兄弟节点的文字/图标/其他 block）一起 render 成位图。前置自检就是为了让这一步走不通。**脚本不知道你传的 nodeId 是否合法**，这个判断只能 LLM 自己做。

**调用**：

```bash
# PNG 2 倍图（默认，含透明通道）
node .claude/skills/ctrip-train-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name>

# SVG（矢量图层优先）
node .claude/skills/ctrip-train-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --format=svg

# 极少数场景:需要把 Figma effect 烤进位图(通常不用)
node .claude/skills/ctrip-train-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --preserve-effect
```

stdout 返回 `{"ok":true,"data":{"path":"<绝对路径>","reused":<bool>,"format":"png|svg"}}`。`reused=true` 表示命中缓存跳过下载。

> **`use_absolute_bounds=true` 是默认开的**：
> - 默认导出会包含图层 effect（drop-shadow / outer-stroke / blur）的可见范围与父容器背景色，PNG 会比 bbox 大一圈并带画板底色 → 导致 `gap`/`margin` 算不准 + 图带背景色两个历史 bug。
> - 加此参数后，Figma 严格按节点 `absoluteBoundingBox` 导出，effect 和父背景被裁掉。**代价**：Figma effect 实现的阴影/光晕不会烤进 PNG——但这本来就是要的（应用 CSS `filter: drop-shadow()` 实现）。
> - 若某张图**就是要**把 effect 烤进位图（极少见），加 `--preserve-effect` 覆盖。也可在 config `images.preserveEffectIds` 数组里列出该 nodeId（LLM 端根据 config 决定是否加 flag）。

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ `--format=svg`
- 其他 → 默认 PNG 2 倍图

**前提**：`figma.token` 必须在 config 中配置。**当 token 缺失或过期时（HTTP 403 / 401 / `invalid_token`）**，本 SKILL v0.3 起**不再有 MCP 兜底路径**——直接终止并要求用户补 token 后重跑。原因见下文 §4.4.1。

#### 4.4.1 Token 过期 / 缺失时的处理（v0.3 修订）

v0.3 起本 SKILL 完全不依赖 MCP，图片导出**只有 REST API 一条路径**：

| 情况 | 处理 |
|------|------|
| Token 有效，导出成功 | 正常流程 |
| Token 缺失 / 过期（HTTP 401/403） | **立即终止**，输出下方错误提示，由用户补 token 后重跑 |
| `/v1/images` 返回 `err` 字段或临时 URL 404 | 3 次指数退避重试（1s/2s/4s），三次都失败 → 终止并输出错误 |

**错误提示文案**：

```
❌ 图片导出失败：Figma Token 无效或过期

请检查 `ctrip-train-d2c.config.json` 里的 `figma.token`：
1. Token 是否已过期或被撤销
2. Token 权限是否包含 File content: Read-only
3. Token 对应的账号是否有该 fileKey 的访问权限

修正后重新运行本 SKILL（缓存会因 lastModified 校验自动决定是否复用）。
```

**为什么删除 MCP `download_assets` 兜底**（v0.3 起）：

- MCP `download_assets` 不支持 `use_absolute_bounds=true` 参数，导出的图会带图层 effect 外扩 + 父背景色 → 直接导致 `card-bg.png` 类历史 bug 重现
- 保留兜底会让 agent 在 token 失败时"悄悄降级"，用户看不到严重的视觉退步
- v0.3 全流程走 REST，兜底路径与主路径**能力不对等**，与其藏 bug 不如显式失败

**禁止**：
- 禁止在 token 过期时直接跳过下载或用临时链接占位（Figma `/v1/images` 返回的 S3 临时 URL 约 30 分钟过期，代码上线就 404）
- 禁止把 Figma `/v1/images` 返回的 S3 临时 URL 写进代码 `<img src>`（同上，只能作为下载源，下载完立刻丢弃）
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具（v0.3 起本 SKILL 不再依赖 MCP）

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

- sub-agent 在 §4.8 做的是**自我验收**——同一上下文里写完代码再看截图，视觉差异极易"看不到自己的盲点"（self-blind）。这是大模型生成代码的已知 bias，不是某个 sub-agent 的能力问题
- flat 模式合并后子组件结构被打散在同一文件里，**整体大图扫一眼很难定位到具体某个 block 的局部偏差**（尺寸 1px / 颜色 #abc vs #abd / 字号差 1pt）
- component 模式虽然 block 还在独立目录，但主 agent §6 整体验收时，目标节点 nodeId 是页面根，得到的截图分辨率被压缩到容纳整页，**单个 block 内部细节在大图里像素不够看**
- `switchAgentVerification=true` 的本意就是 sub 写、主验，本节落地这条配置在 D2C 主流程里的意义
- **嵌套 sub- 场景**：父 block 含若干内层 sub-，父 block 的视觉效果 = 内层叶子 sub- 的拼接 + 父 block 自己的非 sub 内容。逐叶子对比 + §6.1 整体验收 已能覆盖；额外对比父 block 是冗余

**步骤**：

对 `.d2c-tasks.md` 中**每个叶子 sub-block**（无内层 sub- 的 block），主 agent 依次执行：

1. 调脚本获取该 block 原始设计稿截图：

   ```bash
   node .claude/skills/ctrip-train-d2c/bin/figma.mjs screenshot <fileKey> <leafBlockNodeId> --tag=leaf --scale=2
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

**双重间距 / 布局违反检测 checklist（v0.3.1 新增，主 agent 逐叶子对比时必查）**：

对每个叶子 block 产出的 `.tsx` / `.scss` 文件（或对应片段），**逐项静态扫描**：

1. **flex + margin 混用**：是否存在父级同时出现 `display: flex` 且直接子代出现 `margin-{top|right|bottom|left}`？（`margin: auto` / 居中用途除外）
2. **padding + first/last-child margin 冲突**：是否存在父级 `padding-{side}` 且子代规则 `:first-child { margin-{same-side} }` 或 `:last-child { margin-{same-side} }`？
3. **absolute + margin 冲突**：是否存在元素同时具有 `position: absolute` 或 `position: fixed` 且 `margin-*`？（`margin: auto` 用于居中除外）
4. **autoLayout 违反 flex 强制**：对照 Figma 原始 JSON，是否存在 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 的 Frame，输出的 CSS 却用了 `position: absolute` + `top/left`？（此项是 §4.3 判定优先级第 1 条的硬红线）
5. **space-between 表达不忠实**：是否存在 Figma `primaryAxisAlignItems === 'SPACE_BETWEEN'`，输出的 CSS 却用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟？
6. **`layoutPositioning` 未落地**：是否存在 Figma `layoutPositioning === 'ABSOLUTE'` 的子节点，输出的 CSS 却没写 `position: absolute` + `top` / `left`（结果被塞进父 flex 顺流，视觉错位）？或反之：`layoutPositioning === 'AUTO'` / 缺失的子节点被误加 `position: absolute`？
7. **子节点 `FILL` / `STRETCH` 未落地**：是否存在 Figma 子节点 `layoutSizingHorizontal === 'FILL'` 或 `layoutAlign === 'STRETCH'`，输出的 CSS 却没写 `width: 100%` / `align-self: stretch`？典型表现：子内容明明该撑满父可用宽（Figma 里子和父同宽或仅差 padding），实际渲染却按内容宽度收缩，父上还常常错配 `align-items: center` 挡着——**父视角必须**用 `align-items: stretch` 或**删除** `align-items` 行让 flex column 走默认（stretch），子视角**加 `width: 100%`**（一并加 `box-sizing: border-box` 让 padding 不撑破容器）。反向也查：`FIXED` / `INHERIT` 的子被误加 `width: 100%` 也算错。
8. **`end-` 前缀未生成 wrapper + `space-between` 结构**：图层名带 `end-` 的节点（不含 `bg-` / `bgc-` / `x-` 叠加，且不含 `fixed-` 叠加），产物 JSX 里其父容器是否有虚拟 wrapper 包裹前面兄弟、父 CSS 是否设置 `justify-content: space-between`？若父 layoutMode = `VERTICAL` 但产物用 `absolute + bottom: 0` / `margin-top: auto` 等其他手段模拟，也算不合规（本方案唯一实现路径是 wrapper + space-between，见 §4.3）。反向查：`end-` 节点是否是父的最后一个子（不是则不合规）、父是否 autoLayout（不是则不合规）。
9. **页面根容器用死值 `height` 未覆写为 `min-height: max(..., 100vh)`（v0.3.3 新增）**：入口节点满足"页面根容器"三信号（是入口 nodeId + 父是 Page/Document + 高度接近视口）时，产物根 CSS 是否用了 `height: {figmaH * scale}px` 死值 或 `min-height: {figmaH * scale}px` 死值？必须改成 `min-height: max({figmaH * scale}px, 100vh)`（见 §4.3 判定优先级第 6 条）。同时检查根内部的 `layoutPositioning: ABSOLUTE` 背景层（`bg-`）：`height` 是否死值？应改成 `height: 100%`（或 `inset: 0`），`background-size` 从 `{w}px {h}px` 改成 `cover`。反向查：**信号不全时**（例如 sub-agent 派发进来的 block、URL 指向的是非根子节点、高度不接近视口）不应触发本条覆写，若被误覆写为 `100vh` 也算不合规。
10. **`input-` 前缀未生成 `<input>` 标签（v0.3.4 新增）**：图层名带 `input-` 的节点（不含 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加），产物 JSX 是否输出 `<input type="text" placeholder="..." />`？是否漏输出 `<div>` + `<span>` 结构而绕过 `input-` 语义？CSS 是否把左侧图标切图挂在 `background-image`（不生成独立 `<img>` 子节点）？`::placeholder` 颜色是否取自 TEXT 子节点的 `fills[0]`？反向查：图层里没有 `input-` 前缀却被误改成 `<input>` 标签也不合规。同时校验 doctor 侧 4 条 NAM 规则是否触发（NAM017 无 TEXT / NAM018 多 TEXT / NAM019 与 bg 系叠加 / NAM020 与 img/btn 叠加）。

**任一项命中 → 该叶子 sub-agent 交付不合格，主 agent 必须回退该块重写**（不是自己改 scss 数值糊过去；这是结构性问题，改数值没用）。回退命令：把该叶子 nodeId 重新按 §4.0 派发一次 sub-agent，把本节 checklist 内容作为额外约束附加进去。

**常见触发原因与修复方向**（v0.3.1 补充；主 agent 回退时把对应"修复方向"一起塞给 sub-agent）：

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

---

### 步骤 7：输出交付物清单

```
✅ 生成文件：{output.dir}/ComponentName/
📦 需下载图片：（汇总 assets.txt，含原始临时链接）
⚠️  需手动处理：（QA 发现的不可自动修正差异）
🧹 上线前清理：产物已注入 `data-node-id="..."` 调试锚点（用于反查 Figma 节点、方便 review 逐 block 对比），
   上线前请运行 `ctrip-train-d2c-strip-nodeid` skill 一键清理，或直接执行：
     node .claude/skills/ctrip-train-d2c-strip-nodeid/strip-node-id.mjs --dry-run   # 先预览
     node .claude/skills/ctrip-train-d2c-strip-nodeid/strip-node-id.mjs             # 确认后清理
🗑️  临时截图目录：{projectRoot}/.d2c-tmp/screenshots/ 已自动清理（QA 阶段的对比截图，跨会话不保留）
💾 缓存目录：{projectRoot}/.d2c-cache/{fileKey}/ 保留（下次跑同一 fileKey 会自动比对 lastModified 决定复用或作废）
```

**SKILL 结束时的清理动作**：

1. `node .claude/skills/ctrip-train-d2c/bin/figma.mjs cleanup-tmp`（脚本会 `rm -rf` 掉 `{projectRoot}/.d2c-tmp/screenshots/`）
2. 不清 `.d2c-cache/`——那是持久化缓存，等 `lastModified` 变化时才失效

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
- 禁止用相对路径下载图片：`curl -o` 落地路径必须是 `{projectRoot}/{assetsDir}/{filename}.{ext}` 绝对路径（`projectRoot` = 步骤 0 缓存的 config 文件所在目录绝对路径）。禁止写 `-o {assetsDir}/{filename}.png` 或 `-o ./static/xxx.png` 等相对形式——sub-agent 的 cwd 未必是项目根，相对路径会把图片落到代码产出目录下的错误相对位置，导致 URL 拼接后 404
- 禁止跳过步骤 2.5 页面级背景采集；禁止把顶层 frame 的页面级背景写到组件根容器；禁止改动项目已有的全局样式文件（base.scss / global.css / app.less 等）；禁止凭印象判定项目特征（必须 Read/Grep 实证后选 P-A / P-B / M-A / M-B / J 策略）；禁止多页面项目使用 P-B / M-B（单页策略，会互相污染）；**禁止在普通 stylesheet（非 module 的 scss/less/css）里写 `:global(...)`、禁止在 `*.module.{scss,less,css}` 里直接写 `body { ... }`（写错则 body 背景百分百不生效）**
- 禁止"sub- 只有 1 个就退化为主 agent 处理"；任何 `sub-` 节点都必须分发独立 sub-agent，**单 sub 也必须拆**（分块是质量保证而非性能优化）
- 禁止 `scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存（语义冲突）；禁止同一节点同时含 `scrollx-` 和 `scrolly-`（一个元素只能一个滚动方向）；禁止省略隐藏滚动条样式（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）
- 禁止把 `sub-scrollx-` / `sub-scrolly-` 节点**整体导出为单张背景图**作为容器 `background-image`：scroll 容器必须**继续递归子层**（§416-417），子层是同构列表项；只有标了 `bgc-` / `bg-` 的子节点才作为背景。即便子层结构复杂、识别困难，也不允许"省事 fallback 到整体导出"——需要时把识别失败的子树标 `x-` 或拆分稿子，不能用整体导出绕过。
- 禁止调用 Figma `/v1/images` 时省略 `use_absolute_bounds=true`：不带此参数会把图层 effect（drop-shadow / outer-stroke / blur）和父背景色一起 render 进 PNG，导致"图都带画板背景色"+"对齐用的 gap / margin 算不准（视觉外扩）"两个 bug 同时发生。仅当某张图明确要把 effect 烤进位图（在 config `images.preserveEffectIds` 列出 nodeId）时才省略。
- 禁止 `figma.token` 无效时直接跳过图片下载或用 Figma S3 临时链接占位（约 30 分钟过期，代码上线就 404）；v0.3 起 token 失败即终止，由用户补 token 后重跑，不再有 MCP 兜底路径
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具（v0.3 起本 SKILL 全流程走 Figma REST API，不再依赖 MCP）；禁止把 MCP `get_design_context` 返回的"参考代码"字段作为渲染依据——项目前缀规则（§4.0 / §4.3）的优先级永远高于任何"AI 生成的通用 D2C 参考代码"
- 禁止跳过步骤 0.3 缓存初始化；禁止绕过 `.d2c-cache/{fileKey}/meta.json` 的 `lastModified` 校验直接读旧缓存（设计稿改过必须整份作废重拉）；禁止 sub-agent 独立校验 `lastModified`（主 agent 校验一次即可）；禁止把 QA 临时截图写进 `.d2c-cache/`（该目录只放跨会话可复用的数据，QA 截图属于 `.d2c-tmp/screenshots/`）
- 禁止 SKILL 结束时不清理 `.d2c-tmp/screenshots/`（跨会话不保留 QA 对比截图，避免污染仓库和 `git status`）
- 禁止把 `bg-` 节点的**父容器**当成切图源传给 `/v1/images` API：切图源 nodeId 必须是 `bg-` 节点自己。把父容器整体切下会导致 `bgc-` 颜色、其他兄弟节点（block-/img-/font-/文本）融合到一张 PNG，违反"`bgc-` 写 CSS 颜色、`bg-` 写 CSS 背景图、内容层独立处理"的分离原则
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
