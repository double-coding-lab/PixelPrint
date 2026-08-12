---
name: pp-d2c-fast
description: pp-d2c 快速模式，根据 Figma 设计稿 URL 生成 React H5 页面代码与资源；触发：pp-d2c-fast、快速还原、D2C 快速模式
---

# pp-d2c-fast Skill（pp-d2c 快速模式）

> **pp-d2c-fast**：基于 pp-d2c v1.2.1 精简——砍除已被 `check-rules.mjs` 逐节点对账覆盖的自证块（A 梯队：字色溯源 / padding-top / data-node-id 守恒 grep / 四条硬规则 grep 5 条 / rule-hits 消费证明），保留全部决策引导（§4.3 裁决树 / 坐标公式 / §5.1.1 data-node-id 铁律）与 R04 GRADIENT 自证（R04 不在 check-rules）。硬防线 check-rules R01–R21、`bin/`、`rules/` 与 pp-d2c **完全一致**；**原 pp-d2c 保留完整防线，二者并存**。
>
> **当前版本**：v1.2.1(h5 独享,不同步 pp-d2c-rn) —— 校验范式从「黑名单抽查」升级为「以 cache 为真值的逐节点对账」,并借机简化防线。**v1.2.1 补丁**:(a) `_inBakedSubtree` 移除 bgc-(bgc- 盒级 CSS 写父、非切图,子孙误放 TEXT 应被 R06/R21 暴露而非静默吞);(b) 新增 **R21 node-id-coverage** 把 §5.1.1 data-node-id 铁律机械强制(应渲染节点漏挂 id 即 exit 1,堵 R18/R19/R20 遇空 classMap 静默 continue);(c) §6.0.2 禁生成流程用 `--force-skip`。v1.2.0 核心变更:(1) `bin/lib/loadCache.mjs` 为每节点标注 **`_inBakedSubtree`**(祖先含 bg-/bgc-/img-/x- 整体切图)/**`_hidden`**(自身或祖先 visible=false)/**`_templateDup`**(`.map()` 列表同构兄弟的非首个数据副本);R02/R06 跳过这三类,**假阳性从根源清除**(test13 实测 89→14);(2) 抽 **`bin/lib/cssMatch.mjs`** 共享 SCSS `&__foo`/`&-foo` 嵌套匹配,R01/R02/R06/R18/R19 统一走,修掉"产物用嵌套写法、正则找平铺类"的全线盲区;(3) 新增 4 条对账规则——**R17 no-baked-dom**(baked 子孙禁止再出 DOM,拦双重渲染)/**R18 flex-direction**(layoutMode↔flex-direction 忠实度)/**R19 padding**(padding↔Figma×scale 忠实度)/**R20 absolute-position**(ABSOLUTE 子节点 top/left=(子bbox−父bbox)×scale 忠实度);(4) §6.0.2 **封逃逸口**:禁"语义盲点/装饰性内容/父层整体切图承载"批量豁免话术,"需人工核对"不再适用于可机械计算的坐标/尺寸/方向/间距;(5) §5.1.1 **data-node-id 全覆盖铁律**:凡承载 Figma 语义的 DOM 必挂 node-id,`.map()` 模板挂代表项(variant a)id;(6) §4.3 新增**「含 TEXT 容器 压平 vs 拆」唯一裁决树** + **bg- 背景直接挂父 vs 独立层**判定。硬规则详情迁到 `rules/*.md`,SKILL.md 保留总概表。核心哲学: **允许兜底的路径就是错误来源;校验以 cache 为唯一真值逐节点对账,而非抽查已知坏味道。**
>
> **v1.1.0 历史**:R16 no-flatten-text 硬防线 + §6.0.2 兜底门禁 N=0 + Step 0.5 询问输出路径 + Step 2.6 前置切图 + bg 溢出检测 + §2.5.2 config.styleFormat 唯一权威 + R01 SCSS 嵌套匹配。详见 `git log`。
>
> 历史 changelog 查 `git log templates/skills/pp-d2c/SKILL.md`,不在本文件维护。所有规则以下文章节 + `rules/*.md` 为准;冲突时以 `rules/` 为准。

## 触发条件
- 用户提供 Figma 设计稿 URL
- 用户说「帮我还原这个设计稿」「D2C」「生成代码」

---

## 执行模型说明（先于一切，避免误读）

**SKILL.md 是给 LLM 读的自然语言操作手册，不是可执行代码。**

下文出现的 `派发新 sub-agent`、`sub-agent 上报` 等表述都是**伪代码 / 隐喻**，不是真函数调用、不是真多进程通信。**全程只有当前这一个 LLM agent**（即此对话里的 Claude）按 SKILL 步骤顺序执行：

| 文档表述 | 实际操作 |
|---------|---------|
| "派发新 sub-agent 处理 sub-X" | 当前 agent 重新进入 §4.0 流程，把根节点重置为 sub-X 的 nodeId、depth +1，重走一遍 |
| "sub-agent 上报 subslots.json" | 当前 agent 把 JSON 内容写到磁盘文件，下一轮处理时自己读 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**，要字面写进 JSX 文件作占位符 |
| `subslots.json` 文件 | **真实磁盘文件**，与 `assets.txt` 同级写入 block 目录 |

**唯一真正"被执行"的事情有两类**：（1）调用 Figma REST API（通过 Bash 执行 curl）读取节点属性 / 导出图片 / 截图，以及本地文件读写；（2）在对话里产出文本（包括代码、JSON、报告、决策）。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

> **本 SKILL 完全走 Figma REST API,不使用任何 `mcp__plugin_figma_figma__*` 工具**。REST 只返回原始节点 JSON,前缀规则永远优先。

> 误把伪代码当真函数会卡死流程（等待一个永远不会到来的"返回值"），或者绕过关键步骤。

## 问题边界

agent 在跑 pp-d2c 全流程时 **只允许问用户业务问题,禁止问 skill 已定死的技术决策问题**。

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
| **前缀语义** | "`btn-` 要不要切图？" → §4.3 切图四条硬规则已定；"`bg-` 切自身还是父容器？" → §4.3 已定 |
| **兜底判定** | "这个纯色父容器要 CSS 还是切图？" → §4.3 切图四条硬规则第 4 条(其他一切走 CSS);"多层 fills 取哪个？" → §4.1.1 TEXT 多层 fills 处理已定取末位 |
| **合并策略** | "flat 合并展开还是简化？" → §5.0.pre 禁"简化" sub-agent 产物 |
| **尺寸单位** | "这个 500px 要不要换算？" → §4.5 单位换算 + `unit.scale` 已定 |
| **命名冲突** | "类名重了怎么办？" → §5 flat 模式已定"加 block 前缀" |
| **切图忠实度** | "同名文件已存在，要复用还是重切？" → §4.4.0 md5 校验复用契约已定 |

判定要点：**skill 章节里已经写明"怎么做"** → agent 必须按规则做，不允许问。

### 遇到 skill 未覆盖的边界情形怎么办（**不打断用户**）

按下面顺序**自主处理**：

1. **先按 skill 最接近的规则兜底**——例如遇到未见过的前缀 → 走"无前缀兜底"(TEXT → 文字节点 / 其他 → CSS 化)
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

### 用户口头"临时"的作用域（v1.1.0）

用户在 CLI 或对话中说"临时的" / "临时占位" / "临时覆写" / "临时放这里" 时，**语义严格限于路径命名**（`output.dir` 子目录 / `images.assetsDir` 子目录 / 输出文件名），**不影响**任何硬规则:

| 是 | 否 |
|---|---|
| "临时"可覆盖 `output.dir` 子目录 (放到 `pages/test-tmp/`) | "临时"**不**可豁免 R01/R02/R05/R06/R08/R16 任一硬规则 |
| "临时"可覆盖 `images.assetsDir` 子目录 (放到 `static/test-tmp/`) | "临时"**不**可豁免"整体切图禁用" (R16) |
| "临时"可覆盖 config.styleFormat 之外的其它临时命名 | "临时"**不**可豁免 §6.0.2 兜底门禁 N=0 |
| | "临时"**不**可作为 assets.txt `[脚本误判]` / `[整体切图兜底]` 的豁免理由 |

**agent 侧执行原则**：
- 用户传"临时" → 只影响 Step 0.5 输出路径决策（见 §Step 0.5）；本轮生成的 jsx/scss 依然要满足全部硬规则、能通过 `check-rules.mjs` exit 0
- 禁止在 assets.txt 用"用户明确临时"当豁免签
- 用户如需真正跳过某条规则（极少），必须**明说规则号**（如"跳过 R05"），否则一律不豁免

## 执行流程

### 步骤 -1（前置预检）：检测 Figma Token 可用性

在任何操作前执行，不可跳过。

**做法**：调用脚本探针（脚本会自动 Read config、发 `/v1/me`、按状态码判定）：

```bash
node .claude/skills/pp-d2c-fast/bin/figma.mjs verify-token
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

> 本 SKILL 已完全移除 MCP 依赖，所有 Figma 数据读取都走 `figma.mjs` 脚本（内部调 REST API）。不再需要在 Claude Code 里装 Figma 插件或走 OAuth。

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
| `output.dir` | 代码输出根目录 |

> **图层前缀是内置常量,不可配置**:`sub-` / `block-` / `img-` / `bg-` / `bgc-` / `btn-` / `scrollx-` / `scrolly-` / `fixed-` / `end-` / `input-` / `x-` 由 skill 硬编码,pp-d2c.config.json 里**不再**有 `layers` 段。详见 `rules/README.md` 内置前缀常量表。

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
- **v1.1.0 起**：不再"以当前 page 的实际 import 形式为准"；一律以 `config.styleFormat` 为唯一权威，见 §2.5.2

---

### 步骤 0.5：询问输出路径（v1.1.0）

在读完 config、开始扫图层前,主 agent **必须**先问用户本次的输出路径:

```
配置根：<projectRoot>
config.output.dir       = <output.dir 原值>
config.images.assetsDir = <images.assetsDir 原值>

请指定本次生成路径:
  1) 代码放到 <output.dir> 下哪个子目录? (默认 <default-slug>)
  2) 图片放到 <images.assetsDir> 下哪个子目录? (默认 <default-slug>)

直接回车 = 用默认值; 也可 "同 1" 让图片子目录与代码子目录一致。
```

**默认 slug 生成规则**（按优先级尝试，第一次成功即用）:

1. Figma 稿子的 **frame name** slug 化,通过内置脚本:
   ```bash
   node .claude/skills/pp-d2c-fast/bin/slugify.mjs "<frame-name>" --fallback "<nodeId>"
   ```
   - ASCII 输入 → 保留 `[a-z0-9-]`, 其余替换为 `-`, 首尾去 `-`, lowercase, 连续 `-` 压成一个
   - 中文 → 内置常用字 pinyin 表转换（覆盖 Figma 常见图层高频词, 未覆盖字直接丢弃）
   - 转完 slug 空 or 仅含 `-` → 用规则 2 兜底
2. `page-<nodeId-safe>` 兜底（`nodeId` 里 `:` 换 `_`;例 `211:31` → `page-211_31`）

**用户回答后的处理**:

- 用户显式指定 → 采用用户值,写入 `.d2c-tasks.md` "输出路径锁定"段
- 用户回车 / 只答一个 → 未答项用默认 slug
- 用户答 "同 1" (代码与图片同 slug) → 两者取同一值

**`.d2c-tasks.md` 输出路径锁定段**（写在"大类锁定"段之前）:

```markdown
## 输出路径锁定（本次生成不可变）

- projectRoot: <绝对路径>
- 代码路径: <output.dir>/<code-slug>/         (例: pages/test-tmp/)
- 图片路径: <images.assetsDir>/<asset-slug>/  (例: static/test-tmp/)
- slug 来源: {frame-name-slug / page-nodeId / user-explicit / same-as-code}
- 用户"临时"标记: {true / false}   ← 仅影响本段路径命名, 不豁免任何硬规则(见 §问题边界)
```

**跳过询问的条件**（旧兼容）:

- 用户 CLI 一次性给出明确路径（如 `--out pages/test13 --assets static/test13`）→ 跳过询问,直接锁定
- 用户前一句消息里已明确路径（如"放到 test12"）→ 跳过询问,直接锁定

**禁止项**:

- 禁止在未写入"输出路径锁定"段前进入步骤 1 扫图层
- 禁止 sub-agent 修改锁定值
- 禁止把用户"临时"标记扩用为豁免硬规则的理由（见 §问题边界 "用户口头临时" 的作用域）

---

### 步骤 0.3：初始化缓存

**目的**：把 Figma REST API 拿到的节点属性 / 图片文件缓存到本地，避免同一稿子每次跑 SKILL 都重拉。

**做法**：主 agent 在解析 URL（步骤 1）拿到 `fileKey` 后，立即调：

```bash
node .claude/skills/pp-d2c-fast/bin/figma.mjs cache-check <fileKey>
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

### 步骤 1：解析 Figma URL

从用户输入提取：
- `fileKey`：URL 中 `/design/` 后的路径段
- `nodeId`：`node-id=` 参数值，将 `-` 替换为 `:`

---

### 步骤 2：扫描图层结构，生成执行清单

**拉节点树**：

```bash
node .claude/skills/pp-d2c-fast/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=2
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

1. **判定该 page 的样式大类(v1.1.0 起：config `project.styleFormat` 唯一权威)**：
   - 结论直接查 config `project.styleFormat`,按下方"styleFormat → 大类映射表"落 P / M / J
   - **邻居 page 的写法只作参考,不作判据**：即使 `output.dir` 下其他 page 用 `.module.scss`,新 page 也**必须**按 config 生成 P/M/J,不再"跟邻居走"
   - **既有目标 page 已有 import 实证与 config 冲突时**：以 config 为准,**主 agent 停下问用户是否要覆盖旧写法**;不允许 sub-agent 私自沿用旧邻居
   - **结论三选一：`P` (plain stylesheet) / `M` (css-modules) / `J` (inline / tailwind / RN)**（预处理语法用什么不影响这个结论）
   > ⚠️ **关键**：`:global(body)` 语法**只在 css-modules 下有效**。在普通 stylesheet（无论 scss/less/css）里写 `:global(...)`，浏览器会原样接收选择器并解析失败，**body 背景不会生效**——这是 D2C 最常见的"我明明写了 body 背景但页面还是白底"的根因。

   **styleFormat → 大类映射表**：

   | config `styleFormat` | 大类 | 生成文件后缀 | className 写法 | 顶部 import |
   |---|---|---|---|---|
   | `scss` / `less` / `css`（**plain**） | **P** | `index.scss` / `.less` / `.css` | `className="card"`（**裸类名**） | `import './index.scss'` |
   | `scss-modules` / `less-modules` / `css-modules`（**M**） | **M** | `index.module.scss` / `.module.less` / `.module.css` | `className={styles.card}` | `import styles from './index.module.scss'` |
   | `stylesheet` / `styled-components` / `nativewind`（RN） | **J** | 见 pp-d2c-rn | 见 pp-d2c-rn | 见 pp-d2c-rn |
   | `tailwind` / `inline` | **J** | 无独立样式文件（内联） | class 是 tailwind atomic / style 对象 | 无 |

   > **v1.1.0 变更说明**：v1.0.0 及以前的"既有 import 实证 > 邻居 page 参考 > config.styleFormat"三级判定链已废除,合并为单一权威 `config.project.styleFormat`。原因: v1.0.0 test10-12 事故中,agent 因参照旧 module 邻居而把 config `scss` 生成成了 `.module.scss`,用户改 config 无法生效。

2. **检查 `output.dir` 同级（或父级 1-2 层内）有几个 page 入口**：
   - `pages/` 下多个 `*.jsx` / `*.tsx`（Next.js / nfes 多页面） → 多页
   - react-router / SPA 多 route → 多页
   - 只有一个入口 → 单页

3. **检查全局样式入口是否已有 `body { background }` 规则**：
   - 候选文件：`pages/style/base.scss`、`src/styles/global.scss`、`pages/style/base.less`、`app.css`、`_app.js` 引入的全局样式入口
   - 用 grep 实证（**禁止猜**）

把以上 3 项探测结果**全部**写入 `.d2c-tasks.md` 的"页面级背景"段，作为选档的事实依据。

> **⚠️ 大类一致性硬约束**：主 agent 完成 §2.5.2 判定后，**必须在 `.d2c-tasks.md` 顶部写入"大类锁定"段**（一次生成一次锁定，不允许中途改）：
>
> ```markdown
> ## 大类锁定（本次生成不可变）
> - 判定源：config.project.styleFormat = "<原始值>" → 大类 P/M/J
> - 大类：**P** / **M** / **J**（三选一）
> - 生成规则：
>   - **P**：所有样式文件后缀 `.scss` / `.less` / `.css`（无 `.module`），`className="xxx"` 裸类名，`import './xxx.scss'`
>   - **M**：所有样式文件后缀 `.module.scss` / `.module.less` / `.module.css`，`className={styles.xxx}` 或 `className={styles["xxx"]}`，`import styles from './xxx.module.scss'`
>   - **J**：tailwind / inline / styled-components，不生成独立样式文件
> ```
>
> **sub-agent 生成 block 时**:**必须先 Read `.d2c-tasks.md` 的"大类锁定"段**,严格按锁定值生成 block 内部样式文件(`blocks/*/index.{scss,module.scss,...}`) + `className` 写法,**禁止**每个 block 独立再走一次判定(sub-agent 之间的判断可能飘)。
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

### 步骤 2.6：前置切图（v1.1.0，正式进入 D2C 前必做）

**执行时序**: 步骤 2 扫描 + 步骤 2.5 页面级背景 + 步骤 0.5 输出路径锁定完成后, 步骤 3 分发 sub-agent 前。

**目的**: 一次性把稿子里所有 `img-` / `bg-` 前缀节点切完落盘, 生成 nodeId → filename 清单; sub-agent 生 jsx/scss 时**只消费清单**, 不再自己调 Figma API 现切现挂。

**动作**:

```bash
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs \
  --theme <slug>=<figma-url> \
  --out-manifest <projectRoot>/.d2c-cache/<fileKey>/slice-manifest-<slug>.json
