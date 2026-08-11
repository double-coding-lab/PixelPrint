---
id: pp-d2c
revision: 0
summary: pp-d2c
primary: policy
confidence: inferred
tags: [feature, config]
---
# pp-d2c

> D2C 主 SKILL（`templates/skills/pp-d2c/`）的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md（共约 770 行），本 topic 是路由摘要 + 关键边界，不重复长篇内容。

## 适用场景 / 触发词

- 用户提供 Figma 设计稿 URL 并说"还原"、"D2C"、"生成代码"
- 维护者修改主 SKILL 时定位读哪几节
- 排查"切出来的图带画板背景色 / 光晕 / 间距对不上 / 列表被压平成背景图 / token 过期生成失败 / bg- 套 bgc- 揉到一张图 / 描边丢失 / `doctor.run()` 函数找不到"等典型 bug

## SKILL.md 是给 LLM 读的操作手册，不是可执行代码（v0.2 关键澄清）

主 SKILL.md 和 doctor SKILL.md 全篇都是**自然语言指令**。文档里出现的 `doctor.run({...})`、`return { passed, ... }`、`派发新 sub-agent`、`sub-agent 上报` 等表述全是**伪代码/隐喻**，不是真函数调用、不是真多进程通信。

**全程只有一个 LLM agent**（执行的 Claude），它按 SKILL 步骤顺序：
- Read 各 SKILL.md 当操作手册读
- 调 MCP 工具（Figma get_metadata / get_screenshot / get_design_context、文件读写）
- 在对话里产出文本（代码、JSON 摘要、报告、决策）

唯一真正"被执行"的是 MCP 工具调用和文本输出。其余"调用"、"派发"、"返回"全部由 agent 自己按文档说明顺序操作完成。

**典型映射**（详见主 SKILL 顶部「执行模型说明」表）：

| 文档表述 | 实际操作 |
|---------|---------|
| 主 SKILL §0.5 `doctor.run({fileKey, nodeId, mode:'integrated'})` | 当前 agent Read doctor SKILL.md，按其 §-1 → §5.4 步骤执行，最后输出 §5.4 描述的 JSON 摘要到对话 |
| doctor §5.4 `return { passed, ... }` | 当前 agent 在对话里输出该 JSON 字符串；主 SKILL 后续步骤从同一对话上下文读这段 JSON 继续推进 |
| 主 SKILL §4.0.5 "派发新 sub-agent" | 当前 agent 重新进入 §4.0 流程，把根节点重置为新 nodeId、depth +1，重走一遍 |
| §4.0.5 "sub-agent 上报" | 当前 agent 把 subslots.json 内容**写到真实磁盘文件**（与 assets.txt 同级），下一轮读这个文件继续 |
| `<__SUBSLOT__ nodeId="..." />` | **真实字符串**，要字面写进 JSX 文件作占位符；§5.0 合并时再字面替换 |

**误读后果**：把伪代码当真函数会**卡死流程**（等待一个永远不到来的"返回值"），或**绕过关键步骤**（"既然 SKILL 里说 `doctor.run()` 就行，那直接跳到 §1"）。

## 与 doctor 的分工（必读）

主 SKILL `pp-d2c` 与 doctor `pp-doctor`（见 [[pp-doctor]]）是**协作但独立**的两条流程：

| 层级 | 关注 | 产物 |
|------|------|------|
| **doctor** | 体检设计稿是否符合命名/布局/结构约定 | `.d2c-health-*.md` 报告 + 阻塞决策 |
| **主 SKILL** | 解析图层、分发 sub-agent、生成 JSX/SCSS、下载图片 | 完整可运行的页面代码 |

**集成关系**：主 SKILL 步骤 0.5 在 `health.enabled=true` 时**调用** doctor 做集成体检，根据返回的 `passed` 决定是否阻塞生成（详见 SKILL.md §0.5）。doctor 的内部规则不影响主 SKILL 的生成逻辑——两者各自独立可读，**无强 dependency**。

## 关键执行约束（按重要度排序）

### 1. 图片导出必须带 `use_absolute_bounds=true`（v0.2 必须）

**位置**：SKILL.md §477-501（含 v0.2 修订说明）。

