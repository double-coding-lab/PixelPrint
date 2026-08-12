# pp-d2c Rule-Scan 拆分 + 分层防线 —— 需求澄清

> **状态**: 已澄清,待技术方案
> **发起**: 2026-08-11
> **linkedSkill**: `f2s-req-clarify` → `f2s-req-tech`
> **task**: `.task/550947002/active/pp_d2c_rule_scan_split/`

---

## 1. 背景和目标

### 1.1 背景

`pp-d2c` skill 目前在 v0.3.21 版本,SKILL.md 2040 行。近期在 `figma-plugin-test-function` 项目跑测试(test1/test8/test2/test7-9 等)时,连续发现多起 agent 违反规则的事故:

| 事故 | 根因 | 规则是否存在 |
|---|---|---|
| test1 topbar 缺 `position: fixed` | agent 忽略 fixed- 前缀 | 存在(§4.3) |
| test1 cdBlock 应该切 bg 图但凭空搓 gradient | agent 违反"fills 含 IMAGE 必切图" | 存在(§4.3 硬规则 2) |
| test1/test8 按钮文字色错(应 #864500 取到 #fff) | agent 没按"末位可见 SOLID"取值 | 存在(§4.1.1) |
| test8 quanItem__btn 背景色凭空搓(应 #9c2d00→#261711) | agent 忽略节点 bgc 子层的真实 fills | 存在(§4.3 CSS 翻译表) |
| test8 "领取"字色错(应 GRADIENT 用 span+bg-clip) | agent 遇到 TEXT fills=GRADIENT 时凭空搓 solid color | v0.3.21 才补齐 |
| test2 renwuInviteIcon 应切图但没切 | 规则漏 - 无前缀 + 无 IMAGE 的纯装饰节点 | v0.3.20 才补齐(硬规则 3) |
| mal3eFds 背景色盖背景图 | agent 只取 SOLID 忽略 IMAGE | 存在(§4.3 多重 fills 合成) |

**共同规律**: 90% 的事故是 **agent 违反已经写清楚的规则**,不是规则缺失。规则在 skill 里散落 15+ 处,agent 长文档丢约束,加上凭空搓色/搓 gradient 的幻觉倾向,让文档层规则失效。

### 1.2 目标

引入**分层防线**,让 agent 违反规则时被自动拦截或提示:

1. **硬防线**: 用代码脚本 `check-rules.mjs` 覆盖能确定拦截的 5 条规则,`exit 1` 硬拦。
2. **软防线**: 用独立的 `Rule-Scan` sub-agent 覆盖需要 LLM 判断的规则(10+ 条),输出`rule-hits.json` 给下游 UI sub-agent。
3. **补漏防线**: 允许 UI sub-agent 发现 Rule-Scan 遗漏时自补,但强制 `assets.txt` 备注 `[遗漏补捕]`。
4. **兜底防线**: 主 agent §6.0.2 合并前聚合所有 rule-hits + 交叉验证 grep。

**成功标准**: v0.3.22 发布后,重跑 test1/test8/test2 三张事故稿,上述 7 起事故**至少 5 起**在 sub-agent 交付前被拦截或标记。

### 1.3 非目标

- 不重构 skill 主流程步骤 -1 → 步骤 6 的执行骨架(v0.3.19 已精简,再动风险高)
- 不接入 f2s-doc-arch / f2s-doc-final 等文档 skill
- 不影响 pp-d2c-rn(h5 独享,已 v0.3.15 冻结)
- 本轮不做 pp-doctor 集成(check-rules.mjs 独立能力,后续演进)

---

## 2. 范围

### 2.1 包含

**新增**:
- `templates/skills/pp-d2c/rules/*.md` —— 规则库(平铺目录,每条一文件,预计 15 个)
- `templates/skills/pp-d2c/bin/check-rules.mjs` —— 5 条硬规则的代码化断言脚本
- SKILL.md 步骤 3 → 步骤 4 之间新增"步骤 3.5: Rule-Scan sub-agent 派发" 段落
- SKILL.md §4.3 增加"硬规则总概表"(rule id + 一句话触发条件 + 违反后果 + 详情引用 rules/R0X.md)
- SKILL.md §4.4 sub-agent 交付前自证段增加"跑 check-rules.mjs + 读取 rule-hits.json"步骤
- SKILL.md §6.0.2 合并忠实度证明块增加"rule-hits 聚合 + 遗漏补捕验证" 段
- `templates/skills/pp-d2c/rules/README.md` —— 规则库导航文档

**调整**:
- SKILL.md 现有散落的规则描述**不删除**(向后兼容),但每处顶部加"→ 详见 `rules/R0X.md`"引用
- 顶部版本号 v0.3.21 → v0.3.22

### 2.2 排除

- 不改 pp-d2c-rn / pp-fix-partial / pp-strip-nodeid / pp-doctor
- 不改 `figma.mjs` / `install.js` / `pp-d2c.config.json` 结构
- 不改 downstream 项目的 skill(figmad2c-test2 不在本轮范围;figma-plugin-test-function 会同步下游一次做测试)
- 不改 `.d2c-cache/` 存储结构

---

## 3. 关键流程

### 3.1 现流程 (v0.3.21)

```
主 agent
  ├─ 步骤 -1: 检测 Figma Token
  ├─ 步骤 0/0.3: 读配置 + 初始化缓存
  ├─ 步骤 1: 解析 URL
  ├─ 步骤 2: 扫描图层,生成执行清单
  ├─ 步骤 2.5: 采集页面级背景
  ├─ 步骤 3: 并行分发 sub-agent (按 sub- 前缀分块)
  ├─ 步骤 4: sub-agent 独立实现 block (读 4.3 规则,生 JSX + SCSS + assets.txt)
  ├─ 步骤 5: 主 agent 合并 sub-agent 产物
  ├─ 步骤 6: 主 agent 合并验收 (§6.0/6.0.1/6.0.2)
  └─ 步骤 7: 输出交付
```

### 3.2 新流程 (v0.3.22)

```
主 agent
  ├─ 步骤 -1 到 步骤 2: 保持不变
  ├─ 步骤 2.5: 采集页面级背景 (不变)
  │
  ├─ 【新】步骤 3: 分发前先派 Rule-Scan sub-agent
  │    ├─ for each block in 执行清单:
  │    │     派 Rule-Scan sub-agent(block 分片 nodeIds + 全部 rules/*.md)
  │    │     → 该 block 的 rule-hits.json (blocks/{sub}/rule-hits.json)
  │    └─ 聚合所有 rule-hits 到 主 agent 记忆 (不落全量文件,防止 sub-agent 读全量)
  │
  ├─ 【调整】步骤 4: 并行分发 UI sub-agent
  │    每个 sub-agent 输入 = block 分片 + 本 block 的 rule-hits.json
  │
  ├─ 【调整】步骤 5: sub-agent 独立实现 block
  │    ├─ Read block cache JSON
  │    ├─ Read 本 block rule-hits.json
  │    ├─ 生 JSX + SCSS
  │    ├─ 【新】跑 node bin/check-rules.mjs --block blocks/{sub}/ --cache-key <fileKey>
  │    │    exit 0 → 继续; exit 1 → 按 stdout 违规列表回滚重做
  │    ├─ 【新】assets.txt QA 段最后追加"rule-hits 消费证明"
  │    │    · 输入 rule-hits 条数: N
  │    │    · 处理到位条数: M
  │    │    · 遗漏补捕: [列 nodeId + rule id + "[遗漏补捕] R0X 因为..."]
  │    │    · check-rules.mjs 通过: ✅
  │    └─ 交付
  │
  ├─ 步骤 6: 主 agent 合并 (不变)
  │
  ├─ 【调整】步骤 6.0.2 合并忠实度证明块
  │    ├─ 原有条目保留 (§6.0.2 现有 6 个证明段)
  │    ├─ 【新】"rule-hits 聚合"段:
  │    │    · Rule-Scan 全部条数: N
  │    │    · UI sub-agent 处理条数: M (M >= N,包含补捕)
  │    │    · 遗漏补捕总数: K
  │    │    · 每个补捕的 assets.txt 备注是否合规: ✅/❌
  │    │    · check-rules.mjs 全部 sub-agent 都过: ✅/❌
  │    └─ 【新】"整 page 复跑 check-rules"段:
  │         主 agent 合并后再跑一次 check-rules.mjs --merge pages/{page}/ --cache-key <fileKey>
  │         防止合并时打散产物导致规则失效
  │
  └─ 步骤 7: 输出交付
```

### 3.3 数据流

**rule-hits.json 结构**:

```json
{
  "block": "sub-MAIN",
  "cache_key": "s7ILyhLgFeLlgM66vQ1RXG",
  "generated_at": "2026-08-11T00:00:00Z",
  "generated_by": "rule-scan-subagent",
  "hits": [
    {
      "rule": "R01",
      "rule_name": "fixed-position",
      "nodeId": "211:32",
      "name": "fixed-状态栏",
      "type": "GROUP",
      "trigger": "前缀是 fixed-",
      "expected": "css 含 position: fixed + 由 constraints 推断 top/bottom/left/right",
      "context": {
        "constraints": {"vertical": "TOP", "horizontal": "LEFT"},
        "bbox": {"x": 0, "y": 0, "width": 375, "height": 118}
      }
    },
    {
      "rule": "R04",
      "rule_name": "text-gradient",
      "nodeId": "211:411 > TEXT 子节点 211:91",
      "name": "2026",
      "type": "TEXT",
      "trigger": "TEXT 末位可见 fills 是 GRADIENT_LINEAR",
      "expected": "span 包裹 + background: linear-gradient(...) + background-clip: text + color: transparent",
      "context": {
        "fills_last_type": "GRADIENT_LINEAR",
        "fills_last_stops": [...],
        "fills_last_handles": [...]
      }
    }
  ]
}
```

---

## 4. 关键概念定义

### 4.1 Rule-Scan sub-agent

**职责**: 只做规则识别,不写 UI 代码。

**输入**:
- block 分片的 nodeIds (主 agent 步骤 2 生成的执行清单里的 sub- 前缀分块)
- cache JSON (从 `.d2c-cache/<fileKey>/nodes/` 读)
- 全部 `rules/*.md` 规则库

**输出**: `blocks/{sub}/rule-hits.json`

**特点**:
- **只识别,不实现**
- **每 block 一个独立 sub-agent** (block A 的 Rule-Scan 和 block B 的完全并行)
- **可以并行到主 agent 派 UI sub-agent 之前**
- **不读 SKILL.md 主流程,只读 rules/**

### 4.2 UI sub-agent

**职责**: 实现单个 block 的 JSX + SCSS (等价于现在 v0.3.21 的 sub-agent)。

**输入 (相对 v0.3.21 增强)**:
- block 分片 (不变)
- **本 block 的 rule-hits.json (新)**

**必须执行的动作**:
- Read rule-hits.json,按每条 hit 的 expected 落地
- 生完产物后**必须跑** `check-rules.mjs --block`,exit != 0 拒交付
- assets.txt 追加"rule-hits 消费证明"段

**补漏行为 (v0.3.22 新增)**:
- 生产物时如果发现某节点应命中某规则但 rule-hits 里没有 → **允许自补**
- 强制在 assets.txt 段末尾用如下格式记录:
  ```
  [遗漏补捕] R0X {nodeId} "{name}": Rule-Scan 未识别,自动补齐落地 = {做了什么}
  ```

### 4.3 硬规则总概表

放在 SKILL.md §4.3 顶部,单张表格 15 行左右:

```markdown
| ID | 规则名 | 一句话触发 | 违反后果 | 详情 |
|---|---|---|---|---|
| R01 | fixed-position | 前缀是 fixed- | agent 忽略视口固定定位,产物普通滚动 | [rules/R01.md] |
| R02 | fills-image | fills 含至少一层 type=IMAGE | agent 凭空搓 gradient 替代切图 | [rules/R02.md] |
| ... | ... | ... | ... | ... |
```

**目的**: 主 agent 每次 Read SKILL.md 时就能一眼扫完所有规则的"存在感",不用扫全文找规则。

### 4.4 rules/ 目录结构

```
templates/skills/pp-d2c/rules/
├── README.md                  (导航 + 每条规则一句话说明)
├── R01-fixed-position.md
├── R02-fills-image.md
├── R03-implicit-image.md
├── R04-text-gradient.md
├── R05-space-between.md
├── R06-text-solid-last.md
├── R07-multi-fills.md
├── R08-bg-landing-form.md
├── R09-btn-bgc-取值.md
├── R10-no-fake-solid-color.md
├── R11-mask-vector-css-able.md
├── R12-flat-mode-naming.md
├── R13-unit-scale.md
├── R14-fixed-z-index.md
└── R15-同构 map 渲染.md
```

**每条 md 结构** (统一模板):

```markdown
# R0X - <规则名>

## 触发条件
<描述在 Figma cache JSON 里怎么识别命中,给出精确 field path>

## 期望产物
<描述产物 JSX / SCSS / CSS 里必须体现什么>

## 反例 (agent 常见错法)
<从历史事故里拿真实的错误产物做对照>

## 落地代码模板
<给一段可以直接抄的 code snippet>

## 判定归属
- 硬防线 (check-rules.mjs 自动拦): 是/否
- 软防线 (Rule-Scan sub-agent 识别): 是/否

## 违反后果
<doctor 规则 ID + error/warn 级别>

## 相关
- SKILL.md 相关段落: §X.X
- 历史事故: <链接会话或产物路径>
```

### 4.5 check-rules.mjs

**输入**:
```bash
node bin/check-rules.mjs --block <blockDir> --cache-key <fileKey>
node bin/check-rules.mjs --merge <pageDir> --cache-key <fileKey>
```

**规则覆盖** (只覆盖 5 条能确定拦截的):

| 规则 | 判定方式 |
|---|---|
| R01 fixed-position | cache 扫 name.startsWith('fixed-') 或 layers.fixed 配置; grep 产物 CSS 含 `position: fixed` |
| R02 fills-image | cache 扫 fills[].type === 'IMAGE' && visible !== false; grep 产物 CSS 含 `url(` + `background` 且 nodeId 匹配 |
| R05 space-between | cache 扫 primaryAxisAlignItems === 'SPACE_BETWEEN'; grep 产物 CSS 含 `justify-content: space-between` |
| R06 text-solid-last | cache 扫 TEXT 节点 fills 末位可见 SOLID → HEX; grep 产物 CSS `color: #hex` |
| R08 bg-landing-form | 反向 grep: 产物不能含 `::before.*background`, `::after.*background`, `style={{background`, `<div className="[^"]*-bg"[^>]*></div>` |

**输出**:
```json
{
  "ok": false,
  "violations": [
    {
      "rule": "R01",
      "nodeId": "211:32",
      "name": "fixed-状态栏",
      "expected": "position: fixed",
      "actual": "position: relative",
      "file": "index.module.scss",
      "line": 20
    }
  ],
  "checked": 5,
  "passed": 4,
  "failed": 1
}
```

**exit code**:
- 0 = 全 pass
- 1 = 有 violations (agent 必须回滚重做)
- 2 = 环境错误 (cache 找不到 / 产物文件不存在)

### 4.6 Rule ID 命名

- `R01` 起编号,当前 15 条,预留到 R99
- 一旦分配不再重用 (删规则用 deprecated 标签,不复用编号)
- rules/ 目录文件名 `R{XX}-{slug}.md`,slug 用短横线小写

---

## 5. 边界和异常

### 5.1 Rule-Scan sub-agent 输出为空

**场景**: block 里没有任何规则命中(例:整块只有 SOLID fill 的纯色 FRAME + TEXT)。

**处理**: rule-hits.json 输出 `{ "hits": [] }`。UI sub-agent 正常干活,不因空数组失败。

### 5.2 Rule-Scan sub-agent 挂了

**场景**: sub-agent 因超时/API 错误未产出 rule-hits.json。

**处理**: 主 agent 重派一次;二次失败 → **降级** 到 v0.3.21 流程(不用 rule-hits,UI sub-agent 直接读 rules/*.md 全部规则库)。主 agent 在最终交付里加 QA 告警"本次 Rule-Scan 降级,规则识别可能有遗漏,请人工核对"。

### 5.3 UI sub-agent 补捕但没备注

**场景**: check-rules.mjs 只覆盖 5 条,如果 UI sub-agent 处理 R09 时补了 rule-hits 遗漏但忘写 `[遗漏补捕]` 备注。

**处理**: 主 agent §6.0.2 会 diff `rule-hits 里的 nodeId 集合` 和 `产物实际处理的 nodeId 集合`,如果产物处理量 > rule-hits 声明量且 assets.txt 里没有 `[遗漏补捕]` → doctor SUB031 warn (v0.3.22 新增)。**不阻塞交付** (视为规则更精确,只是提醒),但会记录。

### 5.4 check-rules.mjs 误判 (假阳性)

**场景**: 脚本因 grep 边界 case 判错,把合规产物标为违规。

**处理**: agent 可以用 `--force-skip R0X` 参数跳过某条规则,但必须在 assets.txt 里写 `[脚本误判] R0X {nodeId} 理由: ...`。主 agent 合并时会验证有无 `--force-skip` 使用记录。

### 5.5 Rule-Scan 识别错 (假阳性/假阴性)

**场景 A - 假阳性**: Rule-Scan 说 R04 命中,但实际那节点 fills 末位是 SOLID 不是 GRADIENT。

**处理**: UI sub-agent 有权 Read cache JSON 交叉验证,如果发现 rule-hits 错了,在 assets.txt 写 `[Rule-Scan 误判] R0X {nodeId} 实际情况...`,不按 rule-hits 处理。主 agent §6.0.2 统计误判率。

**场景 B - 假阴性**: 走 §5.3 逻辑 (UI sub-agent 补捕)。

### 5.6 rules/*.md 内部矛盾

**场景**: 两条规则对同一节点给出矛盾期望(例: R09 说"btn 内 bgc 走 CSS",但节点 fills 又含 IMAGE 触发 R02 切图)。

**处理**: **规则库设计原则** —— 每条规则明确"排斥条件"。R02 fills-image 排斥 R09 (fills 含 IMAGE 时 btn 的 bgc 规则失效)。矛盾属于 skill 设计 bug,应该在 rules/*.md 顶部段落声明。

### 5.7 skill 里的老规则和 rules/ 里的新版不一致

**场景**: 本轮不删 SKILL.md 里散落的规则文本,如果和 rules/R0X.md 有出入。

**处理**: **rules/R0X.md 为准**。SKILL.md 内每处相关段落加 `→ 详见 rules/R0X.md`,agent 遇到不一致以 rules/ 为准。**后续演进** (v0.3.23+) 可以逐步从 SKILL.md 里删掉冗余,但本轮不删。

---

## 6. 验收标准

### 6.1 硬指标

1. **rules/ 目录建立** —— 至少 15 个 R0X.md 文件,每个文件包含 §4.4 里的 6 个段落
2. **check-rules.mjs 可运行** —— 5 条硬规则全部覆盖,针对下面 3 个已知事故案例:
   - test1 topbar 缺 fixed → 输出 R01 violation
   - test1 cdBlock 缺 IMAGE 切图 → 输出 R02 violation
   - test1 立即预约字色 = #fff 而非 #864500 → 输出 R06 violation
   
   3 个 case 全命中,一个不命中都算脚本不合格。
3. **SKILL.md 版本号 v0.3.21 → v0.3.22**,§4.3 顶部有硬规则总概表
4. **§步骤 3.5 (Rule-Scan 派发) 段落存在**,§步骤 4 输入含 rule-hits.json,§步骤 5 产物含 check-rules 步骤,§6.0.2 含新的两个证明段
5. **downstream 同步** —— `figma-plugin-test-function/.claude/skills/pp-d2c/` 更新到 v0.3.22

### 6.2 软指标

- 重跑 test1/test8/test2 三张事故稿,7 起历史事故里 **至少 5 起** 在 sub-agent 交付前被拦截 (check-rules 硬拦或 Rule-Scan 标记 rule-hits)
- SKILL.md 总行数不显著增加 (估计从 2040 → 2200 左右,+8%,可接受)

### 6.3 反指标 (不达成的表现)

- rules/ 里的规则含糊 (触发条件描述不能被脚本或 LLM 精确识别) → 不合格
- check-rules.mjs 假阳性率 > 5% (10 次跑里超过 1 次误报) → 不合格
- Rule-Scan sub-agent 平均耗时 > 30 秒/block → 优化前不合格

---

## 7. 开放问题

**已闭环** (澄清对话中确认):

- ✅ 架构 = Rule-Scan sub-agent + 5 条脚本硬拦 (混合防线)
- ✅ Rule-Scan 时机 = 分 block 并行扫
- ✅ 遗漏处置 = UI sub-agent 允许自补 + 强制 assets.txt 备注
- ✅ 规则库拆法 = rules/*.md 平铺目录 (不分子目录),每条一文件
- ✅ SKILL.md 处置 = 保留总概表,详情拆到 rules/

**未闭环** (进入技术方案时决定,不阻塞本次澄清):

1. **rules/*.md 的具体文案怎么写** —— 需要在 f2s-req-tech 阶段针对每条规则精确定义"触发条件"到能被脚本或 LLM 无歧义识别的程度
2. **check-rules.mjs 内部 5 条规则的 grep pattern 精确写法** —— 需要在实现阶段基于真实产物字符串定
3. **Rule-Scan sub-agent 的 prompt 模板** —— 需要在实现阶段基于实测调
4. **降级路径 (§5.2) 的具体实现** —— Rule-Scan 挂了后 UI sub-agent 是"读全部 rules/"还是"回到 v0.3.21 只读 SKILL.md",技术方案定
5. **rule-hits.json 是否需要 schema 校验** —— 现在方案是文档描述,是否要写 JSON Schema 让 sub-agent 输出自校验

---

## 8. 相关

- **前置**: v0.3.19 (三条硬规则) / v0.3.20 (四条硬规则 + sub-agent 自证) / v0.3.21 (TEXT GRADIENT 落地)
- **historically 相关**: `.Knowledge/req-docs/pp-d2c-skill.md` (skill 起源) / `.Knowledge/req-docs/pp-d2c-skill_技术方案.md` (旧版技术方案)
- **task**: `.task/550947002/active/pp_d2c_rule_scan_split/`

---
