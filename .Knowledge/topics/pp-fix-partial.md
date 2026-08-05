# pp-fix-partial

> 局部 UI 修复 SKILL 的执行约定、缓存分层、图层匹配三种形态、防污染硬规则。首次实现整页走 [[pp-d2c]] / [[pp-d2c-rn]];已经出码但某一小块要重生成才用本 topic。

## 适用范围

- 整页已通过 `pp-d2c` / `pp-d2c-rn` 主 SKILL 出码,某个 sub-block 视觉/交互不满意
- 想只重跑这一小块、不重刷整页
- 需要复用 `.d2c-cache/` 里已有的 figma JSON + 图片,避免每次都重拉

**不适用**:
- 从未跑过主 SKILL 的项目 → 先跑主 SKILL,不能"跳过整页直接局部"
- 整页 figma 大改重构 → 用主 SKILL,不用本 topic
- 一次要改 ≥ 2 个 sub-block 且互相依赖 → 走主 SKILL 重跑,本 topic 不做多块联动

## 3 种目标定位形态

| 形态 | 用户输入 | target 来源 |
|---|---|---|
| A(明确) | `pp-fix-partial https://figma.com/design/XXX?node-id=138-2050` | user-url:强制校验 `fileKey === last-page.fileKey`,不同则拒绝 |
| B(无参) | `pp-fix-partial` | auto-child:拉 `last-page.rootNodeId` 的直接子节点列表让用户选一块 |
| C(自然语言) | `pp-fix-partial 顶部导航栏` | fuzzy match:对 last-page 子树 name 做 fuzzy match,列 top-5 候选 |

## 缓存分层

```
.d2c-cache/
├── figma/<fileKey>-<nodeId>.json        # REST 返回的 figma 节点 JSON + { figmaTreeHash, mtime }
├── images/<fileKey>-<nodeId>-<imgId>.png # 切图缓存,与节点 hash 绑定
├── anchors/<pageDirSlug>.json           # 由 pp-strip-nodeid 生成的 nodeId → (file, start, end) 档案
└── last-page.json                        # 由主 SKILL 独占写入,fix-partial 只读
```

## 缓存作废 3 触发

1. **hash 对比失败**:调 `figma.mjs fetch-node` 拉最新子树 → 算 fingerprint(递归 SHA1: nodeId + name + style props + children hash)→ 与缓存里的 `figmaTreeHash` 对比 → 不一致 → 删该 nodeId 全部缓存文件重拉
2. **mtime 超 7 天 TTL**:兜底 figma 侧静默变化(hash 一致但节点其实已被删的极端场景)
3. **用户显式**:`npx @double-coding/pixel-print clean-cache` 一键清 `.d2c-cache/` 整个目录

## 防污染硬规则

1. **禁止跨 fileKey**:`user-url.fileKey !== last-page.fileKey` → 直接终止,不给"跨稿子拼接"口子
2. **禁止改动 target 范围外的代码**:即便发现同页其他块也有问题,不管;让用户显式再跑一次
3. **禁止改动 `.d2c-cache/last-page.json`**:主 SKILL 独占写入,fix-partial 只读
4. **禁止把 `--no-cache` 当默认行为**:缓存复用是本 skill 核心价值,用户明确加 flag 才禁用
5. **禁止对 anchor 缺失 + data-node-id 已剥的项目做启发式硬替换**:让用户显式选组件目录

## 与其他 SKILL 的分工

| 场景 | 用哪个 |
|---|---|
| 首次整页 D2C | [[pp-d2c]] / [[pp-d2c-rn]] |
| 整页 figma 大改 | 主 SKILL 重跑,不用本 topic |
| **一小块重生成** | **`pp-fix-partial`(本 topic)** |
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
| `--no-cache` | 强制忽略 figma / images 缓存,一切重拉 |
| `--force` | 跳过 framework / outputDir 不一致的警告 |

## 完整流程见 SKILL

`templates/skills/pp-fix-partial/SKILL.md` 6 步流程:项目上下文 → target 解析 → 缓存对比 → 定位代码段 → 出新版本 → 精确替换。
