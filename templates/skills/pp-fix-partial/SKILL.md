---
name: pp-fix-partial
description: D2C 出码后的局部 UI 修复，仅重跑指定区块不重刷整页，复用 .d2c-cache 元数据与资产；触发：pp-fix-partial、修复这块、这一小块不对、重新生成某区域
---

# pp-fix-partial Skill

> 局部 UI 修复:整页已经 D2C 出码但某一小块视觉/交互不对时,只重跑那一块,不重刷整页。利用 `.d2c-cache/` 复用 figma 元数据 + 图片资产,通过 hash 对比防污染。

## 触发条件

- 用户说「修复这块」/「这一小块不对」/「重新生成 xxx 区域」/「fix 那个按钮」
- 直接 `$pp-fix-partial [figmaUrl?] [目标描述?]`
- `pp-d2c` / `pp-d2c-rn` 主流程结束后,用户对某个 block 不满意主动触发

## 执行模型

**SKILL.md 是 LLM 操作手册,不是可执行代码**。所有 "读 X"/"写 Y"/"调 figma.mjs" 都是给 agent 的操作指令,由 agent 用 Read/Bash/Edit 工具落地。无任何 `partial.run()` 一类的伪代码 API。

---

## 本轮分流（先于下面的设计修复步骤）

先读 [共用执行契约](../pp-d2c-reskin/EXECUTION-CONTRACT.md)。用户仅要求修改现有代码的点击、滑动、滚动、状态或样式，且未要求采用新稿时，直接从当前入口和相关源码定位，列明目标、保存修改前基线、最小 patch 并按契约验收；完成后直接输出本轮实际改动与验证结果；下面步骤 0–6 仅用于确需设计事实的节点修复，不再转回该流程要求Figma截图、target.nodeId或整块重生成。`last-page.json` 缺失时可用用户明确路径或唯一可确认的现有入口继续，缺少设计事实时只限定设计结论，不能强迫重新生成整页。

继续失败任务先核对 `.d2c-tasks.md`、实际文件和已保存的报告，不要求先有一次整页成功记录。多个相关区块按依赖和唯一 owner 联动，不因数量退回整页流程。只有新设计事实、结构重建或明确的设计图层修复才执行下面的 Figma/cache 步骤；新请求的 fileKey 仍须和实际目标对应。

## 步骤 0:确定项目上下文

### 0.1 读 config

Read 项目根 `pp-d2c.config.json`,拿到:
- `project.framework`(react / rn)→ 决定用 pp-d2c 还是 pp-d2c-rn 的图层解析规则
- `project.styleFormat`(scss / scss-modules / stylesheet / …) → 决定改样式时用哪种语法
- `unit.figmaBase / outputBase / scale` → 换算尺寸
- `output.dir`(默认 `pages/`)→ 匹配项目里的代码位置
- `images.assetsDir / imageBaseUrl` → 补图片资源
- rn 分支额外读 `adapter` + `unit.responsive`

### 0.2 读 last-page 记录

Read `.d2c-cache/last-page.json`,拿最近一次成功出码的元数据:

```json
{
  "figmaUrl": "https://figma.com/design/<fileKey>?node-id=138-1797",
  "fileKey": "<fileKey>",
  "rootNodeId": "138:1797",
  "outputDir": "pages/Italo",
  "outputEntryFile": "pages/Italo/index.jsx",
  "figmaTreeHash": "sha1:abc123...",
  "generatedAt": "2026-08-05T10:23:44Z",
  "framework": "react",
  "styleFormat": "scss"
}
```

**文件不存在**：先尝试用户明确的入口、`.d2c-tasks.md` 或唯一可确认的源码目标。仅缺少设计稿定位且本轮确需设计事实时才请求补充链接，不把缺少成功记录当作必须整页重做的理由。

### 0.3 存在 last-page 时校验配置一致

- `config.project.framework === last-page.framework`?不一致 → warn「项目 framework 已切换,建议重跑整页而非局部修复」,给用户 y/n
- `config.output.dir` 与 `last-page.outputDir` 前缀匹配?不匹配 → warn 同上

---

## 步骤 1:解析用户参数,确定 target

### 用户输入的 3 种形态

