# ctrip-train-d2c

> D2C 主 SKILL（`templates/skills/ctrip-train-d2c/`）的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md（共约 770 行），本 topic 是路由摘要 + 关键边界，不重复长篇内容。

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

主 SKILL `ctrip-train-d2c` 与 doctor `ctrip-train-d2c-doctor`（见 [[ctrip-train-d2c-doctor]]）是**协作但独立**的两条流程：

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

**位置**：SKILL.md §4.3.1。

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

## 工具链注意事项（install.js / config 完整性）

**install.js `runInit()` 写 config 时必须包含完整字段**（v0.2 修订）。历史 bug：`runInit()` 只写了 project / figma / merge / unit / images / output 六大段，**漏了 layers / health / images.preserveEffectIds**，导致用户项目 config 缺关键字段。

修复后 `runInit()` 用 `existing.X || 默认` 模式保留用户已有自定义：

- `images.preserveEffectIds`：默认 `[]`（所有图严格按 bbox 导出）
- `layers`：完整 10 类前缀（sub/block/img/bg/bgColor/font/but/scrollX/scrollY/ignore）
- `health`：enabled=true / blockOnError=true / report 段 / thresholds 全套

**升级老项目**：`existing.layers || ...` 写法让 re-init 自动补全缺失字段；用户已自定义的字段保持不变。

**Config 完整性自检脚本**（出问题时排查用）：

```bash
# 检查项目 config 是否含 health 段
cat ctrip-train-d2c.config.json | grep -E "health\.enabled|images\.preserveEffectIds|layers\.scrollX"
```

缺任何一个 → re-init 或手动补段。

## 配置项要点（详见 SKILL.md §0）

| 字段 | 用途 | 备注 |
|------|------|------|
| `figma.token` | REST API 鉴权 | 缺失/过期触发 L1 兜底 |
| `images.assetsDir` / `images.imageBaseUrl` | 图片 URL 拼接 | 三段字面拼接铁律，禁止补/删字符（§510-545） |
| `images.preserveEffectIds` | 例外清单 | 仅当某张图就是要烤 effect 进 PNG 时使用 |
| `health.enabled` / `health.blockOnError` | 是否在 §0.5 调用 doctor + 是否阻塞 | doctor 内部见 [[ctrip-train-d2c-doctor]] |
| `unit.figmaBase` / `unit.outputBase` / `unit.scale` | 尺寸换算 | 设计稿 → 输出代码必经路径 |
| `layers.*` | 11 类前缀（sub/block/img/bg/bgc/font/btn/x/scrollx/scrolly） | 多前缀组合解析见 §398-438 |

## 边界与禁止（高频踩坑）

- **不递归类前缀**：`img-` / `bg-` / `bgc-` / `x-` 命中即"整体导出 / 忽略",**不再向内递归**(§412-413 / §705)。子孙节点不会被生成代码——doctor 已落地这条作为"形态/容器"类规则的全局过滤标 `inNonRecursiveSubtree`
- **scroll 互斥**:`scrollx-` / `scrolly-` 与 `img-` / `bg-` / `bgc-` / `x-` / `btn-` 共存禁止(§448 / §718);同节点 `scrollx + scrolly` 共存也禁止
- **sub- 单独拆 + 允许嵌套**(v0.2 修订):哪怕只有 1 个 `sub-` 节点也必须分发独立 sub-agent(§108 / §717),分块是质量保证而非性能优化;**sub- 允许嵌套**(典型场景:`sub-content / sub-card + sub-scrolly-车票列表`),深度上限 3 层,执行走"主 agent 派发 + sub-agent 上报 + placeholder 展开"链路(§107-145 / §4.0.5 / §5.0)
- **block- 不嵌套**:`block-` 是"顶层独立布局块"(§409),doctor NAM001 fix 已修订为只建议 `sub-`,不再建议 `block-`
- **页面级背景必须探测项目特征**:`*.module.scss` 里直接写 `body { ... }` 会被 hash 化失效;普通 scss 写 `:global(...)` 也不识别。详见 §2.5(强制不可跳过)

## 已知历史 bug 与修订（v0.2）

| 现象 | 根因 | 修订位置 |
|------|------|---------|
| 切出来的图都带紫色画板背景 | `/v1/images` 默认导出包含父 fills | §487-501 加 `use_absolute_bounds=true` |
| `bg-list.png` 把行程项内容都印进背景 | sub-agent 把 `sub-scrolly-` 整体导出 | §463-470 自检 4 行 + §728 禁止项 |
| `ticketCard` 设计稿 -25px gap 必须写 -50px 才贴合 | effect 外扩让 PNG 比 bbox 大一圈 | 同 #1，`use_absolute_bounds=true` 一并解决 |
| token 过期生成失败 / 用临时链接占位上线 24h 后 404 | 旧约定"跳过下载" | §4.3.1 新增 L0→L3 兜底链 |
| `card-bg.png` 把 bg-bg + bgc-选中框 揉成一张图，4px Outside 描边丢失 | bgc- 嵌在 bg- 子树内，旧 bgc- 规则只取 fills 丢 strokes/cornerRadius/effects | §`bgc-` 取值规则扩展 + §`bg-` 内嵌 `bgc-` 的处理 + doctor NAM004 扩展覆盖 bgc- + doctor NAM013 新增 |
| `bg-box.png` 切图带紫色"画板底色"假象 | bg-box 是简单 GRADIENT + DROP_SHADOW，应改 bgc- 用 CSS 实现，但被切成位图 | §`bg-` 切图前的"CSS-able 自检" + doctor NAM012 新增 |
| 用户项目 config 缺 health / layers / preserveEffectIds 段，跑 SKILL 时靠默认值兜底 | install.js `runInit()` 写 config 时漏写这三段 | install.js 修复 + 业务项目 config patch |
| `doctor.run({...})` 函数找不到，agent 等待返回值卡死 | 误把 SKILL.md 里的伪代码当真函数调用 | 主 SKILL 顶部加「执行模型说明」总纲 + doctor §5.4 / §6 改写自然语言 |

## 不在本 topic 覆盖的内容

- doctor 的体检规则、报告格式、阈值 → 见 [[ctrip-train-d2c-doctor]]
- 通用 D2C 设计意图（如何写图层名 / Auto Layout 怎么用） → 见 `docs/design-guide.md`
- 项目级配置示例（`ctrip-train-d2c.config.json` 全字段） → 见 SKILL.md §0
- `templates/ctrip-train-d2c.config.json` 模板源 → 见 `templates/` 目录
