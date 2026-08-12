---
name: pp-d2c-reskin
description: 按 img/bg 前缀扫描 Figma 图层树批量切图并归入 theme 子目录，用于多套换肤稿对齐同一套代码；触发：pp-d2c-reskin、换肤、reskin、批量切图
---

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
1. 内嵌的 Figma REST 客户端拉换肤稿子树
2. 按 **name 严格匹配**基线切图清单里的每一项
3. 命中 → `GET /v1/images` 拿 CDN URL → 下载到 `<assetsDir>/theme-<slug>/<原文件名>.png`
4. 未命中 → 记入 miss 报告(不阻断其它命中)

**无基线模式** 对每套稿子:
1. 内嵌的 Figma REST 客户端拉稿子子树
2. 直接遍历,`img` / `bg` / `img-*` / `bg-*` 前缀命中的节点就是切图位(每套稿子自扫独立清单)
3. 逐位导出 → `<assetsDir>/theme-<slug>/<name>.png`
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
| `--dedupe-siblings` | 同父下同名节点只切第一个。默认关闭 —— 全都切,同名冲突用父路径前缀区分。**仅在 auto-layout 循环卡片刻意重复、切一次就够的场景才打开** |

## 切图清单如何认定

**基线切图位** = 基线子树中 name 匹配以下任一形式的所有节点(与 pp-d2c 主 SKILL §4 图层前缀体系对齐):

- `img` / `img-*` → 整层导出为 PNG(前景图片)。裸 `img` = 整块图片(整层就是图);`img-<name>` = 带语义的图片图层
- `bg` / `bg-*` → 背景图片(写父元素 `background-image`)。裸 `bg` = 整块背景;`bg-<name>` = 带语义的背景图层

**为什么支持裸标签**:美术在 figma 里给整块背景/整层图片命名时,可能直接叫 `bg` / `img`,不加子命名(尤其是内容语义已经很明显、不需要区分多张图的场景)。skill 兼容两种写法。

**裸 `img` / `bg` 的产物文件名**:因为没有子名,skill 会用**父节点 name** 作为文件名基础(如父节点 `sub-hero-card` 下的裸 `bg` → `hero-card__bg.png`),避免多个裸 `bg` 撞名。

**同 name 处理(默认全切,加 `--dedupe-siblings` 才去重)**:

- 跨父同名(3 个 `img-icon` 分处 Frame 722 / 726 / 730)→ **全部切出**,文件名自动加最近具体祖先前缀区分:`frame-722__icon.png` / `frame-726__icon.png` / `frame-730__icon.png`
- 同父同名(auto-layout 里循环卡片背景之类)→ 默认也全切,但如果确定只需一份,加 `--dedupe-siblings` 只切第一个
- 极少数二次撞名(父路径 slug 又相同)→ 再拼 nodeId 兜底,不丢图

**不再要求美术回改图层名**;skill 端自动消解冲突。

## 换肤节点匹配规则(仅有基线时执行)

**只有"有基线"模式才做跨稿匹配**。对每一个基线切图位,在换肤子树里找**同 key** 的对应节点:

- 匹配 key 恒为 **`<父节点 name>||<name>`**(裸标签、带子名统一走此规则)
- 同 matchKey 的多个节点(3 个 `img-icon` 各挂不同父)按遍历顺序**一一配对**:基线第 1 个对应换肤稿第 1 个,基线第 2 个对应换肤稿第 2 个
- 命中 → 切图落到 `<assetsDir>/theme-<slug>/<原文件名>.png`(文件名由 `resolveFilenameCollisions` 决定,同 basename 会加父路径前缀)
- 未命中 → 记入 miss 报告并**继续处理下一项**,不中断整套;miss 原因会区分「换肤稿无对应节点」还是「换肤稿仅 N 个同结构节点,基线第 M 个无匹配」

**为什么这样匹配**:换肤稿本质是"复制基线稿改颜色",图层树理应保持一致(含父节点命名与循环结构数量)。若换肤稿把**父 Frame 改名了**、或循环卡片数量与基线不一致,skill 会报 miss 让美术回改 —— 比容错匹配可能"切错节点"要好。

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