| 形态 | 举例 | 处理 |
|---|---|---|
| 明确 figmaUrl | `pp-fix-partial https://figma.com/design/XXX?node-id=138-2050` | 直接用该 URL 里的 `fileKey + nodeId` 作 target |
| 无参 | `pp-fix-partial` | target = last-page.rootNodeId 的**子节点**;后面弹清单让用户选 |
| 自然语言描述 | `pp-fix-partial 顶部导航栏` / `修一下卡片`  | target = 在 last-page 子树里按 name 做 fuzzy match,列 3-5 个候选让用户选 |

### 1.1 形态 A:明确 figmaUrl

- 解析 fileKey / nodeId(与主 SKILL §4.4 URL 解析规则同款)
- **强制**:`fileKey` 必须与 `last-page.fileKey` 相等
  - 不相等 → error「当前 last-page 是 fileKey=X,但你给的 URL 是 fileKey=Y,不是同一份设计稿,不能局部修复,请重跑主流程」,终止
  - 相等 → target = { fileKey, nodeId, source: 'user-url' }

### 1.2 形态 B:无参

- 优先读已保存的完整根缓存取得**直接子节点**列表；确实缺缓存时才由主 agent 补取
- 输出候选清单:

  ```
  最近实现的页面 pages/Italo/ 有以下子块,选一块要修复的(输编号或名字):
    1. sub-header-nav        (顶部导航,138:1798)
    2. sub-banner-italo      (主视觉横幅,138:1811)
    3. sub-tab-list          (分类 tab,138:1830)
    4. sub-card-list         (卡片列表,138:1900)
    5. sub-footer            (底部,138:2050)
  ```

- 等用户选完 → target = { fileKey: last-page.fileKey, nodeId: 选中的, source: 'auto-child' }

### 1.3 形态 C:自然语言描述

- 从有效完整缓存读取子树 name 列表；确实缺失时才补取
- 对用户描述做 fuzzy match(忽略 sub-/block-/img- 等前缀),取 top 5
- 输出候选让用户选(格式同 1.2)
- 未命中 → 回退到形态 B 完整清单

---

## 步骤 2:缓存分层与作废策略

### 2.1 缓存目录约定

实际 `figma.mjs` 使用 `.d2c-cache/<fileKey>/meta.json`、`nodes/<nodeId-safe>.json` 和 `images.json`；节点文件名以脚本返回及真实目录为准。图片输出路径以脚本回执/切图清单为准，不另造 `.d2c-cache/figma`、`images/<fileKey>-...` 两套缓存布局。

`.d2c-cache/anchors/` 与 `last-page.json` 用来定位已有入口；后者仍由主 Skill 独占写入。缓存的完整性、设计来源、配置及素材摘要共同决定复用，不因存在一个 JSON 就认定所有资料有效。

### 2.2 设计输入核验与缓存复用

代码增量按前面的快速路径执行，不请求 Figma。需要设计事实时，主 agent 按实际 CLI 用 `cache-check <fileKey>` 校验一次，再使用 `fetch-node <fileKey> <nodeId>` 获取或复用完整缓存；参数以当前脚本帮助为准，不发明命名参数。子任务共享有效输入，不分别做网络检查。

设计版本变化、缓存缺失/截断或用户明确换稿时，补取受影响范围并重新判断相关规则、素材；文件版本及来源以脚本实际输出为准。缓存有效不代表已验证当前页面效果，源码、视觉和交互仍各自验收。不以反复拉取新子树来证明缓存命中。

### 2.3 缓存更新边界

由现有 CLI 管理设计版本与完整性，不手工清空整个缓存。需要最新设计时先执行实际支持的版本检查；`figma.mjs` 没有 `--no-cache` 开关，不能透传后声称强制刷新，也不自动删除缓存。真实获取失败保留原数据和进度，说明其时效未知，不当作已更新的事实。

### 2.4 防污染硬规则

1. **禁止**在同一份缓存文件里存"上一次"和"这一次"两份数据 → 每次覆写(单值语义)
2. **禁止**跨 fileKey 复用图片 → 图片文件名带 fileKey 前缀,天然隔离
3. **禁止**局部修复期间修改 `.d2c-cache/last-page.json` → 该文件是主 SKILL 独占写入,fix-partial 只读

---

## 步骤 3:在项目代码里精确定位 target 对应的 JSX 段

### 3.1 优先走 anchor 档案(推荐路径)

Read `.d2c-cache/anchors/<page>.json`:

