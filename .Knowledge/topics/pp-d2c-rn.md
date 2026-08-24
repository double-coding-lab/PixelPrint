---
id: pp-d2c-rn
revision: 2
summary: pp-d2c-rn
primary: feature
confidence: manual
tags: [module, config]
---
# pp-d2c-rn

> D2C RN SKILL(`templates/skills/pp-d2c-rn/`)的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md(v1.0.0,约 3100 行)+ `rules/*.md`(冲突时以 rules/ 为准),本 topic 是路由摘要 + 关键边界。**与 [[pp-d2c]](h5)完全独立并列**,共享前缀识别 / 布局判定 / 图片处理决策逻辑,但输出层完全不同。v1.0.0 起防线代与 h5 v1.2.5 对齐(机械防线见下文专节),此后 rn 与 h5 版本号各自独立演进。

## 适用场景 / 触发词

- 用户提供 Figma 设计稿 URL,且项目 `config.project.framework === 'rn'`
- 用户说「用 RN 还原设计稿」「生成 React Native 代码」「生成 xtaro 代码」「D2C RN」
- 用户明确说明目标是移动端原生(iOS / Android),而非 H5 网页
- 项目 config 里包含 `adapter` 段(即便未启用,存在字段就说明该项目走 rn 分支)

## 与 h5 SKILL 的分工

| 层级 | 关注 | 产物 |
|------|------|------|
| **h5 SKILL** `pp-d2c` | Figma → React + CSS/SCSS/Less/Tailwind 等 8 种 web 样式 | web 页面代码 |
| **rn SKILL** `pp-d2c-rn`(本文档) | Figma → React Native + StyleSheet(内核)→ 可选 adapter 映射到 xtaro / taro / 其他 | 移动端原生代码 |

**独立性**:

- 两个 SKILL 是**平行**关系,不是父子/继承;h5 SKILL 一字不改
- rn SKILL 从 h5 SKILL 复制起步,前缀识别 / 布局判定 / 图片处理**决策等价**,但**输出层完全不同**(标签 / 样式)
- 用户根据项目类型只装其中一个,或两个共存(不同 config 分别指向)
- rn SKILL 内**不接 doctor 卫星**(config 默认 `health.enabled=false`);**不做 styleFormat 探测**(rn 只有 StyleSheet 一种)

## 机械防线(v1.0.0)

`bin/check-rules.mjs` 以 `.d2c-cache/<fileKey>/nodes/*.json` 为真值逐节点对账产物,violations > 0 禁止交付:

- **规则口径**:21 条 exit-1(R01-R06/R08/R09/R12/R14/R16-R21/R23 按 RN 语义适配 + RN 特有 RN01-RN04)+ R22(warning 级)+ 四道门禁(GATE-cache-truncation / GATE-rule-hits 全模式;IMG-reconcile / GATE-slice-confirm 仅 --merge)。规则明细见 `templates/skills/pp-d2c-rn/rules/README.md`。
- **强制时机**:sub-agent 交付前 `check-rules --block blocks/<label>/ --cache-key <fileKey> [--root <nodeId>]`;主 agent 合并后 `check-rules --merge <输出目录>/ --cache-key <fileKey>`。exit 1 = 回滚重做;exit 2 = 环境错误。
- **styleMatch 引擎**:解析独立 `styles.ts` 的 `StyleSheet.create`,`rpx(x)` 剥壳后与 Figma 原值 × `config.unit.scale` 同域对账(rn 模板 scale=1,rpx 参数即 Figma 原值);`Platform.select` / 三元等动态值标 unparseable 保守跳过。
- **RN 特有硬规则一览**:

| 规则 | 拦什么 |
|---|---|
| RN01 scroll-skeleton | --merge:页面根必须 View>ScrollView>View(scrollContent) 骨架、scrollContent 用 minHeight、禁 overflow:'hidden';--block 反向:block 产物不得套骨架 |
| RN02 flow-child-position | 顺流子禁 position/top/left/right/bottom/margin*(显式 0 值放行);padding 须溯源 cache 同名字段;flex:1 须 layoutGrow=1 或 layoutSizing*=FILL |
| RN03 no-percent-fill | bg- 铺满层禁 '100%' 宽高与 absoluteFillObject(父 minHeight 时塌陷),须写 Figma 事实尺寸 |
| RN04 styles-file-separation | JSX 文件禁 StyleSheet.create 与静态 inline style={{...}};数组含动态变量放行 |

