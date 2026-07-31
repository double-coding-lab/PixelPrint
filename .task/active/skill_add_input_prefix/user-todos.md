# User Todo List — skill_add_input_prefix

## 2026-07-31

- [ ] Figma 里把输入框容器(如 `Frame 256/258/260`)图层名改成 `input-people/input-idcard/input-city`
- [ ] 清缓存:`rm -rf .d2c-cache/dKc9NQvjTgHe9sZzg4zFOL`
- [ ] 重跑 SKILL,验证:
  - 产物 JSX 出现 `<input type="text" placeholder="..." />` 而不是 `<div>+<span>`
  - CSS 里 `background-image` 挂上图标(padding-left 腾出图标位置)
  - `::placeholder` 颜色跟 Figma TEXT 节点 fill 一致
- [ ] 抽测错误用法:
  - 起名 `input-bg-search` → doctor NAM019 error
  - 起名 `input-img-search` → doctor NAM020 error
  - `input-people` 里没 TEXT 子层 → doctor NAM017 error