```

- `<slug>` = 步骤 0.5 锁定的 `<asset-slug>`
- `<figma-url>` = 步骤 1 解析出来的原 URL(带 nodeId)
- reskin standalone 模式自扫 `img` / `bg` 前缀节点(含裸词), 落图到 `<images.assetsDir>/<asset-slug>/`
- **清单 schema**(见 `slice-manifest-*.json`):
  ```json
  {
    "generatedAt": "2026-08-11 17:00:00",
    "mode": "standalone",
    "themes": [{
      "slug": "test13",
      "outDir": "static/test13",
      "hit": 21, "miss": 0,
      "entries": [
        { "nodeId": "211:37", "name": "bg-body", "parentName": "完整版11",
          "filename": "bg-body.png", "filepath": "static/test13/bg-body.png",
          "renderWidth": 750, "renderHeight": 1050,
          "bboxWidth": 750, "bboxHeight": 1050,
          "sizeWarning": null }
      ]
    }]
  }
  ```

**bg 溢出告警检视（v1.1.0）**:

reskin 每切一张图会**自动**做尺寸断言:`png 实际尺寸 vs node.absoluteBoundingBox × scale` 相差 > 4px → 写入 `entries[i].sizeWarning`。**主 agent 收到清单后必须扫一遍所有 entries[].sizeWarning**:

- 有非 null 的告警 → **必须停下问用户**是否要拆解或让美术在 Figma 里加 mask 收紧 renderBounds; 禁止直接用溢出 png
- 典型征兆:`bg-*` 节点 png 宽高远大于自身 bbox → Figma 把父容器兄弟节点渲染进 png（如 test12 事故 coupon-big-bg.png 里烤进 "1折"/"亚洲火车立减"）
- Figma 侧修复选项:① 把 mask 拉大到包住 bg 自己;② 把兄弟节点移到 bg 外面,由代码单独渲染

**产物消费契约（Sub-Agent 侧）**:

- UI sub-agent 收到 `<blockDir>/rule-hits.json` 时, 同时收 `<projectRoot>/.d2c-cache/<fileKey>/slice-manifest-<slug>.json`
- 生成 jsx 时, 引用 `img-` / `bg-` 节点必须从清单 `entries` 查 `filename`:
  ```jsx
  {/* nodeId 211:37 → 查清单 entries → filename=bg-body.png */}
  <div className={...} style={{ backgroundImage: `url(${ASSET}bg-body.png)` }} />
  ```
- 清单里没有的 nodeId → **禁止 sub-agent 自补切图**, 必须在 `assets.txt` 写 `[清单缺失] nodeId=XXX name=XXX 需主 agent 补切`

**主 agent 补切回路（v1.1.0）**:

sub-agent 全部返回后, 主 agent 汇总所有 `blocks/*/assets.txt` 里的 `[清单缺失]` 条目:

1. 数量为 0 → 直接进入步骤 5 合并
2. 数量 > 0 → **主 agent 重跑一次** `reskin-slice.mjs` 只针对这些 nodeId 补切, 追加到同一清单文件, 然后让相关 sub-agent 用更新后的清单重生 jsx/scss
3. 重跑仍无法补上（Figma 返回 404 / renderBounds 空等硬错误）→ 停下问用户排查, 禁止走整体切图兜底

**禁止项**:

- 禁止跳过步骤 2.6 直接进入步骤 3（无清单 = UI sub-agent 只能猜切图, 大概率违规）
- 禁止 sub-agent 绕开清单直接调 `figma.mjs export-image` 或 `figma REST /v1/images`
- 禁止把清单里的 `filename` 或 `renderWidth/Height` 改写后再消费（改写 = 幻觉 = 事故源）
- 禁止 sub-agent 对含 TEXT 的 GROUP/FRAME 生成 `<img>` 兜底（R16 硬防线会拦，见 rules/R16-no-flatten-text.md）

---

### 步骤 3：并行分发 sub-agent

向每个 block 分发一个 sub-agent，**全部并行执行**。

每个 sub-agent 收到以下上下文：
- 目标 block 的 `fileKey` 和 `nodeId`
- 图层解析规则（完整规则见步骤 4）
- `agentIndex`
- config 快照：`framework`、`styleFormat`、`images`、`layers`、`output.dir`
- **** 对应 `blocks/{sub}/rule-hits.json` 路径(由步骤 3.5 生成)

---

### 步骤 3.5：Rule-Scan sub-agent 派发 

**目的**:让每个 UI sub-agent 干活前, 先由独立 **Rule-Scan sub-agent** 扫出本 block 命中的规则, 输出 `rule-hits.json` 作为作业指引。这是**软防线**——覆盖 R03/R04/R07/R09-R15 语义类规则(硬防线 R01/R02/R05/R06/R08 由 `bin/check-rules.mjs` 在步骤 4 尾兜底拦截)。

**执行时序**: 步骤 3 分块清单生成后、步骤 4 UI sub-agent 开工前。

**流程**:

1. **for each block in 执行清单(步骤 3 生成的分块列表)**:
   派发 **Rule-Scan sub-agent**, 输入:
   - block 的 nodeIds 分片(主 agent 步骤 2 生成)
   - `.d2c-cache/<fileKey>/nodes/<nodeId>.json` (相关分片)
   - **全部** `templates/skills/pp-d2c-fast/rules/*.md` (Read,15+1 个文件)
   - `pp-d2c.config.json.layers`(前缀配置)

2. **Rule-Scan sub-agent 职责边界(强制)**:
   - **只识别规则命中,不实现 UI**
   - 不写 JSX / SCSS
   - 不改 cache
   - 不派下级 sub-agent
   - 输出为 JSON,不带 markdown 代码块围栏,不加解释文字

3. **Rule-Scan sub-agent 输出**: 落盘 `blocks/{sub}/rule-hits.json`,schema:
   ```json
   {
     "block": "sub-MAIN",
     "cache_key": "s7ILyhLgFeLlgM66vQ1RXG",
     "generated_at": "2026-08-11T09:15:00Z",
     "generated_by": "rule-scan-subagent",
     "hits": [
       {
         "rule": "R01",
         "rule_name": "fixed-position",
         "nodeId": "211:32",
         "name": "fixed-状态栏",
         "type": "GROUP",
         "trigger": "name.startsWith('fixed-')",
         "expected": "css 含 position: fixed + 由 constraints 推 top/left",
         "context": { "constraints": {...}, "bbox": {...} }
       }
     ]
   }
   ```

4. **完整 sub-agent prompt** 见 `rules/README.md` 的"使用方式 → Rule-Scan sub-agent"段;派发时主 agent 拼装原文,不改写。

5. **主 agent 不聚合全量 rule-hits**,只在 §6.0.2 合并前做一次聚合读。

**降级路径**:
- Rule-Scan sub-agent **首次挂了**(API 错 / 超时 / 输出 JSON 格式错) → 主 agent **重派一次**
- **二次挂了** → 降级到 v0.3.21 前的自己判断模式:
  1. UI sub-agent Read **全部** `rules/*.md` (回退到读全量规则库模式)
  2. `blocks/{sub}/rule-hits.json` 写入 `{ "generated_by": "v0.3.21-fallback", "hits": [] }` 占位
  3. UI sub-agent 在 `assets.txt` 记 `[Rule-Scan 降级] block={sub} 原因={二次失败原因}`
  4. UI sub-agent 依然要跑 `check-rules.mjs`(硬防线不受影响)
  5. 主 agent §6.0.2 记录降级并输出 QA 告警

**性能预算**:
- 每 block 一个 Rule-Scan sub-agent,输入 cache JSON 5-50 个节点
- 输出 `rule-hits.json` < 200 行
- 单个 sub-agent 平均耗时 15-30 秒(LLM 推理)
- N blocks 并行 → 总耗时约 30 秒(与 UI sub-agent 组合后总耗时 60-90 秒)

---

### 步骤 4：sub-agent 实现单个 block

#### 4.0.pre Rule-Scan 消费与硬防线交付前自检 

**执行时序**: sub-agent 拿到 block 后、进入 §4.0 根节点前缀检查前。

**输入(v0.3.21 → v1.0.0 新增)**:
- 本 block 的 `blocks/{sub}/rule-hits.json`(来自步骤 3.5 Rule-Scan sub-agent)

**强制动作**:

1. **Read `rule-hits.json`**,列出所有 `hits[].rule` 命中,记录该 block 需要按哪些 R0X 落地
2. **按每条 hit 的 `expected` 字段设计产物**:
   - R01 fixed-position → `position: fixed` + top/left/right/bottom 由 constraints 推
   - R02 fills-image → 切图 + assets.txt 登记 + jsx `<img>` 或 css `background-image`
   - R03 implicit-image → 整体切图 + `<img>` 挂父 or 自成节点
   - R04 text-gradient → `<span>` + `background: <gradient>` + `background-clip: text` + `color: transparent`
   - R05 space-between → `justify-content: space-between`
   - R06 text-solid-last → `color: {hex}`(取自 fills 末位可见 SOLID)
   - R07 multi-fills → 每层 fills 都落地(SOLID + IMAGE / GRADIENT + IMAGE 等)
   - R08 bg-landing-form → **父容器** `background-image`;不允许 `<img src="bg-..">`/inline/伪元素/空 div 挂 bg
   - R09 btn-bgc-取值 → btn 父 CSS `background` 取 bgc- 子层真 fills
   - R10 no-fake-solid-color → 产物出现 `#RRGGBB` 必须能反查到 cache fills 源头
   - R11 mask-vector-css-able → 复合几何切图,不硬 CSS
   - R12 flat-mode-naming → flat 模式类名带 block 前缀
   - R13 unit-scale → `figmaPx × (outputBase/figmaBase)`
   - R14 fixed-z-index → 多 fixed 递增 z-index
   - R15 同构 map 渲染 → `.map()` 而非重复展开
   - 详情各条 `rules/R0X.md`

3. **补漏规则(v1.0.0)**:sub-agent 生 JSX/SCSS 时如果发现某节点应命中某 R0X 但 `rule-hits.json` 里没有 → **允许自补**,但**必须**在 `assets.txt` 用 `[遗漏补捕]` 前缀记录:
   ```
   [遗漏补捕] R04 211:411>211:91 "2026 (TEXT)": Rule-Scan 未识别, 自动补齐落地 = <span> + linear-gradient(180deg, #FFF7EE, #FFDBAA) + bg-clip:text + color:transparent
   ```
   逐条 nodeId + rule id + 落地说明,漏备注会被主 agent §6.0.2 diff 出并 QA 告警。

4. **交付前必跑 `check-rules.mjs`**:生完 `index.jsx` + `index.module.scss` + `assets.txt` 后:
   ```bash
   node .claude/skills/pp-d2c-fast/bin/check-rules.mjs \
     --block blocks/{sub}/ \
     --cache-key <fileKey>
   ```
   - **exit 0** → 继续到 §4.0
   - **exit 1** → 按 stdout `violations[]` 列表回滚代码,重做,重新跑脚本
   - **exit 2** → 停下,报告环境错误给主 agent
   - **假阳性时** → 用 `--force-skip R0X,R0Y` 跳过,**必须**在 `assets.txt` 加 `[脚本误判] R0X {nodeId} 理由: ...`

5. **（fast 精简）不写 rule-hits 消费证明表**：`check-rules.mjs`（步骤 4）exit 0 即为"规则消费到位"的真值，无需再手写 N==M 消费清单。仅当出现遗漏补捕时，按 §3 的 `[遗漏补捕]` 前缀记进 `assets.txt`；Rule-Scan 降级则在 `assets.txt` 记 `[Rule-Scan 降级] {原因}`。

**降级路径**:若 `rule-hits.json` 的 `generated_by === "v0.3.21-fallback"`(Rule-Scan 二次挂):
1. sub-agent Read **全部** `rules/*.md` 自己判断
2. 落地后依然跑 `check-rules.mjs`(硬防线不受影响)
3. 在 `assets.txt` 注明 `[Rule-Scan 降级] block={sub}`

---

#### 4.0 根节点前缀检查（优先于一切）

sub-agent 拿到根节点后，**第一步**检查根节点自身的图层名前缀（去掉 `sub-` 后剩余的前缀）：

| 根节点剩余前缀 | 处理方式 |
|--------------|---------|
| 含 `img-` | 整个节点导出为一张图片，生成单个 `<img>`，**不解析任何子层，直接结束** |
| 含 `bg-` | **`bg-` 节点自身**导出为图片，切图挂到**父容器**的 CSS `background-image`(写在父容器的独立 `.scss` / `.less` / `.css` 文件里);**bg 节点自身不生成任何 DOM**(不产 `<div>`、不产 `<img>`、不产 inline style),**不解析任何子层**。切图源 nodeId 必须是 `bg-` 节点自己的 nodeId |
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
node .claude/skills/pp-d2c-fast/bin/figma.mjs fetch-node <fileKey> <nodeId> --depth=8
```

`node` 里含图层树、以下几类字段必须读全（脚本自动查/写缓存）：

- **视觉属性**：`fills` / `strokes` / `strokeWeight` / `strokeAlign` / `effects` / `cornerRadius` / `rectangleCornerRadii` / `opacity` / `blendMode`
- **布局属性（autoLayout，v0.3.1 强调）**：`layoutMode` / `itemSpacing` / `paddingLeft` / `paddingRight` / `paddingTop` / `paddingBottom` / `primaryAxisAlignItems` / `counterAxisAlignItems` / `layoutWrap` / `layoutSizingHorizontal` / `layoutSizingVertical`
- **子节点尺寸行为**：`layoutGrow` / `layoutAlign` / `layoutPositioning`（`AUTO` = 参与父 autoLayout 顺流；`ABSOLUTE` = 脱离父顺流，用 `absoluteBoundingBox` 独立定位。缺失视为 `AUTO`）
- **定位**：`constraints` / `absoluteBoundingBox`
- **文本**：`characters` / `style`（TEXT 节点）
- **可见性**：`visible`

> **铁律：不再使用 MCP `get_design_context` 返回的"参考代码"字段**。REST API 只返回原始节点 JSON，agent 按项目前缀规则（§4.0 / §4.3）自主判断如何渲染，不受任何"AI 生成的通用 D2C 参考代码"干扰。

> `layoutMode` 字段是 Figma autoLayout 的核心信号。**每处理一个 Frame 节点，必须先读 `layoutMode`**（`HORIZONTAL` / `VERTICAL` / 缺失 = 无 autoLayout）；这是 §4.3 布局判定的入口条件，跳过读它会直接退化成 absolute 定位泛滥。

> **补丁：`layoutPositioning`（读每个子节点时必读）**：Figma auto-layout 支持"子节点脱离父顺流"——子节点 `layoutPositioning === 'ABSOLUTE'` 表示该子在父 autoLayout 里挖了个洞独立定位；其他兄弟仍按 flex 顺流。**读子节点时必读此字段**，值为 `ABSOLUTE` 时子走绝对定位、父仍走 flex（见 §4.3 判定优先级第 0 条）。

#### 4.1.1 REST 原始 JSON 字段取值指引

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
| 容器**自身**尺寸行为 | `layoutSizingHorizontal` / `layoutSizingVertical` | `FIXED → width/height 固定值`；`HUG → width/height 由内容撑开`（CSS 里对应 `width: fit-content` 或**不写宽度**）；`FILL → width: 100%`（在 flex 父下等价 `flex: 1`）。**FIXED 高度的塌陷防御**：当 vertical `FIXED` 且节点带 `sub-` / `block-` 前缀，或节点内部有 `layoutPositioning: ABSOLUTE` 且 `height: 100%` 的兄弟层（典型 bg- 铺满）→ 写 `min-height: {N}px` 而非 `height: {N}px`；理由见下面「FIXED 塌陷防御」补充说明。**页面根容器例外**：vertical `FIXED` 时不写 `height: {figmaH}px` 死值，改写 `min-height: max({figmaH * scale}px, 100vh)`；判定见 §4.3 判定优先级第 6 条 |
| **子节点**主轴伸缩 | `layoutGrow` (0 或 1) | `1 → flex: 1`（在父 flex 下沿主轴撑满剩余空间）；0 或缺失 → 不写 |
| **子节点**交叉轴对齐（覆盖父 align-items） | `layoutAlign` | `STRETCH → align-self: stretch`；`INHERIT` / 缺失 → 不写（继承父 align-items） |
| **子节点**是否脱离父 autoLayout 顺流 | `layoutPositioning` | `AUTO` 或缺失 → 参与父 flex 顺流，不写 position；`ABSOLUTE` → 子代 `position: absolute` + `top/left`（相对父原点，用 `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` 算得），同时**父容器必须加** `position: relative`。**仅当父 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 时此字段有意义**。此机制通用（不限于 `bg-` / `fixed-` 前缀）——任何设计师在 Figma 里勾选"绝对定位"的子节点都会返 `ABSOLUTE` |

> `layoutMode` 是 `HORIZONTAL` / `VERTICAL` 时，**禁止**对该 Frame 使用 `position: absolute` + `top/left`；主 agent §6.0 验收命中此违反 → 回退整块重写。
>
> **两端对齐特别提醒**：`primaryAxisAlignItems === 'SPACE_BETWEEN'` 是明确信号，**直接翻译成 `justify-content: space-between`**，不要用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟。设计师用两端对齐排 = REST 返 `SPACE_BETWEEN`；设计师用固定间距排 = REST 返 `MIN` + `itemSpacing`。忠实翻译即可，不做推断。
>
> **`layoutPositioning` vs `layoutMode` 谁决定 CSS 定位方式（看谁：看自己 or 看父）**：`layoutMode` 描述**该节点自己**的内部布局（父视角）；`layoutPositioning` 描述**该节点在父容器里**是否脱离顺流（子视角）。两者互不冲突：一个节点可以自己是 autoLayout 容器（`layoutMode = VERTICAL`），同时又在父的 autoLayout 里绝对定位（`layoutPositioning = ABSOLUTE`）——CSS 里写成 `position: absolute; top:...; left:...; display: flex; flex-direction: column; ...`。

> **FIXED 塌陷防御**：Figma `layoutSizingVertical: FIXED N` 到 CSS 有 3 种落地方式，按下表选：
>
> | 场景 | 高度写法 | 理由 |
> |---|---|---|
> | 页面根容器（三信号 AND 命中，见 §4.3 优先级 6） | `min-height: max({N * scale}px, 100vh)` | 视口更大时撑到 100vh，防长屏底部露白 |
> | **`sub-` / `block-` 容器且内部有 `layoutPositioning: ABSOLUTE + height: 100%` 兄弟层**（典型:`&__main` 含 `&__main-bg` 铺满） | **`min-height: {N * scale}px`** | 死高 `height` 会因内容异步渲染 / 数据少时压缩到 HUG 表现，让 `height: 100%` 兄弟层跟着塌成一条 |
> | **`sub-` / `block-` 容器普通场景**（无绝对定位背景兄弟） | **`min-height: {N * scale}px`** | 设计师给 FIXED = 兜底"至少这么高"，业务内容多时允许撑开；死高会裁切超长内容 |
> | 叶子/装饰元素（`img-` / `bg-` / `btn-` / 图标 / 卡片装饰等） | `height: {N * scale}px` | 尺寸严格匹配设计稿，超出属于设计问题 |
>
> **判定顺序**：先看是否命中"页面根容器例外"→ 再看是否命中"sub-/block- 容器"→ 都不是走"叶子/装饰"。
>
> **兼容点**：`min-height` 相较 `height` 只是"下限保底"，不影响设计稿本意。旧产物用 `height` 出现的塌陷问题(bg 层跟着塌成一条)全部由本规则统一收敛。

> **sub 容器 min-height 尺寸源证明**：`sub-` / `block-` 容器写 `min-height` 时，尺寸源**必须**取节点**自身**的 `absoluteBoundingBox.height`，**禁止**取兄弟 `bg-` / `bgc-` 层的高度（哪怕兄弟层比自身高——bg 兄弟层在 Figma 里常"溢出到下方指南区"作装饰，与父容器主内容区不等）。
>
> **sub-agent 交付每个 `sub-` / `block-` 容器前必须在 `blocks/{sub}/assets.txt` QA 段写一行**：
>
> ```
> · SUB容器 {nodeId} name="{nodeName}" 自身h={H1} bg兄弟层h={H2 或 "无"} min-height写入={H1 * scale}px（scale={S}）
> ```
>
> 其中 `min-height 写入` 值必须严格等于 `H1 * scale`，**不允许**是 `H2 * scale`。
>
> **doctor 关联规则**：DIM031 —— sub-/block- 容器 min-height 写入值 = 兄弟 bg 层高度 而非自身高度，参见 pp-doctor §3.6s。

> **冗余嵌套 autoLayout 的属性下穿**：Figma 里设计师有时为了"分组"多包一层 autoLayout,但内部只有一个真正的顺流子(其他都是 abs 兄弟)。直译成 DOM 时**保留双层结构没错**(abs 兄弟需要挂在外层),但**布局属性(padding/gap/align)应该整体下穿到内层**，因为设计师改的是内层。
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

**TEXT 多层 fills 处理**:详见 `rules/R04-text-gradient.md`(末位可见 = GRADIENT/IMAGE)与 `rules/R06-text-solid-last.md`(末位可见 = SOLID)。取值原则、GRADIENT 字色落地形态(`<span>` + `background-clip: text` + `color: transparent`)、handle → CSS 角度换算、溯源证明格式全部在 rules/ 里,SKILL.md 不再复述。

#### 4.2 隐藏图层处理

**在解析任何图层之前，先检查图层的可见性**：

- Figma 中设置为**隐藏**（`visible: false`）的图层 → 直接跳过，不生成任何代码
- 隐藏图层的所有子图层一并跳过，无论子图层是否可见

> 这包括设计师用于备选方案、模板、草稿的隐藏图层，以及任何临时隐藏的元素。

#### 4.3 图层解析规则

前缀值从 config `layers` 读取，未配置时使用括号内默认值。

##### 硬规则总概表 (v1.0.0 索引,详情看 rules/R0X.md)

| ID | 规则名 | 一句话触发 | 违反后果 | 详情 |
|---|---|---|---|---|
| R01 | fixed-position | 前缀 `fixed-` | 缺 `position: fixed` | `rules/R01-fixed-position.md` |
| R02 | fills-image | `fills[].type === 'IMAGE'` | 凭空搓 gradient 代替切图 | `rules/R02-fills-image.md` |
| R03 | implicit-image | 无前缀 + 子树全 VECTOR + 无 TEXT/INSTANCE + 无 btn-/input-/sub-/block- 前缀 | 该切图没切,变成 vector CSS 堆 | `rules/R03-implicit-image.md` |
| R04 | text-gradient | TEXT 末位可见 fills = GRADIENT/IMAGE | 凭空搓 solid color 代替 span+bg-clip | `rules/R04-text-gradient.md` |
| R05 | space-between | `primaryAxisAlignItems === 'SPACE_BETWEEN'` | 用 margin-auto / flex-end 模拟 | `rules/R05-space-between.md` |
| R06 | text-solid-last | TEXT 多层可见 SOLID | 取错层(通常取到中间层白色) | `rules/R06-text-solid-last.md` |
| R07 | multi-fills | fills 多层可见非全 SOLID | 只写 SOLID 忽略 IMAGE/GRADIENT | `rules/R07-multi-fills.md` |
| R08 | bg-landing-form | `bg-` 前缀(含裸 bg) | 用 `<img>` / inline / ::before / 空 div 挂 bg | `rules/R08-bg-landing-form.md` |
| R09 | btn-bgc-取值 | btn 内 bgc 子层的真 fills | 凭空搓 gradient 代替真值 | `rules/R09-btn-bgc-取值.md` |
| R10 | no-fake-solid-color | 产物 `color: #xxx` 但 cache 找不到源头 | 幻觉色 | `rules/R10-no-fake-solid-color.md` |
| R11 | mask-vector-css-able | 复合 mask / 多层 vector | 判"CSS 表达不了" → 应切图 | `rules/R11-mask-vector-css-able.md` |
| R12 | flat-mode-naming | flat 合并模式类名 | 跨 block 覆盖 | `rules/R12-flat-mode-naming.md` |
| R13 | unit-scale | Figma px → 产物 px | 忘换算 `outputBase / figmaBase` | `rules/R13-unit-scale.md` |
| R14 | fixed-z-index | 多个 `fixed-` 节点 | z-index 未递增 | `rules/R14-fixed-z-index.md` |
| R15 | 同构 map 渲染 | 同层 ≥3 同构子节点 | 展开重复代码 vs `.map()` | `rules/R15-同构 map 渲染.md` |
| R16 | no-flatten-text | GROUP/FRAME 子树含 TEXT 且前缀非 `img-`/`bg-` | 整体切图把 TEXT/按钮烤成 png | `rules/R16-no-flatten-text.md` |
| R17 | no-baked-dom | 节点处于 bg-/bgc-/img-/x- 整体切图子树内(`_inBakedSubtree`) | 像素已进 PNG 却又出 DOM(双重渲染) | `rules/R17-no-baked-dom.md` |
| R18 | flex-direction | autolayout 容器(`layoutMode` HORIZONTAL/VERTICAL) | flex 方向写反(VERTICAL 却 row) | `rules/R18-flex-direction.md` |
| R19 | padding | autolayout 容器有/无 padding | padding 凭空捏造 或 漏写 或数值错 | `rules/R19-padding.md` |
| R20 | absolute-position | `layoutPositioning === 'ABSOLUTE'` 子节点 | top/left 靠猜(应 =(子bbox−父bbox)×scale) | `rules/R20-absolute-position.md` |
| R21 | node-id-coverage | 应渲染节点(TEXT/autolayout 容器/ABSOLUTE/img-·btn-·input-) | 未挂 data-node-id → 逃出全部对账 | `rules/R21-node-id-coverage.md` |

**硬防线** (`bin/check-rules.mjs` 自动拦截, exit 1): **R01 / R02 / R05 / R06 / R08 / R16 / R17 / R18 / R19 / R20 / R21**
**软防线** (Rule-Scan sub-agent 识别 `rule-hits.json`): **R03 / R04 / R07 / R09 / R10 / R11 / R12 / R13 / R14 / R15**

> **v1.2.0 对账基座**:R02/R06/R17/R18/R19/R20/R21 依赖 `loadCache.mjs` 标注的 `_inBakedSubtree`/`_hidden`/`_templateDup` 与 `cssMatch.mjs` 的 SCSS 嵌套匹配。这些是"以 cache 为真值逐节点对账"的落点;它们报数即真值,不接受"语义盲点/装饰性内容"批量豁免(§6.0.2)。
> **v1.2.1**:`_inBakedSubtree` 只含 bg-/img-(baked)+ x-(ignored),**移除 bgc-**(bgc- 是盒级 CSS 写父、非切图,其子孙误放的 TEXT 应被 R06/R21 暴露而非静默吞掉);新增 **R21 node-id-coverage** 把 §5.1.1「data-node-id 铁律」机械强制——应渲染节点漏挂 id 即 exit 1,堵住 R18/R19/R20 遇空 classMap 静默 continue 的逃逸。

##### 硬规则详情

**详见 `rules/R0X-*.md`**——切图判定 / TEXT 处理 / SPACE_BETWEEN / bg 落地形态 / fills 翻译等所有硬性规则的**触发条件 + 期望产物 + 反例 + 落地模板**全部在 `rules/` 独立文件里。

**执行约束**:
- Rule-Scan sub-agent(步骤 3.5) **必须** Read **全部 15 条** `rules/R0X-*.md`,输出 `rule-hits.json`
- UI sub-agent(步骤 4) **必须** Read `rule-hits.json` 里被命中的每条 `rules/R0X-*.md`,按其"期望产物"逐字落地
- 冲突时**以 rules/ 为准**;SKILL.md 只保留总概表,不再复述规则细节

##### 含 TEXT 容器的「压平 vs 拆结构」唯一裁决树（v1.2.0）

R16(不压平文字)与 bg-/img-(整体切图)在**含 TEXT 的容器**上会打架:到底把文字烤进 PNG,还是拆出来当 DOM?下表给**唯一裁决**,不允许"既烤又留"(=双重渲染,R17 硬拦,典型 test13:title/subtitle 既进 main.png 又出 DOM):

| 容器前缀 | 动作 | 必然后果(硬约束) |
|---------|------|----------------|
| `bg-` / `img-`(含裸词 `bg`/`img`) | **压平**:整体切图,TEXT 像素进 PNG。用于**装饰性、文案不需动态替换**的容器 | 子孙(含 TEXT)**禁止再出 DOM**(R17 拦);loadCache 已把子孙标 `_inBakedSubtree`,R02/R06 不再逐个溯源 |
| 普通 GROUP/FRAME/COMPONENT/INSTANCE 含 TEXT | **拆结构**:R16 禁止整体切图;TEXT 出 DOM,背景单独切成**不含文字**的 bg | TEXT 正常生成 DOM + 挂字色;背景层若含文字像素=切错,回头重切 |

**判定顺序**:先看前缀 → `bg-`/`img-` 走压平(子孙禁 DOM),其余含 TEXT 走拆结构(R16)。**二选一,没有中间态**。若某容器"文案是装饰但又想可选中/可换" → 与用户确认后,要么加 `bg-`/`img-` 前缀走压平,要么去前缀走拆结构;**不允许 agent 自己两头下注**。

##### bg- 背景:直接挂父 vs 独立定位层(v1.2.0,解决过度分层)

`bg-`/`layoutPositioning:ABSOLUTE` 的背景层,**默认直接把 `background` 写到父元素**,不生成独立 `__bg` 层:

```scss
&__main { background: url('#{$prefix}main.png') no-repeat top center / {w}px {h}px; }
```

**仅当背景 bbox 超出父容器 bbox(背景要溢出容器不被裁)时,才生成独立 `position:absolute` 层**:

| 条件 | 做法 |
|------|------|
| 背景 bbox ≤ 父容器 bbox(放得进) | **直接挂父** `background`,少一层 DOM(默认,多数场景) |
| 背景 bbox > 父容器 bbox(溢出,如 `main.png` 562.5 > `sub-MAIN` 520) | 生成独立 `&__main-bg { position:absolute; ... }` 保溢出不裁,**或**父 `overflow:visible`+直接背景 |
| 页面根容器全屏背景(§4.3 判定第 6 条) | 按该条:根内 ABSOLUTE bg 层 `inset:0` + `background-size:cover` |

**判定**:比较 bg 节点 `absoluteBoundingBox` 与父容器 `absoluteBoundingBox`;不溢出就别独立成层(独立层的 `z-index:-1`/`pointer-events:none` 易写错,能少则少)。

##### 解析方式：多前缀组合

图层名从左到右扫描，提取所有已知前缀，每个前缀贡献独立语义，组合生效。例如：
- `btn-img-hero` → 可点击容器 + 内容为图片
- `sub-btn-img-hero` → 分块边界（步骤 2 用）+ 可点击容器 + 内容为图片

##### 前缀语义表

| 前缀 | 语义 | 对生成代码的影响 |
|------|------|----------------|
| `sub-` | 分块边界 | 仅用于步骤 2 分块，不影响渲染 |
| `block-` | 独立布局块 | HTML 上作为独立根元素，CSS 类名以块名做命名空间，不与其他块共享样式 |
| `x-` | 忽略 | 跳过整个图层，不生成任何代码，**优先级最高** |
| `btn-` | 可点击区域 | 在内容外包一层可点击容器，不限定组件类型;**永远走 CSS 化(切图四条硬规则第 3 条)** |
| `img-` | 图片内容 | 生成 `<img>` 引用，**不再向内递归**，命中即停止(切图四条硬规则第 1 条) |
| `bg-` | 背景图 | 将图片设置为**父元素**的 `background-image`，自身不生成独立 HTML 元素，**不再向内递归**(切图四条硬规则第 1 条) |
| `bgc-` | 背景纯色 | 将颜色/描边/圆角/阴影**全套盒级 CSS 属性**写到**父元素**，自身不生成独立 HTML 元素 |
| `scrollx-` | 横向滚动容器 | 容器开 `overflow-x: auto`、子元素 `flex-shrink: 0`、隐藏滚动条；**继续递归子层** |
| `scrolly-` | 纵向滚动容器 | 容器开 `overflow-y: auto`、隐藏滚动条；**继续递归子层** |
| `fixed-` | 视口固定定位 | 在当前节点对应的容器上加 `position: fixed`，相对视口定位；top/bottom/left/right 根据 Figma constraints 推断；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加（这三个不生成节点，没法 fixed） |
| `end-` | 逆向布局（贴父末端） | 让节点在父 autoLayout 里贴向末端：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。**主线机制**：把该 end- 节点前面的兄弟包成一个 wrapper，父 `justify-content: space-between`，天然把 end- 推到末端；**修饰前缀**，可与 `sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-` / `input-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` 叠加 |
| `input-` | 输入框（`<input type="text">`） | 生成语义化 `<input type="text">` 标签而非 `<div>`，取子 TEXT 节点 `characters` 作为 `placeholder`，左侧图标（若存在 vector/img 子）切图作为 `background-image` + `padding-left` 腾位置；**独立前缀**（决定生成什么元素，不是修饰），**不可**与 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加（doctor NAM019/NAM020 error），**可**与 `fixed-` / `end-` / `sub-` 叠加；命中即停止向内递归 |

##### 独立裸词规则

图层名与已知前缀的匹配走**三态判定**（whole word 完全匹配，不做子串匹配）：

| 图层名形态 | 判定 | 举例 |
|------------|------|------|
| **完全等于**前缀去掉 `-` 后的裸词 | ✅ 等同该前缀语义（**独立前缀**才允许，见下面白名单） | `bg` = `bg-` / `btn` = `btn-` / `bgc` = `bgc-` / `img` = `img-` / `input` = `input-` |
| **以 `xxx-` 开头**且后面有字符 | ✅ 沿用当前规则 | `bg-header` / `btn-submit` |
| **含前缀词但不是完全裸词**（如 `background` / `bgheader` / `button`） | ❌ 不识别，按普通图层走无前缀兜底 | `background` → 兜底为无前缀 FRAME/GROUP → CSS 化 |

**裸词白名单**（仅这些独立/内容前缀允许裸词形式）：`bg` / `bgc` / `btn` / `img` / `input`

**修饰前缀不允许裸词**：`sub` / `block` / `x` / `scrollx` / `scrolly` / `fixed` / `end` 这些前缀必须写 `xxx-...` 完整形式，**不允许**独立裸词。

**裸词不允许与其他前缀组合**：`sub-bg` / `block-btn` 这类"修饰前缀 + 裸词"命名一律**报错**（doctor NAM023）。

**filename 派生规则**（裸词没有"后缀部分"可用做 filename，需要从上下文派生）：

| 裸词 | filename 派生 |
|------|--------------|
| `bg` | `{父节点 name 或 clean-id}-bg.png` |
| `btn` | 无 filename(btn 走 CSS 化,不切图) |
| `img` | `{父节点 name 或 clean-id}-img.{ext}` |
| `bgc` | 无 filename(bgc 不切图) |
| `input` | `{父节点 name 或 clean-id}-input`(复用当前 input 规则) |

`clean-id` 定义：nodeId 去冒号（例：`189:36862` → `189_36862`）。

##### 无前缀兜底规则

| 条件 | 处理 |
|------|------|
| 图层类型为 TEXT | 生成文字节点 `<span>` |
| 图层 fills 含 IMAGE 类型 | 走**切图四条硬规则第 2 条**(拉 imageRef 挂父容器 background) |
| 其他所有情况 | **走 CSS 化**(读 fills/strokes/cornerRadius/effects 转 CSS,子层递归解析,TEXT 子层生成 `<span>`) |

##### 组合优先级

1. 含 `x-` → 直接跳过，其余前缀无效
2. 含 `img-` → 生成 `<img>`，**立即停止**，不再处理任何子图层
3. 含 `bg-` → 将图片写入父元素 `background-image`，自身不生成 HTML，**不递归**
4. 含 `bgc-` → 将 fills/strokes/cornerRadius/effects **全套盒级属性**写到父元素，自身不生成 HTML
5. 提取 `btn-` → 生成可点击容器,**走 CSS 化**(切图四条硬规则第 4 条),内部 TEXT 生成 `<span>`
6. 提取 `scrollx-` / `scrolly-` → 记录"需要包滚动容器"（容器层级；继续递归子层）
7. 无内容前缀 → 走 CSS 化(读 fills/strokes/cornerRadius/effects,TEXT 子层生成 `<span>`)
8. 若有 `fixed-`，在最终容器上加 `position: fixed` + 根据 Figma constraints 推断 top/bottom/left/right

##### `bg-` / `bg-*` 落地规则

**详见 `rules/R08-bg-landing-form.md`**。核心:`bg-` 节点被吸收进**父容器** `background-image`,自身不生成 DOM;禁止 `<img>` / inline style / `::before` / `::after` / 空 div 挂 bg;一个父元素只应有一个 `bg-` 子;可与 `bgc-` 同存。落地模板 + 禁止形态清单在 rules/R08。

##### `scrollx-` / `scrolly-` 的额外规则

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
- **强制递归生成 DOM 列表项**：`scrollx-` / `scrolly-` 必须继续递归子层,不允许整体切图(切图四条硬规则不涵盖 scrollx-/scrolly-)。**同构 ≥3 个必须 `.map()` 数据驱动渲染**(把每个节点内部随位置变化的原子字段抽成数据数组元素,位置和结构不变的部分留在 JSX 模板)。

##### 布局规则：每 Frame 独立走判定优先级 + 间距单一来源

**判定优先级**（每个 Frame 节点**独立按顺序判定**，命中一条即用该分支，不再往下走）：

**判定角度说明**：判定分为**子视角**（当前节点在父容器里的定位方式）和**父视角**（当前节点自己内部子代的排布方式）。**子视角先于父视角**——因为 CSS 里 `position` / `top` / `left` 决定该元素相对父的位置，`display: flex` 决定其内部子代的排布，两者互不冲突可共存。

0. **`node.layoutPositioning === 'ABSOLUTE'`**（子视角；v0.3.1 补丁）
   → 该节点在父 autoLayout 里**脱离顺流**，CSS 写 `position: absolute` + `top` / `left`（值 = `子.absoluteBoundingBox.{x,y} - 父.absoluteBoundingBox.{x,y}` × scale）
   → **父容器必须加** `position: relative`（若父本来是 flex，`relative` 与 flex 可以共存，不影响 flex 顺流的其他兄弟）
   → 该节点自身**内部**如何布局，接着走下面第 1-5 条判定（子视角处理完，接着处理父视角）
   → **优先级**：若节点前缀是 `fixed-`（判定优先级第 2 条），CSS 用 `position: fixed`（不是 `absolute`），走各自 constraints 规则；`fixed-` 优先于本条

1. **`node.layoutMode ∈ {HORIZONTAL, VERTICAL}`**（父视角；Figma autoLayout）
   → **强制** `display: flex`，其余字段严格按 §4.1.1 §A 表映射（`flex-direction` / `gap` / `padding-*` / `justify-content` / `align-items` / `flex-wrap`）
   → **禁止**对该 Frame 用 `position: absolute` + `top/left`；子代不写任何 `margin-*`（间距由父的 `gap` / `padding-*` 唯一负责）
   → 违反此条 = §6.0 验收不合格，回退整块 sub-agent 重写

   > **边界：父层 `layoutMode` 是 autoLayout，但子层里混有 `fixed-` 前缀节点时怎么办？**
   >
   > `fixed-` 子层在 Figma JSON 里作为父 autoLayout 的顺流子节点存在（占 flex 顺流的一个"位置"），但在 CSS 里 `position: fixed` 会让它脱离文档流。**父容器仍然走 flex，不因此回退到 absolute**——CSS 的 `position: fixed` 子元素会**自动**从父的 flex 排布中脱出，不占位置、不参与 gap 分配，跟"该子元素不存在"效果等价。

2. **前缀是 `fixed-`**
   → `position: fixed`，走本节下方"`fixed-` 定位规则"（`constraints` → `top/right/bottom/left`）

3. **前缀是 `bg-` / `sub-` / `scrollx-` / `scrolly-` / `bgc-` / `x-` / `img-` / `btn-`**
   → 按各前缀在 §4.3 的专属规则处理，不走本决策树

4. **`layoutMode` 缺失 / `NONE`，且子节点坐标（`absoluteBoundingBox`）存在重叠**
   → `position: relative` (父) + `position: absolute` + `top` / `left` (子)，坐标按 §4.5 单位换算
   → 典型场景：切图 + DOM 叠加层

5. **`layoutMode` 缺失 / `NONE`，子节点坐标无重叠、顺流排布**
   → 允许两种写法，二选一：
     - **推荐**（简单堆叠、纯文字段落）：父 `padding-*` + 子代 `margin-{top|bottom}`（顺流轴向）+ `:last-child { margin-*: 0 }` 收尾
     - **兜底**（结构较复杂、需要精确对齐）：`display: flex` + `flex-direction` 推断 + `gap`（父负责间距）
   → **禁止**同时用两套（父 `gap` + 子 `margin-*` 混合）

6. **页面根容器（v0.3.3 新增，特殊覆写规则；不打断 1-5 判定，走完后追加覆写）**

   判定"当前节点是页面根容器"—— **三信号 AND，缺一不成立**：

   - 信号 A：**该节点是 sub-agent（或主 agent）此次流程入口的 nodeId 本身**（不是它的孙子）
   - 信号 B：**父不是普通 Frame**——`figma.mjs fetch-node` 拿目标节点时父信息通常缺失，或者查到父的 `type` 是 `PAGE` / `DOCUMENT` / `CANVAS`
   - 信号 C：**高度接近视口常见值**——`absoluteBoundingBox.height` ∈ `[647..687, 716..756, 792..832, 824..864, 876..916, 906..946, 912..952, 1004..1044]`（±20 容差）

   **三条都命中** → 该节点是"页面根容器"，走本条覆写规则：

   ```scss
   .root {
     /* 保留判定优先级 1-5 已生成的 CSS(display: flex / gap / padding / align-items ...) */
     /* 覆写高度相关字段 */
     min-height: max({figmaH * scale}px, 100vh);   /* 至少设计稿基准高度，视口更大时撑到 100vh */
     width: {figmaW * scale}px;                     /* 宽度保留死值 */
     margin: 0 auto;
     position: relative;
   }
   ```

   **额外副作用（一并覆写）**：该根容器内部**直接子**如果 `layoutPositioning: ABSOLUTE` 且尺寸也是 `FIXED`（典型是全屏背景 `bg-`），把 `height: {h}px` 一并覆写为 `height: 100%`。

**间距单一来源铁律**（每一段间距只能有一个 owner；三条铁律，任一违反 = §6.0 回退）：

- **兄弟间距**：父容器负责。用 flex 就是 `gap`；用 block 就是子代 `margin-*`。**同一父级下二选一，禁止混用**。
- **容器内边距**：只写 `padding-*` 在该容器上。**禁止**用 `:first-child { margin-top }` / `:last-child { margin-bottom }` 去凑容器边距。
- **绝对定位下无 margin**：`position: absolute` / `fixed` 的元素**禁止**同时写 `margin-*`（`margin: auto` 用于居中除外）；位置由 `top` / `right` / `bottom` / `left` 唯一表达。

> **选 flex 还是 block+margin？**
> - Figma 里父 Frame 是 autoLayout（`layoutMode` 非空）→ 无条件 flex。
> - Figma 里父 Frame 不是 autoLayout → 看子节点关系：重叠 → absolute；顺流简单堆叠 → block+margin；顺流但需对齐控制 → flex 兜底。

##### `fixed-` 定位规则

**详见 `rules/R01-fixed-position.md`** (position: fixed 写入) 和 `rules/R14-fixed-z-index.md` (多 fixed 递增 z-index)。核心:`fixed-` 是**定位修饰前缀**,只改 `position: fixed`,不决定渲染方式,由 constraints 推 top/left/right/bottom;可与生成节点前缀叠加,不可与 `bg-` / `bgc-` / `x-` 叠加(doctor NAM014 error)。祖先 transform 会退化 fixed 到相对该祖先定位,doctor LAY013 会 warn。

##### `end-` 逆向布局规则

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-` / `block-` / `btn-` / `img-` / `scrollx-` / `scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-` / `bgc-` / `x-`，doctor NAM016 命中后 error）。

