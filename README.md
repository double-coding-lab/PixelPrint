# PixelPrint(像素打印)

> npm 包名:`@double-coding/pixel-print` · GitHub:[double-coding-lab/PixelPrint](https://github.com/double-coding-lab/PixelPrint) · License MIT
>
> 中文名「像素打印」,寓意像素级还原 —— 把 Figma 每一像素、每一间距、每一个圆角原样"打印"成前端代码。

一套让 **Claude Code** 学会「把 Figma 稿子还原成代码」的知识包。装到项目里,把设计稿链接发给 Claude,它自己拆图层、切图、出代码、逐块视觉对比。

**H5(React)** / **React Native** / **RN 系跨端(xtaro / taro / 自定义)** 三端产物一套 SKILL 全覆盖。走 Figma 原生 REST API,不装 MCP 插件、不走 OAuth。

## 文档导航

| 文档 | 面向 | 用来做什么 |
|---|---|---|
| **本文 README** | 已经决定用的开发者 | 参数、配置、命令、故障排查速查 |
| [`docs/pixel-print-intro.md`](./docs/pixel-print-intro.md) | 不了解 PixelPrint 的人 | 3 分钟看懂"这是什么、能做什么" |
| [`docs/pixel-print-architecture.md`](./docs/pixel-print-architecture.md) | 维护者/贡献者 | 架构、执行模型、缓存、adapter、演化史 |
| [`docs/design-guide.md`](./docs/design-guide.md) | **设计师** | 图层命名规范(命名对了,开发省 10 倍时间) |
| [`docs/d2c-health-check-spec.md`](./docs/d2c-health-check-spec.md) | 想调 doctor 的人 | 体检规则完整定义 |

---

## 快速开始

### 1. 装到项目

```bash
cd 你的业务项目
npx @double-coding/pixel-print init
```

`init` 是交互式引导,共 8-13 题(H5 略少、RN 略多)。1 分钟内答完,自动落地 SKILL + 配置 + 图片资产目录 + Figma Token(存到 `.env`,自动 gitignore)。

**init 会问什么**(v1.1.0 起 [1/8] 平铺一层 13 项):

```
[1/8] 项目框架 + 方案:
   ● React / SCSS
     React / SCSS Modules
     React / LESS / LESS Modules / CSS / CSS Modules
     React / Tailwind / Inline Style
     RN / pure React Native / Expo
     RN / Taro (@tarojs/components)
     RN / 携程 xtaro
     RN / 自定义标签映射(后续手填)
     RN / 不启用组件映射(保留 RN 原写法)
[2/8]  RN 分支才问:是否启用响应式 rpx() 包装
[3/8]  合并模式:component / flat
[4/8]  图片输出目录 [默认 static/,rn 默认 assets/]
[5/8]  H5 才问:图片 base URL [默认 http://127.0.0.1:8080/]
[6/8]  代码输出目录 [默认 pages/,rn 默认 src/pages/]

阶段三:单位换算(设计稿基准宽度 / 单位 / 输出基准 / Figma Token)
```

> **可重复运行**:再次跑 `init` 会**自动沿用现有 config 里的值**,只对缺失字段弹交互。想改某项就删掉 config 对应字段后重跑。

### 2. 把设计稿链接发给 Claude

```
把这份稿子转成代码:https://figma.com/design/AAA?node-id=138-1797
```

Claude 会自动:

1. 探活 Figma Token → 2. 跑 doctor 体检(可关) → 3. 拉图层树,按 `sub-` 前缀并行分派 sub-agent → 4. 切图(REST API 严格 bbox)→ 5. 逐 sub-block 视觉对比 → 6. 出完整可运行产物 + 交付清单。

---

## 装完之后长什么样

**SKILL**(`.claude/skills/`,按 framework 分):

| SKILL | 作用 | 何时落地 |
|---|---|---|
| `pp-d2c/` | H5 主 D2C 流程 | framework=react 时 |
| `pp-d2c-rn/` | RN 主 D2C 流程(6 大 RN 内核标签 + adapter) | framework=rn 时 |
| `pp-strip-nodeid/` | 剥离 `data-node-id` 调试属性 + 生成 anchor 档案 | 总是装 |
| `pp-fix-partial/` | **局部 UI 修复**(v1.1.0+) | 总是装 |
| `pp-doctor/` `pp-style/` | 体检 / 样式速查 | opt-in(需手工 cp 过来) |

**配置与资产**:

- `pp-d2c.config.json` — 项目配置(前缀映射 / 单位换算 / 图片路径 / 体检阈值 / adapter);**已默认 gitignore**
- `.env` — 存 `FIGMA_TOKEN`;**已默认 gitignore**
- `.d2c-cache/` — 跨会话缓存(figma JSON / 切图 / anchor / last-page.json);**已默认 gitignore**
- `code-connect/mappings.json` — Figma 组件 → 代码组件映射表(可选)
- (RN 分支)`src/utils/rpx.ts` — 响应式尺寸 helper

---

## 图层命名规范(给设计师看)

完整规范:[`docs/design-guide.md`](./docs/design-guide.md)。速查表:

| 前缀 | 含义 | 生成效果 |
|------|------|---------|
| `sub-` | 独立模块 | 单独 sub-agent,生成独立组件;支持嵌套(最深 3 层) |
| `block-` | 独立布局块 | HTML/CSS 隔离容器,不可点击 |
| `img-` | 整块图片 | 整层导出为 PNG,不递归子孙 |
| `bg-` | 背景图 | 写父元素 `background-image`,不递归子孙 |
| `bgc-` | 盒级装饰 | 写父元素 fills / strokes / cornerRadius / effects,不递归 |
| `btn-` | 可点击 | H5:`<button>`;RN:`<Pressable>` |
| `input-` | 输入框 | 生成 `<input>` / `<TextInput>`,子 TEXT 变 placeholder |
| `scrollx-` / `scrolly-` | 横向 / 纵向滚动 | overflow + 隐藏滚动条,**继续递归子层** |
| `fixed-` | 视口固定 | `position: fixed`,读 Figma constraints |
| `end-` | 贴父末端 | auto-layout 里贴向末端(纵→贴底 / 横→贴右) |
| `x-` | 忽略 | 不生成代码 |

**修饰前缀可叠加**(选例):`fixed-btn-back-top` / `sub-scrollx-cards` / `end-btn-submit` / `fixed-sub-nav`。

**禁止叠加**:
- `scrollx-` / `scrolly-` × `img-` / `bg-` / `bgc-` / `btn-` / `x-`(语义冲突)
- `fixed-` × `bg-` / `bgc-` / `x-`(bg/bgc 不生成节点,fixed 无处可挂)
- `input-` × `bg-` / `bgc-` / `x-` / `img-` / `btn-`

---

## 命令清单

```bash
# 在业务项目根目录使用
npx @double-coding/pixel-print init          # 交互式初始化(推荐)
npx @double-coding/pixel-print install       # 仅复制模板文件,不交互
npx @double-coding/pixel-print clean-cache   # 清 .d2c-cache/(figma / images / anchors / last-page.json)
npx @double-coding/pixel-print help          # 帮助
```

---

## 常用能力

### 局部 UI 修复(v1.1.0)

页面已经出码,某一小块视觉不对,不用整页重跑。让 Claude 走 `pp-fix-partial`:

```
# 3 种触发形态
pp-fix-partial https://figma.com/design/AAA?node-id=138-2050   # 明确 URL
pp-fix-partial                                                  # 不传参:拿最近实现的整页,让你选一个子块
pp-fix-partial 顶部导航栏                                        # 自然语言 fuzzy match
```

**利用缓存不污染**:
- hash 对比 target 子树 → 变了才 invalidate 该 nodeId 的缓存
- 图片文件名带 fileKey 前缀 → 换稿子天然隔离
- 缓存 mtime 超 7 天自动 TTL 作废

详见 [`.Knowledge/topics/pp-fix-partial.md`](./.Knowledge/topics/pp-fix-partial.md) 或 SKILL 本身。

### 剥调试属性 + 存锚点

上线前跑一次,把 `data-node-id="..."` 从产物剥掉,顺手把 nodeId → (file, startLine, endLine) 存到 `.d2c-cache/anchors/`,供后续 `pp-fix-partial` 精确定位:

```bash
node .claude/skills/pp-strip-nodeid/strip-node-id.mjs --dry-run   # 先预览
node .claude/skills/pp-strip-nodeid/strip-node-id.mjs             # 确认后清理
```

加 `--no-anchors` 关掉锚点写入(如果只是纯剥,不打算用局部修复)。

### 设计稿体检(Doctor)

H5 分支 `health.enabled: true` 时(默认),主 SKILL 生成代码前会跑一次体检:

- **NAM** 命名规范 · **LAY** 布局合理 · **STR** 嵌套深度 · **STY** 颜色/字号 · **AST** 资产体积 · **FEA** 整体规模
- 输出 grade(A/B/C/D/F)+ 阻塞决策;`grade=F && blockOnError=true` 会停下来等确认
- 报告落到 `{output.dir}/.d2c-health-{nodeName}-{timestamp}.md`

**RN 分支不默认接 doctor**(规则以 H5 语义为主,RN 语境会假阳)。

### RN Adapter(v0.4+)

RN 分支的核心机制:**内核用 6 大 RN 原生标签描述一切**(`View / Text / Image / Pressable / TextInput / ScrollView`),`§5.5` 阶段读 config 换标签。这样一套 SKILL 覆盖 pure RN / Expo / xtaro / taro / 自定义。

内置 3 个预设:

| 预设 | 目标 | 映射示意 |
|---|---|---|
| `rn` | pure RN / Expo | 保留原名(identity),`from 'react-native'` |
| `xtaro` | 携程 `@ctrip/xtaro` | `View→XView / TextInput→XInput / ScrollView→XScrollView`,`from '@ctrip/xtaro'` |
| `taro` | Taro `@tarojs/components` | `TextInput→Input / Pressable→View`,`from '@tarojs/components'` |

每个预设 3 件套:`<id>.json`(映射规则)+ `<id>.rpx.ts`(专属屏宽 helper)+ `<id>.reference.md`(超改名的复杂差异手册)。

**加自己的预设**:见 [`templates/adapter-presets/README.md`](./templates/adapter-presets/README.md)。

---

## 配置文件 `pp-d2c.config.json`

字段完整说明见主 SKILL `templates/skills/pp-d2c/SKILL.md` §0 或 `pp-d2c-rn/SKILL.md` §0。**核心字段**:

```jsonc
{
  "project": {
    "framework": "react",     // react | rn
    "styleFormat": "scss"     // h5: scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline
                              // rn: 固定 stylesheet
  },
  "merge": { "mode": "component" },   // component | flat
  "unit": {
    "figmaBase": 375,         // 设计稿基准宽度
    "outputUnit": "px",       // h5: px | vw | rem;rn 无单位字符串
    "outputBase": 750,        // h5 默认 2 倍图;rn 固定 = figmaBase
    "scale": 2                // h5 默认 2;rn 固定 1
  },
  "images": {
    "assetsDir": "static/",   // rn 默认 "assets/"
    "imageBaseUrl": "http://127.0.0.1:8080/",  // rn 走 require 不用 URL
    "preserveEffectIds": []
  },
  "layers": { /* 12 类前缀映射,生产建议保持默认 */ },
  "output": { "dir": "pages/" },      // rn 默认 "src/pages/"
  "health": { "enabled": true, "blockOnError": true, /* ... */ }
}
```

**RN 分支额外字段** `adapter` + `unit.responsive`:

```jsonc
{
  "unit": {
    "responsive": {
      "enabled": true,
      "helperImport": "@/utils/rpx",
      "helperName": "rpx"
    }
  },
  "adapter": {
    "enabled": true,
    "tagMap": { "View": "XView", "...": "..." },
    "importMap": { "XView": "@ctrip/xtaro", "...": "..." },
    "propMap": { "Image": { "source": "src" } },
    "referenceDoc": "xtaro.reference.md"
  }
}
```

> **Token 不入 config**:v1.0.2 起 Figma Token 走 `.env` `FIGMA_TOKEN=...`,`pp-d2c.config.json` 不再存 token 字段。

---

## Figma Personal Access Token

SKILL 通过 Figma REST API 拉稿子 + 导图,只需要一枚 Personal Access Token。**不需要装任何 MCP 插件、不走 OAuth**。

**获取步骤**:

1. 打开 [figma.com](https://figma.com) 登录,右上头像 → **Settings**
2. 左侧 **Security** → **Personal access tokens** → **Generate new token**
3. 名称随意(如 `pp-d2c`),**Scopes** 至少勾 `File content: Read-only`
4. 复制 token(格式 `figd_xxx...`),不要关窗口(离开无法再看)
5. `init` 时粘贴到 Token 那题,或后续手动写到项目根 `.env` 的 `FIGMA_TOKEN=`

**探针验证**:Claude 跑 SKILL 步骤 -1 会调 `figma.mjs verify-token`:

| 结果 | 含义 | 处理 |
|---|---|---|
| 200 | Token 有效 | 继续 |
| 401 | Token 已过期/拼错 | 重新生成 |
| 403 | Scope 不够 | 重新生成时勾 `File content: Read-only` |
| 网络错误 | 网络不通 api.figma.com | 排查代理/防火墙 |

> **安全**:`.env` 默认 gitignore。请勿把 token 写进任何 committed 文件。

---

## 项目结构

```
pixel-print/
├── bin/install.js                     ← npx 入口(init / install / clean-cache / help)
├── templates/
│   ├── pp-d2c.config.json             ← h5 分支配置模板
│   ├── pp-d2c.rn.config.json          ← rn 分支配置模板
│   ├── code-connect/mappings.json     ← Figma 组件映射模板(可选)
│   ├── adapter-presets/               ← RN adapter 预设目录
│   │   ├── README.md                  ← 加预设的说明
│   │   ├── rn.{json,rpx.ts,reference.md}       ← pure RN
│   │   ├── taro.{json,rpx.ts,reference.md}     ← Taro
│   │   └── xtaro.{json,rpx.ts,reference.md}    ← 携程 xtaro
│   ├── rn-helpers/rpx.ts              ← 兜底 rpx helper
│   └── skills/
│       ├── pp-d2c/SKILL.md            ← H5 主流程(~1700 行)+ bin/figma.mjs
│       ├── pp-d2c-rn/SKILL.md         ← RN 主流程(~2200 行)+ bin/figma.mjs
│       ├── pp-strip-nodeid/           ← 剥属性 + 存锚点档案
│       ├── pp-fix-partial/            ← 局部 UI 修复(v1.1.0)
│       ├── pp-doctor/                 ← opt-in
│       └── pp-style/                  ← opt-in
├── docs/
│   ├── pixel-print-intro.md           ← 简介
│   ├── pixel-print-architecture.md    ← 技术讲解
│   ├── design-guide.md                ← 给设计师的命名规范
│   └── d2c-health-check-spec.md       ← 体检规则源
└── package.json
```

---

## 故障排查

| 现象 | 入口 |
|------|------|
| 切出来的图带画板背景色 / 光晕外扩 | `/v1/images` 必须带 `use_absolute_bounds=true`(主 SKILL §4.4) |
| `card-bg.png` 把 `bg-bg` + `bgc-选中框` 揉成一张 | bgc- 嵌在 bg- 子树是错误结构(doctor NAM013) |
| `bg-list.png` 把列表项内容印进背景 | `sub-scrolly-` 必须递归子层不能整体导出(主 SKILL §4.4 自检 4 行) |
| Figma token 过期 / 失败 | 走 verify-token 探针;失败终止,用户重生 token 后重跑 |
| `position: fixed` 元素跟着祖先滚动 | 祖先链有 `transform` / `filter` / `blur`(doctor LAY013) |
| RN 产物尺寸 ×2 视觉偏大 | 早期 h5 残留;v1.0.0 起 rn 硬编码 `scale=1` |
| `doctor.run()` 函数找不到 | SKILL.md 是 LLM 操作手册,不是可执行代码(见 [architecture.md §3](./docs/pixel-print-architecture.md#3-核心抽象skill-是-llm-操作手册不是可执行代码)) |
| 局部修复找不到 target | 先确认 `.d2c-cache/last-page.json` 存在;不存在说明还没跑过整页主 SKILL |
| 缓存出问题 / 想重来 | `npx @double-coding/pixel-print clean-cache` |

更多历史 bug 与修订见 [`.Knowledge/topics/pp-d2c.md`](./.Knowledge/topics/pp-d2c.md)。

---

## 版本历史

| 版本 | 里程碑 |
|---|---|
| **v1.1.0** | **新增 `pp-fix-partial` 局部修复 skill + `.d2c-cache/last-page.json` + `pp-strip-nodeid` 存 anchor 档案 + `clean-cache` 命令 + init [1/8] 平铺一层** |
| v1.0.3 | RN 页面根强制 ScrollView 骨架 + fixed 分层贴屏 + bg- 铺满用 Figma 事实尺寸 |
| v1.0.2 | Token 迁到 `.env`;`sub-` FIXED 高度 → `min-height` 防塌陷;冗余嵌套 autoLayout 属性向内层下穿 |
| **v1.0.0** | **首个稳定版**;GitHub 上线 `double-coding-lab/PixelPrint`;`font-` 前缀移除 |
| v0.4.0 | rebrand 到 `@double-coding/pixel-print`;RN 分支独立 + adapter 机制 + rpx 响应式包装 + reference.md 手册机制 |
| v0.3.x | Figma MCP → REST API 迁移(figma.mjs);token 探针取代 whoami;新增 `end-` / `input-` 前缀;页面根 `min-height: max(..., 100vh)` |
| v0.2.x | 图层前缀体系泛化、doctor 体检、token 兜底链、嵌套 sub-、bgc- 盒级 CSS、CSS-able 自检、`fixed-` 前缀 |

架构决策 + 每个变化的触发原因见 [`docs/pixel-print-architecture.md §12`](./docs/pixel-print-architecture.md#12-演化史为什么是今天的样子)。

---

## 开发与维护

- **本仓库**:D2C 工具源码(SKILL 模板 / install.js / adapter 预设 / 文档)
- **业务项目**:通过 `npx @double-coding/pixel-print init` 拉 SKILL 到 `.claude/skills/`
- **给设计师同步规范**:把 [`docs/design-guide.md`](./docs/design-guide.md) 发过去,让他们按规范命名图层。**开发对接前优先让设计师改**,比开发自己改效率高 10 倍以上。

---

## License

MIT © double-coding-lab
