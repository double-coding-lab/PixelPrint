# xtaro adapter 参考手册

> SKILL 在 §5.5.3c 步骤 Read 本文件。**声明式 propMap 已在 xtaro.json 处理的差异不在此重复**,本文只覆盖"prop 名机械改名之外"的复杂差异。
>
> 覆盖对象:@myxx/xtaro 6 大组件(XView / XText / XImage / XInput / XScrollView + Pressable→XView 归并)与 RN 内核标签的语义差异。
>
> 数据来源:`node_modules/@myxx/xtaro-types/types/component/*.d.ts` 官方类型定义。

## 使用约定

- 本手册**只影响 §5.5.3c 步骤**(propMap 声明式改名之后、import 重写之前),不改变主流程结构
- 每一节都是 agent 的 checklist:命中场景 → 按"改写规则"改;找不到对应关系 → 按"丢弃策略"处理并写入 §7 QA 段
- **绝不**在此手册里放"改名类"差异(否则与 xtaro.json 分工混乱) — 纯改名一律回 xtaro.json `propMap`

---

## 一、值域映射(prop 名已在 xtaro.json 改名,取值域不同)

xtaro.json propMap 只能改 prop 名,不能改 prop 值。命中下表时,agent **在 §5.5.3c 时按 valueMap 改属性值**。

### 1.1 `Image.resizeMode` (RN) → `mode` (xtaro)

**说明**:xtaro.json propMap 已把 `resizeMode` 改名成 `mode`,agent 在 §5.5.3c 时**只需改属性值**(prop 名已由 §5.5.3b 处理)。

xtaro `XImage.mode` 完整取值来自 `@myxx/xtaro-types/types/component/XImage.d.ts` 的 `XImageProps.Mode`,共 15 个值(4 类缩放 + 9 类裁剪);其中类型注释明确 **`@rn 部分支持 scaleToFill, aspectFit, aspectFill, widthFix`**,其余值 rn 端会退化。

| RN `resizeMode` 值 | xtaro `mode` 值 | rn 端行为 |
|---|---|---|
| `'contain'` | `'aspectFit'` | ✅ rn 支持,保持纵横比,长边完全显示 |
| `'cover'` | `'aspectFill'` | ✅ rn 支持,保持纵横比,填满容器 |
| `'stretch'` | `'scaleToFill'` | ✅ rn 支持,不保持比例,完全拉伸(xtaro 默认值) |
| `'center'` | `'scaleToFill'` | ⚠️ rn 端不支持 `center`,退化 `scaleToFill` + QA warn |
| `'repeat'` | `'scaleToFill'` | ⚠️ rn 端不支持,退化 `scaleToFill` + QA warn |

**改写示例**:
```tsx
// §5.5.3b propMap 处理后(prop 名已改)
<XImage src={require('./bg.png')} style={styles.bg} resizeMode="cover" />

// §5.5.3c valueMap 处理后(prop 值同步改)
<XImage src={require('./bg.png')} style={styles.bg} mode="aspectFill" />
```

**注**:遗留场景兜底 — 若某天回滚了 propMap,agent 需**同时**改 prop 名和值(等价于本节 + §5.5.3b 的 `resizeMode → mode`)。

### 1.2 `TextInput.keyboardType` (RN) → `type` (xtaro)

**说明**:xtaro.json propMap 已把 `keyboardType` 改名成 `type`,agent **只改属性值**。xtaro rn 端支持的 type 是子集,超出的一律退化 + QA warn。

xtaro `XInput.type` 完整取值(来自 `XInput.d.ts` `XInputProps.Type`):`text` / `number` / `idcard` / `digit` / `safe-password` / `nickname` / `numberpad` / `digitpad` / `idcardpad` / `email`;其中 `@supported rn` 标注的有 `text` / `number` / `idcard` / `digit` / `email`。

| RN keyboardType | xtaro type | 备注 |
|---|---|---|
| `'default'` | `'text'` | 默认文本键盘 |
| `'numeric'` | `'number'` | 数字键盘 |
| `'email-address'` | `'email'` | rn 端 xtaro 有 email |
| `'phone-pad'` | `'number'` | xtaro 无 phone-pad → 退化 number + QA warn |
| `'decimal-pad'` | `'digit'` | 带小数点数字 |
| `'number-pad'` | `'number'` | 同 numeric |
| `'ascii-capable'` / `'url'` / `'name-phone-pad'` / `'twitter'` / `'web-search'` / 其他 | `'text'` | 全部退化 text + QA warn |

