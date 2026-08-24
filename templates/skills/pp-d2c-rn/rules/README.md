# pp-d2c-rn 规则库

> pp-d2c-rn skill 硬性规则的原始定义。当 rules/*.md 内容与 SKILL.md 冲突时以 rules/ 为准。
> 与 h5 pp-d2c v1.2.5 规则库同代:R 系编号语义对齐(输出层换 RN),RN01-RN04 为 RN 特有规则(独立命名空间,与 h5 未来的 R24+ 隔离)。

## 内置前缀常量表(硬编码,不可配置)

与 h5 完全一致——前缀语义端无关,设计师-开发者-脚本三方共享同一份协议:

| 前缀 | 语义(RN 落地) |
|---|---|
| `sub-` | 分块边界(sub-agent 派发单元) |
| `block-` | 独立布局块(styleKey 命名空间隔离) |
| `img-` | 图片内容(生成 `<Image>`,不递归) |
| `bg-` | 背景图(独立 `<Image>` 挂父容器内头部 + absolute + Figma 事实尺寸,子孙不生成组件) |
| `bgc-` | 背景纯色(borderColor/borderWidth/borderRadius/shadow* 写父 style,自身不生成组件) |
| `btn-` | 可点击区域(`<Pressable>`,永远 style 化) |
| `scrollx-` | 横向滚动容器(`<ScrollView horizontal>`) |
| `scrolly-` | 纵向滚动容器(`<ScrollView>`) |
| `fixed-` | 贴屏定位(修饰前缀;一律放根 View 直接子层,absolute + zIndex≥100) |
| `end-` | 逆向布局(贴父末端,修饰前缀) |
| `input-` | 输入框(生成 `<TextInput>`,不递归) |
| `x-` | 忽略(跳过整层,优先级最高) |
| `bl-` | 文本基线对齐容器(v1.1.1,修饰前缀,无裸词;R24 校验 baseline 落地,直接子层 R20/RN02 豁免) |
| `list-` | 显式同构列表(v1.1.1,修饰前缀,无裸词;强制 .map() 模板,非首子项标 _templateDup,切图按 imageRef+bbox 尺寸跨项去重) |

## 索引表

| ID | 名称 | 判定归属 | 一句话触发条件(RN 口径) |
|---|---|---|---|
| R01 | fixed-position | 硬防线 | `name.startsWith('fixed-')` → absolute + zIndex≥100 + 根 View 直接子层 |
| R02 | fills-image | 硬防线 | fills 含可见 IMAGE → 切图记录 + 产物引用(Image/require/uri) |
| R03 | implicit-image | 硬防线 | 无前缀 + 子树 ≥3 真矢量路径 + 无 TEXT/交互 → 该整体切图 |
| R04 | text-gradient | 硬防线(语义变更) | TEXT 末位可见 GRADIENT_*/IMAGE → 退化首 stop 纯色 + assets.txt [退化告警] 行 |
| R05 | space-between | 硬防线 | `primaryAxisAlignItems === 'SPACE_BETWEEN'` → `justifyContent: 'space-between'` |
| R06 | text-solid-last | 硬防线 | TEXT 末位可见 SOLID → `color: '#hex'` 取末位色值 |
| R07 | multi-fills | 软防线 | fills ≥2 层可见混合 → 拆层落地(底 View backgroundColor + 上层 Image/LinearGradient) |
| R08 | bg-landing-form | 硬防线(语义变更) | bg- 节点 → 独立 Image + absolute + 数值固定尺寸 |
| R09 | btn-bgc-取值 | 硬防线(语义变更) | btn- 内 bgc- 末位 GRADIENT → LinearGradient 或 首 stop 纯色+退化留痕 |
| R10 | no-fake-solid-color | 软防线 | 产物色值在 cache 找不到源头(幻觉色) |
| R11 | mask-vector-css-able | 软防线 | 复合 mask / 多层 vector → RN 可表达集比 CSS 更小,基本一律切图 |
| R12 | flat-mode-naming | 硬防线 | `merge.mode === 'flat'` 下 StyleSheet key 跨文件重复定义 ≥2 |
| R13 | unit-scale | 软防线 | rpx 白名单属性漏包 / 数值未按口径换算 |
| R14 | fixed-z-index | 硬防线 | ≥2 个 fixed- 节点 zIndex 全缺或全同 |
| R15 | 同构 map 渲染 | 软防线 | 同层 ≥3 同构子节点须 `.map()` 模板渲染 |
| R16 | no-flatten-text | 硬防线 | 含 TEXT 容器(前缀非 img-/bg-)整体切成图片家族标签 |
| R17 | no-baked-dom | 硬防线 | `_inBakedSubtree` 节点在产物出现 data-node-id(双重渲染) |
| R18 | flex-direction | 硬防线(语义变更) | **判定与 h5 镜像**:RN 默认 column——VERTICAL 省略合法;HORIZONTAL 必须显式 `'row'` |
| R19 | padding | 硬防线 | `paddingT/R/B/L` ≈ Figma × unit.scale(rpx 剥壳,容差 2) |
| R20 | absolute-position | 硬防线 | ABSOLUTE 节点须声明 `position: 'absolute'` 且 top/left ≈ (子bbox−父bbox)×scale(容差 4) |
| R21 | node-id-coverage | 硬防线 | 应渲染节点漏挂 data-node-id;反向:产物 id ∉ cache = 幻觉 id |
| R22 | empty-visual-btn | warning | btn- 无文字/背景/边框/图片/渐变 → 空视觉按钮嫌疑 |
| R23 | size-fidelity | 硬防线 | 显式数值宽高 ≈ bbox×scale(容差 4);1×1+overflow:hidden 锚点欺诈点名(RN 恒 border-box,无盒模型跳过分支,覆盖面 ≥ h5) |
| R24 | baseline-align | 硬防线(v1.1.1) | `bl-` 容器必须 `alignItems: 'baseline'`(缺失/其他对齐值 violation;缺 flexDirection:'row' 仅 warning) |
| RN01 | scroll-skeleton | 硬防线(RN 特有) | 页面根强制 View>ScrollView>View(scrollContent) 骨架;block 反向禁套 |
| RN02 | flow-child-position | 硬防线(RN 特有) | 顺流子禁 position/top/left/right/bottom/margin*;padding 须溯源;flex:1 须 FILL 依据 |
| RN03 | no-percent-fill | 硬防线(RN 特有) | bg- 铺满层禁 '100%' 宽高与 absoluteFillObject(父 minHeight 塌陷) |
| RN04 | styles-file-separation | 硬防线(RN 特有) | jsx 内禁 StyleSheet.create 与静态 inline style 对象 |

