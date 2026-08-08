# pp-d2c Skill

> **v0.3.16（2026-08-08，h5 独享）**：修复 §4.4.pre.b 子树结构禁切规则被 sub-agent 绕过的事故——某 h5 稿在某容器下含 N≥3 张同构卡片（每张含 ≥4 TEXT + btn + `img-tag-<X>` 子层）+ M 张附加同构卡全被整体切图（`<container>-<item>-1..N.png` / `<container2>-*.png`），文字/按钮/金额/状态全烤入位图，无法多语言、无法数据绑定、无法接埋点。三处根因：(1) v0.3.9 里 `img-`/`bg-` 前缀有"设计师显式指定"豁免路径,sub-agent 借此绕过禁切；(2) 命中同构禁切（≥3）时,skill 只说"应逐层递归"但没规定必须 `.map()` 数据驱动,sub-agent 图省事整切；(3) sub-agent QA 段声明 `x/y/z` 结构信号但主 agent 未强制重算断言,sub-agent 可写 `x=0 y=0 z=0` 蒙混。改动：(1) §4.4.pre.b 删除 `img-`/`bg-` 豁免例外,前缀不再豁免结构禁切；(2) 新增「同构列表必须 `.map()` 数据驱动」段 + 具体示例（数据数组 + 模板 JSX + `.d2c-tasks.md` QA 追加行）；(3) §6.0.2 合并核查追加主 agent 独立 grep 重算 `x/y/z` 与 sub-agent 声明对齐的断言脚本。**本次改动只在 pp-d2c 生效**,不同步到 pp-d2c-rn / pp-doctor。

> **v0.3.15（2026-08-08，h5 独享）**：修复 `bg-*` / 裸词 `bg` 节点落地形式漂移事故——同一份产物里 agent 用了三种不一致方式：(1) `<div class="bg" />` 空 div + scss `background-image`（接近对，但空 div 多余）；(2) `<div style="background-image:url(...)">` inline style（错）；(3) `<img src="bg.png">`（更错，`<img>` 是 `img-*` 独占）。根因是 v0.3.11「JSX `<img>` / CSS `background-image` 引用」的 "/" 让 agent 二选一。改动：(1) 重写 v0.3.11 三处歧义句为明确单选；(2) §4.0 主表 L640 补一句「bg 节点自身不生成任何 DOM」；(3) §4.3 新增「`bg-*` 唯一合法落地形式」——bg 节点被"吸收"进父容器，切图挂父 `background-image`（独立 `.scss`），禁止 `<img>` / 空 div / inline style 三种错法；配 grep 自证。**本次改动只在 pp-d2c 生效**，不同步到 pp-d2c-rn（RN 侧 `<Image>` 无 CSS background 概念，本身无歧义）/ pp-doctor（doctor 暂不加新规则）。

> **v0.3.14（2026-08-08，h5 独享）**：修复 P/M 大类混合事故——某 h5 项目 config 明确 `"styleFormat":"scss"`（P 大类），主入口 `pages/index.jsx` 却生成 `import styles from "./styles.module.scss"` + 全篇 `className={styles.container}`（M 大类），同时 `pages/blocks/main/index.scss` 又是普通 `.scss`（P 大类），两半矛盾导致 css-modules 哈希化的类名跟 blocks 里的普通 scss 完全不通气，页面视觉全部丢样式。改动：§2.5.2 结尾追加「大类一致性硬约束」——主 agent 判定后必须在 `.d2c-tasks.md` 顶部写「大类锁定」段，sub-agent 生成 block 前必须 Read 锁定值严格遵守，禁止各 sub-agent 独立再判；配 grep 自证脚本（P 大类禁 `.module.*` / `styles.xxx` / `import styles from`；M 大类禁裸 `.scss` / 裸 `className="xxx"`）。**本次改动只在 pp-d2c 生效**，不同步到 pp-d2c-rn（RN 侧固定 stylesheet 无 P/M 分歧）。

> **v0.3.11（2026-08-08）**：新增「bg- 独立切图契约」（§4.3）——每个 `bg-*` 前缀节点必须独立走一次 export-image，**禁止**用祖先 `bg-*` 切图的物理覆盖范围"合并省略"后代 `bg-*` 独立切图；配套 sub-agent QA 段自证格式 + 主 agent grep 断言 + §6.0.2 忠实度证明块 7 组扩到 8 组 + doctor BGP033 error 规则。修复历史事故：sub-agent 看到父 `bg-<A>` 内 SLICE 覆盖了后代 `bg-<B>` 所在物理区域，就"合理省略"了后代的独立切图，产物对应容器空 View、后代装饰完全丢失。

> **v0.3.10（2026-08-08）**：新增 3 组强制溯源证明块（字色 fills 溯源 §4.1.1 / sub 容器 min-height 尺寸源 §4.3 / 页面根 padding-top 尺寸源 §4.3.1）；§2.5.2 判定链补权威兜底（新 page 无既有 import 参考 → `config.styleFormat` 为权威，不允许脑补大类）；§6.0.2 合并忠实度证明块 3 组扩到 6 组；禁止项 +3；配套 doctor CLR030 / DIM031 / DIM032。修复 <下游项目> 新稿事故：Frame745「立即抢」字色写 #ffffff（应末位 #864500）、`.baseBackground padding-top:236px`（应 paddingTop=166×2=332px）、`.main min-height:1125px`（应 sub-MAIN 自身 520×2=1040px）、生成 `.module.scss` + `styles.xxx`（应按 config plain scss 走 P-B）。

> **v0.3.9（2026-08-07）**：新增 §4.4.pre.b「子树结构禁切规则」——对子树含 ≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点的容器**永远禁止**整体切图（结构维度优先于前缀维度）；§4.4 前置自检 5 行 → 7 行（追加子树扫描）；§4.8 checklist + §6.0.2 忠实度证明块 + 禁止项 各追加 1 条；配套 doctor SUB029。修复 v0.3.7/v0.3.8 遗留漏洞：sub-agent 借"无前缀非文本图层兜底"绕过 §4.4.pre 主表，把 Frame 734（含 3 行任务）烤成 task-block.png 大图。

> **v0.3.8（2026-08-07）**：新增「问题边界」章节（顶部执行模型说明内）——明确 agent 只能问业务问题，禁止问 skill 已定死的技术决策问题（切图/兜底/合并/尺寸/命名冲突等）；遇 skill 未覆盖的边界情形须按最接近规则兜底 + 写 QA 告警，禁止打断用户；配套 §4.8 checklist +1 条 + §6.0.2 忠实度证明块 +「未打断用户核查」段 + 禁止项 +1 条。

> **v0.3.7（2026-08-07）**：新增「flat 合并忠实度契约」（§5.0.pre）、「data-node-id 守恒律」（§5.1）、「节点整体切图适格性」（§4.4.pre）、「assets.txt 消费契约」（§6.0.1）、「合并忠实度证明块」（§6.0.2 强制主 agent 交付前 grep 自证输出）；配套 doctor SUB027 / IMG028。修复历史事故：主 agent flat 合并擅自替换 sub-agent 产物、用父容器整体切图（sub-ui-frame734.png 等）覆盖拆分产物。

> **v0.3.6（2026-08-07）**：新增「父容器盒级装饰兜底」（§4.3）、「TEXT 多层 fills 取末位」（§4.1.1）、「切图强制忠实执行 + images.json md5 复用」（§4.4.0）、「`btn-` 内嵌 TEXT 双写防护」（§4.3）；配套 doctor NAM024 / NAM025 / IMG026。

## 触发条件
- 用户提供 Figma 设计稿 URL
- 用户说「帮我还原这个设计稿」「D2C」「生成代码」

---

## 执行模型说明（先于一切，避免误读）

**SKILL.md 是给 LLM 读的自然语言操作手册，不是可执行代码。**

下文出现的 `doctor.run({...})`、`return X`、`派发新 sub-agent`、`sub-agent 上报` 等表述都是**伪代码 / 隐喻**，不是真函数调用、不是真多进程通信。**全程只有当前这一个 LLM agent**（即此对话里的 Claude）按 SKILL 步骤顺序执行：

| 文档表述 | 实际操作 |
|---------|---------|
| "调用 doctor SKILL" / `doctor.run({...})` | 当前 agent `Read .claude/skills/pp-doctor/SKILL.md` 并按其步骤执行 |
| "doctor 集成模式 return JSON" | 当前 agent 在对话里输出 §5.4 描述的 JSON 字符串，下一段步骤自己读 |
| "派发新 sub-agent 处理 sub-X" | 当前 agent 重新进入 §4.0 流程，把根节点重置为 sub-X 的 nodeId、depth +1，重走一遍 |
| "sub-agent 上报 subslots.json" | 当前 agent 把 JSON 内容写到磁盘文件，下一轮处理时自己读 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**，要字面写进 JSX 文件作占位符 |
| `subslots.json` 文件 | **真实磁盘文件**，与 `assets.txt` 同级写入 block 目录 |

**唯一真正"被执行"的事情有两类**：（1）调用 Figma REST API（通过 Bash 执行 curl）读取节点属性 / 导出图片 / 截图，以及本地文件读写；（2）在对话里产出文本（包括代码、JSON、报告、决策）。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

> **v0.3 起本 SKILL 完全走 Figma REST API，不再依赖任何 `mcp__plugin_figma_figma__*` 工具**。这样做的理由：MCP 工具会附带"AI 生成的参考代码"字段，容易让 agent 信参考代码结构 > 信项目前缀规则（历史事故：`bg-` 节点被 MCP 参考代码展开成 `display: contents` 子结构，agent 跟着递归 DOM 化）。REST API 只返回原始节点 JSON，前缀规则永远优先。

> 误把伪代码当真函数会卡死流程（等待一个永远不会到来的"返回值"），或者绕过关键步骤（"既然 SKILL 里说 doctor.run() 就行，那直接跳到 §1"）。

## 问题边界（v0.3.8 新增，硬约束）

agent 在跑 pp-d2c 全流程时 **只允许问用户业务问题，禁止问 skill 已定死的技术决策问题**。历史事故：跑 <下游项目> 时 agent 就"要不要整体切图 / 用不用 CSS 表达 / 合并这块用什么方式"等 skill 已明确规定的技术选择反复打断用户，属于 agent 遇复杂就问用户的偷懒路径。

### ✅ 允许问的业务问题（设计稿无法推断的产品/交互/数据）

| 类型 | 举例 |
|-----|------|
| **交互状态** | "登录/未登录态展示不一样，默认展示哪个？"、"已购/未购下卡片状态怎么切换？" |
| **数据来源** | "这个价格从哪个字段取？"、"埋点参数取什么？"、"分享文案是什么？" |
| **跳转链接** | "按钮点击跳哪里？"、"活动结束后按钮跳哪？" |
| **时效规则** | "活动时间外怎么展示？"、"券过期展示什么？"、"倒计时结束态是什么？" |
| **命名域** | "组件放哪个 page 目录？"、"用哪个 style 变量前缀？" |

判定要点：**skill 无法从 Figma 设计稿本身推断出答案**（必须问业务方 / PRD / 用户），才允许问。

### ❌ 禁止问的技术决策（skill 已在章节里定死）

| 类型 | 举例（对应 skill 章节） |
|-----|---------------------|
| **前缀语义** | "`btn-` 要不要切图？" → §4.3 组合优先级 + §4.4.pre 适格性表已定；"`bg-` 切自身还是父容器？" → §4.3 `bg-` 切图源约束已定 |
| **兜底判定** | "这个纯色父容器要 CSS 还是切图？" → §4.3 父容器盒级装饰兜底默认开；"多层 fills 取哪个？" → §4.1.1 TEXT 多层 fills 处理已定取末位 |
| **合并策略** | "这块要整体切一张图吗？" → §4.4.pre 禁 `sub-*` / `block-*` 整体切图；"flat 合并展开还是简化？" → §5.0.pre 禁"简化" sub-agent 产物 |
| **尺寸单位** | "这个 500px 要不要换算？" → §4.5 单位换算 + `unit.scale` 已定 |
| **命名冲突** | "类名重了怎么办？" → §5 flat 模式已定"加 block 前缀" |
| **切图忠实度** | "同名文件已存在，要复用还是重切？" → §4.4.0 md5 校验复用契约已定 |

判定要点：**skill 章节里已经写明"怎么做"** → agent 必须按规则做，不允许问。

