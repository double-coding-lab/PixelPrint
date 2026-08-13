# pp-d2c 规则库

> pp-d2c skill 硬性规则的原始定义。当 rules/*.md 内容与 SKILL.md 冲突时以 rules/ 为准。

## 内置前缀常量表(硬编码,不可配置)

Figma 图层名前缀是**内置常量**,写死在 skill 里,不再从 config 读取。所有规则(SKILL / rules/ / check-rules.mjs / Rule-Scan sub-agent / UI sub-agent)一律用下表值:

| 前缀 | 语义 |
|---|---|
| `sub-` | 分块边界(sub-agent 派发单元) |
| `block-` | 独立布局块(命名空间隔离) |
| `img-` | 图片内容(生成 `<img>`,不递归) |
| `bg-` | 背景图(挂父容器 background-image,自身不生成 DOM) |
| `bgc-` | 背景纯色(全套盒级 CSS 写父,自身不生成 DOM) |
| `btn-` | 可点击区域(永远 CSS 化) |
| `scrollx-` | 横向滚动容器 |
| `scrolly-` | 纵向滚动容器 |
| `fixed-` | 视口固定定位(修饰前缀) |
| `end-` | 逆向布局(贴父末端,修饰前缀) |
| `input-` | 输入框(生成 `<input type="text">`,不递归) |
| `x-` | 忽略(跳过整层,优先级最高) |

**pp-d2c.config.json 里不再有 `layers` 段**——之前的 `layers.sub` / `layers.bg` / `layers.but` 等映射都已删除。

## 索引表

| ID | 名称 | 判定归属 | 一句话触发条件 |
|---|---|---|---|
| R01 | fixed-position | 硬防线 | `name.startsWith('fixed-')` |
| R02 | fills-image | 硬防线 | `fills[].some(f => f.type === 'IMAGE' && f.visible !== false)` |
| R03 | implicit-image | 硬防线(v1.2.3) | 无前缀 + 整棵子树 VECTOR/BOOL/几何 + 无 TEXT/INSTANCE + 无 btn-/input-/sub-/block- 子层 |
| R04 | text-gradient | 硬防线(v1.2.3) | `TEXT` 节点,fills 末位可见 = `GRADIENT_*` 或 `IMAGE` |
| R05 | space-between | 硬防线 | `primaryAxisAlignItems === 'SPACE_BETWEEN'` |
| R06 | text-solid-last | 硬防线 | `TEXT` 节点,fills 末位可见 = `SOLID` |
| R07 | multi-fills | 软防线 | fills 数组多层可见(≥2),且不全是 SOLID |
| R08 | bg-landing-form | 硬防线 | `name.startsWith('bg-')` 或 `name === 'bg'`,产物落地形态错 |
| R09 | btn-bgc-取值 | 硬防线(v1.2.3) | `btn-` 前缀内含 `bgc-` 子层,bgc 的真 fills 是 GRADIENT/IMAGE |
| R10 | no-fake-solid-color | 软防线 | 产物 CSS 出现 `color: #XXX`,但 cache 里对应节点找不到源头 |
| R11 | mask-vector-css-able | 软防线 | 复合 mask / 多层 vector,CSS 表达不了 → 应切图 |
| R12 | flat-mode-naming | 硬防线(v1.2.3) | `merge.mode === 'flat'` 下类名跨 block 冲突 |
| R13 | unit-scale | 软防线 | Figma px → 产物 px 未换算(应 `outputBase / figmaBase`) |
| R14 | fixed-z-index | 硬防线(v1.2.3) | 多个 `fixed-` 节点,z-index 未递增 |
| R15 | 同构 map 渲染 | 软防线 | 同层 ≥3 同构子节点,展开成重复代码而非 `.map()` |
| R16 | no-flatten-text | 硬防线 | GROUP/FRAME/COMPONENT/INSTANCE 子树含 TEXT 且前缀非 `img-`/`bg-`,产物 jsx 出现 `<img data-node-id="该节点">` |
| R17 | no-baked-dom | 硬防线 | 节点 `_inBakedSubtree`(处于 bg-/bgc-/img-/x- 整体切图子树内),产物却有其 `data-node-id`(双重渲染) |
| R18 | flex-direction | 硬防线 | autolayout 容器 `layoutMode` 与产物 `flex-direction` 不符(VERTICAL 却非 column / HORIZONTAL 却 column) |
| R19 | padding | 硬防线 | autolayout 容器 padding 与 `Figma paddingT/R/B/L × scale` 不符(凭空加 / 漏写 / 数值错) |
| R20 | absolute-position | 硬防线 | `layoutPositioning === 'ABSOLUTE'`(非 fixed-),top/left ≠ (子bbox−父bbox)×scale |
| R21 | node-id-coverage | 硬防线 | 应渲染节点(TEXT/autolayout 容器/ABSOLUTE/img-·btn-·input-)在产物 JSX 里找不到 data-node-id |

## 判定归属说明

**硬防线** (`check-rules.mjs` 自动拦截): 用代码 grep + JSON scan 精确判定,exit 1 拦截 → R01 / R02 / R03 / R04 / R05 / R06 / R08 / R09 / R12 / R14 / R16 / R17 / R18 / R19 / R20 / R21。

**软防线** (Rule-Scan sub-agent 识别): 需 LLM 语义判断,输出 `rule-hits.json` 给 UI sub-agent 参考 → R07 / R10 / R11 / R13 / R15。（v1.2.3 起 R03/R04/R09/R12/R14 迁入硬防线）

**v1.2.0 对账基座**: R02 / R06 / R17 / R18 / R19 / R20 依赖 `bin/lib/loadCache.mjs` 标注的 `_inBakedSubtree`(整体切图子树)/`_hidden`(隐藏)/`_templateDup`(`.map()` 数据副本),以及 `bin/lib/cssMatch.mjs` 的 SCSS `&__foo` 嵌套匹配。这些标注把"整体切图子树 / 隐藏 / 列表副本 / 嵌套写法"四类假阳性从根源清除,使硬防线报数即真值,校验从"黑名单抽查"升级为"以 cache 为真值逐节点对账"。

## 使用方式

### Rule-Scan sub-agent

**派发时机**: 每个 `sub-` block 出码前各派一次;**页面无 sub- 时(v1.2.2)对整页派一次**——页面根视为虚拟 block,`rule-hits.json` 落页面根目录(与页面 `assets.txt` 同级)。软防线覆盖不依赖设计师是否标了 sub-。

派发时的完整 prompt:

```
你是 Rule-Scan sub-agent, 只做规则识别, 不写 UI 代码.

任务:
1. Read templates/skills/pp-d2c/rules/*.md 中软防线 5 条(R07/R10/R11/R13/R15);硬防线 16 条由 check-rules 兜底,可选读作生成指引
2. Read .d2c-cache/<cache-key>/nodes/ 下与本 block nodeIds 相关的 JSON
3. 对本 block 的每个节点, 判断命中了哪些规则
4. 输出 rule-hits.json (schema 见附)

规则命中判定原则:
- 硬防线规则 (R01/R02/R03/R04/R05/R06/R08/R09/R12/R14/R16/R17/R18/R19/R20/R21): check-rules.mjs 兜底,可选扫作指引
- 软防线规则 (R07/R10/R11/R13/R15): 你是唯一识别方
- 排斥条件: 若节点命中高优先级规则, 低优先级规则不再重复列
- 优先级 (由高到低): R21 > R16 > R17 > R02 > R01 > R05 > R11 > R03 > R04 > R07 > R06 > R09 > R08 > R20 > R18 > R19 > R14 > R15 > R13 > R12 > R10（R21 最高:节点不可追溯则其余绑定类规则无从谈起）

输出要求:
- 每个 hit 包含 nodeId / rule / trigger 描述 / expected 描述 / context (关键 JSON 字段抽样)
- 输出 JSON, 不带 markdown 代码块围栏, 不加解释文字
- 落盘到 blocks/{sub}/rule-hits.json

禁止:
- 不允许写 JSX / SCSS
- 不允许改 cache 文件
- 不允许基于"设计意图猜测"命中规则; 只按 rules/*.md "触发条件" 字面判定
```

### UI sub-agent

- Read `blocks/{sub}/rule-hits.json` 里涉及的 R0X.md,按"期望产物"落地
- 生完 JSX + SCSS 后跑:
  ```bash
  node .claude/skills/pp-d2c/bin/check-rules.mjs \
    --block blocks/{sub}/ \
    --cache-key <fileKey>
  ```
- exit 0 继续 / exit 1 按 violations 回滚重做 / exit 2 报环境错
- `assets.txt` 追加"rule-hits 消费证明"块(格式见下)

**rule-hits 消费证明格式**:

```
## rule-hits 消费证明 (v1.0.0)

- 输入 rule-hits 条数: N
- 处理到位条数: M (M == N 时 ✅)
- 处理列表:
  - { nodeId, rule: "R0X", 落地类型: "css 属性" | "span 包裹" | "切图挂父" | ... }
- 遗漏补捕: K 条
  - [遗漏补捕] R0X {nodeId} "{name}": Rule-Scan 未识别, 自动补齐落地 = {做了什么}
- check-rules.mjs 通过: ✅ / ❌ + violations 列表
```

### check-rules.mjs

- **硬编码 R01/R02/R03/R04/R05/R06/R08/R09/R12/R14/R16/R17/R18/R19/R20/R21 逻辑**,rules/*.md 是设计文档,不是执行文档
- 假阳性时用 `--force-skip R0X,R0Y` 跳过,但 UI sub-agent 必须在 `assets.txt` 备注 `[脚本误判] R0X {nodeId} 理由: ...`
- 详细 CLI 见 `templates/skills/pp-d2c/bin/check-rules.mjs --help`

## 排斥关系图

```
R02 (fills-image) ─┬─► R11 (mask-vector-css-able): 已切图不再判 CSS-able
                   └─► R09 (btn-bgc): btn 内 fills IMAGE 走 R09 优先

R01 (fixed-position) ── R14 (fixed-z-index): 多个 fixed 才判 R14

R06 (text-solid-last) ─┬─► R04 (text-gradient): 末位是 GRADIENT/IMAGE 归 R04
                       └─► R10 (no-fake-solid-color): R06 命中即已核对色源

R05 (space-between) ── (无排斥)

R08 (bg-landing-form) ── (无排斥,反向匹配所以自成一体)

R03 (implicit-image) ── R11 (mask-vector-css-able): R03 覆盖后者的常见形态
R12 (flat-mode-naming) ── (无排斥,只影响 merge.mode='flat')
R13 (unit-scale) ── (无排斥,单位)
R15 (同构 map) ── (无排斥,结构)

R16 (no-flatten-text) ── 最高优先级; 命中 R16 时 R02/R06 若源自同一"整体切图"违规则视为衍生, 不重复报

R17 (no-baked-dom) ── 与 R16 配套(压平 vs 拆两面); R02/R06 跳过 _inBakedSubtree 节点(不报"缺 url/color"), "禁 DOM" 交 R17 正向兜底
R18 (flex-direction) ─┬─ 与 R19 成对(autolayout 容器忠实度); 靠 data-node-id 绑定, 模板项挂代表项 id
R19 (padding) ────────┘
R20 (absolute-position) ── 排斥 fixed-(那走 R01/constraints); 只管非 fixed 的 layoutPositioning:ABSOLUTE
R21 (node-id-coverage) ── 最高优先级; 节点无 data-node-id 则 R06/R18/R19/R20 全绑定不上, 先补 id 再谈其余; 排斥 baked/hidden/templateDup 与 bg-/bgc-/x-(不生成独立 DOM)
```

## 版本

- **v1.2.3** 软→硬迁移:R03/R04/R09/R12/R14 从软防线下沉 check-rules 硬防线(机械可判、逐节点对账,不依赖 sub- 触发,exit 1 阻断);软防线剩 R07/R10/R11/R13/R15(需 LLM 语义);新硬规则一律保守(宁漏报不误判,边界 skip)
- **v1.2.2** Rule-Scan 触发与 sub- 解耦:执行清单 sub- block 数为 0 时,主 agent 出码前对整页跑一次 Rule-Scan(页面根为虚拟 block,`rule-hits.json` 落页面根目录);修复无 sub- 页面软规则 R03/R04/R07/R09-R15 完全不触发的覆盖空档
- **v1.2.1** `_inBakedSubtree` 移除 bgc-(bgc- 盒级 CSS 写父、非切图,子孙误放 TEXT 应被 R06/R21 暴露而非静默吞); 新增 **R21 node-id-coverage**(应渲染节点漏挂 data-node-id 即 exit 1,机械强制 §5.1.1 铁律,堵 R18/R19/R20 遇空 classMap 静默 continue 的逃逸); §6.0.2 禁生成流程用 `--force-skip`
- **v1.2.0** 校验范式从"黑名单抽查"→"以 cache 为真值逐节点对账": loadCache 标注 `_inBakedSubtree`/`_hidden`/`_templateDup` + cssMatch 共享 SCSS 嵌套匹配(R02/R06 假阳性根源清除); 新增 R17 no-baked-dom / R18 flex-direction / R19 padding / R20 absolute-position 四条对账规则
- v1.1.0 新增 R16 no-flatten-text 硬防线
- v1.0.0 首次引入 rules/ 目录 + check-rules.mjs
- v0.3.21 之前:硬规则文字散落在 SKILL.md §4.3 等章节

## 相关

- `templates/skills/pp-d2c/SKILL.md` — 主流程
- `templates/skills/pp-d2c/bin/check-rules.mjs` — 硬防线脚本
- `.Knowledge/req-docs/pp-d2c-rule-scan_技术方案.md` — 本轮技术方案
- `.Knowledge/req-docs/pp-d2c-rule-scan_需求澄清.md` — 需求澄清