- **与 h5 防线的关键差异**:R18 判定镜像(RN flex 默认 column,HORIZONTAL 必须显式 `flexDirection: 'row'`);R01 校验"fixed- 在根 View 直接子层 + absolute + zIndex≥100"(RN 无 position:fixed);R04/R09 校验退化正确性(首 stop 纯色 + assets.txt `[退化告警]` 行留痕,或 R09 引 LinearGradient);R23 无盒模型跳过分支(RN 恒 border-box,覆盖面更大);config 缺 `unit` 段直接 exit 2(禁止兜底默认 scale)。
- **软防线**:步骤 3.5 Rule-Scan 先扫 R07/R10/R11/R13/R15 语义类规则出 `rule-hits.json` 作业指引;判决权在 check-rules。降级须落 fallback 占位 + assets.txt `[Rule-Scan 降级]` 记录,只有占位没有记录按捏造拦截。
- **前置切图(v1.1.0,步骤 2.6)**:主 agent 调 `pp-d2c-reskin` 的 `reskin-slice.mjs` 一次性切完全部 `img-`/`bg-` 节点(含裸词)落 `slice-manifest-<slug>.json`;退出码非 0 → hard stop,禁止改用 export-image 手工逐张绕过。切完按 `slice.confirmBeforeContinue`(config 缺失=默认 `true`)暂停等用户确认,`sizeWarning` 非空不受开关豁免一律必停;确认后 `figma.mjs confirm-slices` 翻 `confirmed:true`。sub-agent 只消费清单(RN 5 种引用形式),清单缺条目写 `[清单缺失]` 上报主 agent 补切,禁止自调 `export-image`。生成流程必产 manifest,IMG-reconcile 与 GATE-slice-confirm 两道门禁由此获得对账基准(check-rules 对无 manifest 的旧产物仍按 warning 跳过,属兼容通道,不适用于新生成流程)。
- **回归测试**:`test/rules-rn/`(npm test 与 h5 套件串跑)。

## 核心机制:RN 内核 + 可配置 Adapter

### RN 六件套内核标签

rn SKILL 内部只知道 6 个 RN 原生标签,对应现有 6 个前缀槽位:

| 前缀 | RN 内核标签 |
|------|-----------|
| (容器默认,FRAME/GROUP 无特殊前缀) | View |
| (TEXT 节点) | Text |
| `img-` | Image |
| `btn-` | Pressable |
| `input-` | TextInput |
| `scrollx-` / `scrolly-` | ScrollView |

**其他 RN 组件(Modal / Switch / FlatList / SafeAreaView / KeyboardAvoidingView 等)不纳入内核**:Figma 静态稿里没有信号可以识别,自动生成一半反而误导业务。

### Adapter 配置(通过 config 映射到任意框架)

Adapter 是 rn SKILL 独有的机制。用户在 `pp-d2c.config.json` 里配置三张表(`tagMap` / `importMap` / `propMap`),SKILL 在合并阶段应用到产物 JSX。

**预设来源**:CLI 层的预设列表在 `templates/adapter-presets/*.json`(每个 JSON 是一个预设,`install.js init` 扫目录列成选项;新增框架加 preset 文件即可,不用改 SKILL 或 CLI)。SKILL 自身只消费 config 里最终写好的 `adapter` 段。

**xtaro 预设应用后的 config 长这样**:

```json
{
  "adapter": {
    "enabled": true,
    "tagMap": {
      "View": "XView",
      "Text": "XText",
      "Image": "XImage",
      "Pressable": "XView",
      "TextInput": "XInput",
      "ScrollView": "XScrollView"
    },
    "importMap": {
      "XView": "@ctrip/xtaro",
      "XText": "@ctrip/xtaro",
      "XImage": "@ctrip/xtaro",
      "XInput": "@ctrip/xtaro",
      "XScrollView": "@ctrip/xtaro"
    },
    "propMap": {
      "Image": { "source": "src" }
    }
  }
}
```

**边界**:

- `tagMap` 只支持 6 大 RN 标签作为 key,其他 key 忽略 + QA 告警
- `tagMap` value 必须匹配 JSX 大写标识符
- `importMap` 未覆盖的映射后标签自动 fallback 到 `react-native`
- `propMap` key 必须是 6 大 RN 原标签(不是 tagMap 映射后的名字);value 形如 `{ 原 prop: 新 prop }`;禁止重命名 `style` / `key` / `ref` / `children` / `className`
- StyleSheet / Dimensions 等 RN API 始终从 `react-native` 导入,不进 tagMap
- 不允许写 JS 逻辑映射(纯声明式 JSON)

**未启用时**:直接输出原生 RN(`import from 'react-native'`)。

### 样式方案:强制 StyleSheet.create

rn SKILL 内不做 styleFormat 探测,统一走 `StyleSheet.create({...})` + `style={styles.xxx}`:

- camelCase 属性名(`backgroundColor` 不是 `background-color`)
- 数字无单位(`padding: 20` 不是 `'20px'`)
- 布局默认 flex(RN 默认全体 flex,`display: 'flex'` 通常可省)
- `fontWeight` 必须写字符串(`'500'` 不是 `500`)

老 config 里若 `styleFormat` 是 `scss` 等 h5 值,自动降级到 `stylesheet` + QA info 告警。

## rn 页面根强制骨架 + fixed-* 分层(v1.0.3 关键补丁)

**背景**:agent 无法在生成阶段可靠判断"内容是否超过视口"——figmaBase 与视口高度不联动、顶层 frame 高度不总等于内容真实高度、运行时视口值 D2C 拿不到。历史"三信号 AND 页面根覆写"(入口 nodeId + 父是 Page + 高度接近视口容差列表)在 rn 侧屡屡失灵:设计稿 1579px 长图不匹配容差 → 走普通 FIXED → 产物根 `<View>` + `minHeight: rpx(1579)` 死高 → **RN 的 View 天然不滚**,内容被裁,用户看不到底部。

**结论**:rn 分支 SKILL **不判视口**,所有 rn 页面顶层入口一律套用固定骨架(**内核标签描述;adapter §5.5 阶段自动映射到目标框架**):

```tsx
<View style={styles.root}>              {/* flex:1 + position:relative,承接 fixed-* */}
  <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.scrollContent}>  {/* width + minHeight + paddingTop + alignItems + alignSelf:center */}
      <Image source={require('...bg-body.png')} style={styles.bgBody} />
      {/* 顶层 frame 顺流子... */}
      <View style={styles.bottomPadding} />  {/* 给屏底 fixed-btn 让位 */}
    </View>
  </ScrollView>

  {/* fixed-* 放外层,真贴屏 */}
  <Image style={styles.fixedNavbar} />   {/* top: 0 */}
  <View style={styles.fixedBtnHit}>...</View>  {/* bottom: 0 */}
</View>
```

> 启用 xtaro 预设后,adapter §5.5 自动 tagMap `View→XView` / `ScrollView→XScrollView` / `Image→XImage`,propMap `Image.source→src`;其他框架同理。

### fixed-* 铁律:所有一律放 ScrollView 外

RN 里根本没有 CSS `position: fixed`,`<ScrollView>` 内部的 `position: 'absolute'` 元素**相对内容容器定位**,滚动时会一起动。要模拟"贴屏"只有一条路:放外层。所以规则极简——**只要图层名带 `fixed-` 前缀,就放根 `<View>` 直接子层**,不区分 constraints、不区分设计语义、不 agent 推断"这个 fixed- 是不是本意贴屏"。设计师主动加 `fixed-` 前缀 = 明确表达"这个元素相对屏幕定位",agent 尊重前缀即可。

位置按 constraints 换算三档:

| Figma constraints `vertical` | CSS 写法 |
|---|---|
| `TOP`(默认) | `top: rpx(<Figma y - 顶层frame y>)` — 相对屏顶偏移 |
| `BOTTOM` | `bottom: rpx(<顶层frame 底 - Figma 节点底>)` — 常见 `bottom: 0` |
| `CENTER` | `top: 50%` + `transform: [{ translateY: -<h/2> }]` — 少见 |

zIndex 100+ 高于 ScrollView 内容。