### 遇到 skill 未覆盖的边界情形怎么办（**不打断用户**）

按下面顺序**自主处理**：

1. **先按 skill 最接近的规则兜底**——例如遇到未见过的前缀 → 走"无前缀兜底"（TEXT → 文字节点 / 其他 → `<img>`）
2. **把决策 + 兜底理由 + 影响范围写入 `assets.txt` QA 段落**：
   ```
   [需人工核对] 遇到 skill 未覆盖的情形 X（图层名 {name} nodeId {id}），
     已按 Y 兜底处理（引用 skill §Z），
     可能影响 Z（例：视觉差 / 交互失效 / 无障碍缺失），
     请复核后决定是否补前缀或调整设计稿。
   ```
3. **仅当**决策会导致**产物完全不可用**时才停下问用户——严格限定：
   - Figma Token 缺失 / 过期（无法调 REST API）
   - Figma 稿完全无法访问（HTTP 404 / 403）
   - 关键 assets 下载失败超过重试次数
   - config 缺失或语法错误（skill 无法读到必要字段）

**其他任何"技术选择犹豫"都不允许打断用户**——不确定就按最接近规则兜底 + 写 QA 告警。

## 执行流程

### 步骤 -1（前置预检）：检测 Figma Token 可用性

在任何操作前执行，不可跳过。

**做法**：调用脚本探针（脚本会自动 Read config、发 `/v1/me`、按状态码判定）：

```bash
node .claude/skills/pp-d2c/bin/figma.mjs verify-token
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

> **v0.3 变更**：本 SKILL 已完全移除 MCP 依赖，所有 Figma 数据读取都走 `figma.mjs` 脚本（内部调 REST API）。不再需要在 Claude Code 里装 Figma 插件或走 OAuth。

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
| `unit.outputUnit` | 输出单位，`px` / `vw` / `rem`，默认 `px` |
| `unit.outputBase` | 输出基准宽度（px 模式有效），默认 `750` |
| `unit.scale` | 换算倍数（outputBase / figmaBase），默认 `2` |
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
node .claude/skills/pp-d2c/bin/figma.mjs cache-check <fileKey>
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
> 1. `Read .claude/skills/pp-doctor/SKILL.md`，按其 §-1 → §5.4 流程执行体检
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
node .claude/skills/pp-d2c/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=2
```

stdout 是 `{"ok":true,"data":{"cached":<bool>,"node":{...}}}`。`node` 就是目标节点的完整子孙树（含 `type` / `name` / `children` / `visible` / `absoluteBoundingBox` 等）。脚本已处理缓存查/写，LLM 不用管。

**分块判断逻辑**：

唯一的分块触发条件是图层名带有 `sub-` 前缀。其他前缀（`img-`、`bg-`、`btn-` 等）不触发分块，由主 agent 直接处理。

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
   - **新 page 兜底（v0.3.10 新增）**：如果当前正在**创建全新页面**（`output.dir` 下无已存在的目标 `.jsx`/`.tsx` 入口，或该入口存在但**尚未** import 任何样式文件），也没有相邻同 output 目录页面可参考（`output.dir` 下其他 page 一个都没有），此时**必须以 config `project.styleFormat` 为唯一权威**——见下方"新 page 空档"表；**禁止**脑补大类（历史事故：<下游项目> 明确配 `"styleFormat":"scss"`（plain P），agent 生成新 page 时脑补成 `.module.scss` + `className={styles.x}` M 大类）。
   - **结论二选一：`plain stylesheet` / `css-modules`**（预处理语法用什么不影响这个结论）
   > ⚠️ **关键**：`:global(body)` 语法**只在 css-modules 下有效**。在普通 stylesheet（无论 scss/less/css）里写 `:global(...)`，浏览器会原样接收选择器并解析失败，**body 背景不会生效**——这是 D2C 最常见的"我明明写了 body 背景但页面还是白底"的根因。

   **新 page 空档权威表**（v0.3.10 新增）：

   | config `styleFormat` | 大类 | 生成文件后缀 | className 写法 | 顶部 import |
   |---|---|---|---|---|
   | `scss` / `less` / `css`（**plain**） | **P** | `index.scss` / `.less` / `.css` | `className="card"`（**裸类名**） | `import './index.scss'` |
   | `scss-modules` / `less-modules` / `css-modules`（**M**） | **M** | `index.module.scss` / `.module.less` / `.module.css` | `className={styles.card}` | `import styles from './index.module.scss'` |
   | `stylesheet` / `styled-components` / `nativewind`（RN） | **J** | 见 pp-d2c-rn | 见 pp-d2c-rn | 见 pp-d2c-rn |
   | `tailwind` / `inline` | **J** | 无独立样式文件（内联） | class 是 tailwind atomic / style 对象 | 无 |

   **判定链权威等级**：既有 import 实证 > 项目内已存在同 output 目录 page 参考 > `config.project.styleFormat`（新 page 空档兜底权威）。同一项目里 page A 是 module、page B 是 plain 的情况仍然合法——若目标页面之前实际存在，仍按第一项实证；只有"当前是创建全新页面且无参考"这一情况才落到 config 权威。

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

> **⚠️ 大类一致性硬约束（v0.3.14 强制，h5 独享）**：主 agent 完成 §2.5.2 判定后，**必须在 `.d2c-tasks.md` 顶部写入"大类锁定"段**（一次生成一次锁定，不允许中途改）：
>
> ```markdown
> ## 大类锁定（本次生成不可变）
> - 判定源：{既有 import 实证 / 邻居 page 参考 / config.styleFormat 权威}
> - 大类：**P** / **M** / **J**（三选一）
> - 生成规则：
>   - **P**：所有样式文件后缀 `.scss` / `.less` / `.css`（无 `.module`），`className="xxx"` 裸类名，`import './xxx.scss'`
>   - **M**：所有样式文件后缀 `.module.scss` / `.module.less` / `.module.css`，`className={styles.xxx}` 或 `className={styles["xxx"]}`，`import styles from './xxx.module.scss'`
>   - **J**：tailwind / inline / styled-components，不生成独立样式文件
> ```
>
> **sub-agent 生成 block 时**：**必须先 Read `.d2c-tasks.md` 的"大类锁定"段**，严格按锁定值生成 block 内部样式文件（`blocks/*/index.{scss,module.scss,...}`）+ `className` 写法，**禁止**每个 block 独立再走一次判定（各 sub-agent 拿到的 `styleFormat` config 一样，但历史事故显示 sub-agent 之间的判断会飘）。
>
> **主 agent 合并前 grep 自证**（放到 §6.0.2 合并忠实度证明块）：
>
> ```bash
> LOCK=$(grep -oE '\*\*[PMJ]\*\*' {output.dir}/.d2c-tasks.md | head -1 | tr -d '*')
> echo "锁定大类：$LOCK"
>
> if [ "$LOCK" = "P" ]; then
>   # P 大类禁止:module 后缀 / styles.xxx 消费 / import styles from
>   BAD_MOD=$(grep -rEl 'from.*\.module\.(scss|less|css)|\.module\.(scss|less|css)$' {output.dir}/ 2>/dev/null | wc -l)
>   BAD_STY=$(grep -rEc 'className=\{styles[\.\[]|import styles from' {output.dir}/ 2>/dev/null | awk -F: '{s+=$2}END{print s}')
>   [ "$BAD_MOD" -gt 0 ] && echo "❌ P 大类锁定，但发现 .module.* 后缀文件 $BAD_MOD 个"
>   [ "$BAD_STY" -gt 0 ] && echo "❌ P 大类锁定，但发现 styles.xxx / import styles $BAD_STY 处"
> elif [ "$LOCK" = "M" ]; then
>   # M 大类禁止:裸 .scss / 裸 className="xxx" / import './x.scss'(应带 styles from)
>   BAD_BARE=$(find {output.dir} -name '*.scss' ! -name '*.module.scss' 2>/dev/null | wc -l)
>   BAD_CLS=$(grep -rEc 'className="[a-zA-Z]' {output.dir}/ 2>/dev/null | awk -F: '{s+=$2}END{print s}')
>   [ "$BAD_BARE" -gt 0 ] && echo "❌ M 大类锁定，但发现非 module .scss 文件 $BAD_BARE 个"
>   [ "$BAD_CLS" -gt 0 ] && echo "❌ M 大类锁定，但发现裸 className=\"xxx\" $BAD_CLS 处"
> fi
> ```
>
> **违反后果**：所有不一致产物驳回，主 agent 按锁定大类**统一重写**。
>
> **典型事故（v0.3.14 修复的原型）**：某 h5 项目 `pp-d2c.config.json` 明确 `"styleFormat":"scss"`（P 大类），产物 `pages/index.jsx` 顶部却写 `import styles from "./styles.module.scss"` + 全篇 `className={styles.container}` / `className={styles["page-bg"]}`（M 大类），而同时 `pages/blocks/main/index.scss` 又是普通 `.scss`（P 大类），两半矛盾——主入口的 `.container` 被 css-modules 哈希化，跟 blocks 的普通 scss 完全不通气，页面视觉全部丢样式。修复：主 agent 判定为 P → 锁定 P → 所有产物一律普通 `.scss` + 裸类名 → sub-agent 生成 blocks 严格遵守。

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
| 含 `bg-` | **`bg-` 节点自身**（不是父容器！）导出为图片，切图挂到**父容器**的 CSS `background-image`（写在父容器的独立 `.scss` / `.less` / `.css` 文件里）；**bg 节点自身不生成任何 DOM**（不产 `<div>`、不产 `<img>`、不产 inline style），**不解析任何子层**。**切图源 nodeId 必须是 `bg-` 节点自己的 nodeId**，详见下面 §4.4「`bg-` 切图源约束」；违反这一条会把兄弟节点的文字/图标烤进 PNG。详见「`bg-*` 唯一合法落地形式」（v0.3.15） |
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
node .claude/skills/pp-d2c/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=8
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
| 容器**自身**尺寸行为 | `layoutSizingHorizontal` / `layoutSizingVertical` | `FIXED → width/height 固定值`；`HUG → width/height 由内容撑开`（CSS 里对应 `width: fit-content` 或**不写宽度**）；`FILL → width: 100%`（在 flex 父下等价 `flex: 1`）。**FIXED 高度的塌陷防御**（v1.0.2 新增，**必读**）：当 vertical `FIXED` 且节点带 `sub-` / `block-` 前缀，或节点内部有 `layoutPositioning: ABSOLUTE` 且 `height: 100%` 的兄弟层（典型 bg- 铺满）→ 写 `min-height: {N}px` 而非 `height: {N}px`；理由见下面「FIXED 塌陷防御」补充说明。**页面根容器例外**（v0.3.3 新增）：vertical `FIXED` 时不写 `height: {figmaH}px` 死值，改写 `min-height: max({figmaH * scale}px, 100vh)`；判定见 §4.3 判定优先级第 6 条 |
| **子节点**主轴伸缩 | `layoutGrow` (0 或 1) | `1 → flex: 1`（在父 flex 下沿主轴撑满剩余空间）；0 或缺失 → 不写 |
| **子节点**交叉轴对齐（覆盖父 align-items） | `layoutAlign` | `STRETCH → align-self: stretch`；`INHERIT` / 缺失 → 不写（继承父 align-items） |
| **子节点**是否脱离父 autoLayout 顺流 | `layoutPositioning` | `AUTO` 或缺失 → 参与父 flex 顺流，不写 position；`ABSOLUTE` → 子代 `position: absolute` + `top/left`（相对父原点，用 `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` 算得），同时**父容器必须加** `position: relative`。**仅当父 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 时此字段有意义**。此机制通用（不限于 `bg-` / `fixed-` 前缀）——任何设计师在 Figma 里勾选"绝对定位"的子节点都会返 `ABSOLUTE` |

