# pp-d2c-prep-plugin 技术方案

> 需求输入:`.Knowledge/req-docs/pp-d2c-prep-plugin_需求澄清.md`
> 关联主题:[pp-d2c](../topics/pp-d2c.md) / [pp-doctor](../topics/pp-doctor.md) / [pp-d2c-rn](../topics/pp-d2c-rn.md)

## 需求概述

在 pp-d2c 出码之前,新增一个 **Figma 插件**,把普通设计稿**半自动**改造为符合 D2C 约定的稿子。工具做两件事:

1. **前缀打标**:遍历图层树,给每个 frame 推荐 pp-d2c 前缀(`sub-` / `img-` / `bg-` / `bgc-` / `btn-` / `list-` / `input-` / `fixed-` / `end-` / `x-` / `scrollx-` / `scrolly-` / `bl-`)+ 置信度,面板批量确认后**原地改名**。
2. **Autolayout 化**:识别子层几何呈规整水平/垂直排列的 ABSOLUTE 容器,反推 `layoutMode` / `padding` / `itemSpacing` / `align` 参数,**原地设置** auto layout。

**不做**(与澄清一致):

- ❌ CLI / 服务形态(第一版只做插件)
- ❌ 业务语义自动打标(不猜"是订单卡片还是活动横幅")
- ❌ 强改已有 auto layout 的容器(只校验并提示)
- ❌ pp-d2c 出码时才处理的规则(根容器 `min-height:100vh` / `end-` wrapper 结构变换)
- ❌ 自动调用 pp-doctor(只导出健康报告)
- ❌ 网格布局识别 / `bl-` 自动推断 / Instance 主件同步

## 重点问题概述

### 1. 前缀推断的**准确度取舍**

- **核心机械类**(`img-` / `x-` / `fixed-` / `end-` / `scrollx-` / `scrolly-`)有明确几何/属性信号(单一位图子 / visible=false / constraints / overflowDirection),置信度天然高——**默认勾选 apply**。
- **半自动语义类**(`bg-` vs `bgc-` / `sub-` / `list-`)存在设计师意图问题——用 fills 复杂度 / 节点数 / 同构判定给候选,置信度只到"中",**面板要求人工确认**。
- **`btn-`** 依赖 `reactions` 属性和图层名关键词,准确度中等——**默认勾选但备注列显示依据**。

**核心取舍**:**宁保守不激进**——低置信度默认不勾选,避免"看起来自动了但实际改错"。pp-doctor 的语义"不猜业务"哲学一致。

### 2. Autolayout 判定的**误报风险**

几何反推最容易出错的两种情况:

- **重叠子**(徽章、水印、绝对定位角标):看起来是水平/垂直排列但实际有 z 轴堆叠——判定规则需检测 bbox 主轴不重叠(容差 ≤ 2px)。
- **网格排列**:3×N 或 2×N 网格,x/y 方差都大——判定规则要求"主副轴其一散布则保留 ABSOLUTE",牺牲网格召回换准确度。

### 3. Figma 插件 API 的**批量修改性能**

Figma 插件 API 是**同步阻塞**的,批量改上百个 frame 的 `name` 或 `layoutMode` 时会卡主线程。解决:

- **异步分片**:每处理 20 个 frame 通过 `setTimeout(0)` 让出主线程,面板显示进度条。
- **Undo 分组**:一次 Apply 内所有改动作为一个 undo 单元(Figma 插件默认行为,不需要显式 `commitUndo`——每次插件消息处理结束自动 commit)。

### 4. 前缀互斥硬规则的**执行侧**

pp-doctor 是 SKILL 层的规则,插件里要**镜像实现**若干条不可 apply 的硬规则(NAM014 / NAM016 / NAM019 / NAM020 + scroll 互斥),这些规则**不能靠 pp-doctor 执行**(pp-doctor 是 LLM 驱动的 SKILL,插件里无法直接调),必须在插件代码里独立实现一份。

**取舍**:插件与 pp-doctor 会存在**规则冗余**,若 pp-doctor 后续新增/修改互斥规则,插件需同步更新——通过在 `guards/mutex.ts` 顶部注释显式指向 pp-doctor 对应规则 id 降低维护成本。

### 5. 与 pp-d2c 版本演进的**耦合**

pp-d2c SKILL 版本独立于 npm 包版本演进(见 pp-d2c topic §版本口径),前缀集与判定条件可能持续新增(如 v0.3.2 加 `end-`、v0.3.4 加 `input-`)。插件的前缀集配置**外置为常量文件** `plugin/rules/prefix-catalog.ts`,新增前缀时只改这一处 + 对应判定模块。

## 外部依赖与内部调用

### 外部依赖

- **Figma Plugin API**(`@figma/plugin-typings`):遍历图层、读几何/属性、原地改 `name` / `layoutMode` / `paddingLeft/Top/Right/Bottom` / `itemSpacing` / `counterAxisAlignItems` / `primaryAxisAlignItems`。
- **esbuild**(devDependency):打包 TS 源码到 `plugin/dist/code.js` 与 `plugin/dist/ui.js`。
- **React**(可选,UI 层):面板列表用 React 更清晰;若不想引入,用原生 DOM 也行——**推荐 React** + esbuild JSX 支持,方案按 React 出。

### 内部调用

**本插件与 pp-d2c 主流程完全解耦**——插件不 import pp-d2c 任何脚本、pp-d2c 不感知插件存在。**唯一接口**是"改造完的 Figma 文件"这一实体对象:

- 插件产出:一份**图层名和 auto layout 属性被修改过的 Figma 稿**。
- pp-d2c 消费:通过 `figma.mjs get-metadata` 拉图层树时,读到的就是改造后的结构。

**健康报告导出**:插件生成一份 JSON,格式与 pp-doctor 的报告字段可对齐(见「交付单元」),但**不调用** pp-doctor。

## 配置

### 插件配置(`plugin/manifest.json`)

Figma 插件标准 manifest,声明 UI 入口、编辑器类型、API 版本。**无用户可配置项**。

### 项目侧新增依赖(`package.json`)

在项目根 `package.json` 的 `devDependencies` 中新增:

- `@figma/plugin-typings` — Figma Plugin API 类型定义
- `esbuild` — 打包
- `typescript` — 类型检查(不必真的编译,只用 `tsc --noEmit` 类型检查)
- `react`、`react-dom`、`@types/react`、`@types/react-dom` — UI 层

在 `scripts` 中新增:

- `"build:plugin"` — esbuild 打包 code.ts + ui.tsx → `plugin/dist/`
- `"watch:plugin"` — esbuild watch 模式,开发用
- `"typecheck:plugin"` — `tsc --noEmit -p plugin/tsconfig.json`

**不新增**运行时依赖(插件只在 Figma 沙箱内跑,不需要发 npm)。

### 插件参数(内置常量,`plugin/rules/prefix-catalog.ts`)

导出前缀清单 + 每个前缀的判定阈值,不做成用户可配置(pp-d2c 前缀是硬编码协议,插件也是硬编码)。

```ts
export const PREFIX_CATALOG = {
  'img-':      { confidence: 'high',   category: 'core-mechanical' },
  'x-':        { confidence: 'high',   category: 'core-mechanical' },
  'fixed-':    { confidence: 'medium', category: 'core-mechanical', modifier: true },
  'end-':      { confidence: 'medium', category: 'core-mechanical', modifier: true },
  'scrollx-':  { confidence: 'medium', category: 'core-mechanical' },
  'scrolly-':  { confidence: 'medium', category: 'core-mechanical' },
  'btn-':      { confidence: 'medium', category: 'core-mechanical' },
  'input-':    { confidence: 'medium', category: 'special' },
  'bg-':       { confidence: 'medium', category: 'semantic' },
  'bgc-':      { confidence: 'medium', category: 'semantic' },
  'sub-':      { confidence: 'medium', category: 'semantic' },
  'list-':     { confidence: 'medium', category: 'semantic', modifier: true },
  'bl-':       { confidence: 'low',    category: 'semantic', modifier: true, autoInfer: false }, // v1 不自动推
};

export const AUTOLAYOUT_THRESHOLDS = {
  crossAxisAlignVarianceRatio: 0.2,  // 副轴中心点方差 / 主轴平均间距,超过此比例视为非规整排列
  primaryAxisSpacingCV: 0.3,         // 主轴间距变异系数(std/mean),超过此值视为间距非均匀
  minChildrenForAutolayout: 2,       // 少于 2 个子不判定 auto layout
  overlapTolerance: 2,               // bbox 主轴重叠容差(px)
  paddingReasonableMax: 200,         // padding 反推值上限,超过判为异常不写
  edgeStickThreshold: 4,             // 首末子贴父边缘的容差,用于判定 SPACE_BETWEEN
  spaceBetweenMinGap: 20,            // 主轴间距超过此值 + 首末贴边才启用 SPACE_BETWEEN
};

export const SCAN_LIMITS = {
  softWarnNodes: 1000,   // 超过弹提示可中断
  hardStopNodes: 5000,   // 硬上限,拒绝 Scan(与 pp-doctor 对齐)
};
```

## 交付单元

### `plugin/manifest.json` — Figma 插件清单

**用途**:声明插件元信息,Figma 桌面版加载入口。

**输入**:无。

**输出**:标准 Figma 插件 manifest,字段:

```json
{
  "name": "PixelPrint D2C Prep",
  "id": "<Figma 分配>",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "capabilities": [],
  "networkAccess": { "allowedDomains": ["none"] }
}
```

**关键取舍**:`networkAccess: none` — 插件**不访问外网**,只在本地对 Figma 文档做读写。避免设计师担心数据外传。

### `plugin/src/code.ts` — 沙箱主入口

**用途**:Figma 插件的沙箱主进程,持有 Figma document 对象,响应 UI postMessage,调用 scanner / applier。

**输入**:UI 层通过 `figma.ui.onmessage` 发来的命令消息。

**输出**:通过 `figma.ui.postMessage` 回发结果消息。

**消息协议**(严格定义,双向):

| 消息类型 | 方向 | payload | 说明 |
|---------|-----|--------|------|
| `scan` | UI → code | `{ scope: 'selection' \| 'page' }` | 触发 Scan |
| `scanProgress` | code → UI | `{ scanned: number, total: number }` | 进度反馈 |
| `scanResult` | code → UI | `{ candidates: Candidate[], summary: ScanSummary }` | Scan 结果 |
| `apply` | UI → code | `{ candidateIds: string[] }` | 用户勾选后触发 Apply |
| `applyProgress` | code → UI | `{ applied: number, total: number }` | Apply 进度 |
| `applyResult` | code → UI | `{ success: number, failed: FailedItem[] }` | Apply 完成 |
| `exportReport` | UI → code | `{}` | 导出健康报告 |
| `reportReady` | code → UI | `{ report: HealthReport }` | 报告数据(UI 侧生成下载) |
| `focusNode` | UI → code | `{ nodeId: string }` | 在 Figma 中聚焦某节点 |
| `error` | code → UI | `{ message: string, code: string }` | 错误反馈 |

