# PixelPrint D2C Prep · Figma 插件

在 Figma 里把普通设计稿快速改造成 pp-d2c 能吃的稿子——**打前缀标** + **AI/规则辅助建议**。目标不是全自动,是把最枯燥的部分变成一两次点击。

---

## 功能一览

**手工打标(核心)**

- 全量图层树 + 虚拟滚动,画布 selection 与树上高亮双向同步。
- 一键前缀按钮:9 个基础前缀(`sub-` / `img-` / `bg-` / `bgc-` / `btn-` / `input-` / `scrollx-` / `scrolly-` / `x-`)+ 4 个修饰前缀(`fixed-` / `end-` / `list-` / `bl-`)。
- 已有前缀检测 + 冲突二次确认(替换 / 保持 / 跳过)。
- 前缀互斥硬规则(NAM014 / NAM016 / NAM019 / NAM020 + scroll 互斥),命中即拒绝改名并给出原因。
- 直接改名 + Merge selected(合并画布选中节点为 group,自动加 `img-` / `sub-` / `bg-` 前缀)。

**Analyze(纯代码,不依赖 AI)**

- **图片父层建议**:遍历树,当某容器的可见子孙叶子 ≥60% 是 IMAGE fill / 矢量图形,建议整体打 `img-`。
- **透明/遮挡清理**:opacity=0、fills 全隐、被兄弟 bbox 完全遮挡 → 建议打 `x-` 忽略。
- 完全离线,几十毫秒到几百毫秒返。

**AI 建议(通过本地 ai-proxy 转 PETA)**

- **bg vs bgc 消歧**:结合截图判某个 frame 应该 `bg-` 还是 `bgc-`。
- **视觉分组**:找视觉上贴在一起、但图层没成组的多个节点,建议 merge + `img-` / `sub-`。
- 需要先跑本机 `ai-proxy`,详见下节。

---

## 构建

在项目根目录(与 `plugin/` 同级)执行:

```bash
npm install                 # 首次装依赖
npm run build:plugin        # 一次性构建
npm run watch:plugin        # 开发监听
npm run typecheck:plugin    # 只做类型检查
```

产物在 `plugin/dist/code.js` + `plugin/dist/ui.html`(已 gitignore)。

---

## 在 Figma 桌面版加载

> ⚠️ 只能在 **Figma 桌面版**加载本地插件,Web 版不支持。

1. Figma 桌面版 → Plugins → Development → **Import plugin from manifest...**
2. 选 `plugin/manifest.json`。
3. Plugins → Development → **PixelPrint D2C Prep** 启动。

改代码后重跑 `npm run build:plugin`,Figma 关掉插件重开即可。

---

## AI 能力:先跑 ai-proxy

Figma 沙箱不能直接调 PETA(公司 AI 网关,Python SDK + 凭证),需要本机转发。

首次:

```bash
cd ai-proxy
cp .env.example .env
# 编辑 .env,填 PAAS_APP_APPID / PETA_KEY_ID / PETA_DEFAULT_MODEL
bash run.sh                 # 起 localhost:8787
```

之后每次开发前 `bash ai-proxy/run.sh` 即可。健康检查:

```bash
curl http://localhost:8787/health
# {"ok":true,"hasCredentials":true,"defaultModel":"gemini-3.7-flash"}
```

`hasCredentials=false` → 说明 `.env` 没配好;此时插件里点 "AI 建议" 会返回 degraded,面板会告诉你原因。

详细接口 / 部署边界见 `ai-proxy/README.md`。

---

## 使用流程

1. 打开 Figma 桌面版一份稿子,启动插件。
2. 顶部选 scope(**整页** / **选中节点**),点 **Scan**。左侧树刷新,画布选中会自动定位到树。
3. 想让插件推建议时:
   - **Analyze**:纯代码规则,即时返(图片父层 + 透明/遮挡)。
   - **AI 建议**:调 ai-proxy(需要先跑),异步返(bg/bgc 消歧 + 视觉分组)。