**反例**:`<ScrollView>` 内的绝对定位元素**相对内容容器定位**,滚动时会跟着动 → 不适合"贴屏"语义。若设计师**不带 `fixed-` 前缀**但用 `layoutPositioning: ABSOLUTE`(如视频卡角标 / 装饰徽章),这类才走"跟内容滚"路径,留在父容器内即可(不属于 fixed-* 分层规则的管辖范围)。

**不用 Portal / Modal 层**——RN 里 Portal 会破坏 zIndex 语义,不如 JSX 顺序直观。

### bg- 铺满层用 Figma 事实尺寸

历史写法 `<Image style={StyleSheet.absoluteFillObject} />` 或 `width/height: '100%'` **在父用 `minHeight` 时会跟着塌陷**——`%` 值引用父的**计算高度**(可能小于 Figma 设计稿高度)。改为写 Figma 事实固定尺寸 + 精确定位:

```ts
bgBody: {
  position: 'absolute',
  top: 0, left: 0,
  width: rpx(<figmaW>),
  height: rpx(<figmaH>),   // 不用 '100%',不用 absoluteFillObject
}
```

### §6.0 checklist 相应变更

- **第 9 项(重写)**:检查顶层入口节点是否套用强制 ScrollView 骨架(不套 / `overflow:hidden` / `fixed-` 放内部 / scrollContent 用 `height` 而非 `minHeight`,四种都是硬错);sub-agent 派发进来的内层 block **不应**套骨架,反向查也校验
- **第 11 项(补 b 分支)**:除了原 `sub-/block-` 容器 FIXED 用 `minHeight` 防塌陷,再校验其内部铺满兄弟层是否用了 `%` 或 `absoluteFillObject`(应改为 Figma 事实尺寸)

## RN 特性退化表(与 h5 SKILL 的关键差异)

Figma / h5 里的一些 CSS 特性在 RN 端无对应,rn SKILL 按下表退化并输出告警:

| Figma / h5 语义 | rn 退化策略 | 告警级别 |
|-----------------|-----------|--------|
| `fixed-` 前缀 | **一律**放 `<ScrollView>` **外**作为根 `<View>` 直接子(不区分 constraints,不 agent 推断"是不是本意贴屏");`position: 'absolute'` + zIndex 100+;位置按 constraints 换算(TOP → 相对顶偏移 / BOTTOM → 相对底偏移) | info |
| 页面滚动骨架 | 所有 rn 页面一律套 ScrollView 骨架,不判视口 | info |
| `bg-` 背景图 | 拆成独立 `<Image>` 挂 `scrollContent` 内头部;**用 Figma 事实固定尺寸而非 `absoluteFillObject` / `%`**(父 `minHeight` 时 `%` 会塌陷) | info |
| GRADIENT_LINEAR / GRADIENT_RADIAL | 退化为纯色(第一个 stop),提示接 `react-native-linear-gradient` | warn |
| box-shadow | 拆成 `shadowColor` / `shadowOffset` / `shadowRadius` / `shadowOpacity` / `elevation` | 无(rn 原生支持) |
| INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR | 不出 style,注释 TODO,提示接第三方库 | error |
| outline / gradient stroke | 退化为普通 border | warn |
| `gap` 属性 | RN 0.71+ 支持,低版本提示手改为 marginRight/marginBottom | info |
| vw/rem/vh 单位 | 强制退化为 px(数字 DP) | info |

**QA 段落输出格式**:按 error / warn / info 三级分组,列 nodeId + 图层名 + 退化说明。无告警时显式输出"无退化"。

## 与 h5 SKILL 共享的规则(rn 侧完全等价保留)

以下 h5 SKILL 已经落地的规则,在 rn SKILL 内**决策逻辑完全等价**,只是输出层不同:

- **图片导出必须带 `use_absolute_bounds=true`**:同 h5,不重复
- **`sub-scrollx-` / `sub-scrolly-` 禁止整体导出**:同 h5;rn 侧多一层:整体导出的图放进 `<Image>` 无法承载动态数据,业务侧完全无救
- **Token 过期兜底链 L0→L1→L2→L3**:同 h5
- **`bgc-` 覆盖父元素全套盒级 CSS 属性**:rn 侧改为覆盖 `borderColor` / `borderWidth` / `borderRadius` / `shadow*`,GRADIENT 走退化
- **`bg-` 内嵌 `bgc-` 的"摘出来"处理**:同 h5,只是"摘出来"后写到父 View 的 style 属性(不是 CSS 类)
- **`bg-` 切图前的 CSS-able 自检**:同 h5,命中条件后**改用 bgc- 规则**(rn 侧走 style 属性)
- **`fixed-` / `end-` / `input-` 前缀语义**:同 h5,只是输出退化(见上文「fixed-* 铁律:所有一律放 ScrollView 外」;`end-` 仍走 wrapper + space-between)

