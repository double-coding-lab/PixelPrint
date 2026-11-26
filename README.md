# PixelPrint（像素打印）

把 Figma 设计稿还原成前端代码，支持 H5（React）、React Native 及 RN 系跨端适配。可以直接使用在线工作台，也可以将 Skill 安装到本地项目，配合 Claude Code 或 Codex 使用。

**[打开在线版 → pp.lantao.work](https://pp.lantao.work)** · [服务端开源仓库](https://github.com/double-coding-lab/PixelPrintService) · [npm 本地工具包](https://www.npmjs.com/package/@double-coding/pixel-print) · MIT License

## 选择使用方式

| | 在线版 | 本地版（本仓库） |
| --- | --- | --- |
| 入口 | [pp.lantao.work](https://pp.lantao.work) | `npx @double-coding/pixel-print@latest init` |
| 使用方式 | 在网页工作台中创建会话，提供设计稿和生成要求 | 在业务项目中安装 Skill，把需求交给本地编程 Agent |
| 运行位置 | 由在线平台执行任务 | 使用本机项目、文件及宿主 Agent 的工具 |
| 适合场景 | 希望直接在网页中完成设计稿生成与后续调整 | 希望在现有工程中生成代码、定制适配或继续开发 |
| 配置与环境 | 按在线平台提示配置访问及生成所需凭据 | 自备 Figma Token、Agent 环境和项目运行依赖 |

在线版的服务端实现见 [PixelPrintService](https://github.com/double-coding-lab/PixelPrintService)。本仓库分发本地 CLI、Skill 和规则，不包含在线平台的数据库、任务队列或检查点服务；两者更新后分别生效，安装 npm 包不会自动启动在线平台。

本地版通过 Figma REST API 读取设计，不需要额外安装 Figma MCP 插件。并行子任务、浏览器操作和视觉验收取决于宿主实际提供的工具；没有运行或截图环境时，会明确标记未验证项。

---

## 本地版快速开始

### 1. 装到项目

```bash
cd 你的业务项目
npx @double-coding/pixel-print@latest init
```

按引导选择技术栈、样式与输出配置。新项目的代码默认放到 `pages/home/`，已有配置或明确指定的目录优先。Figma Token 请使用本地配置或环境变量保存，不要提交到 Git。

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

完整参数表见 [`docs/PixelPrint-使用指南.md §6`](./docs/PixelPrint-使用指南.md#6-cli-快捷参数速查)。

### 2. 让设计师按规范命名图层

把 [`docs/设计师设计规范/`](./docs/设计师设计规范/) 三篇发给对接设计师:[基本规范](./docs/设计师设计规范/1.%20基本规范.md) → [自动布局设计规范](./docs/设计师设计规范/2.%20自动布局设计规范.md) → [打标规范](./docs/设计师设计规范/3.%20打标规范.md)。他花 20 分钟改图层名,你后面省 10 倍时间。

### 3. 让 Agent 生成和修改

```
把这份稿子转成代码:https://figma.com/design/xxx?node-id=1-2
```

首次生成按 Skill 读取设计与缓存、准备素材、扫描规则，再实现区块、组合页面并检查结果。宿主支持子 Agent 时可并行处理独立区块；代码规则检查与视觉、交互验收分别报告。

已有页面可以继续提出“添加点击切换”“修复滑动”或“只替换图片和颜色”等要求。Agent 应定位现有代码、复用有效缓存，按受影响范围修改，保存后验证最终版本；交互修改在具备截图环境时还会对比修改前后的外观，避免顺带改变布局。

### 升级已有安装

先备份自己修改过的 Skill，再在项目中运行 `npx @double-coding/pixel-print@latest init`，核对并保留已有工程配置，以刷新 Skill。普通 `install` 会保留已有同名文件，不能用它确认升级规则已经生效。

---

## 想了解更多

📖 **详细文档:[`docs/PixelPrint-使用指南.md`](./docs/PixelPrint-使用指南.md)** — 包含架构说明、init 交互实录(3 种模式)、CLI 参数、配置字段、Token 说明、故障排查、版本历史、效果图。

🔬 **原理文档:[`docs/pp-d2c-设计原理.md`](./docs/pp-d2c-设计原理.md)** — pp-d2c 内部如何运转:四层架构、前缀协议、sub-agent 分块、软/硬双防线、以 cache 为真值的逐节点对账。想理解或改造 skill 的看这篇。

🎨 **给设计师看(最新版规范):[`docs/设计师设计规范/`](./docs/设计师设计规范/)** — 设计师交付 D2C 设计稿的完整规范,按顺序读三篇:

1. [`1. 基本规范.md`](./docs/设计师设计规范/1.%20基本规范.md) — 设计稿基础规范:Frame 设置、图层清理、命名要求。
2. [`2. 自动布局设计规范.md`](./docs/设计师设计规范/2.%20自动布局设计规范.md) — Figma 自动布局怎么搭才能被 D2C 正确还原(带图)。
3. [`3. 打标规范.md`](./docs/设计师设计规范/3.%20打标规范.md) — 前缀打标速查(sub- / img- / bg- / fixed- / …)。

看不懂自动布局?先读 [`自动布局通俗讲解.md`](./docs/设计师设计规范/自动布局通俗讲解.md) 入门,再回到规范。

📝 **踩坑复盘:[`docs/自动化设计稿放弃复盘/`](./docs/自动化设计稿放弃复盘/)** — [自动化分组](./docs/自动化设计稿放弃复盘/自动化分组_放弃复盘.md)与[自动化标注与自动化布局](./docs/自动化设计稿放弃复盘/自动化标注与自动化布局_放弃复盘.md)两篇:为什么"让工具自动改稿"这条路被放弃,改为让设计师按规范出稿。

---

## 命令清单

```bash
npx @double-coding/pixel-print init [options]   # 交互式初始化(推荐)
npx @double-coding/pixel-print install          # 仅复制模板文件,不交互
npx @double-coding/pixel-print clean-cache      # 清本地 .d2c-cache/ 设计与素材缓存
npx @double-coding/pixel-print help             # 完整帮助 + 参数示例
```

---

## License

MIT © double-coding-lab
