---
id: pp-d2c-reskin
revision: 0
summary: pp-d2c-reskin
primary: feature
confidence: inferred
tags: [module, policy]
---
# pp-d2c-reskin

> 按 `img` / `bg` 前缀规则批量切换肤稿的 skill。两种模式:**有基线** 时按基线清单去每套稿子找同 key 节点切图 + 报 miss;**无基线(standalone)** 每套稿子独立扫、前缀命中就切。同名图层跨父不会静默丢图。

## 适用范围

- 一套主稿已经出过码,美术又扔来几套只改颜色/纹样的稿子 → 批量切每套稿子的 `img-*` / `bg-*` 前景背景
- 美术直接扔几套稿子、没有代码基线 → standalone 模式按前缀切
- 需要业务代码写一个 `themeKey → assetsSubDir` 映射就能切主题

**不适用**:
- 需要生成 `.tsx` / `.jsx` 代码结构 → 用 [[pp-d2c]] / [[pp-d2c-rn]]
- 页面某一小块单独重跑 → 用 [[pp-fix-partial]]
- 零散图片无损压缩 → 用 [[pp-image-compress]]

## 前缀规则(与 [[pp-d2c]] §4 图层前缀体系对齐)

| 前缀 | 语义 |
|---|---|
| `img` / `img-*` | 前景图片,整层导出 PNG |
| `bg` / `bg-*` | 背景图片,写父元素 `background-image` |
| 裸标签 `img` / `bg` | 用**父节点 name** 辅助命名(如 `sub-hero-card > bg` → `hero-card__bg.png`) |

带前缀但不切的语义前缀(结构而非切图位):`sub-` / `block-` / `scrollx-` / `scrolly-` / `fixed-` / `end-` / `btn-` / `input-` / `x-`。

## 同名冲突消解(重要,不再让下游 agent 建议美术改名)

**匹配去重 key**:恒用 `<parent>||<name>`(裸标签 + 带子名统一走此规则)。

**默认全切**:同一名字 3 个 `img-icon` 分处不同父 Frame → matchKey 不同,3 个都保留。

**文件名冲突自动消解** (`resolveFilenameCollisions`):

1. 同 basename 撞车 → 每个加**最近具体祖先** slug 前缀:`icon.png` × 3 → `frame-722__icon.png` / `frame-726__icon.png` / `frame-730__icon.png`
2. 跳过通用组名(`编组` / `Group` / `Frame`)找上一层
3. 极少数二次撞名(父路径 slug 又相同)→ 再拼 nodeId 兜底 `xxx__103_210.png`

**`--dedupe-siblings` 兜底**:同父下同名(auto-layout 循环卡片背景)确认只需一份 → 加这个 flag 只切第一个。

## 换肤匹配语义(仅有基线时)

- 匹配 key:`<父节点 name>||<name>`
- 同 matchKey 的多个节点(基线 3 个 `img-icon` ↔ 换肤稿 3 个 `img-icon`)按遍历顺序 **1:1 配对**
- miss 原因分级:「换肤稿无对应节点」/「换肤稿仅 N 个同结构节点,基线第 M 个无匹配」
- 父 Frame 改名了 → 报 miss 让美术回改,不做容错匹配

## 给下游 agent 的排查硬规(切图不符预期时按此顺序)

1. **断言 PNG 内容前必须先重跑本 skill**。本地 `.png` 是上一次跑的产物,改稿后不会自动同步。汇总行会打**产物写入时间**,对比设计稿修改时间。
2. **看 `absoluteRenderBounds`,不是 `absoluteBoundingBox`**。前者是 Figma 出图真实裁剪范围(含描边/投影/子元素溢出),后者是名义框。skill 主 log 每行 `render=W×H` 就是 renderBounds。
3. **同名图层现在会全部切出**(带父路径前缀),**不要**建议美术回改图层名。真只需一份用 `--dedupe-siblings`。
4. **mask / clip 会锁 renderBounds**。GROUP 内的 mask RECTANGLE 会把可视范围锁死,子节点溢出部分不出图。这是 Figma 规则,skill 端无法绕过(`/v1/images` 不接自定义 bbox),只能改设计稿。
5. **深入排查**:`curl -H "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/files/<key>/nodes?ids=<a>:<b>"` 拉节点树,先看 `absoluteRenderBounds`。

## 独立性(与兄弟 skill 无耦合)

skill 内嵌 Figma REST 客户端,**不 spawn** `pp-d2c/bin/figma.mjs` 或其他兄弟 skill 脚本。只依赖:
- 项目根 `pp-d2c.config.json` 读 `images.assetsDir`
- 项目根 `.env` 读 `FIGMA_TOKEN`
- Node 18+ 内置 fetch

即便下游没装 pp-d2c / pp-d2c-rn 也能跑 standalone 模式。

## 参数速查

| 参数 | 用途 |
|---|---|
| `--theme <name>=<figmaUrl>` | 一套稿子,可重复传多次(至少一套除非 `--dry-run`) |
| `--dry-run` / `-n` | 只扫基线清单不切图 |
| `--base <figmaUrl>` | 显式指定基线,优先级高于 `.d2c-cache/last-page.json` |
| `--prefix <list>` | 覆盖切图前缀,逗号分隔,默认 `img,bg` |
| `--dedupe-siblings` | 同父下同名只切第一个,默认全切 |

## 输出目录

```
<assetsDir>/
├── theme-red/
│   ├── hero.png
│   ├── frame-722__icon.png    ← 3 个同名 icon 各自加父路径前缀
│   ├── frame-726__icon.png
│   └── frame-730__icon.png
└── theme-gold/
    └── ...
```

**有基线模式**下文件名与基线严格对齐,业务代码写 `themeKey → assetsSubDir` 映射即可切主题。

## 完整流程见 SKILL

`templates/skills/pp-d2c-reskin/SKILL.md` 覆盖:基线识别 → dry-run 预览 → 逐套稿子拉子树 → 冲突消解 → 逐位导出 → 汇总(含产物写入时间戳)。