### 1.3 `TextInput.returnKeyType` (RN) → `confirmType` (xtaro)

**说明**:xtaro.json propMap 已把 `returnKeyType` 改名成 `confirmType`,agent **只改属性值**。值域**基本一致**,但 RN 有 xtaro 没有的 `'default'` / `'previous'` 等,退化处理。

xtaro `XInput.confirmType` 完整取值(来自 `XInput.d.ts` `XInputProps.ConfirmType`):`send` / `search` / `next` / `go` / `done`。

| RN returnKeyType | xtaro confirmType | 备注 |
|---|---|---|
| `'done'` | `'done'` | 一致 |
| `'search'` | `'search'` | 一致 |
| `'go'` | `'go'` | 一致 |
| `'next'` | `'next'` | 一致 |
| `'send'` | `'send'` | 一致 |
| `'default'` / `'previous'` / `'yahoo'` / `'google'` / `'route'` / `'join'` / `'emergency-call'` | `'done'` | 全部退化 + QA warn |

**注**:值域大部分重合,建议 agent 命中不在上表的值时才写 §7 QA warn;重合值静默改。

---

## 二、布尔/值取反

RN 与 xtaro 语义相反的属性,agent 在 §5.5.3c 时同时改 prop 名和值。

### 2.1 `TextInput.editable` (RN, 默认 true) → `disabled` (xtaro, 默认 false)

**改写规则**:
```tsx
// 改写前
<XInput editable={false} />
<XInput editable={true} />
<XInput editable={someVar} />

// 改写后
<XInput disabled={true} />
<XInput disabled={false} />
<XInput disabled={!someVar} />
```

**注**:变量引用场景要包一层 `!` 取反;字面 boolean 直接对换 true/false;省略 `editable` prop 无需处理(默认 editable=true → 默认 disabled=false,语义一致)。

---

## 三、事件签名转换

RN 事件 payload 与 xtaro 不同,agent 生成时需**改回调函数体**,不只是改 prop 名。

### 3.1 `TextInput.onChangeText` (RN) → `onInput` (xtaro)

**签名差异**:
- RN: `onChangeText: (text: string) => void`
- xtaro: `onInput: (e: { detail: { value: string, cursor: number, keyCode: number } }) => void`

**改写规则**:
```tsx
// 改写前
<TextInput onChangeText={(text) => setValue(text)} />
<TextInput onChangeText={handleTextChange} />

// 改写后
<XInput onInput={(e) => setValue(e.detail.value)} />
<XInput onInput={(e) => handleTextChange(e.detail.value)} />
```

**注**:命中此项时 agent **必须查回调函数体**,把原来接收 `text` 的地方改成 `e.detail.value`;若原回调是命名函数(如 `handleTextChange`)则包一层箭头函数适配。

### 3.2 `Pressable.onPress` (RN) → `onClick` (xtaro XView)

**签名差异**:
- RN: `onPress: (event: GestureResponderEvent) => void`
- xtaro: `onClick: (event: ITouchEvent) => void` — event 结构不同,但绝大多数业务代码只用不用不管 event → 直接改 prop 名即可

**改写规则**:
```tsx
// 改写前
<Pressable onPress={() => doSomething()} />
<Pressable onPress={handleTap} />

// 改写后(Pressable 已被 tagMap 映射到 XView)
<XView onClick={() => doSomething()} />
<XView onClick={handleTap} />
```

**注**:若原回调**用了** `event.nativeEvent` / `event.locationX` 之类 RN 特有字段,则改写后需 QA warn 提示手工核对(极少见);仅 `() => doSomething()` 或不用 event 的 → 静默改。

### 3.3 `Pressable.onPressIn` / `onPressOut` (RN) → 无直接对应

**说明**:xtaro `XView` 没有 pressIn/pressOut,只有 touchStart / touchEnd。

**改写规则**:
```tsx
// 改写前
<Pressable onPressIn={onIn} onPressOut={onOut} />

// 改写后
<XView onTouchStart={onIn} onTouchEnd={onOut} />
```

**注**:xtaro 也不做 tap 手势细分(不像 RN Pressable 有 delayPressIn),行为可能有微差,QA warn 记录。

### 3.4 `ScrollView.onEndReached` 阈值单位差异

**说明**:xtaro.json 已把 `onEndReached` 改名成 `onScrollToLower`,但**相关的 `onEndReachedThreshold` 单位也变了**。

- RN `onEndReachedThreshold`: `0-1 浮点数`(离底部剩余占屏幕比例)
- xtaro `lowerThreshold`: `像素数`(离底部剩余像素)

