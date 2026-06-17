# ctrip-train-d2c-doctor Skill

> D2C 设计稿健康检测：在生成代码前对 Figma 设计稿做体检，提前暴露命名、布局、结构、资产层面的问题。
>
> 完整规则定义见 `docs/d2c-health-check-spec.md`。本文件为可执行步骤。

## 触发条件

- 用户提供 Figma 设计稿 URL 并说：「体检一下」「健康检测」「检查设计稿」「跑个 d2c 体检」「看看这个稿能不能还原」
- 直接 `$ctrip-train-d2c-doctor`
- 被 `ctrip-train-d2c` 主 SKILL 在步骤 0 之后以集成模式调用

---

## 执行流程

### 步骤 -1（前置预检）：检测 Figma MCP 可用性

在任何操作前执行，不可跳过。

| 结果 | 处理 |
|------|------|
| Figma MCP 调用成功 | 继续步骤 0 |
| 工具不存在 / 调用失败 | 输出失败提示并终止 |

**失败时输出**：
```
Figma MCP 未就绪，请先在 Claude Code 中安装 Figma 官方插件并完成认证后再重试。
```

---

### 步骤 0：读取配置

```
Read("ctrip-train-d2c.config.json")
```

读取并缓存以下字段（缺省时使用括号内默认值）：

| 字段 | 默认值 | 用途 |
|------|--------|------|
| `layers.sub` | `sub-` | 分块前缀 |
| `layers.block` | `block-` | 独立块前缀 |
| `layers.img` | `img-` | 图片前缀 |
| `layers.bg` | `bg-` | 背景图前缀 |
| `layers.bgColor` | `bgc-` | 背景色前缀 |
| `layers.font` | `font-` | 文字前缀 |
| `layers.but` | `btn-` | 按钮前缀 |
| `layers.ignore` | `x-` | 忽略前缀 |
| `health.enabled` | `true` | 总开关，false 时直接退出 |
| `health.blockOnError` | `true` | 集成模式下 error 是否阻塞生成 |
| `health.report.markdown` | `true` | 是否输出 .d2c-health.md |
| `health.report.json` | `true` | 是否输出 .d2c-health.json |
| `health.report.dir` | `output.dir` | 报告输出目录 |
| `health.thresholds.maxDepth` | `6` | STR001 嵌套深度上限 |
| `health.thresholds.subBlockMin` | `3` | NAM009 sub- 内最少子层 |
| `health.thresholds.subBlockMax` | `20` | FEA004 sub- 块最多数量 |
| `health.thresholds.totalNodesMax` | `1500` | FEA003 节点总数上限 |
| `health.thresholds.hiddenRatioMax` | `0.2` | NAM010 隐藏图层占比上限 |
| `health.thresholds.paddingAsymmetryMax` | `32` | LAY003 padding 不对称阈值 |
| `health.thresholds.bgSizeMin` | `0.8` | AST002 bg- 尺寸下限比例 |
| `health.thresholds.bgSizeMax` | `1.2` | AST003 bg- 尺寸上限比例 |
| `health.rules` | `{}` | 规则等级覆盖表 |

**`health.enabled === false` 时**：直接输出 `设计稿健康检测已禁用 (health.enabled=false)`，终止流程。

---

### 步骤 1：解析参数

#### 独立模式（用户直接调用）

从用户输入的 Figma URL 提取：
- `fileKey`：URL 中 `/design/` 后的路径段
- `nodeId`：`node-id=` 参数值，将 `-` 替换为 `:`

设置 `mode = 'standalone'`。

#### 集成模式（被主 SKILL 调用）

调用方传入 `{ fileKey, nodeId, config, mode: 'integrated' }`。

---

### 步骤 2：扫描图层结构

调用 `get_metadata(fileKey, nodeId)` 获取目标节点的完整子孙图层树。

**遍历整棵树，给每个节点打上以下属性，存入扫描上下文 `ctx`**：

| 属性 | 来源 |
|------|------|
| `id` | 节点 id |
| `name` | 节点 name |
| `type` | 节点 type（FRAME/GROUP/TEXT/VECTOR/COMPONENT/INSTANCE/...） |
| `visible` | 节点 visible（默认 true） |
| `parentId` | 父节点 id |
| `path` | 从根节点到当前节点的 name 链 |
| `depth` | 路径深度（根=0） |
| `bbox` | `{ x, y, width, height }` |
| `prefixes` | 从 `name` 中识别出的所有已知前缀（多前缀组合，按 SKILL 主流程规则） |
| `nameClean` | 去掉所有已知前缀后的剩余名 |
| `autoLayout` | `{ mode, padding, itemSpacing }`，无 AL 时为 null |
| `rotation` | 旋转角度 |
| `childCount` | 子节点数 |