> **v0.3.1 铁律**：`layoutMode` 是 `HORIZONTAL` / `VERTICAL` 时，**禁止**对该 Frame 使用 `position: absolute` + `top/left`；主 agent §6.0 验收命中此违反 → 回退整块重写。
>
> **两端对齐特别提醒**：`primaryAxisAlignItems === 'SPACE_BETWEEN'` 是明确信号，**直接翻译成 `justify-content: space-between`**，不要用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟。设计师用两端对齐排 = REST 返 `SPACE_BETWEEN`；设计师用固定间距排 = REST 返 `MIN` + `itemSpacing`。忠实翻译即可，不做推断。
>
> **`layoutPositioning` vs `layoutMode` 谁决定 CSS 定位方式（看谁：看自己 or 看父）**：`layoutMode` 描述**该节点自己**的内部布局（父视角）；`layoutPositioning` 描述**该节点在父容器里**是否脱离顺流（子视角）。两者互不冲突：一个节点可以自己是 autoLayout 容器（`layoutMode = VERTICAL`），同时又在父的 autoLayout 里绝对定位（`layoutPositioning = ABSOLUTE`）——CSS 里写成 `position: absolute; top:...; left:...; display: flex; flex-direction: column; ...`。

> **FIXED 塌陷防御**（v1.0.2 新增，容器高度写法的第 3 个补充规则）：Figma `layoutSizingVertical: FIXED N` 到 CSS 有 3 种落地方式，按下表选：
>
> | 场景 | 高度写法 | 理由 |
> |---|---|---|
> | 页面根容器（三信号 AND 命中，见 §4.3 优先级 6） | `min-height: max({N * scale}px, 100vh)` | 视口更大时撑到 100vh，防长屏底部露白 |
> | **`sub-` / `block-` 容器且内部有 `layoutPositioning: ABSOLUTE + height: 100%` 兄弟层**（典型：`&__main` 含 `&__main-bg` 铺满） | **`min-height: {N * scale}px`** | 死高 `height` 会因内容异步渲染 / 数据少时压缩到 HUG 表现，让 `height: 100%` 兄弟层跟着塌成一条 |
> | **`sub-` / `block-` 容器普通场景**（无绝对定位背景兄弟） | **`min-height: {N * scale}px`** | 设计师给 FIXED = 兜底"至少这么高"，业务内容多时允许撑开；死高会裁切超长内容 |
> | 叶子/装饰元素（`img-` / `bg-` / `btn-` / 图标 / 卡片装饰等） | `height: {N * scale}px` | 尺寸严格匹配设计稿，超出属于设计问题 |
>
> **判定顺序**：先看是否命中"页面根容器例外"→ 再看是否命中"sub-/block- 容器"→ 都不是走"叶子/装饰"。
>
> **兼容点**：`min-height` 相较 `height` 只是"下限保底"，不影响设计稿本意。旧产物用 `height` 出现的塌陷问题(bg 层跟着塌成一条)全部由本规则统一收敛。

> **sub 容器 min-height 尺寸源证明（v0.3.10 强制）**：`sub-` / `block-` 容器写 `min-height` 时，尺寸源**必须**取节点**自身**的 `absoluteBoundingBox.height`，**禁止**取兄弟 `bg-` / `bgc-` 层的高度（哪怕兄弟层比自身高——bg 兄弟层在 Figma 里常"溢出到下方指南区"作装饰，与父容器主内容区不等）。
>
> **sub-agent 交付每个 `sub-` / `block-` 容器前必须在 `blocks/{sub}/assets.txt` QA 段写一行**：
>
> ```
> · SUB容器 {nodeId} name="{nodeName}" 自身h={H1} bg兄弟层h={H2 或 "无"} min-height写入={H1 * scale}px（scale={S}）
> ```
>
> 其中 `min-height 写入` 值必须严格等于 `H1 * scale`，**不允许**是 `H2 * scale`。
>
> **主 agent 合并前 grep 自证命令**（§6.0.2 证明块中「sub 容器 min-height 尺寸源」段引用）：
>
> ```bash
> # 从 assets.txt 提取所有 SUB 容器溯源行
> grep -Eho '^· SUB容器 [0-9]+:[0-9]+ .* min-height写入=[0-9]+px' {output.dir}/blocks/**/assets.txt 2>/dev/null \
>   > /tmp/sub-minh-declared.txt
>
> # 对每一行断言：min-height 写入 == 自身h * scale
> ERRORS=0
> while read line; do
>   H1=$(echo "$line" | sed -E 's/.*自身h=([0-9.]+).*/\1/')
>   S=$(echo "$line" | sed -E 's/.*scale=([0-9.]+).*/\1/')
>   WROTE=$(echo "$line" | sed -E 's/.*min-height写入=([0-9]+)px.*/\1/')
>   EXPECT=$(awk "BEGIN{printf \"%d\", $H1 * $S}")
>   if [ "$WROTE" != "$EXPECT" ]; then
>     echo "❌ SUB min-height 尺寸源错：$line 应写入 ${EXPECT}px"
>     ERRORS=$((ERRORS + 1))
>   fi
> done < /tmp/sub-minh-declared.txt
>
> if [ "$ERRORS" = "0" ]; then
>   echo "✅ sub 容器 min-height 尺寸源契约通过：$(wc -l < /tmp/sub-minh-declared.txt) 个容器全部按自身尺寸写入"
> else
>   echo "❌ $ERRORS 个容器把 bg 兄弟层高度错写到 min-height，触发 doctor DIM031（v0.3.10）"
> fi
> ```
>
> **典型案例**：`.main { min-height: 1125px }` = bg-main 兄弟层 562.5×2 → 错。应取 sub-MAIN 自身 h=520 → `min-height: 1040px`。理由：设计师给 sub- 打 FIXED = 主内容区高度约束；bg- 兄弟层高度 = 装饰视觉，不代表主内容区高度。这两个尺寸绝大多数情况就是不等的，任何一次"因为兄弟层比自身高就取兄弟层"都是 skill 忠实度事故。
>
> **doctor 关联规则**：DIM031（v0.3.10 新增，error）—— sub-/block- 容器 min-height 写入值 = 兄弟 bg 层高度 而非自身高度，参见 pp-doctor §3.6s。

> **bg- 独立切图契约（v0.3.11 强制，v0.3.15 严化）**：每个 `bg-*` 前缀节点**必须独立走一次 `figma.mjs export-image`**，即使其**祖先链上已有别的 `bg-*` 前缀节点被整体切图**，且切图物理范围覆盖当前节点。理由：agent 无法准确判断祖先切图产物里是否"精确渲染了"当前 `bg-*` 节点的视觉——只要设计师主动打了 `bg-*` 前缀，就代表"这是一个独立的可替换视觉资产"，必须有自己的 png 落盘 + **通过 CSS `background-image` 挂在父容器上**（详见下方「唯一合法落地形式」）。
>
> **禁止的错误逻辑**（agent 常见脑补）：
> - ❌ "父 `bg-<A>` 已经整体切了，且切图物理范围覆盖了子 `bg-<B>`，所以 `bg-<B>` 不用再切"
> - ❌ "祖先 `bg-` 切图产物里有 SLICE 子节点覆盖了后代 `bg-` 所在物理区域，后代已烤入祖先切图"
> - ❌ "父的切图物理范围包住了子的 bbox，子视觉已在父切图里"
>
> **正确逻辑**：**前缀维度优先于物理覆盖维度**——只要设计师在图层名上打了 `bg-` 前缀，agent 就必须尊重"这是一个独立视觉资产"的设计意图，独立切图、独立引用。祖先与后代的物理重叠区域在最终产物里会叠加渲染（父容器 `.parent { background-image: url(bg-<A>.png) }` + 子容器 `.child { background-image: url(bg-<B>.png) }`），视觉一致由设计师负责——不是 agent 优化的空间。
>
> **sub-agent 交付前必须在 `blocks/{sub}/assets.txt` QA 段末尾追加一段 bg- 独立切图清单证明**：
>
> ```
> ## bg-* 独立切图清单证明（v0.3.11）
>
> · 本 block 子树内所有 `bg-*` 前缀节点：{count} 个
>   - {nodeId1} name="{name1}" bbox={w1×h1}  → 切图 {filename1.png}  ✅ 独立
>   - {nodeId2} name="{name2}" bbox={w2×h2}  → 切图 {filename2.png}  ✅ 独立
>   - ...
> · 所有 bg-* 节点均已独立切图 + 独立产物引用：✅ 通过（0 个被祖先覆盖省略）
> ```
>
> 若某个 `bg-*` 节点被 sub-agent 判定为"祖先已覆盖 → 省略"，**视为忠实度事故**（doctor BGP033 error），必须回滚到"独立切图" 路径重做。
>
> **主 agent 合并前 grep 自证命令**（§6.0.2 证明块中「bg- 独立切图契约」段引用）：
>
> ```bash
> # 1. 从各 block 子树 JSON 提取所有 bg-* 前缀节点（图层名以 bg- 开头,或裸词 bg + 分隔符）
> # 注意：bgc- 不计入，只覆盖 bg- / bg（裸词）
> grep -Eho '"name":\s*"(bg-[^"]+|bg)"' .d2c-cache/**/nodes/*.json 2>/dev/null \
>   | sed -E 's/.*"name":\s*"([^"]+)".*/\1/' | sort -u > /tmp/bg-nodes-in-tree.txt
>
> # 2. 从 assets.txt 提取所有已切图的 bg-* 文件名（strip 后缀,匹配 bg-{name}.png）
> grep -Eho '^- +bg-?[A-Za-z0-9_-]+\.(png|svg|jpg|jpeg|webp)' {output.dir}/blocks/**/assets.txt 2>/dev/null \
>   | sed 's/^- *//' | sed -E 's/\.(png|svg|jpg|jpeg|webp)$//' | sort -u > /tmp/bg-declared.txt
>
> # 3. 差集：应切图但没切的 bg-* 节点数
> MISSING=$(comm -23 /tmp/bg-nodes-in-tree.txt /tmp/bg-declared.txt | wc -l)
>
> if [ "$MISSING" = "0" ]; then
>   echo "✅ bg- 独立切图契约通过：$(wc -l < /tmp/bg-nodes-in-tree.txt) 个 bg-* 节点全部独立切图"
> else
>   echo "❌ $MISSING 个 bg-* 节点未独立切图，可能被祖先切图省略（触发 doctor BGP033）："
>   comm -23 /tmp/bg-nodes-in-tree.txt /tmp/bg-declared.txt
> fi
> ```
>
> **典型案例**：某父容器 `bg-<A>` 整体切了 `<A-bg>.png`，agent 因为该切图物理覆盖了下方多个同级列表项所在区域，就"省略"了每个列表项里 `bg-<B>` 的独立切图，产物对应容器空 View、后代装饰完全丢失。v0.3.11 后此路径被独立切图契约堵死。
>
> **doctor 关联规则**：BGP033（v0.3.11 新增，error）—— `bg-*` 前缀节点在产物中既无对应切图 + 无 CSS `background-image` 引用，参见 pp-doctor §3.6v。

