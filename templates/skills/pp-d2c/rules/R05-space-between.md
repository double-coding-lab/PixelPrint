# R05 - space-between

## 判定归属

- **硬防线** (check-rules.mjs 自动拦截): ✅
- **软防线** (Rule-Scan sub-agent 识别): ✅ (兜底)
- **排斥条件**: 无

## 触发条件

- **cache**: `node.primaryAxisAlignItems === 'SPACE_BETWEEN'`
- **命中信号**: Figma AutoLayout 主轴对齐 = SPACE_BETWEEN (常见于 topbar 左右两端布局、卡片 header 主题+图标)

## 期望产物

**JSX 端**:
- 父容器 flex 布局(结构不用变,子元素两个及以上)

**SCSS 端** (强制):
```scss
.container {
  display: flex;
  flex-direction: row;  // 或 column,看 layoutMode
  justify-content: space-between;
  align-items: center;
}
```

**反例扫描** (warning 而非 violation):
- `margin-left: auto` / `margin-right: auto` 模拟推开
- `justify-content: flex-end` + 手动 padding
- `gap: auto`(不合法但 agent 常用)

## 反例 (agent 常见错法)

```scss
/* ❌ 错法 1: 用 margin auto */
.topbar {
  display: flex;
  .navBack { margin-right: auto; }
  .navShare { }
}

/* ❌ 错法 2: 用 flex-end 单侧对齐 */
.topbar {
  display: flex;
  justify-content: flex-end;
  padding-left: 500px;  /* 硬 padding 顶开左边元素 */
}

/* ❌ 错法 3: 用 gap auto */
.topbar {
  display: flex;
  gap: auto;  /* 不合法 */
}
```

## 落地代码模板

```scss
.topbar {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  width: 750px;
  height: 118px;
}
```

## 违反后果

- **产物表现**: 布局在不同宽度设备上错位(margin auto 只在 flex 里工作,固定 padding 无响应)
- **典型事故**:
  - test8 topbar — 左右两端图标应 SPACE_BETWEEN,agent 写成 margin-right: auto,设备变宽后错位

## Rule-Scan 识别提示

- `node.primaryAxisAlignItems === 'SPACE_BETWEEN'` 是**唯一触发**
- 有些 AutoLayout 主轴是 vertical (`node.layoutMode === 'VERTICAL'`),需 `flex-direction: column`

## 相关

- SKILL.md §4.3 硬规则
