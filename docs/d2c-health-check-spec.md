# D2C 设计稿健康检测 · Spec（草案 v0.1）

> 目的：在 D2C 生成代码**之前**，对 Figma 设计稿做一次自动体检，提前暴露命名、布局、结构、样式、资产等层面的问题。
>
> 对象：所有送入 `ctrip-train-d2c` 还原流程的设计稿。
>
> 关系：与 `templates/skills/ctrip-train-d2c/SKILL.md` 同源，规则前缀完全沿用 `ctrip-train-d2c.config.json` 的 `layers` 段。

---

## 0. 待确认项（先于 spec 主体）

下面三个问题在动工前需要你拍板，spec 后续章节先给推荐方案：

| # | 决策 | 推荐方案 | 备选 |
|---|---|---|---|
| A | 规则范围 | **完整版**（6 个维度共 ~30 条规则），但每条标 P0/P1/P2，**首期只实现 P0**（命名 + AL + 结构核心 ~12 条） | 仅基础版 / 全量首期上 |
| B | 集成方式 | **独立 SKILL，协议向 D2C 主流程兼容**（独立可跑，主流程也能调用并阻塞致命错误） | 仅独立 / 仅集成 |
| C | 阈值与开关 | **全部走 `ctrip-train-d2c.config.json` 的 `health` 段**，每条规则三态 `off / warn / error`，阈值可调；规则 ID 写死 | 阈值写死 / 单独 health.config.json |
| D | 报告归档 | **同时输出** `.d2c-health.md`（人读）+ `.d2c-health.json`（机器读，供未来仪表盘） | 仅 md / 仅 json |

> 下文按 A=完整版/首期 P0、B=独立可集成、C=config 化、D=md+json 写。如有调整，spec 主体相应章节会改。

---

## 1. 触发与定位

### 1.1 SKILL 名称

`ctrip-train-d2c-doctor`

理由：跟 `ctrip-train-d2c` 同前缀，`doctor` 比 `lint` / `check` 更直观（"体检"），且与 ESLint 风格规则区分（避免误以为是代码 lint）。

### 1.2 触发条件

- 用户提供 Figma 设计稿 URL 并说：
  - 「体检一下」「健康检测」「检查设计稿」「跑个 d2c 体检」「看看这个稿能不能还原」
  - 直接 `$ctrip-train-d2c-doctor`
- 被 `ctrip-train-d2c` 主 SKILL 在步骤 0 之后调用（B 模式集成）

### 1.3 与生成 SKILL 的关系

```
独立调用模式：           集成调用模式：
   用户                     用户
    │                        │
    ▼                        ▼
  doctor                  ctrip-train-d2c
    │                       │
    ▼                       ├─ 步骤 -1 MCP 预检
  报告 md+json              ├─ 步骤 0 读 config
                            ├─ 步骤 0.5 调用 doctor ←──┐
                            │   └─ 致命问题 → 终止     │
                            │   └─ 仅警告 → 继续       │  同一份 SKILL，
                            ├─ 步骤 1 解析 URL          │  通过参数区分
                            └─ ...                     │  调用方
                                                       │
                            doctor.run(fileKey,nodeId,
                              { mode: 'integrated' })──┘
```

集成模式下 doctor 不写报告文件（避免污染 output 目录），改为 return JSON 给主 SKILL；主 SKILL 决定是否阻塞 / 是否提示用户。

---

## 2. 执行流程

```
步骤 -1：Figma MCP 预检（同主 SKILL）
步骤 0 ：读取 config（含 layers 段 + health 段）
步骤 1 ：解析 URL → fileKey, nodeId
步骤 2 ：调用 get_metadata 获取完整子树（含 visible / autoLayout / paddings / itemSpacing 等）
步骤 3 ：按 health.rules 逐条扫描 → 收集 issues[]
步骤 4 ：评分 → 生成 score
步骤 5 ：输出报告
        - 独立模式：写 .d2c-health.md + .d2c-health.json，并在对话里打印摘要
        - 集成模式：return { score, issues } 给调用方
```

### 2.1 关键 MCP 调用