**触发前提**（缺一不可，任一缺失走 doctor 兜底）：

1. **父 Frame 必须是 autoLayout**（`layoutMode ∈ {HORIZONTAL, VERTICAL}`）。父不是 autoLayout → doctor LAY019 error
2. **`end-` 节点必须是父的最后一个可见子**。出现在中间或第一个 → doctor LAY017 error
3. **同一父下只允许一个 `end-` 子**。多个 → doctor LAY018 warn
4. **不能同时是 `fixed-`**。同现 → doctor LAY020 warn

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
}
.wrapper-of-front {
  display: flex;
  flex-direction: column;                       /* 继承父方向 */
  gap: ...;                                     /* 沿用父原本的 itemSpacing */
  align-items: ...;                             /* 沿用父原本的 counterAxisAlignItems */
}
```

**父 `HORIZONTAL` 时**：同上把 `column` 换成 `row`。

**wrapper 的 className / data-node-id 处理**：wrapper 是 v0.3.2 生成的**虚拟节点**（Figma 里不存在）：

- className 用父类名 + `__front-group` 后缀（如父类是 `.card-open`，wrapper 是 `.card-open__front-group`）
- **不写** `data-node-id`（因为对应不到任何 Figma 节点）

##### `input-` 输入框规则

`input-` 是**独立前缀**（决定生成什么元素，不是修饰）。命中即输出 `<input type="text">` 标签，**不再向内递归**。**可**与 `fixed-` / `end-` / `sub-` 叠加；**不可**与 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 叠加（doctor NAM019 / NAM020 error）。

**Figma 侧图层结构约定**：

```
input-{name}   Frame          ← 输入框容器,layoutSizingHorizontal 通常 FIXED/FILL,带 fills:白 + strokes + cornerRadius
  ├─ [vector | RECTANGLE | 子 Frame 里的 vector]   ← 可选,左侧图标
  └─ TEXT "请输入..."                              ← 必须有,filles 是 placeholder 颜色,characters 是 placeholder 文本