```json
{
  "138:1830": {
    "file": "pages/Italo/blocks/sub-tab-list/index.jsx",
    "start": 12,
    "end": 45,
    "componentName": "TabList"
  },
  "138:1811": {
    "file": "pages/Italo/blocks/sub-banner-italo/index.jsx",
    "start": 8,
    "end": 62,
    "componentName": "BannerItalo"
  }
}
```

命中 target.nodeId → 直接得到 file + startLine + endLine + componentName。

### 3.2 anchor 档案不存在或未命中时:走 `data-node-id` 反查

老项目、或用户跑过 pp-strip-nodeid 但没留 anchor 档案 → grep `<file>` 找 `data-node-id="138:1830"` / `// node-id:138-1830`:

```bash
grep -rn 'data-node-id="138:1830"' pages/Italo/
```

命中 → 从行号往前找最近的 JSX 元素开始标签,往后找匹配的闭合标签,作为 [startLine, endLine]。

### 3.3 都找不到:让用户选

输出候选组件列表(按 outputDir 下的 `sub-*` 目录名列出):

```
未能精确定位 138:1830,请手动选一个组件目录:
  1. pages/Italo/blocks/sub-header-nav/
  2. pages/Italo/blocks/sub-banner-italo/
  3. pages/Italo/blocks/sub-tab-list/     ← 建议选这个(name 匹配)
  ...
```

---

## 步骤 4:出新版本代码

### 4.1 按目标范围最小修复

先读取当前 framework 对应主 SKILL 的「并行校验与修复收敛」约定，遵守其文件归属、检查版本、证据与收尾要求。

- 输入为 target.nodeId、该节点的真实 Figma JSON、当前源码、用户具体反馈及有效切图清单；先判断 CSS/属性等局部 patch 是否足以满足目标，保留正确结构、交互和其他区域。
- 只有目标结构确需重生成时，才调用对应主 SKILL §步骤 4 的完整 block 流程。修改候选写入 `.d2c-tmp/fix-partial-<nodeId>/`，不提前覆盖用户代码；可复用目录结构的最小 patch 也保留候选 diff。
- 遵守前缀、图片、图层解析和单位换算规则，RN 分支按主 SKILL §5.4 应用配置的 rpx 转换，再按 §5.5 应用 adapter；最小 patch 保留已有转换，不重复包装。能保留的资源不重复切图；涉及共享样式或相邻区域时先确定依赖与唯一写入 owner，不能并发覆盖。

### 4.2 规则与视觉验收

- 按实际目标运行对应主 SKILL 的 `check-rules --block`（并绑定正确 root/cache/config），保存真实报告及退出码；若候选仅为 patch，需在包含现有目标依赖的完整临时 block 上检查，不能对空目录或残缺片段声称通过。
- 复用有效 target 设计截图，取得当前候选的真实运行截图，按用户本轮目标与受影响布局比对；两图注明来源、版本、视口和覆盖范围。无法预览/查看时写“视觉未验证”，不凭读代码宣称通过。
- 有明确差异时只修该差异，并复验受影响范围；同一问题无改善时转根因分析，不盲目重新生成整个 block。满足用户目标且相关检查通过即进入步骤 5，不自行追加优化。
- 规则失败列出具体 rule/nodeId/expected/actual 和报告定位；疑似误判沿用主 SKILL 的证据门禁，未解决则保存候选并报告未完成，不能借隐藏锚点、无法解析样式或伪造通过绕过。

---

## 步骤 5:精确替换用户项目里的旧代码

**只替换 target 对应的那一段,其他不动**。

### 5.1 分两种情况

- **step 3 走 anchor / grep 精确定位** → 按候选 diff 逐文件应用目标 JSX 与关联样式，先核对各文件基线版本；发生变化先重读并重做候选，不覆盖他人修改。使用 Edit 工具 `Edit(file, oldStr, newStr)`
  - oldStr = 该文件目标片段的当前原文（JSX 可按 anchor 范围，样式按实际选择器或 styleKey 定位）
  - newStr = 步骤 4 生成的新版本
- **step 3 让用户选了一个组件目录且用户要求整块重建** → 核对基线后按候选 diff 替换授权文件；其他局部任务只应用必要 patch
  - 备份到 `.d2c-cache/fix-partial-backup/<nodeId>-<timestamp>/`(留 3 份滚动)
  - 用新版本覆写该组件目录的所有文件

