# taro adapter 参考手册

> SKILL 在 §5.5.3c 步骤 Read 本文件。**声明式 propMap 已在 taro.json 处理的差异不在此重复**,本文只覆盖"prop 名机械改名之外"的复杂差异。
>
> 覆盖对象:@tarojs/components 组件(View / Text / Image / Input / ScrollView + Pressable→View 归并)与 RN 内核标签的语义差异。
>
> 数据来源:Taro 官方文档 https://taro-docs.jd.com/docs/components/viewContainer/view

## 使用约定

- 本手册**只影响 §5.5.3c 步骤**(propMap 声明式改名之后、import 重写之前),不改变主流程结构
- 每一节都是 agent 的 checklist:命中场景 → 按"改写规则"改;找不到对应关系 → 按"丢弃策略"处理并写入 §7 QA 段
- **绝不**在此手册里放"改名类"差异(否则与 taro.json 分工混乱) — 纯改名一律回 taro.json `propMap`

---

## 一、值域映射(prop 名一致或已改名,但取值域不同)

taro.json propMap 只能改 prop 名,不能改 prop 值。命中下表时,agent **在 §5.5.3c 时按 valueMap 改属性值**。

### 1.1 `Image.resizeMode` (RN) → `mode` (Taro)

**说明**:Taro Image 用 `mode` prop(与 xtaro 一致的 taro 语义),取值和 RN 的 resizeMode 不同,agent 必须同时改 prop 名和值。

| RN 值 | Taro 值 | 备注 |
|---|---|---|
| `'contain'` | `'aspectFit'` | 保持纵横比,长边完全显示 |
| `'cover'` | `'aspectFill'` | 保持纵横比,填满容器 |
| `'stretch'` | `'scaleToFill'` | 不保持比例,完全拉伸(Taro 默认值) |
| `'center'` | `'center'` | 不缩放,只显示中间区域 |
| `'repeat'` | *无对应* | Taro 无此值 → 退化 `'scaleToFill'` + 写入 §7 QA warn |

**注**:taro.json propMap 已把 `resizeMode` 视作字面改名(值域也需要同步改),此处补齐值改写规则。

### 1.2 `TextInput.keyboardType` (RN) → `type` (Taro Input)

**说明**:Taro Input 用 `type` 而不是 `keyboardType`,取值域也不同。

| RN keyboardType | Taro Input type | 备注 |
|---|---|---|
| `'default'` | `'text'` | 默认文本键盘 |
| `'numeric'` | `'number'` | 数字键盘 |
| `'email-address'` | `'text'` | Taro Input 无 email 类型,退化 text + QA warn |
| `'phone-pad'` | `'number'` | 退化 number |
| `'decimal-pad'` | `'digit'` | 带小数点数字 |
| `'number-pad'` | `'number'` | 同 numeric |
| `'ascii-capable'` / `'url'` / 其他 | `'text'` | 全部退化 text + QA warn |

### 1.3 `TextInput.returnKeyType` (RN) → `confirmType` (Taro Input)

**说明**:值域**基本一致**,但 RN 有 Taro 没有的 `'default'` / `'previous'` 等,退化处理。

| RN returnKeyType | Taro confirmType | 备注 |
|---|---|---|
| `'done'` | `'done'` | 一致 |
| `'search'` | `'search'` | 一致 |
| `'go'` | `'go'` | 一致 |
| `'next'` | `'next'` | 一致 |
| `'send'` | `'send'` | 一致 |
| `'default'` / `'previous'` / `'yahoo'` / `'google'` / `'route'` | `'done'` | 全部退化 + QA warn |

---

## 二、布尔/值取反

RN 与 Taro 语义相反的属性,agent 在 §5.5.3c 时同时改 prop 名和值。

### 2.1 `TextInput.editable` (RN, 默认 true) → `disabled` (Taro Input, 默认 false)

**改写规则**:
```tsx
// 改写前
<TextInput editable={false} />
<TextInput editable={true} />
<TextInput editable={someVar} />

// 改写后
<Input disabled={true} />
<Input disabled={false} />
<Input disabled={!someVar} />
```

