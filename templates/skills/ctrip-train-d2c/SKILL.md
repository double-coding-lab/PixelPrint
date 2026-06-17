# ctrip-train-d2c Skill

## 触发条件
- 用户提供 Figma 设计稿 URL
- 用户说「帮我还原这个设计稿」「D2C」「生成代码」

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
| `layers.ignore` | 忽略前缀，默认 `x-` |
| `output.dir` | 代码输出根目录 |
| `health.enabled` | 是否启用前置体检（默认 true） |
| `health.blockOnError` | 体检 grade=F 时是否阻塞生成（默认 true） |

---

### 步骤 0.5：调用设计稿体检（health 启用时）

`health.enabled === true` 时，**在解析 URL 前**先调用 `ctrip-train-d2c-doctor` 做体检。

```
doctor.run({
  fileKey, nodeId,        // 同主流程
  config,                 // 步骤 0 的完整配置
  mode: 'integrated'      // 集成模式，不写文件，return JSON
})
```

**根据返回的 `{ passed, score, issues, summary }` 决策**：

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

## Sub-agent Blocks
- [ ] Block 1: sub-main (nodeId: 25:3222) → agentIndex=1
- [ ] Block 2: sub-img-QA (nodeId: 25:4263) → agentIndex=2
- [ ] Block 3: sub-通勤便捷 (nodeId: 25:4314) → agentIndex=3

## 主 agent 直接处理节点
- [ ] img-分享 (nodeId: 25:4416) → <img>
- [ ] img-footer (nodeId: 25:4449) → <img>

## 合并验收
- [ ] 所有 sub-agent 完成
- [ ] 背景节点已写入根容器
- [ ] 直接处理节点已写入主文件
- [ ] 视觉 QA 完成
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

执行写入前**必须先探测项目类型**，决定写入策略。按以下顺序检查（**逐项 Read 文件，不要凭印象判定**）：

1. **检查 `output.dir` 同级（或父级 1-2 层内）**有几个 page 入口：
   - 看是否有 `pages/` 目录 + 多个 `*.jsx` / `*.tsx`（Next.js / nfes 多页面）
   - 看是否有 react-router / SPA 入口（单 entry 多 route）
   - 看是否只有一个入口（单页活动）
2. **检查全局样式入口**：
   - `pages/style/base.scss`、`src/styles/global.scss`、`app.scss`、`_app.js` 引入的全局 css
   - 是否已有 `body { background: ... }` 规则（用 grep 实证，**禁止猜**）
3. **检查样式方案**：根据 config 的 `project.styleFormat`（scss / css-modules / tailwind / inline / styled-components 等）确定是否能写全局选择器

把探测结果写入 `.d2c-tasks.md` 的"页面级背景"段，作为后续步骤的事实依据。

#### 2.5.3 写入策略（按探测结果自动选档）

| 项目特征 | 策略 | 实现 |
|---|---|---|
| **A. 多页面 / 多稿共存**（pages/ 下 ≥ 2 个 page，或 SPA 多 route，或预期会加更多稿） | **scope 隔离 class** | 见下方「策略 A」 |
| **B. 单页活动 + 已有全局 body 规则**（output.dir 下只有 1 个 page，全局 base.scss 已有 body 背景） | **页面 scss 顶部局部覆盖** | 见下方「策略 B」 |
| **C. 单页活动 + 无全局 body 规则** | **直接写页面 scss 的 `body` 选择器** | 见下方「策略 C」 |
| **D. CSS Modules / styled-components 严格隔离方案** | **useEffect 操作 inline style** | 见下方「策略 D」 |

**`bgImage` 时**：无论哪一档，URL 都使用 `$asset-prefix` / `ASSET_PREFIX`（见步骤 4.3 的图片 URL 规则），**不允许在 body 样式中硬编码完整 URL**。

##### 策略 A：scope class（多页面默认推荐）