## 排查切图不符预期(给下游 agent 的硬规)

跑完 skill 后若发现某张 PNG "少东西 / 尺寸不对 / 内容不符预期",按以下顺序排查,**别自己临时写脚本发挥**:

1. **断言 PNG 内容前必须先重跑本 skill**  
   本地 `.png` 是**上一次跑的产物**,设计稿改动后不会自动同步。拿旧 PNG 当"当前行为"的证据是最常见的误诊来源。汇总行会打**产物写入时间**,与设计稿修改时间对比,晚于设计稿改动才是当前状态。

2. **看 `absoluteRenderBounds`,不是 `absoluteBoundingBox`**  
   Figma REST 返回**两个** bbox 字段:
   - `absoluteBoundingBox` = 图层名义框(不含描边 / 投影 / 子元素溢出)
   - `absoluteRenderBounds` = **实际渲染范围**(含以上所有),**Figma 出图按此裁剪**  
   本 skill 主 log 每一行 `render=W×H` 就是 renderBounds,直接读它,别 curl API 挑错字段。

3. **同名图层现在会全部切出**(带父路径前缀区分),**不要**建议美术回改图层名  
   3 个 `img-icon` 分处不同父 Frame → 会看到 `frame-722__icon.png` / `frame-726__icon.png` / `frame-730__icon.png`。若只想切一次(循环卡片背景之类),用 `--dedupe-siblings`。

4. **mask / clip 会锁 renderBounds**  
   GROUP 内有 mask RECTANGLE 时,Figma 的 renderBounds 会被锁在 mask 之内,子节点跑出 mask 范围的部分不会出图。这是 Figma 的规则,skill 端**无法绕过**(`/v1/images` 不接自定义 bbox)。修复只能改设计稿:
   - 把 mask 拉大到包住溢出内容,或
   - 把溢出的子节点(如浮动文字)移出 GROUP,由代码单独渲染

5. **想深入排查**:直接 `curl -H "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/files/<key>/nodes?ids=<a>:<b>"` 拉节点树,先看 `absoluteRenderBounds`,再决定"是设计稿问题"还是"skill 问题"。

## 与其他 skill 的分工

| 场景 | 用哪个 |
|---|---|
| 首次整页 D2C | `pp-d2c` / `pp-d2c-rn` |
| 页面某一块单独重跑 | `pp-fix-partial` |
| 换肤稿子批量切图 | **`pp-d2c-reskin`(本 skill)** |
| 上线前剥 `data-node-id` | `pp-strip-nodeid` |
| 零散图片无损压缩 | `pp-image-compress` |

## 缓存与幂等

- **无缓存**:本 skill 是纯 REST 直连 Figma,每次都拉最新数据。这是刻意选择 —— 换肤场景通常是"美术改稿后重跑",缓存反而让你切到旧图
- 已存在的 `theme-<slug>/<name>.png` 会被**覆盖**(每次都从 figma 拉新的);想保护旧文件用 git 复核
- 想改成有缓存,自己在 `exportImageToPath` 加一层文件存在检查即可

## 禁止

- **有基线时**禁止跳过 dry-run 直接切图:一旦基线清单认错(比如 `last-page.json` 是老的 fileKey)会白切一堆无用图。**无基线时**没有跨稿清单可预览,直接跑即可
- 禁止把 `--theme` 的 name 写成含 `/` 或空格的字符串:会被 slug 化成 `-`,可读性差;推荐纯英文小写短名(red / gold / cny-2026)
- 禁止指望本 skill 生成代码:它只切图,不产任何 `.tsx` / `.jsx`;要代码走主 pp-d2c / pp-d2c-rn
- 禁止让本 skill 依赖兄弟 skill 的脚本(`pp-d2c/bin/figma.mjs` 等):本 skill 是**独立** REST 客户端,只依赖 `pp-d2c.config.json` 读 `assetsDir` + `.env` 读 `FIGMA_TOKEN`;兄弟 skill 不装也能跑