**注**:变量引用场景要包一层 `!` 取反;字面 boolean 直接对换 true/false;省略 `editable` prop 无需处理(默认 editable=true → 默认 disabled=false,语义一致)。

---

## 三、事件签名转换

RN 事件 payload 与 Taro 不同,agent 生成时需**改回调函数体**,不只是改 prop 名。

### 3.1 `TextInput.onChangeText` (RN) → `onInput` (Taro Input)

**签名差异**:
- RN: `onChangeText: (text: string) => void`
- Taro: `onInput: (e: { detail: { value: string, cursor: number, keyCode: number } }) => void`

**改写规则**:
```tsx
// 改写前
<TextInput onChangeText={(text) => setValue(text)} />
<TextInput onChangeText={handleTextChange} />

// 改写后
<Input onInput={(e) => setValue(e.detail.value)} />
<Input onInput={(e) => handleTextChange(e.detail.value)} />
```

**注**:命中此项时 agent **必须查回调函数体**,把原来接收 `text` 的地方改成 `e.detail.value`;若原回调是命名函数(如 `handleTextChange`)则包一层箭头函数适配。

### 3.2 `Pressable.onPress` (RN) → `onClick` (Taro View)

**签名差异**:
- RN: `onPress: (event: GestureResponderEvent) => void`
- Taro: `onClick: (event: ITouchEvent) => void` — event 结构不同,但绝大多数业务代码不用 event → 直接改 prop 名即可

**改写规则**:
```tsx
// 改写前
<Pressable onPress={() => doSomething()} />
<Pressable onPress={handleTap} />

// 改写后(Pressable 已被 tagMap 映射到 View)
<View onClick={() => doSomething()} />
<View onClick={handleTap} />
```

**注**:若原回调**用了** `event.nativeEvent` / `event.locationX` 之类 RN 特有字段,则改写后需 QA warn 提示手工核对(极少见);仅 `() => doSomething()` 或不用 event 的 → 静默改。

### 3.3 `Pressable.onPressIn` / `onPressOut` (RN) → 无直接对应

**说明**:Taro View 没有 pressIn/pressOut,只有 touchStart / touchEnd。

**改写规则**:
```tsx
// 改写前
<Pressable onPressIn={onIn} onPressOut={onOut} />

// 改写后
<View onTouchStart={onIn} onTouchEnd={onOut} />
```

**注**:Taro 不做 tap 手势细分(不像 RN Pressable 有 delayPressIn),行为可能有微差,QA warn 记录。

### 3.4 `ScrollView.onEndReached` 阈值单位差异

**说明**:taro.json 已把 `onEndReached` 改名成 `onScrollToLower`,但**相关的 `onEndReachedThreshold` 单位也变了**。

- RN `onEndReachedThreshold`: `0-1 浮点数`(离底部剩余占屏幕比例)
- Taro `lowerThreshold`: `像素数`(离底部剩余像素)

**改写规则**:
```tsx
// 改写前
<ScrollView onEndReached={loadMore} onEndReachedThreshold={0.1} />

// 改写后
<ScrollView onScrollToLower={loadMore} lowerThreshold={50} />
// 注: 0.1 * 屏高(约 812) ≈ 81px,四舍五入取 50(Taro 默认值)
// 若原代码有具体屏高变量,可写 lowerThreshold={屏高变量 * 0.1};否则用 50 作 sensible default + QA warn
```

**注**:值需要业务侧手工核对,agent 直接给 sensible default(50)并写 §7 QA warn。

---

## 四、结构变化(一个 prop 拆多个 / 需要包一层)

改写涉及 JSX 结构,不是简单 prop 转换。agent 在 §5.5.3c 时按下述规则重塑 JSX。

### 4.1 `ScrollView.horizontal` (RN, boolean) → `scrollX + scrollY` (Taro, 双 boolean 二选一)

**说明**:Taro ScrollView 用两个独立 prop 表达方向,必须二选一,不允许同 true。

