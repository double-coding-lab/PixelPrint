# pp-d2c-prep-plugin 需求澄清

> Figma 插件:把普通设计稿改造为符合 D2C(pp-d2c)要求的稿子——**打前缀标 + Autolayout 化**。

## 一、背景与目标

### 背景

- pp-d2c(H5)与 pp-d2c-rn 强依赖设计稿满足两类约定:
  1. **图层前缀协议**:`sub-` / `bg-` / `bgc-` / `img-` / `btn-` / `list-` / `input-` / `fixed-` / `end-` / `x-` / `bl-` / `scrollx-` / `scrolly-` 等,前缀即协议(见 `.Knowledge/topics/pp-d2c.md` §前缀协议)。
  2. **Auto Layout 布局**:pp-d2c 通过 `layoutMode` / `padding` / `gap` / `layoutPositioning` 读几何,若整稿用绝对定位,生成物退化为堆叠 `absolute`,可读性与响应性都差。
- 现状:普通设计稿(非专门为 D2C 而画)几乎不满足这两条,设计师手工改造成本高、易漏、易错。
- 已有 `pp-doctor` 做健康检测(node 数上限、命名规范、结构约束),但它只**报告问题**,不修复。

### 目标

做一个 **Figma 插件**,在设计稿被交给 pp-d2c 出码之前,**半自动**完成两类改造:

1. **前缀打标**:识别图层几何/结构特征,给每个 frame **推荐前缀 + 置信度**,通过面板批量确认后原地改名。
2. **Autolayout 化**:识别子层几何呈规整水平/垂直排列的容器,反推 `layoutMode` / `padding` / `gap` / `align-items`,原地设置 Auto Layout。

工具**不做「让 AI 猜业务语义」的事**——凡是"这是不是订单卡片"这类语义判断,一律以前缀候选 + 面板确认的形式交给设计师决策。

## 二、范围

### 包含

- **形态**:Figma 插件(第一版);后续按需再做 CLI/服务(读 REST API 出报告)——**本次不做 CLI**。
- **触发范围**:面板顶部切换两种模式——「选中节点」(仅对当前 Figma 选中的 frame 和其子孙)/「整页」(当前 Page 所有顶层 frame)。
- **打标覆盖前缀**(pp-d2c 全量覆盖):
  - 核心机械类(几乎能自动推,置信度高):`img-` / `btn-` / `x-` / `fixed-` / `end-`
  - 半自动语义类(需人确认,置信度中):`bg-` vs `bgc-` / `sub-` / `list-`
  - 特殊类(需覆盖):`input-` / `bl-` / `scrollx-` / `scrolly-`
- **Autolayout 化**:识别可转 auto layout 的 ABSOLUTE 容器,反推布局参数原地设置。
- **产物**:**原地修改**当前稿子;通过「Dry Run 面板」预览所有改动清单,支持批量勾选/反选后 Apply;依赖 Figma 原生 Cmd+Z 撤销,**不自动 duplicate 备份 Page**(设计师自行判断是否需要在跑插件前手动复制页面)。
- **面板 UX**:一次性表格,每行一个 frame,列出「当前名 / 建议前缀 / 建议 autolayout / 置信度 / 备注」,支持批量勾选 Apply。
- **D2C 前置校验**:面板内置 pp-doctor 中**前缀互斥类**硬规则(NAM014 / NAM019 / NAM020 等,`fixed-` 不能叠 `bg-/bgc-/x-`、`input-` 不能叠 `bg-/bgc-/x-` 与 `img-/btn-`),命中即在面板上**阻止 Apply** 并标红。
- **与 pp-doctor 的衔接**:面板提供「导出健康报告」按钮,导出前缀 + autolayout 结构摘要,让设计师**手动**跑 `pp-doctor` 做终检——插件**不自动调用** doctor(doctor 是 SKILL 由 LLM 驱动,插件里不好直接调)。

### 不包含(明确排除)

