# pp-d2c-prep-plugin 终稿

> D2C 预处理 Figma 插件。核心定位:**几何辅助 + 人工/AI 打标决策**,插件只做几何操作(合并、拆分、清理),语义(前缀协议)交给设计师或 AI 决定。目录 `plugin/`,manifest 独立于 npm 包发布。

## 一、从"自动打标"改为"几何辅助 + 人工/AI 决策"(读之前先看)

原始需求澄清 / 技术方案的设计是**"自动打标推断 + Autolayout 反推"**——扫描 → 按规则库(`rules/prefix/x.ts` / `rules/prefix/img.ts` / `rules/prefix/btn.ts` / `rules/autolayout/infer.ts` 等)自动给每个 frame 推荐 pp-d2c 前缀 + 反推 auto layout 参数 → 面板批量 apply。原始方案文档已随本次同步移除(实现路径与文档差距过大,留着会误导)。

**这条路径全部废弃了**,原因是"自动打标"这件事:

1. 依赖 pp-doctor 的启发式规则,准确度天生上不去;
2. 人对语义(哪个是订单卡片、哪个是按钮组)的判断,机器猜错代价远大于让人手点一下;
3. Autolayout 反推在存在重叠子、渐变阴影、锚点定位时几乎必错。

**新架构的哲学**(v0.3.x):

> 插件只做几何,几何做到极致——把"视觉上应该在一起"的碎片自动裹成一个 group;语义(打前缀)交给设计师手工点、或者交给 AI 看截图咨询建议。**不猜业务、不猜前缀、不反推 Autolayout。**

因此:

- ✅ 保留:目录 `plugin/`、manifest.json、esbuild 打包链路、TS + React + `@figma/plugin-typings`、面板 UI 三段(顶部动作 / 中间树 / 底部日志)。
- ❌ 废弃:`plugin/src/rules/prefix/*.ts`(自动前缀推断)、`plugin/src/rules/autolayout/*`(Autolayout 反推)、`plugin/src/naming/generate.ts`(兜底命名)、`plugin/src/applier/index.ts`(批量 apply)、`plugin/src/report/generate.ts`(健康报告导出)、`plugin/src/guards/mutex.ts` 的自动阻断(不做打标决策就没有互斥可查)。
- 🆕 新增:`plugin/src/analyzer/*`(三阶段迭代合并 + 视觉分组 + 诊断 + 清理 + 拆分)、`plugin/src/merger/*`(手动合并选中)、`plugin/src/tagger/*`(手动打前缀)、`plugin/src/ai/*`(接入 PETA 咨询)、`plugin/src/ui/components/{TreeView,QuickTagPanel,SuggestionPanel,LogPanel,SettingsPopover}.tsx`。

阅读本终稿时请以本条为准,若与需求澄清 / 技术方案冲突,以本条为准。

## 二、能力总览

插件是一个 Figma Editor 插件,面板宽 960 × 高 680,通过 `@figma/plugin-typings` 沙箱化运行。四类能力:

| 能力 | 目的 | 入口 |
|---|---|---|
| **扫描 (Scan)** | 全量遍历当前 page/selection 的图层树,产出 TreeNode 列表交给 UI 渲染 | 头部 `Scan` 按钮 |
| **一键合并 (Iterative Merge)** | 三阶段迭代把"视觉上贴在一起"的碎片自动裹成 group,配合"清理隐藏/Slice" | 头部 `一键合并` 按钮 + ⚙参数面板 |
| **一键拆分 (Ungroup)** | 反向操作,浅拆一层或深拆到无 GROUP | 头部 `一键拆分` 按钮 + ⚙参数面板 `深拆` 复选 |
| **AI 建议 (AI Suggest)** | 把当前 scope 的图层树 + 画面截图发给 localhost:8787 转发至 PETA `gpt-6-astra`,拿回打标 / 合并建议 | 头部 `AI 建议` 按钮 |
| **手动合并 / 打前缀** | 面板里选中若干节点点右上「合并选中 ▼」;或用 `QuickTagPanel` 给选中节点批量 `img-` / `sub-` / `bg-` 打前缀 | 面板右侧列 + 底部快速打标 |
| **诊断 (Diagnose)** | 用户选中 2 个未合并的节点,追问 11 条约束里哪一条挡住了合并 | ⚙参数面板 `诊断为什么没合并` |

