# PixelPrint(像素打印)简介

> **PixelPrint / 像素打印** — 寓意「像素级还原」,把 Figma 每一像素、每一间距、每一个圆角原样"打印"成前端代码。

**PixelPrint 是一套让 Claude Code 学会「把 Figma 稿子还原成代码」的知识包**。装到项目里,把设计稿链接发给 Claude,它自己拆图层、切图、出代码、视觉对比。

---

## 它是什么

一个 npm 包 + 一套 Claude Code SKILL 组合。

```bash
npx @double-coding/pixel-print init
```

跑完这行,项目根多出:

- `.claude/skills/` 下 3-4 个 SKILL(主流程 + 剥调试属性 + 局部修复)
- `pp-d2c.config.json`(单位换算、图片路径、adapter 等配置)
- `.env`(存 Figma Token)
- rn 项目还多一份 `src/utils/rpx.ts`

然后对 Claude Code 说:「把这份稿子转成代码 https://figma.com/design/xxx」,它就开始干活。

## 覆盖哪 3 种技术栈

| 端 | 产物 | 目标框架 |
|---|---|---|
| **H5** | React + SCSS/LESS/CSS/Tailwind/Inline | 通用 Web |
| **React Native** | RN + StyleSheet | pure RN / Expo |
| **RN 系跨端** | 同上,但标签自动换 | xtaro / taro,可加自定义预设 |

## 3 个关键能力

**1. 图层前缀读意图**

设计师把图层命名成 `sub-header-nav` / `img-banner` / `fixed-btn-back-top` / `scrollx-cards`,PixelPrint 就知道哪块该拆独立组件、哪块直接切图、哪块要固定定位、哪块要横滑。不用 AI 猜,直接照规范做。

**2. 缓存复用不污染**

同一份稿子跑第二次:figma 元数据、切好的图、锚点档案全在 `.d2c-cache/`,hash 对比一致就直接复用,10 秒出结果。稿子改过,只 invalidate 变动的那部分,不误伤别的。换稿子(不同 fileKey)完全隔离,不串。

**3. 局部修复不重跑整页**

页面出完发现某一小块视觉不对,不用整页重来。`pp-fix-partial` 拿 `.d2c-cache/last-page.json` 定位最近实现的稿子,让你选一个子块,只重跑那一块。

## 不是什么

- **不是 Figma 插件** — 设计师侧不装东西,全在开发者本地跑
- **不是 Codegen 引擎** — 没有 AST 系统,靠 LLM 按 SKILL 里的自然语言规则出代码
- **不是 MCP 服务器** — v0.3 起用原生 Figma REST API,一枚 Personal Access Token 搞定,不走 OAuth

## 快速上手 3 步

**1. 装**
```bash
npx @double-coding/pixel-print init
```
选 framework(H5 / RN / xtaro / taro …)、样式方案、图片路径、Figma Token。约 8-13 题,1 分钟。

**2. 让设计师按规范命名图层**

把 [`docs/design-guide.md`](./design-guide.md) 发给对接设计师。他花 20 分钟改图层名,你后面省 10 倍时间。

**3. 让 Claude 干活**
```
把这份稿子转成代码:https://figma.com/design/xxx?node-id=1-2
```
Claude 自动跑体检 → 拆 sub-block → 并行出码 → 切图 → 视觉对比 → 交付。

## 相关文档

- [`README.md`](../README.md) — 详细操作手册(参数、配置、故障排查)
- [`docs/design-guide.md`](./design-guide.md) — 给设计师的图层命名规范
- [`docs/pixel-print-architecture.md`](./pixel-print-architecture.md) — 技术讲解(架构 / 执行模型 / 演化史)

---

**一句话总结**:把 Figma 稿子丢给 Claude,喝杯咖啡的时间拿到可运行的代码 + 视觉对比截图。剩下的时间调业务逻辑,不再抠像素。