```bash
curl -H "X-Figma-Token: {figma.token}" \
  "https://api.figma.com/v1/images/{fileKey}?ids={nodeId}&format=png&scale=2&use_absolute_bounds=true"
```

**忽略此参数会同时触发两个 bug**：
- "图都带画板背景色"——Figma 默认导出包含父容器 fills，PNG 里印着上一级背景色
- "切图带光晕 / gap 算不准"——默认导出包含图层 effect（drop-shadow / outer-stroke / blur）的可见外扩，PNG 比 bbox 大一圈，CSS 对齐用的负 margin 必须人为放大才能视觉贴合（设计稿 -25px 实际写 -50px 是错的，根因就是这个）

**例外**：仅当某张图就是要把 effect 烤进位图（极少，例如复杂渐变蒙版），把 nodeId 列入 config `images.preserveEffectIds` 数组。

### 2. `sub-scrollx-` / `sub-scrolly-` 禁止整体导出（v0.2 新增）

**位置**：SKILL.md §463-470（自检 4 行）+ §728（禁止项）。

scroll 容器的子层是**同构列表项**（`.map()` 渲染），按主 SKILL §416-417 必须**继续递归子层**。sub-agent 偷懒把整个 scroll 容器当作 `bg-` 整张导出（生成 `tripList { background-image: url(bg-list.png) }`）会让运行时无法绑定数据、列表内容变成静态图。

sub-agent 在生成 scroll 容器代码前**必须输出自检 4 行**：

```
· 子层数：{N}
· 同构判断：{是否 ≥ 2 个同名 / 同结构子层} → {是 = .map() 渲染 / 否 = 异构内容逐个生成}
· 背景层来源：{bgc- 子节点 / bg- 子节点 / 父层 fills / 无} → 不允许"无来源时 fallback 整体导出"
· 内部 DOM 节点数（不含背景）：{M}（M 必须 ≥ N，否则说明把列表项压平了，回头重写）
```

任意一项无法明确填写 → **停下问主 agent，不允许猜测后整体导出**。

### 3. Token 过期兜底链 L0→L1→L2→L3（v0.2 新增）

**位置**：SKILL.md §4.4.1。

| 级别 | 动作 | 触发 |
|------|------|------|
| **L0** 主路径 | REST API + `figma.token`（带 `use_absolute_bounds=true`） | 默认 |
| **L1** 兜底 | 调用 MCP `download_assets`，curl 下载返回的 `url` 到本地 | L0 返回 401/403/`invalid_token`/超时；或 token 为空 |
| **L2** 兜底 | 退化用 MCP url 直接进 `<img src>` + 红色 QA 告警 | L1 也失败（极少） |
| **L3** | 终止，让用户介入 | 全失败 |

**关键 trade-off**：MCP `download_assets` **不支持** `use_absolute_bounds`，走 L1 兜底拿到的图会重新带回"画板背景色 + 光晕外扩"两个副作用。这不是退步，是 token 不可用时的能力上限。**强制 QA 段落输出告警**，列出受影响文件名 + 提示"补 token 后用 L0 重跑能彻底解决"。

**禁止**（v0.2 修订旧约定）：
- ❌ 禁止 token 过期时跳过下载（旧版写的"用 MCP 临时链接占位"作废——临时链接 24h 过期，代码上线就 404）
- ❌ 禁止 MCP 临时链接（`figma.com/api/mcp/asset/...`）直接进 `<img src>`，只能作为下载源
- ❌ 禁止 L1 走通后省略 QA 告警

### 4. bgc- 覆盖父元素全套盒级 CSS 属性（v0.2 修订，范围扩展）

**位置**：SKILL.md §`bgc-` 取值规则。

旧规则只让 bgc- 取 fills，导致设计师把"渐变填充 + 描边 + 圆角 + 阴影"理解为"一个 bgc-"是合理的（这就是父级 box 的全套装饰），但生成端描边/圆角/阴影全丢。**v0.2 起 bgc- 覆盖**：