| 调用 | 用途 |
|---|---|
| `get_metadata(fileKey, nodeId)` | 主要数据源。返回完整图层树，含 name / visible / type / 位置尺寸 |
| `get_design_context(fileKey, nodeId)` | 仅当 metadata 不足以判定时按需调用（如读取 fills、styles、variables） |
| `get_variable_defs(fileKey, nodeId)` | 用于"颜色/字号 token 化覆盖率"维度（P2） |

> ⚠️ doctor 不调用 REST API 导出图片，不产生临时下载，纯只读分析。

### 2.2 性能边界

- 单次扫描限 1000 个图层节点，超过则**对每个 sub- 块独立扫描**，最后汇总
- 单次执行预计 < 30 秒（不含 MCP 网络延迟）

---

## 3. 规则清单

> **图例**：
> - 等级（默认）：🔴 error / 🟡 warn / 🔵 info
> - 优先级：P0=首期实现 / P1=二期 / P2=远期
> - 所有规则可在 config 中改等级或关闭

### 3.1 命名规范（NAM）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `NAM001` | 容器无前缀 | 🟡 | P0 | 节点为 FRAME/GROUP/COMPONENT，子层 ≥ 2，名称不含任何已知前缀，且非 `sub-` 内部一级容器 | 加 `sub-` 或 `block-` |
| `NAM002` | 前缀拼写错误 | 🔴 | P0 | 名称含 `bg_` / `Bg-` / `IMG-` / `img -` 等已知前缀的拼写变体 | 改为标准小写连字符 |
| `NAM003` | 前缀语义冲突 | 🔴 | P0 | 同时含 `img-` 和 `bg-`；含 `x-` 又含其他前缀 | 二选一 |
| `NAM004` | bg- 唯一性违反 | 🔴 | P0 | 同一父级下出现 ≥ 2 个 `bg-` 子层 | 仅保留一个 |
| `NAM005` | 同级重名 | 🟡 | P0 | 同父级两个图层去前缀后 kebab-case 相同（如 `img-hero` 与 `bg-hero`） | 加业务后缀区分 |
| `NAM006` | 命名质量差 | 🔵 | P1 | 去前缀后为：纯数字 / `Group \d+` / `Frame \d+` / `编组\d+` / 仅含 node-id | 改为语义化命名（kebab-case，英文优先） |
| `NAM007` | 裸名图层（兜底警告） | 🔵 | P1 | 非 TEXT、无任何前缀、且子层 = 0 | 明确加 `img-` 或 `x-` |
| `NAM008` | sub- 嵌套 sub- | 🔴 | P0 | `sub-` 节点的子树内还有 `sub-` 节点 | 仅保留外层或仅保留内层 |
| `NAM009` | sub- 粒度过细 | 🔵 | P2 | `sub-` 内可见图层 < 3 个 | 合并到父级 |
| `NAM010` | 隐藏图层堆积 | 🔵 | P1 | 整稿 `visible:false` 节点占比 > 20% | 清理废稿 |

### 3.2 Auto Layout / 布局合理性（LAY）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `LAY001` | 容器缺 Auto Layout | 🟡 | P0 | FRAME 子层 ≥ 2，未启用 AL，子层位置不在同一行/列 | 设计师启用 Auto Layout |
| `LAY002` | AL padding 含负值 | 🔴 | P0 | AL 容器任一 padding < 0 | 改为 ≥ 0 |
| `LAY003` | AL padding 严重不对称 | 🔵 | P1 | AL 容器同向 padding 差值 > 32px（如 left=8, right=120） | 检查是否设计意图 |
| `LAY004` | 子元素溢出父容器 | 🟡 | P1 | 子元素 bbox 超出父容器（且父无 `overflow: visible` 设计意图） | 调整尺寸或开启 clip |
| `LAY005` | Hug + Fill 父子矛盾 | 🟡 | P2 | 父 Hug Contents，唯一子 Fill Container | 二选一 |
| `LAY006` | 容器 padding > 内容尺寸 | 🟡 | P1 | padding 和 ≥ 容器对应方向尺寸的 80% | 多半是设计师误操作 |
| `LAY007` | gap 与实际间距不一致 | 🔵 | P2 | AL 容器 itemSpacing ≠ 子元素实测间距（差 > 2px） | 设计师未对齐 AL |
| `LAY008` | 旋转 / 倾斜 | 🔵 | P1 | 节点 rotation ≠ 0 | D2C 不还原旋转，需手动确认 |
| `LAY009` | 绝对定位嫌疑 | 🟡 | P0 | 容器多子且子之间有重叠（且不在 sub- 内） | 检查是否用了 absolute 思路 |
| `LAY010` | 顶层 frame 背景缺失 | 🔵 | P0 | 检查目标根节点 fills 为空/全透明 | Figma 顶层 frame 加 fill；否则确认走项目兜底色 |