**前缀识别**：从 `name` 左到右扫描，提取所有匹配 `layers.*` 配置值的前缀；前缀之间允许有 `-` 连接。如：
- `sub-img-qa` → `[sub, img]`，nameClean = `qa`
- `sub-btn-img-banner` → `[sub, btn, img]`，nameClean = `banner`

**性能上限**：
- 子树节点数 > 1500 → 命中 FEA003，但仍继续扫描（仅警告）
- 子树节点数 > 5000 → 终止扫描，输出 `图层数过多 (>5000)，建议拆分设计稿后再体检` 并退出

---

### 步骤 3：执行规则检查

按以下顺序逐条扫描，命中即向 `issues[]` 追加一条。每条 issue 结构：

```
{
  id: 'NAM001',
  level: 'error' | 'warn' | 'info',
  nodeId, nodeName, nodePath,
  message: '...',
  fix: '...',
  figmaUrl: 'https://figma.com/design/{fileKey}/?node-id={nodeId 替换 : 为 -}'
}
```

**等级取值优先级**：`config.health.rules[ruleId]` > 本文档默认值。`'off'` 时跳过该规则。

#### 3.1 NAM001 容器无前缀（默认 warn）

- 节点 `type` ∈ {FRAME, GROUP, COMPONENT, INSTANCE}
- 子节点（仅可见）数 ≥ 2
- `prefixes` 不含任何已知前缀
- 且当前节点的祖先链上**没有**任何 `sub-` 前缀节点（避免 sub- 内部容器误报）

→ message: `容器无 sub- / block- 前缀，AI 无法识别为独立模块`
→ fix: `加 sub- 或 block- 前缀`

#### 3.2 NAM002 前缀拼写错误（默认 error）

逐节点扫描 `name`，匹配以下任一变体（大小写不敏感、含下划线/全角短横/多余空格）：

```
^(?:bg|img|font|btn|sub|block|bgc|x)[ _—–]
^(?:Bg|BG|Img|IMG|Font|FONT|Btn|BTN|Sub|SUB|Block|BLOCK|Bgc|BGC|X)-
```

且该 name 不已经命中标准前缀。→ message: `前缀拼写不规范：{matched}`
→ fix: `改为标准小写连字符前缀（bg-/img-/font-/btn-/sub-/block-/bgc-/x-）`

#### 3.3 NAM003 前缀语义冲突（默认 error）

`prefixes` 命中以下任一组合：
- 同时含 `img` 和 `bg`
- 同时含 `img` 和 `font`
- 含 `x` 且还含其他任一前缀

→ message: `前缀语义冲突：{冲突的前缀对}`
→ fix: `参考组合优先级，二选一`

#### 3.4 NAM004 bg- 唯一性违反（默认 error）

按父节点分组，统计每个父节点下含 `bg` 前缀的可见子节点数。> 1 时，对**第二个及以后**的 bg- 节点逐一报错。

→ message: `同父级下出现多个 bg- 子层，按规则将忽略本节点`
→ fix: `仅保留一个 bg-，其他改为 img- 或合并`

#### 3.5 NAM005 同级重名（默认 warn）

按父节点分组，统计每个父节点下子节点的 `nameClean.toLowerCase()`。同名出现 ≥ 2 次时，对**第二个及以后**报警告。

→ message: `同级重名：{nameClean}，资产文件名将冲突`
→ fix: `加业务后缀区分（如 hero-top / hero-bottom）`

#### 3.6 NAM008 sub- 嵌套 sub-（默认 error）

`prefixes` 含 `sub` 且祖先链上已有 `sub-` 节点。

→ message: `sub- 嵌套 sub-，分块逻辑会异常`
→ fix: `仅保留外层或仅保留内层 sub-`

#### 3.7 LAY001 容器缺 Auto Layout（默认 warn）

- 节点 `type === 'FRAME'`
- `autoLayout` 为 null
- 可见子节点数 ≥ 2
- 且子节点 bbox 不在严格的同行/同列（行：所有 y 重叠区 > 50%；列：所有 x 重叠区 > 50%）

→ message: `容器未启用 Auto Layout，子层位置需靠坐标推断方向`
→ fix: `在 Figma 中对该 Frame 启用 Auto Layout`

#### 3.8 LAY002 AL padding 含负值（默认 error）

- `autoLayout` 非 null
- `autoLayout.padding` 任一方向值 < 0

→ message: `Auto Layout padding 含负值: {方向}={值}`
→ fix: `padding 改为 ≥ 0`

#### 3.9 LAY009 绝对定位嫌疑（默认 warn）

