# ctrip-train-d2c 命名与实现规则

设计稿还原时的**命名规则、图层解析规则、图片/字体/单位/框架规则**参考手册。
无执行流程，直接按需查阅对应章节。

---

## 一、Config 字段速查

从 `ctrip-train-d2c.config.json` 读取，以磁盘值为准。

| 字段 | 含义 |
|------|------|
| `project.framework` | 目标框架（react / rn） |
| `project.styleFormat` | 样式方案（见下表） |
| `figma.token` | Figma Personal Access Token（REST API 切图用） |
| `images.assetsDir` | 图片下载目录 |
| `images.imageBaseUrl` | 代码中图片 src 前缀 |
| `images.preserveEffectIds` | 导出时**保留** effect / 父背景的 nodeId 列表（默认空 = 全部按 bbox 严格导出） |
| `unit.figmaBase` | 设计稿基准宽度，默认 375 |
| `unit.outputUnit` | 输出单位：px / vw / rem，默认 px |
| `unit.outputBase` | 输出基准宽度（px 模式），默认 750 |
| `unit.scale` | 换算倍数 = outputBase / figmaBase，默认 2 |
| `layers.sub` | 分块前缀，默认 `sub-` |
| `layers.block` | 独立块前缀，默认 `block-` |
| `layers.img` | 图片前缀，默认 `img-` |
| `layers.bg` | 背景图前缀，默认 `bg-` |
| `layers.bgColor` | 背景色前缀，默认 `bgc-` |
| `layers.font` | 文字前缀，默认 `font-` |
| `layers.but` | 可点击前缀，默认 `btn-` |
| `layers.scrollX` | 横向滚动，默认 `scrollx-` |
| `layers.scrollY` | 纵向滚动，默认 `scrolly-` |
| `layers.fixed` | 视口固定，默认 `fixed-` |
| `layers.end` | 逆向布局（贴父末端），默认 `end-` |
| `layers.ignore` | 忽略，默认 `x-` |
| `output.dir` | 代码输出根目录 |

### styleFormat 取值表

**React 项目**：

| styleFormat | 文件 | import | className |
|------------|------|--------|-----------|
| `scss` | `index.scss` | `import './index.scss'` | `className="card"` |
| `scss-modules` | `index.module.scss` | `import styles from './index.module.scss'` | `className={styles.card}` |
| `less` | `index.less` | `import './index.less'` | `className="card"` |
| `less-modules` | `index.module.less` | `import styles from './index.module.less'` | `className={styles.card}` |
| `css` | `index.css` | `import './index.css'` | `className="card"` |
| `css-modules` | `index.module.css` | `import styles from './index.module.css'` | `className={styles.card}` |
| `tailwind` | 无独立样式文件 | — | `className="flex gap-4 p-8"` |
| `inline` | 无独立样式文件 | — | `style={{display:'flex'}}` |

**React Native 项目**：`stylesheet` / `styled-components` / `nativewind`

---

## 二、图层前缀语义

前缀从 config `layers` 读取，下文用默认值示意。

### 前缀语义表

| 前缀 | 语义 | 对代码的影响 |
|------|------|------------|
| `x-` | 忽略 | 跳过整个图层，**优先级最高** |
| `sub-` | 分块边界 | 仅用于分块判断，不影响渲染 |
| `block-` | 独立布局块 | 作为独立根元素，CSS 类名以块名做命名空间 |
| `img-` | 图片 | 生成 `<img>`，**不再向内递归** |
| `bg-` | 背景图 | 图片写入**父元素** `background-image`，自身不生成 HTML，**不递归** |
| `bgc-` | 背景色/盒级装饰 | fills/strokes/cornerRadius/effects 写入**父元素** CSS，自身不生成 HTML |
| `btn-` | 可点击区域 | 在内容外包一层可点击容器 |
| `font-` | 文字 | 生成文字节点，继续递归 |
| `scrollx-` | 横向滚动容器 | `overflow-x: auto` + 隐藏滚动条，**继续递归子层** |
| `scrolly-` | 纵向滚动容器 | `overflow-y: auto` + 隐藏滚动条，**继续递归子层** |
| `fixed-` | 视口固定定位 | 在容器加 `position: fixed`，可与 `sub-/block-/btn-/img-/font-/scrollx-/scrolly-` 叠加 |