### 3.3 图层结构合理性（STR）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `STR001` | 嵌套深度过深 | 🟡 | P0 | 单条路径深度 > 6（默认阈值，可调） | 拍平不必要的 wrapper |
| `STR002` | 单子嵌套（套娃） | 🔵 | P0 | FRAME 仅含 1 个 FRAME 子层，且自身无填充/描边/圆角/effect | 删除外层 |
| `STR003` | 空容器 | 🔵 | P1 | FRAME/GROUP 子层数 = 0，且无填充/背景 | 删除 |
| `STR004` | Group 应改 Frame | 🔵 | P1 | 节点是 GROUP 且子层 ≥ 2 | 改 Frame 才能用 AL |
| `STR005` | 锁定图层 | 🔵 | P2 | `locked: true` | 仅信息提示 |
| `STR006` | Component Instance 跨文件引用 | 🔵 | P2 | 实例 mainComponent 在外部文件 | 可能拿不到完整属性 |
| `STR007` | mask / blend mode | 🟡 | P1 | 节点含 mask 或非 NORMAL blend mode | D2C 不还原，建议拍扁为 img |

### 3.4 样式 / Token 一致性（STY）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `STY001` | 颜色未绑定变量 | 🔵 | P2 | fill 为 SOLID 但未绑定 Variable / Style | 绑定 Token |
| `STY002` | 字号未绑定文字样式 | 🔵 | P2 | TEXT 字号未绑定 Text Style | 绑定 Token |
| `STY003` | 邻近 HEX 色冗余 | 🔵 | P2 | 同稿出现 ΔE < 3 的不同色值 ≥ 2 组 | 统一色值 |
| `STY004` | 邻近字号冗余 | 🔵 | P2 | 出现 27px / 28px / 29px 这种相差 1-2px 的字号 | 归并 |
| `STY005` | 单 TEXT 多样式段 | 🟡 | P1 | 一个 TEXT 节点含多段不同字号/颜色/字重 | 拆成多个 TEXT |

### 3.5 资产可导出性（AST）

| ID | 名称 | 默认 | P | 触发条件 | 修复建议 |
|---|---|---|---|---|---|
| `AST001` | 矢量被命名为 img- | 🔵 | P1 | 节点子树纯矢量（VECTOR/BOOLEAN/ICON），名为 `img-` | 改 `svg-`（如启用）或仅信息提示 |
| `AST002` | bg- 尺寸 ≠ 父尺寸 | 🟡 | P0 | `bg-` 节点宽或高 < 父容器对应尺寸 80% | 调整 bg- 节点为满父尺寸 |
| `AST003` | bg- 尺寸 > 父尺寸 | 🔵 | P1 | `bg-` 节点宽或高 > 父容器对应尺寸 120% | 设计师容易误以为父也变高 |
| `AST004` | 应导出但内容为空 | 🔴 | P0 | `img-` / `bg-` 节点子树无任何可见内容 | 删除或补内容 |

### 3.6 生成可行性（FEA） · P0 闸口

最严的一组规则，命中 error 时**集成模式下直接终止生成**。

