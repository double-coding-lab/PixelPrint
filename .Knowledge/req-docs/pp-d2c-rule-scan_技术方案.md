# pp-d2c Rule-Scan 拆分 + 分层防线 Technical Spec

> **前置澄清文档**: `.Knowledge/req-docs/pp-d2c-rule-scan_需求澄清.md`
> **状态**: 已澄清,待评审 → f2s-req-plan
> **目标版本**: pp-d2c v0.3.21 → v0.3.22

---

## Requirement Overview

**背景**: pp-d2c v0.3.21 SKILL.md 2040 行,连续 7 起事故显示 agent 长文档丢约束 + 凭空搓色/gradient 的幻觉倾向让文档层规则失效。

**目标**: 引入 **4 层防线**:
1. **硬防线** — `check-rules.mjs` 覆盖 5 条可确定拦截规则 (R01/R02/R05/R06/R08),exit 1 硬拦
2. **软防线** — `Rule-Scan sub-agent` 分 block 并行扫,输出 `rule-hits.json` 传给 UI sub-agent
3. **补漏防线** — UI sub-agent 允许自补,强制 `assets.txt` `[遗漏补捕]` 备注
4. **兜底防线** — 主 agent §6.0.2 聚合 rule-hits + 主 agent 合并后再跑一次 check-rules.mjs

**非目标**:
- 不重构 skill 主流程 (步骤 -1 → 步骤 6 骨架不动)
- 不做 pp-doctor 集成 (本轮)
- 不动 pp-d2c-rn / pp-fix-partial / pp-strip-nodeid
- 不删 SKILL.md 里现有散落规则 (向后兼容,后续演进逐步删)
- 不改 rules 子目录分类 (平铺目录)

---

## Key Issues Overview

### 技术难点