**处理流程**:

1. 插件启动时 `figma.showUI(__html__, { width: 900, height: 640 })`。
2. 注册 `figma.ui.onmessage` 分派到子模块。
3. `scan` 消息 → 调 `scanner.scan(scope)` → 分片遍历(每 20 节点 `await sleep(0)`)→ 中途发 `scanProgress` → 完成后发 `scanResult`。
4. `apply` 消息 → 调 `applier.apply(candidateIds)` → 逐条应用 → 中途发 `applyProgress` → 完成后发 `applyResult`。
5. `exportReport` 消息 → 调 `report.generate()` → 发 `reportReady`。
6. `focusNode` → `figma.currentPage.selection = [node]; figma.viewport.scrollAndZoomIntoView([node])`。

**数据结构**:

```ts
interface Candidate {
  id: string;                    // Figma node.id
  nodePath: string;              // "Page1 > Frame123 > Group > Rect5"
  currentName: string;           // 原图层名
  suggestedPrefix: string | null;// 建议前缀(如 "sub-" / "img-" / null=无建议)
  suggestedName: string;         // 完整建议名(前缀 + 原名 / 前缀 + 兜底名)
  suggestedAutolayout: AutolayoutSpec | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string[];              // 判定依据,用于面板 tooltip
  warnings: Warning[];           // 硬规则命中 / 旧前缀 / 兜底命名等
  defaultChecked: boolean;       // 默认是否勾选
  blockApply: boolean;           // 硬规则命中,不可 apply
}

interface AutolayoutSpec {
  layoutMode: 'VERTICAL' | 'HORIZONTAL';
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisAlignItems: 'MIN' | 'SPACE_BETWEEN';
}

interface Warning {
  level: 'error' | 'warn' | 'info';
  code: string;   // 如 "NAM014" / "OLD_PREFIX" / "FALLBACK_NAME"
  message: string;
}

interface HealthReport {
  scanTime: string;              // ISO 时间
  scope: 'selection' | 'page';
  totalFrames: number;
  prefixDistribution: Record<string, number>;
  autolayoutCoverage: {
    hasAutolayout: number;
    absoluteButConvertible: number;
    absoluteKept: number;
  };
  mutexViolations: number;
  fallbackNames: number;
  oldPrefixDetected: number;
}
```

### `plugin/src/scanner/index.ts` — 遍历与候选生成

**用途**:遍历 Figma 图层树,对每个 frame 生成 `Candidate`。

**输入**:`scope: 'selection' | 'page'`。

**输出**:`Candidate[]` + `ScanSummary`。

**处理流程**:

1. **确定根节点**:
   - `scope === 'selection'`:`figma.currentPage.selection` 中所有节点及其子孙。
   - `scope === 'page'`:`figma.currentPage.children` 中所有顶层 frame 及其子孙。
2. **深度优先遍历**(不递归进 `x-` 前缀的子树,不递归进 Instance):
   - 计数 `nodeCount`,超过 `SCAN_LIMITS.softWarnNodes` 提示可中断,超过 `SCAN_LIMITS.hardStopNodes` 直接终止。
   - 每 20 节点 `await new Promise(r => setTimeout(r, 0))` 让出主线程 + 发 `scanProgress`。
3. **对每个 frame** 调用:
   - `rules/prefix/infer.ts` → 得到 `suggestedPrefix` + `confidence` + `reason`。
   - `rules/autolayout/infer.ts` → 得到 `suggestedAutolayout` 或 null。
   - `guards/mutex.ts` → 校验建议前缀是否命中硬规则,命中则设 `blockApply: true`。
   - `naming/generate.ts` → 生成完整建议名(处理原名叠加、兜底命名、旧前缀检测)。
4. **返回**候选列表和汇总统计。

**边界**:

- Instance(`node.type === 'INSTANCE'`):跳过,不生成候选(避免解绑主件)。
- 锁定图层(`node.locked === true`):生成候选但 `blockApply: true`,warning 提示"请先解锁"。
- 隐藏图层(`node.visible === false`):按 `x-` 前缀候选。
- 非 FRAME/GROUP/COMPONENT/RECTANGLE 类型(如 TEXT / VECTOR):跳过,不生成候选(叶子节点不加前缀)。

### `plugin/src/rules/prefix/*.ts` — 前缀推断规则

**用途**:每种前缀独立一个文件,导出 `infer(node) => { matched: boolean, confidence, reason[] }`。总入口 `plugin/src/rules/prefix/infer.ts` 按优先级组合调用。

**判定规则**(与澄清 §3.2 一致):