| Figma 属性 | CSS 属性 |
|-----------|---------|
| `fills` SOLID / GRADIENT_LINEAR / GRADIENT_RADIAL | `background-color` / `background-image: linear-gradient(...)` / `radial-gradient(...)` |
| `strokes` Outside | `outline: {weight}px solid #xxx`（不影响盒模型，向外延伸） |
| `strokes` Inside | `border: {weight}px solid #xxx` + `box-sizing: border-box`（占用内部空间） |
| `strokes` Center | 没有完美对应，退化 outline 偏移一半 + QA 标注 |
| `cornerRadius` / `rectangleCornerRadii` | `border-radius` |
| `effects` DROP_SHADOW / INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR | `box-shadow` / `box-shadow: inset` / `filter: blur()` / `backdrop-filter: blur()` |

所有属性写到 **bgc- 的父元素**（bgc- 不生成独立 HTML）。

### 5. bg- 内嵌 bgc- 的"摘出来"处理（v0.2 新增）

**位置**：SKILL.md §`bg-` 内嵌 `bgc-` 的处理。

切 bg- 前**必须**扫描子树（递归全部子孙）查找 bgc-：

| 子树 bgc- 数 | 处理 |
|-------------|------|
| 0（推荐结构） | 正常切 bg- |
| 1 | 把这个 bgc- "摘出来"按 §4 全套规则写父元素 CSS；bg- 子树其他装饰随 bg- 整体切图（Figma `/v1/images` API 限制无法切图时排除子节点）；输出告警 |
| ≥ 2 | 取第一个 bgc-，其余忽略，输出 error 级告警 |

**bg- 兄弟也有 bgc- 时的优先级**：兄弟 bgc- 优先（更符合"父级 CSS 属性"语义），嵌套那个 bgc- 的 CSS 属性不重复声明，避免和兄弟 bgc- 打架。doctor NAM013 仍 warn 提示嵌套那个应改成兄弟。

**Figma API 物理限制**：`/v1/images` 不支持切图时排除某个子节点，所以 bg- 内嵌 bgc- 时位图里仍有 bgc- 视觉副本（渐变 + 描边都烤进去）——CSS 端的属性会盖在最上层，视觉对齐 OK，但位图体积浪费。要彻底干净只能让设计师把 bgc- 移出 bg- 子树。

### 6. bg- 切图前的 CSS-able 自检（v0.2 新增）

**位置**：SKILL.md §`bg-` 切图前的"CSS-able 自检"。

切 bg- 之前**必须** `get_design_context` 拿节点完整属性，按下表判定该节点是不是其实更适合用 CSS 实现：

| 条件（全部满足才命中 CSS-able） | 行动 |
|-------------------------------|------|
| fills 全是 SOLID / GRADIENT_LINEAR / GRADIENT_RADIAL，无 IMAGE | 命中 → **跳过切图**，按 bgc- 规则用 CSS 实现 + 输出告警建议改名为 bgc- |
| strokes 空或全是 SOLID | |
| effects 空或单一 DROP_SHADOW（INNER_SHADOW/LAYER_BLUR/BACKGROUND_BLUR 让节点 CSS-unable） | |
| 子树纯净（无可见子节点） | |

**为什么必须做**：位图渲染的渐变会因缩放产生 banding（视觉劣化）；含 effects 时切出来的 PNG 边缘会"沾染"画板底色泄漏的视觉假象（实际是渐变浅色端 + 描边在圆角抗锯齿处的混合）；位图无法运行时主题切换。

### 7. `fixed-` 视口固定定位（v0.2 新增）

**位置**：主 SKILL §`fixed-` 定位规则（§4.3 末尾） + doctor §3.6d NAM014 + §3.9e LAY013。

`fixed-` 是**定位修饰前缀**——只改 `position`，不决定渲染方式。可与所有"生成节点"的前缀叠加（`sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-`），**不可**与"不生成节点"的前缀叠加（`bg-`/`bgc-`/`x-`，doctor NAM014 命中后 error）。典型用途：吸顶 nav、吸底 tab、悬浮回顶按钮、固定浮层入口。

**top/bottom/left/right 取值**（依赖 Figma `constraints`，**不是**直接读坐标）：