**改写规则**:
```tsx
// 改写前 A: horizontal=true → 横滚
<ScrollView horizontal={true} />
// 改写前 B: horizontal=false / 缺省 → 纵滚
<ScrollView horizontal={false} />
<ScrollView />

// 改写后 A
<ScrollView scrollX={true} />
// 改写后 B
<ScrollView scrollY={true} />
```

**注**:agent 必须**同时删除 horizontal prop** + **加对应方向的 scrollX/scrollY**。原来省略 horizontal 的场景需**主动补** `scrollY={true}`(RN 默认纵滚,Taro 必须显式声明)。

### 4.2 `ScrollView.contentContainerStyle` (RN) → 需包一层 View (Taro)

**说明**:Taro ScrollView 只有 `style`,没有 `contentContainerStyle`。RN 里 style 作用于外层滚动容器、contentContainerStyle 作用于内部内容区,Taro 需要**手工把内容区包一层 View**。

**改写规则**:
```tsx
// 改写前
<ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
  <Item />
  <Item />
</ScrollView>

// 改写后
<ScrollView style={styles.wrap} scrollY={true}>
  <View style={styles.content}>
    <Item />
    <Item />
  </View>
</ScrollView>
```

**注**:若原代码没写 contentContainerStyle,不需要包 View,静默改;若有 contentContainerStyle,agent 必须包一层 View 并把该 style 挂上去 + QA info 提示"新增了 View 内容容器"。

---

## 五、无跨端支持(直接丢弃 + QA warn)

以下属性 Taro rn 端不支持,agent 在 §5.5.3c 时**删除属性** + 写入 §7 QA warn 段(列出文件名 + 行号 + 属性名)。

| 原属性(RN) | 原标签 | 丢弃原因 |
|---|---|---|
| `numberOfLines` | `Text` | Taro Text 只在 alipay 端支持;rn/h5/小程序端多行省略需在业务代码用 CSS `-webkit-line-clamp` 或 Text 手工截断 |
| `ellipsizeMode` | `Text` | 无对应 |
| `selectable` | `Text` | ✅ 一致,不丢(此项仅列为对照,agent 保留原属性) |
| `showsHorizontalScrollIndicator` | `ScrollView` | 无内置;Taro 靠 CSS `::-webkit-scrollbar` 隐藏,业务侧手工写 |
| `showsVerticalScrollIndicator` | `ScrollView` | 同上 |
| `pagingEnabled` | `ScrollView` | Taro 只 weapp 支持;rn/h5 端无 |
| `onMomentumScrollEnd` | `ScrollView` | Taro 只 weapp 支持 |
| `multiline` | `TextInput` | 无;若确需多行,改用 `Textarea`(不同标签,超出本预设覆盖范围,QA error) |
| `keyboardAppearance` | `TextInput` | 无对应 |
| `blurOnSubmit` | `TextInput` | 无对应 |
| `caretHidden` | `TextInput` | 无对应 |

**注**:`selectable` 列在这里只作对照(实际保留);其他项 agent 静默删 + §7 QA 段 warn。

---

## 六、agent 快速参考(§5.5.3c 执行 checklist)

按此顺序遍历每个 index.tsx 的 JSX:

1. **值域映射**(§一):`resizeMode`(Image)/ `keyboardType`(TextInput)/ `returnKeyType`(TextInput) 命中 → 按 valueMap 改值 + 必要时改 prop 名
2. **布尔取反**(§二):`editable`(TextInput) 命中 → 改成 `disabled` + 值取反
3. **事件签名**(§三):`onChangeText` / `onPress` / `onPressIn` / `onPressOut` / `onEndReachedThreshold` 命中 → 改 prop 名 + 改回调函数体(§3.1 需读回调体)
4. **结构变化**(§四):`ScrollView.horizontal` 命中 → 删原 prop + 加 scrollX/scrollY;`contentContainerStyle` 命中 → 包 View
5. **丢弃属性**(§五):表内属性命中 → 删属性 + 写入 §7 QA warn 段

**未在本手册出现的属性**一律**保留原样**;`style / key / ref / children / className` 永远不改。
