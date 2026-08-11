# R09 - btn-bgc-取值

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - `bgc-` 层的 fills 只有单层 SOLID → 直接按 CSS `background-color` 取,不算 R09
  - `bgc-` 层的 fills 是 IMAGE → 归 R02
  - btn 前缀节点无 `bgc-` 子层 → 不适用

## 触发条件

- **cache**: 存在 `node.name.startsWith(config.layers.but || 'btn-')` 节点
- **且**: 该节点 children 里有 `child.name.startsWith(config.layers.bgColor || 'bgc-')`
- **且**: `bgc-` 层的 `fills` 是 `GRADIENT_*`(或多层含 GRADIENT)

## 期望产物

**核心原则**: `btn-` 的**父容器** CSS `background` 应取自 `bgc-` 子层的**真实 fills**,不是编造。

**JSX 端**:
- 按分层结构 `<div className={styles.btn}>` 承担 bgc 背景,内部再放文字/图标

**SCSS 端**:
- `.btn { background: linear-gradient(...); }`(gradient 参数按 bgc-*.fills)

**反例扫描**:
- agent 编造渐变色(cache 里 bgc- 明明是 A→B,产物写成 C→D)
- agent 编造 solid color 代替 gradient

## 反例 (agent 常见错法)

```scss
/* Figma:
   btn-primary
     └─ bgc-primary  fills = [ GRADIENT: #864500 → #6D3600 ]
     └─ text "购买"

   agent 常错法: */

/* ❌ 错法 1: 凭空搓 solid color */
.btnPrimary { background-color: #864500; }

/* ❌ 错法 2: 颜色对了但类型错(SOLID 代 GRADIENT) */
.btnPrimary { background: #864500; }

/* ❌ 错法 3: 编造与 bgc 无关的渐变 */
.btnPrimary { background: linear-gradient(180deg, #FF0 0%, #F00 100%); }
```

## 落地代码模板

```jsx
<button className={styles.btnPrimary} data-node-id="211:446">
  <span>购买</span>
</button>
```

```scss
.btnPrimary {
  background: linear-gradient(180deg, #864500 0%, #6D3600 100%);  // 取自 bgc-primary.fills
  border: none;
  border-radius: 44px;
  padding: 22px 60px;
  color: #FFFFFF;
  font-size: 32px;
}
```

## 违反后果

- **产物表现**: 按钮颜色错、无渐变
- **典型事故**:
  - v0.3.20 test1 事故 — `btn-购买` 内 `bgc-` 渐变 #864500→#6D3600,agent 只写 SOLID #864500
  - v0.3.19 test8 事故 — `quanItem__btn` 内 `bgc-` 光效渐变,agent 编造成完全不同的黄色

## Rule-Scan 识别提示

- 先按 `btn-` 前缀找到按钮节点
- 递归 children 找 `bgc-` 前缀节点(通常是第 1 或第 2 层)
- 读该 bgc 节点的 `fills` (**不是** btn 节点自身的 fills)
- 输出 context 里必须含:
  ```json
  {
    "btn_nodeId": "211:446",
    "bgc_nodeId": "211:447",
    "bgc_fills": [ { "type": "GRADIENT_LINEAR", "gradientStops": [...], "gradientHandlePositions": [...] } ]
  }
  ```

## 相关

- SKILL.md §4.3 CSS 翻译表 (fills GRADIENT)
- rules/R07-multi-fills.md
- rules/R10-no-fake-solid-color.md