**无前缀兜底**：TEXT 图层 → 文字节点；其他 → `<img>`，不递归。

### 多前缀组合优先级

1. 含 `x-` → 直接跳过
2. 含 `img-` → 生成 `<img>`，立即停止，不递归任何子层
3. 含 `bg-` → 图片写父元素 `background-image`，自身不生成 HTML，不递归
4. 含 `bgc-` → 属性写父元素 CSS，自身不生成 HTML
5. 提取 `btn-` → 记录"需要包可点击容器"
6. 提取 `scrollx-` / `scrolly-` → 记录"需要包滚动容器"，继续递归子层
7. 提取 `font-` → 生成文字节点
8. 无内容前缀 → 走兜底规则
9. 有 `btn-` → 把渲染结果包裹在可点击容器内
10. 有 `scrollx-` / `scrolly-` → 给当前容器加 overflow 样式（不新增 wrapper）
11. 有 `fixed-` → 在最终容器上加 `position: fixed` + constraints 推断定位值

---

## 三、bg- 规则

### 切图源约束

`bg-` 切图时 `/v1/images` 的 `ids=` 参数**必须是 `bg-` 节点自己的 nodeId**，不允许用父容器 nodeId。

| 情况 | ❌ 错误 | ✅ 正确 |
|------|--------|--------|
| 父 `card` 含 `bgc-框` + `bg-bg` + 文本 | 把整个 `card` 节点切成 PNG | 切 `bg-bg` 节点本身；`bgc-框` 取 fill 色值写 CSS；文本独立处理 |

**切 `bg-` 前必须输出自检 4 行**：

```
· 切图源 nodeId：{bgNodeId}（必须是带 bg- 前缀的节点本身，不是父容器）
· 切图源 name：{bgNodeName}（必须以 bg- 开头）
· 父容器内是否还有 bgc-？{是/否}；若是 → bgc- 取 fill 色值单独写 background-color，不参与切图
· 父容器内是否还有其他 sub-/block-/img-/font-/btn-/文本？{是/否}；若是 → 它们独立处理，不参与切图
```

任意一项答错即停下重做。

### CSS-able 自检（切 bg- 前必做）

先调 `get_design_context(fileKey, bgNodeId)` 拿 fills/strokes/effects/cornerRadius，判断是否改用 CSS：

| 节点属性 | 判定 | 行动 |
|---------|------|------|
| fills 全是 SOLID / 单层 GRADIENT_LINEAR / GRADIENT_RADIAL，strokes 空或 SOLID，effects 空或单一 DROP_SHADOW，子树无嵌套形状/位图 | **CSS 完全可表达** | **不切图**，按 bgc- 规则处理，输出告警 |
| fills 含 IMAGE / 多层渐变叠加 / 子树含形状（boolean / vector / mask） | CSS 表达不了 | 走正常切图流程 |

告警格式（命中时强制输出）：

```
⚠️ bg- 节点 CSS-able 检测命中
   节点: {bgNodeName} ({bgNodeId})
   原因: fills={SOLID/GRADIENT_LINEAR}, strokes={...}, effects={DROP_SHADOW}, 子树纯净
   行动: 跳过切图，按 bgc- 规则用 CSS 实现
```

### bg- 子树内嵌 bgc- 的处理

切 `bg-` 前必须扫描子树，查找 `bgc-` 节点：

| 子树 bgc- 数量 | 处理 |
|--------------|------|
| **0 个** | 正常切图 |
| **1 个** | 把这个 bgc- "摘出来"，按 bgc- 规则写到 bg- 的父元素；bg- 子树其他装饰随 bg- 整体切图；输出告警"建议把 bgc- 改为 bg- 的兄弟节点" |
| **≥ 2 个** | 取第一个按上述处理，其余忽略，输出 error 级告警 |