| Figma constraint | CSS 写法 |
|------------------|---------|
| `vertical: 'TOP'` | `top: <figma top>px` |
| `vertical: 'BOTTOM'` | `bottom: <viewport.h - figma bottom>px` |
| `vertical: 'CENTER'` | `top: 50%; transform: translateY(-50%)` |
| `horizontal: 'LEFT'` / `'RIGHT'` / `'CENTER'` | 同理（参见 SKILL §`fixed-` 定位规则表） |

设计师没设 constraints 时退化为绝对坐标，**强制 QA 告警**。

**已知 CSS 副作用 LAY013（warn）**：祖先链有 `transform` / `filter` / `perspective` 时，子代 `position: fixed` 退化为"相对该祖先定位"。生成端**不自动用 Portal 外挂**（重量副作用），由设计师把 fixed- 节点上提到根 frame 或祖先去掉 transform；业务必须保留祖先效果时由开发手动加 React Portal。

**z-index 默认 100**：同页面多个 fixed- 按设计稿前后顺序递增（100/101/102…），sub-agent 在 QA 段落标注实际取值。

**典型踩坑（doctor NAM014 阻止）**：
- ❌ `fixed-bg-banner`：bg- 不生成节点，fixed- 落空
- ❌ `fixed-bgc-header`：同上
- ❌ `fixed-x-mark`：x- 跳过，fixed 失效
- ✅ 想做"固定背景"：把 fixed- 加在**父节点**上（如 `fixed-sub-banner` 里再放 `bg-banner`）

### 8. `end-` 逆向布局（贴父末端，v0.3.2 新增）

**位置**：主 SKILL §`end-` 逆向布局规则（§4.3 fixed- 章节后） + doctor §3.6e NAM016 + §3.9f-i LAY017/018/019/020。

`end-` 是**定位修饰前缀**——表达"该节点在父 autoLayout 里贴向末端"。方向由父 `layoutMode` 决定：父 `VERTICAL` → 贴底；父 `HORIZONTAL` → 贴右。可与所有"生成节点"前缀叠加（`sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-`），**不可**与"不生成节点"前缀叠加（`bg-`/`bgc-`/`x-`，doctor NAM016 命中后 error）。

**主线机制（唯一实现路径）**：wrapper + `justify-content: space-between`。父容器把 end- 节点前面的所有兄弟包一层虚拟 wrapper（className 用父类名 + `__front-group`，不写 data-node-id），父 CSS 设 `justify-content: space-between`，天然把 end- 推到末端。end- 节点本身保持原生成逻辑不变。

```jsx
<parent>                          {/* justify-content: space-between */}
  <wrapper-of-front>              {/* v0.3.2 虚拟 wrapper */}
    <A /> <B /> <C />
  </wrapper-of-front>
  <D />                           {/* end- 节点，贴到父末端 */}
</parent>
```

**与 `fixed-` 的区别**：`fixed-` 相对**视口**贴边，`end-` 相对**父容器**贴末端。两者同现（`fixed-end-x-btn`）时 fixed- 优先，end- 忽略（doctor LAY020 warn）。

**触发前提**（doctor 校验四类不合规）：
- `end-` 必须是父的**最后一个可见子**（LAY017 error，不在末位）
- 同一父下**只允许一个** `end-` 子（LAY018 warn，多个只有末位生效）
- 父必须是 autoLayout（LAY019 error，`layoutMode` 缺失 / `NONE` 时无方向可判）
- 不与 `fixed-` 同现（LAY020 warn）
- 不与 `bg-` / `bgc-` / `x-` 同现（NAM016 error，不生成节点无法应用）

**父容器主轴必须有确定长度**：`space-between` 只有在父 `layoutSizingHorizontal/Vertical: FIXED` / `FILL` 时才能真正把 end- 推到末端；父是 `HUG`（内容撑开）时会退化——**强制 QA 告警**，建议父改 FIXED / FILL 或根容器加 `min-height: 100vh`。

**典型场景**：底部品宣（`end-img-pinxuan`）在设备高度大于设计稿基准时贴屏底；两栏按钮组"取消 / 确认"分居左右（`[btn-cancel, end-btn-confirm]` 父 `HORIZONTAL`）；卡片头右侧"更多 >"链接（`[title, end-more]` 父 `HORIZONTAL`）。