## 三、目录结构(实际交付)

```
PixelPrint/
├── plugin/
│   ├── manifest.json                # allowedDomains:["*"], devAllowedDomains:["http://localhost:8787"]
│   ├── tsconfig.json
│   ├── build.mjs                    # esbuild 打包 code.ts + ui.tsx → plugin/dist/
│   ├── README.md
│   ├── src/
│   │   ├── code.ts                  # 沙箱主入口 & UI 消息分派
│   │   ├── types.ts                 # UiMessage / CodeMessage 联合类型;TreeNode / Suggestion / AnalyzeResult / AiSuggestResult
│   │   ├── globals.d.ts
│   │   ├── analyzer/
│   │   │   ├── index.ts             # 统一导出 analyze / oneClickMerge / iterativeMerge / diagnoseMerge / deleteHiddenNodes / ungroupNodes
│   │   │   ├── mergeIterative.ts    # ★三阶段迭代合并:O 相交 → A 图形碎片 → B 混文字
│   │   │   ├── visualGroup.ts       # 视觉分组(一键合并旧路径,已被 mergeIterative 主导)
│   │   │   ├── deleteHidden.ts      # 清理 visible=false + type=SLICE
│   │   │   ├── diagnoseMerge.ts     # 11 约束诊断
│   │   │   └── ungroup.ts           # 浅拆 / 深拆
│   │   ├── merger/
│   │   │   └── index.ts             # 手动合并选中节点为 group,支持 prefix + nameHint
│   │   ├── tagger/
│   │   │   └── index.ts             # 手动给节点批量打 / 换前缀,处理修饰前缀叠加与冲突
│   │   ├── ai/
│   │   │   ├── client.ts            # fetch http://localhost:8787 转发 PETA;Promise.race 超时替代 AbortController
│   │   │   └── prompt.ts            # 系统 prompt + 少样本,注入图层树 JSON + 截图
│   │   ├── scanner/                 # (骨架保留,仅 walker + scan 入口)
│   │   ├── guards/                  # (mutex 骨架保留;当前不做自动阻断)
│   │   ├── rules/                   # (骨架保留;prefix 子目录已删,只留 prefix-catalog 常量)
│   │   └── ui/
│   │       ├── index.tsx
│   │       ├── App.tsx              # ★三段头部 + TreeView 中央 + 日志底部
│   │       ├── styles.css
│   │       └── components/
│   │           ├── TreeView.tsx
│   │           ├── QuickTagPanel.tsx
│   │           ├── SuggestionPanel.tsx
│   │           ├── LogPanel.tsx
│   │           └── SettingsPopover.tsx
│   └── dist/                        # esbuild 产物,gitignore
├── ai-proxy/                        # Python 版中转(见 ai-proxy 终稿)
└── ai-proxy-node/                   # Node 版中转(见 ai-proxy 终稿)
```

## 四、核心算法:三阶段迭代合并(`plugin/src/analyzer/mergeIterative.ts`)

一键合并是插件的心脏,决定了"改造后的稿子是不是可用"。算法**三阶段串行 + 每阶段迭代到收敛**,不是一遍就完。

### 4.1 数据结构

```ts
interface BBox { x: number; y: number; width: number; height: number; }
interface Cand { node: SceneNode; box: BBox; }
class DSU { /* 并查集,合并同簇候选 */ }
```

### 4.2 阶段 O:相交合并(Overlap)

**目标**:把"大背景 + 上面一堆小元素"整体归为一组。设计稿里常出现「一个大背景 Rect + 上面若干文字/图标」的浮层结构,阶段 A/B 按 gap 判邻近搞不定这种"包含"关系,必须先跑相交。

**判定** (`bboxOverlapRatio`):

```
overlap_area / min(area_A, area_B) >= overlapThreshold  // 默认 0.3
```

分母取**较小 bbox 面积**,而非并集/交集比——保证"小元素被大背景包住"这种极端不对称场景一样命中。

