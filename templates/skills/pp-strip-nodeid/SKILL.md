# pp-strip-nodeid Skill

> 一键清理 D2C 生成产物里注入的 `data-node-id="..."` 调试锚点,同时**顺手把 nodeId → 代码位置的映射存到 `.d2c-cache/anchors/`**,供 `pp-fix-partial` 局部修复时精确定位。
>
> 在 D2C 生成阶段，每个 DOM/JSX 节点上会带一个 `data-node-id` 属性用于反查 Figma 节点位置（方便 review 和主 agent 逐 block 验收）。这些属性**只在开发/调试阶段有价值**，上线前必须清理，避免产物体积膨胀 + 调试信息泄露到线上。但直接剥了 nodeId 就意味着"局部修复"再也定位不到 → 所以剥之前先把锚点位置存到 `.d2c-cache/anchors/`,两全其美。

## 触发条件

- 用户说：「清一下 data-node-id」「去掉 nodeId」「上线前清理调试属性」「D2C 产物清理」
- 直接 `$pp-strip-nodeid`
- `pp-d2c` 主流程完成后，用户在 review 通过后主动触发

## 执行流程

### 步骤 0：确认目标目录

从 `pp-d2c.config.json` 读 `output.dir`（例如 `pages/`）；若配置文件缺失，默认扫描 `pages/`。

允许用户指定其他目录（例如 `components/`），此时用 `--dir <path>` 覆盖。

### 步骤 1：先跑 dry-run 预览

**必须**先跑 dry-run，让用户看清将要改动多少文件、共清理多少处：

```bash
node .claude/skills/pp-strip-nodeid/strip-node-id.mjs --dry-run
```

输出示例：

```
[strip-node-id] mode        : dry-run（未写盘）
[strip-node-id] scanDir     : pages
[strip-node-id] extensions  : tsx, jsx, ts, js, html, htm
[strip-node-id] anchors     : 写入 .d2c-cache/anchors/
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
node .claude/skills/pp-strip-nodeid/strip-node-id.mjs
```

**实际清理时**会:
1. 剥前先扫一遍每个 `data-node-id="X"`,把 nodeId → { file, startLine, endLine } 存到 `.d2c-cache/anchors/<pageDirSlug>.json`
   - `pageDirSlug` = scanDir 下第一层目录名(如 `pages/Italo/index.jsx` → slug=`Italo`),scanDir 根直下的文件用 `__root__`
   - 同 nodeId 出现多次时只记第一次(通常不会重复)
   - JSX 元素起始位置 = 从 attr 往前找最近的 `<Tag`,结束位置 = 往后找该标签的 `>` 或 `/>`
2. 再剥属性
3. 输出 anchors 写入统计:`anchors written: N 个锚点 → M 个 page 档案`

**加 `--no-anchors` 关掉**:如果项目里不用 pp-fix-partial(比如只是上线前一次性清理,不打算做局部修复),可以加 `--no-anchors` 跳过 anchor 档案写入,只做剥除。

### 步骤 3：产出摘要

清理完成后向用户汇报：
- 扫描文件数
- 改动文件数
- 清理属性总数
- Anchors 写入的锚点数 / page 档案数
- 建议下一步：`git diff` 复核 / 跑 lint / 跑构建

## 参数

| 参数 | 说明 |
|------|------|
| `--dry-run` / `-n` | 只预览，不写盘 |
| `--dir <path>` | 覆盖扫描目录（默认取 config `output.dir`） |
| `--ext tsx,jsx` | 覆盖扫描扩展名（逗号分隔，不带点；默认 `tsx,jsx,ts,js,html,htm`） |
| `--no-anchors` | 不写 `.d2c-cache/anchors/` 档案,只做剥除 |

## 匹配规则

正则：`/\s+data-node-id\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g`

覆盖三种写法：
- `data-node-id="1:2"`（双引号）
- `data-node-id='1:2'`（单引号）
- `data-node-id={\`1:2\`}` / `data-node-id={id}`（JSX 花括号）

前导空格一起清理，避免留下 `<div  >` 这种双空格。

自动跳过 `node_modules/` / `.git/` / `dist/` / `build/`。

## Anchors 档案结构

`.d2c-cache/anchors/<pageDirSlug>.json`:

```json
{
  "138:1797": { "file": "pages/Italo/index.jsx", "start": 3, "end": 3 },
  "138:1810": { "file": "pages/Italo/index.jsx", "start": 7, "end": 10 },
  "138:1900": { "file": "pages/Italo/blocks/sub-card-list/index.jsx", "start": 12, "end": 60 }
}
```

nodeId 统一规范化为**冒号形式**(`138:1830`,不是 `138-1830`)作 key,便于 pp-fix-partial 侧与 figma REST 返回值直接对齐。

**注意**:anchors 档案不入 git(`.d2c-cache/` 已在 .gitignore),每次剥属性都会重新生成。

## 禁止

- 禁止跳过 dry-run 直接写盘：D2C 产物文件多，一旦正则误伤（例如项目里有别的 `data-node-id` 用途）不好回滚；必须先让用户看清命中范围
- 禁止对非 D2C 生成目录（例如项目通用 `src/` 根）默认执行：默认只扫 `output.dir`，其他目录必须 `--dir` 显式指定
- 禁止在生成阶段跳过 `data-node-id` 注入：这个属性是主 SKILL §6.0 逐 block 视觉验收阶段的反查锚点 + pp-fix-partial 局部定位的锚点,生成时必须注入；只在**上线前**用本 skill 清理
- 禁止在剥属性后手工删除 `.d2c-cache/anchors/`:该目录是 pp-fix-partial 精确定位的关键;要清缓存请走 `npx @double-coding/pixel-print clean-cache`(会一致地清 figma / images / anchors / last-page,不会只清一半)