## rn SKILL 特有的执行步骤

| 步骤 | 与 h5 差异 |
|------|-----------|
| §-1 探针 | 同 h5(figma.mjs 是复制的) |
| §0 读配置 | 多读 `adapter` 段 |
| §0.7 缓存 | 完全同 h5(缓存 fileKey 无关 target) |
| §0.5 doctor | **移除**(rn 不接卫星) |
| §1 解析 URL | 同 h5 |
| §2 拉稿 | 同 h5 |
| §2.5 页面级背景 | **大幅简化**(rn 无 body / css-modules 等分支,直接写根 View 的 backgroundColor) |
| §2.6 前置切图(v1.1.0 新增) | 主 agent 一次切完 img-/bg- 落 slice-manifest + 确认暂停留痕;sub-agent 只消费清单 |
| §3.5 Rule-Scan(v1.0.0 新增) | 软防线派发,出 `rule-hits.json` 作业指引;无 sub- 页面对页面根跑虚拟 block |
| §3.6 交付双门禁(v1.0.0 新增) | sub-agent 交付前 `check-rules --block`、合并后 `--merge`,exit 1 回滚 |
| §4 解析规则 §A/B 表 | **改造为 RN StyleSheet 映射**(CSS 属性名 → camelCase / 数字) |
| §4.3.rn 退化表 | **新增**(fixed / vh / bg-image / gradient / blur / outline) |
| §5 合并输出 | 用 RN 六件套 + StyleSheet,不生成 `.scss` |
| §5.5 应用 adapter | **新增**(tag 替换 + import 分组) |
| §7 QA 输出 | 新增退化告警块 + Adapter 应用报告 |

## 边界与禁止

- **禁止**:在 rn SKILL 内写 `<div>` / `className` / `.scss` 等 h5 概念
- **禁止**:在 rn SKILL 内引用 doctor 卫星
- **禁止**:adapter 应用改动 style / props / children(只改标签名 + import)
- **禁止**:对 StyleSheet / Dimensions / Fragment 应用 tagMap
- **禁止**:rn 侧 config 里出现 `scss` / `scss-modules` 等 h5 值不做降级处理
- **禁止**:rn 侧生成"字符串 + px 后缀"的样式属性(`'20px'`),必须写数字 `20`
- **禁止**:让根 `<View>` 直接装内容而不套 `<ScrollView>`;禁止把根或 `scrollContent` 写 `overflow: 'hidden'`(会阻止滚动);**禁止把任何带 `fixed-` 前缀的节点放进 `<ScrollView>` 内部**(RN 无 CSS fixed,ScrollView 内的 absolute 会跟内容滚 → 所有 fixed-* 必须放根 `<View>` 直接子层,不区分 constraints,不推断设计意图)
- **禁止**:`bg-` 铺满层用 `StyleSheet.absoluteFillObject` 或 `width/height: '100%'`(父 `minHeight` 时 `%` 值会引用父计算高度跟着塌陷);必须写 Figma 事实固定尺寸 `width: rpx(w), height: rpx(h)` + `top: 0, left: 0`(v1.0.0 起由 RN03 机械强制)
- **禁止**(v1.0.0):带 check-rules violations 交付;生成流程使用 `--force-skip`;跳过步骤 3.5 Rule-Scan 或捏造 rule-hits 消费证明(GATE-rule-hits 机械拦截);对报数做批量豁免(`[脚本误判]` 单次 ≤3 条且附三段证据)

## 不在本 topic 覆盖的内容

- doctor 的体检规则 → 见 [[pp-doctor]](rn 不接,但可手动跑一遍 h5 版看规范)
- h5 版 D2C 完整规则 → 见 [[pp-d2c]]
- 通用 D2C 设计意图(如何写图层名 / Auto Layout 怎么用) → 见 `docs/design-guide.md`
- 项目级 rn config 示例 → 见 `templates/pp-d2c.rn.config.json`