**`.scss`**：
```scss
// 页面级背景：本页面挂载时通过 .<page-class>-page-bg 类应用到 body
:global(body.<page-class>-page-bg) {
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

`<page-class>` = 当前组件根 className（如 `fan-ticket-unlocked`），保证全项目唯一。**离开页面会自动还原**，多张稿共存不会互相污染。

##### 策略 B：页面 scss 顶部局部覆盖

```scss
// 页面级背景：覆盖项目全局 body 兜底色
body {
  background: <值>;
}
```

写在页面根 scss 文件顶部。**禁止改全局 base.scss / global.css**。

##### 策略 C：直接写 body 选择器

同策略 B 写法，但因为没有全局兜底冲突，是最干净的形态。

##### 策略 D：useEffect inline style

```tsx
useEffect(() => {
  const prev = document.body.style.background;
  document.body.style.background = '<值>';
  return () => { document.body.style.background = prev; };
}, []);
```

不写 css，直接操作 DOM。仅在样式方案不允许全局选择器时使用。

#### 2.5.4 SSR 首屏闪白处理（可选）

若项目是 SSR（Next.js / nfes 的服务端渲染），策略 A / D 在客户端 hydrate 后才生效，可能出现首屏从全局兜底色 → 稿色的一帧闪烁。

如需消除：在该页面对应的 `getInitialProps` / `getServerSideProps` 返回的 props 里加 body class 字段，或在 `_document` 的 body 元素上根据路由 pathname 加 class。**默认不做这项优化**，除非用户明确说"避免首屏闪烁"。

#### 2.5.5 写入清单（必须勾完才进步骤 5）

`.d2c-tasks.md` 的"页面级背景"段：

```markdown
## 页面级背景（写入 body）
- [ ] 已采集顶层 frame 背景：类型 = <bgColor/bgGradient/bgImage/none>，值 = <值或 "none">
- [ ] 已探测项目特征：多/单页 = <多/单>，全局 body 规则 = <存在/不存在>，样式方案 = <scss/...>
- [ ] 已选定策略：<A / B / C / D>
- [ ] 已按策略写入对应文件（路径：<file>）
- [ ] 未改动任何项目全局样式文件
```

#### 2.5.6 禁止项

- 禁止把页面级背景设到组件根容器（如 `.fan-ticket-unlocked`）
- 禁止跳过本步骤；即使顶层 frame 是 `none`，也必须在清单里**显式记录** `none`，不允许沉默
- 禁止改动项目已有的全局样式文件（`base.scss` / `global.css` / `_app` 引入的全局 css）
- 禁止凭印象判定项目特征（必须 Read / Grep 文件实证后再选档）
- 禁止在 body 背景里硬编码完整图片 URL（`bgImage` 时必须用 `$asset-prefix` / `ASSET_PREFIX`）
- 禁止多页面项目使用策略 B / C（会互相污染）

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
| 无上述前缀 | 正常进入 4.1 解析子层 |

**示例**：`sub-img-QA` → 去掉 `sub-` 后剩 `img-QA` → 命中 `img-` → 整体导出为 `qa.png`，生成 `<img src=".../qa.png" />`，不解析内部任何子图层。

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
6. 提取 `font-` → 生成文字节点
7. 无内容前缀 → 走兜底规则
8. 若有 `btn-`，将渲染结果包裹在可点击容器内

**`bg-` 的额外规则**

- 一个父元素下只应有**一个** `bg-` 子图层，多个时取第一个，其余忽略
- `bg-` 图层的**高度不代表父元素高度**，父元素高度由其他内容决定
- `bg-` 与 `bgc-` 可同时存在，`bgc-` 作为背景色兜底，`bg-` 作为背景图覆盖

**布局规则：禁止使用绝对定位**

- 生成的元素**默认使用 flex 布局**，不使用 `position: absolute`
- Figma 中通过 Auto Layout 表达的间距，用 `gap` / `padding` 还原
- Figma 中无 Auto Layout 的 Frame，推断其内容排列方向（横向/纵向），用 `flex-direction` 还原
- 只有**明确的浮层/弹窗/角标**（设计上确实需要脱离文档流的元素）才允许使用 `position: absolute`

> `layers.sub`（`sub-`）前缀仅用于步骤 2 的分块判断，sub-agent 拿到的 nodeId 已是该节点本身，内部按上述规则正常解析。

#### 4.3 图片处理

所有图片（`img-` / `bg-` / 无前缀兜底）通过 **Figma REST API** 导出，保留透明通道：

```bash
# PNG 2倍图，保留透明
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2" \
  -o {assetsDir}/{filename}.png

# SVG（矢量图层优先）
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=svg" \
  -o {assetsDir}/{filename}.svg
```

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ **SVG**
- 其他 → **PNG 2倍图**

**前提**：`figma.token` 必须在 config 中配置，否则跳过下载，仅用 MCP 临时链接占位并在 QA 中标注。

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
- 所有 Sub-agent Blocks
- 所有主 agent 直接处理节点
- 背景节点

有任何 `[ ]` 未完成，必须先补齐再合并，不得跳过。

等待所有 sub-agent 完成后，按 `merge.mode` 合并。

#### component 模式（默认）

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 主文件，import 各 block 子组件
│   └── index.scss       ← @import 各 block 样式
└── blocks/              ← 保留，不删除
    ├── block1/
    └── block2/
```

主文件示例：
```tsx
import Block1 from './blocks/block1'
import Block2 from './blocks/block2'

export default function ComponentName() {
  return (
    <div className="component-name">
      <Block1 />
      <Block2 />
    </div>
  )
}
```

#### flat 模式

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 所有 block JSX 平铺合并
│   └── index.scss       ← 所有 block 样式合并
└── blocks/              ← 保留，不删除
```

合并规则：
- JSX 按 block 顺序合并，每段加注释 `{/* --- block1 --- */}`
- 样式按顺序追加，类名保持各自命名空间
- 类名冲突时自动加 block 名前缀解决

---

### 步骤 6：主 agent 合并验收

所有 sub-agent 独立验收通过后，主 agent 对合并结果做整体视觉验收：

1. 调用 `get_screenshot(fileKey, nodeId)` 获取原始设计稿整体截图
2. 与合并后的完整组件做视觉差异分析
3. 汇总各 block QA 段落中未解决的差异
4. 可自动修正的整体差异（对齐偏差、间距）直接修正
5. 不可自动修正的差异输出到交付清单

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
- 禁止跳过步骤 2.5 页面级背景采集；禁止把顶层 frame 的页面级背景写到组件根容器；禁止改动项目已有的全局样式文件（base.scss / global.css）；禁止凭印象判定项目特征（必须 Read/Grep 实证后选 A/B/C/D 策略）；禁止多页面项目使用 B/C 策略（会互相污染）
