# R24 baseline-align(硬防线,v1.1.1;与 h5 R24 同语义,匹配层为 StyleSheet)

## 触发条件(cache 侧)

图层名以 `bl-` 开头的容器(修饰前缀,无裸词形态)。设计师用它显式声明:**该容器的直接 Text 子元素按文本基线对齐**。

典型场景:一行内字号不同的文字(如「¥ **199** 起」),设计稿用绝对坐标逐个摆放,坐标直译后基线不齐、换字体/字号即错位。

## 期望产物

- 容器 style 声明 **`alignItems: 'baseline'`** + `flexDirection: 'row'`(RN 默认 column,基线对齐是横排语义);
- 直接 Text 子元素不再逐个 `position: 'absolute'`,顺序与间距由基线流负责;
- 配套豁免:该容器的直接子层在 **R20**(坐标对账)与 **RN02**(顺流子位置来源)豁免。

## 判定

| 产物形态 | 结果 |
|---|---|
| `alignItems: 'baseline'` 就位 | 通过 |
| `alignItems` 缺失 | violation |
| `alignItems: 'center'/'flex-start'/'flex-end'/'stretch'` | violation |
| 声明了 baseline 但未声明 `flexDirection: 'row'` | warning(Figma HORIZONTAL autolayout 场景由 R18 强制 row,此处不阻断) |
| baked / hidden / templateDup / 无 styleKey / 无规则体 | skip(无 styleKey 归 R21) |

## 反例

```ts
// ❌ 逐个绝对定位模拟基线
priceSymbol: { position: 'absolute', top: rpx(12) },
priceAmount: { position: 'absolute', top: 0 },

// ❌ center 冒充 baseline
blPrice: { flexDirection: 'row', alignItems: 'center' },

// ✅
blPrice: { flexDirection: 'row', alignItems: 'baseline' },
```
