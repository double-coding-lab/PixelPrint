# PixelPrint

> npm 包名:`@double-coding/pixel-print`

Figma D2C(Design-to-Code)工具 — 把 Figma 设计稿一键还原成可运行的前端代码。

通过 Claude Code Skill 协议工作,内置图层命名规范、体检规则、单位换算、资产管理、跨框架 adapter。**H5(React) / React Native / xtaro(携程)** 三端产物一套 SKILL 全覆盖。

---

## 安装

```bash
# 在你的业务项目根目录下执行
npx @double-coding/pixel-print init
```

`init` 是**交互式引导**,按项目类型问不同题(h5 约 10 题,rn 约 13 题,含 adapter / rpx 响应式设置)。执行完落地以下产物:

**5 个 Claude Code SKILL**(`.claude/skills/` 下):

| SKILL | 作用 | 何时装 |
|---|---|---|
| `pp-d2c/` | 主 D2C 流程(H5 分支) | framework=react 时装 |
| `pp-d2c-rn/` | 主 D2C 流程(RN 分支,含 6 大 RN 标签 + adapter) | framework=rn 时装 |
| `pp-doctor/` | 设计稿体检(命名 / 布局 / 结构 / 资产) | 总是装 |
| `pp-style/` | 样式还原细节规则 | 总是装 |
| `pp-strip-nodeid/` | 剥离 `data-node-id` 调试属性 | 总是装 |

**配置与资产**:

- `pp-d2c.config.json`:项目配置(figma.token / 前缀映射 / 单位换算 / 体检阈值 / adapter)
- `code-connect/mappings.json`:Figma 组件 → 代码组件映射表(可选,有需要时手工填)
- `static/`、`pages/`(默认路径,可配置):图片资产目录 / 代码输出目录
- (RN 分支)`src/Utils/rpx.ts`:响应式尺寸 helper,SKILL 生成产物时按屏宽线性缩放

