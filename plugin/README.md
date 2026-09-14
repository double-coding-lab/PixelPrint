# PixelPrint D2C Prep · Figma 插件

把普通 Figma 设计稿**半自动**改造为符合 pp-d2c 约定的稿子——**打前缀标 + Autolayout 化**——供 pp-d2c 后续像素级出码使用。

---

## 功能

1. **前缀打标(半自动)**:遍历图层树,对每个 frame 推荐 pp-d2c 前缀(`sub-` / `img-` / `bg-` / `bgc-` / `btn-` / `list-` / `input-` / `fixed-` / `end-` / `x-` / `scrollx-` / `scrolly-` / `bl-`)+ 置信度,面板批量确认后**原地改名**。
2. **Autolayout 化**:识别子层几何呈规整水平/垂直排列的绝对定位容器,反推 `layoutMode` / `padding` / `itemSpacing` / `align`,**原地设置**auto layout。
3. **前缀互斥硬规则**:NAM014 / NAM016 / NAM019 / NAM020 + scroll 互斥,命中即在面板阻止 Apply(标红)。
4. **健康报告导出**:导出改造后的前缀/autolayout 分布 JSON,供后续手动跑 `pp-doctor` 终检。

**不做**:业务语义猜测、强改已有 auto layout、根容器 `min-height:100vh` 覆写、`end-` wrapper 结构变换(这些留给 pp-d2c 出码时处理)、自动调 `pp-doctor`。

---

## 构建

在项目根目录(与 `plugin/` 同级)执行:

```bash
# 首次安装依赖
npm install

# 一次性构建
npm run build:plugin

# 开发时监听重建
npm run watch:plugin

# 类型检查(不产物)
npm run typecheck:plugin
```

产物落在 `plugin/dist/`:

- `plugin/dist/code.js` — 沙箱主入口
- `plugin/dist/ui.html` — 面板 HTML(已内联 UI JS)

`plugin/dist/` 已在 `.gitignore`,不入版本控制。

---

## 在 Figma 桌面版加载

> ⚠️ 只能在 **Figma 桌面版**加载本地插件,Web 版不支持。

1. 打开 Figma 桌面版,登录。
2. 打开一份设计稿。
3. 菜单栏 → `Plugins` → `Development` → `Import plugin from manifest...`
4. 选择 `plugin/manifest.json`(本仓库路径 `<repo>/plugin/manifest.json`)。
5. 加载完毕后,菜单栏 → `Plugins` → `Development` → `PixelPrint D2C Prep`。

后续每次开发迭代,只要跑过 `npm run build:plugin`,Figma 里重启插件即可看到新版本。开着 `npm run watch:plugin` 时,改代码后 Figma 关插件重开即可。

---

## 使用流程

1. 打开一份普通稿子(或选中某个 frame)。
2. 启动插件,面板顶部选**整页**或**选中节点**。
3. 点 **Scan**:插件遍历目标 frame 树,列出所有候选。
   - 高置信度默认勾选、中/低不勾选、硬规则命中不可勾选。
   - 表格里可下拉修改前缀、点开 autolayout 编辑参数。
4. 逐行看备注列:
   - 🔴 红色 badge:硬规则命中(NAM014 等),不可 Apply。
   - 🟡 黄色 badge:旧前缀 / 已有 D2C 前缀,建议人工确认。
   - 🔵 蓝色 badge:兜底命名等提示。
5. 确认好勾选项后,点 **Apply**:
   - 弹确认框,确认后逐条修改。
   - 完成后弹 toast 显示成功/失败数。
   - **Cmd+Z 可整体撤销**这次 Apply(Figma 原生行为)。
6. 需要再看统计时,点 **导出健康报告** 下载 JSON。

---

## 已知限制

- **不识别网格布局**:3×N 网格类排列的容器,主副轴都散布,保留 ABSOLUTE。
- **不改 Instance**:面板跳过 Instance(避免解绑主件),需自己处理主 Component 后 Instance 自动同步。
- **锁定图层**:面板显示但不可 Apply,需先在 Figma 里解锁。
- **`bl-` 无自动推断**:baseline 对齐依赖字体度量,v1 只支持手动加。
- **不备份**:改动依赖 Figma 原生 Cmd+Z 撤销,插件不自动 duplicate 页面做快照。担心风险请自己在跑插件前复制页面。

---

## 故障排查

| 现象 | 原因 | 处置 |
|-----|-----|-----|
| Scan 后候选是空的 | 选中范围只有 TEXT / VECTOR 等叶子节点 | 选中一个 FRAME 或整页跑 |
| 弹提示"节点数超硬上限 5000" | 选择范围太大 | 缩小到某个 sub-frame 单独跑 |
| Apply 提示"节点类型 XXX 不支持 auto layout" | GROUP 无法设 layoutMode | 先在 Figma 里将 GROUP 转为 FRAME 再 Scan |
| Apply 后视觉有 ±几 px 偏移 | Figma 设 autolayout 后自动重排子层几何 | 属预期,目视核对无问题即可 |
| 面板加载空白 | ui.html 未构建 | 跑 `npm run build:plugin` 后重启插件 |
| 报"节点已锁定" | Figma 里图层被锁 | 在 Figma 里解锁后重新 Scan |

---

## 与 pp-d2c 主流程的关系

- 本插件产出:一份**图层名和 auto layout 属性被改过的 Figma 稿**。
- pp-d2c 消费:通过 `figma.mjs get-metadata` 拉图层树时读到的就是改造后的结构。
- 两者**完全解耦**,无 import 依赖,只通过"设计稿实体"传递。

跑完本插件后建议(顺序):

1. 用 Figma 目视核对改造效果(3 个参考稿见 `.Knowledge/req-docs/pp-d2c-prep-plugin_需求澄清.md` §7)。
2. 用 `pp-doctor` SKILL 做健康检测,过 grade 就 OK。
3. 用 `pp-d2c` SKILL 出码。

---

## 版本

- 插件版本(`plugin/manifest.json`):独立于 npm 主包 `@double-coding/pixel-print`。
- 起始版本 `v0.1.0`。

---

## 相关文档

- 技术方案:`.Knowledge/req-docs/pp-d2c-prep-plugin_技术方案.md`
- 需求澄清:`.Knowledge/req-docs/pp-d2c-prep-plugin_需求澄清.md`
- 前缀协议:`.Knowledge/topics/pp-d2c.md` / `docs/PixelPrint-设计师图层规范.md`
- 健康检测:`.Knowledge/topics/pp-doctor.md`