```

- **placeholder 文本来源**：`input-` 节点子树里第一个可见 `TEXT` 节点的 `characters`
- **placeholder 颜色来源**：该 TEXT 节点的 `fills[0].color`
- **输入框视觉（背景/边框/圆角）来源**：`input-` 节点自己的 `fills` / `strokes` + `strokeWeight` + `cornerRadius`
- **左侧图标来源**：`input-` 节点子树里**除 TEXT 外**的第一个可见节点。若无图标节点，跳过 `background-image`
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
  width: {w * scale}px;
  height: {h * scale}px;
  box-sizing: border-box;
  background: {fill.color} {icon 存在时: url('{icon-path}') no-repeat {iconLeftOffset}px center / {iw}px {ih}px};
  border: {strokeWeight * scale}px solid {stroke.color};
  border-radius: {cornerRadius * scale}px;
  padding: 0 {右侧 padding}px 0 {(iconLeftOffset + iw + gap) * scale}px;
  font-family: "{TEXT.style.fontFamily}", sans-serif;
  font-size: {TEXT.style.fontSize * scale}px;
  color: #333;
  &::placeholder { color: {TEXT.fills[0].color}; }
}
```

**图标切图约定**：图标节点作为**独立切图**导出（走 §4.4 流程），文件名建议 `input-{clean-name}-icon.svg`（矢量优先 SVG，位图 PNG 兜底）。

