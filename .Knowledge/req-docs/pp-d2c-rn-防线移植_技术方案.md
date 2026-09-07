# pp-d2c-rn 机械防线移植 技术方案

> 目标:把 h5 `pp-d2c` v1.2.5 的机械防线体系(规则文档 + check-rules 硬防线 + loadCache 对账基座)全量移植到 `pp-d2c-rn`,适配 RN StyleSheet 输出层。
> 输入:`templates/skills/pp-d2c/`(v1.2.5,一字不改)、`templates/skills/pp-d2c-rn/`(v0.3.13,移植目标)。
> 本文档供后续实现使用;实施前须逐节核对「待确认」项。

## 需求概述

- **背景**:pp-d2c-rn 现为 v0.3.13,仅 `SKILL.md + bin/figma.mjs`,全部规则靠 SKILL.md 文本约束 + grep 自证。h5 侧 v1.2.x 演进出的机械防线(17 条 exit-1 硬规则、R22 warning、4 道门禁、以 cache 为真值的逐节点对账)从未移植——文本约束拦不住的逃逸方式(test24-29 系列取证)在 RN 侧完全敞开。
- **目标**:pp-d2c-rn 获得与 h5 同代的防线:`rules/` 规则文档库(RN 语义)、`bin/check-rules.mjs` 硬防线、`bin/lib/` 对账基座(样式匹配引擎按 StyleSheet 重写),SKILL.md 升级到防线代对齐版本。
- **范围**:`templates/skills/pp-d2c-rn/` 目录内新增/改写;`test/rules-rn/` 回归测试;`.Knowledge` 同步(topic 更新)。
- **明确不做**:
  - h5 `templates/skills/pp-d2c/` 与 `pp-d2c-fast/` 一字不改;
  - doctor 卫星接入(rn 不接 doctor 的既有决策保持);
  - Rule-Scan 软防线 5 条(R07/R10/R11/R13/R15)的判定逻辑代码化(保持 LLM 语义判定,仅改写规则文档);
  - adapter 机制本身的改动(只让 check-rules 感知 adapter 映射后的标签名)。
- **保留 RN 独享资产**:v0.3.12 styles.ts 强制独立文件、v0.3.13 顺流子位置来源硬约束、ScrollView 强制骨架、fixed-* 铁律、RN 特性退化表、adapter §5.5——全部保留,其中可机械判定的部分**升格为 RN 特有硬规则**(见 RN01-RN04)。

## 重点问题概述

1. **样式匹配引擎是移植的核心难点**:h5 的 `cssMatch.mjs` 全部逻辑围绕 CSS/SCSS 文本(`.class {}` / `&__foo` 嵌套),RN 产物是 `styles.ts` 里的 JS 对象字面量,匹配引擎必须重写而非改写。
2. **R18 方向语义在 RN 反转**:web flex 默认 `row`,RN 默认 `column`——判定条件必须镜像,直接复制 h5 逻辑会全量误判。
3. **gradient 类规则(R04/R09)在 RN 无对应 CSS 能力**:按既有退化表重定义校验目标,校验强度降为"退化正确性"。
4. **解析深度取舍**:styles.ts 用轻量词法解析(正则 + 括号平衡)而非 AST——遇 `Platform.select` / 三元表达式等动态值时该 key 保守跳过,沿用 h5"宁漏报不误判"哲学。
5. **规则编号命名空间**:RN 特有硬规则用 `RN01-RN04` 前缀,与 h5 未来可能新增的 R24+ 隔离,避免撞号。

## 交付单元

### 一、对账基座 `bin/lib/`(pp-d2c-rn/bin/lib/)

#### 1.1 `loadCache.mjs` — 直接复制

**决策:与 h5 逐字节同步复制,零改动。** 理由:三标注(`_inBakedSubtree` / `_hidden` / `_templateDup`)、`inferBlockRoot`(LCA 推断)、`pruneToSubtree`(子树裁剪)、`findCacheTruncation`(截断检测)全部作用于 Figma cache JSON 侧,与产物样式形态零耦合。`NO_RENDER_PREFIXES = ['bg-', 'img-', 'x-']` 的前缀语义在 RN 侧完全一致(bg- 在 RN 是独立 Image 层,但其子孙"像素烤进 PNG、不出独立组件"的语义不变)。