| 难点 | 说明 | 处置 |
|---|---|---|
| **Rule-Scan sub-agent 上下文** | cache JSON 可能几万行,LLM 读全稿准确率低 | 分 block 派 Rule-Scan,每次只读该 block 的 cache 分片 |
| **rule-hits.json 传递** | 主 agent 记忆里聚合 vs 落盘 | **每 block 落盘到 `blocks/{sub}/rule-hits.json`**,主 agent 只在 §6.0.2 聚合读一次;避免全量数据在 sub-agent 之间跨传 |
| **check-rules.mjs 假阳性** | grep 边界 case 判错合规产物为违规 | 提供 `--force-skip R0X` 参数 + 强制 assets.txt 备注理由 |
| **Rule-Scan 漏判** | LLM sub-agent 不能保证 100% 识别 | 允许 UI sub-agent 自补,`assets.txt` 备注 `[遗漏补捕]` |
| **Rule-Scan sub-agent 挂了** | API 错误/超时 | 二次尝试,再挂降级到 v0.3.21 流程 (UI sub-agent 直接读 rules/*.md) + 主 agent QA 告警 |
| **rules/*.md 内部矛盾** | 两条规则对同一节点期望不同 | 每条 md 明确"排斥条件",高优先级规则先命中即停 |
| **skill 老规则 vs rules/ 新规则不一致** | 本轮不删老规则,可能矛盾 | rules/*.md 为准;SKILL.md 每处相关段落加 "→ 详见 rules/R0X.md" |

### 关键 tradeoff

**为什么不用一次扫全稿?**
- 一次扫全稿 = LLM 单次输入大,容易漏
- 分 block 扫 = sub-agent 数量翻倍(N Rule-Scan + N UI = 2N),但每个 sub-agent 输入小、准确度高
- 选后者。sub-agent 数量的 token 开销可接受,准确度优先。

**为什么不完全放弃 D 方案脚本?**
- Rule-Scan sub-agent 也是 LLM,不能自证。5 条**明确可算法化**的规则(R01/R02/R05/R06/R08)交给脚本兜底,即使 Rule-Scan 漏判也能拦
- 剩下 10 条(R03/R04/R07/R09-R15)确实脚本判不了(涉及"agent 是否凭空搓色"、"是否 CSS-able"、"是否同构"等语义判断),交给 Rule-Scan

**为什么允许 UI sub-agent 补漏?**
- Rule-Scan 是 LLM,承认它会漏
- UI sub-agent 在具体节点上有更细粒度上下文,它二次扫描能发现遗漏
- 但必须强制备注避免"agent 又自评说没关系"的旧问题(v0.3.9 教训)

---

## External Dependencies and Internal Calls

**外部依赖** (不改):
- Figma REST API (via `figma.mjs`)
- Node.js (Node ≥ 18 for `check-rules.mjs`)

**内部模块** (改造涉及):
- `templates/skills/pp-d2c/SKILL.md` (调整流程 + 加总概表)
- `templates/skills/pp-d2c/bin/figma.mjs` (不改)
- `templates/skills/pp-d2c/bin/install.js` (不改)
- `templates/skills/pp-d2c/bin/check-rules.mjs` (**新建**)
- `templates/skills/pp-d2c/rules/*.md` (**新建 16 个文件**: 1 README + 15 R0X)
- `templates/skills/pp-doctor/SKILL.md` (**本轮不改**;下轮考虑加 SUB031 补漏漏备注 warning)

**下游同步**:
- `figma-plugin-test-function/.claude/skills/pp-d2c/` 拷贝整个 skill 目录 (含 bin/ + rules/)

---

## Configuration

**pp-d2c.config.json** (不新增字段,现有兼容):
- `layers.fixed` (默认 `fixed-`): check-rules.mjs 从这里读前缀
- `layers.bg` / `layers.img` / `layers.but` / `layers.input` / `layers.ignore`: R01/R02/R08 判定用
- 其他字段不变

**新增运行参数** (`check-rules.mjs` CLI):
```bash
node check-rules.mjs --block <blockDir> --cache-key <fileKey>
node check-rules.mjs --merge <pageDir> --cache-key <fileKey>
node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R05,R06
```

**Feature Flags**: 无

---

## Delivery Units

### 1. rules/*.md 规则库 (新建 16 个文件)

**目录结构**:
```
templates/skills/pp-d2c/rules/
├── README.md                        导航 + rule id ↔ 名称 ↔ 硬防线/软防线归属表
├── R01-fixed-position.md            硬防线 (check-rules.mjs)
├── R02-fills-image.md               硬防线
├── R03-implicit-image.md            软防线 (Rule-Scan)
├── R04-text-gradient.md             软防线
├── R05-space-between.md             硬防线
├── R06-text-solid-last.md           硬防线
├── R07-multi-fills.md               软防线
├── R08-bg-landing-form.md           硬防线
├── R09-btn-bgc-取值.md              软防线
├── R10-no-fake-solid-color.md       软防线
├── R11-mask-vector-css-able.md      软防线
├── R12-flat-mode-naming.md          软防线
├── R13-unit-scale.md                软防线 (未来可升硬防线)
├── R14-fixed-z-index.md             软防线
└── R15-同构 map 渲染.md              软防线
```

**每个 R0X-{slug}.md 统一模板** (强制):

```markdown
# R0X - <规则名>

## 判定归属
- **硬防线** (check-rules.mjs 自动拦截): 是 / 否
- **软防线** (Rule-Scan sub-agent 识别): 是 / 否
- **排斥条件** (与哪些其他 rule 互斥): [R0X, R0Y] 或 "无"

## 触发条件
<在 Figma cache JSON 里怎么精确识别命中>
- JSON path: `<field.path.notation>`
- 匹配规则: <文字描述 + 若可能给出 JSON schema>

## 期望产物
<产物 JSX / SCSS / CSS 里必须体现什么>
- JSX 端: <具体 DOM 结构>
- SCSS 端: <具体属性>
- 反例扫描: <正则或反向匹配模式>

## 反例 (agent 常见错法)
<从历史事故里拿真实的错误产物做对照>

## 落地代码模板
```<language>
<给一段可以直接抄的 code snippet>
```

## 违反后果
- doctor 规则 ID: SUB0XX (error / warn)
- 后果描述: <产物什么表现>

## 相关
- SKILL.md 相关段落: §X.X
- 历史事故: <session-id 或 产物路径>
```

**README.md 结构**:

```markdown
# pp-d2c 规则库

> pp-d2c skill 硬性规则的原始定义。当 rules/*.md 内容与 SKILL.md 冲突时以 rules/ 为准。

## 索引表

| ID | 名称 | 判定归属 | 一句话触发条件 |
|---|---|---|---|
| R01 | fixed-position | 硬防线 | 前缀 fixed- |
| R02 | fills-image | 硬防线 | fills[].type === 'IMAGE' |
| ... | ... | ... | ... |

## 判定归属说明

**硬防线** (check-rules.mjs): 用代码 grep + JSON scan 精确判定,exit 1 拦截。

**软防线** (Rule-Scan sub-agent): 需 LLM 语义判断,输出 rule-hits.json 给 UI sub-agent 参考。

## 使用方式

- **Rule-Scan sub-agent**: Read 所有 R0X.md 后按每条规则的"触发条件"扫 cache JSON
- **UI sub-agent**: Read 本 block rule-hits.json 里涉及的 R0X.md,按"期望产物"落地
- **check-rules.mjs**: 硬编码 R01/R02/R05/R06/R08 逻辑,rules/*.md 是设计文档不是执行文档
```

---

### 2. check-rules.mjs (新建,~600 行)

**位置**: `templates/skills/pp-d2c/bin/check-rules.mjs`

**CLI**:
```bash
# 单个 block 扫描 (sub-agent 交付前必跑)
node check-rules.mjs --block blocks/UI/ --cache-key s7ILyhLgFeLlgM66vQ1RXG

# 主 agent 合并后整 page 扫 (§6.0.2 强制)
node check-rules.mjs --merge pages/test8/ --cache-key 2VHQW1W22UNsYn84g82m2b

# 跳过指定规则 (处理假阳性)
node check-rules.mjs --block blocks/UI/ --cache-key <key> --force-skip R05,R06
```

**输入约定**:
- `--block <dir>` 或 `--merge <dir>` 二选一
- `<dir>` 内必须至少含: `index.jsx` / `index.tsx` + 一个样式文件 (`*.scss` / `*.less` / `*.css` / `*.module.scss` 等)
- `<dir>` 上溯查找 `pp-d2c.config.json` (从 <dir> 向上找 projectRoot,读取 `layers.*` 前缀配置)
- `.d2c-cache/<cache-key>/nodes/*.json` 存在

**输出 JSON schema**:
```json
{
  "ok": false,
  "checked": ["R01", "R02", "R05", "R06", "R08"],
  "skipped": ["R05"],
  "passed": ["R01", "R02", "R06", "R08"],
  "failed": [],
  "violations": [],
  "warnings": [
    {
      "rule": "R05",
      "reason": "skipped via --force-skip"
    }
  ]
}
```

**violation 条目 schema**:
```json
{
  "rule": "R01",
  "nodeId": "211:32",
  "name": "fixed-状态栏",
  "expected": "css 含 position: fixed",
  "actual": "css 只有 position: relative",
  "file": "index.module.scss",
  "line": 20,
  "snippet": ".topbar {\n  position: relative;\n  ..."
}
```

**exit code**:
- `0` — `ok=true`,全部通过 (可能有 warnings,不影响)
- `1` — `ok=false`,有 violations
- `2` — 环境错误 (cache 找不到 / 产物文件不存在 / config 缺失)

**5 条规则实现要点**:

#### R01 fixed-position

```
判定:
  1. scan cache: nodes where name.startsWith(layers.fixed || 'fixed-')
  2. for each such node,取产物 CSS 中含 data-node-id="{id}" 对应类名(先 grep jsx 拿 className,再 grep scss)
  3. 检查该类名规则内是否含 /position\s*:\s*fixed/i
  4. 缺失 → violation
判定精度:
  - 通过 data-node-id 精确定位 (v0.3.7 起产物必带)
  - 类名可能被 css-modules 转义,统一 grep 原始 className
```

#### R02 fills-image

```
判定:
  1. scan cache: nodes where fills[].some(f => f.type === 'IMAGE' && f.visible !== false)
  2. 该节点或其父容器的 CSS 必须含 `url(` 且指向该 nodeId 对应切图文件
  3. 从 assets.txt 读 filename 关联,若 assets.txt 缺失该 nodeId 切图记录 → violation
  4. 若 assets.txt 有记录但产物 CSS 未引用 → violation
排斥条件:
  - 节点前缀是 x- → 忽略
```

#### R05 space-between

```
判定:
  1. scan cache: nodes where primaryAxisAlignItems === 'SPACE_BETWEEN'
  2. 该 node 对应 CSS 类必须含 /justify-content\s*:\s*space-between/i
  3. 反向扫: 该类名内含 /margin-(left|right|top|bottom)\s*:\s*auto/ 或 /justify-content\s*:\s*flex-(start|end)/ 或 /gap\s*:\s*auto/ → warning (可能是模拟 space-between 的错法)
```

#### R06 text-solid-last

```
判定:
  1. scan cache: TEXT nodes where fills 数组非空,取"末位可见 SOLID":
     - 从 fills.length-1 倒序遍历
     - 找到第一个 f 满足 f.type === 'SOLID' && f.visible !== false
     - 若无 → 该节点走 R04 判定 (末位可见是 GRADIENT/IMAGE),不在 R06 范围
  2. 取该 SOLID.color = {r,g,b,a},换算成 HEX (#RRGGBB;a 忽略,单独 opacity)
  3. 产物中 data-node-id="{id}" 对应类名 CSS 必须含 /color\s*:\s*#{hex}/i
  4. 不匹配 → violation
边界:
  - fills 全部 visible: false → 用默认黑 #000000
  - HEX 大小写不敏感
```

#### R08 bg-landing-form

```
判定 (反向匹配):
  1. scan cache: nodes where name.startsWith(layers.bg || 'bg-') || name === 'bg'
  2. 反向扫产物,不允许出现:
     - jsx: /<img[^>]*src=[^>]*bg-/  (bg- 用 img,应为父 background)
     - jsx: /<img[^>]*src=[^>]*\bbg\.[a-z]+/  (裸 bg 用 img)
     - jsx: /style=\{\{[^}]*background/ (inline style 挂 bg)
     - scss: /::before[^{]*\{[^}]*background-image/ (::before 挂 bg)
     - scss: /::after[^{]*\{[^}]*background-image/ (::after 挂 bg)
     - jsx: `<div className="[^"]*-bg[^"]*"[^>]*></div>` (空 div 挂 bg)
  3. 匹配到 → violation,输出违规文件+行号
```

**性能预算**:
- 每 block 跑一次 < 500ms (cache JSON 5-50 个 node,产物文件 3-5 个)
- 整 page 跑一次 < 2s (聚合所有 block cache)

**内部结构 (模块化)**:
```
bin/check-rules.mjs                主入口 (argv 解析 + 调度)
bin/rules/
  ├── R01-fixed-position.js        每条规则一个 export.check(cache, product, config)
  ├── R02-fills-image.js           返回 violations[]
  ├── R05-space-between.js
  ├── R06-text-solid-last.js
  └── R08-bg-landing-form.js
bin/lib/
  ├── loadCache.js                 读 .d2c-cache/<key>/nodes/*.json,返回 node map
  ├── loadProduct.js               读产物 jsx/scss 文件,返回 { jsx, scss, byNodeId }
  ├── nodeIdToClassName.js         从 jsx 里 grep className={styles.X} data-node-id="Y",建 map
  └── report.js                    格式化输出 JSON
```

---

### 3. Rule-Scan sub-agent (新增派发流程 in SKILL.md)

**触发位置**: SKILL.md 步骤 3 (原"并行分发 sub-agent") 内部

**输入 (mandatory context for sub-agent)**:
- 本 block 的分片 nodeIds (主 agent 步骤 2 生成)
- `.d2c-cache/<cache-key>/nodes/` 下与本 block nodeIds 相关的 JSON 分片
- **全部** `templates/skills/pp-d2c/rules/*.md` (Read)
- 本 block 的 pp-d2c.config.json (读 `layers.*` 前缀)

**职责边界** (强制):
- **只识别,不实现**
- 不写 JSX / SCSS
- 不改 cache
- 不派下级 sub-agent

**输出**: 落盘 `blocks/{sub}/rule-hits.json` (schema 见 §"数据模型")

**Prompt 模板** (给 sub-agent 的 system prompt 提要):

```
你是 Rule-Scan sub-agent, 只做规则识别, 不写 UI 代码.

任务:
1. Read templates/skills/pp-d2c/rules/*.md (全部 15+ 条)
2. Read .d2c-cache/<cache-key>/nodes/ 下与本 block nodeIds 相关的 JSON
3. 对本 block 的每个节点, 判断命中了哪些规则
4. 输出 rule-hits.json (schema 见附)

规则命中判定原则:
- 硬防线规则 (R01/R02/R05/R06/R08): 你也扫,即使 check-rules.mjs 会兜底
- 软防线规则 (R03/R04/R07/R09-R15): 你是唯一识别方
- 排斥条件: 若节点命中高优先级规则, 低优先级规则不再重复列
- 优先级: R02 > R01 > R05 > R11 > R03 > R04 > R07 > ...(排斥顺序在每条 rules/R0X.md "排斥条件" 里定义)

输出要求:
- 每个 hit 包含 nodeId / rule / trigger 描述 / expected 描述 / context (关键 JSON 字段抽样)
- 输出 JSON, 不带 markdown 代码块围栏, 不加解释文字
- 落盘到 blocks/{sub}/rule-hits.json

禁止:
- 不允许写 JSX / SCSS
- 不允许改 cache 文件
- 不允许基于"设计意图猜测"命中规则; 只按 rules/*.md "触发条件" 字面判定
```

**性能预算**:
- 每 block 一个 Rule-Scan sub-agent,输入 cache JSON 5-50 节点
- 输出 rule-hits.json < 200 行
- 单个 sub-agent 平均耗时 15-30 秒 (LLM 推理)
- 3 blocks 并行 → 总耗时约 30 秒

---

### 4. UI sub-agent (改造,基于 v0.3.21 增强)

**位置**: SKILL.md 步骤 4 (原步骤 4)

**新增输入**:
- `blocks/{sub}/rule-hits.json` (Rule-Scan 产物)

**新增强制动作**:

1. **Read rule-hits.json**,按每条 hit 的 `expected` 字段落地
2. **生完 JSX + SCSS 后必须跑**:
   ```bash
   node .claude/skills/pp-d2c/bin/check-rules.mjs \
     --block blocks/{sub}/ \
     --cache-key <fileKey>
   ```
3. 判断脚本 exit code:
   - exit 0 → 继续
   - exit 1 → 按 stdout violations 列表回滚代码,重做,重新跑脚本
   - exit 2 → 停下,报告环境错误给主 agent
4. **assets.txt QA 段追加"rule-hits 消费证明"**:

   ```
   ## rule-hits 消费证明 (v0.3.22)
   
   - 输入 rule-hits 条数: N
   - 处理到位条数: M (M == N 时 ✅)
   - 处理列表: [
       { nodeId, rule: "R0X", 落地类型: "css 属性" | "span 包裹" | "切图挂父" | ... }
     ]
   - 遗漏补捕: K 条
     - [遗漏补捕] R0X {nodeId} "{name}": Rule-Scan 未识别, 自动补齐落地 = {做了什么}
   - check-rules.mjs 通过: ✅ / ❌ + violations 列表
   ```

**补漏规则** (v0.3.22 新增):
- 生 JSX/SCSS 时如果 sub-agent 发现某节点应命中某规则但 rule-hits 里没有 → 允许自补
- 必须在 assets.txt 用 `[遗漏补捕]` 前缀记录 (逐条 nodeId + rule id + 落地说明)
- 主 agent §6.0.2 会 diff `rule-hits 声明的 nodeId 集合` 和 `实际处理的 nodeId 集合`,不一致但无 `[遗漏补捕]` 备注 → doctor SUB031 warn (**本轮不加 doctor 规则,只在 SKILL.md 里描述**)

**降级路径**:
- 如果 rule-hits.json 不存在 (Rule-Scan 挂了):
  1. UI sub-agent 记录 `[Rule-Scan 降级]` 到 assets.txt
  2. Read **全部** `rules/*.md` (回到 v0.3.21 前的读全量规则库模式)
  3. 自己判定 + 落地
  4. 依然跑 check-rules.mjs
  5. 主 agent §6.0.2 记录降级并输出 QA 告警

---

### 5. SKILL.md v0.3.22 改造

**顶部版本号**:
```
v0.3.21 → v0.3.22 引入 Rule-Scan sub-agent + check-rules.mjs 硬防线 + rules/*.md 规则库, 4 层防线拦截 agent 长文档丢约束
```

**§4.3 顶部新增 "硬规则总概表"** (完全表格,15 行):

```markdown
##### 硬规则总概表 (v0.3.22 索引,详情看 rules/R0X.md)

| ID | 规则名 | 一句话触发 | 违反后果 | 详情 |
|---|---|---|---|---|
| R01 | fixed-position | 前缀 fixed- | 缺 position: fixed | [rules/R01-fixed-position.md] |
| R02 | fills-image | fills[].type === 'IMAGE' | 凭空搓 gradient 代替切图 | [rules/R02-fills-image.md] |
| R03 | implicit-image | 无前缀 + 子树全 VECTOR + 无 TEXT/INSTANCE | 该切图没切,变成一堆 vector CSS | [rules/R03-implicit-image.md] |
| R04 | text-gradient | TEXT 末位可见 fills=GRADIENT/IMAGE | 凭空搓 solid color 代替 span+bg-clip | [rules/R04-text-gradient.md] |
| R05 | space-between | primaryAxisAlignItems === SPACE_BETWEEN | 用 margin-auto/flex-end 模拟 | [rules/R05-space-between.md] |
| R06 | text-solid-last | TEXT 多层可见 SOLID | 取错层 (通常取到中间层白色) | [rules/R06-text-solid-last.md] |
| R07 | multi-fills | fills 有 SOLID + IMAGE 叠 | 只写 SOLID 忽略 IMAGE | [rules/R07-multi-fills.md] |
| R08 | bg-landing-form | bg- 前缀 (含裸 bg) | 用 <img>/inline/::before/空 div 挂 bg | [rules/R08-bg-landing-form.md] |
| R09 | btn-bgc 取值 | btn 内 bgc 子层的真 fills | 凭空搓 gradient 代替真值 | [rules/R09-btn-bgc-取值.md] |
| R10 | no-fake-solid-color | agent 输出 color: #xxx | 从 cache 找不到源头 = 幻觉色 | [rules/R10-no-fake-solid-color.md] |
| R11 | mask-vector-css-able | 复合 mask / 多层 vector | 判断"CSS 表达不了" → 应切图,不该硬 CSS | [rules/R11-mask-vector-css-able.md] |
| R12 | flat-mode-naming | flat 合并模式类名 | 相同类名跨 block 覆盖 | [rules/R12-flat-mode-naming.md] |
| R13 | unit-scale | Figma px → 产物 px | 忘换算 (scale = outputBase/figmaBase) | [rules/R13-unit-scale.md] |
| R14 | fixed-z-index | 多个 fixed- 节点 | z-index 未递增导致层级错 | [rules/R14-fixed-z-index.md] |
| R15 | 同构 map 渲染 | 同层 ≥3 同构子节点 | 展开成 3 份重复代码而非 .map() | [rules/R15-同构 map 渲染.md] |

**硬防线** (check-rules.mjs 自动拦截, exit 1): R01 / R02 / R05 / R06 / R08
**软防线** (Rule-Scan sub-agent 识别 rule-hits.json): R03 / R04 / R07 / R09 / R10 / R11 / R12 / R13 / R14 / R15
```

**§4.3 现有 "切图四条硬规则" 段不动**,只在顶部加"硬规则总概表" (以上表格)。

**§4.3 底部新增 "SKILL.md 规则 → rules/*.md 索引" 段** (映射老规则位置到新 rules/):

```markdown
##### SKILL.md 老规则章节 → rules/ 索引

以下 SKILL.md 现有段落的详情已迁移到 rules/, 遇到不一致时以 rules/ 为准:

| SKILL.md 章节 | rules/*.md |
|---|---|
| §4.1.1 TEXT 多层 fills 处理 | rules/R04-text-gradient.md, rules/R06-text-solid-last.md |
| §4.3 切图四条硬规则 | rules/R01, R02, R03, R08 |
| §4.3 CSS 翻译表 (fills SOLID/GRADIENT) | rules/R07-multi-fills.md, rules/R09-btn-bgc-取值.md |
| §4.4.pre.b 子树结构禁切规则 (v0.3.9) | rules/R11-mask-vector-css-able.md |
| §4.5 单位换算 | rules/R13-unit-scale.md |
| §5.1 data-node-id 守恒律 | (不需要拆, 属主 agent §6.0.2 校验) |
```

**新增"步骤 3.5: Rule-Scan sub-agent 派发"** (在原步骤 3 和步骤 4 之间):

```markdown
### 步骤 3.5: Rule-Scan sub-agent 派发 (v0.3.22 新增)

**目的**: 让每个 UI sub-agent 干活前, 先由独立 Rule-Scan sub-agent 扫出本 block 命中的规则, 输出 rule-hits.json 作为作业指引.

**流程**:

1. **for each block in 执行清单 (步骤 3 生成的分块列表)**:
   派发 Rule-Scan sub-agent, 输入:
   - block 的 nodeIds 分片
   - `.d2c-cache/<fileKey>/nodes/<nodeId>.json` (相关分片)
   - `templates/skills/pp-d2c/rules/*.md` (全部)
   - `pp-d2c.config.json.layers` (前缀配置)

2. **Rule-Scan sub-agent 输出**: `blocks/{sub}/rule-hits.json`

3. **主 agent 不聚合全量 rule-hits**, 只在 §6.0.2 合并前做一次聚合读

**降级**: Rule-Scan sub-agent 二次失败 → UI sub-agent 走"读全量 rules/*.md" 兜底 (回到 v0.3.21 之前的自己判断模式) + assets.txt `[Rule-Scan 降级]` 备注.

**详细 sub-agent prompt** 在 rules/README.md 里定义, 派发时 主 agent 拼装.
```

**步骤 4 改造** (输入描述改动):

```markdown
### 步骤 4: UI sub-agent 实现单个 block (v0.3.22 增强)

**输入 (相比 v0.3.21 新增)**:
- 本 block 的 `rule-hits.json` (来自 Rule-Scan sub-agent, 见步骤 3.5)

**新增强制动作**:
- Read rule-hits.json, 按每条 hit 的 expected 落地 (如 R01 → position: fixed / R04 → span + bg-clip)
- 生完产物后必须跑: `node .claude/skills/pp-d2c/bin/check-rules.mjs --block blocks/{sub}/ --cache-key <fileKey>`
- exit 0 → 继续; exit 1 → 按 violations 回滚; exit 2 → 报环境错误
- assets.txt QA 段追加"rule-hits 消费证明" (格式见 rules/README.md)

**补漏规则**: 生产物时发现某节点应命中某 R0X 但 rule-hits 里没提 → 允许自补, 但必须 assets.txt 备注 `[遗漏补捕] R0X {nodeId}: ...`.
```

**§6.0.2 合并忠实度证明块新增 2 段**:

```markdown
## rule-hits 聚合 (v0.3.22 强制)

- Rule-Scan 全部条数 (聚合 blocks/*/rule-hits.json): N
- UI sub-agent 实际处理条数 (assets.txt "rule-hits 消费证明"): M
- 遗漏补捕总数: K
- 每个补捕都有 [遗漏补捕] 备注: ✅ / ❌ + 无备注的补捕列表
- 每个 sub-agent 的 check-rules.mjs 都通过: ✅ / ❌ + 未通过 block 列表
- Rule-Scan 降级发生 (对哪些 block): 无 / [block 列表 + 原因]