> **前置依赖**:Claude Code(最新版)+ 一枚 [Figma Personal Access Token](#前置依赖figma-personal-access-token)(File content: Read-only 权限)。SKILL 通过 Figma REST API 拉设计稿,不需要装任何 MCP 插件、不走 OAuth。

---

## 快速开始

### 1. 完成 init 交互

```bash
$ npx @double-coding/pixel-print init

─── 阶段一:安装提示 ────────────────────────────────
  ℹ️  Figma 数据读取走 REST API(不再需要 MCP 插件 + OAuth)。
      init 阶段只做配置引导,实际可用性会在 Claude 跑 SKILL 步骤 -1
      时调 `figma.mjs verify-token` 探针验证 Token 有效性。

─── 阶段二:交互式配置 ──────────────────────────────
  [1/8] 项目框架: ● react  rn
  [2a/8] 样式方式: ● stylesheet  tailwind  inline      # h5 分支才问
  [2b/8] 预处理语法: ● scss  less  css                  # h5 分支才问
  [2c/8] 是否启用 css-modules: ● No  Yes                # h5 分支才问
  [2.1/8] 启用 adapter(把 6 大 RN 标签映射到目标框架)?  ● Yes  No   # rn 分支才问
  [2.2/8] 选择预设 adapter: ● pure RN  xtaro  taro  自定义   # rn 分支才问
  [2.3/8] rpx 响应式包装启用?  ● Yes  No                # rn 分支才问
  [3/8] 合并模式: ● component  flat
  [4/8] 图片输出目录 [static/]:                          # h5 默认;rn 写死 src/Images/
  [5/8] 图片 base URL [http://127.0.0.1:8080/]:          # h5 才问;rn 走 require + @Images alias
  [6/8] 代码输出目录 [pages/]:                           # h5 默认;rn 默认 src/pages/

─── 阶段三:单位换算规则 ────────────────────────────
  [单位1/4] 设计稿基准宽度 (px) [375]:
  [单位2/4] 代码使用的单位: ● px  vw  rem                # rn 分支跳过(RN 无单位字符串)
  [单位3/4] 代码 px 基准宽度 [750]:                      # rn 分支写死 375(scale=1)
  [单位4/4] Figma Personal Access Token []:
```

> **可重复运行**:再次跑 `init` 会**自动沿用 config 里已有的值**,只对缺失字段弹交互。想强制重填某项就删掉 config 对应字段。

### 2. 把设计稿链接发给 Claude

```
把这份设计稿转成代码:https://figma.com/design/abcXyz?node-id=138-1797
```

Claude 会自动:

1. 调 `figma.mjs verify-token` 探针确认 Token 可用
2. 跑 doctor 体检(命名规范、布局结构、节点数,可关)
3. 拉取图层树,按 `sub-` 前缀拆分 sub-agent 并行生成
4. 通过 Figma REST API 导出图片(带 `use_absolute_bounds=true` 严格按 bbox)
5. 逐 sub-block 视觉对比设计稿与生成代码
6. 输出完整可运行的产物:
   - **H5 分支** → React + SCSS(或 less / tailwind / inline,按 styleFormat)
   - **RN 分支** → React Native + StyleSheet;启用 adapter 时 6 大 RN 标签自动映射到目标框架(如 XView / XImage)

---

## 图层命名规范(给设计师看)

完整规范见 [`docs/design-guide.md`](./docs/design-guide.md)。速查表:

| 前缀 | 含义 | 生成效果 |
|------|------|---------|
| `sub-` | 独立模块 | 单独 sub-agent 处理,生成独立组件;**支持嵌套**(最深 3 层) |
| `block-` | 独立布局块 | HTML/CSS 隔离的容器,不可点击 |
| `img-` | 整块图片 | 整层导出为图片,**不递归子孙** |
| `bg-` | 背景图 | 写父元素 `background-image`,**不递归子孙** |
| `bgc-` | 父级背景与盒级装饰 | 写父元素 fills / strokes / cornerRadius / box-shadow,**不递归子孙** |
| `btn-` | 可点击区域 | 包裹可点击容器 |
| `input-` | 输入框(v0.3.4) | 生成 `<input type="text">`,子 TEXT 变 placeholder,子 icon 切图作 background |
| `scrollx-` / `scrolly-` | 横向 / 纵向滚动 | overflow + 隐藏滚动条,**继续递归子层**(列表项按 `.map()` 处理) |
| `fixed-` | 视口固定定位(v0.2) | `position: fixed`,依赖 Figma constraints;修饰前缀可叠加 |
| `end-` | 贴父末端 / 逆向布局(v0.3.2) | 父 auto layout 里贴向末端(纵→贴底 / 横→贴右);修饰前缀可叠加 |
| `x-` | 忽略 | 完全不生成代码 |

**修饰前缀叠加**:

| 组合 | 效果 |
|------|------|
| `sub-img-qa` | 独立模块 + 整块图片 |
| `btn-img-banner` | 可点击 + 整块图片 |
| `fixed-btn-back-top` | 固定定位 + 可点击按钮 |
| `sub-scrollx-cards` | 独立模块 + 横向滚动 |
| `end-btn-submit` | 贴底 + 可点击提交按钮 |
| `fixed-sub-nav` | 视口固定 + 独立吸顶导航模块 |

**禁止叠加**:

- `scrollx-` / `scrolly-` 不能和 `img-` / `bg-` / `bgc-` / `btn-` / `x-` 共存
- `scrollx-` + `scrolly-` 不能同时用
- `fixed-` 不能和 `bg-` / `bgc-` / `x-` 共存(不生成节点,fixed 无处可挂)
- `end-` 不能和 `bg-` / `bgc-` / `x-` 共存(同上);`end-` + `fixed-` 同时命中时 fixed 赢,end 失效
- `input-` 不能和 `bg-` / `bgc-` / `x-` / `img-` / `btn-` 共存

---

## 配置文件 `pp-d2c.config.json`

完整字段说明见主 SKILL `templates/skills/pp-d2c/SKILL.md` §0(或 pp-d2c-rn §0)。**h5 分支典型配置**:

```jsonc
{
  "project": {
    "framework": "react",         // react | rn
    "styleFormat": "scss"         // h5: scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline
                                  // rn: 固定 stylesheet(nativewind / styled-components 目前仅识别)
  },
  "figma": {
    "token": "figd_xxx"           // Figma Personal Access Token,用于 REST API
  },
  "merge": { "mode": "component" }, // component | flat
  "unit": {
    "figmaBase": 375,             // 设计稿基准宽度
    "outputUnit": "px",           // h5: px | vw | rem;rn 无单位字符串
    "outputBase": 750,            // h5 默认 750(2 倍图);rn 硬编码为 375(scale=1)
    "scale": 2                    // h5 默认 2;rn 硬编码为 1
  },
  "images": {
    "assetsDir": "static/",       // rn 分支写死 "src/Images/"
    "imageBaseUrl": "http://127.0.0.1:8080/",  // rn 分支不用(走 require + @Images alias)
    "preserveEffectIds": []       // 例外清单:哪些 nodeId 导出时不带 use_absolute_bounds
  },
  "layers": {                     // 10 类前缀,可自定义(生产建议保持默认)
    "sub": "sub-", "block": "block-", "img": "img-", "bg": "bg-", "bgColor": "bgc-",
    "but": "btn-", "input": "input-", "scrollX": "scrollx-", "scrollY": "scrolly-",
    "fixed": "fixed-", "end": "end-", "ignore": "x-"
  },
  "output": { "dir": "pages/" },  // rn 默认 "src/pages/"
  "health": {
    "enabled": true,              // 是否启用前置体检(rn 默认 false,rn 不接 doctor)
    "blockOnError": true,         // 体检 grade=F 时是否阻塞生成
    "thresholds": { /* 9 项阈值 */ },
    "rules": {}                   // 可针对单条规则改 level / 关闭
  }
}
```

**RN 分支额外字段** `adapter` 与 `unit.responsive`:

```jsonc
{
  "unit": {
    "responsive": {
      "enabled": true,                    // rpx() 包装:按屏宽线性缩放尺寸
      "helperImport": "@/utils/rpx",      // rpx helper 的 import 路径
      "helperName": "rpx"                 // helper 导出的函数名
    }
  },
  "adapter": {
    "enabled": true,                      // 是否把 6 大 RN 标签换成目标框架标签
    "tagMap": { "View": "XView", ... },   // View / Text / Image / Pressable / TextInput / ScrollView
    "importMap": { "XView": "@ctrip/xtaro", ... },
    "propMap": { "Image": { "source": "src" } },  // 纯 prop 改名
    "referenceDoc": "xtaro.reference.md"  // 超改名的复杂差异(值域映射 / 事件签名等)在这份 md 里
  }
}
```

---

## 命令清单

```bash
# 在业务项目根目录下使用
npx @double-coding/pixel-print init      # 交互式初始化(推荐)
npx @double-coding/pixel-print install   # 仅复制模板文件,不交互
npx @double-coding/pixel-print help      # 显示帮助
```

---

## 前置依赖:Figma Personal Access Token

SKILL 通过 Figma REST API 拉取设计稿元数据 + 导出图片,只需要一枚 Personal Access Token。**不需要装任何 MCP 插件、不走 OAuth**。

### 获取 Token

1. 打开 [Figma](https://figma.com) 网页版,右上角头像 → **Settings**
2. 左侧栏进入 **Security** → 找到 **Personal access tokens**
3. 点 **Generate new token**,填名称(例如 `pp-d2c`),**Scopes** 勾选 `File content: Read-only`(至少)
4. 复制生成的 token(格式 `figd_xxxxxxxxxxxxxxxxxxxx`)
5. `init` 时粘贴到 `[单位4/4] Figma Personal Access Token []:` 那题,或后续手动填 `pp-d2c.config.json` 的 `figma.token` 字段

> **安全提示**:Token 相当于账号密码,不要 commit 到 git。项目 `.gitignore` 已默认忽略 `pp-d2c.config.json`。

### 可用性验证

跑 SKILL 时 Claude 会在**步骤 -1** 调 `figma.mjs verify-token` 探针,通过 HTTP GET `https://api.figma.com/v1/me` 验证 token:

| 探针结果 | 含义 | 处理 |
|---------|------|------|
| 200 + 返回用户信息 | Token 有效 | 继续 |
| 401 / `invalid_token` | Token 已过期 / 拼错 | 按上面步骤重新生成一枚 |
| 403 | Token 权限不含 File content: Read-only | 重新生成时勾对 scopes |
| 网络错误 | 网络不通 api.figma.com | 排查代理/防火墙 |

---

## 设计稿体检(Doctor)

h5 分支 `health.enabled: true` 时(默认),主 SKILL 在生成代码前会自动跑一次设计稿体检:

- **NAM 系列**:命名规范(NAM001-NAM020,含 v0.3.4 新增 input- 4 条)
- **LAY 系列**:布局合理性(LAY001-LAY020,含 v0.3.2 新增 end- 4 条)
- **STR / STY / AST / FEA**:嵌套深度 / 颜色对比度 / 资产体积 / 整体规模

体检完毕输出 grade(A/B/C/D/F)+ 阻塞决策。`grade=F && blockOnError=true` 时会停下来等用户确认。

报告自动写入 `{output.dir}/.d2c-health-{nodeName}-{timestamp}.md`。

> **RN 分支不接 doctor**:`pp-d2c-rn` config 默认 `health.enabled: false`,不做体检。理由:rn 分支处于收敛阶段,doctor 规则以 h5 语义为主(如 vw / css-modules),迁移到 rn 需要单独一轮 spec 化。要开也能开,但可能出现 rn 语境下的假阳。

体检规则完整定义见 [`docs/d2c-health-check-spec.md`](./docs/d2c-health-check-spec.md)。

---

## RN 分支 adapter(v0.3+)

RN 分支的核心机制:**内核以 6 大 RN 原生标签描述一切,再通过 config 映射到具体框架标签**。这样一套 SKILL 同时覆盖 pure React Native / Expo / xtaro / taro / 组织内部 RN 组件库。

**内置 3 个预设**(`templates/adapter-presets/`):

| 预设 | 目标 | 映射示意 |
|---|---|---|
| `rn` | pure React Native / Expo | 保留原名(identity),`from 'react-native'`;适合"我不做替换"场景 |
| `xtaro` | 携程 `@ctrip/xtaro` | `View→XView / Text→XText / Image→XImage / Pressable→XView / TextInput→XInput / ScrollView→XScrollView`,`from '@ctrip/xtaro'` |
| `taro` | Taro `@tarojs/components` | `View→View / Text→Text / Image→Image / Pressable→View / TextInput→Input / ScrollView→ScrollView`,`from '@tarojs/components'` |

每个预设 3 件套:`<id>.json`(映射规则)+ `<id>.rpx.ts`(专属屏宽 helper)+ `<id>.reference.md`(超改名的复杂差异手册)。

**adapter 分工**:

| 差异形态 | 承载文件 | SKILL 阶段 |
|---|---|---|
| prop 名不同、值和语义一样(如 `Image.source → src`) | `<id>.json` `propMap` | §5.5.3b 声明式改名 |
| 值域映射(如 `resizeMode='contain' → mode='aspectFit'`) | `<id>.reference.md` §一 | §5.5.3c 查手册 |
| 布尔取反(如 `editable → disabled` 取反) | `<id>.reference.md` §二 | §5.5.3c |
| 事件签名转换(如 `onChangeText(text) → onInput(e.detail.value)`) | `<id>.reference.md` §三 | §5.5.3c |
| 结构变化(如 `ScrollView.horizontal → scrollX + scrollY`) | `<id>.reference.md` §四 | §5.5.3c |
| 无跨端支持,需删属性 + warn | `<id>.reference.md` §五 | §5.5.3c |

**加自己的预设**:见 [`templates/adapter-presets/README.md`](./templates/adapter-presets/README.md)。

---

## 项目结构

```
pixel-print/
├── bin/install.js                             ← npx 入口(init / install / help)
├── templates/
│   ├── pp-d2c.config.json                     ← h5 分支配置模板
│   ├── pp-d2c.rn.config.json                  ← rn 分支配置模板
│   ├── code-connect/mappings.json             ← Figma 组件映射模板(可选)
│   ├── adapter-presets/                       ← RN adapter 预设目录
│   │   ├── README.md                          ← 加预设的说明
│   │   ├── xtaro.{json,rpx.ts,reference.md}   ← 携程 xtaro 预设(3 件套)
│   │   ├── taro.{json,rpx.ts,reference.md}    ← Taro (@tarojs/components) 预设
│   │   └── rn.{json,rpx.ts,reference.md}      ← pure React Native / Expo 预设
│   ├── rn-helpers/rpx.ts                      ← 兜底 rpx helper(用户选"自定义"无预设时用)
│   └── skills/
│       ├── pp-d2c/SKILL.md                    ← 主 D2C 流程(h5 分支,~1200 行)
│       ├── pp-d2c-rn/SKILL.md                 ← 主 D2C 流程(rn 分支,~2000 行)
│       ├── pp-doctor/SKILL.md                 ← 设计稿体检
│       ├── pp-style/SKILL.md                  ← 样式还原细节
│       └── pp-strip-nodeid/                   ← 剥离 data-node-id 调试属性
├── docs/
│   ├── design-guide.md                        ← 给设计师的命名规范指南
│   └── d2c-health-check-spec.md               ← 体检规则源(含 P0/P1/P2 优先级)
└── package.json
```

---

## 故障排查

| 现象 | 入口 |
|------|------|
| init 提示"沿用现有配置"但项目里没 config | install.js 已修复(spread merge + 调整读 existing 顺序);老版本升级方法见 SKILL §0 |
| 切出来的图带紫色画板背景色 / 光晕外扩 | `/v1/images` API 必须带 `use_absolute_bounds=true`(主 SKILL §4.4) |
| `card-bg.png` 把 bg-bg + bgc-选中框 揉成一张图 | bgc- 嵌在 bg- 子树内是错误结构(doctor NAM013 / 主 SKILL §`bg-` 内嵌 `bgc-` 的处理) |
| `bg-list.png` 把行程项内容印进背景 | `sub-scrolly-` 必须递归子层,不能整体导出(主 SKILL §`scrollx-/scrolly-` 自检 4 行) |
| Figma token 过期 / 缺失生成失败 | 自动走 L1→L2→L3 兜底链(主 SKILL §4.4.1) |
| `position: fixed` 元素跟着祖先滚动 | 祖先链有 `transform` / `filter` / `blur` 导致 fixed 退化(doctor LAY013) |
| RN 分支产物尺寸都是 ×2 / 视觉偏大 | 早期 SKILL §4.5 h5 残留导致 agent 误 ×2;v1.0.0 起 rn 分支硬编码 scale=1,figma 原值直接进 rpx() |
| `doctor.run()` 函数找不到 | SKILL.md 是 LLM 操作手册(自然语言),不是可执行代码 —— 任何 `doctor.run({...})` 都是伪代码(主 SKILL 顶部「执行模型说明」) |

更多详见 [`.Knowledge/topics/pp-d2c.md`](./.Knowledge/topics/pp-d2c.md) 的「已知历史 bug 与修订」表。

---

## 开发与维护

### 仓库结构

- **本仓库**:D2C 工具源码(SKILL 模板、install.js、文档、规则、adapter 预设)
- **业务项目**:通过 `npx @double-coding/pixel-print init` 拉取 SKILL 到 `.claude/skills/`

### 版本历史

| 版本 | 里程碑 |
|---|---|
| v0.2.x | 图层前缀体系泛化、doctor 体检、token 兜底链、嵌套 sub-、bgc- 盒级 CSS、CSS-able 自检、fixed- 前缀 |
| v0.3.0 | Figma MCP → REST API 迁移(figma.mjs);token 探针取代 whoami |
| v0.3.2 | 新增 `end-` 前缀(贴父末端 / 逆向布局) |
| v0.3.3 | 页面根容器 `min-height: max(..., 100vh)` 覆写 |
| v0.3.4 | 新增 `input-` 前缀(生成 `<input type="text">`) |
| v0.4.0 | rebrand 到 `@double-coding/pixel-print`;RN 分支 + adapter + rpx 响应式 + 参考手册机制 |
| **v1.0.0** | **首个稳定版**;GitHub 上线 `double-coding-lab/PixelPrint`;`font-` 前缀移除 |

### 给设计师同步规范

把 [`docs/design-guide.md`](./docs/design-guide.md) 发给对接设计师。开发对接前**优先**让设计师按规范命名图层,比开发自己改图层名靠谱得多。

---

## License

MIT © double-coding-lab
