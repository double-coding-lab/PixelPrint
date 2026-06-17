# ctrip-train-d2c

Figma 设计稿 → 代码（D2C）工具，包含团队约定配置，适用于增长活动页场景。

## 目录结构

```
ctrip-train-d2c/
├── ctrip-train-d2c.config.json     ← 核心配置（图层约定、组件库、Token 规则）
├── skills/
│   └── ctrip-train-d2c/
│       └── SKILL.md          ← Skill 执行流程
├── code-connect/
│   └── mappings.json         ← Figma 组件 → 代码组件映射表
└── docs/
    └── design-conventions.md ← 给设计师看的约定说明
```

## 快速开始

### 1. 配置项目信息
编辑 `ctrip-train-d2c.config.json`，填入你的项目信息：
- `codeConnect.componentLibrary`：你的组件库包名
- `designTokens.source`：你的 Token 变量文件路径
- `output.dir`：生成代码的输出目录

### 2. 补充组件映射
编辑 `code-connect/mappings.json`，填入：
- `figmaName`：Figma 组件库中的组件名
- `figmaNodeId`：Figma 组件的节点 ID
- `codeComponent`：对应的代码组件名
- `propsMapping`：Figma 属性 → 代码 props 的映射关系

### 3. 同步给设计师
把 `docs/design-conventions.md` 发给设计师，对齐图层命名约定。

### 4. 使用 Skill
在 Claude Code 中：
```
把这份设计稿转成代码：https://figma.com/design/xxx?node-id=1-2
```
Claude 会自动读取本项目的配置，按约定规则执行 D2C。

---

## 图层命名速查

| 前缀 | 含义 | 生成效果 |
|------|------|---------|
| `img__` | 背景/装饰图 | 直接作为图片引用 |
| `icon__` | 图标 | SVG 引用 |
| `comp__` | 业务组件 | 映射到真实组件 |
| `ignore__` | 忽略 | 不生成代码 |
| 无前缀 | 普通图层 | 正常生成代码 |
