# pp-d2c-reskin Skill

> 用户给一批 figma 稿子,本 skill 按 `img` / `bg` 前缀规则扫图层树,把命中节点单独切图,归到 `<assetsDir>/theme-<slug>/` 子目录。**两种工作模式**:
>
> - **有基线**:先有一套跑过 pp-d2c 的页面(或用 `--base <url>` 显式指定基线稿),skill 按基线的切图清单去每套稿子上找**同名节点**切图,并报告 miss。用于"多套换肤稿对齐同一套代码"场景。
> - **无基线(standalone)**:什么参考都没有,skill 对每套稿子**独立扫**自己的图层树,前缀命中就切。用于"美术直接扔几套稿子,你只管按前缀规则切图"场景。

## 触发条件

- 用户说:「按图层前缀规则批量切图」「reskin 切图」「多套色版切图」「帮我把这几套稿子的 img/bg 切下来」
- 直接 `$pp-d2c-reskin --theme red=<figmaUrl> --theme gold=<figmaUrl> ...`

**不适用**:
- 需要生成代码结构 → 用主 `pp-d2c` / `pp-d2c-rn`
- 单张零散图片压缩 → 用 `pp-image-compress`
- 页面某一小块重生成 → 用 `pp-fix-partial`

## 前置条件

1. 项目根有 `pp-d2c.config.json`(跑过 `npx @double-coding/pixel-print init`,skill 从这里读 `images.assetsDir`)
2. `.env` 里配好 `FIGMA_TOKEN`(与主 pp-d2c 复用)
3. Node 18+(用内置 fetch)
4. **无强制要求**跑过基线;有则用,无则走 standalone

## 执行流程

### 步骤 0:识别当前模式

skill 启动时按以下优先级确定基线来源:

1. 用户传 `--base <figmaUrl>` → 用这个作为基线(**有基线**)
2. `.d2c-cache/last-page.json` 存在且完整 → 用主 SKILL 最近实现的整页作为基线(**有基线**)
3. 都没有 → **无基线**,走 standalone 模式

启动信息会明确打印当前模式(`base: <fileKey/nodeId (source)>` 或 `base: 无(standalone 模式,每套稿子独立切)`),避免用户以为在跟基线对齐但其实在 standalone。

### 步骤 1(可选):有基线时先跑 dry-run 看清单

**有基线时推荐**:先跑 dry-run 让用户确认清单再执行:

```bash
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs --dry-run
# 或显式指定基线
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs --base <baseFigmaUrl> --dry-run
```

**无基线时可跳过**:standalone 模式没有跨稿清单可预览,直接跑就行。真想预演可以先只传一套稿子看输出。

### 步骤 2:切图

正式跑,加上一套或多套 `--theme`:

```bash
# 有基线:每套稿子对齐基线切图清单
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs \
  --theme red=https://www.figma.com/design/DEF456/xxx?node-id=999-1 \
  --theme gold=https://www.figma.com/design/DEF456/xxx?node-id=999-2

# 无基线:每套稿子独立扫自己的图层树
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs \
  --theme spring=https://www.figma.com/design/AAA/xxx?node-id=1-1 \
  --theme autumn=https://www.figma.com/design/BBB/xxx?node-id=2-1
```

**有基线模式** 对每套稿子:
1. `figma.mjs fetch-node` 拉换肤子树
2. 按 **name 严格匹配**基线切图清单里的每一项
3. 命中 → `figma.mjs export-image` 切图 → 归位到 `<assetsDir>/theme-<slug>/<原文件名>.png`
4. 未命中 → 记入 miss 报告(不阻断其它命中)

**无基线模式** 对每套稿子:
1. `figma.mjs fetch-node` 拉稿子子树
2. 直接遍历,`img` / `bg` / `img-*` / `bg-*` 前缀命中的节点就是切图位(每套稿子自扫独立清单)
3. 逐位 `export-image` → `<assetsDir>/theme-<slug>/<name>.png`
4. 切图报错 → 记入 err 列表(不阻断其它)

### 步骤 3:产出汇总

脚本会输出每套稿子的模式标签(`[aligned-to-base]` / `[standalone]`)、hit/miss/err 数、miss 节点名列表、输出子目录路径。Agent 建议:

- **有基线** miss 多 → 让美术检查换肤稿图层命名是否与基线一致
- **无基线** hit 数远低于预期 → 让美术检查是否把该切的图层加了 `img` / `bg` 前缀
- 业务代码推荐写法:一个 `themeKey → assetsSubDir` 的映射就能切主题(有基线时文件名与基线对齐;无基线时不同稿子文件名可能不一致,以稿内实际图层名为准)

## 参数

| 参数 | 说明 |
|------|------|
| `--theme <name>=<figmaUrl>` | 一套稿子(可重复传多次);name 会 slug 化用作子目录名。至少传一套(除非 `--dry-run`) |
| `--dry-run` / `-n` | 只扫基线切图清单(有基线时),不拉稿子也不切图 |
| `--base <figmaUrl>` | 显式指定基线 URL(优先级高于 `last-page.json`) |
| `--prefix <list>` | 覆盖切图前缀(逗号分隔,不带 `-`;默认 `img,bg`) |

