# R07 - multi-fills

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ❌
- **软防线** (Rule-Scan sub-agent 识别): ✅ (**唯一识别方**)
- **排斥条件**:
  - fills 只有 1 层可见 → 不适用
  - fills 全部同类型 SOLID → 属 R06 单层判定
  - 节点是 TEXT + 末位 GRADIENT/IMAGE → 归 R04

## 触发条件

- **cache**: `Array.isArray(node.fills) && fills.filter(f => f && f.visible !== false).length >= 2`
- **且**: 多层 fills 类型混合 (`SOLID + IMAGE`、`SOLID + GRADIENT`、多个 IMAGE 叠加等)

## 期望产物

**核心原则**: 每层 fills 都要落地,不能只取其一。

**JSX/SCSS 组合方式**:

1. **SOLID + IMAGE 叠加** (底色 + 图案):
   ```scss
   .box {
     background-color: #FF6600;                      // SOLID 底色
     background-image: url("...pattern.png");        // IMAGE 上层
     background-blend-mode: normal;                  // 或 multiply / overlay
   }
   ```

2. **SOLID + GRADIENT** (底色 + 渐变):
   ```scss
   .box {
     background:
       linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%),  // GRADIENT 上层
       #FF6600;                                                            // SOLID 底色
   }
   ```

3. **多层 GRADIENT / IMAGE**:
   - CSS `background` 简写多层,后写的在下方
   - **Figma fills 数组顺序**: 索引小的在下,索引大的在上;转 CSS 时**颠倒**

## 反例 (agent 常见错法)

```scss
/* Figma fills = [{SOLID, #FF6600, visible:true}, {IMAGE, pattern.png, visible:true}]
   agent 常错法: */

/* ❌ 只写 SOLID 忽略 IMAGE */
.box { background-color: #FF6600; }

/* ❌ 只写 IMAGE 忽略 SOLID */
.box { background-image: url("...pattern.png"); }

/* ❌ 层次颠倒 (SOLID 在上盖住 IMAGE) */
.box {
  background-image: url("...pattern.png");
  background-color: #FF6600;
}
/* 上例其实 CSS 顺序不重要,但要用 background 简写才可控叠加 */
```

## 落地代码模板

```scss
.orangeCard {
  background:
    url("../../static/xxx/pattern.png") center / cover no-repeat,
    #FF6600;
  width: 750px;
  height: 200px;
}
```

## 违反后果

- **产物表现**: 底色或图案丢失,视觉与设计不符
- **典型事故**:
  - v0.3.19 test8 事故 — `quanItem__btn` fills = [SOLID 金色, IMAGE 光斑],agent 只写 SOLID,光斑丢失

## Rule-Scan 识别提示

- 统计 `visible !== false` 的 fills 数量,≥2 才触发
- 输出 context 里必须列 **每一层** 的 type + 主要参数(color/imageRef/gradientStops),UI sub-agent 照做

## 相关

- SKILL.md §4.3 CSS 翻译表
- rules/R09-btn-bgc-取值.md (btn 内 bgc 层的特殊处理)