**候选**(`isPhaseOCandidate`):任何**可见、未锁、非 INSTANCE、未打 pp-d2c 前缀**的直接兄弟;**不受 `maxItemSize` 限制**——阶段 O 的目标就是大背景,再卡 size 就永远漏。用户不想动的自己锁上。

**簇聚合**:DSU 两两做 `bboxOverlapRatio >= threshold` union,同簇一起合并成 group。

### 4.3 阶段 A:图形碎片合并(gap)

**目标**:把设计师从 svg 拆出来的一堆小 vector / 图形碎片(几十条 path 组成一个图标)裹回一个 group。

**判定**:同父直接兄弟,`bboxGap <= gap`(默认 12px)。

**候选**(`isPhaseACandidate`):

- 本次运行阶段 A 已生成的 `img-` group(记在 `sessionGroupIds`)→ 可继续参与下一轮(允许滚雪球);
- 已带 `img-` / `bg-` / `bgc-` / `x-` / `sub-` 前缀的节点 → **不参与**(用户已定案);
- 图形叶子:VECTOR / STAR / POLYGON / BOOLEAN_OPERATION → 参与;
- RECTANGLE / ELLIPSE 且 fills 含 IMAGE → 参与(位图碎片);
- 其它 → 不参与。

### 4.4 阶段 B:混文字合并(gap 放宽候选)

**目标**:阶段 A 已经把碎片裹成图 group 后,再把"图 + 文字"这种整卡结构合起来(变成一张卡片)。

**判定**:同父直接兄弟,`bboxGap <= gap`。

**候选**(`isPhaseBCandidate`):

- 阶段 A 的 `img-` group **允许再作候选**(合理:一堆图 + 一段文字 → 一张卡);
- 阶段 B 自产的 `sub-` group **一次成型,不再回锅**(记在 `sessionSubGroupIds`)——这是历史上出过的 nesting bug(sub-card-44 → sub-card-88 → sub-card-132...)的关键防线;
- 其它:INSTANCE 不动、已带前缀不动、其余任何可见叶子/GROUP/FRAME 都参与。

### 4.5 合并守卫(每一步硬约束)

在同一个 `mergeInContainer` / `mergeInContainerByOverlap` 里,合并前逐条卡:

1. 簇成员 ≥ 2 且 ≤ `maxClusterSize`(默认 12)——防止一簇几十个节点一次合并成灾;
2. **合并后父层剩余子节点数 ≥ 2**:`parent.children.length - idxs.length + 1 < 2` 就跳过——一簇覆盖父的所有子,合并等于给父重命名,毫无意义;
3. 单个候选尺寸 ≤ `maxItemSize`(默认 300,阶段 A/B 有效;阶段 O 无此限制)——尺寸过大视为大背景,阶段 A/B 不动;
4. `figma.group()` 完成后,`group.children.length < 2` 立即 remove(兜底 Figma API 边界 bug)。

### 4.6 保留原始 z-order(内部次序 + 外部位置)

`figma.group()` 之后有两个 z-order 会被打乱,合并前必须先拍**父层 children id → index** 快照 `preMergeParentOrder`,合并后两步恢复:

**(1) group 内部次序** — `preserveOriginalZOrder(group, preMergeParentOrder)`

新 group 里 children 顺序不一定保留原样,按快照排序后 `group.insertChild(i, node)` 恢复到原相对次序。**不按面积重排**——曾经的实现是"大元素按 bbox 面积沉底",目的是防止"大背景遮小元素"这类显示 bug。但这个规则是**看起来合理但会出错**:用户在 Figma 里画东西时图层顺序本身就在表达 z 意图,一个大蒙层 / 高亮框 / 突出显示层可能**故意画在顶层**(比如引导蒙层、点击后高亮的选中框),按面积沉底会把这些顶层元素塞到最底,颠倒设计师的意图。用户画什么顺序就是什么顺序。

**(2) group 在外层 parent 的位置** — `moveGroupToBottomMemberPosition(group, memberIds, preMergeParentOrder)`