## 整 page check-rules.mjs 复跑

主 agent 合并后必须重跑一次 check-rules.mjs 对整个 page 目录 (防合并打散产物):

`node .claude/skills/pp-d2c/bin/check-rules.mjs --merge pages/{page}/ --cache-key <fileKey>`

- exit code: 0 (通过) / 1 (违规) / 2 (环境错)
- 若 exit 1: 主 agent 必须修产物或回滚 sub-agent 产物, 不允许把违规带到步骤 7 交付
```

---

## Data Model

### rule-hits.json 结构 (Rule-Scan sub-agent 输出)

```typescript
interface RuleHitsFile {
  block: string;                    // 例: "sub-MAIN"
  cache_key: string;                // Figma fileKey
  generated_at: string;             // ISO timestamp
  generated_by: "rule-scan-subagent" | "v0.3.21-fallback";
  hits: RuleHit[];
}

interface RuleHit {
  rule: string;                     // 例: "R01"
  rule_name: string;                // 例: "fixed-position"
  nodeId: string;                   // 例: "211:32" 或复合定位 "211:411 > 211:91"
  name: string;                     // Figma 图层名
  type: string;                     // Figma 节点 type (GROUP/FRAME/TEXT/RECTANGLE/...)
  trigger: string;                  // 一句话描述"为何命中此规则"
  expected: string;                 // 一句话描述"应该怎么落地"
  context: Record<string, any>;     // 关键 JSON 字段抽样 (帮 UI sub-agent 快速定位)
}
```

**示例**:

```json
{
  "block": "sub-MAIN",
  "cache_key": "s7ILyhLgFeLlgM66vQ1RXG",
  "generated_at": "2026-08-11T09:15:00Z",
  "generated_by": "rule-scan-subagent",
  "hits": [
    {
      "rule": "R01",
      "rule_name": "fixed-position",
      "nodeId": "211:32",
      "name": "fixed-状态栏",
      "type": "GROUP",
      "trigger": "name.startsWith('fixed-')",
      "expected": "css 含 position: fixed + 由 constraints={vertical:TOP,horizontal:LEFT} 推 top/left",
      "context": {
        "constraints": { "vertical": "TOP", "horizontal": "LEFT" },
        "bbox": { "x": 0, "y": 0, "width": 375, "height": 118 }
      }
    },
    {
      "rule": "R04",
      "rule_name": "text-gradient",
      "nodeId": "211:411 > 211:91",
      "name": "2026 (TEXT)",
      "type": "TEXT",
      "trigger": "fills 末位可见 type=GRADIENT_LINEAR",
      "expected": "包一层 <span>, span 上写 background: linear-gradient(180deg, ...) + background-clip: text + color: transparent",
      "context": {
        "fills_last_type": "GRADIENT_LINEAR",
        "fills_last_stops": [
          { "color": { "r": 1, "g": 0.97, "b": 0.93, "a": 1 }, "position": 0 },
          { "color": { "r": 1, "g": 0.86, "b": 0.67, "a": 1 }, "position": 1 }
        ],
        "fills_last_handles": [
          { "x": 0.5, "y": 0 },
          { "x": 0.5, "y": 1 }
        ]
      }
    }
  ]
}
```

### check-rules.mjs 输入/输出

**输入**: CLI 参数 (见 §Configuration)
**输出**: stdout 一份 JSON,exit code 见 Delivery Units §2

---

## Call Flow

**整体调用顺序** (v0.3.22, 从主 agent 视角):

```
1. 步骤 -1 到 步骤 3: 保持不变 (Figma Token 检测 → 读 config → 解析 URL → 扫描图层 → 采集页面背景 → 分块)