**改写规则**:
```tsx
// 改写前
<ScrollView onEndReached={loadMore} onEndReachedThreshold={0.1} />

// 改写后
<XScrollView onScrollToLower={loadMore} lowerThreshold={50} />
// 注: 0.1 * 屏高(约 812) ≈ 81px,四舍五入取 50(xtaro 默认值)
// 若原代码有具体屏高变量,可写 lowerThreshold={屏高变量 * 0.1};否则用 50 作 sensible default + QA warn
```

**注**:值需要业务侧手工核对,agent 直接给 sensible default(50)并写 §7 QA warn。

---

## 四、结构变化(一个 prop 拆多个 / 需要包一层)

改写涉及 JSX 结构,不是简单 prop 转换。agent 在 §5.5.3c 时按下述规则重塑 JSX。

### 4.1 `ScrollView.horizontal` (RN, boolean) → `scrollX + scrollY` (xtaro, 双 boolean 二选一)

**说明**:xtaro `XScrollView` 用两个独立 prop 表达方向,必须二选一,不允许同 true。

**改写规则**:
```tsx
// 改写前 A: horizontal=true → 横滚
<ScrollView horizontal={true} />
// 改写前 B: horizontal=false / 缺省 → 纵滚
<ScrollView horizontal={false} />
<ScrollView />

// 改写后 A
<XScrollView scrollX={true} />
// 改写后 B
<XScrollView scrollY={true} />
```

**注**:agent 必须**同时删除 horizontal prop** + **加对应方向的 scrollX/scrollY**。原来省略 horizontal 的场景需**主动补** `scrollY={true}`(RN 默认纵滚,xtaro 必须显式声明)。

### 4.2 `ScrollView.contentContainerStyle` (RN) → 需包一层 XView (xtaro)

**说明**:xtaro `XScrollView` 只有 `style`,没有 `contentContainerStyle`。RN 里 style 作用于外层滚动容器、contentContainerStyle 作用于内部内容区,xtaro 需要**手工把内容区包一层 XView**。

**改写规则**:
```tsx
// 改写前
<ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
  <Item />
  <Item />
</ScrollView>

// 改写后
<XScrollView style={styles.wrap} scrollY={true}>
  <XView style={styles.content}>
    <Item />
    <Item />
  </XView>
</XScrollView>
```

**注**:若原代码没写 contentContainerStyle,不需要包 XView,静默改;若有 contentContainerStyle,agent 必须包一层 XView 并把该 style 挂上去 + QA info 提示"新增了 XView 内容容器"。

---

## 五、无跨端支持(直接丢弃 + QA warn)

以下属性 xtaro rn 端不支持,agent 在 §5.5.3c 时**删除属性** + 写入 §7 QA warn 段(列出文件名 + 行号 + 属性名)。清单依据 `@myxx/xtaro-types/types/component/*.d.ts` 每个 prop 的 `@supported` 注释,凡是**明确不含 `rn`** 的属性都在此表。

### 5.1 `Text` (RN) → `XText`

| RN 属性 | xtaro XText 是否支持 rn | 处理策略 |
|---|---|---|
| `numberOfLines` | ❌ 只支持 `alipay` | 静默删 + QA warn(rn 端多行省略需 CSS `-webkit-line-clamp` 或代码截断) |
| `ellipsizeMode` | ❌ 无 | 静默删 + QA warn |
| `adjustsFontSizeToFit` | ❌ 无 | 静默删 + QA warn |
| `minimumFontScale` | ❌ 无 | 静默删 + QA warn |
| `allowFontScaling` | ❌ 无 | 静默删 + QA warn |
| `maxFontSizeMultiplier` | ❌ 无 | 静默删 + QA warn |
| `selectable` | ✅ 保留 | 静默改(**不删**,列此仅作对照) |
| `onPress`(Text 上的) | ❌ RN Text 有 onPress;XText 无对应事件 | 静默删 + QA error(需要点击的文字通常应外包 XView 处理 onClick,超出 preset 覆盖) |
| `onLongPress`(Text 上的) | ❌ 同上 | 静默删 + QA warn |

### 5.2 `View` / `Pressable` (RN) → `XView`