| 前缀 | 文件 | 关键判定 |
|-----|------|--------|
| `x-` | `x.ts` | `visible === false` 或 name 含 "注释"/"辅助"/"guide"/"annotation" |
| `img-` | `img.ts` | 单一子层 + 子是 RECT with IMAGE fill 或单 VECTOR |
| `btn-` | `btn.ts` | 内含 TEXT + cornerRadius>0 或 SOLID fill,子孙 ≤ 5,或 `reactions.length>0`,或 name 含 "btn"/"button"/"按钮" |
| `bg-` vs `bgc-` | `bg-bgc.ts` | 复杂 fills(含 IMAGE / GRADIENT_RADIAL / 多层)/ 复杂 effects → `bg-`;简单 SOLID / GRADIENT_LINEAR + 简单 stroke + cornerRadius → `bgc-` |
| `fixed-` | `fixed.ts` | `constraints.vertical === 'TOP'/'BOTTOM'` 且 `constraints.horizontal === 'LEFT_RIGHT'`,或节点位于父顶部/底部 8% 范围 |
| `end-` | `end.ts` | 父有 `layoutMode`,且是最后一个可见子,且与前一兄弟主轴间距 > 平均间距 × 2 |
| `sub-` | `sub.ts` | 是顶层 frame 的直接子,子孙节点数 > 8,与兄弟主轴间距 > 24px |
| `list-` | `list.ts` | 内有 ≥ 2 个同构子(类型 + 深度 3 子结构签名,复用 pp-d2c 的 `structureSig` 思路) |
| `input-` | `input.ts` | name 含 "输入"/"搜索"/"input"/"search",或单 TEXT 子内容以「请输入」/「Search」开头 + 父有 stroke |
| `scrollx-` / `scrolly-` | `scroll.ts` | `overflowDirection === 'HORIZONTAL_SCROLLING'` / `'VERTICAL_SCROLLING'`,或子层沿主轴超出父 bbox |
| `bl-` | `bl.ts` | **v1 不自动推断**,导出空实现,面板下拉可手动加 |

**组合优先级**(与 pp-d2c topic §设计原理一致):

```
x- > img- > bg- > bgc- > btn- > scrollx-/scrolly- > 无前缀
```

修饰前缀(`fixed-` / `end-` / `bl-` / `list-`)最后叠加:

- 命中 `fixed-` + 基础前缀命中 `sub-` → 输出 `fixed-sub-<name>`
- 命中 `fixed-` 但基础前缀未命中 → `suggestedPrefix: null`,warning "需先确认基础前缀"

**兜底**:所有规则都不命中,`suggestedPrefix: null`。

### `plugin/src/rules/autolayout/infer.ts` — Autolayout 推断

**用途**:对 `layoutMode === 'NONE'` 的 frame 反推 auto layout 参数;对已有 auto layout 的 frame 只做**校验**并生成 warning。

**输入**:`node: FrameNode`。

**输出**:`AutolayoutSpec | null` + `reasoning: string[]`。

**处理流程**:

1. **前置过滤**:
   - `node.layoutMode !== 'NONE'` → 走**校验分支**:比对声明的 padding/gap 与实际几何,不一致时返回 `null` + warning "已有 auto layout,建议核对:xxx"。
   - 子层数 < `AUTOLAYOUT_THRESHOLDS.minChildrenForAutolayout` → 返回 `null`。
   - 有子层是 Instance / 隐藏 / 锁定 → 计入判定,但按可见几何算。
2. **主轴判定**:
   - 计算所有可见子层 bbox 中心点 `(cx, cy)`。
   - 计算 x 方差 `varX` 和 y 方差 `varY`。
   - `varY > varX * 4` → 主轴 = `VERTICAL`;`varX > varY * 4` → `HORIZONTAL`;否则(散布或近似正方形排列)→ 返回 `null`。
3. **主轴不重叠检查**:
   - 按主轴坐标排序,相邻子的 bbox 主轴投影不允许重叠 > `overlapTolerance`,否则返回 `null`。
4. **副轴对齐检查**:
   - 副轴中心点方差 / 主轴平均间距 > `crossAxisAlignVarianceRatio` → 返回 `null`。
5. **间距均匀检查**:
   - 相邻主轴间距标准差 / 平均值 > `primaryAxisSpacingCV` → 返回 `null`。
6. **参数反推**:
   - `paddingTop/Right/Bottom/Left`:父 bbox 边缘 − 首/末子 bbox 边缘,四方向分别算;若 < 0 或 > `paddingReasonableMax` → 该方向填 0 + warning。
   - `itemSpacing`:相邻主轴间距的**中位数**(避免均值被极端拉偏)。
   - `counterAxisAlignItems`:所有子副轴中心点均值,按 0-33% / 33-67% / 67-100% → `MIN` / `CENTER` / `MAX`。
   - `primaryAxisAlignItems`:默认 `MIN`;若首末子贴父边缘(padding 首末 ≤ `edgeStickThreshold`)且中间间距 > `spaceBetweenMinGap` → `SPACE_BETWEEN`。
7. 返回 `AutolayoutSpec` + `reasoning: ["主轴=VERTICAL (varY=2400 varX=15)", "gap=12 (标准差 2)", ...]`。

### `plugin/src/guards/mutex.ts` — 前缀互斥硬规则

**用途**:在 `applyList` 生成前,校验每个候选是否命中前缀互斥硬规则,命中则设 `blockApply: true` + warning。

**输入**:`Candidate`(含 `suggestedPrefix`)。

**输出**:`Warning[]`,若含 `level === 'error'` 则调用方设 `blockApply: true`。

**处理流程**:按下表**顺序**检查前缀组合,任一命中即产生 error 级 warning。

| 规则 | 触发条件 | 对齐 pp-doctor |
|-----|--------|--------------|
| NAM014 | `fixed-` + (`bg-` / `bgc-` / `x-`) | 是 |
| NAM016 | `end-` + (`bg-` / `bgc-` / `x-`) | 是 |
| NAM019 | `input-` + (`bg-` / `bgc-` / `x-`) | 是 |
| NAM020 | `input-` + (`img-` / `btn-`) | 是 |
| SCROLL-MUTEX-1 | `scrollx-` + `scrolly-` | pp-d2c topic §边界 |
| SCROLL-MUTEX-2 | (`scrollx-` / `scrolly-`) + (`img-` / `bg-` / `bgc-` / `x-` / `btn-`) | pp-d2c topic §边界 |

