# pp-d2c Skill 技术方案

## Requirement Overview

**背景**：在前端项目中提供一个 Claude Code Skill，AI 读取 Figma 设计稿后自动分块、并行生成代码，最终合并为可运行的组件。

**目标**：
- 给定任意 Figma 链接，Skill 自动完成解析 → 分块 → sub-agent 并行实现 → 主 agent 合并的全流程
- 框架、样式方案、合并模式、图片路径全部 config 驱动，零硬编码

**非目标**：
- 动效代码生成
- 强制要求设计师遵守命名规范（前缀规则仅作内置解析依据，不作强制前提）
- Design Token 绑定校验

---

## Key Issues Overview

1. **分块粒度判断**：同一设计稿可能同时存在 Frame 子节点和嵌套 `comp-*` 节点，需明确优先级与递归扫描深度
2. **Sub-agent 图片编号隔离**：多 agent 并行写文件，文件名必须段位隔离，避免覆盖
3. **临时链接有效期**：Figma 图片链接有过期时间，生成代码时需同步下载并替换为本地引用
4. **合并模式差异**：`flat` 和 `component` 两种模式对文件结构影响不同，主 agent 合并逻辑需分支处理
5. **RN 样式隔离**：RN 不支持 SCSS/CSS，框架判断必须在代码生成阶段提前介入
6. **MCP 预检时机**：预检失败需区分「未安装」和「未认证」两种情况，处理方式不同

---

## External Dependencies and Internal Calls

- **Figma MCP**：`get_metadata`、`get_design_context`、`get_screenshot` — 读取图层结构、属性与截图
- **Claude Code 内置能力**：Agent 工具（sub-agent 分发）、Read/Write/Edit（文件操作）、settings.json 写入（MCP 配置安装）
- **code-connect/mappings.json**：`comp-*` 图层的组件映射查找
- **pp-d2c.config.json**：所有配置读取入口
- **环境变量 `FIGMA_ACCESS_TOKEN`**：Figma PAT，由用户设置，MCP 配置中引用

---

## Configuration

### pp-d2c.config.json（v2 完整结构）

```json
{
  "version": "2.0.0",
  "project": {
    "name": "",
    "framework": "react",
    "styleFormat": "scss"
  },
  "merge": {
    "mode": "component"
  },
  "images": {
    "assetsDir": "static/figma",
    "imageBaseUrl": "/assets/figma/"
  },
  "codeConnect": {
    "componentLibrary": "",
    "mappingFile": "code-connect/mappings.json"
  },
  "output": {
    "dir": "src/components/generated"
  }
}
```

**字段说明**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `project.framework` | `"react" \| "rn"` | `"react"` | 目标框架 |
| `project.styleFormat` | string | `"scss"` | react 支持 `scss / css-modules / tailwind / inline`；rn 支持 `stylesheet / styled-components / nativewind` |
| `merge.mode` | `"flat" \| "component"` | `"component"` | 合并模式 |
| `images.assetsDir` | string | `"static/figma"` | 图片下载到本地的目录（相对项目根） |
| `images.imageBaseUrl` | string | `"/assets/figma/"` | 代码中图片 src 的前缀，与文件名拼接 |
| `output.dir` | string | `"src/components/generated"` | 生成代码的输出根目录 |

---

## 交付单元

### SKILL.md 执行流程

整体为七步流程，主 agent 全程驻留，sub-agent 仅承担单块实现。

---

#### 步骤 -1（前置预检）：检测 Figma MCP 可用性

在步骤 0 之前执行，任何情况下都不跳过。

**检测方式**：尝试调用 `get_metadata`（使用空 fileKey 或已知测试值），根据结果判断：

| 结果 | 判断 | 处理 |
|------|------|------|
| 调用成功 | MCP 已安装且已认证 | 直接进入步骤 0 |
| 工具不存在错误 | MCP 未安装 | 写入 MCP 配置 + 引导设置 PAT |
| 认证失败错误 | MCP 已安装但 Token 无效或未设置 | 仅引导设置 PAT，不重写配置 |

**MCP 配置写入**（未安装时）：

向 `.claude/settings.json` 写入以下内容（合并，不覆盖现有配置）：

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-mcp"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}"
      }
    }
  }
}
```

写入后输出引导：

```
Figma MCP 未安装，已自动写入配置。请按以下步骤完成认证：

