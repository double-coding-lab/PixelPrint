---
id: pp-d2c-prep-plugin
revision: 0
summary: "D2C 预处理 Figma 插件:三阶段迭代合并、清理隐藏与 Slice、手动打前缀、AI 咨询"
primary: feature
confidence: manual
tags: [module]
---
# pp-d2c-prep-plugin

> 独立 Figma Editor 插件,把普通设计稿改造为 pp-d2c 友好的形态。**只做几何**——三阶段迭代合并 + 清理隐藏/Slice + 拆分 + AI 咨询;**不做语义**——前缀协议留给设计师手工点或 AI 建议后一键应用。目录 `plugin/`,不通过 npm 分发。

## 适用场景

- 设计师拿到一份普通稿子(非专门为 D2C 而画),要在交给 pp-d2c 出码前先做几何整理
- 一堆散碎的 vector / 图标 fragment 需要裹回一个 group
- 一个大背景 + 上面若干小元素想整体归组
- 排查"这两个节点怎么没被合并" / "合并后大元素遮挡小元素" / "sub-card 一层套一层"等一键合并类问题
- 想让 AI 看截图给出前缀 / 合并建议,但直接调 PETA 走不通(见 [[ai-proxy]])

**不适用**:

- 出码本身、check-rules 对账、前缀协议裁决 → 看 [[pp-d2c]]
- 设计稿健康体检、前缀互斥硬阻断 → 看 [[pp-doctor]]
- 多套换肤稿批量切图 → 看 [[pp-d2c-reskin]]
- Autolayout 反推、前缀自动推断 → **本插件不做**(原始技术方案设计过,已废弃,见 stock-doc §一)

## 定位与设计哲学

**只做几何,不做语义**。以前尝试过"自动推断前缀 + 反推 Autolayout"路线,准确度天生上不去,且业务语义(哪个是订单卡片、哪个是按钮组)由机器猜错的代价远大于让人手点一下。当前架构:

- 插件只把"视觉上应该在一起"的碎片自动合并成 group,大元素沉底,清理隐藏与 Slice;
- 前缀交给设计师手工点(`QuickTagPanel` 批量打标 / 修饰前缀叠加 / 冲突策略);
- 想让 AI 帮看的话,`AI 建议` 按钮把 scope 的图层树 + 画面截图发给 [[ai-proxy]] 转发到 PETA `gpt-6-astra`,拿回 Suggestion[] 再按组一键应用。

## 核心能力

| 能力 | 入口 | 关键约束 |
|---|---|---|
| **扫描** | 头部 `Scan` | 全量遍历,产出 `TreeNode[]` 给 UI |
| **一键合并** | 头部按钮 | 三阶段 O(相交) → A(图形碎片 gap) → B(混文字 gap) 串行,每阶段迭代到收敛;合并前默认清理隐藏 + Slice |
| **一键拆分** | 头部按钮 | 默认浅拆一层;⚙面板可勾 `深拆(递归)`,拆到无 GROUP |
| **AI 建议** | 头部按钮 | 走 [[ai-proxy]] → PETA;Suggestion 按 parent 分组,「应用全部」批量落地 |
| **手动合并** | 面板右上「合并选中 ▼」 | 选 `img-` / `sub-` / `bg-` + 可选 nameHint |
| **手动打前缀** | 底部 `QuickTagPanel` | 基础前缀 + 修饰前缀(`fixed-` / `end-` / `list-` / `bl-`)按 pp-d2c 顺序叠加;冲突策略 `replace` / `stack` / `skip` |
| **诊断** | ⚙ → `诊断为什么没合并` | 选 2 个节点,11 条约束依次检查(可见 / 未锁 / 非 INSTANCE / 未打前缀 / 同父 / 容器 / bbox / 尺寸 / gap 或 overlap / 合并守卫) |

## 三阶段迭代合并的关键约束(排障必读)