**取舍**:文件顶部注释显式指向 pp-doctor 对应规则 id,方便 pp-doctor 规则演进时同步更新。**不实现** pp-doctor 的全部规则(节点数上限、结构约束等),只实现"前缀组合"这一子集——这一子集是 apply 时可**机械判定**的。

### `plugin/src/naming/generate.ts` — 命名生成

**用途**:根据候选前缀 + 原图层名,生成最终建议名。

**输入**:`{ node, suggestedPrefix, siblingNames }`。

**输出**:`{ suggestedName, warnings }`。

**处理流程**:

1. **旧前缀检测**(生成 warning 但不自动改):
   - 若 `node.name` 匹配 `/^(card|blk|module|section|wrap|content)-/` → warning `OLD_PREFIX`,面板标黄。
   - 若 `node.name` 已匹配 pp-d2c 前缀 → warning `EXISTING_D2C_PREFIX`,面板显示"已有前缀,是否覆盖",默认不勾选。
2. **原名保留判定**:
   - `node.name` 是 Figma 默认命名(正则 `/^(Frame|Rectangle|Group|Instance|Component|Vector|Ellipse|Polygon) \d+$/`)→ 走**兜底命名**。
   - 否则:`suggestedName = <prefix><原名>`(叠加,不覆盖)。
3. **兜底命名**(语义化英文,置信度 `low` 备注):
   - 类型词从前缀反推:
     - `sub-` → 若父是页面根 frame 用 `section`,否则用 `card` / `group`
     - `img-` → `image`
     - `bg-` → `background`
     - `bgc-` → `box`
     - `btn-` → `button`
     - `list-` → `list`
     - `input-` → `field`
     - 无前缀 → `frame`
   - 序号:在同一父下同前缀内递增,从 `01` 开始,通过 `siblingNames` 上下文避免撞名。
   - 示例:`sub-card-01` / `img-image-01` / `btn-button-01`。
   - 附加 warning `FALLBACK_NAME`,面板标蓝提示"兜底命名,建议人工核对语义"。
4. **重名预检**:
   - 若 `siblingNames.includes(suggestedName)` → 序号自动 +1 直到不撞。

### `plugin/src/applier/index.ts` — 落地修改

**用途**:接收用户勾选的候选 id 列表,原地改 Figma 图层名 + 设 auto layout。

**输入**:`candidateIds: string[]`,配合缓存的 `Candidate[]`。

**输出**:`{ success: number, failed: FailedItem[] }`。

**处理流程**:

1. 遍历 `candidateIds`,对每个 candidate:
   - `figma.getNodeById(id)` — 拿到 node,若为 null(节点已删)→ 记 failed。
   - `node.locked === true` → 记 failed,message "节点已锁定"。
   - **改名**:`node.name = candidate.suggestedName`。
   - **设 auto layout**(若 `suggestedAutolayout !== null`):
     - `node.layoutMode = spec.layoutMode`
     - `node.paddingTop/Right/Bottom/Left = spec.paddingXxx`
     - `node.itemSpacing = spec.itemSpacing`
     - `node.counterAxisAlignItems = spec.counterAxisAlignItems`
     - `node.primaryAxisAlignItems = spec.primaryAxisAlignItems`
   - try/catch 单条,失败记入 `failed[]`,不影响其他条。
2. 每 20 条 `await new Promise(r => setTimeout(r, 0))` 让出主线程 + 发 `applyProgress`。
3. 完成后发 `applyResult`。

**边界**:

- **单次事务**:Figma 插件每次消息处理结束自动 commit undo,一次 Apply 内所有改动是一个 Cmd+Z 单元。**不需要显式** `figma.commitUndo()`。
- **图层顺序不变**:Applier 只改 `name` 和 auto layout 属性,**不改** `parent.children` 顺序、不新增/删除层级、不改视觉属性(fills/strokes/effects/cornerRadius/blendMode/opacity)。
- **改 auto layout 会自动重排子层几何**:Figma 设 `layoutMode` 后子层由绝对定位转为流式布局,视觉可能有 ±几 px 变化——这是 Figma API 行为,不可避免。面板 Apply 后提示"已改动 N 个 auto layout,建议目视核对"。

### `plugin/src/report/generate.ts` — 健康报告导出

**用途**:导出改造后当前页/选中范围的健康报告 JSON,供设计师后续跑 pp-doctor。

**输入**:当前 Scan 的候选列表 + Apply 的结果。

**输出**:`HealthReport` 对象(结构见前 code.ts 数据结构定义)。

**处理流程**:

1. 遍历改造后的当前 scope(重新扫一次,不复用 Scan 缓存,保证真实反映 apply 后状态)。
2. 统计:
   - `totalFrames`:frame 总数
   - `prefixDistribution`:每种前缀命中数
   - `autolayoutCoverage`:三档统计
   - `mutexViolations`:改造后仍有前缀互斥的节点数(理论应为 0)
   - `fallbackNames`:走了兜底命名的节点数
   - `oldPrefixDetected`:仍带旧前缀的节点数
3. UI 侧收到 `reportReady` 后触发浏览器下载(用 `Blob` + `URL.createObjectURL`)。

