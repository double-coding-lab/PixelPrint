# xtaro adapter 参考手册

> SKILL 在 §5.5.3c 步骤 Read 本文件。**声明式 propMap 已在 xtaro.json 处理的差异不在此重复**,本文只覆盖"prop 名机械改名之外"的复杂差异。
>
> 覆盖对象:@ctrip/xtaro 6 大组件(XView / XText / XImage / XInput / XScrollView + Pressable→XView 归并)与 RN 内核标签的语义差异。
>
> 数据来源:`node_modules/@ctrip/xtaro-types/types/component/*.d.ts` 官方类型定义。

## 使用约定

- 本手册**只影响 §5.5.3c 步骤**(propMap 声明式改名之后、import 重写之前),不改变主流程结构
- 每一节都是 agent 的 checklist:命中场景 → 按"改写规则"改;找不到对应关系 → 按"丢弃策略"处理并写入 §7 QA 段
- **绝不**在此手册里放"改名类"差异(否则与 xtaro.json 分工混乱) — 纯改名一律回 xtaro.json `propMap`

---

## 一、值域映射(prop 名一致或已改名,但取值域不同)

xtaro.json propMap 只能改 prop 名,不能改 prop 值。命中下表时,agent **在 §5.5.3c 时按 valueMap 改属性值**。

### 1.1 `Image.resizeMode` (RN) → `mode` (xtaro)

**说明**:xtaro 已经通过 propMap 把 `resizeMode` 改名成 `mode`(见 xtaro.json),但**值域也变了**,agent 必须同步改属性值。

| RN 值 | xtaro 值 | 备注 |
|---|---|---|
| `'contain'` | `'aspectFit'` | 保持纵横比,长边完全显示 |
| `'cover'` | `'aspectFill'` | 保持纵横比,填满容器 |
| `'stretch'` | `'scaleToFill'` | 不保持比例,完全拉伸(xtaro 默认值) |
| `'center'` | `'center'` | 不缩放,只显示中间区域 |
| `'repeat'` | *无对应* | xtaro rn 端无此值 → 退化 `'scaleToFill'` + 写入 §7 QA warn |

**注**:若 xtaro.json 尚未把 `resizeMode` 改名成 `mode`,agent 需**同时**改 prop 名和值(不能只改值)。建议保持 xtaro.json 与本手册联动。

### 1.2 `TextInput.keyboardType` (RN) → `type` (xtaro)

**说明**:xtaro rn 端支持的 type 是子集,超出的一律退化 + QA warn。

| RN keyboardType | xtaro type | 备注 |
|---|---|---|
| `'default'` | `'text'` | 默认文本键盘 |
| `'numeric'` | `'number'` | 数字键盘 |
| `'email-address'` | `'email'` | rn 端 xtaro 有 email |
| `'phone-pad'` | `'number'` | xtaro 无 phone-pad → 退化 number + QA warn |
| `'decimal-pad'` | `'digit'` | 带小数点数字 |
| `'number-pad'` | `'number'` | 同 numeric |
| `'ascii-capable'` / `'url'` / 其他 | `'text'` | 全部退化 text + QA warn |

### 1.3 `TextInput.returnKeyType` (RN) → `confirmType` (xtaro)

**说明**:值域**基本一致**,但 RN 有 xtaro 没有的 `'default'` / `'previous'` 等,退化处理。

| RN returnKeyType | xtaro confirmType | 备注 |
|---|---|---|
| `'done'` | `'done'` | 一致 |
| `'search'` | `'search'` | 一致 |
| `'go'` | `'go'` | 一致 |
| `'next'` | `'next'` | 一致 |
| `'send'` | `'send'` | 一致 |
| `'default'` / `'previous'` / `'yahoo'` / `'google'` / `'route'` | `'done'` | 全部退化 + QA warn |

**注**:值域大部分重合,建议 agent 命中不在上表的值时才写 §7 QA warn;重合值静默改。**prop 名需要改**(returnKeyType → confirmType),这一步可以放 xtaro.json propMap,也可以在此手册里改;当前 xtaro.json 未声明,agent 在 §5.5.3c 时改名 + 改值。

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

以下属性 xtaro rn 端不支持,agent 在 §5.5.3c 时**删除属性** + 写入 §7 QA warn 段(列出文件名 + 行号 + 属性名)。

| 原属性(RN) | 原标签 | 丢弃原因 |
|---|---|---|
| `numberOfLines` | `Text` | xtaro XText 只在 alipay 端支持;rn 端多行省略需在业务代码用 CSS `-webkit-line-clamp` 或 Text 手工截断 |
| `ellipsizeMode` | `Text` | 无对应 |
| `selectable` | `Text` | ✅ 一致,不丢(此项仅列为对照,agent 保留原属性) |
| `showsHorizontalScrollIndicator` | `ScrollView` | 无内置;xtaro 靠 CSS `::-webkit-scrollbar` 隐藏,业务侧手工写 |
| `showsVerticalScrollIndicator` | `ScrollView` | 同上 |
| `pagingEnabled` | `ScrollView` | xtaro 只 weapp 支持;rn 端无 |
| `onMomentumScrollEnd` | `ScrollView` | xtaro 只 weapp 支持 |
| `multiline` | `TextInput` | 无;若确需多行,改用 `XTextarea`(不同标签,超出本预设覆盖范围,QA error) |
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
4. **结构变化**(§四):`ScrollView.horizontal` 命中 → 删原 prop + 加 scrollX/scrollY;`contentContainerStyle` 命中 → 包 XView
5. **丢弃属性**(§五):表内属性命中 → 删属性 + 写入 §7 QA warn 段

**未在本手册出现的属性**一律**保留原样**;`style / key / ref / children / className` 永远不改。