> **⚠️ `bg-*` 唯一合法落地形式（v0.3.15 强制，h5 独享）**：设计稿中 `bg-*` / 裸词 `bg` 节点是"父容器的背景层"（通常 ABSOLUTE 铺满父区域）。h5 产物的正确落地是——**bg 节点自身不生成任何 DOM**，切图直接挂到**父容器**的 `background-image`（写在独立 `.scss` / `.less` / `.css` 文件里）。
>
> **正确形式**：
>
> ```jsx
> {/* JSX:bg 节点被"吸收"掉,只留父容器,内容子直接放在父下 */}
> <div className="parent-container" data-node-id="{父nodeId}">
>   <ChildContent1 />
>   <ChildContent2 />
> </div>
> ```
>
> ```scss
> .parent-container {
>   position: relative;                                // 承接子 ABSOLUTE 定位
>   background-image: url('#{$asset-prefix}bg-xxx.png');
>   background-size: cover;                            // 或 100% 100% / contain,按视觉需要
>   background-repeat: no-repeat;
> }
> ```
>
> **禁止的三种错法**：
>
> ```jsx
> ❌ <img src="...bg-xxx.png" data-node-id="..." />                       // <img> 是 img-* 独占,bg-* 禁用
> ❌ <div className="bg" data-node-id="..." />                            // bg 生成自己的空 div(应吸收进父)
> ❌ <div style={{backgroundImage:'url(...)'}} data-node-id="..." />      // JSX inline 样式(应写独立 scss)
> ❌ <div style="background-image:url(...)" data-node-id="..." />         // HTML inline 样式(同上)
> ```
>
> **合并 grep 自证**：
>
> ```bash
> # 从缓存 JSON 找所有 bg-*/裸词 bg 节点 id
> python3 -c "
> import json, glob
> for f in glob.glob('.d2c-cache/**/nodes/*.json', recursive=True):
>     d = json.load(open(f))
>     def walk(n):
>         name = n.get('name','')
>         if name == 'bg' or name.startswith('bg-'):
>             print(n.get('id',''))
>         for c in n.get('children',[]):
>             walk(c)
>     walk(d.get('node', d))
> " | sort -u > /tmp/bg-ids.txt
>
> # 每个 bg 节点 id 在产物 JSX 里都不允许作为独立 DOM 出现(<img> / <div> 都不行)
> for id in $(cat /tmp/bg-ids.txt); do
>   if grep -Ern "data-node-id=\"$id\"" {output.dir}/ 2>/dev/null | grep -v '\.md:' ; then
>     echo "❌ bg 节点 $id 出现在 JSX 中(应吸收进父容器,切图挂父 background-image)"
>   fi
> done
>
> # inline style 禁令
> grep -Ern 'style=\{\{[^}]*backgroundImage|style="[^"]*background-image' {output.dir}/ 2>/dev/null \
>   && echo "❌ 发现 inline 样式 background-image(应写独立 .scss)"
> ```
>
> **典型事故(v0.3.15 修复的原型)**:某 h5 页面同名 `bg-<X>` 节点被 agent 用两种方式混合落地——一处 `<div class="<X>-bg"></div>` + scss 挂 background(生成了空 div,仍不对但接近);另一处 `<div class="<X>-bg" style="background-image:url(...)">`(inline style,错);同时另一 `bg` 裸词节点 `<Y>-bg` 被生成 `<img src="<Y>-bg.png" class="<Y>-bg">`(用了 img,错)。v0.3.15 后 bg 节点在 h5 产物里**不再生成任何 DOM**,只挂父 background-image。
>
> **v0.3.11 原句歧义修正**：v0.3.11 写的"JSX `<img>` / CSS `background-image`"两个并列表述让 agent 二选一，v0.3.15 明确改为"仅父容器 CSS `background-image`"单选。

> **冗余嵌套 autoLayout 的属性下穿**（v1.0.2 新增，判定/取值层的隐藏 bug 修复）：Figma 里设计师有时为了"分组"多包一层 autoLayout,但内部只有一个真正的顺流子(其他都是 abs 兄弟)。直译成 DOM 时**保留双层结构没错**(abs 兄弟需要挂在外层),但**布局属性(padding/gap/align)应该整体下穿到内层**，因为设计师改的是内层。
>
> **触发条件（全部满足才命中）**：
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
> | `display: flex` / `flex-direction` | **删除**(A 不再当 flex 容器) | 保留 B 自己的 |
> | `padding-*` / `gap` / `justify-content` / `align-items` / `flex-wrap` | **删除**,值下穿到 B(若 B 已有同名属性→**保留 B 的**,A 的值写入 §7 QA info 段) | 用 B 自己的值;B 没写就用 A 下穿的值 |
> | `width` / `height` / `min-height` / `max-*` | 保留 A 自己的(容器骨架) | 保留 B 自己的 |
> | `position` / `overflow` / `background` / `border-radius` / `box-shadow` | 保留 A 自己的(容器骨架) | 保留 B 自己的 |
> | `position: relative`(为 abs 兄弟挂载) | **强制加**(若 A 有 abs 兄弟) | 不动 |
>
> **典型场景**(欧暑二级页面 Frame 703 / 702 tab 滚动列表):
>
> ```
> // Figma:
> Frame 703 (autoLayout HORIZONTAL, gap=0 padding=14px 0, overflow=SCROLL)  ← 外层,内容仅 1 顺流子 + 1 abs fade 遮罩
> ├── Frame 702 (autoLayout HORIZONTAL, gap=112 padding=40 40)              ← 内层,真正排布 tab 项
> │   ├── tab 1
> │   ├── tab 2
> │   └── ...
> └── img-xz fade 遮罩 (layoutPositioning: ABSOLUTE)
> ```
>
> ```scss
> // 命中"冗余嵌套下穿"规则,产物:
> &__tab-scroll {
>   position: relative;                    // 保留(abs 兄弟需要挂载)
>   width: 720px; height: 98px;            // 保留(A 骨架)
>   overflow-x: auto;                      // 保留(scroll 语义)
>   // ⚠️ 删除:display:flex / gap / padding / align-items(全部下穿到 B)
> }
> &__tab-list {
>   display: flex; flex-direction: row;    // 来自 B 自己
>   gap: 112px;                            // 来自 B(不是 A 的 0)
>   padding: 40px;                         // 来自 B(不是 A 的 14 0)
>   align-items: center;                   // 来自 B
> }
> &__fade { position: absolute; ... }      // abs 兄弟仍挂 A(&__tab-scroll)
> ```
>
> **不下穿的例外**:A 或 B 命中 `sub-` 前缀 → 不下穿,双层各自输出。`sub-` 是"独立 agent 边界",样式命名空间要各自独立才好维护。
>
> **QA 输出**:命中下穿时,§7 报告段追加一行:`<A 节点名>(外层) → <B 节点名>(内层) 触发冗余嵌套下穿,padding/gap 已合并到内层`。若发生"A 和 B 同名属性冲突,以 B 为准",另加一行:`<属性名>: A 值 <VA> 被 B 值 <VB> 覆盖`。

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
| **字色（TEXT 节点，v0.3.6 修订）** | `fills[]`——按下面「TEXT 多层 fills 处理」取值 | **禁止直接取 `fills[0]`**：Figma 允许一个 TEXT 叠多层 fills，设计师改颜色时忘记删旧层是常见情况；正确做法见下 |
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

**TEXT 多层 fills 处理（v0.3.6 新增）**：

Figma 里一个 TEXT 节点可以叠多层 `fills`。取字色遵循下表（详细说明见 pp-style §八「TEXT 多层 fills 处理」）：

| fills 情形 | 取值 |
|-----------|------|
| 单层 SOLID | 直接取 |
| 多层 SOLID，都 `visible !== false` | **按 fills[] 顺序取最末位**（Figma 渲染顺序：后写的覆盖先写的） |
| 多层 SOLID，部分 `visible === false` | **跳过所有 visible:false**，再取"剩下的最末位" |
| 单层 GRADIENT | `background-clip: text` + `color: transparent`（RN 侧退化为末位近似 SOLID + QA 告警） |
| 多层混合（SOLID + GRADIENT） | 按 Figma 渲染顺序合成；若 GRADIENT 在最上层 → `background-clip: text`；SOLID 在最上层 → 取 SOLID 色 |
| fills 为空 | 用 Figma 默认黑 `#000` + QA 告警 |

**反向自检 1 行**（sub-agent 生成 TEXT 前必须输出）：

```
· TEXT 字色：{finalColor}（fills 有 {N} 层可见 SOLID，取末位；例：#492b0d 被 #ffffff 覆盖时最终视觉是白色）
```

**典型案例**：`136:45728`（"去看看"）fills = `[#492b0d visible:true, #ffffff visible:true]` → 取 `#ffffff`，而不是 `#492b0d`。

**doctor NAM025（v0.3.6 新增）**：TEXT 节点 `fills` 有 ≥2 个可见 SOLID → info 提示，防止取错色。

**字色 fills 溯源证明（v0.3.10 强制，每个 TEXT 交付前写 assets.txt QA 一行）**：

sub-agent 交付每个 block 前，必须在 `blocks/{sub}/assets.txt` 的 QA 段末尾追加**每个 TEXT 节点一行**的溯源记录，格式：

```
· TEXT {nodeId} "{text}" fills层数={N} 可见SOLID列表=[#hex1, #hex2, ..., #hexN] 末位可见色={#hexN} 最终写入={#final}
```

其中 `{#final}` 必须严格等于 `{#hexN}`。**违反即视为字色事故**（doctor CLR030 error）。

**主 agent 合并前 grep 自证命令**（§6.0.2 证明块中「字色 fills 溯源」段引用）：

```bash
# 1. 从 assets.txt 提取所有 TEXT 溯源行，抽出 {最终写入} 值
grep -Eho '^· TEXT [0-9]+:[0-9]+ .* 最终写入=#[0-9a-fA-F]{3,8}' {output.dir}/blocks/**/assets.txt 2>/dev/null \
  | sed -E 's/.*最终写入=(#[0-9a-fA-F]{3,8}).*/\1/' | sort -u > /tmp/text-color-declared.txt

# 2. 从产物提取 color: '#...' / color: "#..." 的字色写入（含 style / scss / less / css）
grep -rEho "color:\s*['\"]#[0-9a-fA-F]{3,8}['\"]|color:\s*#[0-9a-fA-F]{3,8}" {output.dir}/ \
  --include='*.tsx' --include='*.jsx' --include='*.scss' --include='*.less' --include='*.css' 2>/dev/null \
  | grep -oE '#[0-9a-fA-F]{3,8}' | sort -u > /tmp/text-color-used.txt

# 3. 差集 declared - used（"assets.txt 声明取末位，但产物里根本没这个色" → 幻觉字色事故）
comm -23 /tmp/text-color-declared.txt /tmp/text-color-used.txt > /tmp/text-color-lost.txt
LOST=$(wc -l < /tmp/text-color-lost.txt)

if [ "$LOST" = "0" ]; then
  echo "✅ TEXT 字色溯源契约通过：$(wc -l < /tmp/text-color-declared.txt) 种末位色全部在产物中出现"
else
  echo "❌ 声明取末位但产物没写入的色：$(cat /tmp/text-color-lost.txt | tr '\n' ' ')"
  echo "   触发 doctor CLR030（v0.3.10）：sub-agent 违反 §4.1.1「末位取色」——历史 bug: 立即抢 #ffffff（应 #864500 末位）"
fi
```

> **反幻觉说明**：`.quan__card-btn-text { color: '#492b0d' }` 这类事故（fills 里根本没这个色）在本自证中会被 100% 抓到——因为 declared 集合（末位色）绝无 `#492b0d`。

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
| **含前缀词但不是完全裸词**（如 `background` / `bgheader` / `button`） | ❌ 不识别，按普通图层走无前缀兜底 | `background` → 兜底为 `<img>` 切图 |

**裸词白名单**（仅这些独立/内容前缀允许裸词形式）：`bg` / `bgc` / `btn` / `img` / `input`

**修饰前缀不允许裸词**：`sub` / `block` / `x` / `scrollx` / `scrolly` / `fixed` / `end` 这些前缀必须写 `xxx-...` 完整形式，**不允许**独立裸词。理由：修饰前缀本身不表达"内容/角色"，脱离被修饰目标没有意义（例如"`sub` 什么？"），语义歧义会诱导 agent 意会。裸词 `sub` / `block` 等一律走无前缀兜底，doctor 会 warn 提示（NAM022）。

**裸词不允许与其他前缀组合**：`sub-bg` / `block-btn` 这类"修饰前缀 + 裸词"命名一律**报错**（doctor NAM023）。要组合就写完整语义 `sub-bg-{purpose}` / `block-btn-{purpose}`——单裸词只服务"就这一个背景/按钮"的直觉命名场景，一旦要组合，已经离开"设计师自然命名"的语境，必须写规范。

**filename 派生规则**（裸词没有"后缀部分"可用做 filename，需要从上下文派生）：

| 裸词 | filename 派生 |
|------|--------------|
| `bg` | `{父节点 name 或 clean-id}-bg.png` |
| `btn` | `{子内容主 name 或 clean-id}-btn.{ext}`（btn 里通常含 img 子层，取其 name；无则用 clean-id） |
| `img` | `{父节点 name 或 clean-id}-img.{ext}`（父命名兜底） |
| `bgc` | 无 filename（`bgc-` 本来就不切图，只取 fills/strokes/effects 色值） |
| `input` | `{父节点 name 或 clean-id}-input`（复用当前 input 规则） |

