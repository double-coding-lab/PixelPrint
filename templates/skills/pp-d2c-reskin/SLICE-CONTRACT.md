# 切图契约(SLICE-CONTRACT)

> 本文档是 **pp-d2c / pp-d2c-rn / pp-d2c-reskin** 三 skill 共享的切图规则主本。三个 SKILL.md 只留短外壳指向本文档,底层规则一处修改、三处同步生效。
>
> 契约版本随 `reskin-slice.mjs` 演进,重大变更在文首 Changelog 段追加。凡与本契约冲突的其他文档一律以本契约为准。

## Changelog

- v1(2026-05-10):初次抽取,汇聚 pp-d2c / pp-d2c-rn 三处切图逻辑;新增 §1.3「内容 md5 兜底去重」(第三层去重,兜底跨 basename 分支的重复位图);其余章节与抽取前逐字保持一致。

---

## 1. 前置切图流程 [三 skill 通用]

### 1.1 执行时序与目的

**执行时序**:步骤 2 扫描 + 步骤 2.5(页面级背景 / 根骨架)+ 步骤 0.5 输出路径锁定完成后,步骤 3 分发 sub-agent 前。

**目的**:一次性把稿子里所有 `img-` / `bg-` 前缀节点(含裸词)切完落盘,生成 nodeId → filename 清单;sub-agent 生 jsx/styles 时**只消费清单**,不再自己调 Figma API 现切现挂。

**依赖**:本步骤调用 **`pp-d2c-reskin` 卫星 skill** 的 `reskin-slice.mjs`(Figma 数据侧脚本,与输出端无关)。脚本缺失(卫星未安装)→ **hard stop** 提示用户安装 pp-d2c-reskin 后重跑,**禁止**以"脚本不存在"为由占位绕过或改用手工切图。

### 1.2 动作与清单 schema

```bash
node .claude/skills/pp-d2c-reskin/reskin-slice.mjs \
  --theme <slug>=<figma-url> \
  --out-manifest <projectRoot>/.d2c-cache/<fileKey>/slice-manifest-<slug>.json
```

