# pp-d2c Skill 需求澄清文档

## 背景与目标

在前端项目中提供一个 Claude Code Skill，让 AI 能读取 Figma 设计稿并自动生成前端代码。
目标是完整还原一份设计稿，输出可直接使用的组件代码和样式文件。

后续可能改造为 npm 包形式分发，当前阶段以 SKILL.md + config 文件为交付形态。

---

## 范围

### 包含
- 读取 Figma 链接，解析图层结构
- 按规则将图层分块，用 sub-agent 并行实现各块
- 主 agent 合并各块代码（支持两种合并模式）
- 图片处理：2 倍图临时链接 + 下载到本地静态目录
- 支持 React / React Native 框架，支持多种样式方案，通过 config 配置
- 图层命名前缀解析规则内置到 Skill 中
- **Figma MCP 预检**：执行前检测 MCP 是否可用，不可用则自动写入安装配置
- **PAT 认证支持**：通过环境变量 `FIGMA_ACCESS_TOKEN` 配置 Personal Access Token，免浏览器 OAuth

### 不包含
- 设计师必须遵守的命名规范文档（可选提供，但不作为前提依赖）
- 强制 Token 绑定校验（`qa.requireTokenBinding` 移除）
- 动效代码生成

---

## 图层解析规则

优先级从高到低：

| 条件 | 处理方式 |
|------|---------|
| 图层名以 `img-*` 开头 | 解析为 `<img>`，不再向内递归 |
| 图层名以 `bg-*` 开头 | 解析为背景图（background-image / style），不再向内递归 |
| 图层名以 `font-*` 开头 | 解析为文字节点 |
| 图层名无前缀 + 当前为文本图层（TEXT） | 解析为文字节点 |
| 其他所有情况 | 解析为图片（img 引用），不再向内递归 |

图片统一使用 **2 倍图**（@2x）。

### Code Connect 映射
保留 `code-connect/mappings.json`，但形式可调整。
当图层名以 `comp-*` 开头，且在 mappings 中有对应条目时，直接使用映射的代码组件，不走上述规则。
若 `comp-*` 图层在 mappings 中无匹配，降级按上述规则处理。

---

## 分块与 Sub-agent 策略

### 分块判断逻辑

拿到 Figma 链接，检查目标节点的**子孙节点**：

1. 目标节点有 **Frame 子节点** → 按顶层 Frame 分块，每个 Frame 一个 sub-agent
2. Frame 子节点内部（孙子层）含有 `comp-*` 节点 → `comp-*` 节点**单独拆出**作为独立 sub-agent
3. 目标节点既无 Frame 子节点、也无 `comp-*` → 不分块，单 agent 直接处理整体

> 也就是说：Frame 和 comp-* 都是分块触发条件，comp-* 优先级更高，即使嵌套在 Frame 内也要拆出来单独处理。

### Sub-agent 图片计数规则

各 sub-agent 的图片文件名按顺序编号，段位隔离，避免冲突：

- 第 1 个 sub-agent：`101.png`, `102.png`, ...
- 第 2 个 sub-agent：`201.png`, `202.png`, ...
- 第 N 个 sub-agent：`N01.png`, `N02.png`, ...

图片命名也可根据图层信息自动推断语义名称（如 `banner-bg.png`），但禁止使用 Figma node ID 作为文件名。

---

## 合并模式

主 agent 在各 sub-agent 完成后执行合并，支持两种模式，通过 config 配置：

| 模式 | 说明 |
|------|------|
| `flat`（平铺合并）| 所有 sub-agent 的 JSX 和样式合并到一个 `.tsx` + 一个样式文件中 |
| `component`（子组件引用）| 保留各 sub-agent 的独立组件文件，主文件 import 并调用它们 |

两种模式下，sub-agent 的源文件均**保留**，不删除。

---

## 图片处理

### 临时链接阶段
- 使用 Figma 提供的 2 倍图临时链接
- 若项目环境不支持外部链接（如 RN 本地调试），使用本地路径占位，不做额外处理

### 本地图片阶段
- 所有图片下载到项目静态文件夹（路径在 config 中配置）
- 代码中图片 src 通过 `imageBaseUrl`（config 配置）+ 文件名拼接
- 用户手动上传图片到该目录，或手动替换 src

### config 示例（图片相关）
```json
{
  "images": {
    "assetsDir": "static/figma",
    "imageBaseUrl": "/assets/figma/"
  }
}
```

---

## 框架与样式配置

```json
{
  "project": {
    "framework": "react",      // "react" | "rn"
    "styleFormat": "scss"      // react: "scss" | "css-modules" | "tailwind" | "inline"
                               // rn:    "stylesheet" | "styled-components" | "nativewind"
  }
}
```

默认值：`framework: "react"`，`styleFormat: "scss"`。

---

## 完整 config 结构（目标形态）

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

---

## 关键概念定义

| 概念 | 定义 |
|------|------|
| sub-agent | 负责实现一个 Frame 或一个 `comp-*` 块的独立 AI 执行单元 |
| 主 agent | 协调分块、汇总结果、执行合并的 AI 执行单元 |
| 临时链接 | Figma MCP 返回的图片 URL，有过期时间 |
| 本地图片 | 用户下载后放入 `assetsDir` 的图片文件，代码通过 `imageBaseUrl` 引用 |
| flat 模式 | 所有代码合并到单文件 |
| component 模式 | 各块保持独立组件，主文件 import 组合 |
| PAT | Figma Personal Access Token，用于 MCP 认证，存于环境变量 `FIGMA_ACCESS_TOKEN` |

---

## Figma MCP 预检与认证

### 预检逻辑

Skill 在步骤 0（读取 config）之前增加一个前置预检步骤：
- 尝试调用 Figma MCP 工具（如 `get_metadata`）
- 调用成功 → 直接进入正常流程
- 调用失败 → 判定 MCP 未安装或未认证，进入安装引导

### MCP 安装引导（B 方案：自动写入配置）

预检失败时，Skill 自动调用 Claude Code 的配置写入能力，向 `.claude/settings.json` 写入 Figma MCP 配置：

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

写入后提示用户：
1. 在终端设置环境变量：`export FIGMA_ACCESS_TOKEN=your_token_here`
2. 从 Figma 账户设置页获取 Personal Access Token
3. 重启 Claude Code 后重新执行

### PAT 认证说明

- Token 存储在环境变量 `FIGMA_ACCESS_TOKEN`，不写入任何项目文件
- MCP 配置中通过 `${FIGMA_ACCESS_TOKEN}` 引用，不存明文
- 无需浏览器 OAuth 认证流程

---

## 验收标准

1. 给定任意 Figma 链接，Skill 能自动判断分块方式并分配 sub-agent
2. 每个 sub-agent 输出独立的组件文件 + 样式文件，可单独查看
3. 主 agent 按配置的 `merge.mode` 完成合并
4. 图层命名前缀规则正确执行，`img-*` / `bg-*` 不递归解析内部
5. 图片文件名无 Figma node ID，各 sub-agent 图片编号段位不冲突
6. config 文件覆盖框架、样式、合并模式、图片路径四个维度的配置
7. Figma MCP 未安装时，Skill 自动写入 MCP 配置并引导用户设置 PAT
8. 配置写入后无需浏览器认证，设置环境变量后即可使用

---

## 开放问题（暂无，后续补充）

无。