## 切图清单如何认定

**基线切图位** = 基线子树中 name 匹配以下任一形式的所有节点(与 pp-d2c 主 SKILL §4 图层前缀体系对齐):

- `img` / `img-*` → 整层导出为 PNG(前景图片)。裸 `img` = 整块图片(整层就是图);`img-<name>` = 带语义的图片图层
- `bg` / `bg-*` → 背景图片(写父元素 `background-image`)。裸 `bg` = 整块背景;`bg-<name>` = 带语义的背景图层

**为什么支持裸标签**:美术在 figma 里给整块背景/整层图片命名时,可能直接叫 `bg` / `img`,不加子命名(尤其是内容语义已经很明显、不需要区分多张图的场景)。skill 兼容两种写法。

**裸 `img` / `bg` 的产物文件名**:因为没有子名,skill 会用**父节点 name** 作为文件名基础(如父节点 `sub-hero-card` 下的裸 `bg` → `hero-card__bg.png`),避免多个裸 `bg` 撞名。

**同 name 去重**:同一 name 在 auto-layout 里重复出现只切一次(通常是设计稿里循环卡片背景之类)。

## 换肤节点匹配规则(仅有基线时执行)

**只有"有基线"模式才做跨稿匹配**。对每一个基线切图位,在换肤子树里找**同 key** 的第一个节点:

- 带子名(`img-hero` / `bg-card-top`)→ key = name(全局唯一)
- 裸标签(`img` / `bg`)→ key = `<父节点 name>||<name>`(避免同名裸标签撞车)
- 命中 → 切图落到 `<assetsDir>/theme-<slug>/<原文件名>.png`
- 未命中 → 记入 miss 报告并**继续处理下一项**,不中断整套

**为什么这样匹配**:换肤稿本质是"复制基线稿改颜色",图层名理应保持一致。设计侧若改了图层名,skill 报 miss 让美术回改,比容错匹配可能"切错节点"要好。

**无基线模式(standalone)** 不做跨稿匹配 —— 每套稿子按自身图层树独立扫,前缀命中就切,不与其它稿子对齐。

## 输出目录

```
<assetsDir>/
├── hero.png            ← 基线(主 pp-d2c 产出)
├── card-top.png
├── cta-button.png
├── theme-red/          ← 本 skill 产出
│   ├── hero.png
│   ├── card-top.png
│   └── cta-button.png
└── theme-gold/
    ├── hero.png
    ├── card-top.png
    └── cta-button.png
```

**有基线模式下文件名与基线严格对齐**,方便业务代码写一个 `themeKey → assetsSubDir` 的映射就能切主题:

```js
// 示例映射
const THEME_DIR = { default: '', red: 'theme-red/', gold: 'theme-gold/' }
const heroSrc = `./assets/${THEME_DIR[themeKey]}hero.png`
```

**无基线模式下文件名以每套稿子内实际图层名为准**,不同稿子间不保证文件名一致(靠美术自己保持图层命名规范)。

## 与其他 skill 的分工

| 场景 | 用哪个 |
|---|---|
| 首次整页 D2C | `pp-d2c` / `pp-d2c-rn` |
| 页面某一块单独重跑 | `pp-fix-partial` |
| 换肤稿子批量切图 | **`pp-d2c-reskin`(本 skill)** |
| 上线前剥 `data-node-id` | `pp-strip-nodeid` |
| 零散图片无损压缩 | `pp-image-compress` |

## 缓存与幂等

- 复用 pp-d2c 的 `.d2c-cache/figma/` / `.d2c-cache/images/` 缓存,同一 (fileKey, nodeId) 已切过的图直接复用(`figma.mjs export-image` 内置)
- 想强制重切某套 → `npx @double-coding/pixel-print clean-cache` 清整个 `.d2c-cache/`,或手动删 `.d2c-cache/<themeFileKey>/`
- 已存在的 `theme-<slug>/<name>.png` 会被**覆盖**(每次都从 figma 拉新的);想保护旧文件用 git 复核

## 禁止

- **有基线时**禁止跳过 dry-run 直接切图:一旦基线清单认错(比如 `last-page.json` 是老的 fileKey)会白切一堆无用图。**无基线时**没有跨稿清单可预览,直接跑即可
- 禁止把 `--theme` 的 name 写成含 `/` 或空格的字符串:会被 slug 化成 `-`,可读性差;推荐纯英文小写短名(red / gold / cny-2026)
- 禁止直接改 `figma.mjs`:切图能力从 pp-d2c 借,主 SKILL 升级 figma.mjs 时本 skill 自动跟随
- 禁止指望本 skill 生成代码:它只切图,不产任何 `.tsx` / `.jsx`;要代码走主 pp-d2c / pp-d2c-rn
