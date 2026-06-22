# @ctrip/train-d2c

携程火车票 Figma D2C（Design-to-Code）工具——把 Figma 设计稿一键还原成可运行的 React/SCSS 代码。

通过 Claude Code Skill 协议工作，团队约定的图层命名规范 + 体检规则 + 单位换算 + 资产管理全部内置。

---

## 安装

```bash
# 在你的业务项目根目录下执行
npx @ctrip/train-d2c init
```

`init` 会引导你完成 8 题交互式配置（项目框架、样式方案、单位换算等），并生成：

- `ctrip-train-d2c.config.json`：项目配置
- `.claude/skills/ctrip-train-d2c/`：主 SKILL（D2C 生成）
- `.claude/skills/ctrip-train-d2c-doctor/`：体检 SKILL
- `code-connect/mappings.json`：Figma 组件 → 代码组件映射表
- `static/`、`pages/`（默认路径，可配置）：图片资产 / 输出目录

> **前置依赖**：Claude Code（最新版）+ 在 Claude Code 中安装 Figma 官方 MCP 插件并完成 OAuth 认证。详见 [MCP 安装](#前置依赖figma-mcp)。

---

## 快速开始

### 1. 完成 init 交互

```bash
$ npx @ctrip/train-d2c init

─── 阶段一：Figma MCP 安装提示 ──────────────────────
  ⚠️  init 脚本运行在终端进程里,无法直接验证 Claude Code 内的 MCP 状态。
  实际可用性会在 Claude 跑 SKILL 步骤 -1 时调 whoami 探针验证。

─── 阶段二：交互式配置 ──────────────────────────────
  [1/8] 项目框架: ● react  rn
  [2a/8] 样式方式: ● stylesheet  tailwind  inline
  [2b/8] 预处理语法: ● scss  less  css
  [2c/8] 是否启用 css-modules: ● No  Yes
  [3/8] 合并模式: ● component  flat
  [4/8] 图片输出目录 [static/]:
  [5/8] 图片 base URL [http://127.0.0.1:8080/]:
  [6/8] 代码输出目录 [pages/]:

─── 阶段三：单位换算规则 ────────────────────────────
  [单位1/4] 设计稿基准宽度 (px) [375]:
  [单位2/4] 代码使用的单位: ● px  vw  rem
  [单位3/4] 代码 px 基准宽度 [750]:
  [单位4/4] Figma Personal Access Token []:
```

> **可重复运行**：再次跑 `init` 会**自动沿用 config 里已有的值**，只对缺失字段弹交互。想强制重填某项就删掉 config 对应字段。

### 2. 把设计稿链接发给 Claude

```
把这份设计稿转成代码：https://figma.com/design/abcXyz?node-id=138-1797
```

Claude 会自动：

1. 调 `whoami` 探针确认 MCP 可用
2. 跑 doctor 体检（命名规范、布局结构、节点数）
3. 拉取图层树，按 `sub-` 前缀拆分 sub-agent 并行生成
4. 通过 Figma REST API 导出图片（带 `use_absolute_bounds=true` 严格按 bbox）
5. 逐 sub-block 视觉对比设计稿与生成代码
6. 输出完整可运行的 React + SCSS 文件

---

## 图层命名规范（给设计师看）

完整规范见 [`docs/design-guide.md`](./docs/design-guide.md)。速查表：

| 前缀 | 含义 | 生成效果 |
|------|------|---------|
| `sub-` | 独立模块 | 单独 sub-agent 处理，生成独立组件 |
| `block-` | 独立布局块 | HTML/CSS 隔离的容器，不可点击 |
| `img-` | 整块图片 | 整层导出为 `<img>`，**不递归** |
| `bg-` | 背景图 | 写父元素 `background-image`，**不递归** |
| `bgc-` | 父级背景与盒级装饰 | 写父元素 fills / strokes / cornerRadius / box-shadow，**不递归** |
| `font-` | 强制文字 | 生成文字节点 |
| `btn-` | 可点击区域 | 包裹可点击容器 |
| `scrollx-` / `scrolly-` | 横向/纵向滚动 | overflow + 隐藏滚动条，**继续递归子层** |
| `fixed-` | 视口固定定位 | `position: fixed`，依赖 Figma constraints |
| `x-` | 忽略 | 完全不生成代码 |

**修饰前缀可叠加**：

| 组合 | 效果 |
|------|------|
| `sub-img-qa` | 独立模块 + 整块图片 |
| `btn-img-banner` | 可点击 + 整块图片 |
| `fixed-btn-back-top` | 固定定位 + 可点击按钮 |
| `sub-scrollx-cards` | 独立模块 + 横向滚动 |

**禁止叠加**：
- `scrollx-` 不能和 `img-` / `bg-` / `bgc-` / `btn-` / `x-` 共存
- `scrollx-` 不能和 `scrolly-` 共存
- `fixed-` 不能和 `bg-` / `bgc-` / `x-` 共存（不生成节点，fixed 无处可挂）

---

## 配置文件 `ctrip-train-d2c.config.json`

完整字段说明见主 SKILL `templates/skills/ctrip-train-d2c/SKILL.md` §0。关键字段：

```jsonc
{
  "project": {
    "framework": "react",         // react | rn
    "styleFormat": "scss"         // scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline / RN 三选
  },
  "figma": {
    "token": "figd_xxx"           // Figma Personal Access Token，用于 REST API 导出图片
  },
  "merge": { "mode": "component" }, // component | flat
  "unit": {
    "figmaBase": 375,             // 设计稿基准宽度
    "outputUnit": "px",           // px | vw | rem
    "outputBase": 750,            // 输出基准
    "scale": 2                    // 换算倍数
  },
  "images": {
    "assetsDir": "static/",
    "imageBaseUrl": "http://127.0.0.1:8080/",
    "preserveEffectIds": []       // 例外清单：哪些 nodeId 导出时不带 use_absolute_bounds
  },
  "layers": {
    "sub": "sub-",
    "fixed": "fixed-",
    // ...11 类前缀，可重命名
  },
  "output": { "dir": "pages/" },
  "health": {
    "enabled": true,              // 是否启用前置体检
    "blockOnError": true,         // 体检 grade=F 时是否阻塞生成
    "thresholds": { /* 9 项阈值 */ },
    "rules": {}                   // 可针对单条规则改 level / 关闭
  }
}
```

---

## 命令清单

```bash
# 在业务项目根目录下使用
npx @ctrip/train-d2c init      # 交互式初始化（推荐）
npx @ctrip/train-d2c install   # 仅复制模板文件，不交互
npx @ctrip/train-d2c help      # 显示帮助
```

---

## 前置依赖：Figma MCP

Figma 官方 MCP 需要在 Claude Code 中**手动安装**，install.js 脚本无法替你装。

### 安装步骤

1. 打开 Claude Code
2. 进入 **Settings → Extensions**，搜索 **Figma**
3. 找到 Figma 官方插件，点击安装
4. 按提示完成浏览器 OAuth 认证

### 可用性验证

跑 SKILL 时 Claude 会在**步骤 -1** 调 `mcp__plugin_figma_figma__whoami` 探针。三种结果会分别给出独立提示：

| 探针结果 | 含义 | 处理 |
|---------|------|------|
| 成功 | MCP 已装、已认证、工作正常 | 继续 |
| `Tool not found` | MCP 完全没装 | 提示按上面 4 步安装 |
| `Unauthorized` | 装了但未 OAuth | 提示完成浏览器认证 |
| `Permission denied` | 装了但当前账号无该稿权限 | 提示更换账号或邀请 |

---

## 设计稿体检（Doctor）

`health.enabled: true` 时（默认），主 SKILL 在生成代码前会自动跑一次设计稿体检：

- **NAM 系列**：命名规范（命中规则 NAM001-NAM014）
- **LAY 系列**：布局合理性（LAY001-LAY013）
- **STR / STY / AST / FEA**：嵌套深度 / 颜色对比度 / 资产体积 / 整体规模

体检完毕输出 grade（A/B/C/D/F）+ 阻塞决策。`grade=F && blockOnError=true` 时会停下来等用户确认。

报告自动写入 `{output.dir}/.d2c-health-{nodeName}-{timestamp}.md`。

体检规则完整定义见 [`docs/d2c-health-check-spec.md`](./docs/d2c-health-check-spec.md)。

---

## 项目结构

```
ctrip-train-d2c/
├── bin/install.js                    ← npx 入口（init / install / help 三命令）
├── templates/
│   ├── skills/
│   │   ├── ctrip-train-d2c/SKILL.md  ← 主 D2C 流程（~1100 行执行手册）
│   │   └── ctrip-train-d2c-doctor/SKILL.md  ← 体检流程
│   ├── ctrip-train-d2c.config.json   ← 配置文件模板
│   └── code-connect/mappings.json    ← Figma 组件映射模板
├── docs/
│   ├── design-guide.md               ← 给设计师的命名规范指南
│   └── d2c-health-check-spec.md      ← 体检规则源（含 P0/P1/P2 优先级）
└── package.json
```

---

## 故障排查

| 现象 | 入口 |
|------|------|
| init 提示"沿用现有配置"但项目里没 config | install.js 已修复（spread merge + 调整读 existing 顺序）；老版本升级方法见 SKILL §0 |
| 切出来的图带紫色画板背景色 / 光晕外扩 | `/v1/images` API 必须带 `use_absolute_bounds=true`（主 SKILL §4.4） |
| `card-bg.png` 把 bg-bg + bgc-选中框 揉成一张图 | bgc- 嵌在 bg- 子树内是错误结构（doctor NAM013 / 主 SKILL §`bg-` 内嵌 `bgc-` 的处理） |
| `bg-list.png` 把行程项内容印进背景 | `sub-scrolly-` 必须递归子层，不能整体导出（主 SKILL §`scrollx-/scrolly-` 自检 4 行） |
| Figma token 过期 / 缺失生成失败 | 自动走 L1→L2→L3 兜底链（主 SKILL §4.4.1） |
| `position: fixed` 元素跟着祖先滚动 | 祖先链有 `transform` / `filter` / `blur` 导致 fixed 退化（doctor LAY013） |
| `doctor.run()` 函数找不到 | SKILL.md 是 LLM 操作手册（自然语言），不是可执行代码——任何 `doctor.run({...})` 都是伪代码（主 SKILL 顶部「执行模型说明」） |

更多详见 [`.Knowledge/topics/ctrip-train-d2c.md`](./.Knowledge/topics/ctrip-train-d2c.md) 的「已知历史 bug 与修订」表。

---

## 开发与维护

### 仓库结构

- **本仓库**：D2C 工具源码（SKILL 模板、install.js、文档、规则）
- **业务项目**：通过 `npx @ctrip/train-d2c init` 拉取 SKILL 到 `.claude/skills/`

### 版本号

`package.json` 的 version 与 SKILL 内部约定的 v0.x.y 保持同步：

- v0.2.x 系列引入：图层前缀体系泛化、doctor 体检、token 兜底链、嵌套 sub-、bgc- 盒级 CSS、CSS-able 自检、fixed- 前缀等

### 给设计师同步规范

把 [`docs/design-guide.md`](./docs/design-guide.md) 发给对接设计师。开发对接前**优先**让设计师按规范命名图层，比开发自己改图层名靠谱得多。

---

## License

UNLICENSED — 携程内部使用。