4. 建议面板出现:
   - 每条显示动作(打标 / 合并)+ 前缀 + 目标节点 + 置信度 + 理由。
   - 点 **应用** 一次生效(自动 replace 已有基础前缀),**忽略** 本次会话隐藏,**全部应用** 批量。
   - 建议 target 可点击,画布会跳到该节点。
5. 手工打标(不依赖建议):
   - 在画布或树上选中节点(单选 / Cmd+click 多选),或树上勾选批量。
   - 右侧 QuickTag 面板点前缀按钮即改名。
   - 已有前缀 + 想改基础前缀 → 弹确认框,确定 = 替换,取消 = 保持。
   - 修饰前缀(`fixed-` / `end-` / `list-` / `bl-`)直接叠加,不弹框。
6. **合并**:在 Figma 画布选中要合并的一组节点,顶部 **Merge** 按钮里选 `img-` / `sub-` / `bg-`,自动 `figma.group()` 并加前缀。
7. 所有改动都是原生 Figma 操作,**Cmd+Z 逐步撤销**。

---

## 已知限制

- **Instance 节点**:允许改名,但不下钻(避免解绑主件)。要改 instance 内部,先在 Figma 里 detach 或改主 Component。
- **锁定图层**:改名 / 合并会跳过并给出原因,先在 Figma 里解锁。
- **`bl-` 无推断**:baseline 对齐依赖字体度量,只支持手工加。
- **不做 autolayout 自动设置**:v1 只做打标 + 建议,autolayout 留给设计师在 Figma 里手动开(反正 Figma 面板自己支持)。
- **AI 依赖本机进程**:未跑 ai-proxy 时,AI 建议按钮点了会立即报"无法连上 localhost:8787"。属预期,提示信息里带一键命令。
- **Analyze 不识别语义**:规则纯几何,不理解业务。视觉分组类问题只有 AI 才可能给出好建议。

---

## 故障排查

| 现象 | 原因 | 处置 |
|-----|-----|-----|
| Scan 后树是空的 | 目标 scope 只有 PAGE 空 frame | 选整页 或 至少选中一个 FRAME |
| 弹"节点数超硬上限 5000" | 选择太大 | 缩到某个 sub-frame 跑 |
| AI 建议返回 "无法连上 localhost:8787" | ai-proxy 未启动 | `cd ai-proxy && bash run.sh` |
| AI 建议返回 "PETA 凭证未配" | ai-proxy/.env 空 | 填 PAAS_APP_APPID / PETA_KEY_ID 后重启 proxy |
| Analyze 一直转圈 | 树太大 + Figma 响应慢 | 收 scope 到 selection |
| 前缀按钮点了没变化 | 命中互斥硬规则 | 看 toast 里的 NAM 代号,先解开冲突再打 |
| 改名后消失 | 是 rename 事件里 `existingPrefix` 被替换 | 属预期,cmd+z 可恢复 |

---

## 与 pp-d2c 主流程的关系

- 本插件产出:**图层名被改过的 Figma 稿**(和可能被合并的 group 结构)。
- pp-d2c 消费:通过 `figma.mjs get-metadata` 拉图层树读到改造后的结构。
- 两者完全解耦,只通过 Figma 稿实体传递。

推荐顺序:

1. 用本插件半自动打标(Analyze → 应用 → 手工补 / 改)。
2. 用 `pp-doctor` SKILL 做健康检测,过 grade 就走下一步。
3. 用 `pp-d2c` SKILL 出码。

---

## 版本

- 起始版本 `v0.1.0`(v0.3 内部重构,不影响外部版本号)。
- 独立于 npm 主包 `@double-coding/pixel-print`。

---

## 相关文档

- 需求澄清:`.Knowledge/req-docs/pp-d2c-prep-plugin_需求澄清.md`
- 技术方案:`.Knowledge/req-docs/pp-d2c-prep-plugin_技术方案.md`
- 前缀协议:`.Knowledge/topics/pp-d2c.md`
- AI proxy:`ai-proxy/README.md`