**输出文件名**:`pp-d2c-prep-report-<yyyymmdd-hhmmss>.json`。

### `plugin/src/ui/App.tsx` — 面板 UI

**用途**:React 面板,展示候选表格,处理用户交互。

**输入**:通过 `window.onmessage` 接收 code 层消息。

**输出**:通过 `parent.postMessage` 发命令给 code 层。

**关键 UI 结构**:

```
┌─────────────────────────────────────────────────┐
│ [Scope: ◉ 整页 ○ 选中]   [Scan]  [Apply]  [导出报告] │
├─────────────────────────────────────────────────┤
│ ☐  节点路径     当前名   建议前缀▼  autolayout   置信度   备注   │
│ ☑  Page1>...   订单卡片  sub-      VER/gap:12  高       -    │
│ ☑  Page1>...   Frame123  bg-       -           中     兜底名  │
│ ☒  Page1>...   header    fixed-bg- -          高      NAM014 阻止 │
│ ...                                                        │
├─────────────────────────────────────────────────┤
│ 候选 42 项 / 已勾选 38 项 / 硬规则阻塞 2 项        [Apply] │
└─────────────────────────────────────────────────┘
```

**列细节**:

- **勾选框**:三态(勾/不勾/禁用);禁用态用于 `blockApply === true` 的行。
- **节点路径**:点击调 `focusNode` 消息,让 Figma 定位到该节点。
- **建议前缀 下拉**:含所有 pp-d2c 前缀 + "保持不变" + "自定义"(允许手输)。
- **autolayout**:显示摘要如 `VER / gap:12 / pad:16,16,16,16`;点开一个 popover 可编辑各参数(数值输入框)。
- **置信度**:绿(high) / 黄(medium) / 灰(low)色标。
- **备注列**:warning 列表,error 红、warn 黄、info 蓝;鼠标 hover 显示完整信息。

**交互细节**:

- 默认勾选逻辑:`candidate.defaultChecked && !candidate.blockApply`。
- 批量操作按钮组(表格上方):`全选高置信 / 反选 / 清空`。
- 表格支持按前缀分组视图(切换按钮)。
- Apply 前弹确认框:"将修改 N 个图层,是否继续?(Cmd+Z 可撤销)"。
- Apply 后显示 toast:"成功 N 项 / 失败 M 项",失败项在表格中标红并附错误 message。

### `plugin/tsconfig.json` — TS 配置

**关键字段**:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "jsx": "react",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "typeRoots": ["../node_modules/@types", "../node_modules/@figma"]
  },
  "include": ["src/**/*"]
}
```

### `plugin/build.mjs` — esbuild 打包脚本

**用途**:一份脚本编译 code + ui,产出 `plugin/dist/`。

**处理流程**:

```js
// plugin/build.mjs
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const watch = process.argv.includes('--watch');
const opts = {
  code: {
    entryPoints: ['plugin/src/code.ts'],
    bundle: true,
    format: 'iife',   // Figma 沙箱要求 IIFE
    target: 'es2017',
    outfile: 'plugin/dist/code.js',
  },
  ui: {
    entryPoints: ['plugin/src/ui/index.tsx'],
    bundle: true,
    format: 'iife',
    target: 'es2017',
    outfile: 'plugin/dist/ui.js',
    loader: { '.svg': 'text' },
  },
};

async function run() {
  if (watch) {
    const codeCtx = await context(opts.code);
    const uiCtx = await context(opts.ui);
    await Promise.all([codeCtx.watch(), uiCtx.watch()]);
    console.log('watching...');
  } else {
    await Promise.all([build(opts.code), build(opts.ui)]);
  }
  // 生成 ui.html,内联 ui.js
  const uiJs = readFileSync('plugin/dist/ui.js', 'utf8');
  writeFileSync('plugin/dist/ui.html', `<!DOCTYPE html><html><body><div id="root"></div><script>${uiJs}</script></body></html>`);
}

run();
```

**产出**:

- `plugin/dist/code.js` — 沙箱主入口
- `plugin/dist/ui.html` — 面板 HTML(内联 ui.js)
- `plugin/dist/ui.js` — 中间产物,可选删除

## 调用/交互流程

用户视角的完整链路:

```
1. Figma 桌面版 → Plugins → PixelPrint D2C Prep
   ↓
2. 面板打开,顶部选 scope(默认整页)
   ↓
3. 点 Scan
   → code.ts 收 scan 消息
   → scanner 遍历(每 20 节点让出主线程)
   → 中途 UI 显示进度条
   → 完成后 UI 收 scanResult,渲染表格
   ↓
4. 用户勾选、修正、编辑参数
   ↓
5. 点 Apply
   → 弹确认框
   → code.ts 收 apply 消息
   → applier 逐条改名 + 设 auto layout
   → 中途 UI 显示进度条
   → 完成后 UI 收 applyResult,显示 toast
   ↓
6. (可选)用户在 Figma 里目视核对,Cmd+Z 撤销 or 再次 Scan 迭代
   ↓
7. (可选)点导出报告
   → code.ts 收 exportReport 消息
   → report.generate 重新扫一次
   → UI 收 reportReady,触发浏览器下载 JSON
   ↓
