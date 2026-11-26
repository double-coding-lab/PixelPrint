---
id: pp-fix-partial
revision: 4
summary: "整页出码后按 nodeId 或自然语言局部重生成 sub-block 的修复流程"
dependsOn: [pp-d2c]
primary: feature
confidence: manual
tags: [module]
---
# pp-fix-partial

执行前须先读依赖主题 `pp-d2c`。

> 局部 UI 修复 SKILL 的执行约定、缓存分层、图层匹配三种形态、防污染硬规则。首次实现整页走 [[pp-d2c]] / [[pp-d2c-rn]];已经出码但某一小块要重生成才用本 topic。

## 适用范围

- 页面已有可定位源码或可续作产物，局部视觉/交互需要修改
- 想只重跑这一小块、不重刷整页
- 需要复用 `.d2c-cache/` 里已有的 figma JSON + 图片,避免每次都重拉

**不适用**:
- 没有可定位源码且需求是首次生成 → 先走主 SKILL
- 整页 figma 大改重构 → 用主 SKILL,不用本 topic
- 相关区块可按明确依赖和唯一owner联动，只有整页重构才回主流程

## 3 种目标定位形态

| 形态 | 用户输入 | target 来源 |
|---|---|---|
| A(明确) | `pp-fix-partial https://figma.com/design/XXX?node-id=138-2050` | user-url:强制校验 `fileKey === last-page.fileKey`,不同则拒绝 |
| B(无参) | `pp-fix-partial` | auto-child:拉 `last-page.rootNodeId` 的直接子节点列表让用户选一块 |
| C(自然语言) | `pp-fix-partial 顶部导航栏` | fuzzy match:对 last-page 子树 name 做 fuzzy match,列 top-5 候选 |

## 本轮分流与缓存

- 先读共用执行契约。纯代码交互/样式修改先定位当前入口，跳过Figma发现与取数；缺少last-page时从明确路径或唯一现有入口继续。设计节点修复才使用fileKey与根范围校验。
- 实际CLI缓存为`.d2c-cache/<fileKey>/meta.json`、`nodes/<nodeId-safe>.json`及`images.json`，anchors与last-page用于源码定位；不能另造figma/images缓存布局或声称固定7天TTL。
- 需要设计事实时由主agent按真实CLI执行一次cache-check，再获取/复用完整缓存；设计变化或缺失才补取，子任务共享。已保存图片及规则报告核对来源、范围、配置和摘要后复用。
- 失败续作先核验现有源码、报告和清单；不要求先有整页成功记录，也不因涉及两个区块而重做整页。最终版本的规则、修改前后视觉保形及真实行为分别验收。

## 防污染硬规则

1. **禁止跨 fileKey**:`user-url.fileKey !== last-page.fileKey` → 直接终止,不给"跨稿子拼接"口子
2. **禁止改动 target 范围外的代码**:即便发现同页其他块也有问题,不管;让用户显式再跑一次
3. **禁止改动 `.d2c-cache/last-page.json`**:主 SKILL 独占写入,fix-partial 只读
4. **按真实CLI更新缓存**：不透传不存在的`--no-cache`开关，不自动清空其他设计与定位资料
5. **禁止对 anchor 缺失 + data-node-id 已剥的项目做启发式硬替换**:让用户显式选组件目录

## 与其他 SKILL 的分工

| 场景 | 用哪个 |
|---|---|
| 首次整页 D2C | [[pp-d2c]] / [[pp-d2c-rn]] |
| 整页 figma 大改 | 主 SKILL 重跑,不用本 topic |
| **一小块修改或重生成** | **`pp-fix-partial`(本 topic)** |
| 上线前剥 `data-node-id` | `pp-strip-nodeid`(同时把 anchor 档案存到 `.d2c-cache/anchors/`) |
| 一键清所有缓存 | `npx @double-coding/pixel-print clean-cache` |

## 依赖

- **写入侧**:`pp-d2c` / `pp-d2c-rn` §6.3 出码成功后写 `.d2c-cache/last-page.json`(单值语义,覆写不追加);QA 失败或用户中断则不写
- **写入侧**:`pp-strip-nodeid` 剥属性前把 `data-node-id` → 代码位置存到 `.d2c-cache/anchors/<pageDirSlug>.json`(加 `--no-anchors` 可关)
- **读取侧**:本 topic 依赖上面两处输出;都缺时降级到"grep data-node-id / 让用户选组件目录"

## 参数速查

| 参数 | 用途 |
|---|---|
| `[figmaUrl]` | 明确要修的 figma 节点 URL |
| `[目标描述]` | 自然语言 fuzzy match 子节点 name |
| `--dry-run` | 只走 1-4 步不动代码,输出 diff 给用户看 |
| 最新设计检查 | 主任务执行cache-check校验版本；CLI不提供no-cache强刷开关 |
| `--force` | 跳过 framework / outputDir 不一致的警告 |

## 最小修复与验收

- 先读当前 framework 主 SKILL 的并行校验与修复收敛约定；从现有源码和用户具体反馈做最小 patch，结构确需重建才重出完整 block。
- 候选在临时目录中验证，patch 的检查上下文应包含现有完整 block 与依赖；取得真实规则报告和运行截图，达标后替换，按候选 diff 同时应用目标 JSX 与关联样式，替换后核对最终版本及受影响的组合门禁；RN 先按配置做 §5.4 rpx 转换再做 §5.5 adapter，已有转换不重复包装。
- 同一问题无改善转根因诊断；失败保留候选、具体规则与证据，不能隐藏节点或伪造通过。正常收尾不主动增加新优化。

## 完整流程见 SKILL

`templates/skills/pp-fix-partial/SKILL.md` 6 步流程:项目上下文 → target 解析 → 缓存对比 → 定位代码段 → 出新版本 → 精确替换。
