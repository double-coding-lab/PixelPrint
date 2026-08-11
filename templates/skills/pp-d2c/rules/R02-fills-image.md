# R02 - fills-image

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**:
  - 节点前缀是 `x-` → 忽略
  - 节点是 `btn-` 子层的 `bgc-` → 归 R09
  - 节点已被 R11 判 mask-vector-css-able → R02 优先切图

## 触发条件

- **cache**: `Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE' && f.visible !== false)`
- **命中信号**: 该节点有可见的 IMAGE 填充

## 期望产物

**assets.txt 端**:
- 必须记录该 `nodeId` 的切图文件名(如 `bg-body.png`)

**JSX 端** (二选一):
- (a) `<img src="${ASSET_PREFIX}xxx.png" data-node-id="{id}" />` (前景图)
- (b) 父容器 `<div className={styles.foo} data-node-id="{id}"></div>`(后台图,配合 SCSS background)

**SCSS 端** (方式 b 时):
- `.foo { background-image: url("...xxx.png"); background-size: cover|100% 100%; }`

**反例扫描**:
- assets.txt 缺记录 → violation
- assets.txt 有记录但产物没引用 → violation

## 反例 (agent 常见错法)

```jsx
{/* ❌ 错法 1: 该切图不切,凭空 gradient */}
<div style={{ background: "linear-gradient(180deg, #fee 0%, #fdb 100%)" }} />

{/* ❌ 错法 2: 该切图不切,写 solid color */}
<div className={styles.bgBody} />
```

```scss
/* ❌ 错法 2 对应 */
.bgBody {
  background-color: #f0e0d0;
}
```

## 落地代码模板

**前景图**:
```jsx
<img className={styles.heroImg}
     src={`${ASSET_PREFIX}hero.png`}
     data-node-id="211:126"
     alt="" />
```

**背景图(推荐用父容器)**:
```jsx
<div className={styles.bgBody} data-node-id="211:37">
  {/* children */}
</div>
```

```scss
.bgBody {
  width: 750px;
  height: 1200px;
  background-image: url("../../static/test1/bg-body.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
```

## 违反后果

- **产物表现**: agent 凭空搓 gradient/solid color 代替真图,视觉严重跑偏
- **典型事故**:
  - v0.3.20 test1 事故 — `bg-body` (211:37) 没切图,agent 编造 `background-color`
  - v0.3.21 test8 事故 — 多张 `image XX` 未切,agent 用文字堆叠模拟

## 相关

- SKILL.md §4.3 切图四条硬规则
- rules/R08-bg-landing-form.md (bg- 前缀的落地形态)
- rules/R09-btn-bgc-取值.md (btn 内 bgc 的取值)