维护约定:参照 `test/rules/run-all.mjs` 中 fast 与主本的先例("逐字节同步,测主本即覆盖"),`loadCache.mjs` 在 rn 侧声明为 h5 主本的同步副本,h5 上游修复须同步搬运;文件头加注释标明同步来源。

**唯一适配点**:`findProjectRoot` 查找 `pp-d2c.config.json` 的逻辑不变(rn 项目同名 config)。

#### 1.2 `styleMatch.mjs` — 新写(替代 cssMatch.mjs)

**职责**:从 `styles.ts` 文本中按 styleKey 提取样式规则体,供各规则做属性断言与数值对账。RN 产物锚定形态(SKILL v0.3.12 已强制):

- 样式一律在独立 `styles.ts`(或 `styles.js`),形如 `const styles = StyleSheet.create({ key1: {...}, key2: {...} })`;
- JSX 侧绑定 `style={styles.key}` 或 `style={[styles.a, styles.b]}` 或 `style={[styles.a, dynamicX]}`。

**解析策略(轻量词法,排他性选择:不用 AST)**:

1. 定位 `StyleSheet.create(` 后的对象字面量,用**括号/花括号平衡计数**切出顶层 `key: { ... }` 对(与 h5 cssMatch"按最近闭合截取规则体"同深度的取舍;h5 已验证该深度对 D2C 产物叶子规则够用);
2. 规则体内属性形如 `propName: value`,value 支持四种形态:纯数字 / `rpx(数字)` / 字符串字面量 / 其他表达式;
3. **数值还原**:`rpx(16)` 剥壳取 `16`,纯数字直接取;`Platform.select({...})`、三元、变量引用 → 该属性标 `unparseable`,数值类规则(R19/R20/R23)对该属性保守跳过并记 warning;
4. 导出接口与 cssMatch 同形,规则层迁移成本最小化:
   - `collectRuleBodies(styleText, styleKey)` → `[{ body, line }]`(body 为该 key 的对象体文本);
   - `findProperty(styleFiles, keys, propRe)` → `{ hit, rel, line, body }`;
   - `firstRuleBody(styleFiles, keys)`;
   - 新增 `getNumeric(body, propName)` → `{ value, viaRpx } | null`(统一 rpx 剥壳,供 R19/R20/R23 复用,替代 h5 各规则自带的 `extractPadding`/`extractPos`/`lastPx` 中的 px 后缀解析)。

**rpx 与对账基准的换算口径**:R19/R20/R23 的期望值统一为 `Figma 原值 × config.unit.scale`(与 h5 同公式);产物侧 `rpx(x)` 剥壳后的 `x` 与期望值同域直接比较。前提是 rn 项目 config 的 `unit.scale` 与 `rpx()` 参数口径一致(SKILL §4.1.1 骨架示例 `width: rpx(<figmaW>)` 显示 rpx 参数即 Figma 原值,对应 `unit.scale = 1`)。**待与项目约定确认**:rn 模板 config(`templates/pp-d2c.rn.config.json`)中 `unit.scale` 的默认值;若存在 scale ≠ 1 且 rpx 参数仍为 Figma 原值的组合,须在 check-rules 启动时读 `unit.responsive.enabled` 决定期望值公式(`enabled=true` → 期望 = Figma 原值;`false` → 期望 = Figma × scale)。

**容差沿用 h5**:R19 padding 容差 2、R20 坐标容差 4、R23 尺寸容差 4(单位为剥壳后的同域数值)。

#### 1.3 `nodeIdToStyleKey.mjs` — 改写(替代 nodeIdToClassName.mjs)

扫描 JSX 中 `data-node-id="X:Y"` 与同标签的 `style={...}` 绑定,建立 `nodeId → [styleKey, ...]`:

- `style={styles.foo}` → `['foo']`;
- `style={[styles.a, styles.b]}` → `['a', 'b']`(数组内 `styles.X` 全收,非 `styles.` 成员忽略);
- 标签匹配复用 h5 的 `<Tag ...attrs>` 正则骨架(标签名从 `[A-Za-z][A-Za-z0-9-]*` 放宽到含大写组件名,现骨架已覆盖)。