8. 后续在同一份 Figma 稿上跑 pp-d2c → 出码
```

**关键时序保证**:

- Scan 时**不**动 Figma 文档(纯读),Apply 时才写。
- Scan 与 Apply 之间用户可反复调整勾选,只要不点 Apply,文档不变。
- Apply 中途出错不整体回滚(逐条 try/catch),但 Cmd+Z 可整体撤销(Figma 原生行为)。

## 异常处理

| 异常类型 | 触发场景 | 处理策略 |
|--------|--------|--------|
| `SCAN_HARD_STOP` | Scan 时节点数 > 5000 | 立即终止,UI 弹窗"节点数超限,请缩小选择范围" |
| `SCAN_SOFT_WARN` | Scan 时节点数 > 1000 | UI 弹窗"节点数较多可能耗时,继续?"(允许用户中断) |
| `NODE_NOT_FOUND` | Apply 时 `getNodeById(id) === null`(节点已删) | 该条记 failed,不影响其他 |
| `NODE_LOCKED` | Apply 时 `node.locked === true` | 该条记 failed,message "节点已锁定" |
| `AUTOLAYOUT_API_ERROR` | 设 `layoutMode` 时 Figma API 抛错 | catch 后记 failed,附原始错误 message |
| `INSTANCE_MODIFY` | 目标是 Instance | Scan 阶段已跳过,不进入 Apply |
| `PADDING_NEGATIVE` | Autolayout 反推 padding 出现负值 | 该方向填 0,warning "反推 padding 异常,可能有子超出父 bbox" |
| `MUTEX_VIOLATION` | 建议前缀命中互斥硬规则 | Scan 阶段就设 `blockApply: true`,不进入 Apply |
| `NAME_COLLISION` | Apply 后同父下重名 | 序号自动递增,不阻塞 |
| `UI_MESSAGE_TIMEOUT` | UI 长时间没收到 code 层响应(30s) | UI 显示"处理超时,请重启插件",不做自动重试 |

**统一错误反馈**:所有错误通过 `error` 消息回 UI,UI 侧统一 toast + 表格行标红。

## 数据模型

**运行时数据**(全部在插件沙箱内存,无持久化):

```ts
// 单个候选(scanner 产出,applier 消费)
interface Candidate {
  id: string;
  nodePath: string;
  currentName: string;
  suggestedPrefix: string | null;
  suggestedName: string;
  suggestedAutolayout: AutolayoutSpec | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string[];
  warnings: Warning[];
  defaultChecked: boolean;
  blockApply: boolean;
}

interface AutolayoutSpec {
  layoutMode: 'VERTICAL' | 'HORIZONTAL';
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisAlignItems: 'MIN' | 'SPACE_BETWEEN';
}

interface Warning {
  level: 'error' | 'warn' | 'info';
  code: string;   // NAM014 / OLD_PREFIX / FALLBACK_NAME / EXISTING_D2C_PREFIX / PADDING_NEGATIVE
  message: string;
}

