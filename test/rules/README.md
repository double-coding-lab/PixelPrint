# pp-d2c 硬防线规则回归测试

`npm test`（= `node test/rules/run-all.mjs`）一键跑全部 fixture 用例。**改任何 `templates/skills/pp-d2c/bin/` 下的规则或 lib 代码，提交前必须跑一遍。**

## 文件与覆盖

| 文件 | 覆盖 | 用例数 | 来源批次 |
|---|---|---|---|
| `test-r03-r09-r12-r14.mjs` | R03 implicit-image / R09 btn-bgc / R12 flat-mode-naming / R14 fixed-z-index | 23 | v1.2.3 软→硬迁移（R12 曾靠此抓到 `m[2]` 捕获组真 bug） |
| `test-r04.mjs` | R04 text-gradient | 10 | v1.2.3 |
| `test-r20.mjs` | R20 absolute-position（含 v1.2.4 `position: absolute` 强制；case 2 = test27 `main__screen` relative 逃逸回归） | 7 | v1.2.4 |
| `test-scope.mjs` | `inferBlockRoot`(LCA) / `pruneToSubtree`（--block 局部化基座） | 9 | v1.2.4 |

测试对象只有 `templates/skills/pp-d2c/bin/`（主本）。`pp-d2c-fast/bin` 按约定与主本**逐字节同步**（`rsync -a --delete` + `diff -r` 校验），测主本即覆盖 fast；**禁止**把本目录塞进 `bin/`（会随 install 下发到下游）。

## 已知保守取舍（不是 bug，勿"修"）

以下行为是**有意的**宁漏报不误判取舍（v1.2.4 交叉校验记录在案），改动前先想清楚会不会引入 exit-1 级误报：

1. **IMG-reconcile 后缀匹配放行**（check-rules.mjs）：JSX 动态拼接会让引用只捕到文件名尾部碎片，manifest 条目 `endsWith(碎片)` 即算已消费——代价是"手切文件名恰为某条目后缀"这类真违规被放走。
2. **R20 只查 CSS 文件**：JSX 内联 `style={{position:'absolute'}}` 不被识别。与产物规范"样式落 CSS"一致时不触发；若未来允许内联定位需同步改规则。
3. **R22 `jsxHasInlineVisual` 正则**：`[^>]*` 会被属性值里的 `=>` 截断，background 写在 onClick 之后可能误报——仅 warning 级，接受。
4. **IMG-reconcile 扩展名大小写敏感**：`foo.PNG` vs `foo.png` 会误报；正则也会捕获注释里的图片文件名。
5. **inferBlockRoot 理论 under-scope**：产物漏渲染整棵根级兄弟子树且 block 根未挂 data-node-id 时，LCA 收窄导致被漏子树裁出对账范围——实践由 §5.1.1"根元素必挂 data-node-id"兜住，另有显式 `--root` 逃生口。

## 新增用例约定

- 每次真实事故 → 一个永久回归用例（如 test27 relative 逃逸 → test-r20 case 2），用例名里注明事故来源。
- fixture 直接构造 `{cache:{nodes}, product:{style,jsx}, config, classMap}` 调 `rule.check()`，不依赖磁盘与网络。