- 节点 `type === 'FRAME'` 或 `'GROUP'`
- 可见子节点数 ≥ 2
- 子节点之间存在 bbox 重叠（重叠面积 > 任一参与方面积的 10%）
- 且当前节点不在 `sub-img-` / 单 `img-` 的子树内

→ message: `子元素 bbox 重叠，可能用了绝对定位思路`
→ fix: `改用 Auto Layout 的 absoluteBoundingBox 或拆分为独立 sub-`

#### 3.9b LAY010 顶层 frame 背景缺失（默认 info）

- 节点 = 检查目标根节点（用户传入的 nodeId）
- `fills` 为空 / 全透明 / `backgroundColor` 缺失

→ message: `顶层 frame 没有任何背景色或背景图，整屏页面背景将由项目全局样式（base.scss 等）兜底`
→ fix: `若设计意图就是用项目兜底色，可忽略；否则在 Figma 中给顶层 frame 加 fill`

> **配套提醒**（不在规则清单里，是主流程行为）：当顶层 frame **有**背景色/图时，主 SKILL 会按"步骤 2.5 页面级背景采集"将其写入 body，doctor 不重复报告。

#### 3.10 STR001 嵌套深度过深（默认 warn）

`depth > config.health.thresholds.maxDepth`（默认 6）。每条命中路径仅在**最深叶子节点**报一次。

→ message: `节点嵌套深度 {depth} 超过阈值 {maxDepth}`
→ fix: `拍平不必要的 wrapper`

#### 3.11 STR002 单子嵌套（默认 info）

- 节点 `type === 'FRAME'`
- 可见子节点数 = 1
- 唯一子节点 `type === 'FRAME'`
- 当前节点无 fills / strokes / cornerRadius / effects（外观属性）

→ message: `仅含一个子 Frame 且自身无样式，等于多套了一层壳`
→ fix: `删除外层 Frame 或将子内容上提`

#### 3.12 AST002 bg- 尺寸 ≠ 父尺寸（默认 warn）

- 节点 `prefixes` 含 `bg`
- 父节点存在
- `width / parent.width < bgSizeMin` 或 `height / parent.height < bgSizeMin`（默认 0.8）

→ message: `bg- 节点 {w}x{h} 小于父容器 {pw}x{ph} 的 80%，背景可能露白`
→ fix: `将 bg- 节点尺寸调整为撑满父容器`

#### 3.13 AST004 应导出但内容为空（默认 error）

- 节点 `prefixes` 含 `img` 或 `bg`
- 子树内无任何可见的栅格/矢量/文本/形状内容（即所有后代均为空 FRAME 或不可见）

→ message: `{img/bg}- 节点子树为空，导出图片将是空白`
→ fix: `删除该节点或补充内容`

#### 3.14 FEA002 全是隐藏图层（默认 error）

目标根节点子树内可见图层数 = 0。

→ message: `目标节点子树没有任何可见图层`
→ fix: `检查目标 nodeId 是否正确，或恢复必要图层的可见性`

> 命中 FEA002 时直接终止后续规则扫描，跳到步骤 4。

#### 3.15 FEA003 单稿图层数过多（默认 warn）

子树节点总数 > `config.health.thresholds.totalNodesMax`（默认 1500）。

→ message: `图层数 {n} 超过阈值 {max}，生成耗时和出错率会升高`
→ fix: `用 sub- 拆分为多个独立块，或精简设计稿层级`

---

### 步骤 4：计算覆盖率与评分

#### 4.1 覆盖率（独立展示）

```
namedPrefixCoverage = 含任一前缀的可见非 TEXT 节点 / (可见节点数 - 可见 TEXT 节点数)
autoLayoutCoverage  = autoLayout 非 null 的 FRAME / (子层 ≥ 2 的 FRAME 数)
depthAvg / depthMax = 路径深度均值 / 最大值（仅可见节点）
hiddenRatio         = visible:false 节点数 / 总节点数
```

> Token 引用率（STY 系列）首期不实现，置为 `null`。

#### 4.2 维度得分

每个维度初始 100 分，按命中规则的等级扣分：
- error: -10
- warn:  -3
- info:  -1

下限为 0。规则归属维度：

| 维度 | 包含规则 ID 前缀 | 权重 |
|---|---|---|
| NAM | NAM* | 30% |
| LAY | LAY* | 25% |
| STR | STR* | 15% |
| STY | STY* | 10% |（首期空，得 100） |
| AST | AST* | 10% |
| FEA | FEA* | 10% |（任一 error → 0 分） |

#### 4.3 总分与等级

```
total = sum(dimensionScore[d] * weight[d])
```