- ❌ **CLI / 外部服务形态**:第一版只做插件。
- ❌ **业务语义自动打标**:工具不猜"这个 frame 是订单卡片还是活动横幅",只按几何/结构推前缀候选,业务名靠设计师保留在原图层名里。
- ❌ **已有 auto layout 的容器归一化**:已经设 auto layout 的容器,只**校验** padding/gap/align-items 是否合理并提示,**不强制改**。
- ❌ **页面根容器 `min-height: max(..., 100vh)` 覆写**:这是 pp-d2c 出码时的处理(见 `pp-d2c.md` §9),插件不介入。
- ❌ **`end-` wrapper + `justify-content: space-between` 结构变换**:这是 pp-d2c 出码时的处理(见 `pp-d2c.md` §8),插件只负责给节点打 `end-` 前缀,不改结构。
- ❌ **自动调用 pp-doctor**:面板只导出报告,是否跑 doctor 由设计师决定。
- ❌ **grade 硬约束**:改造完不做 doctor grade 校验,验收标准只要求"有前缀 + autolayout 化"两条完成,不硬绑 grade=A/B。
- ❌ **重命名已有业务名**:原图层若有业务名(如「订单卡片」),前缀**叠加**在前——`sub-订单卡片`,不覆盖。
- ❌ **手写前缀检测与修复**:原图层若已有 `card-` / `blk-` 等旧前缀,面板**标黄**让设计师人工确认,不自动改。

## 三、关键流程

### 3.1 用户流

```
1. 设计师在 Figma 里打开一份普通稿子(或选中某个 frame)。
2. 运行插件:菜单 Plugins → PixelPrint D2C Prep。
3. 面板打开,顶部切换范围「选中节点 / 整页」。
4. 点击「Scan」按钮:
   - 插件遍历目标 frame 树,对每个 frame 输出:
     - 当前名(如「订单卡片」)
     - 建议前缀(如 `sub-`) + 置信度(如 92%)
     - 建议 auto layout(如 VERTICAL + gap:12 + padding:16 16 16 16)
     - 备注(如「命中前缀互斥,建议:去掉 bg- 或去掉 fixed-」)
5. 面板显示一个表格,一行一个 frame,默认所有高置信度候选勾选。
6. 设计师逐行看,反勾不想改的、微调建议(前缀下拉可选、autolayout 参数可编辑)。
7. 点「Apply」:
   - 前缀互斥类硬规则命中的行阻止 apply(标红,不能勾选)。
   - 剩余勾选项批量应用:原地改图层名 + 原地设 auto layout。
   - Apply 完成后面板显示「成功 N 项 / 失败 M 项」。
8. 设计师用 Cmd+Z 可整体撤销;或再次 Scan 迭代。
9. 设计师点「导出健康报告」→ 得到 JSON/Markdown 摘要,供后续手动跑 pp-doctor。
```

### 3.2 前缀推断规则(初版起手,面板显示置信度)

| 前缀 | 判定规则 | 置信度 |
|-----|--------|-------|
| `img-` | frame 只有 1 个子层且子层类型是 `RECTANGLE` + `fills` 含 `IMAGE`,或子层是 `VECTOR` 单一位图 | 高 |
| `btn-` | frame 内含 `TEXT` 且 frame 有 `cornerRadius` > 0 或 `fills` SOLID,子孙节点数 ≤ 5,且被 `reactions` / `onClick` 或图层名含 "btn"/"button" 命中 | 中 |
| `x-` | 图层名以 `x-` 开头或 `visible: false` 或图层名含 "注释"/"辅助"/"guide"/"annotation" | 高 |
| `fixed-` | `constraints.vertical` = `TOP` / `BOTTOM` 且 `constraints.horizontal` = `LEFT_RIGHT` 或图层位于顶部/底部 8% 范围 | 中 |
| `end-` | 父 `layoutMode` = `VERTICAL` / `HORIZONTAL`,且该节点是父的最后一个可见子,且与前一个兄弟主轴间距 > 兄弟间平均间距 × 2 | 中 |
| `bg-` vs `bgc-` | frame 的 `fills` 若含 `IMAGE` / 复杂 `GRADIENT_RADIAL` / 多层 fills / `effects` 复杂 → `bg-`(切图);若纯 `SOLID` / 简单 `GRADIENT_LINEAR` + 简单 stroke + cornerRadius → `bgc-`(CSS) | **低-中(半自动,面板要人确认)** |
| `sub-` | frame 是页面顶层 frame 的直接子 frame,且子孙节点数 > 8,且几何上是独立版块(与兄弟主轴间距 > 24px) | 中 |
| `list-` | frame 内有 ≥ 2 个同构子(用 `type + 深度3子结构签名` 判定,同 pp-d2c 的 `structureSig()`) | 中 |
| `input-` | 图层名含 "输入"/"搜索"/"input"/"search",或子层含单个 TEXT 且 TEXT 内容以「请输入」/「Search」开头 + 父 frame 有 stroke | 中 |
| `bl-` | frame 内有 ≥ 2 个 `TEXT` 子,且 `TEXT` 子沿主轴 baseline 对齐(需读 `style.fontMetrics` 或 y 坐标 + fontSize 反推) | **低(先不做自动推,面板只提供手动加前缀入口)** |
| `scrollx-` / `scrolly-` | frame 的 `overflowDirection` = `HORIZONTAL` / `VERTICAL`,或子层沿主轴超出父 bbox | 中 |