### 5.2 anchor 档案联动更新

替换后:
- 新代码行数会变,原 anchor 的 [start, end] 失效 → 重算 [newStart, newEnd] 写回 `anchors/<page>.json`
- 其他 nodeId 的 anchor 如果在同文件里且 start > 旧 endLine → 全部按行差平移

### 5.3 图片资产同步

新出码可能引入新图 → 图片文件名带 `<fileKey>-<nodeId>-<idx>` 前缀,与老图并存不会冲突。
老图如果被弃用 → 输出到"提示手动清理"清单,不自动删(避免误删)。

---

### 5.4 替换后核对

候选验收只对候选版本有效。替换实际源码后核对最终 diff，执行受影响的规则检查与实际预览；影响页面组合时检查接缝及整页 merge 门禁。结果与最终文件绑定，一致且通过即输出报告；发现回归则由同一 owner 定点修复，原先正确区域不反复重写。

## 步骤 6:输出修复报告

```
✅ 局部修复完成:sub-tab-list (138:1830)
📁 改动文件:pages/Italo/blocks/sub-tab-list/index.jsx (行 12-45)
🖼️  新增图片:static/<fileKey>-138-1830-1.png
🗑️  可能弃用的老图(不自动删,请人工确认):
     · static/<fileKey>-138-1830-0.png
💾 缓存复用情况:figma JSON 复用 / 图片 1 张新导 / 1 张复用
📐 anchor 档案已更新:.d2c-cache/anchors/pages_Italo.json
👀 请 git diff 复核,视觉验收通过再 commit
```

---

## 参数

| 参数 | 说明 |
|------|------|
| `[figmaUrl]` | 明确要修的 figma 节点 URL(fileKey 必须与 last-page 一致) |
| `[目标描述]` | 自然语言 fuzzy match 子节点 name |
| `--dry-run` | 只走完步骤 1-4,不动用户代码;输出 diff 给用户看 |
| 最新设计检查 | 用主 Skill 的 `cache-check` 校验版本；不提供 `--no-cache` 脚本开关 |
| `--force` | 跳过一致性校验(framework / outputDir 不匹配警告) |

---

## 禁止项

- 禁止跨 fileKey 修复:`user-url.fileKey !== last-page.fileKey` → 直接终止,不给"跨稿子拼接"的口子
- 缓存使用遵守本轮分流：代码增量复用已绑定事实，设计变化或缺失时真实校验和补取，不能拿过期或截断数据冒充完整输入
- 禁止改动 target 范围外的代码:即使发现同页面其他块也有问题,不管;让用户显式再跑一次 fix-partial
- 禁止改动 `.d2c-cache/last-page.json`:该文件是主 SKILL 独占写入
- 当前源码必须真实存在并能确定修改范围；未完成整页生成也可继续已保存部分，不能伪造成功基线或覆盖无关文件
- 禁止在 anchor 档案缺失且 data-node-id 已剥的项目里"猜"位置:让用户选具体目录,不做启发式硬替换
- 设计结构重建以sub为目标时保持完整组件外壳和依赖；代码增量保留已有外壳，只修改必要内容，不因sub前缀触发整块重生成
- 禁止把整个 outputDir 备份到 git 追踪路径:备份只落 `.d2c-cache/fix-partial-backup/`,该目录已在 `.gitignore` 里(靠 `.d2c-cache/` 整体忽略)
- 禁止在 config `project.framework` 与 last-page 不一致时静默继续:必须显式警告 + 等用户 y/n
- 禁止透传不存在的 `--no-cache` 参数或自行清空缓存；需要设计更新先做真实版本检查，强制重建超出现有工具能力时报告缺口

---

## 与主 SKILL 的分工

| 场景 | 用哪个 skill |
|---|---|
| 首次实现某页面 | `pp-d2c`(h5)/ `pp-d2c-rn`(rn) |
| 整页 figma 大改重出 | `pp-d2c` / `pp-d2c-rn`(不用本 skill) |
| **只有一小块要改** | **`pp-fix-partial`(本 skill)** |
| 上线前清 `data-node-id` | `pp-strip-nodeid` |
| 出码后想清缓存 | `npx @double-coding/pixel-print clean-cache` |

**规则**：相关区块可在明确依赖与单 owner 写入边界内联动修改；整页重构才走主 Skill 的完整生成流程。