**data-node-id 在 RN 产物中的挂载形态**:方案采用与 h5 相同的 `data-node-id` 字面 prop(RN 运行时忽略未知 prop,上线前 `pp-strip-nodeid` 统一剥离——与 h5 生命周期一致)。**待与项目约定确认**:现有 rn SKILL v0.3.13 产物是否已统一挂 `data-node-id`;若既有产物用 `testID`,引擎按 `data-node-id` 优先、`testID` 兜底双识别。

#### 1.4 `loadProduct.mjs` — 小改

- `JSX_EXTS` 不变(`.jsx` / `.tsx`);
- 样式文件识别从后缀名(`.scss` 等)改为**双条件**:文件名匹配 `styles.ts|styles.js|*.styles.ts` 且内容含 `StyleSheet.create`(避免把业务 `.ts` 误收为样式文件);
- 返回结构 `{ jsx, style }` 字段名不变,规则层无感。

#### 1.5 `report.mjs` — 直接复制

纯报告聚合与 JSON 输出,零耦合,逐字节复制。

### 二、硬防线 `bin/check-rules.mjs`(pp-d2c-rn/bin/)

**聚合器骨架直接复制 h5**,以下四处适配:

1. import 路径换 `styleMatch` / `nodeIdToStyleKey`;
2. `ALL_RULES` 换 RN 规则清单(17 条移植 + RN01-RN04,见适配表);
3. `checkImageReconciliation` 的引用提取正则**基本复用**(现有 `refRe` 按图片文件名匹配,与引用语法无关;动态拼接尾部匹配的保守逻辑照搬),补充说明性注释:RN 侧引用形态覆盖 `require('...png')` / `source={{uri: '...'}}` / `<ImageBackground source>` / `<FastImage source>` / `` `${ASSET_PREFIX}xxx.png` ``——五种形态的文件名都会被现有正则捕获;
4. `--block` / `--merge` / `--root` / `--force-skip` CLI 契约、exit code(0/1/2)、GATE 执行顺序(cache-truncation → rule-hits → 规则循环 → merge 时 IMG-reconcile)全部不变。

**四道门禁移植结论**:

| 门禁 | 移植方式 | 说明 |
|---|---|---|
| GATE-cache-truncation | 直接复用 | 纯 cache 侧,零样式耦合 |
| GATE-rule-hits | 直接复用 | 纯文件系统判定(rule-hits.json 存在性 + fallback 占位与 assets.txt `[Rule-Scan 降级]` 互证),与产物形态无关 |
| IMG-reconcile | 复用 + 注释适配 | 文件名正则通用,五种 RN 引用形态天然覆盖(见上) |
| GATE-slice-confirm | 直接复用 | 判 manifest `confirmed` 字段,与端无关 |

### 三、规则移植适配表(R01-R23 + RN 特有)

改动量图例:**复用** = 逐字节复制;**改写** = 判定逻辑保留、匹配层换 styleMatch/camelCase;**语义变更** = 触发或期望在 RN 侧重定义;**不适用** = RN 侧无此形态。