**兜底命名**(原图层无名字或名字很随意 `Frame 1234`):
- 采用**语义化英文** + 序号:`sub-card-01` / `img-banner-01` / `btn-submit-01`。
- 命名生成策略:
  - 类型词从建议前缀反推:`sub-` → 若父是根 frame 则用 `section`,否则用 `card` / `group` 兜底;`img-` → `image`;`btn-` → `button`;`bg-` → `background`;等。
  - 序号在同一父下同类型内递增,从 `01` 开始。
- **风险**:自动语义化命名可能"看起来对但不准",面板会在这类节点上标注「兜底命名,建议人工核对」。

**已有名字带旧前缀**(如 `card-订单` / `blk-header`):
- 面板**标黄**该行,备注列显示「检测到旧前缀 `card-` / `blk-`,请人工确认是否覆盖为 `sub-`」。
- **不自动改**,设计师在面板上下拉选新前缀或跳过。

### 3.3 Autolayout 判定规则(初版起手)

**扫描目标**:所有 `layoutMode: NONE`(即当前是绝对定位)的 frame。

**判定为可转 auto layout**:

- 子层数 ≥ 2
- **主轴方向判定**:
  - 计算所有子的 bbox 中心点,做 x/y 方差比较:x 方差大 → 主轴 = HORIZONTAL;y 方差大 → 主轴 = VERTICAL。
  - 若 x/y 方差都大(散布状),**不判为 auto layout**,保留 ABSOLUTE。
- **主轴不重叠**:相邻子在主轴上 bbox 不重叠(允许 ≤ 2px 容差)。
- **副轴对齐**:所有子 bbox 中心点在副轴的方差 < 主轴平均间距 × 20%(接近对齐一条线)。
- **间距均匀**:相邻主轴间距的标准差 / 平均值 < 0.3(允许小抖动)。

**判定为不可转**(保留 ABSOLUTE):
- 只有 1 个子(仅推荐加 padding,不加 auto layout)
- 子有相互重叠 / 堆叠 / 锚点定位(如水印、徽章、蒙层等)
- 主副轴散布(网格排列可能——本次先不支持网格,保留 ABSOLUTE)

**反推参数**:

| 参数 | 反推方式 |
|-----|--------|
| `layoutMode` | `VERTICAL` / `HORIZONTAL`,按上述主轴判定 |
| `padding`(T/R/B/L) | 父 bbox 边缘 − 首/末子 bbox 边缘,四方向分别算;负数或 > 200px 时不写(判为异常,面板备注) |
| `itemSpacing`(gap) | 相邻子主轴间距的**中位数**(避免均值被极端值拉偏) |
| `counterAxisAlignItems` | 所有子副轴中心点均值落在:0-33% → `MIN`;33-67% → `CENTER`;67-100% → `MAX` |
| `primaryAxisAlignItems` | 默认 `MIN`;**若主轴间距 > 20px 且首末子紧贴父边缘(padding 首末 ≤ 4px)** → `SPACE_BETWEEN` |

**已有 auto layout 的容器**:
- **只校验**,不改。
- 校验项:
  - padding 四方向数值是否与实际子层几何一致(容差 ±2px)
  - itemSpacing 是否与实际间距一致(容差 ±2px)
  - counterAxisAlignItems 是否与副轴对齐一致
- 校验不一致时,面板备注列显示「已有 auto layout,建议核对:padding.top 声明 16,实际 24」,**不阻止 Apply 其他行**。

### 3.4 面板 UX 细节

- **顶部**:范围切换 tab(选中节点 / 整页)+ 「Scan」按钮 + 「Apply」按钮 + 「导出健康报告」按钮
- **中间**:表格,列:
  - `[勾选框]` (默认高置信度勾选、低置信度不勾选、硬规则命中不可勾选)
  - `节点路径` (如 `Page1 > Frame123 > Group > Rect5`,可点击跳到 Figma 里选中)
  - `当前名` (只读)
  - `建议前缀` (下拉,可改;含「保持不变」选项)
  - `建议 autolayout` (只读摘要 `VERTICAL / gap:12 / padding:16,16,16,16`;点开可编辑)
  - `置信度` (高 / 中 / 低,用绿黄灰色标)
  - `备注` (硬规则命中标红、旧前缀标黄、兜底命名标蓝)