| RN 属性 | xtaro XView 是否支持 rn | 处理策略 |
|---|---|---|
| `pointerEvents` | ❌ 无对应 prop(RN 直接支持 `pointerEvents`,xtaro 需在 style 里写 `pointerEvents: 'none'`) | 静默改进 style 内(注:该 style 属性 RN 端可用);无法搬迁则删 + QA warn |
| `needsOffscreenAlphaCompositing` | ❌ 无 | 静默删 + QA warn |
| `renderToHardwareTextureAndroid` | ❌ 无 | 静默删 + QA warn |
| `shouldRasterizeIOS` | ❌ 无 | 静默删 + QA warn |
| `collapsable` | ❌ 无 | 静默删 + QA warn |
| `Pressable.android_ripple` | ❌ 无 | 静默删 + QA warn |
| `Pressable.hitSlop` | ❌ 无(XView 用 style/CSS 实现类似效果) | 静默删 + QA warn |
| `Pressable.delayLongPress` | ❌ 无 | 静默删 + QA warn |
| `Pressable.disabled` | ❌ XView 无 disabled prop | 静默删 + QA warn(如需禁用点击,业务侧在 onClick 里判 return) |

**注**:XView 的 `onTouchStart/onTouchMove/onTouchEnd/onTouchCancel/onLongPress` 与 RN 语义基本一致,静默保留即可(见 `XView.d.ts` `EventProps`)。

### 5.3 `Image` (RN) → `XImage`

| RN 属性 | xtaro XImage 是否支持 rn | 处理策略 |
|---|---|---|
| `defaultSource` | ❌ 只支持 `alipay` | 静默删 + QA warn(可考虑外层套 XView 做占位背景) |
| `blurRadius` | ❌ 无对应 prop | 静默删 + QA warn |
| `fadeDuration` | ❌ 无 | 静默删 + QA warn |
| `progressiveRenderingEnabled` | ❌ 无 | 静默删 + QA warn |
| `capInsets` | ❌ 无 | 静默删 + QA warn |
| `loadingIndicatorSource` | ❌ 无 | 静默删 + QA warn |
| `onProgress` | ❌ 无 | 静默删 + QA warn |
| `onPartialLoad` | ❌ 无 | 静默删 + QA warn |
| `onLoadStart` / `onLoadEnd` | ❌ 无(XImage 只有 `onLoad` / `onError`) | 静默删 + QA warn |
| `resizeMethod` | ❌ 无 | 静默删 + QA warn |

### 5.4 `ScrollView` (RN) → `XScrollView`

| RN 属性 | xtaro XScrollView 是否支持 rn | 处理策略 |
|---|---|---|
| `showsHorizontalScrollIndicator` | ❌ 无(靠 CSS `::-webkit-scrollbar` 隐藏) | 静默删 + QA warn |
| `showsVerticalScrollIndicator` | ❌ 同上 | 静默删 + QA warn |
| `pagingEnabled` | ❌ 只 `weapp/swan` 支持 | 静默删 + QA warn |
| `onMomentumScrollBegin` | ❌ 只 `weapp` 支持 | 静默删 + QA warn |
| `onMomentumScrollEnd` | ❌ 只 `weapp` 支持 | 静默删 + QA warn |
| `onScrollBeginDrag` | ❌ 无(XScrollView `onDragStart` 只 `weapp` 支持) | 静默删 + QA warn |
| `onScrollEndDrag` | ❌ 同上 | 静默删 + QA warn |
| `refreshControl`(RefreshControl 组件) | ❌ 无对应 prop(XScrollView 的 refresher* 系列只 `weapp` 支持) | 静默删 + QA error(下拉刷新需业务侧改造,超出 preset 覆盖) |
| `stickyHeaderIndices` | ❌ 无 | 静默删 + QA warn |
| `keyboardShouldPersistTaps` | ❌ 无 | 静默删 + QA warn |
| `keyboardDismissMode` | ❌ 无 | 静默删 + QA warn |
| `bounces` | ❌ 只 `weapp/swan` 支持 | 静默删 + QA warn |
| `decelerationRate` | ❌ 无(xtaro `fastDeceleration` 只 `weapp`) | 静默删 + QA warn |
| `snapToInterval` / `snapToAlignment` / `snapToOffsets` / `snapToStart` / `snapToEnd` | ❌ 无 | 静默删 + QA warn |
| `overScrollMode` | ❌ 无 | 静默删 + QA warn |
| `nestedScrollEnabled` | ❌ 无 | 静默删 + QA warn |
| `contentInset` / `contentInsetAdjustmentBehavior` / `contentOffset` | ❌ 无对应 prop(XScrollView 用 `scrollTop/scrollLeft` 表达位置,`padding` 只 `weapp`) | 静默删 + QA warn(初始滚动位置可用 `scrollTop`/`scrollLeft` 替代,业务侧手工核对) |
| `automaticallyAdjustContentInsets` | ❌ 无 | 静默删 + QA warn |
| `alwaysBounceHorizontal` / `alwaysBounceVertical` | ❌ 无 | 静默删 + QA warn |
| `directionalLockEnabled` | ❌ 无 | 静默删 + QA warn |
| `maintainVisibleContentPosition` | ❌ 无 | 静默删 + QA warn |
| `scrollEnabled` | ❌ 无对应 prop(禁用滚动可写 `scrollX={false} scrollY={false}` 但语义不同) | 静默删 + QA warn |
| `scrollEventThrottle` | ✅ 保留(XScrollView 支持 `scrollEventThrottle`) | 静默改(**不删**,列此仅作对照) |
| `onEndReachedThreshold` | ⚠️ 单位不同 | 见 §3.4,不在本表 |