1. 前往 Figma → 账户设置 → Personal Access Tokens → 创建 Token
2. 在终端执行：export FIGMA_ACCESS_TOKEN=your_token_here
3. 将上述命令加入 ~/.zshrc 或 ~/.bashrc 以持久生效
4. 重启 Claude Code，然后重新执行本 Skill
```

---

#### 步骤 0：读取配置

```
Read("pp-d2c.config.json")
```

提取并缓存：`framework`、`styleFormat`、`merge.mode`、`images`、`output.dir`、`codeConnect.mappingFile`。

---

#### 步骤 1：解析 Figma URL

从用户输入提取：
- `fileKey`：URL `/design/` 后的段
- `nodeId`：`node-id=` 参数，`-` 替换为 `:`

---

#### 步骤 2：扫描图层结构，决定分块方案

调用 `get_metadata(fileKey, nodeId)` 获取目标节点的子孙图层树。

**分块判断逻辑**（按顺序判断）：

```
目标节点
├── 有 Frame 子节点？
│   ├── YES → 每个顶层 Frame 作为一个 block
│   │         同时扫描每个 Frame 内的孙子层：
│   │         ├── 含 comp-* 节点 → 该 comp-* 单独拆出为独立 block
│   │         └── 无 comp-* → Frame 整体为一个 block
│   └── NO  → 无 Frame 子节点
│             ├── 含 comp-* 节点 → 每个 comp-* 为一个 block
│             └── 无 comp-* → 整体为单个 block，不分块
```

产出：block 列表，每项包含 `{ blockId, nodeId, label, agentIndex }`。
`agentIndex` 从 1 开始，对应 sub-agent 序号，用于图片编号段位。

---

#### 步骤 3：主 agent 构造 sub-agent 指令，并行分发

主 agent 向每个 sub-agent 传入：
- 目标 block 的 `nodeId`
- 完整的图层解析规则（见下文）
- `agentIndex`（决定图片编号起始值：`agentIndex * 100 + 1`）
- config 快照（framework、styleFormat、images、output.dir）
- `code-connect/mappings.json` 内容

所有 sub-agent **并行**执行步骤 4。

---

#### 步骤 4：sub-agent 实现单个 block（核心规则）

**4.1 读取设计上下文**

```
get_design_context(fileKey, nodeId)
```

获取：图层树、颜色/间距/字体、参考代码、节点截图。

**4.2 图层解析规则（优先级从高到低）**

| 优先级 | 条件 | 处理方式 | 是否继续递归 |
|--------|------|---------|------------|
| 1 | 图层名以 `comp-*` 开头 且 mappings 有匹配 | 使用映射的代码组件，传入对应 props | 否 |
| 2 | 图层名以 `comp-*` 开头 但 mappings 无匹配 | 降级，按后续规则处理 | 是 |
| 3 | 图层名以 `img-*` 开头 | 生成 `<img>` 引用 | **否** |
| 4 | 图层名以 `bg-*` 开头 | 生成背景图样式 | **否** |
| 5 | 图层名以 `font-*` 开头 | 生成文字节点 | 是 |
| 6 | 无前缀 + 图层类型为 TEXT | 生成文字节点 | — |
| 7 | 其他所有情况 | 生成 `<img>` 引用 | **否** |

规则 3、4、7 命中后不再向内递归子图层。

**4.3 图片处理**

- 所有图片（规则 3/4/7 命中）统一获取 **2 倍图**临时链接
- 同时将图片下载到 `images.assetsDir` 目录
- 文件命名规则：
  - 优先使用图层语义名称（取图层名去掉前缀，转 kebab-case），如 `hero-bg.png`
  - 若无法推断语义名，使用顺序编号：`{agentIndex * 100 + imageCount}.png`，如 `101.png`、`102.png`
  - 禁止使用 Figma node ID 作为文件名
- 代码中图片 src：`{imageBaseUrl}{filename}`，如 `/assets/figma/hero-bg.png`
- 若项目环境不支持外部链接（RN 本地调试），跳过临时链接，直接使用本地路径占位

**4.4 框架适配**

| framework | 组件语法 | 样式生成方式 |
|-----------|---------|------------|
| `react` + `scss` | TSX，className | `.scss` 文件，变量用 `$color-`/`$spacing-` 前缀（若项目有） |
| `react` + `css-modules` | TSX，styles.xxx | `.module.css` 文件 |
| `react` + `tailwind` | TSX，className | Tailwind 工具类，无独立样式文件 |
| `react` + `inline` | TSX，style={{}} | 无独立样式文件 |
| `rn` + `stylesheet` | React Native JSX | `StyleSheet.create({})` 内联 |
| `rn` + `styled-components` | styled-components/native | 无独立样式文件 |
| `rn` + `nativewind` | TSX，className | NativeWind 工具类 |

**4.5 sub-agent 输出文件结构**

```
{output.dir}/blocks/{label}/
├── index.tsx        ← 组件主体
├── index.scss       ← 样式文件（按 styleFormat 决定是否生成及格式）
└── assets.txt       ← 本 block 使用的图片清单（文件名 + 原始 Figma 临时链接）
```

---

#### 步骤 5：主 agent 等待所有 sub-agent 完成，执行合并

**合并模式：`component`（默认）**

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 主文件，import 各 block 子组件并组合
│   └── index.scss       ← 主样式文件（仅做 block 样式的 @import）
└── blocks/              ← 保留，不删除
    ├── block1/
    ├── block2/
    └── ...
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

**合并模式：`flat`**

```
{output.dir}/
├── ComponentName/
│   ├── index.tsx        ← 所有 block 的 JSX 平铺合并到一个文件
│   └── index.scss       ← 所有 block 的样式合并到一个文件
└── blocks/              ← 保留，不删除
```

合并时：
- JSX 内容按 block 顺序合并，每段加注释分隔 `{/* --- block1 --- */}`
- 样式文件按顺序追加，类名保持 block 各自的命名空间（不重命名）
- 若有类名冲突，主 agent 自动加 block 名前缀解决

---

#### 步骤 6：QA 视觉对比

调用 `get_screenshot(fileKey, nodeId)` 获取整体截图，与生成代码做视觉差异分析：
- 列出主要差异点
- 可自动修正的差异（如颜色偏差、间距误差）自动修正
- 不可自动修正的差异（如字体缺失、动效）输出到交付清单

---

#### 步骤 7：输出交付物清单

```
✅ 生成文件：{output.dir}/ComponentName/
📦 需下载图片：（列出 assets.txt 汇总，含原始临时链接）
⚠️  需手动处理：（QA 发现的不可自动修正差异）
```

---

### pp-d2c-init Skill

独立 Skill，负责环境检测、MCP 安装、PAT 引导、config 交互式配置。每次执行都会重新走完整配置流程，可用于初次安装或重置配置。

**触发方式**：用户执行 `/pp-d2c-init`，或主 Skill 预检失败时提示用户执行。

**执行流程**：

**阶段一：Figma MCP 检测与安装**

1. 尝试调用 Figma MCP 工具检测可用性
2. 未安装 → 向 `.claude/settings.json` 写入 MCP 配置（合并，不覆盖现有其他配置）：
   ```json
   {
     "mcpServers": {
       "figma": {
         "command": "npx",
         "args": ["-y", "figma-mcp"],
         "env": {
           "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}"
         }
       }
     }
   }
   ```
3. 已安装但未认证 → 跳过写入，直接进入 PAT 引导

**阶段二：PAT 认证引导**

无论 MCP 是否已安装，都检测 `FIGMA_ACCESS_TOKEN` 是否有效：
- 未设置或无效 → 输出引导：
  ```
  请按以下步骤设置 Figma Personal Access Token：
  1. 前往 Figma → 账户设置 → Personal Access Tokens → 创建 Token
  2. 在终端执行：export FIGMA_ACCESS_TOKEN=your_token_here
  3. 将上述命令加入 ~/.zshrc 或 ~/.bashrc 以持久生效
  4. 完成后重新执行 /pp-d2c-init 继续配置
  ```
  → 终止，等待用户处理后重新执行
- 有效 → 继续阶段三

**阶段三：交互式配置 pp-d2c.config.json**

逐项询问用户，每项显示当前值（若已有 config），回车保持不变：

```
[1/5] 项目框架 (react / rn) [当前: react]：
[2/5] 样式方案
      react 可选: scss / css-modules / tailwind / inline
      rn 可选:    stylesheet / styled-components / nativewind
      [当前: scss]：