| ID | 名称 | 默认 | P | 触发条件 |
|---|---|---|---|---|
| `FEA001` | 没有 sub- 块 | 🟡 | P0 | 整稿无任何 `sub-` 节点（D2C 退化为单 agent） |
| `FEA002` | 全是隐藏图层 | 🔴 | P0 | 目标节点子树可见图层 = 0 |
| `FEA003` | 单稿图层数过多 | 🟡 | P0 | 子树节点数 > 1500（性能预警） |
| `FEA004` | sub- 块过多 | 🟡 | P1 | 单稿 `sub-` 节点 > 20（并发压力大） |

---

## 4. 评分算法

### 4.1 维度得分

每个维度独立评分，0-100，加权汇总：

| 维度 | 权重 | 满分构成 |
|---|---|---|
| 命名规范（NAM） | 30% | 命中 error -10 / warn -3 / info -1，下限 0 |
| 布局合理性（LAY） | 25% | 同上 |
| 结构合理性（STR） | 15% | 同上 |
| 样式一致性（STY） | 10% | 同上 |
| 资产可导性（AST） | 10% | 同上 |
| 生成可行性（FEA） | 10% | 任一 error → 0 分（一票否决） |

### 4.2 等级映射

| 总分 | 等级 | 含义 |
|---|---|---|
| 90-100 | A | 优秀，可直接生成 |
| 75-89  | B | 良好，少量警告 |
| 60-74  | C | 可生成但偏差风险高 |
| < 60   | D | 不建议生成，先修设计稿 |
| 任何 FEA error | F | 阻塞，集成模式下终止 |

### 4.3 覆盖率指标（独立展示，不参与扣分）

- 命名前缀覆盖率：`带前缀图层数 / (总可见图层数 - 文本图层数)`
- Auto Layout 覆盖率：`AL 容器数 / (总容器数 - 子层<2的容器)`
- Token 引用率：`绑定 Variable/Style 的样式属性数 / 全部样式属性数`
- 嵌套深度：平均 / 最大
- 隐藏图层占比：`visible:false 节点 / 总节点`

---

## 5. config schema 扩展

在 `ctrip-train-d2c.config.json` 顶层新增 `health` 段：

```jsonc
{
  // ... 既有字段
  "health": {
    "enabled": true,                     // 总开关
    "blockOnError": true,                // 集成模式下，命中 error 是否阻塞生成
    "report": {
      "markdown": true,                  // 输出 .d2c-health.md
      "json": true,                      // 输出 .d2c-health.json
      "dir": "{output.dir}"              // 报告输出目录，默认与 output.dir 同
    },
    "thresholds": {
      "maxDepth": 6,                     // STR001
      "subBlockMin": 3,                  // NAM009
      "subBlockMax": 20,                 // FEA004
      "totalNodesMax": 1500,             // FEA003
      "hiddenRatioMax": 0.2,             // NAM010
      "paddingAsymmetryMax": 32,         // LAY003
      "bgSizeMin": 0.8,                  // AST002
      "bgSizeMax": 1.2,                  // AST003
      "colorDeltaEMin": 3                // STY003
    },
    "rules": {
      // 任一规则可改等级或关闭
      // "NAM001": "warn",  // 默认值
      // "NAM006": "off",
      // "STY001": "info"
    }
  }
}
```

> 未在 `rules` 中显式声明的规则使用本 spec 第 3 节的默认等级。

---

## 6. 报告输出

### 6.1 Markdown（人读）

文件：`{health.report.dir}/.d2c-health.md`

```markdown
# D2C 设计稿健康度报告

- 设计稿：火车票 618 活动主页 (fileKey/nodeId)
- 检测时间：2026-06-17 14:32
- 总分：**78 / 100**  (B 级 · 良好)

## 维度得分
| 维度 | 得分 | 权重 | 主要扣分 |
|---|---|---|---|
| 命名规范 | 85 | 30% | 1 个 error / 4 个 warn |
| 布局合理性 | 62 | 25% | 5 个 warn (AL 缺失) |
| ...

## 覆盖率
- 命名前缀：85% (43 / 51)
- Auto Layout：62% (8 / 13)
- Token 引用：31%
- 嵌套深度：平均 3.2 / 最大 5
- 隐藏图层占比：4%

## 问题清单

### 🔴 错误（必须修复）
1. **[NAM003] 前缀语义冲突** — 节点 `sub-img-bg-card` (95:19385) 同时含 `img-` 和 `bg-`
   修复：二选一
   跳转：[在 Figma 中打开](https://figma.com/...)

### 🟡 警告（建议修复）
...

### 🔵 信息（可选优化）
...
```

