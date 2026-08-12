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

**文件不存在**:输出错误「未找到 `.d2c-cache/last-page.json`,请先跑一次 pp-d2c / pp-d2c-rn 主流程再回来做局部修复」,终止。

### 0.3 校验 config 与 last-page 一致

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

- 调 figma.mjs 拉 last-page.rootNodeId 的**直接子节点**列表(只到一层子,不递归)
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

- 拉 last-page 整个子树 name 列表
- 对用户描述做 fuzzy match(忽略 sub-/block-/img- 等前缀),取 top 5
- 输出候选让用户选(格式同 1.2)
- 未命中 → 回退到形态 B 完整清单

---

## 步骤 2:缓存分层与作废策略

### 2.1 缓存目录约定

```
.d2c-cache/
├── figma/
│   └── <fileKey>-<nodeId>.json         # figma 节点子树 REST 返回,带 { figmaTreeHash, mtime }
├── images/
│   └── <fileKey>-<nodeId>-<imgId>.png  # 切图缓存,与 figma 节点 hash 绑定
├── anchors/
│   └── <pageDir 相对 outputDir 的下划线名>.json   # 由 pp-strip-nodeid 生成的锚点档案
└── last-page.json                       # 由主 SKILL 生成
```

**关键不变式**:
- 所有缓存文件路径必带 `<fileKey>` 前缀 → 换 fileKey 天然隔离,不会跨稿子污染
- 缓存作废三种触发:hash 变了 / mtime 超 7 天 / 用户跑 `pp-d2c clean-cache`

### 2.2 hash 对比

调 `bin/figma.mjs fetch-node --file-key <fileKey> --node-id <nodeId>` 拉 target 最新子树 → 算子树 fingerprint hash(递归 SHA1 节点 id + name + style props + children hash):

```
[fix-partial] fetch target 138:1830 最新元数据...
[fix-partial] 最新 hash: sha1:def456
[fix-partial] 缓存 hash: sha1:abc123
[fix-partial] hash 不一致 → invalidate 图片缓存,重新导出
```

**hash 一致** → 用缓存(figma JSON + 图片 PNG 都跳过网络);
**hash 不一致** → 删该 nodeId 对应的所有缓存文件,重拉。

### 2.3 mtime TTL

打开缓存文件时:如果 `Date.now() - meta.mtime > 7 * 24 * 3600 * 1000` → 作废重拉。防止 figma 长期没动的稿子静默过期(hash 一致但 figma 侧其实已经删了那个节点的场景很少见,但兜底一下)。

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

### 4.1 交给主 SKILL 的 sub-agent 流程

调 pp-d2c(h5)/ pp-d2c-rn(rn)主 SKILL 的**§步骤 4「sub-agent 实现单个 block」**规则,但只处理这一个 block:

- 输入:target.nodeId + 该节点的 figma REST JSON(从缓存或最新拉取)
- 输出:一份新的 JSX + 样式代码(同套目录约定,写到 `.d2c-tmp/fix-partial-<nodeId>/`,不直接写用户代码)
- 遵守主 SKILL 的所有前缀规则(§4.0 / §4.3)、图片处理(§4.4)、图层解析(§4.3)、单位换算(§4.5)、rn 分支还要跑 §5.4(rpx)/ §5.5(adapter)

### 4.2 视觉验收(强制,复用主 SKILL §6.0)

按主 SKILL §6.0 逐叶子对比:

- 切 target 节点截图 → `.d2c-tmp/screenshots/fix-partial-<nodeId>-figma.png`
- 渲染新出码 → 截图 → `.d2c-tmp/screenshots/fix-partial-<nodeId>-code.png`
- 视觉打分:如果 diff 明显 → 回 §4.1 重出,不许直接替换

---

## 步骤 5:精确替换用户项目里的旧代码

**只替换 target 对应的那一段,其他不动**。

### 5.1 分两种情况

- **step 3 走 anchor / grep 定位到了单文件** → 用 Edit 工具直接 `Edit(file, oldStr, newStr)`
  - oldStr = 该文件 [startLine, endLine] 的原文
  - newStr = 步骤 4 生成的新版本
- **step 3 让用户选了一个组件目录** → 该目录整个替换
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
| `--no-cache` | 强制忽略所有 `.d2c-cache/figma/*` 和 `images/*`,一切重拉 |
| `--force` | 跳过一致性校验(framework / outputDir 不匹配警告) |

---

## 禁止项

- 禁止跨 fileKey 修复:`user-url.fileKey !== last-page.fileKey` → 直接终止,不给"跨稿子拼接"的口子
- 禁止跳过 hash 对比直接用缓存:每次 fix-partial 必须先 fetch target 最新 → 算 hash → 对比缓存
- 禁止改动 target 范围外的代码:即使发现同页面其他块也有问题,不管;让用户显式再跑一次 fix-partial
- 禁止改动 `.d2c-cache/last-page.json`:该文件是主 SKILL 独占写入
- 禁止对没跑过主 SKILL 的项目直接使用:必须先有一次 pp-d2c/pp-d2c-rn 成功产出,才能局部修复
- 禁止在 anchor 档案缺失且 data-node-id 已剥的项目里"猜"位置:让用户选具体目录,不做启发式硬替换
- 禁止把 `sub-` 前缀的图层作为 target 时,只出内部代码不出 sub 组件外壳:target 是 sub- 就完整重新生成 sub 组件(目录 + 组件函数 + 样式);target 不是 sub- 就在最近的 sub 祖先里做局部 patch
- 禁止把整个 outputDir 备份到 git 追踪路径:备份只落 `.d2c-cache/fix-partial-backup/`,该目录已在 `.gitignore` 里(靠 `.d2c-cache/` 整体忽略)
- 禁止在 config `project.framework` 与 last-page 不一致时静默继续:必须显式警告 + 等用户 y/n
- 禁止把 `--no-cache` 当默认行为:缓存复用是本 skill 的核心价值,只有用户明确加 flag 才禁用

---

## 与主 SKILL 的分工

| 场景 | 用哪个 skill |
|---|---|
| 首次实现某页面 | `pp-d2c`(h5)/ `pp-d2c-rn`(rn) |
| 整页 figma 大改重出 | `pp-d2c` / `pp-d2c-rn`(不用本 skill) |
| **只有一小块要改** | **`pp-fix-partial`(本 skill)** |
| 上线前清 `data-node-id` | `pp-strip-nodeid` |
| 出码后想清缓存 | `npx @double-coding/pixel-print clean-cache` |

**规则**:凡是「涉及≥ 2 个 sub-block」的修改,退回主 SKILL 重跑;本 skill 只做 1 个 target 节点的局部修复,不解决"多块联动"问题。
