# R12 - flat-mode-naming(RN 改写:className 冲突 → StyleSheet key 冲突)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: config 无 merge.mode 或 ≠ 'flat' → 直接放行(安全降级)

## 触发条件

- **config**: `merge.mode === 'flat'`(所有 block 产物合并到同一 styles 命名空间)

## 期望产物

- 同一 styleKey 在全部 styles 文件的 `StyleSheet.create` 顶层**只定义一次**——JS 对象合并后键覆盖前键,危害与 CSS 同名类覆盖一致
- 跨 block 的 key 带 block 前缀区分:`topbarTitle` / `cardTitle`,而非两个 `title`

## 反例 (agent 常见错法)

```ts
// blocks/topbar/styles.ts
const styles = StyleSheet.create({ title: { fontSize: rpx(18) } });
// blocks/card/styles.ts
const styles = StyleSheet.create({ title: { fontSize: rpx(14) } });
// ❌ flat 合并后一个 title 覆盖另一个,topbar 标题变 14
```

## 落地代码模板

```ts
const styles = StyleSheet.create({
  topbarTitle: { fontSize: rpx(18) },
  cardTitle: { fontSize: rpx(14) },
});
```

## 违反后果

- **产物表现**: 合并后一半元素样式被另一半静默覆盖

## 相关

- rules/R15-同构 map 渲染.md(同构合并可减少 key 数量)