`clean-id` 定义：nodeId 去冒号（例：`189:36862` → `189_36862`），当父名/子名不适合当 filename（含中文特殊字符、空图层名等）时兜底。

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
8. **父容器盒级装饰兜底（v0.3.6 新增，默认开）**：对任何会生成容器的节点（含 `btn-` / `sub-` / `block-` / 无前缀 FRAME/GROUP），检查节点自身 fills/strokes/effects/cornerRadius/子树 是否"CSS 完全可表达"（判定条件与 §4.3「父容器盒级装饰兜底判定」小节保持一致，也见 pp-style §四a）——命中则把这些属性**写到自身容器 CSS**（不是父元素），不切图；未命中则继续走后续步骤
9. 若有 `btn-`，将渲染结果包裹在可点击容器内（若第 8 步已命中 → `btn-` 容器 CSS 已含背景/圆角/投影，不必再建 `bg-*` 子层）
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
· 父容器内是否还有其他 sub-/block-/img-/btn-/文本？{是/否}；若是 → 它们独立处理，不参与切图
```

任意一项答错即停下重做——这是 `card-bg.png` 这类 bug 的唯一防线。

**父容器盒级装饰兜底判定（v0.3.6 新增，默认开）**：

对任何会生成容器的节点（含 `btn-` / `sub-` / `block-` / 无前缀 FRAME/GROUP）执行判定；命中 → **不切图**，把节点自身的 fills/strokes/cornerRadius/effects 按下面「bgc- 取值规则」映射到**自身容器 CSS**（不是父元素）。

| 检查项 | 命中条件 |
|-------|---------|
| 前缀 | 不含 `img-` / `bg-` / `x-` |
| fills | 空 / 单层或多层 SOLID / 单层 GRADIENT_LINEAR / GRADIENT_RADIAL；**不允许任何一层是 IMAGE** |
| strokes | 空 / 单层 SOLID（gradient stroke 允许，降级 `box-shadow`） |
| effects | 空 / 全部是 DROP_SHADOW / INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR |
| 子树 | 不含 BOOLEAN_OPERATION / VECTOR / MASK / ELLIPSE 等复合形状；不含内层 `img-` / `bg-` 命中的位图节点（TEXT / 普通嵌套 FRAME / 兄弟 `bgc-` 不算破坏纯净度） |

**反向自检 3 行**（sub-agent 处理此类容器节点前必须输出）：

```
· 节点前缀：{prefixes}（非 img-/bg-/x- 才可能命中）
· fills/strokes/effects/子树是否纯净？{是/否}（对照 5 项条件逐一勾选）
· 走 CSS 还是切图？{CSS / 切图}（命中 → CSS；不命中 → 走 §4.4 切图）
```

**旧规范兼容**：设计师若主动建了 `bg-*` 子层（老命名）→ 依然按 §4.3 `bg-` 规则走；doctor NAM024 会 warn 建议合并到父容器（不阻断）。

**典型案例**（对照）：

```
btn-qukankan (FRAME, fills=[GRADIENT_LINEAR], cornerRadius=8)
  └── TEXT "去看看"

