# R06 - text-solid-last

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**:
  - 末位可见 fill 是 GRADIENT/IMAGE → 归 R04
  - fills 全部 invisible → 用默认 `#000000`

## 触发条件

- **cache**: `node.type === 'TEXT' && Array.isArray(node.fills) && fills.length > 0`
- **fills 末位可见** (`fills.slice().reverse().find(f => f && f.visible !== false)`) 类型是 `SOLID`

## 期望产物

**SCSS 端**:
- 对应 CSS 类含 `color: #RRGGBB;`,值来自末位可见 SOLID
- HEX 大小写不敏感;alpha 通道另写 `opacity`

**取色算法**:
```js
const solid = pickLastVisibleFill(node.fills);
const { r, g, b } = solid.color;  // 0..1
const hex = '#' + [r,g,b].map(n => Math.round(n*255).toString(16).padStart(2,'0')).join('');
// 例: { r: 0, g: 0.4, b: 0.6 } → #006699
```

**反例扫描**:
- 取到 fills[0] 或中间层的色(不是末位可见)
- 编造的色(cache 里找不到 SOLID.color 对应值)

## 反例 (agent 常见错法)

```scss
/* 若 cache 里 fills = [{SOLID, #FFFFFF, visible:true}, {SOLID, #00679D, visible:true}]
   末位可见 = #00679D,应写:
   ✅ color: #00679D
   ❌ color: #FFFFFF (取到 fills[0]) */

/* 若 cache 里 fills = [{SOLID, #00679D, visible:false}, {SOLID, #FF0000, visible:true}]
   末位可见 = #FF0000,应写:
   ✅ color: #FF0000
   ❌ color: #00679D (取到 fills[0] 忽略 visible) */
```

## 落地代码模板

```jsx
<span className={styles.priceLabel} data-node-id="211:50">
  提前下预约单开售自动抢
</span>
```

```scss
.priceLabel {
  color: #00679D;  // 来自 cache node.fills 末位可见 SOLID
  font-size: 28px;
  line-height: 1.4;
}
```

## 违反后果

- **产物表现**: 文字颜色错误,与设计稿不符
- **典型事故**:
  - v0.3.20 test1 事故 — TEXT 节点 fills 有两层可见,agent 取到 fills[0] (#FFF),漏了末位 (#00679D)

## Rule-Scan 识别提示

- 优先看末位 (`fills.length - 1`)倒序遍历
- 跳过 `visible === false` 的层
- 若 fills 全部 invisible → 走默认 `#000000` (不常见,但要覆盖)

## 相关

- SKILL.md §4.1.1 TEXT 多层 fills 处理
- rules/R04-text-gradient.md (末位是 GRADIENT/IMAGE 的对应规则)
- rules/R10-no-fake-solid-color.md (核对色源,避免幻觉色)