### 5.5 `TextInput` (RN) → `XInput`

| RN 属性 | xtaro XInput 是否支持 rn | 处理策略 |
|---|---|---|
| `multiline` | ❌ 无;若确需多行须改用 `XTextarea`(不同标签) | 静默删 + QA error(超出 preset 覆盖范围) |
| `numberOfLines` | ❌ 无 | 静默删 + QA warn |
| `keyboardAppearance` | ❌ 无 | 静默删 + QA warn |
| `blurOnSubmit` | ❌ 无 | 静默删 + QA warn |
| `caretHidden` | ❌ 无 | 静默删 + QA warn |
| `contextMenuHidden` | ❌ 无 | 静默删 + QA warn |
| `selectionColor` | ❌ 无(xtaro 用 `placeholderTextColor` 只控 placeholder 颜色) | 静默删 + QA warn |
| `underlineColorAndroid` | ❌ 无 | 静默删 + QA warn |
| `textContentType` | ❌ 无 | 静默删 + QA warn |
| `autoCorrect` | ❌ 无 | 静默删 + QA warn |
| `autoCapitalize` | ❌ 无 | 静默删 + QA warn |
| `autoComplete` | ❌ 无 | 静默删 + QA warn |
| `spellCheck` | ❌ 无 | 静默删 + QA warn |
| `clearButtonMode` / `clearTextOnFocus` | ❌ 无 | 静默删 + QA warn |
| `enablesReturnKeyAutomatically` | ❌ 无 | 静默删 + QA warn |
| `passwordRules` | ❌ 无 | 静默删 + QA warn |
| `rejectResponderTermination` | ❌ 无 | 静默删 + QA warn |
| `scrollEnabled`(TextInput 上的) | ❌ 无 | 静默删 + QA warn |
| `selectTextOnFocus` | ❌ 无 | 静默删 + QA warn |
| `showSoftInputOnFocus` | ❌ 无 | 静默删 + QA warn |
| `onKeyPress` | ❌ 无(XInput 只有 `onInput/onFocus/onBlur/onConfirm`) | 静默删 + QA warn |
| `onSelectionChange` | ❌ 无 | 静默删 + QA warn |
| `onContentSizeChange` | ❌ 无 | 静默删 + QA warn |
| `onEndEditing` | ❌ 无 | 静默删 + QA warn |
| `onScroll`(TextInput 上的) | ❌ 无 | 静默删 + QA warn |

**注**:表中标 ✅ 的行(`Text.selectable` / `ScrollView.scrollEventThrottle`)只作对照,agent **保留原属性**。其他项静默删 + §7 QA 段 warn。

---

## 六、agent 快速参考(§5.5.3c 执行 checklist)

按此顺序遍历每个 index.tsx 的 JSX:

1. **值域映射**(§一):`Image.mode`(propMap 已改名,值需按 §1.1 映射)/ `TextInput.type`(propMap 已改名,值按 §1.2)/ `TextInput.confirmType`(propMap 已改名,值按 §1.3) 命中 → 只改属性值
2. **布尔取反**(§二):`editable`(TextInput) 命中 → 改成 `disabled` + 值取反
3. **事件签名**(§三):`onChangeText` / `onPress` / `onPressIn` / `onPressOut` / `onEndReachedThreshold` 命中 → 改 prop 名 + 改回调函数体(§3.1 需读回调体)
4. **结构变化**(§四):`ScrollView.horizontal` 命中 → 删原 prop + 加 scrollX/scrollY;`contentContainerStyle` 命中 → 包 XView
5. **丢弃属性**(§五):表内属性命中 → 删属性 + 写入 §7 QA warn 段(逐组件 5.1~5.5,共 60+ 项)

**未在本手册出现的属性**一律**保留原样**;`style / key / ref / children / className` 永远不改。