2. 步骤 3.5 (新): 并行派发 Rule-Scan sub-agent
   for each block: spawn Rule-Scan → blocks/{sub}/rule-hits.json

3. 步骤 4 (改): 并行派发 UI sub-agent
   for each block:
     spawn UI sub-agent, 输入 = block 分片 + rule-hits.json
     sub-agent 内部:
       Read rule-hits.json → 按 hits 生 JSX/SCSS
       跑 check-rules.mjs --block → exit 判定
       写 assets.txt "rule-hits 消费证明"

4. 步骤 5: 主 agent 合并 sub-agent 产物 (不变)

5. 步骤 6.0.2 (改): 合并忠实度证明块
   - 原有 6 段保留
   - 新增: rule-hits 聚合段
   - 新增: 整 page check-rules 复跑段
     → 跑 check-rules.mjs --merge pages/{page}/
     → exit 1 时主 agent 回滚

6. 步骤 7: 输出交付 (不变)
```

---

## Exception Handling

| 异常类型 | 触发场景 | 处理 |
|---|---|---|
| Rule-Scan sub-agent 挂了 (首次) | API 错误 / 超时 | 主 agent 重派一次 |
| Rule-Scan sub-agent 挂了 (二次) | 二次失败 | 降级: UI sub-agent Read 全部 rules/*.md 自己判定 + assets.txt 备注 `[Rule-Scan 降级]` + 主 agent QA 告警 |
| rule-hits.json 输出空 | 该 block 无规则命中 | 正常, UI sub-agent 按 v0.3.21 无 rule-hits 模式干活 |
| rule-hits.json 格式错 | Rule-Scan 输出不符合 schema | UI sub-agent 报错到主 agent, 主 agent 重派 Rule-Scan; 二次错则降级 |
| check-rules.mjs 假阳性 | 脚本误报合规产物为违规 | agent 可用 `--force-skip R0X` 跳过, 必须 assets.txt `[脚本误判] R0X {nodeId} 理由: ...` |
| check-rules.mjs 假阴性 | 脚本漏拦违规产物 | 依赖 §6.0.2 主 agent 合并前的整 page 复跑 + Rule-Scan 交叉覆盖 |
| check-rules.mjs 环境错 (exit 2) | cache 找不到 / 产物文件缺失 / config 缺失 | sub-agent 报告主 agent, 主 agent 检查环境 |
| UI sub-agent 补漏但漏写 [遗漏补捕] | agent 自补规则但忘备注 | 主 agent §6.0.2 diff 出后强制 warn (不阻塞), 记录到最终交付 QA 段 |
| rules/*.md 与 SKILL.md 冲突 | 老规则和新规则文案不一致 | rules/ 为准, SKILL.md 相关段落加 "详见 rules/R0X.md" 注解 |
| rules/*.md 内规则互相排斥 | 两条对同一节点判定冲突 | 按每条 R0X.md "排斥条件" 字段, 高优先级先命中即停 |

---

## 实施顺序 (给 f2s-req-plan 拆任务用)

1. **T1: rules/*.md 骨架** (0.5 天)
   - 建 rules/ 目录 + README.md + 16 个空 R0X.md (只填顶部 §判定归属 §触发条件)
   - 每条规则的 §触发条件 用一句话精确定义

2. **T2: rules/*.md 精细化** (1 天)
   - 每条 R0X.md 补全 §期望产物 §反例 §落地代码模板 §违反后果 §相关
   - README.md 索引表 + 使用说明写完整

3. **T3: check-rules.mjs 骨架 + R01/R02** (0.5 天)
   - bin/check-rules.mjs 主入口 + CLI 解析
   - bin/lib/loadCache.js + loadProduct.js + nodeIdToClassName.js + report.js
   - bin/rules/R01-fixed-position.js
   - bin/rules/R02-fills-image.js
   - 用 test1 事故稿手动验证 R01/R02 命中率

4. **T4: check-rules.mjs 补齐 R05/R06/R08** (0.5 天)
   - bin/rules/R05/R06/R08.js
   - 3 张事故稿 (test1/test8/test2) 手动跑一遍,5 条规则各命中至少 1 处 → 合格

5. **T5: SKILL.md v0.3.22 主体改造** (0.5 天)
   - 顶部版本号 + §4.3 硬规则总概表 + §4.3 底部 rules/ 索引
   - 步骤 3.5 新增段落 + 步骤 4 改动 + §6.0.2 加 2 段

6. **T6: SKILL.md v0.3.22 sub-agent prompt** (0.5 天)
   - rules/README.md 里定义 Rule-Scan sub-agent 完整 prompt
   - 主 agent 派发时的拼装模板

7. **T7: 下游同步 + 验收** (0.25 天)
   - cp 整个 skill 目录到 figma-plugin-test-function
   - 跑 test1/test8/test2 三张事故稿
   - 检查 7 起历史事故里至少 5 起被拦截或标记

**总工作量估算**: 3.75 天

---

## 相关

- 需求澄清: `.Knowledge/req-docs/pp-d2c-rule-scan_需求澄清.md`
- 历史技术方案: `.Knowledge/req-docs/pp-d2c-skill_技术方案.md` (skill 起源)
- 前置版本: `templates/skills/pp-d2c/SKILL.md` (v0.3.21)
- task: `.task/550947002/active/pp_d2c_rule_scan_split/`

---