[3/5] 合并模式 (flat / component) [当前: component]：
[4/5] 图片输出目录 [当前: static/figma]：
[5/5] 图片 base URL（代码中拼接用）[当前: /assets/figma/]：
```

额外询问（可选）：
```
组件库包名（留空跳过）[当前: ]：
代码输出目录 [当前: src/components/generated]：
```

所有配置确认后，写入 `pp-d2c.config.json`（完整覆盖）。

**阶段四：初始化 code-connect/mappings.json**

- 若文件不存在 → 写入空模板
- 若文件已存在 → 询问是否重置（默认否）

**阶段五：完成输出**

```
✅ Figma MCP 已就绪
✅ pp-d2c.config.json 已更新
✅ code-connect/mappings.json 已就绪

现在可以执行：把这份设计稿转成代码：https://figma.com/design/xxx
```

若阶段一写入了新 MCP 配置，在完成输出前额外提示：
```
⚠️  MCP 配置已写入，需重启 Claude Code 后生效。重启后重新执行 /pp-d2c-init 完成配置。
```

---

**主 Skill 预检简化**（步骤 -1 调整）：

init 独立后，主 Skill 的预检步骤 -1 只做一件事：
- 检测 Figma MCP 是否可用
- 不可用 → 提示「请先执行 /pp-d2c-init 完成环境配置」，终止
- 可用 → 继续

不再在主 Skill 中内置安装和引导逻辑。

---

### config 文件（v2 升级）

**变更点（相对现有 v1）**：
- 移除 `designTokens` 整段
- 移除 `qa.requireTokenBinding`
- 新增 `merge.mode`
- 新增 `images.assetsDir` / `images.imageBaseUrl`
- `conventions` 段移除（前缀规则内置到 SKILL.md，不再在 config 中声明）

---

### code-connect/mappings.json（保留，结构微调）

新增 `figmaPrefix` 字段，明确该映射对应的图层前缀（默认 `comp-`）：

```json
{
  "components": [
    {
      "figmaPrefix": "comp-",
      "figmaName": "Button/Primary",
      "figmaNodeId": "",
      "codeComponent": "ActivityButton",
      "importPath": "@ctrip/trn-growth-activity-components",
      "propsMapping": {
        "Label": "children",
        "State": "disabled",
        "Size": "size"
      }
    }
  ]
}
```

`figmaNodeId` 仍为可选，填入后可精确匹配，空字符串则降级为名称模糊匹配。

---

## Call Flow

```
用户输入 Figma 链接
  → 步骤 -1：预检 Figma MCP 可用性
      → 未安装：写入 MCP 配置 → 引导设置 PAT → 终止，等待用户重启
      → 未认证：引导设置 PAT → 终止，等待用户重启
      → 已就绪：继续
  → 步骤 0：读 config
  → 步骤 1：解析 URL
  → 步骤 2：get_metadata → 生成 block 列表
  → 步骤 3：主 agent 并行分发 sub-agent（每 block 一个）
      → 步骤 4（并行）：各 sub-agent get_design_context → 解析图层 → 下载图片 → 生成 block 代码
  → 步骤 5：主 agent 按 merge.mode 合并
  → 步骤 6：get_screenshot → QA 视觉对比
  → 步骤 7：输出交付物清单
