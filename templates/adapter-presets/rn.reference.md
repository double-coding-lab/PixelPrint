# pure RN / Expo adapter 参考手册

> **pure RN 预设不做标签替换**(tagMap 全部是 identity 映射,View→View / Text→Text / ...),所以**没有跨组件库差异**需要处理。本手册只列 RN 内核本身可能触发 QA warn 的边界情况。
>
> 如果你在用 native-base / react-native-paper / gluestack-ui 等 RN 生态组件库,请**另建预设**(参考 xtaro.json / taro.json 的结构),而不是继续用本预设。

## 使用约定

- 本手册**只影响 §5.5.3c 步骤**,但对 pure RN 来说 §5.5.3c 几乎是 no-op(propMap 空、无跨组件库映射)
- 主要作用:让 agent 在生成 pure RN 产物时**保持 SKILL 内核默认行为**,不做任何后处理
- 如果发现 pure RN 项目里出现了跨组件库差异,说明选错了预设

---

## 一、值域映射

**无**。pure RN 保留原生标签,无值域映射需求。

---

## 二、布尔/值取反

**无**。RN 内核就是 RN 内核,不需要转成别人。

---

## 三、事件签名转换

**无**。RN 内核就是 RN 内核,不需要事件签名转换。

- `TextInput.onChangeText(text: string) => void` 直接保留
- `Pressable.onPress(event: GestureResponderEvent) => void` 直接保留
- `ScrollView.onEndReached / onEndReachedThreshold` 直接保留

---

## 四、结构变化

**无**。RN 内核标签的 prop 结构本来就是 SKILL 内核描述的目标形态,不需要重塑。

- `ScrollView.horizontal={true}` 直接保留(RN 就是这个 API)
- `ScrollView.contentContainerStyle` 直接保留

---

## 五、无跨端支持

**无**。pure RN 生态本身就是 iOS / Android(+ Expo 场景)双端,SKILL 生成产物默认走 RN 官方 API,没有"不支持"这一说。

不过有几个**平台差异**需要提醒(不影响 agent 生成,只在 §7 QA 段做 info 提示):

| API | 差异 | agent 处理 |
|---|---|---|
| `TextInput.keyboardType='visible-password'` | 仅 Android | 静默保留 + QA info(iOS 上等效退化为 default) |
| `TextInput.textContentType` | 仅 iOS | 静默保留 + QA info(Android 无影响) |
| `Pressable.onLongPress delayLongPress` | RN 0.63+ | 静默保留(默认 500ms) |

---

## 六、agent 快速参考(§5.5.3c 执行 checklist)

**pure RN 预设下,§5.5.3c 直接跳过**(referenceDoc 存在但内容全部 no-op)。

agent 仍需要走一遍 §5.5.3c 流程验证 preset 完整性,但**不会命中任何改写规则**。§7 QA 段照常输出"参考手册命中:0 条(pure RN 预设)"。

---

## 为什么这个预设仍然需要?

pure RN 预设的意义**不在于映射规则**,而在于:

1. **让用户显式选择**:CLI init 时"选择预设 adapter"选项列表里有一个明确的"我不做替换"选项,而不是让用户困惑于"不选预设 = 什么行为?"
2. **保留 helper 一致性**:预设自带 `rn.rpx.ts` 使用 pure RN 的 `Dimensions.get('window')`,与 xtaro / taro 预设的 helper 走同一套接口(都从 `@/utils/rpx` 导出 `rpx()`),SKILL 生成产物无需关心底层实现
3. **未来扩展的对照基线**:如果社区加 native-base / paper 等预设,可以对照 pure RN 预设看"哪些差异需要处理"