### 9. 页面根容器 `min-height: max(..., 100vh)`（v0.3.3 新增）

**位置**：主 SKILL §4.1.1 §A 表 FIXED 行例外 + §4.3 判定优先级第 6 条 + §6.0 checklist 第 9 项。

**痛点**：D2C 默认把 Figma 顶层 Frame 的高度死值（例如 812 × 2 = 1624px）翻译成 `min-height: 1624px`。设备视口 >1624px 时，页面底下露白（项目全局兜底色）；`end-` 前缀的贴屏底效果也失效（只贴到 1624 那个死高度的底部,不是屏幕底部）。

**判定"页面根容器"3 信号 AND**（缺一不成立）：

| 信号 | 内容 | 用途 |
|------|------|------|
| A | 该节点是主 agent `fetchNode` 入口 nodeId 本身（不是子孙） | 排除 sub-agent 派发进来的内层 block |
| B | 父在 Figma REST 里查不到 或 父 `type` 是 `PAGE`/`DOCUMENT`/`CANVAS` | 排除嵌套在其他 Frame 里的次级容器 |
| C | `absoluteBoundingBox.height` ≈ 视口常见值（667/736/812/844/896/926/932/1024，±20 容差） | 排除长图页面（例如 375×2000） / 卡片子模块 |

**命中后覆写**：

```scss
.root {
  /* 保留 1-5 判定产出的 CSS(flex/gap/padding/align-items) */
  min-height: max({figmaH * scale}px, 100vh);   /* 至少设计稿高度,长屏撑到 100vh */
  width: {figmaW * scale}px;                    /* 宽度死值保留 */
  margin: 0 auto;
  position: relative;                           /* 若已存在保留 */
}
.root__bg {                                     /* 根内部 layoutPositioning:ABSOLUTE 的 bg- 层 */
  position: absolute;
  inset: 0;                                     /* 覆写 top:0 left:0 width/height:{死值} */
  background-size: cover;                       /* 从 {w}px {h}px 改成 cover */
  background-position: top center;
}
```

**为什么放在判定优先级第 6 条（覆写位而不是分支）**：本条不改变 1-5 对根容器**内部结构**的判定（是 flex 还是 flex、padding 还是 padding），只覆写高度和背景。所以先走完 1-5 拿到基础 CSS，再叠加本条覆写。

**与 `end-` 的联动**：`end-` 想真正贴屏底，必须依赖根容器能撑到 `100vh`；否则 `space-between` 只把 end- 推到 1624px 的底部而不是屏幕底部。两条规则组合起来才能做到"长屏时 end- 贴屏底"。

**豁免场景**（3 信号任一不成立时走普通 FIXED 规则，不覆写）：
- Sub-agent 单独处理某个 block 时（信号 A 命中但 C 因高度不匹配排除）
- URL 直接指向非根子节点（例如 `?node-id=163-2302` 指向 `sub-cardopen`，信号 C 排除）
- 长图页面（例如 375×2000，信号 C 排除，死值 `min-height: 4000px` 是正确的）

### 10. `input-` 输入框（v0.3.4 新增）

**位置**：主 SKILL §`input-` 输入框规则（§4.3 end- 章节后） + doctor §3.6f-i NAM017/018/019/020。

`input-` 是**独立前缀**（决定生成什么元素,不是修饰）。命中即输出 `<input type="text">` 标签,**不再向内递归**（子层 TEXT/vector 都被消化用于填 placeholder/icon）。可与 `fixed-`/`end-`/`sub-` 叠加,**不可**与 `bg-`/`bgc-`/`x-`（NAM019 error）或 `img-`/`btn-`（NAM020 error）叠加。

**Figma 侧图层结构约定**：

```
input-{name}              ← Frame,自身 fills(输入框底色) + strokes + cornerRadius
  ├─ [vector | RECT | 子 Frame]   ← 可选,左侧图标
  └─ TEXT "请输入..."              ← 必须,characters 是 placeholder 文本,fills 是 placeholder 颜色
```