```

---

## 文件结构变更（相对现有项目）

| 文件 | 操作 | 说明 |
|------|------|------|
| `pp-d2c.config.json` | **重写** | 升级为 v2 结构，移除 designTokens/conventions |
| `skills/pp-d2c/SKILL.md` | **重写** | 按本方案七步流程重写，预检简化为一行提示 |
| `skills/pp-d2c-init/SKILL.md` | **新增** | init 独立 Skill，负责安装/认证/配置全流程 |
| `code-connect/mappings.json` | **微调** | 新增 `figmaPrefix` 字段 |
| `docs/design-conventions.md` | **保留或删除** | 不再作为前提依赖，可选保留作参考 |

---

## 验收标准

1. 给定含 Frame 子节点的 Figma 链接，自动按 Frame 分块并并行处理
2. Frame 内的 `comp-*` 节点单独拆出，不与 Frame 合并处理
3. `img-*` / `bg-*` / 无前缀非文本图层，不向内递归，直接输出图片引用
4. 各 sub-agent 图片编号段位不冲突（第 N 个从 `N*100+1` 开始）
5. 图片代码 src 为 `imageBaseUrl + filename`，不含 Figma node ID
6. `merge.mode=flat` 时所有 JSX/样式合并到单文件；`component` 时主文件 import 各 block
7. 两种模式下 blocks/ 目录均保留不删除
8. 更换 `framework`/`styleFormat` 后重新执行，输出代码语法正确切换
9. `/pp-d2c-init` 每次执行均重走全部配置流程，可用于初次安装或重置
10. MCP 未安装时 init 自动写入配置；PAT 未设置时输出引导并终止，不静默跳过
11. 主 Skill 预检失败只提示「请先执行 /pp-d2c-init」，不自行处理安装逻辑