- **阶段 O 相交合并**:`overlap_area / min(area_A, area_B) >= overlapThreshold`(默认 0.3),分母取**较小 bbox**,保证"大背景包住小元素"这种非对称场景照命中;阶段 O **不受 `maxItemSize` 限制**(否则大背景永远漏)。
- **阶段 A 图形碎片**:VECTOR / STAR / POLYGON / BOOLEAN_OPERATION / 含 IMAGE fills 的 RECTANGLE / ELLIPSE 参与;`bboxGap <= gap`(默认 12px);阶段 A 生成的 `img-` group **允许滚雪球**,继续参与下一轮。
- **阶段 B 混文字**:候选放宽到任意可见叶子 / GROUP / FRAME(阶段 A 的 `img-` group 也算候选,帮组成"图 + 文");但**阶段 B 自产的 `sub-` group 一次成型,不能回锅**(用 `sessionSubGroupIds` 单独隔离——历史上出过 sub-44 → sub-88 → sub-132 的 nesting bug)。
- **合并守卫(每一步硬约束)**:簇成员 ≥ 2 且 ≤ `maxClusterSize`(默认 12);**合并后父层剩余子节点数 ≥ 2**(一簇覆盖父所有子等于给父重命名,毫无意义);`figma.group()` 后 children < 2 立即 remove。
- **合并前先拍父层 z-order 快照** `preMergeParentOrder: Map<childId, index>`,合并后有两个用途:
  - **内部次序**:`preserveOriginalZOrder` 用它把 group 内 children 按原相对次序恢复(**不按面积重排**;用户在 Figma 画的顺序就是他表达的 z 意图,大元素也可能故意画在顶层当浮层蒙层)。
  - **外部位置**:`moveGroupToBottomMemberPosition` 把新 group 移到 `parent.insertChild(minMemberIndex, group)` —— 即所有被合并成员中**最底那一个的原 index**。否则 `figma.group()` 默认把新 group 放到 parent 最末尾(整簇上浮到顶层),会遮挡本来压在上面的其他兄弟。
- **INSTANCE / 锁定 / 已打前缀(`img-` / `bg-` / `bgc-` / `x-` / `sub-`)节点**:一律不动。

参数默认值:`gap=12` / `maxRounds=10` / `maxItemSize=300` / `overlapThreshold=0.3` / `deleteHiddenFirst=true`。

## 与上下游的关系

- **上游**:插件是 pp-d2c 的**几何预处理**——把散碎图形先裹成 group、大背景先归组,方便设计师在此基础上手工打前缀,再交给 pp-d2c 出码;
- **完全解耦**:插件不 import pp-d2c,pp-d2c 不感知插件。唯一接口是"改造完的 Figma 文件"这一实体;
- **不做 pp-doctor 的事**:插件**不**生成健康报告、**不**做前缀互斥硬规则阻断——那是 pp-doctor 在 D2C 出码前的职责;
- **不做 pp-d2c 出码时才处理的事**:根容器 `min-height: max(..., 100vh)` 覆写、`end-` wrapper + `space-between` 结构变换,都是 pp-d2c 的出码逻辑,插件不介入。

## 沙箱与网络约束(易踩坑)

- Figma 沙箱是 **QuickJS**,**没有 `AbortController`**;ai client 用 `Promise.race([fetch, timeout])` 替代;
- `manifest.json` 的 `allowedDomains` 不接受 IP + 端口,必须完整 URL;当前为 `allowedDomains: ["*"]` + `devAllowedDomains: ["http://localhost:8787"]`;
- 沙箱抛的 error 常常不是 Error 实例(`{code, message}` 或字符串),必须 `formatError()` 统一序列化才不会在 UI 显示 `[object Object]`;
- `figma.group()` 后 children 顺序不完全可控,依赖 `sortGroupChildrenBottomUp` 显式重排。

## 开发与分发

- 开发:`cd plugin && node build.mjs --watch`,esbuild 产出 `plugin/dist/{code.js, ui.html}`;
- 分发:整个 `plugin/` 目录发给设计师 → Figma 桌面版 → Plugins → Import plugin from manifest;
- **不通过 npm 分发**(不在 `files` 白名单),独立版本号在 `plugin/manifest.json`;
- 依赖(项目根 `devDependencies`):`@figma/plugin-typings` / `esbuild` / `typescript` / `react` / `react-dom` + types。

## 边界与禁止

- ❌ 不自动推断前缀(交给人 / AI);
- ❌ 不反推 Autolayout(几何反推错误率高);
- ❌ 不做 CLI / 服务形态(第一版只做 Figma 插件);
- ❌ 合并/拆分不改视觉属性(fills/strokes/effects/cornerRadius);
- ❌ 合并不引入结构变化(层级、子层顺序在同一合并内不变;但重排后 z-order 会按面积调整);
- ❌ 一簇覆盖父的所有子时不合并(合并守卫);
- ❌ INSTANCE 不动(避免解绑主件);
- ❌ 已打 pp-d2c 前缀的节点不再作为合并候选原始碎片(阶段 A 自产的 `img-` group 例外)。

## 详细背景

- [pp-d2c-prep-plugin 终稿](../stock-docs/pp-d2c-prep-plugin_终稿.md)——目录结构、消息协议、三阶段算法完整实现、UI 组件、诊断 11 约束、开发分发。
- [ai-proxy 终稿](../stock-docs/ai-proxy_终稿.md)——AI 建议链路的中转服务(Node 版 + Python 版兜底)。
