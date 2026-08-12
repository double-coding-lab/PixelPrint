# PixelPrint(像素打印)

> 把 Figma 稿子丢给 Claude,喝杯咖啡的时间拿到可运行的代码 + 视觉对比截图。
>
> npm 包名:`@double-coding/pixel-print` · GitHub:[double-coding-lab/PixelPrint](https://github.com/double-coding-lab/PixelPrint) · License MIT

**PixelPrint 是一套让 AI 编程 agent 学会「把 Figma 稿子还原成代码」的知识包**。装到项目里(skill 双写 `.claude/skills/` 与 `.codex/skills/`,Claude Code 和 Codex 都能用),把设计稿链接发给 agent,它自己拆图层、切图、出代码、逐块视觉对比。

**H5(React)** / **React Native** / **RN 系跨端(xtaro / taro / 自定义)** 三端产物一套 SKILL 全覆盖。走 Figma 原生 REST API,不装 MCP 插件、不走 OAuth。

---

## 快速开始

### 1. 装到项目

```bash
cd 你的业务项目
npx @double-coding/pixel-print init
```

交互式引导 6 题,1 分钟内答完。

**一键式装法**(推荐给已知配置的场景,零交互):

```bash
# 携程 xtaro 一键
npx @double-coding/pixel-print init \
  --framework rn --adapter-preset xtaro --merge-mode flat \
  --figma-base 375 --responsive on \
  --rpx-helper-import "@ctrip/xtaro" --rpx-helper-name xrpx \
  --assets-dir assets/ --output-dir src/pages/ \
  --figma-token figd_你的token

# React + SCSS 一键
npx @double-coding/pixel-print init \
  --framework react --style-format scss --merge-mode flat \
  --figma-base 375 --output-unit vw --output-base 375 \
  --output-dir pages/ --figma-token figd_你的token
```

完整参数表见 [`docs/pixel-print-guide.md §6`](./docs/pixel-print-guide.md#6-cli-快捷参数速查)。

### 2. 让设计师按规范命名图层

把 [`docs/design-guide.md`](./docs/design-guide.md) 发给对接设计师。他花 20 分钟改图层名,你后面省 10 倍时间。

### 3. 让 Claude 干活

```
把这份稿子转成代码:https://figma.com/design/xxx?node-id=1-2
```

Claude 自动:探活 Token → 跑体检 → 拆图层 → 派 sub-agent 并行出码 → 切图 → 逐块视觉对比 → 交付。

---

## 想了解更多

📖 **详细文档:[`docs/pixel-print-guide.md`](./docs/pixel-print-guide.md)** — 包含架构说明、init 交互实录(3 种模式)、CLI 参数、配置字段、Token 说明、故障排查、版本历史、效果图。

🔬 **原理文档:[`docs/pp-d2c-principles.md`](./docs/pp-d2c-principles.md)** — pp-d2c 内部如何运转:四层架构、前缀协议、sub-agent 分块、软/硬双防线、以 cache 为真值的逐节点对账。想理解或改造 skill 的看这篇。

🎨 **给设计师看:[`docs/design-guide.md`](./docs/design-guide.md)** — 图层命名规范速查(sub- / img- / bg- / fixed- / …)。

---

## 命令清单

```bash
npx @double-coding/pixel-print init [options]   # 交互式初始化(推荐)
npx @double-coding/pixel-print install          # 仅复制模板文件,不交互
npx @double-coding/pixel-print clean-cache      # 清 .d2c-cache/(figma / images / anchors / last-page.json)
npx @double-coding/pixel-print help             # 完整帮助 + 参数示例
```

---

## License

MIT © double-coding-lab