| 总分 | 等级 |
|---|---|
| ≥ 90 | A |
| 75-89 | B |
| 60-74 | C |
| < 60 | D |
| FEA 一票否决（任一 FEA error） | F |

#### 4.4 阻塞判定

```
passed = (grade !== 'F') && !(any error issue && config.health.blockOnError === false ? false : grade !== 'F')

# 简化：
passed = (grade !== 'F')
```

集成模式下，调用方根据 `health.blockOnError` 决定是否在 grade=F 时终止。

---

### 步骤 5：输出报告

#### 5.1 独立模式（standalone）

写入两个文件（依据 `health.report.markdown` / `health.report.json`）：

- `{health.report.dir}/.d2c-health.md`
- `{health.report.dir}/.d2c-health.json`

`health.report.dir` 默认 = `output.dir`。

**Markdown 模板**：

```markdown
# D2C 设计稿健康度报告

- 设计稿：{fileKey} / {nodeId}（{rootName}）
- 检测时间：{ISO 时间}
- 总分：**{total} / 100** （{grade} 级 · {gradeDesc}）

## 维度得分

| 维度 | 得分 | 权重 | error | warn | info |
|---|---|---|---|---|---|
| 命名规范 | {NAM.score} | 30% | {n} | {n} | {n} |
| 布局合理性 | {LAY.score} | 25% | ... |
| 结构合理性 | {STR.score} | 15% | ... |
| 样式一致性 | {STY.score} | 10% | （首期未实现）|
| 资产可导性 | {AST.score} | 10% | ... |
| 生成可行性 | {FEA.score} | 10% | ... |

## 覆盖率

- 命名前缀覆盖率：{namedPrefixCoverage * 100}%
- Auto Layout 覆盖率：{autoLayoutCoverage * 100}%
- 嵌套深度：平均 {depthAvg} / 最大 {depthMax}
- 隐藏图层占比：{hiddenRatio * 100}%

## 问题清单

### 🔴 错误（必须修复，{errorCount} 项）

1. **[{id}] {ruleName}** — `{nodeName}` ({nodeId})
   {message}
   修复：{fix}
   [在 Figma 中打开]({figmaUrl})

...

### 🟡 警告（建议修复，{warnCount} 项）

...

### 🔵 信息（可选优化，{infoCount} 项）

...

## 修复建议（聚合 Top 3）

1. ...
2. ...
3. ...
```

**JSON 输出**：见 `docs/d2c-health-check-spec.md` §6.2 schema。

#### 5.2 集成模式（integrated）

不写文件，直接 return：

```
{
  passed: boolean,
  score: { total, grade, dimensions, coverage },
  issues: [...],
  summary: { error, warn, info }
}
```

#### 5.3 对话内摘要（两种模式都打印）

```
🩺 D2C 设计稿体检完成

  总分：{total} / 100  ({grade} 级)
  问题：🔴 {error} · 🟡 {warn} · 🔵 {info}

  Top 3 问题：
   1. [{id}] {message}（{nodeName}）
   2. ...
   3. ...

  详细报告：{health.report.dir}/.d2c-health.md
```

---

## 步骤 6：返回值（仅集成模式）

向主 SKILL return 步骤 5.2 的结构。主 SKILL 自行处理阻塞逻辑。

---

## 禁止项

- 禁止调用 Figma REST API 导出图片（doctor 是只读分析，不下载资产）
- 禁止修改设计稿（只读）
- 禁止跳过步骤 -1 的 MCP 预检
- 禁止扫描超过 5000 节点的子树（性能保护）
- 禁止把 issue 的 nodeId 写成 `-` 形式（统一用 `:`，仅 figmaUrl 字段做转换）
- 禁止在 `health.enabled === false` 时仍然执行检查
- 禁止在集成模式下写文件（避免污染 output 目录）

---

## 与主 SKILL 的协议

集成调用约定：

| 字段 | 类型 | 说明 |
|------|------|------|
| 输入 `fileKey` | string | 必填 |
| 输入 `nodeId` | string | 必填，`:` 形式 |
| 输入 `config` | object | 完整 ctrip-train-d2c.config.json |
| 输入 `mode` | `'integrated'` | 必填，标识集成模式 |
| 输出 `passed` | boolean | grade !== 'F' |
| 输出 `score` | object | 见步骤 4 |
| 输出 `issues` | array | 见步骤 3 |
| 输出 `summary` | object | `{ error, warn, info }` |

主 SKILL 在拿到结果后：
- `passed === false && config.health.blockOnError === true` → 输出阻塞提示，等用户确认是否强制继续
- `passed === true && error === 0 && warn > 0` → 简短提示警告数，继续生成
- `passed === true && error === 0 && warn === 0` → 静默继续生成
