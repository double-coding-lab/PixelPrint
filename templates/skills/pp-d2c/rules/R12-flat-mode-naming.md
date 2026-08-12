# R12 - flat-mode-naming

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - `pp-d2c.config.json` 的 `merge.mode !== 'flat'` → 不适用
  - 项目使用 CSS Modules 且每个 block 独立 scss 文件 → 天然隔离,不适用

## 触发条件

- **config**: `merge.mode === 'flat'`(所有 block 产物合并到一个文件)
- **命中信号**: 多个 block 产出相同 className(如 `.title` / `.button` / `.card`),合并后互相覆盖

## 期望产物

**核心原则**: flat 模式下,className 必须带 **block 语义前缀** 才不冲突。

**命名规范**:

| 场景 | 好类名 | 坏类名 |
|---|---|---|
| topbar 的 title | `.topbarTitle` | `.title` |
| card 的 title | `.cardTitle` | `.title` |
| footer 的 button | `.footerButton` | `.button` |
| 通用容器 | `.<block>Container` | `.container` |

**JSX 端**:
- `<div className={styles.topbarTitle}>`,不是 `<div className={styles.title}>`

**SCSS 端**:
- 类选择器全都含 block 前缀
- **不用** BEM 双下划线(`.topbar__title`)反而增加复杂度;直接驼峰 camelCase 拼

## 反例 (agent 常见错法)

```jsx
{/* Block 1: topbar */}
<div className={styles.title}>标题</div>

{/* Block 2: card */}
<div className={styles.title}>卡片标题</div>

{/* 合并后 `.title` 只保留最后一个规则,前面的样式被覆盖 */}
```

```scss
/* Block 1 生成 */
.title { font-size: 32px; color: #003366; }

/* Block 2 生成 */
.title { font-size: 24px; color: #666; }

/* flat 合并:第二个 .title 覆盖第一个,topbar 的样式丢失 */
```

## 落地代码模板

```jsx
{/* Block 1: topbar */}
<div className={styles.topbarTitle}>标题</div>

{/* Block 2: card */}
<div className={styles.cardTitle}>卡片标题</div>
```

```scss
.topbarTitle { font-size: 32px; color: #003366; }
.cardTitle   { font-size: 24px; color: #666;    }
```

## 违反后果

- **产物表现**: 类名冲突,后 block 的样式盖住前 block,视觉错乱
- **典型事故**:
  - v0.3.16 test8 事故 — 3 个 block 都用 `.title`,合并后只剩 footer 样式

## Rule-Scan 识别提示

- Read `pp-d2c.config.json`,若 `merge.mode !== 'flat'` → 跳过 R12 判定
- 遍历产物 SCSS,检索**同名 selector**是否出现多次
- 或提前扫每个 block 的类名列表,交叉比对

## 相关

- SKILL.md §5 合并策略
- pp-d2c.config.json `merge.mode`