| 规则 | RN 侧触发条件(cache 侧不变处从略) | RN 侧校验对象 | 改动量 |
|---|---|---|---|
| R01 fixed-position | `name.startsWith('fixed-')` | ① style 含 `position: 'absolute'`;② 含 `zIndex` ≥ 100;③ 该元素**位于根 View 直接子层**(文本级判定:其 data-node-id 不出现在 ScrollView 开闭标签区间内;判不了时降 warning) | 语义变更(RN 无 position:fixed,按 fixed-* 铁律重定义) |
| R02 fills-image | fills 含可见 IMAGE | assets.txt 有记录 且 产物引用该图(JSX 侧 require/uri/ImageBackground/FastImage/文件名字符串;RN 无 background-image url 分支) | 改写 |
| R03 implicit-image | 同 h5(≥3 真矢量路径,极保守) | 切图记录 + 产物引用(同 R02 引用判定) | 改写(小) |
| R04 text-gradient | TEXT 末位可见 fill 为 GRADIENT_*/IMAGE | 按退化表:产物 Text `color` 必须等于**渐变首 stop 色值**(hex 比对,容差无——色值机械可算);且 QA 段有该 nodeId 的退化 warn 记录。产物写了首 stop 之外的臆造纯色 → violation | 语义变更(RN 无 background-clip:text,校验目标改为"退化正确性") |
| R05 space-between | `primaryAxisAlignItems === 'SPACE_BETWEEN'` | `justifyContent: 'space-between'`;margin-auto 模拟法在 RN 无效,发现 `marginLeft/Top: 'auto'` 报 warning | 改写 |
| R06 text-solid-last | TEXT 末位可见 fill 为 SOLID | `color: '#hex'`(字符串字面量;数字色 0x 形态一并识别) | 改写 |
| R07 multi-fills | 软防线 | 规则文档改写:RN 多层填充需拆层(底层 View backgroundColor + 上层 Image/LinearGradient 叠放) | 文档改写 |
| R08 bg-landing-form | `bg-` 前缀(含裸词) | RN 落地形态:独立 `<Image>` 挂父容器内头部、`position:'absolute'` + `top:0, left:0` + **Figma 事实固定尺寸**;禁止形态:`<ImageBackground>` 包裹内容之外的用法臆造、`absoluteFillObject`、`width/height: '100%'`(百分比塌陷) | 语义变更(bg- 在 RN 是独立 Image 层契约) |
| R09 btn-bgc | btn- 子树含 bgc- 且末位 fill 为 GRADIENT_* | 二选一合法:① 产物引用 `LinearGradient` 组件(import 存在 + 该节点区间出现);② 按退化表落首 stop 纯色 `backgroundColor` 且 QA 有退化 warn 记录。两者皆无 → violation | 语义变更 |
| R10 no-fake-solid-color | 软防线 | 文档改写(色值溯源逻辑同 h5,匹配对象为 styles.ts) | 文档改写 |
| R11 mask-vector-css-able | 软防线 | 文档改写(RN 可表达集更小:无 clip-path/mask,判"该切图"的门槛更低) | 文档改写 |
| R12 flat-mode-naming | `merge.mode === 'flat'` | 同一 styles 命名空间下 **StyleSheet.create key 重复定义 ≥2 次**(跨文件合并后 JS 对象后键覆盖前键,危害同 CSS 覆盖) | 改写 |
| R13 unit-scale | 软防线 | 文档改写:校验目标改为「rpx 包装白名单属性是否漏包 / 数值是否未按口径换算」 | 文档改写 |
| R14 fixed-z-index | ≥2 个 fixed- 节点 | `zIndex` 数字属性,判"全缺"或"全同"(保守口径不变) | 改写 |
| R15 同构 map 渲染 | 软防线 | 文档改写(`.map()` 判定与 h5 一致) | 文档改写 |
| R16 no-flatten-text | 容器子树含 TEXT 且前缀非 img-/bg- 白名单 | 产物出现 `<Image|ImageBackground|FastImage|<tagMap映射后的Image标签> data-node-id="该节点">` → violation(标签集合运行时并入 `config.adapter.tagMap.Image` 的映射值) | 改写(标签集合适配 + adapter 感知) |
| R17 no-baked-dom | `_inBakedSubtree` | 产物不得出现其 data-node-id | **复用**(纯 id 判定,零样式耦合) |
| R18 flex-direction | autolayout 容器 | **判定镜像**(RN flex 默认 column):VERTICAL → `flexDirection` 省略或 `'column'` 均合法;HORIZONTAL → **必须显式 `flexDirection: 'row'`**,缺失或写 column 均 violation。前置条件从"规则体含 display:flex"改为"该节点有 style 绑定"(RN 全员 flex,无 display 门槛) | 语义变更(方向默认值反转) |
| R19 padding | autolayout 容器 padding | `paddingTop/Right/Bottom/Left` camelCase 四属性(RN SKILL 强制四边独立写,无 shorthand 分支——解析比 h5 简化);数值经 `getNumeric` 剥 rpx;期望 = Figma × 口径系数,容差 2 | 改写 |
| R20 absolute-position | `layoutPositioning === 'ABSOLUTE'`(非 fixed-) | `position: 'absolute'` 声明强制 + `top/left` ≈ (子 bbox − 父 bbox) × 口径系数,容差 4;RN 无 inset 简写,该分支删除 | 改写 |
| R21 node-id-coverage | 应渲染节点(判定字段同 h5) | 正向"应挂尽挂" + v1.2.5 反向对账(产物 id ∉ cache = 幻觉 id) | **复用**(正则与 cache 判定零样式耦合) |
| R22 empty-visual-btn | btn- 节点(warning 级) | "无视觉"判定改为:style 无 `backgroundColor`/`borderWidth`/渐变组件、JSX 该节点区间无 `<Image>`、子树无可见 TEXT | 改写 |
| R23 size-fidelity | 显式声明数值宽高的节点 | `width/height` 经 rpx 剥壳 ≈ bbox × 口径系数(容差 4);锚点欺诈特判:`width:1, height:1` + `overflow:'hidden'` 且真实尺寸 >8 → 点名 violation;盒模型分支删除(RN 恒为 border-box,`hasPadding && !hasBorderBox` 跳过条件移除,覆盖面比 h5 更大) | 改写 |