命中：直接生成
  .btn-qukankan {
    background-image: linear-gradient(...);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
不需要再建 bg-btn-qukankan 子层切图。
```

**`btn-` 内嵌 TEXT 双写防护（v0.3.6 新增）**：

- **`btn-` 命中「父容器盒级装饰兜底」** → 内部 TEXT 正常出 `<span>` + 字色走 §4.3「TEXT 多层 fills 处理」（默认场景）
- **`btn-` 未命中兜底（fills 含 IMAGE / 子树含复合形状 → 必须切图）** → 内部 TEXT 默认视为"图字副产物"，**不生成 `<span>`**，避免出现"图片里有文字 + 代码里 span 里又写一遍文字"的双写问题（doctor NAM024 error）
- **例外**：若设计师主动给内部 TEXT 加了独立前缀（比如把 TEXT 也塞在 `sub-` 里当独立块），按前缀语义正常处理

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

**`end-` 逆向布局规则（v0.3.2 新增）**

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM016 命中后 error）。

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

#### 4.3.1 页面根 padding-top 尺寸源证明（v0.3.10 强制）

**目的**：页面顶层容器（用户传入的 nodeId 对应的 Figma 节点）的 `padding-top` **必须**取该节点自身 `paddingTop` 字段值 × scale，**禁止**取 `fixed-` 状态栏 / 顶部导航栏子层的高度替代。

**背景**：Figma 页面顶层 frame 常常同时有：
- **自身 `paddingTop` 字段**（例：166）：设计师给主内容区上方预留的间距
- **`fixed-` 状态栏子层**（例：118 高）：绝对定位在顶部的固定栏

这两个值**大概率就是不等的**，因为：
- `fixed-` 层是 `layoutPositioning: ABSOLUTE` 脱离父 flex 顺流，不参与 padding 计算
- `paddingTop` 是设计师给主内容区留的实际视觉间距（可能包含状态栏 + 底下再留一点）
- **主 agent 必须**从 Figma 节点的 `paddingTop` **字段本身**取值，禁止用"上方的 fixed 子层高度"脑补替代

**溯源证明格式**（主 agent 合并前必须在**主页面产物**同级 `assets.txt`（若无则新建 `pages/<page>/assets.txt`）或对话中输出一行）：

```
· PAGE根 {pageNodeId} name="{pageName}" figmaPaddingTop={P} fixed状态栏h={S 或 "无"} padding-top写入={P * scale}px（scale={S_scale}）
```

其中 `padding-top 写入` 值必须严格等于 `figmaPaddingTop × scale`，**不允许**是 `fixed状态栏h × scale`。

**主 agent 合并前 grep 自证命令**（§6.0.2 证明块中「页面根 padding-top 尺寸源」段引用）：

```bash
# 从主页面 assets.txt / 或专用溯源文件提取 PAGE根 溯源行
grep -Eho '^· PAGE根 [0-9]+:[0-9]+ .* padding-top写入=[0-9]+px' {output.dir}/**/assets.txt 2>/dev/null \
  > /tmp/page-padt-declared.txt

# 断言 padding-top 写入 == figmaPaddingTop * scale
ERRORS=0
while read line; do
  P=$(echo "$line" | sed -E 's/.*figmaPaddingTop=([0-9.]+).*/\1/')
  S=$(echo "$line" | sed -E 's/.*scale=([0-9.]+).*/\1/')
  WROTE=$(echo "$line" | sed -E 's/.*padding-top写入=([0-9]+)px.*/\1/')
  EXPECT=$(awk "BEGIN{printf \"%d\", $P * $S}")
  if [ "$WROTE" != "$EXPECT" ]; then
    echo "❌ 页面 padding-top 尺寸源错：$line 应写入 ${EXPECT}px"
    ERRORS=$((ERRORS + 1))
  fi
done < /tmp/page-padt-declared.txt

if [ "$ERRORS" = "0" ]; then
  echo "✅ 页面根 padding-top 尺寸源契约通过"
else
  echo "❌ $ERRORS 个页面把 fixed 状态栏高度错写到 padding-top，触发 doctor DIM032（v0.3.10）"
fi
```

**典型案例**：`.baseBackground { padding-top: 236px }` = fixed-状态栏 118×2 → 错。应取页面 `paddingTop=166` × 2 = **332px**。

**为什么不写"取二者中较大值 / 二者之和"**：agent 一旦被允许"综合推断"就会脑补——skill 的忠实度契约要求每个数值有明确的字段出处，禁止综合演算。若 Figma 设计里 fixed- 层视觉上叠在 padding-top 区域上，那是设计师本意（padding 区留出了状态栏叠加的空间），主 agent 不需要额外补偿。

**doctor 关联规则**：DIM032（v0.3.10 新增，error）—— 页面根 padding-top 写入值 ≠ `figmaNode.paddingTop × scale`，参见 pp-doctor §3.6t。

#### 4.4 图片处理

##### 4.4.pre 节点整体切图适格性（v0.3.7 新增，前置约束）

**目的**：明确"允许整体切图"和"永远禁止整体切图"两类节点的边界，防止主 agent / sub-agent 把父容器（含多个子层）整体切一张大图当替代品，导致 sub-agent 拆分产物被覆盖。

| 节点前缀 / 类型 | 是否允许整体切图 | 说明 |
|--------------|--------------|------|
| `img-` | ✅ 允许 | 命中即整体切图（含节点自身及子树），**不再向内递归**；符合 §4.3 组合优先级第 2 步 |
| `bg-` / 裸词 `bg` | ✅ 允许（切**自身**及其子树） | 切图源 nodeId **必须**是 `bg-` 节点自己，**禁止**用父容器（见 §4.3 「`bg-` 切图源约束」） |
| 无前缀非文本图层（FRAME/GROUP/VECTOR 等） | ✅ 允许（兜底） | 命中 §4.3 无前缀兜底规则时才走此路径；命中「父容器盒级装饰兜底」（§4.3）则走 CSS，不切图 |
| **`sub-` / `block-`** | ❌ **永远禁止** | 分块边界节点，**必须递归子层**由 sub-agent 独立处理；主 agent 合并阶段不允许把 `sub-*` / `block-*` 前缀的父容器 nodeId 传给 `figma.mjs export-image`。历史事故：`sub-ui-frame734.png` 就是把 sub-UI 内的 Frame 734（做任务大区）整体切了一张父容器大图 |
| **`btn-`（未命中兜底）** | ❌ 只切自身，禁止吃父容器 | 若 `btn-` 命中「父容器盒级装饰兜底」（§4.3）走 CSS；否则只切 `btn-` 节点自身及其子树，**禁止**把 `btn-` 的父容器（如 `任务` Frame）一并切图 |
| `bgc-` / `x-` | ❌ 禁止 | `bgc-` 走 CSS，`x-` 跳过整层，两者都不切图 |

**违反后果**：doctor SUB027（v0.3.7 新增，error）—— 主 agent 或 sub-agent 对 `sub-*` / `block-*` 前缀节点调用 `figma.mjs export-image` 整体切图 → 视为忠实度事故，见 pp-doctor §3.6p。

##### 4.4.pre.b 子树结构禁切规则（v0.3.9 新增，前缀维度的**必要补丁**）

**背景**：v0.3.7 §4.4.pre 上表只从**前缀维度**判定"禁切"，只覆盖了 `sub-*` / `block-*` 命名节点。但 sub-agent 内部会遇到**没打前缀但结构上就是内部分块**的节点（例如 `Frame 734`：含 3+1 行任务 + 独立按钮 + 独立文字，前缀是"无前缀"）——这种节点如果落回"无前缀非文本图层兜底整体切图"路径，sub-agent 就能借"figma 图层名字不叫 sub-XXX"绕过 §4.4.pre 主表，把整片子树烤成一张位图。历史事故 `task-block.png`：Frame 734 (`136:45662`) 就是被 sub-UI sub-agent 按"无前缀兜底"整体切下来的。

**核心公式**：**只要子树命中以下任一结构信号，即使前缀是"无前缀"或没打 `sub-` / `block-` 也永远禁止整体切图**，必须递归子层，各子节点按 §4.3 独立解析。

| 结构信号 | 判定条件 | 理由 |
|---------|---------|------|
| **多文本禁切** | 子树含 **≥2 个可见 TEXT** 节点，且**分属不同视觉行**（任两个 TEXT 的 `absoluteBoundingBox.y` 差 ≥ 4px；同一行不算） | 文字必须可选中、可翻译、可无障碍朗读、可埋点、可动态替换；烤成位图后这些能力全废 |
| **多按钮禁切** | 子树含 **≥2 个**下列任一：`btn-` 前缀节点 / 裸词 `btn` 节点 / INSTANCE / COMPONENT 型子节点 | 按钮是交互原子，必须独立生成 `<button>` / `<Pressable>` 才能挂事件；烤图后无法点击 |
| **同构列表禁切** | 子树含 **≥3 个**同层同构子节点（**同类型**+**bbox 相近**±10%+**图层名同前缀或数字后缀差 1**） | 同构结构是列表语义，应当 `.map()` 生成，烤图后无法动态渲染、无法数据绑定 |

**判定优先级**：结构信号维度**优先于**前缀维度——即使节点前缀是 `img-` / `bg-` / 无前缀，只要命中上表任一条件，一律禁止整体切图，必须递归子层。

> **⚠️ 无前缀豁免（v0.3.16 严化）**：v0.3.9 里曾对 `img-` / `bg-` 保留"设计师显式指定豁免"，实践中被 agent 滥用——`img-tag-xxx`（叶子小图，无内部 TEXT/btn）与 `img-<容器>`（内部含 ≥4 TEXT + btn，是设计师**打错前缀**）走同一豁免路径，导致 7 张 quan 卡（每张含"标签TEXT + 金额TEXT + 单位TEXT + 按钮TEXT + 角标"）被整体切图，文字、按钮、数据全烤入位图，后续无法多语言 / 无法数据绑定 / 无法接入埋点。**v0.3.16 后**：`img-` / `bg-` 前缀**不再豁免**结构禁切条件；命中即拒切，报错让用户核对设计稿（是设计师打错前缀，应改前缀 / 拆分节点；不是 agent 优化空间）。

**违反后果**：doctor SUB029（v0.3.9 新增，error）—— sub-agent / 主 agent 对命中结构禁切条件的节点调用 `figma.mjs export-image` 整体切图，见 pp-doctor §3.6r。

**典型案例**（对照历史事故）：

```
Frame 734 (136:45662, 无前缀, FRAME, VERTICAL layoutMode)
  ├── bg (GROUP)                          ← 装饰背景
  ├── img-biaoti                          ← 标题图
  ├── Group 9                             ← 任务行容器
  │   ├── Frame 727 (任务 1: bg + icon + 标题TEXT + 描述TEXT + btn "去看看")
  │   ├── Frame 728 (任务 2: 结构同上, btn "去购票")
  │   ├── Frame 731 (任务 3: 结构同上, btn "去购票")
  │   └── 编组 10   (任务 4: 独立结构, btn "去邀请")
  └── TEXT "活动时间：2026/6/1~2026/8"

子树信号扫描：
  - 可见 TEXT 数：≥8（每行任务有标题+描述+按钮文字，加底部时间行）→ 命中「多文本禁切」
  - btn- / 交互按钮数：4（"去看看"/"去购票"×2/"去邀请"）→ 命中「多按钮禁切」
  - 同构子节点：3 个 Frame 727/728/731（bbox 相近、结构相同）→ 命中「同构列表禁切」

→ 三项全部命中 → 永远禁止整体切图 → 必须递归子层 → sub-agent 应逐层生成 <div> + 3 个 map <div> + 4 个 <button>
```

**反向自检**（sub-agent 决定"整体切图"前，除 §4.4 5 行自检外，额外必须扫描子树输出 2 行）：

```
· 子树可拆分子节点数：{可见 TEXT 数 x / btn 数 y / 同层同构组数 z}
· 结构维度禁切判定：{通过：均低于阈值 / 命中禁切: 具体条件（多文本 x≥2, 多按钮 y≥2, 同构 z≥3 任一）}
```

任一命中 → 立即停下重做，回归 §4.3 递归子层解析。

> **⚠️ 同构列表必须 `.map()` 数据驱动（v0.3.16 强制）**：命中「同构列表禁切」（≥3 同层同构子节点）时，产物**必须**用数据数组 + `.map()` 渲染，**禁止**手动展开 N 个 JSX 块。手动展开虽然产物"看起来一样"，但业务上等价于"把数据硬编码进 JSX"——数据变更、接口对接、A/B 实验都需要重新改 skill。
>
> **正确形式**：
>
> ```jsx
> // blocks/sub-ui/index.jsx
> const QUAN_LIST = [
>   { id: 1, amount: 'A1',  unit: 'U1', tag: 'T1', tagBg: 't1.png', btnText: 'B1', btnState: 'available' },
>   { id: 2, amount: 'A2',  unit: 'U2', tag: 'T2', tagBg: 't2.png', btnText: 'B2', btnState: 'used' },
>   // ... 6 条数据
> ];
>
> export default function FuliQuan() {
>   return (
>     <div className="<container>__list" data-node-id="{container nodeId}">
>       {QUAN_LIST.map(item => (
>         <div key={item.id} className="<container>__card" data-node-id-list={item.id}>
>           <span className="<container>__amount">{item.amount}</span>
>           <span className="<container>__unit">{item.unit}</span>
>           <img className="<container>__tag" src={`${ASSET_PREFIX}${item.tagBg}`} alt={item.tag} />
>           <span className="<container>__tag-text">{item.tag}</span>
>           <button className={`<container>__btn <container>__btn--${item.btnState}`}>
>             {item.btnText}
>           </button>
>         </div>
>       ))}
>     </div>
>   );
> }
> ```
>
> **禁止的错法**：
>
> ```jsx
> ❌ // 错法 1: 手动展开 N 次 JSX (等价于把数据硬编码)
> <div className="<container>-1">...</div>
> <div className="<container>-2">...</div>
> ...
> <div className="<container>-N">...</div>
>
> ❌ // 错法 2: 整体切图为 <container>-1..N.png
> <img src="<container>-1.png" />
> <img src="<container>-2.png" />
> ...
> ```
>
> **数据数组抽取原则**：sub-agent 遍历同构节点，把**每个节点内部随位置变化的原子字段**（TEXT `characters` / img src / btn 文案 / 状态标记）抽成数据数组元素；**位置**和**结构**不变的部分（CSS class / DOM 树）留在 JSX 模板里。抽取后的 `.d2c-tasks.md` QA 段要追加一行：
>
> ```
> · 同构列表数据数组：{列表名} 共 {N} 项，字段：[<字段 1>, <字段 2>, ...]
> ```

##### 4.4.0 切图强制忠实执行（v0.3.6 新增）

**核心原则**：命中 `img-` / `bg-` / 裸词 `img` / 裸词 `bg` 时，必须调 `figma.mjs export-image`（走 REST API）产出图片；**不允许**"看到 assetsDir 里有同名文件就跳过"或"从其他来源复用"。这是防止"skill 假装切了图，其实用了缓存/上一轮产物/同名老图"这类忠实度事故的核心约束。

**流程（每张 img-/bg-/裸词 类图片必走）**：

1. **查 images.json**：读 `.d2c-cache/<fileKey>/images.json`，看当前 nodeId 是否已有记录：
   - **无记录** → 直接调 `figma.mjs export-image`，脚本会：(a) 调 REST API 拿临时 URL；(b) 下载到 `{projectRoot}/{assetsDir}/{filename}.{ext}`；(c) 算 md5；(d) 写回 `images.json`
   - **有记录** → 走下面 md5 校验分支

2. **md5 校验复用**（有记录时）：
   - 读磁盘文件算 md5
   - 与 `images.json` 里记录的 md5 对比：
     - **相等** → 复用（`reused=true`），不重切
     - **不等 / 文件不存在** → 视作缓存失效，**强制重切**（调 `figma.mjs export-image`，覆盖旧记录）

3. **images.json 写入契约**（每次成功切图后必写）：
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
   `bboxHash` 用于识别"同 nodeId 但导出参数变了"的情况（比如 scale 从 2 改到 3）；命中 hash 不同 → 也视作缓存失效强制重切。

4. **assets.txt 3 行溯源模板**（每张图切完必写）：
   ```
   - {filename}.{ext}                       ← {figmaNodeName} ({nodeId})
     · API 参数：ids={nodeId} format={png|svg} scale={2} use_absolute_bounds={true|false}
     · 返回 URL：{figma S3 临时 URL}
     · 落盘尺寸：{width}x{height} md5={md5}
   ```
   这 3 行在 flat 和 component 两种 merge.mode 下都**必须**出现，用户复现时能直接对比 md5 判定 skill 是否忠实执行了 API 调用。

**doctor IMG026（v0.3.6 新增）**：`img-` / `bg-` / 裸词 img/bg 命中，但 images.json 里对应 nodeId 缺失 → **error**（说明本次 skill 没走 REST 就落图，属于严重忠实度事故）。

**为什么加这一小节**：某历史事故中，某张 `<container>-<item>-<state>.png` 出现"顶部有大片空白"，追查 md5 发现磁盘产物和 API 实测导出根本对不上——skill 那一轮实际上没调 REST，而是从上一轮的另一张同类图直接改名复用了。此次修订的目的就是让"跳过 API 直接落图"不再可能。

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
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name>

# SVG（矢量图层优先）
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --format=svg

# 极少数场景:需要把 Figma effect 烤进位图(通常不用)
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --preserve-effect
```

stdout 返回 `{"ok":true,"data":{"path":"<绝对路径>","reused":<bool>,"format":"png|svg"}}`。`reused=true` 表示命中缓存跳过下载。

> **`use_absolute_bounds=true` 是默认开的**：
> - 默认导出会包含图层 effect（drop-shadow / outer-stroke / blur）的可见范围与父容器背景色，PNG 会比 bbox 大一圈并带画板底色 → 导致 `gap`/`margin` 算不准 + 图带背景色两个历史 bug。
> - 加此参数后，Figma 严格按节点 `absoluteBoundingBox` 导出，effect 和父背景被裁掉。**代价**：Figma effect 实现的阴影/光晕不会烤进 PNG——但这本来就是要的（应用 CSS `filter: drop-shadow()` 实现）。
> - 若某张图**就是要**把 effect 烤进位图（极少见），加 `--preserve-effect` 覆盖。也可在 config `images.preserveEffectIds` 数组里列出该 nodeId（LLM 端根据 config 决定是否加 flag）。

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ `--format=svg`
- 其他 → 默认 PNG 2 倍图

**前提**：项目根 `.env` 里 `FIGMA_TOKEN` 必须已配置（v1.0.2 起从 `pp-d2c.config.json` 迁到 `.env`）。**当 token 缺失或过期时（HTTP 403 / 401 / `invalid_token`）**，本 SKILL v0.3 起**不再有 MCP 兜底路径**——直接终止并要求用户补 token 后重跑。原因见下文 §4.4.1。

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

请检查项目根 `.env` 里的 `FIGMA_TOKEN`：
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

**§4.8 独立验收 checklist（v0.3.6 起必查）**：

- [ ] **NAM024 双写防护**：产物 JSX 里出现 `<img>` / `background-image: url(btn-*.png)` 的 `btn-` 节点，其 sibling / child 是否**同时存在**渲染同一段文字的 `<span>` / `<Text>`？如果是 → **error**（图带文字 + span 里又写一遍文字是设计事故；正确做法：走 §4.3 父容器盒级装饰兜底用 CSS 表达按钮背景，`<span>` 保留文字；或 `btn-` 内嵌 TEXT 加 `x-` 忽略）
- [ ] **NAM025 多层 fills 取末位**：产物里所有 TEXT 节点的字色，是否按 §4.1.1「TEXT 多层 fills 处理」取的末位可见 SOLID？（现场典型 bug：设计师叠了 `#492b0d` + `#ffffff`，取了 index 0 出 `#492b0d`）
- [ ] **父容器盒级装饰兜底覆盖率**：产物里所有 `btn-*` / 无前缀 FRAME 是否命中 §4.3「父容器盒级装饰兜底判定」时都走了 CSS？若产物中出现 `btn-*.png` 图片 → **必须**能在 assets.txt 追溯到该节点确实"fills 含 IMAGE 或子树含形状"（不满足则回滚到 CSS 表达）
- [ ] **IMG026 切图忠实性**：产物 `assets.txt` 里每张图是否都有 §4.4.0 定义的"3 行溯源"？images.json 里是否有对应 nodeId 的记录？md5 是否与磁盘文件一致？（漏任一 → error）
- [ ] **未主动问用户技术决策（v0.3.8 新增）**：sub-agent 本轮跑完是否**没有向用户提任何 skill 已定死的技术决策问题**（切图/兜底/合并/尺寸/命名冲突等，见「问题边界」章节）？若遇 skill 未覆盖的边界情形，是否已按最接近规则兜底 + 在 `assets.txt` QA 段落写「[需人工核对]」告警，而**不是**打断用户提问？
- [ ] **结构维度禁切核查（v0.3.9 新增）**：本 block 是否有任何节点被 sub-agent 决定"整体切图"？若有，其子树是否命中 §4.4.pre.b 任一禁切条件（≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点）？命中即视为 sub-agent 交付不合格，必须回滚该节点，改走 §4.3 递归子层解析。历史事故：`task-block.png` 就是 sub-UI sub-agent 把 Frame 734（含 3 行任务 + 独立按钮 + 独立文字，前缀"无"）当"无前缀非文本图层兜底整体切图"绕过 §4.4.pre 主表，v0.3.9 后此路径被 §4.4.pre.b 堵死

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

1. **禁止用父容器整体切图（如 `sub-ui-frame734.png` / `sub-{name}.png`）替代 sub-agent 的拆分产物**——sub-agent 已经把 3 行任务/独立按钮/独立文字拆开了，主 agent 不允许"合并阶段觉得复杂"就把这些拆分产物删掉换成一张父容器大图。历史事故：`<下游项目>/pages/Home/index.tsx` 里主 agent 用 `sub-ui-frame734.png` 覆盖 sub-UI 的 50 个 data-node-id 拆分产物，最终 "去看看"/"去购票" 匹配 0 次
2. **禁止在 sub-agent 落盘后再切父容器整体图**——主 agent 步骤 5 阶段不允许调 `figma.mjs export-image` 切任何 `sub-*` / `block-*` 前缀的父容器 nodeId（那属于 sub-agent 范畴，且违反节点整体切图适格性，见 §4.4 前置）
3. **禁止在 flat 展开时"简化"sub-agent 产物**——不允许把 sub-agent 产出的 `<button>` 结构折叠成 `<img>`，不允许把 `<div><span>去看看</span></button>` 折叠成 `<img src="btn-qukankan.png">`；即使二者视觉等价，也违反守恒律

**反向自检 4 行**（主 agent 每展开一个 sub-block 前必须输出）：

```
· 待展开 sub-name：{blocks/{sub}/index.tsx 路径}
· 已读取该文件？{是/否}（如否，立即读，禁止继续）
· 是否用父容器整体切图替代？{否 / 意图替代}（如"意图替代"，立即停下，回归 sub-agent 产物）
· sub-agent 已交付的 data-node-id 数：{N}（合并后必须 ≥ N，见 §5.1 data-node-id 守恒律）
```

任意一项答错即停下重做——这是"主 agent 绕过 sub-agent 产物"这类事故的唯一防线。

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

#### 5.1 data-node-id 守恒律（v0.3.7 新增，flat 模式必查，强制 grep 自证）

**核心公式**：设 sub-agent 全部产物的 `data-node-id` 集合为 S₁，主 agent 合并后最终产物的 `data-node-id` 集合为 S₂，**必须满足** `S₁ ⊆ S₂`（sub-agent 交付的每一个 nodeId 都必须出现在最终产物中；主 agent 可以新增 data-node-id，但不允许丢失任何一个 sub-agent 的 nodeId）。

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

**为什么这条规则存在**：`data-node-id` 是主 agent 与 sub-agent 之间的"忠实度锚点"。sub-agent 每处理一个图层节点，都会在生成的 JSX 上打 `data-node-id="{figma nodeId}"`。这个集合就是 sub-agent 对"我处理了哪些节点"的自证。主 agent 合并时如果把 sub-agent 的 `<button data-node-id="136:45727">去看看</button>` 替换成 `<img src="sub-ui-frame734.png">`，`136:45727` 这个 nodeId 就丢了，守恒律立即报错。

**doctor 关联规则**：SUB027（v0.3.7 新增，error）—— sub-agent 产物的 data-node-id 在最终产物中丢失时触发，参见 pp-doctor §3.6p。

**必须输出的证明块**（主 agent 步骤 7 交付前必写到对话，见 §6.0 强制自证输出）：

```
=== 合并阶段忠实度证明（data-node-id 守恒律）===
sub-agent 产物 nodeId 数：{count(S₁)}
最终产物 nodeId 数：{count(S₂)}
差集 S₁ - S₂：{空 / lost 列表}
结果：✅ 通过 / ❌ 失败
```

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
   node .claude/skills/pp-d2c/bin/figma.mjs screenshot <fileKey> <leafBlockNodeId> --tag=leaf --scale=2
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
10. **`input-` 前缀未生成 `<input>` 标签（v0.3.4 新增）**：图层名带 `input-` 的节点（不含 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加），产物 JSX 是否输出 `<input type="text" placeholder="..." />`？是否漏输出 `<div>` + `<span>` 结构而绕过 `input-` 语义？CSS 是否把左侧图标切图挂在 `background-image`（不生成独立 `<img>` 子节点）？`::placeholder` 颜色是否取自 TEXT 子节点的 `fills[0]`？反向查:图层里没有 `input-` 前缀却被误改成 `<input>` 标签也不合规。同时校验 doctor 侧 4 条 NAM 规则是否触发(NAM017 无 TEXT / NAM018 多 TEXT / NAM019 与 bg 系叠加 / NAM020 与 img/btn 叠加)。
11. **sub-/block- 容器 FIXED 高度未写 `min-height` 导致塌陷(v1.0.2 新增)**:图层名带 `sub-` / `block-` 前缀、Figma `layoutSizingVertical: FIXED`,且该容器内部有 `layoutPositioning: ABSOLUTE` + `width/height: 100%` 的兄弟子节点(典型:`&__main` 内含 `&__main-bg` 绝对铺满作背景层),产物 CSS 是否用了 `height: {N * scale}px` 死值?必须改成 `min-height: {N * scale}px`(见 §4.1.1 §A 表下方「FIXED 塌陷防御」补充说明)。理由:死高会让容器在内容异步渲染 / 数据少时收缩到 HUG 表现,`height: 100%` 兄弟层跟着塌成一条,底部露出根容器背景。反向查:叶子/装饰元素(`img-` / `bg-` / `btn-` 等)不应误用 `min-height`,那些场景仍写 `height`。
12. **冗余嵌套 autoLayout 的属性未下穿到内层(v1.0.2 新增)**:外层 A 是 autoLayout 且仅有 1 个顺流子 B(其他都是 abs 兄弟),B 也是 autoLayout,且 A/B 都不带 `sub-` 前缀 → 检查产物:A 的 CSS 里是否残留 `display: flex` / `padding-*` / `gap` / `justify-content` / `align-items` / `flex-wrap`?这些**必须**全部下穿到 B,A 只保留 `position / overflow / width / height / background / border-radius / box-shadow` 等骨架属性;A/B 同名冲突时以 B 为准,A 的值写入 §7 QA info。反向查:命中"A 或 B 带 sub- 前缀"时**不该**下穿(sub- 边界要保持样式命名空间独立),若被误下穿也算不合规。参考 §4.1.1 §A 表下方「冗余嵌套 autoLayout 的属性下穿」补充说明。

**任一项命中 → 该叶子 sub-agent 交付不合格,主 agent 必须回退该块重写**(不是自己改 scss 数值糊过去;这是结构性问题,改数值没用)。回退命令:把该叶子 nodeId 重新按 §4.0 派发一次 sub-agent,把本节 checklist 内容作为额外约束附加进去。

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

#### 6.0.1 assets.txt 消费契约（v0.3.7 新增，强制 grep 自证）

**核心公式**：设所有 `blocks/*/assets.txt` 声明切了的文件名集合为 F₁，最终产物（`.tsx`/`.jsx`/`.scss`/`.less`/`.css`/`.module.*`）中被引用的文件名集合为 F₂，**必须满足** `F₁ ⊆ F₂`（sub-agent 声明切了的每一张切图都必须在最终产物中被 `<img src>` / `background-image: url()` 引用；未引用即代表主 agent 用父容器整体切图或其他手段替代了 sub-agent 的产物）。

**grep 自证命令模板**（主 agent §6.1 前必须运行并把结果输出到对话）：

```bash
# 1. 从 assets.txt 提取 F₁（`- xxx.{png|svg|jpg|webp}` 开头的文件名）
grep -Eho '^- +[^ ]+\.(png|svg|jpg|jpeg|webp)' {output.dir}/blocks/**/assets.txt 2>/dev/null \
  | sed 's/^- *//' | sort -u > /tmp/declared-assets.txt

# 2. 从产物提取 F₂（<img src="..." /> + CSS url("...") + `${ASSET_PREFIX}xxx.png` 模板字面量）
grep -rEho '(src=[`"'\''][^`"'\'']*|url\([`"'\''"]?[^`"'\''")]*)' {output.dir}/ --include='*.tsx' --include='*.jsx' --include='*.scss' --include='*.less' --include='*.css' 2>/dev/null \
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