- `<slug>` = 步骤 0.5 锁定的 `<asset-slug>`;`<figma-url>` = 步骤 1 解析出来的原 URL(带 nodeId)
- reskin standalone 模式自扫 `img` / `bg` 前缀节点(含裸词),落图到 `<images.assetsDir>/<asset-slug>/`
- **清单 schema**(见 `slice-manifest-*.json`):
  ```json
  {
    "generatedAt": "2026-08-11 17:00:00",
    "mode": "standalone",
    "themes": [{
      "slug": "test13",
      "outDir": "static/test13",
      "hit": 21, "miss": 0,
      "confirmed": false,
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

### 1.3 三层去重

**第一层:sibling matchKey(`--dedupe-siblings`,默认关)**。同父下同名节点(auto-layout 循环卡片)默认**全部切出**;仅在明确知道"循环项刻意重复、切一次即可"时手动开开关,同 `<parent>||<name>` key 只切第一个。

**第二层:list- 同构 sharedFrom(v1.2.6,恒开)**。同一 `list-` 祖先下、`imageRef` 一致、bbox 尺寸一致的多个节点视为同构列表项——**首项落盘,后续项不下载不落盘**,manifest 条目复用首项 `filename/filepath` 并记 `sharedFrom: <首项 nodeId>` + `sharedFromReason: "list-isomorphic"`。业务语义:`.map()` 渲染时都指向同一文件。

**第三层:内容 md5 兜底 sharedFrom(恒开,无开关)**。同一次 batch 内,前两层未去重的节点下载完成后在内存里算 md5;**若 md5 已出现过**,第二张不落盘、manifest 条目复用首个 entry 的 `filename/filepath` + 记 `sharedFrom: <首个 nodeId>` + `sharedFromReason: "content-md5"`。业务语义:两张 bit-for-bit 完全一致的位图必然可以共享(md5 冲突概率 2^-64,可忽略)。

> **为什么要三层去重**:裸标签 `bg` 走 `parent__bg` 命名分支、带子名 `bg-xxx` 走去前缀分支——即使从 Figma 拉回同一份位图,前两层都识别不出是"同一张"(不同 imageRef 或不同 list- 祖先或不同 basename)。md5 兜底解决这类跨 basename 分支的物理重复。

**文件名规则**:图层名去掉所有已知前缀后转 kebab-case;裸标签 `bg` / `img` 用父节点 name 拼(如父节点 `sub-hero-card` 下裸 `bg` → `hero-card__bg.png`);跨父同名 → 加最近具体祖先前缀区分(`frame-722__icon.png` / `frame-726__icon.png`);极端二次撞名 → 追加 nodeId 兜底,**绝不静默丢图**。

- 图层名 `img-hero-bg` → 去前缀 → `hero-bg.png`
- 图层名 `bg-body` → 去前缀 → `body.png`
- 图层名 `img-编组4` → 去前缀 → `编组4.png`(含中文直接保留)
- 图层名 `btn-img-submit-btn` → 去前缀 → `submit-btn.png`
- **禁止**使用 Figma node ID 作为文件名
- **禁止**使用 `101`、`201` 等数字序号作为文件名

### 1.4 bg 溢出告警(v1.1.0)

reskin 每切一张图会**自动**做尺寸断言:`png 实际尺寸 vs node.absoluteBoundingBox × scale` 相差 > 4px → 写入 `entries[i].sizeWarning`。**主 agent 收到清单后必须扫一遍所有 `entries[].sizeWarning`**:

- 有非 null 的告警 → **必须停下问用户**是否要拆解或让美术在 Figma 里加 mask 收紧 renderBounds;禁止直接用溢出 png
- 典型征兆:`bg-*` 节点 png 宽高远大于自身 bbox → Figma 把父容器兄弟节点渲染进 png(如 coupon-big-bg.png 里烤进"1 折 / 亚洲火车立减")
- Figma 侧修复选项:① 把 mask 拉大到包住 bg 自己;② 把兄弟节点移到 bg 外面,由代码单独渲染

### 1.5 产物消费契约(sub-agent 侧)

- UI sub-agent 收到 `<blockDir>/rule-hits.json` 时,**同时**收 `<projectRoot>/.d2c-cache/<fileKey>/slice-manifest-<slug>.json`
- 生成 jsx 时,引用 `img-` / `bg-` 节点必须从清单 `entries` 查 `filename`:
  - **h5**:`<div style={{ backgroundImage: url(${ASSET}bg-body.png) }} />`
  - **RN**:`<Image source={require('@Images/<页面>/bg-body.png')} />`(编译期 require,不允许字符串拼接)
- 清单里没有的 nodeId → **禁止 sub-agent 自补切图**,必须在 `assets.txt` 写 `[清单缺失] nodeId=XXX name=XXX 需主 agent 补切`

### 1.6 主 agent 补切回路

sub-agent 全部返回后,主 agent 汇总所有 `blocks/*/assets.txt` 里的 `[清单缺失]` 条目:

1. 数量为 0 → 直接进入合并阶段
2. 数量 > 0 → **主 agent 重跑一次** `reskin-slice.mjs` 只针对这些 nodeId 补切,追加到同一清单文件,然后让相关 sub-agent 用更新后的清单重生 jsx/scss
3. 重跑仍无法补上(Figma 返回 404 / renderBounds 空等硬错误)→ 停下问用户排查,**禁止**走整体切图兜底

### 1.7 执行结果硬门禁(v1.2.4)

- `reskin-slice.mjs` **退出码非 0 → hard stop**:立即停止 D2C 流程,向用户报告失败原因(token / 网络 / Figma 4xx),**禁止**继续步骤 3、**禁止**改用 `figma.mjs export-image` 手工逐张切图代替清单(实测:绕过后 manifest 失效 → 图片覆盖检查全线失灵 → 大块区域被整张切图)。修复后从步骤 2.6 重跑。
- `figma.mjs export-image` **仅允许**出现在「补切单节点修复模式」(上文补切回路 3 之后、经用户确认的定点修复),且切完**必须**把该图回写进 slice-manifest 与 `images.json`——否则合并阶段 `check-rules --merge` 的 **IMG-reconcile 三方对账**按"绕清单切图"报 violation。

### 1.8 切图确认暂停(v1.2.4,`slice.confirmBeforeContinue` 默认 true)

reskin-slice 成功后,主 agent **无条件暂停**,向用户输出切图结果摘要并等待确认,确认后才进入步骤 3:

```
## 切图确认 (步骤 2.6)
- 清单: .d2c-cache/<fileKey>/slice-manifest-<slug>.json
- hit=N miss=M
- entries: {nodeId} {name} → {filename} ({renderWidth}x{renderHeight})   ← 逐行列出
- sizeWarning: 无 / [列出非 null 项]
- 图片目录: {assetsDir}/<slug>/ (可肉眼查图)
请确认切图正确后回复继续;发现切错/漏切在此修正,比 sub-agent 分发后返工便宜得多。
```

- `pp-d2c.config.json` 配 `slice.confirmBeforeContinue: false` 可跳过本暂停(全自动流水场景);**sizeWarning 非空时仍必须停**(v1.1.0 既有规则,不受开关影响)
- **确认留痕(v1.2.5)**:用户确认后,主 agent 执行 `node .claude/skills/pp-d2c/bin/figma.mjs confirm-slices <fileKey> <slug>`(RN 侧路径改成 `pp-d2c-rn/bin/`) 把 manifest `confirmed` 置 true——合并阶段 `check-rules --merge` 的 **GATE-slice-confirm** 以该字段为准,`confirmed=false` 直接 violation。**禁止**未经用户确认自行执行 confirm-slices(留痕即取证,伪造可事后对会话审计)。用户口头"别问了 / 不要询问"指的是**权限弹窗**,**不豁免本流程确认**——跳过本暂停的唯一通道是改 config `slice.confirmBeforeContinue: false`(该配置下 reskin-slice 直接落 `confirmed: true`)

### 1.9 禁止项(§1)

- 禁止跳过前置切图直接进入 sub-agent 分发(无清单 = UI sub-agent 只能猜切图,大概率违规)
- 禁止 reskin-slice 失败后继续生成或手工切图兜底(§1.7 硬门禁)
- 禁止 sub-agent 绕开清单直接调 `figma.mjs export-image` 或 Figma REST `/v1/images`
- 禁止把清单里的 `filename` 或 `renderWidth/Height` 改写后再消费(改写 = 幻觉 = 事故源)
- 禁止 sub-agent 对含 TEXT 的 GROUP/FRAME 生成 `<img>` 兜底(见各 SKILL R16 硬防线)

---

## 2. 图片处理契约 [三 skill 通用]

### 2.1 切图强制忠实执行

**适用范围(v1.2.4 收口)**:本节的 `figma.mjs export-image` 直切路径**仅用于「补切单节点修复模式」**——步骤 2.6 补切回路仍失败后、经用户确认的定点修复。**普通生成流程中 UI sub-agent 一律只消费 `slice-manifest`(§1 契约),不走本节直切**;直切完成后必须把该图回写 slice-manifest 与 `images.json`,否则 IMG-reconcile 三方对账按"绕清单切图"报 violation。

**核心原则**:命中切图四条硬规则(bg 前缀 / img 前缀 / fills 含 IMAGE)且进入补切修复模式时,必须调 `figma.mjs export-image`(走 REST API)产出图片;**不允许**"看到 assetsDir 里有同名文件就跳过"或"从其他来源复用"。这是防止"skill 假装切了图,其实用了缓存 / 上一轮产物 / 同名老图"这类忠实度事故的核心约束。

**流程(每张切图必走)**:

1. **查 images.json**:读 `.d2c-cache/<fileKey>/images.json`,看当前 nodeId 是否已有记录:
   - **无记录** → 直接调 `figma.mjs export-image`,脚本会:(a) 调 REST API 拿临时 URL;(b) 下载到 `{projectRoot}/{assetsDir}/{filename}.{ext}`;(c) 算 md5;(d) 写回 `images.json`
   - **有记录** → 走下面 md5 校验分支

2. **md5 校验复用**(有记录时):
   - 读磁盘文件算 md5,与 `images.json` 里记录的 md5 对比
   - **相等** → 复用(`reused=true`),不重切
   - **不等 / 文件不存在** → 视作缓存失效,**强制重切**(调 `figma.mjs export-image`,覆盖旧记录)

3. **images.json 写入契约**(每次成功切图后必写):
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
   `bboxHash` 用于识别"同 nodeId 但导出参数变了"的情况;命中 hash 不同 → 也视作缓存失效强制重切。

4. **assets.txt 3 行溯源模板**(每张图切完必写):
   ```
   - {filename}.{ext}                       ← {figmaNodeName} ({nodeId})
     · API 参数:ids={nodeId} format={png|svg} scale={2} use_absolute_bounds={true|false}
     · 返回 URL:{figma S3 临时 URL}
     · 落盘尺寸:{width}x{height} md5={md5}
   ```
   这 3 行在 flat 和 component 两种 merge.mode 下都**必须**出现,用户复现时能直接对比 md5 判定 skill 是否忠实执行了 API 调用。

**doctor IMG026**:命中切图四条硬规则,但 images.json 里对应 nodeId 缺失 → **error**(说明本次 skill 没走 REST 就落图,属于严重忠实度事故)。

### 2.2 强制前置自检(补切回路与零星导出必做)

**⚠️ 调脚本前的强制前置自检**(切图执行方每张图都必须做,且必须把关键行输出到对话)。**普通场景 3 行**(h5 补切、无前缀兜底):

```
· 切图源 nodeId:{要写进 --ids 的值}
· 切图源 name:{该 nodeId 对应节点的图层名}
· 交叉验证前缀:切图源 name 是否以「bg-」/「img-」开头,或完全等于裸词「bg」/「img」,或该节点 fills 含 IMAGE 类型?{是 → 继续切图 / 否 → 立即停下,回归四条硬规则重判}
```

**RN 场景加 4 行**(v0.3.7 / v0.3.9 适格性核查,主 agent 补切回路与零星导出必做):

```
· 图层前缀类型:{img- / bg- / 无前缀}(裸词 img / bg 视同对应前缀)
· 切图范围:{仅节点自身及子树 / 意图切父容器}(§4 适格性表;答"意图切父容器"立即停下重做)
· 子树可拆分子节点数:{可见 TEXT 数 x / btn 数 y / 同层同构组数 z}
· 结构维度禁切判定:{通过:均低于阈值 / 命中禁切:具体条件(多文本 x≥2、多按钮 y≥2、同构 z≥3 任一)}(§4.2;命中即立即停下重做,走递归子层解析)
```

**交叉验证判定**:
- 前缀是 `bg-` → 切图源 name **必须**以 `bg-` 开头(如 `bg-piao` / `bg-body`),**或完全等于裸词 `bg`**(whole word)
- 前缀是 `img-` → 切图源 name 必须以 `img-` 开头,**或完全等于裸词 `img`**
- fills 含 IMAGE(第 2 条硬规则)→ 无前缀要求,直接切图挂父 background
- **裸词识别范围**:仅 `bg` / `bgc` / `btn` / `img` / `input` 五个独立/内容前缀允许裸词
- **修饰前缀**(`sub` / `block` / `x` / `scrollx` / `scrolly` / `fixed` / `end`)**不允许**裸词,遇到直接走无前缀兜底

**这是"把兄弟节点文字烤进 bg 位图"这类 bug 的唯一防线**——若 sub-agent 拿了 `bg-` 的**父容器 nodeId** 传给 API,Figma 会把父容器**整棵子树**(含兄弟节点的文字 / 图标 / 其他 block)一起 render 成位图,必须避免。**脚本不知道你传的 nodeId 是否合法**,这个判断只能 LLM 自己做。

### 2.3 export-image 调用

```bash
# PNG 2 倍图(默认,含透明通道)
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name>
# RN 侧改用 pp-d2c-rn/bin/figma.mjs

# SVG(矢量图层优先)
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --format=svg

# 极少数场景:需要把 Figma effect 烤进位图(通常不用)
node .claude/skills/pp-d2c/bin/figma.mjs export-image <fileKey> <nodeId> --filename=<name> --preserve-effect
```

stdout 返回 `{"ok":true,"data":{"path":"<绝对路径>","reused":<bool>,"format":"png|svg"}}`。`reused=true` 表示命中缓存跳过下载。

**格式选择**:
- 图层为矢量(Vector / Icon / 无栅格内容)→ `--format=svg`
- 其他 → 默认 PNG 2 倍图

### 2.4 use_absolute_bounds 与 scale

> **`use_absolute_bounds=true` 是默认开的**:
> - 默认导出会包含图层 effect(drop-shadow / outer-stroke / blur)的可见范围与父容器背景色,PNG 会比 bbox 大一圈并带画板底色 → 导致 `gap` / `margin` 算不准 + 图带背景色两个历史 bug
> - 加此参数后,Figma 严格按节点 `absoluteBoundingBox` 导出,effect 和父背景被裁掉。**代价**:Figma effect 实现的阴影 / 光晕不会烤进 PNG——但这本来就是要的(应用 CSS `filter: drop-shadow()` 实现;RN 侧用组件阴影)
> - 若某张图**就是要**把 effect 烤进位图(极少见),加 `--preserve-effect` 覆盖;也可在 config `images.preserveEffectIds` 数组里列出该 nodeId

### 2.5 禁止项(§2)

- 禁止手工挑图 / 手工改切图 `filename`(改写 = 幻觉 = 事故源)
- 禁止跳过 `use_absolute_bounds`(会把父背景 / effect 烤进 PNG)
- 禁止把 Figma `/v1/images` 返回的 S3 临时 URL 写进代码 `<img src>`(约 30 分钟过期,代码上线就 404)
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具(v0.3 起完全不依赖 MCP)

---

## 3. Figma Token 处理 [三 skill 通用]

### 3.1 v0.3 起图片导出**只有 REST API 一条路径**

| 情况 | 处理 |
|------|------|
| Token 有效,导出成功 | 正常流程 |
| Token 缺失 / 过期(HTTP 401/403) | **立即终止**,输出下方错误提示,由用户补 token 后重跑 |
| `/v1/images` 返回 `err` 字段或临时 URL 404 | 3 次指数退避重试(1s / 2s / 4s),三次都失败 → 终止并输出错误 |

### 3.2 错误提示文案

```
❌ 图片导出失败:Figma Token 无效或过期

请检查项目根 `.env` 里的 `FIGMA_TOKEN`:
1. Token 是否已过期或被撤销
2. Token 权限是否包含 File content: Read-only
3. Token 对应的账号是否有该 fileKey 的访问权限

修正后重新运行本 SKILL(缓存会因 lastModified 校验自动决定是否复用)。
```

### 3.3 为什么删除 MCP `download_assets` 兜底

- MCP `download_assets` 不支持 `use_absolute_bounds=true` 参数,导出的图会带图层 effect 外扩 + 父背景色 → 直接导致 `card-bg.png` 类历史 bug 重现
- 保留兜底会让 agent 在 token 失败时"悄悄降级",用户看不到严重的视觉退步
- 全流程走 REST,兜底路径与主路径**能力不对等**,与其藏 bug 不如显式失败

### 3.4 前提

项目根 `.env` 里 `FIGMA_TOKEN` 必须已配置(v1.0.2 起从 `pp-d2c.config.json` 迁到 `.env`)。**当 token 缺失或过期时(HTTP 403 / 401 / `invalid_token`)**,本契约 v0.3 起**不再有 MCP 兜底路径**——直接终止并要求用户补 token 后重跑。

### 3.5 禁止项(§3)

- 禁止在 token 过期时直接跳过下载或用临时链接占位(Figma S3 临时 URL 约 30 分钟过期,代码上线就 404)
- 禁止把 Figma `/v1/images` 返回的 S3 临时 URL 写进代码 `<img src>`(同上,只能作为下载源,下载完立刻丢弃)
- 禁止调用任何 `mcp__plugin_figma_figma__*` 工具

---

## 4. 节点整体切图适格性 [RN only,通用可迁移]

### 4.1 §4.4.pre 前缀维度适格性(v0.3.7)

**目的**:明确"允许整体切图"和"永远禁止整体切图"两类节点的边界,防止主 agent / sub-agent 把父容器(含多个子层)整体切一张大图当替代品。

| 节点前缀 / 类型 | 是否允许整体切图 | 说明 |
|--------------|--------------|------|
| `img-` | ✅ 允许 | 命中即整体切图(含节点自身及子树),**不再向内递归** |
| `bg-` / 裸词 `bg` | ✅ 允许(切**自身**及其子树) | 切图源 nodeId **必须**是 `bg-` 节点自己 |
| 无前缀非文本图层 | ✅ 允许(兜底) | 命中无前缀兜底规则;命中「父容器盒级装饰兜底」则走 View style,不切图 |
| **`sub-` / `block-`** | ❌ **永远禁止** | 分块边界节点,**必须递归子层**由 sub-agent 独立处理 |
| **`btn-`(未命中兜底)** | ❌ 只切自身,禁止吃父容器 | 若 `btn-` 命中兜底走 View style(渐变走 LinearGradient);否则只切 `btn-` 自身及其子树 |
| `bgc-` / `x-` | ❌ 禁止 | 均不切图 |

**违反后果**:doctor SUB027(v0.3.7 新增,error),见 pp-doctor §3.6p。

### 4.2 §4.4.pre.b 子树结构禁切规则(v0.3.9)

**背景**:v0.3.7 §4.1 上表只从**前缀维度**判定"禁切",只覆盖了 `sub-*` / `block-*` 命名节点。但 sub-agent 内部会遇到**没打前缀但结构上就是内部分块**的节点——这种节点如果落回"无前缀非文本图层兜底整体切图"路径,sub-agent 就能借"figma 图层名字不叫 sub-XXX"绕过 §4.1 主表。

**核心公式**:**只要子树命中以下任一结构信号,即使前缀是"无前缀"或没打 `sub-` / `block-` 也永远禁止整体切图**,必须递归子层。

| 结构信号 | 判定条件 | 理由 |
|---------|---------|------|
| **多文本禁切** | 子树含 **≥2 个可见 TEXT** 节点,且**分属不同视觉行**(任两个 TEXT 的 `absoluteBoundingBox.y` 差 ≥ 4px) | 文字必须可选中、可翻译、可无障碍朗读、可埋点、可动态替换(RN 侧 `<Text>` 组件承载) |
| **多按钮禁切** | 子树含 **≥2 个**下列任一:`btn-` 前缀节点 / 裸词 `btn` 节点 / INSTANCE / COMPONENT 型子节点 | 按钮必须独立生成 `<Pressable>` / `<TouchableOpacity>` 才能挂 `onPress`;烤图后无法点击 |
| **同构列表禁切** | 子树含 **≥3 个**同层同构子节点(同类型 + bbox 相近 ±10% + 图层名同前缀或数字后缀差 1) | 同构结构应 `.map()` 生成,`<FlatList>` / `<ScrollView>` 等 RN 列表组件才有意义 |

**判定优先级**:结构信号维度**优先于**前缀维度——即使节点前缀允许整体切图(`img-` / `bg-` / 无前缀),只要命中上表任一条件,一律禁止整体切图。**唯一例外**:`img-` / `bg-` 是设计师显式指定"这就是一张图"的信号,agent 应尊重(否则前缀就没意义了);但此时 doctor SUB029 会告警。

**违反后果**:doctor SUB029(v0.3.9 新增,error),见 pp-doctor §3.6r。

**反向自检**(sub-agent 决定"整体切图"前必扫,与 §2.2 前置自检同批输出到对话):

```
· 子树可拆分子节点数:{可见 TEXT 数 x / btn 数 y / 同层同构组数 z}
· 结构维度禁切判定:{通过:均低于阈值 / 命中禁切:具体条件(多文本 x≥2、多按钮 y≥2、同构 z≥3 任一)}
```

任一命中 → 立即停下重做,回归递归子层解析(RN 侧生成 `<View>` + `<Text>` + `<Pressable>` + `.map(...)` 结构)。

---

## 5. bg- 独立切图契约 [RN only]

**目的**:核对页面里所有 `bg-*` / 裸词 `bg` 前缀节点是否已经进入 slice-manifest,并且产物代码里都被引用了——避免"清单漏切"或"切了没用"两类事故。

**核查项**(合并阶段 §6.0.4 三方对账的一部分,v0.3.11 新增):

- 子树内所有 `bg-*` / 裸词 `bg` 前缀节点集合大小:`count(bg-nodes)`
- slice-manifest 中 `bg-*` 条目集合大小(v1.1.0 起以清单为声明源):`count(bg-declared)`
- 差集 `bg-nodes - bg-declared`(应切图但清单缺条目):`"空"` 或 `"missing: bg-<X1>, bg-<X2>, ..."`(非空 = 步骤 2.6 漏切或补切回路未闭环,触发 BGP033)
- 产物引用覆盖(RN 5 种 Image 形式:`require` / `uri` / `ImageBackground` / `FastImage` / `ASSET_PREFIX`)零匹配项数:`count(unused-imports)`
- 结果:`✅ 通过` / `❌ 失败`

**规则**:
- `bg-*` 子树内嵌的 `bgc-`(如果存在)**不再单独取值**——位图里它的视觉是 `bg-` 切图的物理副产物,CSS/style 端不重复声明(避免和兄弟 `bgc-` 的属性打架)
- **禁止**只声明未使用(会被 R21 / IMG-reconcile 二次抓)
- **禁止**引用清单外文件名(等同于"绕清单切图")

---

## 6. 图片 URL / require 语义(参考)

> 本节是**产物侧**规则,分别在各 SKILL 的 §6.2(h5)/ §4.4.1(RN)由 QA 阶段兜底;此处仅列口径,避免 sub-agent 出码时误当契约。

- **h5**:唯一公式 `最终 URL = images.imageBaseUrl + images.assetsDir + filename`,SCSS 走 `$asset-prefix` 变量,**不允许**手写完整 URL。
- **RN**:唯一形式 `<Image source={require('@Images/<页面>/<filename>.<ext>')} />`,**不允许**字符串拼接(Metro 只在编译期解析 require,运行时 URL 拼接会 404)。

---

## 附:与旧文档的映射

本契约整合了以下旧位置(旧位置在三个 SKILL.md 中已改为短外壳):

| 旧位置 | 本契约对应章节 |
|---|---|
| pp-d2c/SKILL.md 步骤 2.6 前置切图 | §1 全节 |
| pp-d2c/SKILL.md §4.4.0 切图强制忠实执行 | §2.1 |
| pp-d2c/SKILL.md §4.4 图片处理主段 | §2.2 - §2.4 |
| pp-d2c/SKILL.md §4.4.1 Token 过期处理 | §3 全节 |
| pp-d2c-rn/SKILL.md 步骤 2.6 前置切图 | §1 全节(同 h5) |
| pp-d2c-rn/SKILL.md §4.4.pre 适格性(v0.3.7) | §4.1 |
| pp-d2c-rn/SKILL.md §4.4.pre.b 子树结构禁切(v0.3.9) | §4.2 |
| pp-d2c-rn/SKILL.md §4.4.0 忠实执行(v0.3.6) | §2.1(与 h5 同源) |
| pp-d2c-rn/SKILL.md §4.4 图片处理原节 | §2.2 - §2.4 |
| pp-d2c-rn/SKILL.md §4.4.1 Token 处理 | §3 全节 |
| pp-d2c-rn/SKILL.md §节点整体切图适格性核查 | §4.1 / §4.2 收尾 |
| pp-d2c-rn/SKILL.md §bg- 独立切图契约(v0.3.11) | §5 全节 |