**生成机制**：
- `<input type="text" placeholder="{TEXT.characters}" />`（单标签,无 wrapper）
- 输入框视觉从 `input-` 节点自身 fills/strokes/cornerRadius 读
- 左侧图标切图作 `background-image` + `padding-left` 腾位置(不生成独立 DOM)
- `::placeholder` 颜色取自 TEXT 子的 `fills[0]`
- 字体从 TEXT 子的 `style` 读

**doctor 校验**：
- **NAM017**（error）:input- 内无 TEXT 子层 → placeholder 无来源
- **NAM018**（warn）:input- 内 ≥2 个 TEXT → 只取第一个,其他忽略
- **NAM019**（error）:input- 与 bg-/bgc-/x- 叠加 → 不生成节点无法挂
- **NAM020**（error）:input- 与 img-/btn- 叠加 → 语义冲突,需拆父子结构

**类型限定**：v0.3.4 只支持 `<input type="text">`。密码/数字/邮箱等特殊 type 由 agent 输出 QA 告警提示手工改,不自动推断。多行输入(`textarea`)、下拉选择(`select`)本版不覆盖,后续按需扩 `layers.textarea` / `layers.select`。

**典型场景**：登录表单(手机号/密码)、订单填写(乘车人姓名/身份证/备注)、搜索框、评论框。

## 工具链注意事项（install.js / config 完整性）

**install.js `runInit()` 写 config 时必须包含完整字段**（v0.2 修订）。历史 bug：`runInit()` 只写了 project / figma / merge / unit / images / output 六大段，**漏了 layers / health / images.preserveEffectIds**，导致用户项目 config 缺关键字段。

修复后 `runInit()` 写默认字段时采用 **spread merge** 模式 `{ ...默认值, ...(existing.X || {}) }`（v0.2.1 改自原"`existing.X || 默认`"短路写法）：

- `images.preserveEffectIds`：默认 `[]`（所有图严格按 bbox 导出）
- `layers`：完整 11 类前缀（sub/block/img/bg/bgColor/font/but/scrollX/scrollY/fixed/ignore）
- `health`：enabled=true / blockOnError=true / report 段 / thresholds 全套

**升级老项目**：spread merge 让 re-init 自动补缺失字段（典型场景：老项目 layers 块没有 `fixed`，re-init 时会自动补上 `fixed: "fixed-"`），同时**用户已自定义的字段保持不变**（spread 顺序"默认在前 + 现有在后"覆盖默认值）。

> **为什么改写法**：原 `existing.layers || 默认` 是**整体短路**——只要老项目有 `layers` 块（哪怕缺 `fixed`），就完全跳过默认值，导致新加的字段补不上去。spread merge 是**字段级 merge**，加新前缀字段后 re-init 即可平滑升级所有历史项目，无需用户手改 config。

**Config 完整性自检脚本**（出问题时排查用）：

```bash
# 检查项目 config 是否含 health 段、preserveEffectIds、scrollX/fixed 前缀
cat pp-d2c.config.json | grep -E "health\.enabled|images\.preserveEffectIds|layers\.scrollX|layers\.fixed"
```

缺任何一个 → re-init 或手动补段。**老项目 `layers.fixed` 缺失最常见**（v0.2.1 才加），重跑一次 `install.js runInit()` 会自动补上。

## 配置项要点（详见 SKILL.md §0）

