# ctrip-train-d2c

> D2C 主 SKILL（`templates/skills/ctrip-train-d2c/`）的执行约定与避坑路由摘要。完整规则定义见同名 SKILL.md（共约 770 行），本 topic 是路由摘要 + 关键边界，不重复长篇内容。

## 适用场景 / 触发词

- 用户提供 Figma 设计稿 URL 并说"还原"、"D2C"、"生成代码"
- 维护者修改主 SKILL 时定位读哪几节
- 排查"切出来的图带画板背景色 / 光晕 / 间距对不上 / 列表被压平成背景图 / token 过期生成失败"等典型 bug

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

## 不在本 topic 覆盖的内容

- doctor 的体检规则、报告格式、阈值 → 见 [[ctrip-train-d2c-doctor]]
- 通用 D2C 设计意图（如何写图层名 / Auto Layout 怎么用） → 见 `docs/design-guide.md`
- 项目级配置示例（`ctrip-train-d2c.config.json` 全字段） → 见 SKILL.md §0
