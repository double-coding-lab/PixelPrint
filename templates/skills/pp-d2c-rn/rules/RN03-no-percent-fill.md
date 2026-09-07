# RN03 - no-percent-fill(RN 特有:%-塌陷防御)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 正向契约(独立 Image + absolute + 数值尺寸)归 R08,本条只拦塌陷写法;无 styleKey 交 R21

## 触发条件

- **cache**: `bg-` 前缀节点(含裸词 `bg`)

## 校验

该节点 style 禁止:

1. `width` / `height` 为百分比字符串(如 `'100%'`)
2. 引用 `StyleSheet.absoluteFillObject`(等价于全 % 铺满)

**原因**:父容器用 `minHeight` 时,`%` 值引用父的**计算高度**(可能小于 Figma 设计稿高度),背景层跟着塌陷。必须写 Figma 事实固定尺寸 + 精确定位。

## 反例(v0.3.12 真实事故形态)

```ts
// ❌ 塌陷写法 1
bgBody: { ...StyleSheet.absoluteFillObject },

// ❌ 塌陷写法 2
bgBody: { position: 'absolute', width: '100%', height: '100%' },
```

## 落地代码模板

```ts
bgBody: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: rpx(375),      // Figma 事实值
  height: rpx(1579),    // Figma 事实值
},
```

## 违反后果

- **产物表现**: 背景图高度随父计算高度缩水,页面下半段露底色

## 相关

- SKILL.md §4.1.1 bg- 铺满层用 Figma 事实尺寸
- rules/R08-bg-landing-form.md(正向契约)
- rules/RN01-scroll-skeleton.md(scrollContent minHeight 是塌陷诱因)
