# RN04 - styles-file-separation(RN 特有:styles.ts 强制独立文件)

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无——本条是全部数值规则的前置(样式混进 jsx 会让 styleMatch 引擎失明,先行拦截)

## 触发条件

- **产物**: 任一 jsx 文件(.jsx/.tsx)

## 校验

1. jsx 文件内禁出现 `StyleSheet.create`——样式必须在独立 styles 文件(`styles.ts` / `styles.js` / `*.styles.ts`),否则响应式改写 / adapter 改写会触碰 JSX
2. jsx 内禁静态 inline style 对象 `style={{...}}`——逃出 styleMatch 对账,R18/R19/R20/R23 全部失明
3. **放行**:`style={[styles.a, 动态变量]}` 数组形态(动态成员不参与机械对账,由 nodeIdToStyleKey 忽略)

## 反例(v0.3.12 收紧的三种混写)

```tsx
// ❌ 1: StyleSheet.create 写在 index.tsx 底部
const styles = StyleSheet.create({ card: {...} });

// ❌ 2: 静态 inline style
<View style={{ width: 335, padding: 16 }} />

// ❌ 3: const styles = {...} 裸对象内联(同属混写)
```

## 落地代码模板

```
blocks/card/
├── index.tsx    ← 只有 JSX,import { styles } from './styles'
└── styles.ts    ← 全部 StyleSheet.create
```

```tsx
// index.tsx
import { styles } from './styles';
<View style={styles.card} data-node-id="211:40" />
<View style={[styles.card, isActive && styles.cardActive]} />   // 数组 + 条件成员放行
```

## 违反后果

- **产物表现**: 引擎对该节点全部数值对账失明;adapter 阶段标签替换与样式改写互相踩踏

## 相关

- SKILL.md §5 合并结构(v0.3.12 强制独立文件)
- bin/lib/loadProduct.mjs(styles 文件双条件识别)