**RN 特有硬规则(新增,独立命名空间 RN01-RN04,全部 exit-1)**——把 v0.3.12/0.3.13 文本约束升格为机械判定:

| 规则 | 触发条件 | 校验内容 |
|---|---|---|
| RN01 scroll-skeleton | `--merge` 模式(页面级) | 页面根结构必须为 `View(root) > ScrollView > View(scrollContent)`;scrollContent 用 `minHeight`(写死 `height` 即违规);根与 scrollContent 禁 `overflow: 'hidden'`;`fixed-` 前缀节点的 data-node-id 不得出现在 ScrollView 标签区间内。`--block` 模式反向:block 产物**不得**含 ScrollView 骨架 |
| RN02 flow-child-position | cache:父 `layoutMode ∈ {H,V}` 且子 `layoutPositioning !== 'ABSOLUTE'` | 顺流子 style 禁出现 `position`/`top`/`left`/`right`/`bottom`/`margin*`;`padding*` 非 0 值必须能溯源到该节点 cache 同名字段;`flex: 1` 仅当 `layoutGrow=1` 或 `layoutSizing*='FILL'`(v0.3.13 硬约束代码化) |
| RN03 no-percent-fill | `bg-` 前缀节点(及其铺满层) | style 禁 `'100%'` 宽高与 `absoluteFillObject` 引用,必须为数值(rpx)固定尺寸(v0.3.12 %-塌陷防御代码化) |
| RN04 styles-file-separation | 全产物 | `index.tsx`(全部 JSX 文件)内禁出现 `StyleSheet.create` / 对象字面量 inline style(`style={{`);样式必须在独立 styles 文件(v0.3.12 强制项代码化;`style={[styles.a, 动态变量]}` 数组形态放行) |

**RN 侧规则总量**:h5 17 条 exit-1 中 R01-R23 全部保留语义(无"不适用"项)+ RN01-RN04 = **21 条 exit-1** + R22(warning)+ 4 道门禁。

### 四、规则文档库 `rules/`(pp-d2c-rn/rules/)

- 以 h5 `rules/R01-R23.md` 为底本逐条改写:触发条件(cache 侧)基本照搬,「期望产物」「反例」全部换 RN 语义(camelCase、rpx、组件标签、退化表引用);
- 新增 `RN01-RN04.md` 四篇(触发/期望/反例,反例直接取 v0.3.12/0.3.13 changelog 里的真实事故形态);
- `README.md` 重写:前缀常量表照搬(前缀语义端无关),索引表按上文适配表刷新,Rule-Scan 派发 prompt 中的规则路径与优先级序列更新(R21 最高优先不变,RN01-RN04 插入结构类优先级段);
- 文档间冲突裁决顺序沿用 h5:`rules/` > SKILL.md。

### 五、SKILL.md 升级(pp-d2c-rn/SKILL.md)