| 字段 | 用途 | 备注 |
|------|------|------|
| `figma.token` | REST API 鉴权 | 缺失/过期触发 L1 兜底 |
| `images.assetsDir` / `images.imageBaseUrl` | 图片 URL 拼接 | 三段字面拼接铁律，禁止补/删字符（§510-545） |
| `images.preserveEffectIds` | 例外清单 | 仅当某张图就是要烤 effect 进 PNG 时使用 |
| `health.enabled` / `health.blockOnError` | 是否在 §0.5 调用 doctor + 是否阻塞 | doctor 内部见 [[pp-doctor]] |
| `unit.figmaBase` / `unit.outputBase` / `unit.scale` | 尺寸换算 | 设计稿 → 输出代码必经路径 |
| `layers.*` | 11 类前缀（sub/block/img/bg/bgc/font/btn/x/scrollx/scrolly/**fixed**） | 多前缀组合解析见 §398-438；**fixed- 是修饰前缀**，可叠加

## 边界与禁止（高频踩坑）

- **不递归类前缀**：`img-` / `bg-` / `bgc-` / `x-` 命中即"整体导出 / 忽略",**不再向内递归**(§412-413 / §705)。子孙节点不会被生成代码——doctor 已落地这条作为"形态/容器"类规则的全局过滤标 `inNonRecursiveSubtree`
- **scroll 互斥**:`scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存禁止(§448 / §718);同节点 `scrollx + scrolly` 共存也禁止
- **sub- 单独拆 + 允许嵌套**(v0.2 修订):哪怕只有 1 个 `sub-` 节点也必须分发独立 sub-agent(§108 / §717),分块是质量保证而非性能优化;**sub- 允许嵌套**(典型场景:`sub-content / sub-card + sub-scrolly-车票列表`),深度上限 3 层,执行走"主 agent 派发 + sub-agent 上报 + placeholder 展开"链路(§107-145 / §4.0.5 / §5.0)
- **block- 不嵌套**:`block-` 是"顶层独立布局块"(§409),doctor NAM001 fix 已修订为只建议 `sub-`,不再建议 `block-`
- **fixed- 是修饰前缀**:可与 `sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-` 叠加(只改 `position: fixed`,不改渲染方式);**不可**与 `bg-`/`bgc-`/`x-` 叠加(这三个不生成节点,fixed 无处可挂——doctor NAM014 error);top/bottom 必须读 Figma constraints 推断,不是直接读坐标;祖先链有 transform/filter/blur 时 fixed 退化为相对祖先定位(doctor LAY013 warn)
- **end- 是修饰前缀(v0.3.2 新增)**:表达"贴父末端",方向由父 `layoutMode` 决定(VERTICAL→贴底 / HORIZONTAL→贴右);可与 `sub-`/`block-`/`btn-`/`img-`/`scrollx-`/`scrolly-` 叠加,**不可**与 `bg-`/`bgc-`/`x-` 叠加(doctor NAM016 error);唯一实现路径是 wrapper + `justify-content: space-between`;必须是父的最后一个可见子(LAY017 error)且父必须是 autoLayout(LAY019 error);与 fixed- 同现时 fixed- 优先(LAY020 warn)
- **页面根容器 min-height: max(..., 100vh)(v0.3.3 新增)**:3 信号 AND 判定(入口 nodeId + 父是 Page/Document + 高度接近视口),命中后覆写根 CSS min-height 为 `max({figmaH*scale}px, 100vh)`,内部 `layoutPositioning: ABSOLUTE` 的 bg- 层同步改 `height: 100%` + `background-size: cover`;不改动根内部结构判定(1-5 优先级已产出的 flex/gap/padding 保留);解决设备视口 >1624px 时页面底下露白 + end- 无法真正贴屏底的问题
- **input- 是独立前缀(v0.3.4 新增)**:生成 `<input type="text" placeholder=... />` 单标签(不包 wrapper),placeholder 取子 TEXT 节点 characters,左侧图标切图作 CSS background-image + padding-left(不生成独立 DOM);可叠加 fixed-/end-/sub-,**不可**叠加 bg-/bgc-/x-(NAM019 error) 或 img-/btn-(NAM020 error);子层无 TEXT 报 NAM017 error,多 TEXT 报 NAM018 warn;命中即停止向内递归;当前只覆盖 `<input type="text">`,textarea/select/密码/数字等 type 由 agent 输出 QA 告警提示手工改
- **页面级背景必须探测项目特征**:`*.module.{scss,less,css}` 里直接写 `body { ... }` 会被 hash 化失效;普通 stylesheet（非 module 的 scss/less/css）里写 `:global(...)` 不识别。详见 §2.5(强制不可跳过)。**v0.2.1 新增**：install.js 把样式方案拆成两题（`[2a]` 样式方式 + `[2b]` 预处理语法 + `[2c]` 是否走 module），styleFormat 取值扩展到 `scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline / RN 三选`，详见主 SKILL §0「样式方案标识符」

## 已知历史 bug 与修订（v0.2）

| 现象 | 根因 | 修订位置 |
|------|------|---------|
| 切出来的图都带紫色画板背景 | `/v1/images` 默认导出包含父 fills | §487-501 加 `use_absolute_bounds=true` |
| `bg-list.png` 把行程项内容都印进背景 | sub-agent 把 `sub-scrolly-` 整体导出 | §463-470 自检 4 行 + §728 禁止项 |
| `ticketCard` 设计稿 -25px gap 必须写 -50px 才贴合 | effect 外扩让 PNG 比 bbox 大一圈 | 同 #1，`use_absolute_bounds=true` 一并解决 |
| token 过期生成失败 / 用临时链接占位上线 24h 后 404 | 旧约定"跳过下载" | §4.4.1 新增 L0→L3 兜底链 |
| `card-bg.png` 把 bg-bg + bgc-选中框 揉成一张图，4px Outside 描边丢失 | bgc- 嵌在 bg- 子树内，旧 bgc- 规则只取 fills 丢 strokes/cornerRadius/effects | §`bgc-` 取值规则扩展 + §`bg-` 内嵌 `bgc-` 的处理 + doctor NAM004 扩展覆盖 bgc- + doctor NAM013 新增 |
| `bg-box.png` 切图带紫色"画板底色"假象 | bg-box 是简单 GRADIENT + DROP_SHADOW，应改 bgc- 用 CSS 实现，但被切成位图 | §`bg-` 切图前的"CSS-able 自检" + doctor NAM012 新增 |
| 用户项目 config 缺 health / layers / preserveEffectIds 段，跑 SKILL 时靠默认值兜底 | install.js `runInit()` 写 config 时漏写这三段 | install.js 修复 + 业务项目 config patch |
| `doctor.run({...})` 函数找不到，agent 等待返回值卡死 | 误把 SKILL.md 里的伪代码当真函数调用 | 主 SKILL 顶部加「执行模型说明」总纲 + doctor §5.4 / §6 改写自然语言 |
| 设计稿里有"吸顶/吸底/悬浮"语义但没有对应前缀，AI 全部生成 `position: absolute` 跟随滚动 | layer 前缀体系缺"视口固定定位"语义 | 新增 `fixed-` 修饰前缀（SKILL §`fixed-` 定位规则 + doctor NAM014/LAY013 + design-guide.md 同步） |
| init 第 2 题「样式方案」单选 `scss/css-modules/tailwind/inline`，less 项目无法表达；"scss + module" 也勾不出来 | 两个独立维度（预处理语法 / 是否走 module）压到一个单选里 | install.js 拆成 [2a] 样式方式 + [2b] 预处理语法 + [2c] 是否走 module；styleFormat 扩展到 8 种值；SKILL §0 加「样式方案标识符」表，§2.5 探测分支泛化到 scss/less/css，§4.6 框架适配表补全 |
| init 第二阶段所有题目都显示「沿用现有配置」，但项目里其实没 config 文件 | `runInit()` 先调 `installFiles(true)` 把 templates 模板复制过去，再读 existing，读到的是 templates 默认值 | `runInit()` 调换顺序：先读 existing → 再 `installFiles(true, true)`（init 模式不复制 templates config 模板） |
| MCP 没装时 Claude 跑半套流程才回退报错；原 §步骤 -1 只区分"成功 / 失败"两态，分不清「未装 / 未认证 / 无权限」 | 探针太粗（只描述"尝试调用 MCP 工具"）+ install.js 阶段一假装"检测"实际只打印说明 | SKILL §步骤 -1 改为调 `whoami` 最便宜探针，按错误类型精准分 4 态（未装 / 未认证 / 无权限 / 业务错误），每种给独立提示文案；install.js 阶段一改名「安装提示」并明示无法验证 |

## 不在本 topic 覆盖的内容

- doctor 的体检规则、报告格式、阈值 → 见 [[pp-doctor]]
- 通用 D2C 设计意图（如何写图层名 / Auto Layout 怎么用） → 见 `docs/design-guide.md`
- 项目级配置示例（`pp-d2c.config.json` 全字段） → 见 SKILL.md §0
- `templates/pp-d2c.config.json` 模板源 → 见 `templates/` 目录
