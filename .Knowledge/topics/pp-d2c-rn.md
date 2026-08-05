# pp-d2c-rn

> D2C RN SKILL(`templates/skills/pp-d2c-rn/`)的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md(约 1700 行),本 topic 是路由摘要 + 关键边界。**与 [[pp-d2c]](h5)完全独立并列**,共享前缀识别 / 布局判定 / 图片处理决策逻辑,但输出层完全不同。

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

**背景**:agent 无法在生成阶段可靠判断"内容是否超过视口"——figmaBase 与视口高度不联动、顶层 frame 高度不总等于内容真实高度、运行时视口值 D2C 拿不到。历史"三信号 AND 页面根覆写"(入口 nodeId + 父是 Page + 高度接近视口容差列表)在 rn 侧屡屡失灵:设计稿 1579px 长图不匹配容差 → 走普通 FIXED → 产物根 `<XView>` + `minHeight: rpx(1579)` 死高 → **RN/xtaro 的 View 天然不滚**,内容被裁,用户看不到底部。

**结论**:rn 分支 SKILL **不判视口**,所有 rn 页面顶层入口一律套用固定骨架:

```tsx
<XView style={styles.root}>              {/* flex:1 + position:relative,承接 fixed-* */}
  <XScrollView style={styles.scroll} showScrollbar={false}>
    <XView style={styles.scrollContent}>  {/* width + minHeight + paddingTop + alignItems + alignSelf:center */}
      <XImage src={require('...bg-body.png')} style={styles.bgBody} />
      {/* 顶层 frame 顺流子... */}
      <XView style={styles.bottomPadding} />  {/* 给屏底 fixed-btn 让位 */}
    </XView>
  </XScrollView>

  {/* fixed-* 放外层,真贴屏 */}
  <XImage style={styles.fixedNavbar} />   {/* top: 0 */}
  <XView style={styles.fixedBtnHit}>...</XView>  {/* bottom: 0 */}
</XView>
```

### fixed-* 分层(放外 vs 放内)

| 判定 | 放 XScrollView **外**(真 fixed) | 放 XScrollView **内**(跟随滚动) |
|-----|---------------------------------|-------------------------------|
| 触发 | 图层名带 `fixed-` **且** constraints `vertical` ∈ `{TOP, BOTTOM}` | `layoutPositioning: ABSOLUTE` 但**不带** `fixed-` 前缀,或设计语义就是"跟内容动"(如视频角标) |
| 典型 | fixed-navbar / 状态栏 back-share / fixed-btn 底部购票按钮 | 视频卡角上的抽奖胶囊 / 装饰性角标 |
| CSS | `top: 0` 或 `bottom: 0`(**不是** Figma 原 top=1505 页面坐标) | 保留 Figma 原 top/left 值 |
| zIndex | 100+ | 不需要 |

**核心机制**:`<XScrollView>` 内的 `position: 'absolute'` 元素相对 `scrollContent` 定位,滚动时会一起动 → 对"抽奖胶囊挂视频角"是对的,对"贴屏底购票按钮"是错的。`<XScrollView>` 外的 `position: 'absolute'` 相对根 `<XView>` (`flex:1` 撑满屏)定位 → 真贴屏。

### bg- 铺满层用 Figma 事实尺寸

历史写法 `<XImage style={StyleSheet.absoluteFillObject} />` 或 `width/height: '100%'` **在父用 `minHeight` 时会跟着塌陷**——`%` 值引用父的**计算高度**(可能小于 Figma 设计稿高度)。改为写 Figma 事实固定尺寸 + 精确定位:

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
| `fixed-` 前缀 | 按上文「fixed-* 分层」放 `<XScrollView>` **外**;constraints `vertical` 决定用 `top: 0`(TOP) 或 `bottom: 0`(BOTTOM),**不写 Figma 原 y 坐标**(那是页面坐标不是屏坐标) | info |
| 页面滚动骨架 | 所有 rn 页面一律套 XScrollView 骨架,不判视口 | info |
| `bg-` 背景图 | 拆成独立 `<XImage>` 挂 `scrollContent` 内头部;**用 Figma 事实固定尺寸而非 `absoluteFillObject` / `%`**(父 `minHeight` 时 `%` 会塌陷) | info |
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
- **`fixed-` / `end-` / `input-` 前缀语义**:同 h5,只是输出退化(见上文「rn 页面根强制骨架 + fixed-* 分层」;`end-` 仍走 wrapper + space-between)

## rn SKILL 特有的执行步骤

| 步骤 | 与 h5 差异 |
|------|-----------|
| §-1 探针 | 同 h5(figma.mjs 是复制的) |
| §0 读配置 | 多读 `adapter` 段 |
| §0.3 缓存 | 完全同 h5(缓存 fileKey 无关 target) |
| §0.5 doctor | **移除**(rn 不接卫星) |
| §1 解析 URL | 同 h5 |
| §2 拉稿 | 同 h5 |
| §2.5 页面级背景 | **大幅简化**(rn 无 body / css-modules 等分支,直接写根 View 的 backgroundColor) |
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
- **禁止**:让根 `<XView>` 直接装内容而不套 `<XScrollView>`;禁止把根或 `scrollContent` 写 `overflow: 'hidden'`(会阻止滚动);禁止把带 `fixed-` 前缀(constraints TOP/BOTTOM 贴屏语义)的节点放进 `<XScrollView>` 内部(会跟着内容滚动而非贴屏)
- **禁止**:`bg-` 铺满层用 `StyleSheet.absoluteFillObject` 或 `width/height: '100%'`(父 `minHeight` 时 `%` 值会引用父计算高度跟着塌陷);必须写 Figma 事实固定尺寸 `width: rpx(w), height: rpx(h)` + `top: 0, left: 0`

## 不在本 topic 覆盖的内容

- doctor 的体检规则 → 见 [[pp-doctor]](rn 不接,但可手动跑一遍 h5 版看规范)
- h5 版 D2C 完整规则 → 见 [[pp-d2c]]
- 通用 D2C 设计意图(如何写图层名 / Auto Layout 怎么用) → 见 `docs/design-guide.md`
- 项目级 rn config 示例 → 见 `templates/pp-d2c.rn.config.json`