**doctor 关联规则**：IMG028（v0.3.7 新增，error）—— assets.txt 声明的切图文件在最终产物中未被引用，参见 pp-doctor §3.6q。

#### 6.0.2 合并忠实度证明块（v0.3.7 强制，主 agent 交付前必写）

主 agent 在步骤 7（输出交付物清单）**之前**必须在对话中输出以下证明块，作为"我的合并过程未绕过 sub-agent 产物"的自证；**未输出即视为交付不合格**，用户可要求回滚重做：

```markdown
=== 合并阶段忠实度证明 ===

## data-node-id 守恒律（§5.1）
- sub-agent 产物 nodeId 数：{count(S₁)}
- 最终产物 nodeId 数：{count(S₂)}
- 差集 S₁ - S₂：{"空" 或 "lost: id1, id2, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## assets.txt 消费契约（§6.0.1）
- sub-agent 声明切图数：{count(F₁)}
- 最终产物引用切图数：{count(F₂)}
- 差集 F₁ - F₂：{"空" 或 "unused: file1.png, file2.png, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## 节点整体切图适格性核查（§4.4.pre + §4.4.pre.b）
- 本轮切图节点是否包含 `sub-*` / `block-*` 前缀？{否 / 是: node list}（前缀维度）
- 本轮切图节点中，是否存在其 Figma 子树含 ≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点？{否 / 是: node list}（v0.3.9 结构维度）
- **主 agent 独立重算断言（v0.3.16 强制）**：主 agent 遍历每张切图（读 `assets.txt` 拿 nodeId）→ 从 `.d2c-cache/<fileKey>/nodes/<nodeId>.json` 读子树 → 独立算 `x=可见TEXT数 / y=btn数 / z=同构组数`，与 sub-agent 在 QA 段声明的 `x/y/z` 逐项对齐；不一致视为 sub-agent 撒谎，驳回该切图重做（禁止 sub-agent 写 `x=0 y=0 z=0` 蒙混过关）
- 结果：{✅ 通过 / ❌ 失败}

**主 agent 独立重算 grep 脚本**（v0.3.16）：

```bash
# 遍历所有切图节点,独立重算子树结构信号
python3 -c "
import json, glob, os, re
BAD = 0
# 从 assets.txt 提取所有已切图节点 id
switched_ids = set()
for f in glob.glob('{output.dir}/blocks/**/assets.txt', recursive=True):
    for line in open(f):
        m = re.search(r'\(nodeId:\s*([^,)]+)', line)
        if m: switched_ids.add(m.group(1).strip())

# 对每个已切图节点,从 d2c-cache 读子树 → 算 x/y/z
def scan_subtree(root):
    text_ys = []   # 可见 TEXT 的 y 坐标(去重同行)
    btn_count = 0
    children_groups = {}  # bbox 相近 + 同类型 → 同构组
    def walk(n):
        nonlocal btn_count
        vis = n.get('visible', True)
        if not vis: return
        typ = n.get('type','')
        name = n.get('name','')
        if typ == 'TEXT':
            y = n.get('absoluteBoundingBox',{}).get('y', 0)
            text_ys.append(y)
        if name.startswith('btn') or typ in ('INSTANCE','COMPONENT'):
            btn_count += 1
        for c in n.get('children',[]):
            walk(c)
    for c in root.get('children',[]):
        walk(c)
    # 同构:直接子层同 type + bbox w 相近 ±10%
    for c in root.get('children',[]):
        if not c.get('visible', True): continue
        typ = c.get('type','')
        w = c.get('absoluteBoundingBox',{}).get('width', 0)
        key = f'{typ}|{round(w/10)*10}'
        children_groups[key] = children_groups.get(key, 0) + 1
    # 去重同行 TEXT
    text_ys_dedup = []
    for y in sorted(text_ys):
        if not text_ys_dedup or abs(y - text_ys_dedup[-1]) >= 4:
            text_ys_dedup.append(y)
    homogeneous = max(children_groups.values(), default=0) if children_groups else 0
    return len(text_ys_dedup), btn_count, homogeneous

for nid in switched_ids:
    nid_file = nid.replace(':', '_')
    cache_files = glob.glob(f'.d2c-cache/**/nodes/{nid_file}.json', recursive=True)
    if not cache_files: continue
    d = json.load(open(cache_files[0]))
    root = d.get('node', d)
    x, y, z = scan_subtree(root)
    if x >= 2 or y >= 2 or z >= 3:
        print(f'❌ {nid} 被切图但子树命中禁切 x={x} y={y} z={z}(违反 §4.4.pre.b + v0.3.16 无前缀豁免)')
        BAD += 1

