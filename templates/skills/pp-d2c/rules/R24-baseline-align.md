# R24 baseline-align(硬防线,v1.2.6)

## 触发条件(cache 侧)

图层名以 `bl-` 开头的容器(修饰前缀,无裸词形态)。设计师用它显式声明:**该容器的直接 TEXT 子元素按文本基线对齐**。

典型场景:一行内字号不同的文字(如「¥ **199** 起」——货币符号 24px、金额 40px、单位 20px),设计稿里常用绝对坐标逐个摆放,视觉上是基线对齐,但坐标翻译成 CSS 后各自 `top` 对不齐真实基线,且换字体/字号即错位。

## 期望产物

- 容器规则体声明 `display: flex`(或 `inline-flex`)+ **`align-items: baseline`**;
- 直接 TEXT 子元素不再逐个 `position: absolute`,水平顺序与间距由基线流(DOM 顺序 + gap/margin)负责;
- 配套豁免:该容器的直接子层在 **R20**(绝对定位坐标对账)豁免——放弃绝对定位是本前缀的设计师显式意图。

## 判定

| 产物形态 | 结果 |
|---|---|
| `align-items: baseline` 就位 | 通过 |
| `align-items` 缺失 | violation |
| `align-items: center/flex-start/flex-end/stretch` | violation(用其他对齐冒充基线) |
| 声明了 baseline 但规则体未见 `display: flex` | warning(baseline 需 flex 容器才生效,可能由上层 flex 上下文承接,不阻断) |
| baked / hidden / templateDup / 无 className / 无规则体 | skip(宁漏报不误判;无 className 归 R21) |

## 反例

```scss
// ❌ 逐个绝对定位模拟基线(换字号即错位,R20 在 bl- 外仍会对账坐标)
.bl-price { position: relative; }
.bl-price__symbol { position: absolute; top: 12px; }
.bl-price__amount { position: absolute; top: 0; }

// ❌ 用 center 冒充 baseline(大小字号的视觉底线不齐)
.bl-price { display: flex; align-items: center; }

// ✅
.bl-price { display: flex; align-items: baseline; }
```
