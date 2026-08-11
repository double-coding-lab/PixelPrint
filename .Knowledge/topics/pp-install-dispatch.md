# pp-install-dispatch

> `bin/install.js` 分发 `templates/skills/` 到下游项目 `.claude/skills/` 的规则:黑名单 + framework 过滤,不是白名单。新 skill **默认自动分发**,不需要在 install.js 里登记。

## 适用范围

- 新加 skill 到 `templates/skills/`,想知道要不要在 install.js 里同步登记
- 用户 `npx @double-coding/pixel-print init` / `install` 时不清楚哪些 skill 会被拷到本地
- 排查"我加的 skill 为什么没落地" / "我不想让某个 skill 落地"

**不适用**:
- skill 内容本身如何写 → 看 `templates/skills/*/SKILL.md` 样板
- init 命令的交互式配置逻辑 → 看 `bin/install.js:402-827` `runInit`

## 分发规则(核心事实)

`bin/install.js:202-234` `installFiles` 遍历 `templates/skills/` **全部目录**,按 3 条过滤:

1. **framework 过滤**:`skipRn=true` 跳 `pp-d2c-rn`;`skipH5=true` 跳 `pp-d2c`
   - h5 项目(framework=react)不装 rn 主 skill,反之亦然,避免污染
   - 辅助 skill(`pp-strip-nodeid` / `pp-fix-partial` / 新增的 `pp-image-compress` 等)两端通用,不参与 framework 过滤
2. **黑名单 `OPT_IN_ONLY`**:`new Set(['pp-style', 'pp-doctor'])` 里的强制跳过
   - 这两个后期准备丢弃,保留在 templates/ 只为过渡期兼容
3. **其余全部拷贝**到 `<CWD>/.claude/skills/<skill-name>/`,包括子目录递归

**结论**:新增 skill 目录只要放到 `templates/skills/`,下游 `init` / `install` 会自动落地,**不需要**改 install.js。要想让新 skill 不默认落地,才需要把名字加入 `OPT_IN_ONLY`。

## 覆盖策略(force 参数)

- `runInit()` 调 `installFiles(true, ...)` → **force=true**,覆盖已有文件(用户升级 npm 包时刷新 skill)
- `install` 命令走 `installFiles()` 默认参数 → **force=false**,同名文件跳过(保护用户手改)
- 无论哪种,`_copyStats` 统计 copy / overwrite / skip 三态供汇总

## 命令入口

| 命令 | 行为 |
|---|---|
| `npx @double-coding/pixel-print init` | 交互式配置 + 强制刷新 skill(force=true) |
| `npx @double-coding/pixel-print install` | 仅复制模板文件,不进入交互(force=false) |
| `npx @double-coding/pixel-print clean-cache` | 清 `.d2c-cache/`,与分发无关 |

## 除 install.js 外的登记点

新 skill 若要面向用户暴露,还需同步:

- `docs/pixel-print-guide.md` §7 "装完之后长什么样"表格:一行说明 skill 作用 + 落地条件
- 若 skill 有独立触发词且需要 f2s 任务路由匹配 → 走 `f2s-kb-feat` 走完整路由登记流程
- 若 skill 只是本地工具(用户直接命令行触发,不参与 f2s 路由)→ **不在** `manifest-routing.json` 登记 topic(按 `f2s-topic-authoring.md` §6)

## 依赖

- **写入侧**:`bin/install.js:202-234` `installFiles` 是唯一分发入口
- **读取侧**:下游用户项目根 `.claude/skills/` 是落地目标
- **不受影响**:`manifest-routing.json` / `.Knowledge/` 与本 topic 无关(那是 f2s 侧路由,不是 skill 分发)

## 禁止

- 禁止在 install.js 里为新 skill 建独立白名单(会破坏"目录即分发"约定,后续新增都要改代码)
- 禁止用 `OPT_IN_ONLY` 兜底"用户可能不想要"的假设(需要选择性装的场景应改 framework 过滤或独立参数)
- 禁止指望 install.js 自动装 skill 的运行时依赖(如 Python `Pillow`、`node-canvas`):脚本只复制文件,依赖由 SKILL.md "前置依赖"段自证 + 脚本头 try import 报错兜底