**版本策略**:v0.3.13 → **v1.0.0**,changelog 首条声明"防线代与 h5 v1.2.5 对齐"。此后 rn 与 h5 版本号各自独立演进(现状已是独立,仅明确声明)。

升级点清单:

1. **步骤 3.5 Rule-Scan 派发**:补齐 h5 v1.2.2/v1.2.4 语义——无 sub- 页面对页面根跑虚拟 block;全量扫描出指引、软 5 条唯一判定点、判决权在 check-rules;二次降级落 `v0.3.21-fallback` 占位 + assets.txt `[Rule-Scan 降级]` 记录(GATE-rule-hits 收紧口径);
2. **交付门禁**:sub-agent 交付前 `check-rules --block blocks/{sub}/ --cache-key <fileKey>`(可显式 `--root`);主 agent 合并后 `check-rules --merge pages/{page}/`;exit 1 = 回滚重做,禁止带违规交付;
3. **§6.0.3 忠实度证明块**对齐 v1.2.5:硬规则聚合行覆盖 21 条 + 门禁结果;`[脚本误判]` 豁免单次 ≤3 条且附三段证据(文件:行号 + grep 命令 + 命中内容);生成流程禁用 `--force-skip`;
4. **报数即真值段**:引入 loadCache 三标注说明与"违规即真违规"的豁免话术封口(照搬 h5 §6.0.2 语义,示例换 RN);
5. **单 agent 执行模式**(h5 v1.2.5 第 6 项):无 sub-agent 平台由主 agent 串行完成同等动作,禁止以平台缺失为由占位绕过;
6. **切图确认留痕**:步骤 2.6 对齐 `slice.confirmBeforeContinue` + `figma.mjs confirm-slices` 翻 confirmed(rn 侧 figma.mjs 与 h5 同步刷新到含 confirm-slices 子命令的版本);
7. v0.3.12/0.3.13 的 RN 独享章节保持原位,正文补一句"本约束已由 RN04/RN02 机械强制"。

### 六、回归测试 `test/rules-rn/`

- 目录与 h5 `test/rules/` 平行:`run-all.mjs`(骨架复制,dir 指向 rules-rn)+ 按批次的 `test-*.mjs`;
- 夹具形态:每条用例内联最小 cache JSON(手写 3-10 节点)+ 最小产物(`index.tsx` + `styles.ts` 字符串写临时目录),断言 violations 命中/不命中——与 h5 现有测试同构;
- **必测清单**:R18 方向镜像(VERTICAL 省略合法 / HORIZONTAL 缺失违规——这是与 h5 行为相反的点,回归价值最高)、R19/R20/R23 的 rpx 剥壳与 unparseable 跳过、R23 锚点欺诈、RN01 骨架四种硬错、RN02 顺流子违禁属性、RN04 inline style 拦截、R21 反向对账、GATE-rule-hits 捏造检测;
- `package.json` scripts:`"test": "node test/rules/run-all.mjs && node test/rules-rn/run-all.mjs"`。

## 配置

check-rules 运行期新读取的 config 字段(均为已有字段,零新增):

| 字段 | 用途 |
|---|---|
| `unit.scale` / `unit.responsive.enabled` | 决定数值对账期望值公式(见 §1.2 口径;实现时二选一后写死进 styleMatch 注释) |
| `adapter.enabled` / `adapter.tagMap` | R16/R22/RN01 的标签集合扩展(映射后标签并入 Image/ScrollView 识别集) |
| `merge.mode` | R12 触发条件(同 h5) |
| `slice.confirmBeforeContinue` | GATE-slice-confirm 语义(同 h5) |

## 分期实施

| 期 | 内容 | 验收 |
|---|---|---|
| **P0 引擎 + 数值对账核心** | `lib/`(loadCache 复制、styleMatch、nodeIdToStyleKey、loadProduct、report)+ check-rules 聚合器 + R17/R21(复用)+ R18/R19/R20/R23(数值对账)+ GATE-cache-truncation | 对一份真实 rn 产物跑 `--block`/`--merge` 出合理报告;R18 镜像行为有临时用例佐证 |
| **P1 全量规则 + 门禁** | 其余 R 系规则 + RN01-RN04 + GATE-rule-hits/IMG-reconcile/GATE-slice-confirm + `rules/*.md` 全量文档 | 21 条 + 4 门禁全通过自查;规则文档与脚本口径互查一致 |
| **P2 测试 + SKILL + KB** | `test/rules-rn/` 回归入仓 + npm test 串跑 + SKILL.md v1.0.0 升级 + `.Knowledge/topics/pp-d2c-rn.md` 同步防线章节 | npm test 全绿;topic 与 SKILL 版本行一致 |