print(f'::总计违反 = {BAD} ::')
"
```

## 未打断用户核查（v0.3.8 新增，§问题边界）
- 本轮 agent 是否向用户提过任何 skill 已定死的技术决策问题？（切图/兜底/合并/尺寸/命名冲突等）{否 / 是: 问题清单}
- 若遇 skill 未覆盖的边界情形，是否已按最接近规则兜底 + 写 QA 告警而非打断用户？{是 / 否: 说明}
- 结果：{✅ 通过 / ❌ 失败}

## 字色 fills 溯源（v0.3.10 新增，§4.1.1）
- 所有 TEXT 溯源行的 `最终写入=#hex` 集合大小：{count(declared)}
- 产物中 `color: #hex` 集合大小：{count(used)}
- 差集 declared - used：{"空" 或 "lost: #hex1, ..."}（非空 = 声明取末位但产物没写入，属幻觉字色事故）
- 结果：{✅ 通过 / ❌ 失败}

## sub 容器 min-height 尺寸源（v0.3.10 新增，§4.3）
- 逐 sub-/block- 容器 `min-height 写入 == 自身h × scale` 断言错项数：{count(errors)}
- 错项列表（若非零）：{"[节点名] 应写 XXXpx 实写 YYYpx（把兄弟 bg 层高度错写为 min-height）"}
- 结果：{✅ 通过 / ❌ 失败}

## 页面根 padding-top 尺寸源（v0.3.10 新增，§4.3.1）
- 逐页面 `padding-top 写入 == figmaPaddingTop × scale` 断言错项数：{count(errors)}
- 错项列表（若非零）：{"[页面名] 应写 XXXpx 实写 YYYpx（把 fixed 状态栏高度错写为 padding-top）"}
- 结果：{✅ 通过 / ❌ 失败}

## bg- 独立切图契约（v0.3.11 新增，§4.3）
- 子树内所有 `bg-*` / 裸词 `bg` 前缀节点集合大小：{count(bg-nodes)}
- assets.txt 声明的 `bg-*` 切图集合大小：{count(bg-declared)}
- 差集 bg-nodes - bg-declared（应切图但没切）：{"空" 或 "missing: bg-<X1>, bg-<X2>, ..."}（非空 = sub-agent 因祖先覆盖脑补省略事故，触发 BGP033）
- 结果：{✅ 通过 / ❌ 失败}
```

任意一条 ❌ 失败 → 合并阶段不算完成，主 agent 必须回滚，重新按 sub-agent 产物逐字展开，禁止用父容器整体切图替代。

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

写入内容:

```json
{
  "figmaUrl": "<步骤 -1 用户传入的 figma URL 原文>",
  "fileKey": "<步骤 0.3 解析出的 fileKey>",
  "rootNodeId": "<步骤 -1 用户传入的 nodeId,注意冒号形式 138:1797>",
  "outputDir": "<步骤 5 实际写入的组件目录,如 pages/Italo>",
  "outputEntryFile": "<主入口文件,如 pages/Italo/index.jsx>",
  "figmaTreeHash": "<步骤 4.1.1 拉取的子树子树 fingerprint;主 agent 用 shasum -a 1 就 REST JSON 求 hash>",
  "generatedAt": "<ISO8601,如 2026-08-05T10:23:44Z>",
  "framework": "<config.project.framework>",
  "styleFormat": "<config.project.styleFormat>"
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

### 步骤 7：输出交付物清单

```
✅ 生成文件：{output.dir}/ComponentName/
📦 需下载图片：（汇总 assets.txt，含原始临时链接）
⚠️  需手动处理：（QA 发现的不可自动修正差异）
🧹 上线前清理：产物已注入 `data-node-id="..."` 调试锚点（用于反查 Figma 节点、方便 review 逐 block 对比），
   上线前请运行 `pp-strip-nodeid` skill 一键清理，或直接执行：
     node .claude/skills/pp-strip-nodeid/strip-node-id.mjs --dry-run   # 先预览
     node .claude/skills/pp-strip-nodeid/strip-node-id.mjs             # 确认后清理
🗑️  临时截图目录：{projectRoot}/.d2c-tmp/screenshots/ 已自动清理（QA 阶段的对比截图，跨会话不保留）
💾 缓存目录：{projectRoot}/.d2c-cache/{fileKey}/ 保留（下次跑同一 fileKey 会自动比对 lastModified 决定复用或作废）
```

**SKILL 结束时的清理动作**：

1. `node .claude/skills/pp-d2c/bin/figma.mjs cleanup-tmp`（脚本会 `rm -rf` 掉 `{projectRoot}/.d2c-tmp/screenshots/`）
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
- 禁止 `FIGMA_TOKEN` 无效时直接跳过图片下载或用 Figma S3 临时链接占位（约 30 分钟过期，代码上线就 404）；v0.3 起 token 失败即终止，由用户补 token 后重跑，不再有 MCP 兜底路径
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具（v0.3 起本 SKILL 全流程走 Figma REST API，不再依赖 MCP）；禁止把 MCP `get_design_context` 返回的"参考代码"字段作为渲染依据——项目前缀规则（§4.0 / §4.3）的优先级永远高于任何"AI 生成的通用 D2C 参考代码"
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
- 禁止 TEXT 节点有多层可见 SOLID fills 时直接取 `fills[0]`：必须按 §4.1.1「TEXT 多层 fills 处理」按 Figma 渲染顺序取末位可见 SOLID。历史 bug：`去看看` fills=[#492b0d, #ffffff] 被取成 #492b0d，与设计稿视觉不符
- 禁止父容器命中「父容器盒级装饰兜底」（§4.3）时仍要求设计师额外建 `bg-*` 子层：默认打开，两种命名都合法，冗余场景由 doctor NAM024 warn（不阻断）
- 禁止 `btn-` 节点必须切图（fills 含 IMAGE / 子树含形状）时，内部 TEXT 仍生成 `<span>` / `<Text>` 并写入相同文字：这会造成"图片里有字 + 代码里 span 也有字"的双写事故（doctor NAM024 error）。此时内部 TEXT 视为图字副产物，默认按 `x-` 忽略
- 禁止 `img-` / `bg-` / 裸词 `img` / 裸词 `bg` 命中但跳过 REST API 调用：必须按 §4.4.0「切图强制忠实执行」流程走，即使 assetsDir 有同名文件也要按 images.json md5 校验决定复用还是重切。doctor IMG026 命中未记录 nodeId → error
- 禁止在 assets.txt 中省略 §4.4.0 定义的 3 行溯源（API 参数 / 返回 URL / 落盘尺寸+md5）：这是用户复现 skill 切图忠实度的唯一凭据
- 禁止 flat 模式合并时用父容器整体切图（如 `sub-{name}.png` / `sub-ui-frame734.png`）替代 sub-agent 的拆分产物：必须逐字读 `blocks/{sub}/index.tsx` 展开到父文件（v0.3.7 §5.0.pre）。历史事故：<下游项目> 主 agent 用 sub-ui-frame734.png 覆盖 sub-UI 的 50 个 data-node-id 拆分产物，"去看看"/"去购票"匹配 0 次
- 禁止对 `sub-*` / `block-*` 前缀节点调用 `figma.mjs export-image` 整体切图：这两个是分块边界，永远由 sub-agent 递归内部处理，主 agent 不允许把它们当图切（v0.3.7 §4.4.pre 适格性表）
- 禁止 flat 模式合并跳过「data-node-id 守恒律」的 grep 自证（v0.3.7 §5.1）：必须运行差集比对命令，把 `sub-agent 产物 nodeId 数 / 最终产物 nodeId 数 / 差集` 输出到对话；差集非空即合并失败，必须回滚
- 禁止跳过「assets.txt 消费契约」的 grep 自证（v0.3.7 §6.0.1）：必须运行差集比对命令，把 `声明切图数 / 引用切图数 / 未引用列表` 输出到对话；未引用即代表主 agent 替代了 sub-agent 产物，触发 SUB027 / IMG028
- 禁止跳过步骤 7 之前的「合并忠实度证明块」输出（v0.3.7 §6.0.2）：主 agent 必须在对话里写"data-node-id 守恒律 / assets.txt 消费契约 / 节点整体切图适格性"三组结果；未输出即视为交付不合格
- 禁止向用户提 skill 已定死的技术决策问题（v0.3.8 §问题边界）：包括但不限于"要不要整体切图 / 用不用 CSS 表达 / 多层 fills 取哪个 / 尺寸要不要换算 / 合并这块用什么方式"等。遇 skill 未覆盖的边界情形，必须按最接近规则兜底 + 写 QA 告警，禁止打断用户；仅在产物完全不可用（token 缺失 / Figma 稿无法访问 / 关键 assets 下载失败超重试次数 / config 语法错误）时才允许问用户
- 禁止对子树含 ≥2 可见 TEXT / ≥2 btn / ≥3 同构子节点的容器整体切图（v0.3.9 §4.4.pre.b 结构维度禁切）——即使该节点前缀不是 `sub-*` / `block-*`（例如无前缀 FRAME/GROUP，或名字叫 `Frame 734` 这类没打前缀但结构上就是内部分块的容器）。sub-agent 每次切图前必须完成 §4.4 前置自检 7 行的最后 2 行子树扫描；命中即立即停下重做，走 §4.3 递归子层解析。历史事故 `task-block.png` 就是走"无前缀非文本图层兜底整体切图"路径把 Frame 734（含 3 行任务 + 独立按钮 + 独立文字）烤成大图，v0.3.9 后此路径被结构维度堵死
- 禁止 TEXT 节点交付时省略字色 fills 溯源（v0.3.10 §4.1.1）：sub-agent 每个 TEXT 必须在 `blocks/{sub}/assets.txt` QA 段写一行 `· TEXT {nodeId} "..." fills层数=N 可见SOLID列表=[...] 末位可见色=#hexN 最终写入=#final`，且 `#final` 必须严格等于 `#hexN`；产物中 `color: #x` 集合必须包含 declared 集合的每一项。历史事故：Frame745「立即抢」写 `#ffffff`（fills 末位 `#864500`）、`.quan__card-btn-text` 写 `#492b0d`（fills 里根本无此色，幻觉字色）—— doctor CLR030 error
- 禁止 sub-/block- 容器 min-height 写入值 = 兄弟 bg 层高度而非自身高度（v0.3.10 §4.3）：sub-agent 每个 sub-/block- 容器必须在 assets.txt QA 段写一行 `· SUB容器 {nodeId} name=... 自身h=H1 bg兄弟层h=H2 min-height写入=H1×scale`，且写入值必须严格等于 `H1 × scale`。历史事故：`.main { min-height: 1125px }` = bg-main 兄弟层 562.5×2（错），应取 sub-MAIN 自身 h=520 → 1040px —— doctor DIM031 error
- 禁止页面根 padding-top 写入值 ≠ `figmaNode.paddingTop × scale`（v0.3.10 §4.3.1）：主 agent 必须在主页面产物同级 assets.txt（或对话）中输出一行 `· PAGE根 {pageNodeId} name=... figmaPaddingTop=P fixed状态栏h=S padding-top写入=P×scale`，禁止用 fixed 状态栏高度替代 `paddingTop` 字段。历史事故：`.baseBackground { padding-top: 236px }` = fixed 状态栏 118×2（错），应取 paddingTop=166 → 332px —— doctor DIM032 error
- 禁止在"新 page 空档"情形（output.dir 无同名入口、也无相邻 page 参考）脑补样式大类（v0.3.10 §2.5.2）：必须以 config `project.styleFormat` 为唯一权威（plain scss/less/css → P 大类裸类名；scss-modules 等 → M 大类 styles.x）。历史事故：<下游项目> 明确配 `"styleFormat":"scss"` 却生成 `styles.module.scss` + `className={styles.container}`（M 大类），既违反 config 也让下游手工整改
- 禁止用祖先 `bg-*` 切图的物理覆盖范围"合并省略"后代 `bg-*` 独立切图（v0.3.11 §4.3 bg- 独立切图契约）：每个 `bg-*` 前缀节点必须独立走一次 `figma.mjs export-image`，前缀维度优先于物理覆盖维度。sub-agent 交付前必须在 `blocks/{sub}/assets.txt` QA 段追加「bg-* 独立切图清单证明」段，列出子树所有 bg-* 节点 + 各自切图文件名；主 agent 合并前 grep 断言子树 bg-* 集合 = assets.txt bg 切图集合。历史事故：sub-agent 因父 `bg-<A>` 整体切图物理覆盖多个同级容器区域，就省略了每个容器里 `bg-<B>` 独立切图，产物对应容器空 View —— doctor BGP033 error