**兄弟有 bgc- 时**：兄弟 bgc- 优先走正常 bgc- 流程；bg- 子树内嵌的 bgc- 不再单独取值（位图里它是切图的物理副产物，CSS 端不重复声明）。

---

## 四、bgc- 规则

`bgc-` **绝对不切图**，永远只取节点自身的盒级 CSS 属性写到**父元素**。

取值流程：调用 `get_design_context(fileKey, bgcNodeId)`，按下表映射到父元素 CSS：

| Figma 属性 | CSS 属性 |
|-----------|---------|
| `fills[*].type === 'SOLID'` | `background-color: #xxx` |
| `fills[*].type === 'GRADIENT_LINEAR'` | `background-image: linear-gradient(...)` |
| `fills[*].type === 'GRADIENT_RADIAL'` | `background-image: radial-gradient(...)` |
| `fills[*].type === 'IMAGE'` | 错误：报错提示改成 `bg-` |
| 多重 fills | `background` 复合属性按 Figma 渲染顺序合成 |
| `strokes[*].position === 'OUTSIDE'` | `outline: {weight}px solid #xxx`（gradient stroke 退化为 `box-shadow: 0 0 0 {weight}px ...`） |
| `strokes[*].position === 'INSIDE'` | `border: {weight}px solid #xxx` + `box-sizing: border-box` |
| `strokes[*].position === 'CENTER'` | 退化为 `outline` 偏移一半，QA 标注 |
| `cornerRadius` / `rectangleCornerRadii` | `border-radius` |
| `effects[*].type === 'DROP_SHADOW'` | `box-shadow` |
| `effects[*].type === 'INNER_SHADOW'` | `box-shadow: inset ...` |
| `effects[*].type === 'LAYER_BLUR'` | `filter: blur(Xpx)` |
| `effects[*].type === 'BACKGROUND_BLUR'` | `backdrop-filter: blur(Xpx)` |

---

## 五、fixed- 规则

`fixed-` 是定位修饰前缀，只改 `position` 属性。

**top/bottom/left/right 取值**：调 `get_design_context(fileKey, fixedNodeId)` 拿 `constraints`：

| Figma constraint | CSS |
|------------------|-----|
| `vertical: 'TOP'` | `top: <figma top × scale>px` |
| `vertical: 'BOTTOM'` | `bottom: <(viewport.h - figma bottom) × scale>px` |
| `vertical: 'CENTER'` | `top: 50%; transform: translateY(-50%)` |
| `vertical: 'TOP_BOTTOM' / 'SCALE'` | 退化为 `top` + QA 告警 |
| `horizontal: 'LEFT'` | `left: <figma left × scale>px` |
| `horizontal: 'RIGHT'` | `right: <(viewport.w - figma right) × scale>px`（viewport.w = `unit.figmaBase`） |
| `horizontal: 'CENTER'` | `left: 50%; transform: translateX(-50%)` |
| `horizontal: 'LEFT_RIGHT' / 'SCALE'` | 退化为 `left` + QA 告警 |

- z-index 默认 100，多个 fixed- 按设计稿前后顺序递增（100/101/102…）
- 未设 constraints → 按 absoluteBoundingBox 算 left/top，**强制 QA 告警**

---

## 六、scrollx- / scrolly- 规则

- 同一节点只能含一个方向，同时含 `scrollx-` 和 `scrolly-` → 按 `scrollx-` 处理 + QA 标注
- 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 互斥
- 容器必须有被限定的宽度（横）或高度（纵），否则 overflow 不触发（生成代码但 QA 标注）
- **必须继续递归子层**，禁止整体导出为背景图

生成的容器样式（以横向为例）：

```scss
.container {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  > * { flex-shrink: 0; }
}
```

---

## 七、图片导出

### L0 主路径（figma.token 非空时，必须走此路径）