`figma.group(nodes, parent)` 默认把新 group 放到 `parent.children` 的**最末尾(z 最顶)**,等于所有被合并的元素整体上浮。如果被合并的元素里有个背景层原本在很底、上面本来还压着别的兄弟,合并后这些兄弟就被新 group 遮住了——外部 z-order 被破坏。

正确做法:找出所有成员中在 `preMergeParentOrder` 里**最小的那个 index**(合并前最底那一个的位置),然后 `parent.insertChild(minIndex, group)`。这样合并前后外部 z 关系完全一致,不影响其他兄弟。

### 4.7 收敛与限流

- 每阶段独立 `for (round = 1; round <= maxRounds; round++)`(默认 10),某轮 `merged === 0` 立即 break;
- 阶段串行 O → A → B;
- 记 `stoppedByLimit: 'O' | 'A' | 'B' | null`,回给 UI 显示。

### 4.8 可调参数(⚙ SettingsPopover)

| 参数 | 默认 | 语义 |
|---|---|---|
| `gap` | 12px | 邻近阈值,两个 bbox 边距离 ≤ 此值视为紧邻(阶段 A/B) |
| `maxRounds` | 10 | 每阶段最大迭代轮数 |
| `maxItemSize` | 300px | 单个候选最大尺寸,超过视为大背景不参与(阶段 A/B) |
| `overlapThreshold` | 0.3 | 阶段 O 的 bbox 重叠占比阈值 |
| `deleteHiddenFirst` | true | 合并前先清理隐藏节点 + Slice |

## 五、清理隐藏节点与 Slice(`plugin/src/analyzer/deleteHidden.ts`)

一键合并前默认先跑一次(可关)。删除条件:

1. `node.visible === false`(含祖先链隐藏);
2. `node.type === 'SLICE'`(Figma 切片,视觉不占位、留着只会污染合并候选)。

跳过:

- 锁定节点(`locked === true`);
- INSTANCE 节点(改 INSTANCE 会解绑主件);
- 已被删除的节点。

返回 `{ deleted, deletedHidden, deletedSlice, skippedLocked, skippedInstance }`。

## 六、诊断"为什么这两个没合并"(`plugin/src/analyzer/diagnoseMerge.ts`)

用户选中恰好 2 个节点点 ⚙ → `诊断为什么没合并`,插件依次检查 11 条约束:

1. 节点存在且可访问;
2. `visible !== false`;
3. `locked !== true`;
4. `type !== 'INSTANCE'`;
5. 名称未带已定案前缀(`img-` / `bg-` / `bgc-` / `x-` / `sub-`);
6. 两节点**同父**(合并只在同父兄弟间生效);
7. 父层为容器(`ChildrenMixin`);
8. bbox 存在且非空;
9. 尺寸 ≤ `maxItemSize`(超过阶段 A/B 都不参与);
10. `bboxGap <= gap` **或** `bboxOverlapRatio >= overlapThreshold`——阶段 A/B 走 gap,阶段 O 走 overlap;两者都不满足即不合并;
11. 合并守卫(父层合并后 ≥ 2、簇 ≤ maxCluster)。

命中任一即 push 一条 reason 回 UI。`wouldMerge` = 所有约束都过。

## 七、手动合并 & 手动打前缀

插件不做前缀自动推断,所以「打前缀」由两条路径:

### 7.1 手动合并(`plugin/src/merger/index.ts`)

- 面板上选中若干节点 → 右上「合并选中 ▼」→ 选 `img-` / `sub-` / `bg-`(可选 nameHint) → `mergeSelectedNodes(prefix, nameHint)` → 调 `figma.group()` + 设置 group.name。
- `mergeNodesByIds` 支持传节点 id 数组,给 UI 的 SuggestionPanel「应用全部」调。

### 7.2 手动打前缀(`plugin/src/tagger/index.ts`)

- 底部 `QuickTagPanel` 给面板选中节点批量打前缀;
- 支持基础前缀(`img-` / `sub-` / `bg-` / `bgc-` / `btn-` / `input-`)+ 修饰前缀(`fixed-` / `end-` / `list-` / `bl-`)叠加;
- 冲突策略 `onConflict: 'replace' | 'stack' | 'skip'`——已有 D2C 前缀时替换 / 叠加 / 跳过;
- 修饰前缀顺序按 pp-d2c 约定:`fixed-sub-` 而非 `sub-fixed-`。