每期独立可交付:P0 落地后即可人工调用 check-rules 拦数值类事故,P1 补全覆盖面,P2 保证可持续演进。

## 异常处理

| 异常 | 处理 |
|---|---|
| styles.ts 含 Platform.select/三元/变量值 | 该属性标 unparseable,数值规则跳过 + warning(宁漏报不误判) |
| styles 文件缺失但 JSX 有 style 绑定 | loadProduct 报 style 空集,数值规则整体静默;RN04 会因找不到独立 styles 文件先行报违规,不静默逃逸 |
| adapter 映射后标签无法识别 | 标签集合并入 tagMap 值;tagMap 缺失时按 RN 原生标签集判,不误报 |
| config unit 字段缺失 | 沿用 h5 默认 `scale=2` 的兜底会在 rpx 口径下全量误判——RN 侧兜底改为读不到 `unit` 时 exit 2(环境错误),强制 config 显式声明 |

## 风险与待确认

1. **rpx 口径**(§1.2):**已落定(2026-08-24 查证)**——rn 模板 config `unit.scale=1`、`figmaBase=outputBase=375`、`responsive.enabled=true`,SKILL §4.1.1 的 `rpx()` 参数即 Figma 原值;对账期望值公式写死为 **期望 = Figma 原值 × unit.scale**,产物 rpx 剥壳值同域直接比(模板默认 scale=1);
2. **data-node-id 挂载形态**(§1.3):**已落定(2026-08-24 查证)**——rn SKILL v0.3.13 全文 `data-node-id` 27 处、`testID` 0 处,引擎只识别 `data-node-id`,不做 testID 兜底;
3. **R01 结构判定**("位于根 View 直接子层")用文本区间法,嵌套 ScrollView 场景可能误判——首版对判不了的场景降 warning,实测后再决定是否升 violation;
4. **R04/R09 退化校验强度**:首 stop 色值精确比对可能因色值格式(rgba vs hex)误报——实现时统一归一化为 rgba 元组再比,保留"格式差异不误判"底线;
5. **styleMatch 轻量词法 vs AST**:选择轻量词法是与 h5 cssMatch 同级的取舍;若实测 unparseable 比例过高(>10% 属性),再评估引入 `@babel/parser`(会引入 rn 模板的 npm 依赖,当前模板零依赖——**排他性选择:首版零依赖,不引 AST**);
6. **RN02 padding 溯源**:「非 0 padding 须溯源 cache 同名字段」与 R19 数值对账部分重叠——RN02 只判"cache 无 padding 却写了"的凭空捏造分支,数值精度归 R19,避免双报;
7. **R04/R09 退化 warn 记录的落盘载体**:两条规则的合法形态之一要求"QA 段有该 nodeId 的退化 warn 记录",机械校验只能读磁盘文件——**待与项目约定确认**:退化记录统一落 `assets.txt`(追加 `[退化告警]` 行,与既有三行溯源同文件)还是 `rule-hits.json`;实现前二选一并写进规则文档,禁止以对话输出作为判定依据。

## 验收自查对照(实现完成后逐项打钩)

- [ ] h5 `templates/skills/pp-d2c/` 与 `pp-d2c-fast/` git diff 为空
- [ ] R18 镜像行为:VERTICAL 无 flexDirection 不报、HORIZONTAL 无 flexDirection 报
- [ ] R23 在 RN 侧无盒模型跳过分支(覆盖面 ≥ h5)
- [ ] RN01-RN04 与 v0.3.12/0.3.13 文本约束逐条对应,无遗漏无扩大
- [ ] 四道门禁行为与 h5 逐条等价(fixture 复测)
- [ ] `npm test` 同时跑 h5 与 rn 两套且全绿