**类型限定**：v0.3.4 只支持 `<input type="text">`。textarea / select 场景本版不覆盖。

#### 4.3.1 页面根 padding-top 尺寸源证明

**目的**：页面顶层容器（用户传入的 nodeId 对应的 Figma 节点）的 `padding-top` **必须**取该节点自身 `paddingTop` 字段值 × scale，**禁止**取 `fixed-` 状态栏 / 顶部导航栏子层的高度替代。

**背景**：Figma 页面顶层 frame 常常同时有：
- **自身 `paddingTop` 字段**（例：166）：设计师给主内容区上方预留的间距
- **`fixed-` 状态栏子层**（例：118 高）：绝对定位在顶部的固定栏

这两个值**大概率就是不等的**，因为：
- `fixed-` 层是 `layoutPositioning: ABSOLUTE` 脱离父 flex 顺流，不参与 padding 计算
- `paddingTop` 是设计师给主内容区留的实际视觉间距
- **主 agent 必须**从 Figma 节点的 `paddingTop` **字段本身**取值，禁止用"上方的 fixed 子层高度"脑补替代

**溯源证明格式**（主 agent 合并前必须在**主页面产物**同级 `assets.txt`（若无则新建 `pages/<page>/assets.txt`）或对话中输出一行）：

```
· PAGE根 {pageNodeId} name="{pageName}" figmaPaddingTop={P} fixed状态栏h={S 或 "无"} padding-top写入={P * scale}px（scale={S_scale}）
```

