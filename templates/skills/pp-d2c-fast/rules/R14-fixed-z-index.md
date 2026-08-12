# R14 - fixed-z-index

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: 页面只有 1 个 `fixed-` 节点 → 无冲突,不判 z-index

## 触发条件

- **cache**: 存在**多个** `node.name.startsWith('fixed-')` 节点(通常是状态栏 + 底部 bar + 悬浮按钮)
- **命中信号**: 多层 fixed 节点在 Figma 里有明确 z 顺序(通常按图层顺序),产物 z-index 缺失或未递增

## 期望产物

**核心原则**: 多个 fixed 元素必须有递增 z-index,视觉层级依 Figma 图层顺序。

**SCSS 端**:
```scss
.fixedStatusBar   { position: fixed; top: 0; z-index: 100; }
.fixedTopbar      { position: fixed; top: 118px; z-index: 90; }
.fixedFloatingBtn { position: fixed; bottom: 40px; right: 40px; z-index: 200; }
```

**约定**:
- 底部 bar / 悬浮按钮 → z-index ≥ 100
- 顶部固定 bar → z-index 递减(status > topbar > sub-nav)
- **不要**都用 z-index: 1 或都不写

## 反例 (agent 常见错法)

```scss
/* Figma 有 3 个 fixed 节点:
   - fixed-状态栏
   - fixed-顶部bar
   - fixed-悬浮按钮
   期望层级: 状态栏 > 悬浮按钮 > 顶部bar

   agent 错法 1: 全部不写 z-index */
.fixedStatusBar   { position: fixed; top: 0; }
.fixedTopbar      { position: fixed; top: 118px; }
.fixedFloatingBtn { position: fixed; bottom: 40px; }
/* → z-index 默认为 auto,层级不确定,可能互相覆盖 */

/* agent 错法 2: 全部 z-index 相同 */
.fixedStatusBar   { z-index: 1; }
.fixedTopbar      { z-index: 1; }
.fixedFloatingBtn { z-index: 1; }
```

## 落地代码模板

```scss
.fixedStatusBar {
  position: fixed;
  top: 0;
  z-index: 100;
}
.fixedTopbar {
  position: fixed;
  top: 118px;
  z-index: 90;
}
.fixedFloatingBtn {
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 200;
}
```

## 违反后果

- **产物表现**: fixed 元素互相覆盖、位置错乱
- **典型事故**:
  - v0.3.19 test8 事故 — 底部 fixed 悬浮按钮被上滑的内容盖住(z-index 未设)

## Rule-Scan 识别提示

- 遍历 cache 收集 `fixed-` 前缀节点
- ≥2 → 判定 R14
- Figma 图层顺序(`children` 数组索引)对应视觉 z:索引大的在上
- 输出 context 里列出各 fixed 节点及推荐 z-index 值

## 相关

- rules/R01-fixed-position.md
- SKILL.md §4.3 硬规则第 1 条 (fixed-)