### 6.2 JSON（机器读）

文件：`{health.report.dir}/.d2c-health.json`

```jsonc
{
  "version": "1.0.0",
  "checkedAt": "2026-06-17T06:32:00Z",
  "target": { "fileKey": "...", "nodeId": "...", "name": "..." },
  "score": {
    "total": 78,
    "grade": "B",
    "dimensions": {
      "NAM": { "score": 85, "weight": 0.30 },
      "LAY": { "score": 62, "weight": 0.25 }
      // ...
    },
    "coverage": {
      "namedPrefix": 0.85,
      "autoLayout": 0.62,
      "tokenized": 0.31,
      "depthAvg": 3.2,
      "depthMax": 5,
      "hiddenRatio": 0.04
    }
  },
  "issues": [
    {
      "id": "NAM003",
      "level": "error",
      "nodeId": "95:19385",
      "nodeName": "sub-img-bg-card",
      "nodePath": "page/sub-main/sub-img-bg-card",
      "message": "前缀语义冲突：同时含 img- 和 bg-",
      "fix": "二选一",
      "figmaUrl": "https://figma.com/design/.../?node-id=95-19385"
    }
  ],
  "summary": { "error": 3, "warn": 12, "info": 8 }
}
```

---

## 7. 集成调用协议

主 SKILL 在步骤 0.5 调用 doctor 时使用如下协议：

**输入**：
```js
doctor.run({
  fileKey, nodeId,
  config,                  // 完整 ctrip-train-d2c.config.json
  mode: 'integrated'       // 'integrated' | 'standalone'
})
```

**输出**：
```js
{
  passed: true | false,    // 是否通过（依据 health.blockOnError）
  score: { ... },          // 同 6.2 中的 score
  issues: [ ... ],          // 同 6.2 中的 issues
  // mode: 'standalone' 时额外写两个文件，integrated 不写
}
```

**主 SKILL 决策**：
```
if (!passed && config.health.blockOnError) {
  print '设计稿体检未通过，已生成报告。是否强制继续？(y/N)'
  return  // 等待用户确认
}
if (warn > 0) {
  print '设计稿体检发现 N 个警告，详见 .d2c-health.md，已继续生成。'
}
```

---

## 8. 首期实现范围（P0 共 ~13 条）

按 A 选项推荐，首期只实现以下规则，覆盖 80% 痛点：

- 命名：NAM001 / NAM002 / NAM003 / NAM004 / NAM005 / NAM008
- 布局：LAY001 / LAY002 / LAY009
- 结构：STR001 / STR002
- 资产：AST002 / AST004
- 可行性：FEA002 / FEA003

**首期不做**：
- STY 维度全部（涉及 token 体系，等项目 token 化推进后再做）
- AST001（svg- 前缀目前 SKILL 还未引入）
- LAY007（gap 测算成本高）

**首期评分**：仍按完整公式计算，未实现的规则视为不扣分。

---

## 9. 待你确认

- [ ] **A** 范围：首期 P0 ~13 条 是否合适？需要加/减哪些？
- [ ] **B** 集成方式：是否同意"独立 SKILL + 协议兼容主流程"双模式？
- [ ] **C** config 化：`health` 段 schema 是否可接受？阈值默认值是否合理？
- [ ] **D** 输出：md + json 双输出，文件名 `.d2c-health.md` / `.d2c-health.json` 是否 OK？
- [ ] **E** 评分权重：30/25/15/10/10/10 是否需要调整？
- [ ] **F** SKILL 名称：`ctrip-train-d2c-doctor` 还是另起一个？
- [ ] **G** 报告输出目录：默认与 `output.dir` 同，还是放项目根 `.d2c/`？

确认后我再写正式的 `templates/skills/ctrip-train-d2c-doctor/SKILL.md`，并按 P0 列表开始实现。
