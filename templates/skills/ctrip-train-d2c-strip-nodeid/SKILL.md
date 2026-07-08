# ctrip-train-d2c-strip-nodeid Skill

> 一键清理 D2C 生成产物里注入的 `data-node-id="..."` 调试锚点。
>
> 在 D2C 生成阶段，每个 DOM/JSX 节点上会带一个 `data-node-id` 属性用于反查 Figma 节点位置（方便 review 和主 agent 逐 block 验收）。这些属性**只在开发/调试阶段有价值**，上线前必须清理，避免产物体积膨胀 + 调试信息泄露到线上。

## 触发条件

- 用户说：「清一下 data-node-id」「去掉 nodeId」「上线前清理调试属性」「D2C 产物清理」
- 直接 `$ctrip-train-d2c-strip-nodeid`
- `ctrip-train-d2c` 主流程完成后，用户在 review 通过后主动触发

## 执行流程

### 步骤 0：确认目标目录

从 `ctrip-train-d2c.config.json` 读 `output.dir`（例如 `pages/`）；若配置文件缺失，默认扫描 `pages/`。

允许用户指定其他目录（例如 `components/`），此时用 `--dir <path>` 覆盖。

### 步骤 1：先跑 dry-run 预览

**必须**先跑 dry-run，让用户看清将要改动多少文件、共清理多少处：

```bash
node .claude/skills/ctrip-train-d2c-strip-nodeid/strip-node-id.mjs --dry-run
```

输出示例：

```
[strip-node-id] mode        : dry-run（未写盘）
[strip-node-id] scanDir     : pages
[strip-node-id] extensions  : tsx, jsx, ts, js, html, htm
[strip-node-id] files scan  : 42
[strip-node-id] files hit   : 8
[strip-node-id] attrs strip : 137

[strip-node-id] 命中文件：
  · pages/Home/index.tsx
  · pages/Home/BlockA/index.tsx
  ...
```

### 步骤 2：用户确认后实际清理

用户确认无误后，去掉 `--dry-run` 重跑：

```bash
node .claude/skills/ctrip-train-d2c-strip-nodeid/strip-node-id.mjs
```

### 步骤 3：产出摘要

清理完成后向用户汇报：
- 扫描文件数
- 改动文件数
- 清理属性总数
- 建议下一步：`git diff` 复核 / 跑 lint / 跑构建

## 参数

| 参数 | 说明 |
|------|------|
| `--dry-run` / `-n` | 只预览，不写盘 |
| `--dir <path>` | 覆盖扫描目录（默认取 config `output.dir`） |
| `--ext tsx,jsx` | 覆盖扫描扩展名（逗号分隔，不带点；默认 `tsx,jsx,ts,js,html,htm`） |

## 匹配规则

正则：`/\s+data-node-id\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g`

覆盖三种写法：
- `data-node-id="1:2"`（双引号）
- `data-node-id='1:2'`（单引号）
- `data-node-id={\`1:2\`}` / `data-node-id={id}`（JSX 花括号）

前导空格一起清理，避免留下 `<div  >` 这种双空格。

自动跳过 `node_modules/` / `.git/` / `dist/` / `build/`。

## 禁止

- 禁止跳过 dry-run 直接写盘：D2C 产物文件多，一旦正则误伤（例如项目里有别的 `data-node-id` 用途）不好回滚；必须先让用户看清命中范围
- 禁止对非 D2C 生成目录（例如项目通用 `src/` 根）默认执行：默认只扫 `output.dir`，其他目录必须 `--dir` 显式指定
- 禁止在生成阶段跳过 `data-node-id` 注入：这个属性是主 SKILL §6.0 逐 block 视觉验收阶段的反查锚点，生成时必须注入；只在**上线前**用本 skill 清理
