# R07 - multi-fills(RN 文档改写,软防线)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**: fills 只有 1 层可见 → 不适用;全 SOLID → R06;TEXT + 末位 GRADIENT/IMAGE → R04

## 触发条件

- **cache**: `fills.filter(f => f && f.visible !== false).length >= 2` 且类型混合(SOLID+IMAGE、SOLID+GRADIENT 等)

## 期望产物

**核心原则**:每层 fills 都要落地,不能只取其一。RN 没有 CSS 多值 background,多层填充**拆层叠放**:

1. **SOLID + IMAGE**(底色 + 图案):底层 View `backgroundColor` + 上层 `<Image>` absolute 铺放
   ```tsx
   <View style={styles.box} data-node-id="211:60">
     <Image source={require('./assets/pattern.png')} style={styles.boxPattern} />
     {/* 内容 */}
   </View>
   ```
   ```ts
   box: { backgroundColor: '#FF6600' },
   boxPattern: { position: 'absolute', top: 0, left: 0, width: rpx(335), height: rpx(100) },
   ```
2. **SOLID + GRADIENT**:底层 `backgroundColor` + 上层 `<LinearGradient>`(项目已接该库时);未接库按退化表取上层首 stop 合成并留 `[退化告警]`
3. **层序**:Figma fills 索引小的在下、大的在上;RN 里 JSX 后写的组件在上,顺序与 fills 一致(与 h5 CSS 简写的"颠倒"相反)

## 反例 (agent 常见错法)

```ts
// Figma fills = [SOLID #FF6600, IMAGE pattern]
// ❌ 只写 SOLID 忽略 IMAGE(光斑/纹理丢失)
box: { backgroundColor: '#FF6600' },
```

## 违反后果

- **产物表现**: 底色或图案丢失,视觉与设计不符

## Rule-Scan 识别提示

- 统计 `visible !== false` 的 fills 数量,≥2 才触发
- 输出 context 里必须列**每一层**的 type + 主要参数(color/imageRef/gradientStops),UI sub-agent 照做拆层

## 相关

- rules/R09-btn-bgc-取值.md(btn 内 bgc 层的渐变退化)
- SKILL.md §4.3.rn RN 特性退化表