## 判定归属说明

**硬防线 22 条 exit-1**(`check-rules.mjs` 自动拦截):R01-R06 / R08 / R09 / R12 / R14 / R16-R21 / R23 / R24 + RN01-RN04。

**软防线 5 条**(Rule-Scan sub-agent 识别,输出 `rule-hits.json`):R07 / R10 / R11 / R13 / R15——判定逻辑需 LLM 语义能力,文档即唯一定义。

**warning 级**(提示不阻断):R22 empty-visual-btn;R01 的 ScrollView 区间判不了时的降级提示;R05 的 margin auto 模拟提示。

**四道流程门禁**(与 h5 同代,零样式耦合直接复用):**GATE-cache-truncation**——空 GROUP/BOOLEAN_OPERATION = fetch depth 截断实锤;**GATE-rule-hits**——rule-hits.json 缺失即 exit 1,fallback 占位须伴随 assets.txt `[Rule-Scan 降级]` 记录,捏造消费证明点名;**IMG-reconcile**(--merge)——产物图片引用必须来自 slice-manifest(RN 五种引用形态 require / source={{uri}} / ImageBackground / FastImage / `${ASSET_PREFIX}` 的文件名均被正则捕获);**GATE-slice-confirm**(--merge)——manifest `confirmed` 须为 true。

**对账基座**:R02/R06/R17/R18/R19/R20 依赖 `bin/lib/loadCache.mjs` 三标注(`_inBakedSubtree`/`_hidden`/`_templateDup`,与 h5 逐字节同步副本),样式匹配走 `bin/lib/styleMatch.mjs`(RN StyleSheet 轻量词法解析,`getNumeric` 统一 rpx 剥壳)。数值对账口径:**期望 = Figma 原值 × unit.scale,产物 rpx(x) 剥壳后的 x 同域直接比**(rn 模板 config `unit.scale=1`、`responsive.enabled=true`)。config 缺 `unit` 段时 check-rules 直接 exit 2——rpx 口径下兜底默认 scale 会全量误判,rn 侧强制显式声明。

## 使用方式

### Rule-Scan sub-agent

**派发时机**:每个 `sub-` block 出码前各派一次;页面无 sub- 时对整页派一次(页面根视为虚拟 block,`rule-hits.json` 落页面根目录)。

派发时的完整 prompt:

```
你是 Rule-Scan sub-agent, 只做规则识别, 不写 UI 代码.

任务:
1. Read templates/skills/pp-d2c-rn/rules/*.md 全部规则(全量扫描)
2. Read .d2c-cache/<cache-key>/nodes/ 下与本 block nodeIds 相关的 JSON
3. 对本 block 的每个节点, 判断命中了哪些规则
4. 输出 rule-hits.json (schema 见附)

规则命中判定原则:
- 硬防线规则 (R01-R06/R08/R09/R12/R14/R16-R21/R23/R24/RN01-RN04) 与 warning 级 R22:
  必须扫出命中作为生成前逐节点指引(判决权在 check-rules.mjs,指引漏扫不算违规,但禁止整类跳过)
- 软防线规则 (R07/R10/R11/R13/R15): 你是唯一识别方
- 排斥条件: 若节点命中高优先级规则, 低优先级规则不再重复列
- 优先级 (由高到低): R21 > RN04 > RN01 > R16 > R17 > RN02 > R02 > R01 > RN03 > R05 > R11 >
  R03 > R04 > R07 > R06 > R09 > R08 > R20 > R24 > R18 > R19 > R14 > R15 > R13 > R12 > R10
  (R21 最高:节点不可追溯则其余绑定类规则无从谈起;RN04/RN01 次之:样式混写/骨架缺失是结构性坍塌,
   其余规则的对账在错误结构上无意义)

输出要求:
- 每个 hit 包含 nodeId / rule / trigger 描述 / expected 描述 / context (关键 JSON 字段抽样)
- 输出 JSON, 不带 markdown 代码块围栏, 不加解释文字
- 落盘到 blocks/{sub}/rule-hits.json

禁止:
- 不允许写 JSX / styles
- 不允许改 cache 文件
- 不允许基于"设计意图猜测"命中规则; 只按 rules/*.md "触发条件" 字面判定
```

### UI sub-agent

- Read `blocks/{sub}/rule-hits.json` 里涉及的规则 .md,按"期望产物"落地
- 生完 JSX + styles.ts 后跑:
  ```bash
  node .claude/skills/pp-d2c-rn/bin/check-rules.mjs \
    --block blocks/{sub}/ \
    --cache-key <fileKey>
  ```
- exit 0 继续 / exit 1 按 violations 回滚重做 / exit 2 报环境错
- `assets.txt` 追加"rule-hits 消费证明"块(格式同 h5);渐变退化(R04/R09)必须在 assets.txt
  追加 `[退化告警] <nodeId> <图层名>: GRADIENT_* 退化为首 stop <色值>` 行——缺行即 violation

### check-rules.mjs

- 硬编码全部 21+1 条规则逻辑与四道门禁,rules/*.md 是设计文档,不是执行文档
- 假阳性时用 `--force-skip R0X,R0Y` 跳过,但 UI sub-agent 必须在 `assets.txt` 备注 `[脚本误判] R0X {nodeId} 理由: ...`(三段证据:文件:行号 + grep 命令 + 命中内容;单次 ≤3 条);生成流程禁用 `--force-skip`
- 详细 CLI 见 `templates/skills/pp-d2c-rn/bin/check-rules.mjs --help`

## 排斥关系图(RN 侧增补)

```
h5 既有排斥关系全部保留(R02→R11/R09、R06→R04/R10、R16↔R17、R18—R19 成对、R20 排斥 fixed-、R21 最高),另:

R01 (fixed-position) ── RN01 (scroll-skeleton): fixed- 不入 ScrollView 的逐节点区间判定归 R01;
                        RN01 只管骨架本体(存在性/minHeight/overflow),不重复报 fixed- 位置
R08 (bg-landing-form) ── RN03 (no-percent-fill): 正向契约(Image+absolute+数值尺寸)归 R08;
                        '100%'/absoluteFillObject 塌陷写法归 RN03,不双报
RN02 (flow-child-position) ── R19 (padding): RN02 只判"cache 无 padding 却写了"的凭空捏造分支;
                        数值精度对账归 R19
RN02 ── R20: 子 layoutPositioning=ABSOLUTE 的归 R20,RN02 只管顺流子
RN04 (styles-file-separation) ── 全部数值规则: 样式混写进 jsx 会让 styleMatch 失明,
                        RN04 先行拦截,数值规则不对 inline 样式负责
```

## 版本

- **v1.0.0** 防线代与 h5 v1.2.5 对齐:R01-R23 全量移植(R01/R04/R08/R09/R18/R23 语义变更,详见各文档)+ RN01-RN04(v0.3.12/0.3.13 文本约束升格机械判定)+ 四道门禁 + styleMatch 对账基座(cssMatch 的 RN 重写)
- v0.3.x 时代:规则散落在 SKILL.md 章节,靠文本约束 + grep 自证,无机械防线

## 相关

- `templates/skills/pp-d2c-rn/SKILL.md` — 主流程
- `templates/skills/pp-d2c-rn/bin/check-rules.mjs` — 硬防线脚本
- `templates/skills/pp-d2c/rules/` — h5 母本规则库(R 系编号语义对齐)
- `.Knowledge/req-docs/pp-d2c-rn-防线移植_技术方案.md` — 本轮技术方案