```bash
# PNG 2倍图，严格按 bbox（不含 effect / 父背景色）
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2&use_absolute_bounds=true" \
  -o {projectRoot}/{assetsDir}/{filename}.png

# SVG（矢量图层优先）
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=svg&use_absolute_bounds=true" \
  -o {projectRoot}/{assetsDir}/{filename}.svg
```

`-o` 路径必须是 `{projectRoot}/{assetsDir}/{filename}.{ext}` 绝对路径，禁止相对路径。

### 兜底链（token 缺失或 L0 实际返回 401/403 时才启用）

| 级别 | 动作 | 何时用 |
|------|------|--------|
| **L0** | REST API + token（上方 curl） | token 非空时必须走，无论 MCP 是否可用 |
| **L1** | MCP `download_assets` → 返回的 url 用 curl 拉下来存本地 | 仅限 token 为空，或 L0 实际失败后——**token 存在就不允许跳过 L0 直接走 L1** |
| **L2** | `download_assets` 的 url 作为 `<img src>` 占位（仅用户明确说"先跑通"） | L1 也失败 |
| **L3** | 终止，提示用户检查 token 与 MCP | 全失败 |

走 L1 后 QA 必须输出：

```
⚠️ Token 不可用，本次走 MCP download_assets 兜底导出（{N} 张）
   · 未应用 use_absolute_bounds=true，可能带画板背景 / effect 外扩
   · 受影响文件：{filename1}, {filename2}, ...
```

### use_absolute_bounds=true 说明

不带此参数，Figma 会把图层 effect（drop-shadow / outer-stroke / blur）和父背景色一起 render 进 PNG，导致：
- 图带画板背景色
- gap/margin 算不准（PNG 比 bbox 大一圈）

仅当 config `images.preserveEffectIds` 列出该 nodeId 时才省略此参数。

### 格式选择

- 矢量图层（Vector / Icon / 无栅格内容）→ SVG
- 其他 → PNG 2倍图

### 文件命名

图层名去掉所有已知前缀后转 kebab-case：

| 图层名 | 去前缀后 | 文件名 |
|--------|---------|--------|
| `img-hero-bg` | `hero-bg` | `hero-bg.png` |
| `bg-body` | `body` | `body.png` |
| `btn-img-submit-btn` | `submit-btn` | `submit-btn.png` |

- 去前缀后为空 → 用图层原始名转 kebab-case
- 同目录重名 → 追加父图层名前缀区分
- **禁止**用 Figma node ID 或数字序号作文件名

### 图片 URL 公式

代码中图片地址的**唯一公式**：

```
src = imageBaseUrl + assetsDir + filename
```

- 不补/删任何字符（含末尾 `/`）
- SCSS 中必须先定义 `$asset-prefix` 变量再引用，禁止分散硬编码完整 URL

---

## 八、字体（阿里巴巴普惠体）

Bold / Heavy 统一使用固定 CDN，不下载到本地：

| Figma 字重 | font-family | URL |
|-----------|-------------|-----|
| Bold | `AlibabaPuHuiTi-Bold` | `https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Bold.woff2` |
| Heavy / Black | `AlibabaPuHuiTi-Heavy` | `https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Heavy.woff2` |

**@font-face 声明**（写在页面根样式，每个 family 只声明一次）：

