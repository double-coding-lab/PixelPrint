# R13 - unit-scale(RN 文档改写,软防线:rpx 漏包语义)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌ (数值精度已由 R19/R20/R23 硬对账,本条管"包装方式")
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: `unit.responsive.enabled === false` → 不用 rpx,退回纯数字 DP,本条只判换算

## 触发条件

- **config**: `unit.responsive.enabled === true`(rn 模板默认)
- **命中信号**: 尺寸类白名单属性(SKILL §4.1.1 §C.1)出现**裸数字**而未包 `rpx()`,或 rpx 参数不是 Figma 原值 × unit.scale

## 期望产物

**口径**(rn 模板 config:`figmaBase=375, outputBase=375, scale=1, responsive.enabled=true`):

- rpx 参数 = Figma 原值 × `unit.scale`(模板 scale=1,即 Figma 原值直填)
- 白名单属性(宽高/坐标/间距/字号/圆角等尺寸类)一律 `rpx(n)` 包装,helper 按 config `unit.responsive.helperImport/helperName` 引入
- 非尺寸类(zIndex/flex/opacity/fontWeight)**不包** rpx

## 反例 (agent 常见错法)

```ts
// Figma width=335,config responsive.enabled=true
// ❌ 裸数字漏包(小屏/大屏不缩放)
card: { width: 335 },

// ❌ rpx 参数私自换算(rpx 内部已按屏宽线性缩放,重复换算双倍错)
card: { width: rpx(670) },

// ❌ zIndex 包 rpx(非尺寸属性)
fixedBar: { zIndex: rpx(100) },
```

## 落地代码模板

```ts
import { rpx } from '@/utils/rpx';   // config unit.responsive.helperImport

card: {
  width: rpx(335),      // Figma 原值 × scale(=1)
  borderRadius: rpx(8),
},
```

## 违反后果

- **产物表现**: 非 375 宽机型上尺寸不缩放,布局溢出/留白

## Rule-Scan 识别提示

- Read config 的 `unit` 段;`responsive.enabled=false` 时改判"数值 = Figma × scale"
- 扫 styles 白名单属性的裸数字,反查 cache bbox 判断是否漏包
- 数值精度错误不在本条重复列(归 R19/R20/R23)

## 相关

- SKILL.md §4.1.1 §C rpx 白名单
- rules/R19-padding.md / R20-absolute-position.md / R23-size-fidelity.md