- **底部**:统计条 `候选 42 项 / 已勾选 38 项 / 硬规则阻塞 2 项`

## 四、边界与异常

### 边界

- **多前缀组合**:pp-d2c 允许 `fixed-sub-` / `end-btn-` 等修饰前缀叠加(见 `pp-d2c.md` §边界与禁止)。工具生成前缀时按 pp-d2c 的组合规则输出——例如推断为 `sub-` + 命中 `fixed-` 特征 → 生成 `fixed-sub-` 而非 `sub-fixed-`(顺序按 pp-d2c 约定)。
- **裸词前缀**:pp-d2c 允许 `bg` / `bgc` / `btn` / `img` / `input` 裸词命名(白名单,见 `pp-d2c.md` §设计原理)。工具生成时**统一带 `-` 后缀**(`bg-` / `bgc-` 等),不生成裸词。
- **修饰前缀单独存在**:`fixed-` / `end-` / `bl-` / `list-` 只作为修饰前缀,不能单独存在。工具若只判定出 `fixed-` 特征、无法判定基础前缀(`sub-` / `btn-` / `img-` 等),面板备注「需先确认基础前缀」,不生成孤立 `fixed-`。
- **前缀互斥硬规则**(内置,阻止 Apply):
  - `fixed-` + `bg-` / `bgc-` / `x-` → 阻止(NAM014)
  - `input-` + `bg-` / `bgc-` / `x-` → 阻止(NAM019)
  - `input-` + `img-` / `btn-` → 阻止(NAM020)
  - `end-` + `bg-` / `bgc-` / `x-` → 阻止(NAM016)
  - `scrollx-` + `scrolly-` → 阻止(pp-d2c §边界与禁止)
  - `scrollx-` / `scrolly-` + `img-` / `bg-` / `bgc-` / `x-` / `btn-` → 阻止(pp-d2c §边界与禁止)

### 异常

- **面板 Scan 超时**:整页 frame 数 > 1000 时给用户明确提示 + 允许中断;硬上限沿用 pp-doctor 的 5000 节点终止逻辑(超过直接拒绝 Scan)。
- **Apply 失败**:某一行原地改名或设 auto layout 时 Figma API 报错(如权限问题、frame 被锁),面板显示该行「Apply 失败:<原因>」,其他行照常 apply,不整体回滚。
- **原图层是 Component / Instance**:改 Instance 的图层名会解绑,面板默认**不勾选** Instance 类型的行,备注「Instance 修改会解绑,请先确认」;Component 主件可以改。
- **原图层是锁定 / 隐藏**:锁定的 frame 面板显示「已锁定,请先解锁」并阻止 Apply;隐藏的 frame 默认按 `x-` 前缀推断。
- **重名检测**:同一父下 apply 后若产生重名(如两个 `sub-card-01`),序号自动递增避免冲突;面板 apply 前预检并调整。

## 五、关键概念定义

| 概念 | 定义 |
|-----|-----|
| **改造** | 对 Figma 图层做两类原地修改:改 `name`(加前缀)、设 `layoutMode` / `padding` / `itemSpacing` / `counterAxisAlignItems`。**不**改子层顺序、不新增/删除层级、不改 fills/strokes/effects/cornerRadius 等视觉属性。 |
| **打标** | 给图层名加 pp-d2c 前缀,格式 `<前缀>-<原名或兜底名>`。 |
| **Autolayout 化** | 把 `layoutMode: NONE` 的 frame 改为 `VERTICAL` / `HORIZONTAL`,并反推 padding/gap/对齐参数。 |
| **Dry Run** | Scan 阶段只在内存里生成改动清单并展示到面板,不真正调 `figma.setName()` / `parent.layoutMode = ...` 等 setter。 |
| **Apply** | 用户在面板勾选后点击 Apply 按钮,按清单调 Figma API 真正落地修改;每一行独立 apply,不做整体事务(Figma 插件 API 无事务能力,但每次改动 Figma 原生 Cmd+Z 可整体撤销)。 |
| **兜底命名** | 原图层无名字或名字是 Figma 默认(`Frame 1234` / `Rectangle 5` 这类)时,工具生成的语义化英文名(如 `card-01`)。 |
| **硬规则** | 前缀互斥类不可 apply 的规则,内置在插件,阻止勾选。软规则(建议改但不阻止)在备注列提示。 |
| **置信度** | 高 / 中 / 低三档,决定默认是否勾选(高勾、中勾、低不勾)。 |