其中 `padding-top 写入` 值必须严格等于 `figmaPaddingTop × scale`，**不允许**是 `fixed状态栏h × scale`。

**典型案例**：`.baseBackground { padding-top: 236px }` = fixed-状态栏 118×2 → 错。应取页面 `paddingTop=166` × 2 = **332px**。

**doctor 关联规则**：DIM032—— 页面根 padding-top 写入值 ≠ `figmaNode.paddingTop × scale`，参见 pp-doctor §3.6t。

##### SKILL.md 老规则 → rules/*.md 索引 (v1.0.0)

以下 SKILL.md 现有段落的详情已迁移到 `rules/`, 遇到不一致时以 `rules/` 为准:

| SKILL.md 章节 | rules/*.md |
|---|---|
| §4.1.1 TEXT 多层 fills 处理 | `rules/R04-text-gradient.md`, `rules/R06-text-solid-last.md` |
| §4.3 切图四条硬规则 (第 1-4 条) | `rules/R01-fixed-position.md`, `rules/R02-fills-image.md`, `rules/R03-implicit-image.md`, `rules/R08-bg-landing-form.md` |
| §4.3 CSS 翻译表 (fills SOLID/GRADIENT) | `rules/R07-multi-fills.md`, `rules/R09-btn-bgc-取值.md` |
| §4.4.pre.b 子树结构禁切规则 (v0.3.9) | `rules/R11-mask-vector-css-able.md` |
| §4.5 单位换算 | `rules/R13-unit-scale.md` |
| §5.1 data-node-id 守恒律 | (不需要拆, 属主 agent §6.0.2 校验) |
| primaryAxisAlignItems 布局 | `rules/R05-space-between.md` |
| flat 合并模式类名 | `rules/R12-flat-mode-naming.md` |
| 多个 fixed- 节点 z-index | `rules/R14-fixed-z-index.md` |
| 同层 ≥3 同构节点渲染 | `rules/R15-同构 map 渲染.md` |
| SOLID 色源核对 (无幻觉色) | `rules/R10-no-fake-solid-color.md` |

**rules/ 是设计文档**;执行链条:Rule-Scan sub-agent Read 全部 `rules/*.md` → 输出 `rule-hits.json` → UI sub-agent Read 命中的 R0X.md 按"期望产物"落地。`check-rules.mjs` 硬编码 R01/R02/R05/R06/R08 逻辑,不依赖 rules/*.md 运行。

#### 4.4 图片处理

##### 4.4.0 切图强制忠实执行

**核心原则**：命中切图四条硬规则（bg 前缀 / img 前缀 / fills 含 IMAGE）时，必须调 `figma.mjs export-image`（走 REST API）产出图片；**不允许**"看到 assetsDir 里有同名文件就跳过"或"从其他来源复用"。

**流程（每张切图必走）**：

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
   `bboxHash` 用于识别"同 nodeId 但导出参数变了"的情况；命中 hash 不同 → 也视作缓存失效强制重切。

4. **assets.txt 3 行溯源模板**（每张图切完必写）：
   ```
   - {filename}.{ext}                       ← {figmaNodeName} ({nodeId})
     · API 参数：ids={nodeId} format={png|svg} scale={2} use_absolute_bounds={true|false}
     · 返回 URL：{figma S3 临时 URL}
     · 落盘尺寸：{width}x{height} md5={md5}
   ```
   这 3 行在 flat 和 component 两种 merge.mode 下都**必须**出现，用户复现时能直接对比 md5 判定 skill 是否忠实执行了 API 调用。

**doctor IMG026**：命中切图四条硬规则，但 images.json 里对应 nodeId 缺失 → **error**（说明本次 skill 没走 REST 就落图，属于严重忠实度事故）。

##### 4.4 图片处理主段（v0.3.6 起以 §4.4.0 为前提）

所有图片（切图四条硬规则命中）通过 `figma.mjs export-image` 导出。脚本内置：两步式下载 / `use_absolute_bounds=true` 默认开 / 存在即跳过 / 3 次指数退避 / 回写 `images.json` / 绝对路径写入 `{projectRoot}/{assetsDir}/{filename}.{ext}`。

**⚠️ 调脚本前的强制前置自检（sub-agent 每张图都必须做,且必须把 3 行输出到对话）**：

```
· 切图源 nodeId:{要写进 --ids 的值}
· 切图源 name:{该 nodeId 对应节点的图层名}
· 交叉验证前缀:切图源 name 是否以「bg-」/「img-」开头,或完全等于裸词「bg」/「img」,或该节点 fills 含 IMAGE 类型?{是 → 继续切图 / 否 → 立即停下,回归 §4.3 四条硬规则重判}
```

**交叉验证判定**：
- 前缀是 `bg-` → 切图源 name **必须**以 `bg-` 开头(如 `bg-piao` / `bg-body`),**或完全等于裸词 `bg`**(whole word)
- 前缀是 `img-` → 切图源 name 必须以 `img-` 开头,**或完全等于裸词 `img`**
- fills 含 IMAGE(第 2 条硬规则) → 无前缀要求,直接切图挂父 background
- **裸词识别范围**:仅 `bg` / `bgc` / `btn` / `img` / `input` 五个独立/内容前缀允许裸词

**这是"把兄弟节点文字烤进 bg 位图"这类 bug 的唯一防线**——若 sub-agent 拿了 `bg-` 的**父容器 nodeId** 传给 API,Figma 会把父容器**整棵子树**(含兄弟节点的文字/图标/其他 block)一起 render 成位图,必须避免。

**调用**：

```bash
# PNG 2 倍图（默认，含透明通道）
node .claude/skills/pp-d2c-fast/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name>

# SVG（矢量图层优先）
node .claude/skills/pp-d2c-fast/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --format=svg

# 极少数场景:需要把 Figma effect 烤进位图(通常不用)
node .claude/skills/pp-d2c-fast/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --preserve-effect
```

stdout 返回 `{"ok":true,"data":{"path":"<绝对路径>","reused":<bool>,"format":"png|svg"}}`。`reused=true` 表示命中缓存跳过下载。

> **`use_absolute_bounds=true` 是默认开的**：
> - 默认导出会包含图层 effect（drop-shadow / outer-stroke / blur）的可见范围与父容器背景色，PNG 会比 bbox 大一圈并带画板底色 → 导致 `gap`/`margin` 算不准 + 图带背景色两个历史 bug。
> - 加此参数后，Figma 严格按节点 `absoluteBoundingBox` 导出，effect 和父背景被裁掉。**代价**：Figma effect 实现的阴影/光晕不会烤进 PNG——但这本来就是要的（应用 CSS `filter: drop-shadow()` 实现）。
> - 若某张图**就是要**把 effect 烤进位图（极少见），加 `--preserve-effect` 覆盖。也可在 config `images.preserveEffectIds` 数组里列出该 nodeId。

**格式选择**：
- 图层为矢量（Vector / Icon / 无栅格内容）→ `--format=svg`
- 其他 → 默认 PNG 2 倍图

**前提**：项目根 `.env` 里 `FIGMA_TOKEN` 必须已配置（v1.0.2 起从 `pp-d2c.config.json` 迁到 `.env`）。**当 token 缺失或过期时（HTTP 403 / 401 / `invalid_token`）**，本 SKILL v0.3 起**不再有 MCP 兜底路径**——直接终止并要求用户补 token 后重跑。

#### 4.4.1 Token 过期 / 缺失时的处理

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

**禁止**：
- 禁止在 token 过期时直接跳过下载或用临时链接占位（Figma `/v1/images` 返回的 S3 临时 URL 约 30 分钟过期，代码上线就 404）
- 禁止把 Figma `/v1/images` 返回的 S3 临时 URL 写进代码 `<img src>`
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

**详见 `rules/R13-unit-scale.md`**。核心公式:`输出值 = Figma值 × (outputBase / figmaBase)`;默认 375→750 时 scale=2。**禁止**直接把 Figma 原始值写入代码。

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

**§4.8 独立验收 checklist**：

- [ ] **IMG026 切图忠实性**：产物 `assets.txt` 里每张图是否都有 §4.4.0 定义的"3 行溯源"？images.json 里是否有对应 nodeId 的记录？md5 是否与磁盘文件一致？（漏任一 → error）
- [ ] **未主动问用户技术决策（v0.3.8）**：sub-agent 本轮跑完是否**没有向用户提任何 skill 已定死的技术决策问题**（切图/兜底/合并/尺寸/命名冲突等，见「问题边界」章节）？若遇 skill 未覆盖的边界情形，是否已按最接近规则兜底 + 在 `assets.txt` QA 段落写「[需人工核对]」告警，而**不是**打断用户提问？
- [ ] **字色末位取值（v0.3.6 NAM025）**：产物里所有 TEXT 节点的字色，是否按 §4.1.1「TEXT 多层 fills 处理」取的末位可见 SOLID？

验收通过后 sub-agent **立即将 `.d2c-tasks.md` 中对应的 `[ ]` 改为 `[x]`**，主 agent 方可进入步骤 5。

---

### 步骤 5：主 agent 合并

**合并前必须检查 `.d2c-tasks.md`，确认以下所有项均为 `[x]`**：
- 所有 Sub-agent Blocks（含嵌套层级，深度优先逐项检查）
- 所有主 agent 直接处理节点
- 背景节点

有任何 `[ ]` 未完成，必须先补齐再合并，不得跳过。

等待所有 sub-agent 完成后，按 `merge.mode` 合并。

#### 5.0.pre flat 模式合并忠实度契约

**核心原则**：sub-agent 已经落盘的 `blocks/{sub}/index.tsx` 是**主 agent 的唯一输入源**。主 agent 合并时**必须**逐字使用 sub-agent 交付的 JSX 结构，**禁止**：

1. **禁止用父容器整体切图替代 sub-agent 的拆分产物**——sub-agent 已经把内容拆开了，主 agent 不允许"合并阶段觉得复杂"就把这些拆分产物删掉换成一张父容器大图
2. **禁止在 sub-agent 落盘后再切父容器整体图**——主 agent 步骤 5 阶段不允许调 `figma.mjs export-image` 切任何 `sub-*` / `block-*` 前缀的父容器 nodeId
3. **禁止在 flat 展开时"简化"sub-agent 产物**——不允许把 sub-agent 产出的 `<button>` 结构折叠成 `<img>`，即使二者视觉等价，也违反守恒律

**反向自检 4 行**（主 agent 每展开一个 sub-block 前必须输出）：

```
· 待展开 sub-name：{blocks/{sub}/index.tsx 路径}
· 已读取该文件？{是/否}（如否，立即读，禁止继续）
· 是否用父容器整体切图替代？{否 / 意图替代}（如"意图替代"，立即停下，回归 sub-agent 产物）
· sub-agent 已交付的 data-node-id 数：{N}（合并后必须 ≥ N，见 §5.1 data-node-id 守恒律）
```

#### 5.0 placeholder 展开

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

#### 5.1 data-node-id 守恒律

**核心公式**：设 sub-agent 全部产物的 `data-node-id` 集合为 S₁，主 agent 合并后最终产物的 `data-node-id` 集合为 S₂，**必须满足** `S₁ ⊆ S₂`（sub-agent 交付的每一个 nodeId 都必须出现在最终产物中；主 agent 可以新增 data-node-id，但不允许丢失任何一个 sub-agent 的 nodeId）。

**守恒由对账覆盖（fast）**：fast 版不再要求主 agent 手写 grep 自证——**R21 node-id-coverage** 从 cache 侧逐节点校验"应渲染节点是否挂 `data-node-id`"，合并丢失 id 会被 R21 exit 1 拦下（§5.1.1 铁律仍是前提，必须挂 id）。

**doctor 关联规则**：SUB027—— sub-agent 产物的 data-node-id 在最终产物中丢失时触发，参见 pp-doctor §3.6p。

#### 5.1.1 data-node-id 全覆盖铁律（v1.2.0，对账前提）

守恒律（§5.1）只保证"sub-agent 已挂的 id 不丢失",但 v1.2.0 的对账校验（R17/R18/R19/R20/R06）**靠 data-node-id 把产物元素绑回 Figma cache**——没挂 id 的节点等于逃出全部对账。故追加**全覆盖铁律**：

1. **凡产物里生成的、承载某个 Figma 节点语义的 DOM 元素,必须带 `data-node-id="<该 Figma nodeId>"`**。这包括 sub-agent 拆出的每个块、每个可见 TEXT、每个 img/btn/input、以及**合并阶段新引入的结构节点**。
2. **`.map()` 数据驱动列表的模板项:用"代表项"(列表第一个同构兄弟,即 variant a)的 nodeId 挂在模板元素上**。例:三张同构券卡 `.map(CARDS)` 渲染,模板里 `<div className="__small-card-top" data-node-id="211:221">`(取 variant a 的 `211:221`),模板内每个文字/按钮元素同理挂 variant a 对应子节点 id。
   - **为什么取代表项**:DOM 里不能让 3 个元素共用一个 nodeId(重复),也不能一行模板挂 3 个不同 id。对账端 `loadCache.mjs` 已把 variant b/c 整棵子树标 `_templateDup` 并跳过,**只校验代表项**——故模板只需挂 variant a 的 id,b/c 的忠实度由"同一模板"保证。
   - **禁止**:模板元素**完全不挂** data-node-id(典型 test13 事故:`<div className="__small-card-top">` 无 id → R18/R19 无法绑定 → flex 方向反 / 幻觉 padding 逃逸上线)。
3. **唯一例外——虚拟 wrapper**:v0.3.2 的 `__front-group` 等**Figma 里不存在对应节点**的合成 wrapper,按 §wrapper 规则**不写** data-node-id(它没有可绑的 Figma nodeId)。此例外仅限"无源节点的纯布局壳",不含上面第 2 条的模板代表项(那是有真实 Figma 源的)。

**（fast）覆盖由 R21 兜底**:§5.1.1 铁律要求应渲染节点必须挂 id；fast 版不再要求主 agent 逐个手动自检——漏挂的由 **R21**(及 R06/R18/R19 遇空 classMap)exit 1 报出,按报错补挂即可。

---

### 步骤 6：主 agent 合并验收

合并完成后，主 agent **必须**做两轮视觉验收（顺序不可调换）：

#### 6.0 逐叶子 sub-block 单独视觉对比

> **核心原则**：无论 `merge.mode` 是 `component` 还是 `flat`，**主 agent 都必须对每个叶子 sub-agent 产出的 block 做单独的视觉对比**，而不是只对合并整体看一眼大图。
>
> **叶子 sub-block 的定义**：在 `.d2c-tasks.md` 树状清单中**没有任何子 sub-** 的 block。父 block 不单独对比（其视觉效果 = 内层叶子的总和，会重复检查）；父 block 的协调由 §6.1 整体验收兜底。

**为什么必须逐叶子对比**：

- sub-agent 在 §4.8 做的是**自我验收**——同一上下文里写完代码再看截图，视觉差异极易"看不到自己的盲点"（self-blind）。这是大模型生成代码的已知 bias
- flat 模式合并后子组件结构被打散在同一文件里，**整体大图扫一眼很难定位到具体某个 block 的局部偏差**（尺寸 1px / 颜色 #abc vs #abd / 字号差 1pt）
- component 模式虽然 block 还在独立目录，但主 agent §6 整体验收时，目标节点 nodeId 是页面根，得到的截图分辨率被压缩到容纳整页，**单个 block 内部细节在大图里像素不够看**

**步骤**：

对 `.d2c-tasks.md` 中**每个叶子 sub-block**（无内层 sub- 的 block），主 agent 依次执行：

1. 调脚本获取该 block 原始设计稿截图：

   ```bash
   node .claude/skills/pp-d2c-fast/bin/figma.mjs screenshot <fileKey> <leafBlockNodeId> --tag=leaf --scale=2
   ```

   stdout 返回 `{path}`，本地绝对路径 `{projectRoot}/.d2c-tmp/screenshots/leaf-<nodeId_safe>.png`。用图片查看器 zoom 100% 看即可对齐细节。SKILL 结束时统一清理。
2. 在浏览器或 dev-server 中定位合并后该 block 渲染出的 DOM 区域，截图相同区域
3. 两张图并排对比，聚焦四类差异：
   - **尺寸**：宽 / 高 / padding / margin / gap 是否对齐（对齐铁律见下）
   - **颜色**：色值偏差（允许 ΔE ≤ 3，即视觉等同）
   - **字号 / 字重 / 行高**：文本节点逐项核对
   - **位置 / 排列**：子元素相对父容器的位置、子元素之间的相对关系
4. 任何差异：先尝试主 agent 自动修正（改 scss 数值）；改不了的写入交付清单 `## 待人工核对`，标明"block 名 + nodeId + 具体差异 + 建议修复方向"
5. 验收通过后，在 `.d2c-tasks.md` 对应叶子 block 行后追加 `(主验通过)` 标记

**对齐铁律**（逐叶子 block 对比时遵守）：

| 检查项 | 容忍区间 | 超出怎么办 |
|--------|---------|-----------|
| 宽 / 高 | ±2px | 改对应 css 数值，不允许靠 transform / scale 凑 |
| 间距（padding/margin/gap） | ±1px | 同上；若用了负 margin 凑，先核对图片是否带光晕外扩（见 §4.4 use_absolute_bounds） |
| 颜色 | ΔE ≤ 3 | 用 Figma 取色值替换，不允许"看起来差不多" |
| 字号 | 完全相等 | 设计稿是真值，不允许改 |
| 字重 | 完全相等 | 同上 |

**双重间距 / 布局违反检测 checklist**：

对每个叶子 block 产出的 `.tsx` / `.scss` 文件（或对应片段），**逐项静态扫描**：

1. **flex + margin 混用**：是否存在父级同时出现 `display: flex` 且直接子代出现 `margin-{top|right|bottom|left}`？（`margin: auto` / 居中用途除外）
2. **padding + first/last-child margin 冲突**：是否存在父级 `padding-{side}` 且子代规则 `:first-child { margin-{same-side} }` 或 `:last-child { margin-{same-side} }`？
3. **absolute + margin 冲突**：是否存在元素同时具有 `position: absolute` 或 `position: fixed` 且 `margin-*`？（`margin: auto` 用于居中除外）
4. **autoLayout 违反 flex 强制**：对照 Figma 原始 JSON，是否存在 `layoutMode ∈ {HORIZONTAL, VERTICAL}` 的 Frame，输出的 CSS 却用了 `position: absolute` + `top/left`？（此项是 §4.3 判定优先级第 1 条的硬红线）
5. **space-between 表达不忠实**：是否存在 Figma `primaryAxisAlignItems === 'SPACE_BETWEEN'`，输出的 CSS 却用 `margin-left: auto` / `justify-content: flex-end` 等其他手段模拟？
6. **`layoutPositioning` 未落地**：是否存在 Figma `layoutPositioning === 'ABSOLUTE'` 的子节点，输出的 CSS 却没写 `position: absolute` + `top` / `left`（结果被塞进父 flex 顺流，视觉错位）？
7. **子节点 `FILL` / `STRETCH` 未落地**：是否存在 Figma 子节点 `layoutSizingHorizontal === 'FILL'` 或 `layoutAlign === 'STRETCH'`，输出的 CSS 却没写 `width: 100%` / `align-self: stretch`？
8. **`end-` 前缀未生成 wrapper + `space-between` 结构**：图层名带 `end-` 的节点，产物 JSX 里其父容器是否有虚拟 wrapper 包裹前面兄弟、父 CSS 是否设置 `justify-content: space-between`？
9. **页面根容器用死值 `height` 未覆写为 `min-height: max(..., 100vh)`（v0.3.3）**：入口节点满足"页面根容器"三信号时，产物根 CSS 是否用了 `height: {figmaH * scale}px` 死值？必须改成 `min-height: max({figmaH * scale}px, 100vh)`（见 §4.3 判定优先级第 6 条）
10. **`input-` 前缀未生成 `<input>` 标签（v0.3.4）**：图层名带 `input-` 的节点，产物 JSX 是否输出 `<input type="text" placeholder="..." />`？
11. **sub-/block- 容器 FIXED 高度未写 `min-height` 导致塌陷(v1.0.2)**：图层名带 `sub-` / `block-` 前缀、Figma `layoutSizingVertical: FIXED`,产物 CSS 是否用了 `height: {N * scale}px` 死值?必须改成 `min-height: {N * scale}px`
12. **冗余嵌套 autoLayout 的属性未下穿到内层(v1.0.2)**:外层 A 是 autoLayout 且仅有 1 个顺流子 B(其他都是 abs 兄弟),B 也是 autoLayout,且 A/B 都不带 `sub-` 前缀 → A 的 `display: flex` / `padding-*` / `gap` / `justify-content` / `align-items` / `flex-wrap` 必须下穿到 B

**任一项命中 → 该叶子 sub-agent 交付不合格,主 agent 必须回退该块重写**。

#### 6.0.1 assets.txt 消费契约

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
  echo "✅ assets.txt 消费契约通过:$(wc -l < /tmp/declared-assets.txt) 张切图全部在产物中引用"
else
  echo "❌ $UNUSED 张切图未被引用:$(cat /tmp/unused-assets.txt | tr '\n' ' ')"
fi
```

**doctor 关联规则**：IMG028—— assets.txt 声明的切图文件在最终产物中未被引用，参见 pp-doctor §3.6q。

#### 6.0.2 合并忠实度证明块（fast 版精简）

> **pp-d2c-fast**：v1.2 对账上线后，data-node-id 守恒（R21）、SOLID 字色（R06）、fixed/IMAGE/bg 伪元素/space-between（R01/R02/R08/R05）、padding-top（R19）均由 `check-rules.mjs` 逐节点对账覆盖，**不再要求主 agent 手写自证**。此处只保留 check-rules **未覆盖**的三项：图片引用完整性、GRADIENT/IMAGE 字色落地（R04 不在 check-rules）、min-height 尺寸源。

主 agent 在步骤 7（输出交付物清单）**之前**，须在对话输出以下证明块：

```markdown
=== 合并阶段忠实度证明（fast）===

## assets.txt 消费契约（§6.0.1）
- sub-agent 声明切图数：{count(F₁)}
- 最终产物引用切图数：{count(F₂)}
- 差集 F₁ - F₂：{"空" 或 "unused: file1.png, ..."}
- 结果：{✅ 通过 / ❌ 失败}

## GRADIENT/IMAGE 字色落地（R04，check-rules 未覆盖）
- TEXT fills 末位=GRADIENT_*/IMAGE 产物是否用 span + background-clip:text？有无凭空搓 solid color？{✅/❌ 违规 TEXT 列表+错误写法}
- 结果：{✅ 通过 / ❌ 失败}

