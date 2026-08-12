# R10 - no-fake-solid-color

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌ (需交叉核对 cache 与产物)
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - R06 已判定过的 TEXT color 值 → 不重复扫
  - R07/R09 已判定过的 background 色 → 不重复扫

## 触发条件

- **产物**: SCSS 中出现 `color: #XXX` / `background-color: #XXX` / `background: #XXX` 之类的 SOLID 色
- **cache 侧**: 该 CSS 规则对应的 `nodeId` 的所有 fills 中,**找不到**任何 SOLID 色的 HEX 与该产物色匹配
- **意味着**: agent 幻觉搓色

## 期望产物

**核心原则**: 产物里出现的每一个 `#RRGGBB` 都必须在 cache 里能找到 fills 源头。

**判定算法**:
1. Read 产物所有 .scss / .css 文件
2. 提取所有 `#RRGGBB` (或 `rgba(...)` 已知色)
3. 对每个色,反查:该规则挂在哪个 `nodeId` 的 className 下
4. Read 该 nodeId 的 cache,遍历 fills:
   - 有匹配 SOLID.color → OK
   - 全部 GRADIENT/IMAGE → 走 R04/R07/R09,不属 R10
   - 找不到匹配 → **R10 命中(幻觉色)**

## 反例 (agent 常见错法)

```scss
/* Figma nodeId=211:32 fills = [] (无填充,靠父容器)
   agent 幻觉搓: */
.topbar { background-color: #F5F5F5; }  /* ❌ cache 里找不到 #F5F5F5 */

/* Figma nodeId=211:411 fills = [{SOLID, #003366, visible:true}]
   agent 幻觉搓: */
.title { color: #0066CC; }  /* ❌ #0066CC ≠ #003366 */
```

## 落地代码模板

**从 cache 精确取色**:
```js
// UI sub-agent 生 SCSS 前,遍历本 block 每个 TEXT/RECT 节点:
const solid = pickSolidColor(node.fills);   // 取第一个可见 SOLID
if (!solid) return;                          // 无 SOLID 就不写色
const hex = rgbaToHex(solid.color);
// 输出: color: {hex};
```

## 违反后果

- **产物表现**: 颜色与设计稿不符,agent 常"猜"一个相近色
- **典型事故**:
  - v0.3.15 test8 事故 — 卡片背景 agent 写 #FFF7E5,cache 里 fills=[] 也没父背景,纯幻觉
  - 多起 v0.3.x 事故 — 按钮 hover / disabled 状态色被 agent 编造

## Rule-Scan 识别提示

- 只对产物已 Read 后判定;主要靠"反向核对"
- 检出 `#RRGGBB` 后,反查对应 className → nodeId → cache fills
- 若 cache 里 fills=[] 但产物有色 → 强命中
- 若 cache 里 fills 全 IMAGE/GRADIENT 但产物有 SOLID 色 → 强命中
- **豁免**: 系统默认色如 `color: inherit` / `color: transparent` / `background: none`,不算 R10

## 相关

- rules/R06-text-solid-last.md (TEXT SOLID 精确取色)
- rules/R07-multi-fills.md (多层 fills 取色)
- rules/R09-btn-bgc-取值.md (btn 背景取色)