## 八、AI 建议(`plugin/src/ai/*`)

面板顶部 `AI 建议` → 沙箱调 `requestAiSuggestions({scope, capability:'all'})`:

1. 用 `figma.exportAsync` 拉当前 scope 的 PNG 截图(base64);
2. 用 scanner 输出的 TreeNode 列表拼图层树 JSON;
3. `fetch('http://localhost:8787/ai/suggest', {method:'POST', body: JSON.stringify({tree, imageBase64, capability, prompt})})`;
4. `Promise.race([fetch, timeoutPromise(45s)])` 兜底 Figma 沙箱**无 `AbortController`**;
5. 中转服务(见 [ai-proxy 终稿](./ai-proxy_终稿.md))转发到 `peta.ctripcorp.com/agentApi/openai/chat/completions`,模型 `gpt-6-astra`;
6. 拿回 Suggestion[] 数组,`{source:'ai', nodeIds, action:'tag'|'merge', suggestedPrefix, reason, confidence}`;
7. UI `SuggestionPanel` 按父节点分组渲染,每组一个 `应用全部` 按钮批量落地(调 `mergeNodesByIds` 或 `tagNodes`)。

**关键契约**(与 ai-proxy 侧对齐):

- 请求体 JSON 上限 30MB(fastify `bodyLimit`);
- `gpt-6-astra` **只支持 `temperature: 1`**,请求体强制;
- `gpt-6-astra` **强制 `stream: true`**,ai-proxy 侧解 SSE 拼完整响应再一次性回传给沙箱;
- 失败降级:`degraded: true` + `message`,UI 显示原因不阻塞。

**错误序列化坑**:Figma 沙箱抛的 error 常常是非 Error 对象(`{code, message}` 或纯 string),`err instanceof Error` 判定不住,ai client 里有 `formatError()` 帮 stringify 才不会在 UI 上显示 `[object Object]`。

## 九、面板 UI(`plugin/src/ui/*`)

面板整体 960 × 680,分三段:

```
┌── 顶部 (Header) ──────────────────────────────────────────┐
│ PP D2C │ Scope: ○选中 ●页 │ Scan │ 一键合并·一键拆分·AI 建议·⚙参数 │ 合并选中 ▼ │ 日志·节点数 │
├── 中央 (TreeView) ────────────────────────────────────────┤
│  展开/折叠  ID  Type  Name (前缀色标)                        │
│  ...树形展示,virtualize 支持大稿子                          │
├── 底部 (LogPanel) ────────────────────────────────────────┤
│  [17:42:15] [INFO] iterativeMerge round 1: O 12 / A 8 / B 3│
│  [17:42:16] [WARN] ...                                    │
│  复制一条 ⧉ / 复制全部                                     │
└──────────────────────────────────────────────────────────┘
```

关键组件:

- **`SettingsPopover`**:⚙ 参数弹出面板,分三节 —— 一键合并 (gap / maxRounds / maxItemSize / overlapThreshold / 清理隐藏) / 一键拆分 (深拆) / 调试 (诊断按钮);header 折叠状态只留 5 个动作按钮,避免拥挤。
- **`TreeView`**:虚拟滚动,展示 TreeNode 列表,支持展开/折叠、选中(Cmd+Click 多选)、双击聚焦到 Figma 画布。
- **`QuickTagPanel`**:底部弹出,基础前缀 + 修饰前缀 + 冲突策略下拉,批量打标。
- **`SuggestionPanel`**:AI 建议列表,按 parent 分组树形结构,每组「应用全部」+ 逐条勾选。
- **`LogPanel`**:内存日志,自动 tail;每行 `⧉` 复制单条;`复制全部` 序列化为 `[时间] [级别] msg\ndetail` 文本。剪贴板 fallback 链:`navigator.clipboard.writeText` → `document.execCommand('copy')` → `window.prompt`。

## 十、消息协议(`plugin/src/types.ts`)

UI ↔ 沙箱通过 `postMessage` 通信,联合类型 `UiMessage` / `CodeMessage`。主要消息:

**UI → code**:`scan` / `tagNodes` / `renameNode` / `mergeSelected` / `mergeNodes` / `focusNode` / `analyze` / `oneClickMerge` / `deleteHidden` / `iterativeMerge` / `diagnoseMerge` / `ungroupSelected` / `aiSuggest`。

**code → UI**:`scanProgress` / `scanResult` / `tagResult` / `renameResult` / `mergeResult` / `canvasSelectionChanged` / `analyzeResult` / `deleteHiddenResult` / `iterativeMergeProgress` / `iterativeMergeResult` / `diagnoseMergeResult` / `ungroupResult` / `aiSuggestProgress` / `aiSuggestResult` / `error`。

沙箱 `selectionchange` 事件主动上报 `canvasSelectionChanged`,让 UI 与画布选中同步。

## 十一、与 pp-d2c / pp-doctor 的关系

- **上游 → 下游关系**:插件是 pp-d2c 的**上游预处理**——把普通稿子改造成"视觉分组已 group、隐藏/Slice 已清理、大背景已包含小元素"的形态,方便设计师在此基础上手动打前缀,然后交给 pp-d2c 出码;
- **完全解耦**:插件不 import pp-d2c、pp-d2c 不感知插件。唯一接口是"改造完的 Figma 文件"这一实体;
- **不做 pp-doctor 的事**:插件不生成健康报告、不做前缀互斥硬规则阻断——那是 pp-doctor 在 D2C 出码前的职责。设计师若担心稿子质量,可以在打完前缀后手动跑 pp-doctor 做终检;
- **不做 pp-d2c 出码时才处理的事**:根容器 `min-height: max(..., 100vh)`、`end-` wrapper + `space-between` 结构变换,都是 pp-d2c 的出码逻辑,插件不介入。

## 十二、开发与分发

**开发**:

```bash
cd plugin
node build.mjs --watch   # esbuild watch 模式,产出 dist/{code.js, ui.html}
```

**分发**:开发者本地打包 `plugin/` 整个目录发给设计师 → Figma 桌面版 → Plugins → Import plugin from manifest 加载 `plugin/manifest.json`。**不通过 npm 分发**(不在 `files` 白名单),独立版本号在 `plugin/manifest.json`。

**依赖**(项目根 `devDependencies`):`@figma/plugin-typings` / `esbuild` / `typescript` / `react` / `react-dom` / `@types/react` / `@types/react-dom`。

## 十三、已知坑与经验

1. **Figma 沙箱是 QuickJS**,不是浏览器 JS 引擎——**没有 `AbortController`**、`fetch` 有但受 `manifest.json` `allowedDomains` 限制。ai client 里用 `Promise.race([fetch, timeout])` 替代 abort。
2. **`allowedDomains` 不接受 IP + 端口**,只能是主机名。localhost 走 `devAllowedDomains`;生产端走 `allowedDomains: ["*"]` 或明确的 https 域名。
3. **错误对象常常不是 Error 实例**,`err.message` 拿不到,要 `try/catch` 后 `formatError()` 统一序列化。
4. **`figma.group()` 会同时打乱两处 z-order**:内部 children 顺序 + 新 group 在外层 parent 里的位置(默认置顶)。必须合并前拍父层快照,合并后既恢复内部次序(不按面积)、又把 group 移到"最底成员"的原 index。只做其一,还是会遮兄弟。
5. **B 阶段 sub- group 不能回锅**,否则一层套一层(sub-44 → sub-88 → sub-132),用 `sessionSubGroupIds` 单独隔离。
6. **合并守卫必须卡"父层剩余 ≥ 2"**,否则一簇覆盖父的所有子,合并等于给父重命名,污染树。
7. **删除隐藏节点必须同时删 Slice**,Slice 视觉不占位,留着只会污染合并候选。

## 十四、相关资料

- 关联 topic:[pp-d2c](../topics/pp-d2c.md) / [pp-doctor](../topics/pp-doctor.md) / [ai-proxy](../topics/ai-proxy.md)
- 关联 stock-doc:[ai-proxy 终稿](./ai-proxy_终稿.md)