// 健康报告(导出为 JSON)
interface HealthReport {
  scanTime: string;
  scope: 'selection' | 'page';
  totalFrames: number;
  prefixDistribution: Record<string, number>;
  autolayoutCoverage: {
    hasAutolayout: number;
    absoluteButConvertible: number;
    absoluteKept: number;
  };
  mutexViolations: number;
  fallbackNames: number;
  oldPrefixDetected: number;
  candidates: Array<{                // 明细,便于 review
    id: string;
    finalName: string;
    hasAutolayout: boolean;
    warnings: string[];
  }>;
}
```

**无数据库、无缓存文件**——插件是纯前端,一次会话内所有数据都在内存,关闭插件即丢失。

## 目录结构

```
PixelPrint/
├── plugin/                          # 新增,独立于 templates/skills/
│   ├── manifest.json                # Figma 插件清单
│   ├── tsconfig.json                # TS 配置
│   ├── build.mjs                    # esbuild 打包脚本
│   ├── README.md                    # 插件说明(安装、使用)
│   ├── src/
│   │   ├── code.ts                  # 沙箱主入口
│   │   ├── scanner/
│   │   │   ├── index.ts             # 遍历入口
│   │   │   └── walker.ts            # 深度优先遍历工具
│   │   ├── rules/
│   │   │   ├── prefix-catalog.ts    # 前缀清单常量
│   │   │   ├── prefix/
│   │   │   │   ├── infer.ts         # 前缀推断入口(组合各子规则)
│   │   │   │   ├── x.ts
│   │   │   │   ├── img.ts
│   │   │   │   ├── btn.ts
│   │   │   │   ├── bg-bgc.ts
│   │   │   │   ├── fixed.ts
│   │   │   │   ├── end.ts
│   │   │   │   ├── sub.ts
│   │   │   │   ├── list.ts
│   │   │   │   ├── input.ts
│   │   │   │   ├── scroll.ts
│   │   │   │   └── bl.ts            # v1 只导出空实现
│   │   │   └── autolayout/
│   │   │       └── infer.ts
│   │   ├── guards/
│   │   │   └── mutex.ts             # 前缀互斥硬规则
│   │   ├── naming/
│   │   │   └── generate.ts          # 命名生成(含兜底、旧前缀检测)
│   │   ├── applier/
│   │   │   └── index.ts             # 落地修改
│   │   ├── report/
│   │   │   └── generate.ts          # 健康报告
│   │   └── ui/
│   │       ├── index.tsx            # UI 入口
│   │       ├── App.tsx              # 主组件
│   │       ├── components/
│   │       │   ├── CandidateTable.tsx
│   │       │   ├── ScopeSwitcher.tsx
│   │       │   ├── AutolayoutEditor.tsx
│   │       │   └── WarningBadge.tsx
│   │       └── styles.css
│   └── dist/                        # esbuild 产物,gitignore
│       ├── code.js
│       └── ui.html
├── package.json                     # 新增 scripts + devDependencies
└── ...(原有文件不变)
```

**目录选型说明**:

- 独立顶层 `plugin/`,不放 `templates/skills/` 内——它不是 skill,是可执行插件。
- 与现有 `bin/`(install 脚本)、`templates/`(skill 模板)、`docs/`(设计师文档)平级。
- 插件 README 独立,不复用主 README。

## 与现有工程约定的对齐

| 项 | 项目现状 | 本方案 |
|---|--------|-------|
| 语言 | JS(.mjs ESM,`bin/install.js`)、Markdown(SKILL.md) | 新增 TS(仅 `plugin/`,主项目仍是 JS) |
| 包管理 | npm,`package.json` | 复用,`devDependencies` 新增 esbuild / TS / React |
| 打包 | 无(bin 是纯脚本,templates 是文本) | 新增 esbuild,只作用于 `plugin/` |
| 测试 | `test/rules/` + `test/rules-rn/`(Node 直跑 .mjs) | v1 不做单元测试(见「未决问题」);后续按项目风格 |
| Lint | 无 | 沿用无 lint 状态 |
| CI | 无(纯 npm 包) | 沿用无 CI |
| 版本 | package.json `1.6.0-beta.0` | 插件不入 npm 包发布(不在 `files` 白名单),独立版本号在 `plugin/manifest.json` |

**关键约定**:

- 插件产物 `plugin/dist/` **加入 .gitignore**,不入版本控制(build 出来的)。
- 但 `plugin/dist/` 也**不入 npm 发布**——插件是给设计师用 Figma 桌面版直接加载,不通过 npm 分发。
- 插件源码 `plugin/src/` **入版本控制**,便于协作维护。
- 分发方式:开发者跑 `npm run build:plugin` → 把 `plugin/` 整个目录发给设计师 → Figma 桌面版 → Plugins → Import plugin from manifest 加载 `plugin/manifest.json`。

## 验收标准

改造完插件后应满足(逐条):

- [ ] `npm run build:plugin` 无报错,产出 `plugin/dist/code.js` + `plugin/dist/ui.html`。
- [ ] `npm run typecheck:plugin` 无 TS 错误。
- [ ] Figma 桌面版加载 `plugin/manifest.json` 成功,面板正常打开。
- [ ] 对澄清文档 §7 提供的 3 个参考稿跑 Scan,得到候选清单(不报错、不卡死)。
- [ ] 对一份新普通稿跑 Scan → 勾选 → Apply → Cmd+Z 撤销,整个链路无异常。
- [ ] 前缀互斥硬规则命中的行**不可勾选**,面板标红。
- [ ] 旧前缀 / 兜底命名 / 已有 D2C 前缀的行**面板标黄/蓝**,警告清晰。
- [ ] 导出健康报告 JSON 可下载,字段完整(见 `HealthReport` 结构)。
- [ ] Apply 后**图层树结构不变**(层级、子层顺序、视觉属性不变)。
- [ ] Scan 节点数 > 5000 时插件正确终止并提示。

**不硬绑**:

- ❌ 不要求跑 `pp-doctor` 后 grade=A/B/C
- ❌ 不要求跑 `pp-d2c` 后生成物 pass check-rules
- ❌ 不要求覆盖 100% frame 打标(设计师可选择保留部分不打标)

## 未决问题(v1 明确不做,留待后续)

1. **单元测试**:v1 不做。后续按 `test/rules/` 风格补,重点是 `plugin/src/rules/prefix/` 和 `plugin/src/rules/autolayout/` 的判定逻辑,用真实 Figma node 结构 mock。
2. **配置外置**:v1 阈值都硬编码在 `prefix-catalog.ts`,后续可考虑读 `pp-d2c.config.json` 中的对应段做定制。
3. **Component / Instance 主件同步**:v1 不做,面板只跳过 Instance,主件正常打标。
4. **网格布局识别**:v1 不做,主副轴都散布时保留 ABSOLUTE。
5. **`bl-` 自动推断**:v1 不做,面板只提供手动加前缀入口。
6. **规则单测覆盖**:v1 不做,依赖手动跑参考稿验证。
7. **参考稿基线量化**:技术方案落地阶段(实现时),用 Figma REST API 或 MCP 工具读澄清 §7 的 3 个参考稿,提取前缀分布 / autolayout 覆盖率作为判定阈值调参依据——这一步在实现时做,方案不给具体数值。
8. **国际化**:v1 UI 全中文,不做 i18n。
9. **面板尺寸自适应**:v1 固定 900×640,后续可支持拖拽。
10. **插件版本号管理**:与主包 `@double-coding/pixel-print` 版本独立,插件 `manifest.json` 自己维护版本号从 `v0.1.0` 起步。

## 涉及的知识库主题

- [pp-d2c](../topics/pp-d2c.md):H5 D2C 主流程、前缀协议、check-rules 硬防线
- [pp-doctor](../topics/pp-doctor.md):设计稿健康检测规则、阈值、卡顿排查
- [pp-d2c-rn](../topics/pp-d2c-rn.md):RN D2C(前缀协议与 H5 版一致,插件产物同样适用)
- `docs/PixelPrint-设计师图层规范.md`:设计师视角的前缀速查(用户面向文档,与本插件形成"文档 + 工具"闭环)