```scss
@font-face {
  font-family: 'AlibabaPuHuiTi-Bold';
  src: url('https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Bold.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'AlibabaPuHuiTi-Heavy';
  src: url('https://images3.c-ctrip.com/train/activity/fonts/AlibabaPuHuiTi-Heavy.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

其他字重（Regular / Medium / Light 等）退化为系统字体栈，在 QA 中标注。

---

## 九、单位换算

**公式**：`输出值 = Figma值 × scale`（scale = outputBase / figmaBase）

| outputUnit | 写法 | 示例（Figma=16, scale=2） |
|------------|------|--------------------------|
| `px` | 直接写 px | `32px` |
| `vw` | `Figma值 × scale / outputBase × 100` vw | `4.267vw` |
| `rem` | `Figma值 × scale / outputBase` rem | `32/750rem` |

默认配置（figmaBase=375, outputBase=750, outputUnit=px, scale=2）：Figma `16px` → 生成 `32px`。

**禁止直接把 Figma 原始值写入代码**，所有尺寸必须经过换算。

---

## 十、框架适配

| framework + styleFormat | 组件语法 | 样式输出 |
|------------------------|---------|---------|
| react + scss | TSX + className | `.scss` |
| react + scss-modules | TSX + styles.xxx | `.module.scss` |
| react + less | TSX + className | `.less` |
| react + less-modules | TSX + styles.xxx | `.module.less` |
| react + css | TSX + className | `.css` |
| react + css-modules | TSX + styles.xxx | `.module.css` |
| react + tailwind | TSX + className | 无独立样式文件 |
| react + inline | TSX + style={{}} | 无独立样式文件 |
| rn + stylesheet | RN JSX | `StyleSheet.create({})` |
| rn + styled-components | styled-components/native | 无独立样式文件 |
| rn + nativewind | TSX + className | 无独立样式文件 |

---

## 十一、布局规则

- 默认使用 **flex 布局**，不使用 `position: absolute`
- Auto Layout 的间距用 `gap` / `padding` 还原
- 无 Auto Layout 的 Frame 推断排列方向，用 `flex-direction` 还原
- 只有明确的浮层/弹窗/角标才允许 `position: absolute`

---

## 十二、禁止项

- 禁止把 `img-` / `bg-` 前缀图层拆解为 CSS 实现
- 禁止使用 Figma node ID 或数字序号作为图片文件名
- 禁止 `x-` / `img-` / `bg-` / 无前缀非文本图层向内递归子图层
- 禁止只匹配第一个前缀就停止，必须扫描完整图层名提取所有已知前缀
- 禁止脱离 `imageBaseUrl + assetsDir + filename` 公式拼接图片 URL
- 禁止在 SCSS 中分散硬编码完整 URL（必须先定义 `$asset-prefix` 变量）
- 禁止直接把 Figma 原始值写入代码，所有尺寸必须经过换算
- 禁止把 `bgc-` 节点切成 PNG（永远只取属性写 CSS）
- 禁止只取 `bgc-` 节点的 fills 而忽略 strokes/cornerRadius/effects
- 禁止父容器同时有 `bgc-` 和 `bg-` 时只写 `background-image` 不写 bgc- 的其他属性
- 禁止 `figma.token` 存在且非空时使用 MCP `download_assets` 导出图片（token 有效必须走 L0）
- 禁止调用 `/v1/images` 时省略 `use_absolute_bounds=true`（除非 nodeId 在 `preserveEffectIds` 中）
- 禁止把 `bg-` 节点的父容器当成切图源（切图源 nodeId 必须是 `bg-` 节点自己）
- 禁止 `scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存
- 禁止同一节点同时含 `scrollx-` 和 `scrolly-`
- 禁止把 `sub-scrollx-` / `sub-scrolly-` 节点整体导出为背景图（必须递归子层）
- 禁止省略滚动容器的隐藏滚动条样式（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）
- 禁止 `fixed-` 与 `bg-` / `bgc-` / `x-` 叠加
- 禁止 `fixed-` 节点省略 z-index
- 禁止组件函数名、组件文件目录名以 `sub-` / `Sub` 开头：图层名 `sub-foo` 对应的组件函数名必须去掉 `sub-` 前缀后再转 PascalCase（`sub-card` → `Card`，`sub-login-form` → `LoginForm`），目录名保留原始图层名（`blocks/card/`）用于文件系统寻址，函数名严禁带 `sub-` 前缀
- 禁止把阿里巴巴普惠体 woff2 下载到本地 assetsDir
- 禁止在多个 block 样式里各自重复 `@font-face`（集中到页面根样式声明一次）
- 禁止用相对路径下载图片（`-o` 必须是绝对路径）