## 六、验收标准

改造后的稿子应满足(逐条打钩):

- [ ] **前缀覆盖**:所有会渲染的 frame(非 x-,非纯装饰)都带 pp-d2c 前缀。
- [ ] **前缀互斥无冲突**:面板 Scan 一遍无硬规则命中(无红标)。
- [ ] **Autolayout 覆盖**:所有满足判定规则(见 §3.3)的 ABSOLUTE frame 已转为 auto layout;不满足的保留 ABSOLUTE(不强改)。
- [ ] **Padding / Gap 数值合理**:所有已设 auto layout 的 frame,padding/gap 反推值与几何一致(容差 ±2px),无负数、无 > 200px 的异常值。
- [ ] **不引入结构变化**:插件跑完前后,Figma 图层树结构(层级、子层顺序)不变。
- [ ] **健康报告可导出**:面板「导出健康报告」按钮可用,导出内容包含改造前后的前缀分布、autolayout 分布、硬规则命中数。

**不做硬约束**:
- ❌ 不要求跑 `pp-doctor` 后 grade=A/B/C
- ❌ 不要求跑 `pp-d2c` 后生成物 pass check-rules
- 以上两条是设计师后续跑 D2C 时的自然结果,插件只保证"有前缀 + autolayout 化"两条完成即可。

## 七、参考稿(设计师提供的"符合条件的稿子")

以下 3 个 Figma 节点是设计师给的**符合 D2C 的参考稿**,后续技术方案阶段需要按现有 MCP 工具(`get_metadata`)读取它们的结构,提取:
- 前缀分布(每种前缀占比、常见组合)
- Autolayout 覆盖率(设 auto layout 的容器占比 / padding / gap 分布)
- 常见图层深度、节点数分布

作为"符合条件的稿子长什么样"的量化基线,供插件推断规则调参。

- https://www.figma.com/design/66OkJORycyolPjRwU9XZl9/兰涛D2C演示测试?node-id=92-1317
- https://www.figma.com/design/66OkJORycyolPjRwU9XZl9/兰涛D2C演示测试?node-id=92-823
- https://www.figma.com/design/66OkJORycyolPjRwU9XZl9/兰涛D2C演示测试?node-id=91-818

## 八、未决问题(留待技术方案阶段/后续迭代解决)

以下项**不影响澄清落盘**,但技术方案生成时可能需要进一步细化或推迟到 v2:

1. **`bl-`(baseline 对齐)自动推断**:baseline 对齐是文本渲染层的语义,几何上很难可靠推断(需读 `style.fontMetrics`)。**v1 不做自动推断**,面板只提供手动加 `bl-` 前缀的入口。
2. **Component / Instance 处理策略**:当前方案是默认不勾选 Instance。设计师若大量使用 Component 库,可能需要工具支持"改主件同步所有 Instance"能力——**v1 不做,提示用户先手动处理主件**。
3. **网格布局**:pp-d2c 目前不支持网格,插件也不识别网格。若设计师用了 3×N 网格排列,插件保留 ABSOLUTE,可能与设计师期望不符——**v1 接受此限制**。
4. **`sub-` 拆点粒度**:pp-d2c 里 sub- 是"独立版块"(用于 sub-agent 分发),粒度过细会派发太多 agent、过粗会导致单 agent 处理不过来。当前判定用"子孙节点数 > 8"作阈值,可能不够准,**技术方案阶段验证参考稿后调参**。
5. **健康报告格式**:JSON vs Markdown、字段设计——**技术方案阶段确定**。
6. **插件与 pp-d2c-fast 的关系**:pp-d2c 与 pp-d2c-fast 是两种执行路径(见 pp-d2c topic v1.2.4 `micro-sub 快路径`),插件产出的稿子理论上对两条路径都适用——**v1 不做区分**。

## 九、涉及的知识库主题

- [pp-d2c](../topics/pp-d2c.md):H5 D2C 主流程,前缀协议、check-rules 硬防线
- [pp-doctor](../topics/pp-doctor.md):设计稿健康检测规则、阈值、卡顿排查
- [pp-d2c-rn](../topics/pp-d2c-rn.md):RN D2C(前缀协议与 H5 版一致)