## sub 容器 min-height 尺寸源（§4.3）
- 逐 sub-/block- 容器 `min-height 写入 == 自身h × scale` 断言错项数：{count(errors)}
- 错项列表（若非零）：{"[节点名] 应写 XXXpx 实写 YYYpx（把兄弟 bg 层高度错写为 min-height）"}
- 结果：{✅ 通过 / ❌ 失败}
```

其余对账项（data-node-id 守恒 / SOLID 字色 / fixed / IMAGE url / bg 伪元素 / space-between / padding-top）由 `check-rules.mjs` exit 0 保证；任一 exit 1 → 合并不算完成，主 agent 回滚重做。

##### 合并前 block 校验汇总（fast 精简）

主 agent 合并 sub-agent 产物前，确认每个 `blocks/*/` 的 `check-rules.mjs` 都 exit 0（fast 版不再手写 rule-hits 消费 N==M 统计——消费到位由 check-rules exit 0 保证）：
- **check-rules.mjs 未通过的 block** → 主 agent 必须回滚该 block 产物，让 sub-agent 修复
- 遗漏补捕（若有）→ 核对 `assets.txt` 是否有 `[遗漏补捕]` 备注；Rule-Scan 降级 → 最终交付 QA 段警示，下轮排查 Rule-Scan 挂的原因

##### 整 page check-rules.mjs 复跑

主 agent 合并完成、生成整个 page 目录后,必须重跑一次 `check-rules.mjs`:

```bash
node .claude/skills/pp-d2c-fast/bin/check-rules.mjs \
  --merge pages/{page}/ \
  --cache-key <fileKey>
```

- exit code: 0(通过) / 1(违规) / 2(环境错)
- **exit 1** → 主 agent 必须修产物或回滚 sub-agent 产物,**不允许**把违规带到步骤 7 交付
- 与步骤 4.0.pre 的 `--block` 模式区别: 那里只扫单个 block 目录;这里扫整个 page 目录,主要防合并时类名冲突/z-index 冲突/幻觉色被引入

##### 兜底防线硬门禁 N=0(v1.1.0)

**这是 4 层防线里的最后一道，与 R16 硬防线配套。**

在整 page `check-rules.mjs` 复跑结果为 **exit 1** 时:

1. **`violations.length > 0` → 一律禁止交付**,主 agent 必须**回滚 sub-agent 产物,重做**;禁止用任何标签"分类判定"后继续走到步骤 7
2. **`[整体切图兜底]` 标签废除**(v1.1.0 起):
   - v1.0.0 时期用于自签"整体切图是合法兜底"的路径已被 **R16 no-flatten-text** 硬防线覆盖
   - assets.txt / 对话中出现该字样 → 视为 agent 试图豁免,必须回滚
3. **`[脚本误判]` 标签**(仅允许豁免真误判):
   - **单次上限 3 条**;第 4 条及以上出现 `[脚本误判]` → 强制回滚,不允许交付
   - **三段证据格式**(缺一条即视为无效豁免):
     ```
     [脚本误判] R0X {nodeId} 理由:
       ① 产物文件:行号 → 例 `pages/test12/index.scss:29`
       ② 该行 grep 命令 → 例 `grep -n "position: fixed" pages/test12/index.scss`
       ③ 产物内容截取(≤5 行) → 粘贴该 grep 命中的实际行
     ```
   - 无三段证据 → 视为无效豁免,该条不计入豁免额度,仍算违规
4. **执行序**:
   ```
   check-rules.mjs → exit 1
       ↓
   分类 violations:
       R16 / R17 命中?      → 一律不豁免,回滚(R16 压平文字 / R17 baked 子孙双渲染,都是硬伤)
       [整体切图兜底]?     → 一律不豁免,回滚(标签已废除)
       [脚本误判] 三段证据? → 单次≤3 条豁免;超上限或缺证据 → 回滚
       其余(含 R02/R06/R18/R19/R20) → 修产物或回 sub-agent 重做
       ↓
   全部处理后重跑 check-rules.mjs → exit 0 → 才允许进入步骤 6.1
   ```

**v1.2.0 对账升级后,check-rules 的报数即真值**:R02/R06 已在 `lib/loadCache.mjs` 层剔除三类假阳性来源(整体切图 baked 子树 / 隐藏节点 / `.map()` 模板数据副本),并统一走 `lib/cssMatch.mjs` 匹配 SCSS `&__` 嵌套。**因此"checker 语义盲点""bg- 父层整体切图承载""装饰性内容"这套 v1.1.0 时期的批量豁免叙事已失去事实基础**——现在 R02 报的就是真遗漏(如 cd-num bg)、R06 报的就是真不可追溯 TEXT、R17 报的就是真双渲染。

**禁止项**:

- 禁止在 assets.txt / 对话中用"临时占位"、"参照邻居 page"、"整体切图兜底"、"用户明确临时"等措辞为违规签豁免
- **禁止用"语义盲点"、"checker 与 bg- 规则冲突"、"装饰性内容"、"父层整体切图承载"、"实际视觉正确"等叙事为 R02/R06/R17/R18/R19/R20 违规批量豁免**(v1.2.0:这些假阳性来源已在 loadCache 层清除,再出现即真违规)
- 禁止把违规条数"分类打标签"后 continue → 步骤 7
- 禁止修改 check-rules.mjs 输出 JSON 里的 `ok` / `violations` 字段来"通过"
- **禁止在生成流程里用 `--force-skip R0X` 跳过任何硬规则**(v1.2.1)：`--force-skip` 仅供**维护者本地调试脚本**用；生成/交付流程中唯一合法豁免是 assets.txt 里的 `[脚本误判]` 三段证据(单次≤3 条)。用 `--force-skip` 让 check-rules 假装 exit 0 = 绕过门禁,视同违规交付
- **禁止对"能从 Figma 精确计算的量"(绝对定位 top/left = (子bbox−父bbox)×scale、尺寸 = bbox×scale、flex 方向 = layoutMode、padding = Figma padding×scale)使用「需人工核对」兜底交付**——这些必须算对,`[需人工核对]` 只留给"设计稿本身语义歧义 / skill 未覆盖的新形态",不含可机械推导的坐标/尺寸/方向/间距(R18/R19/R20 会硬校验,写错即 exit 1)

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

1. `node .claude/skills/pp-d2c-fast/bin/figma.mjs cleanup-tmp`（脚本会 `rm -rf` 掉 `{projectRoot}/.d2c-tmp/screenshots/`）
2. 不清 `.d2c-cache/`——那是持久化缓存，等 `lastModified` 变化时才失效

---

## 禁止项

- 禁止把 `img-` / `bg-` 前缀图层拆解为 CSS 实现(硬规则第 1 条:整体切图,子层不解析)
- 禁止对非 `bg` / `img` 前缀、fills 不含 IMAGE、也不命中"结构性隐式图"(硬规则第 3 条)的节点整体切图(硬规则第 4 条:走 CSS 化)
- 禁止在代码中写 HEX 色值或 px 魔法数字（使用 Token 变量，若项目有）
- 禁止跳过步骤 -1 的预检
- 禁止使用 Figma node ID 作为图片文件名
- 禁止 x- / img- / bg- 向内递归子图层
- 禁止把 `sub-` 前缀当作图层解析规则处理，sub- 仅用于分块判断
- 禁止把 `block-` 块内的元素与其他块的元素合并到同一 HTML 容器或共享 CSS 类名
- 禁止只匹配第一个前缀就停止，必须扫描完整图层名提取所有已知前缀
- 禁止脱离 `images.imageBaseUrl + images.assetsDir + filename` 公式拼接图片 URL；禁止补/删任何字符（包括末尾 `/`）；禁止在 SCSS 中分散硬编码完整 URL，必须先定义 `$asset-prefix` 变量再引用
- 禁止用相对路径下载图片：`curl -o` 落地路径必须是 `{projectRoot}/{assetsDir}/{filename}.{ext}` 绝对路径
- 禁止跳过步骤 2.5 页面级背景采集；禁止把顶层 frame 的页面级背景写到组件根容器；禁止改动项目已有的全局样式文件（base.scss / global.css / app.less 等）；禁止凭印象判定项目特征（必须 Read/Grep 实证后选 P-A / P-B / M-A / M-B / J 策略）；禁止多页面项目使用 P-B / M-B（单页策略，会互相污染）；**禁止在普通 stylesheet（非 module 的 scss/less/css）里写 `:global(...)`、禁止在 `*.module.{scss,less,css}` 里直接写 `body { ... }`**
- 禁止"sub- 只有 1 个就退化为主 agent 处理"；任何 `sub-` 节点都必须分发独立 sub-agent
- 禁止 `scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存；禁止同一节点同时含 `scrollx-` 和 `scrolly-`；禁止省略隐藏滚动条样式（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）
- 禁止把 `sub-scrollx-` / `sub-scrolly-` 节点**整体导出为单张背景图**作为容器 `background-image`
- 禁止调用 Figma `/v1/images` 时省略 `use_absolute_bounds=true`(仅当 config `images.preserveEffectIds` 明示时才省略)
- 禁止 `FIGMA_TOKEN` 无效时直接跳过图片下载或用 Figma S3 临时链接占位
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具
- 禁止跳过步骤 0.3 缓存初始化；禁止绕过 `.d2c-cache/{fileKey}/meta.json` 的 `lastModified` 校验直接读旧缓存
- 禁止 SKILL 结束时不清理 `.d2c-tmp/screenshots/`
- 禁止把 `bg-` 节点的**父容器**当成切图源传给 `/v1/images` API：切图源 nodeId 必须是 `bg-` 节点自己
- 禁止跳过 §4.4 curl 前的**强制前置自检 3 行**(切图源 nodeId / 切图源 name / 交叉验证前缀)
- 禁止把 `bgc-` 节点切成 PNG(bgc- 永远只取节点自身的盒级 CSS 属性写父元素)
- 禁止只取 `bgc-` 节点的 fills 而忽略 strokes/cornerRadius/effects
- 禁止 bg 节点在 h5 产物里生成 DOM(`<div>` / `<img>` / inline style 都不行)：bg 只能通过父容器的独立 `.scss` / `.less` / `.css` 文件的 `background-image` 挂载
- 禁止跳过步骤 6.0「主 agent 逐叶子 sub-block 单独视觉对比」
- 禁止 sub-agent 自己派发孙 sub-agent
- 禁止 sub-agent 在子树扫描时递归到比"自己直接子层"更深的 sub-
- 禁止合并阶段（§5）残留任何 `<__SUBSLOT__>` 标签
- 禁止 `fixed-` 与 `bg-` / `bgc-` / `x-` 叠加
- 禁止 `fixed-` 节点写代码时省略 z-index
- 禁止 `fixed-` 节点跳过 Figma constraints 读取
- 禁止组件函数名、组件文件目录名以 `sub-` / `Sub` 开头
- 禁止 TEXT 节点有多层可见 SOLID fills 时直接取 `fills[0]`：必须按 §4.1.1「TEXT 多层 fills 处理」按 Figma 渲染顺序取末位可见 SOLID
- 禁止命中切图四条硬规则但跳过 REST API 调用：必须按 §4.4.0「切图强制忠实执行」流程走
- 禁止在 assets.txt 中省略 §4.4.0 定义的 3 行溯源
- 禁止 flat 模式合并时用父容器整体切图替代 sub-agent 的拆分产物
- 禁止对 `sub-*` / `block-*` 前缀节点调用 `figma.mjs export-image` 整体切图
- 禁止 flat 模式合并丢失 sub-agent 已挂的 `data-node-id`（§5.1 守恒律；fast 版由 R21 exit 1 拦，不再要求 grep 自证）
- 禁止跳过「assets.txt 消费契约」的 grep 自证
- 禁止跳过步骤 7 之前的「合并忠实度证明块」输出
- 禁止向用户提 skill 已定死的技术决策问题
- 禁止 TEXT 字色取错（非 fills 末位可见 SOLID）——fast 版由 R06 逐节点对账拦，不再要求手写字色溯源
- 禁止 sub-/block- 容器 min-height 写入值 = 兄弟 bg 层高度而非自身高度
- 禁止页面根 padding-top 写入值 ≠ `figmaNode.paddingTop × scale`
- 禁止在样式大类判定时 **参照邻居 page** 覆盖 config.styleFormat（v1.1.0 起 config 为唯一权威）
