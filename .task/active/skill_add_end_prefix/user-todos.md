# User Todo List — skill_add_end_prefix

> Agent 追加,用户完成后可将 `- [ ]` 改为 `- [x]` 或删除。

## 2026-07-30

- [ ] 在测试项目里设计师把 `img-pinxuan` 图层名改成 `end-img-pinxuan`(或者你可以先改一个测试节点),或用其他真实需要"贴底"的节点做验证
- [ ] 清测试项目缓存: `rm -rf .d2c-cache/dKc9NQvjTgHe9sZzg4zFOL`
- [ ] 重跑 SKILL,观察产物:是否出现 wrapper 包裹 + `justify-content: space-between`;是否 pinxuan 在设备高度 >812 时贴屏底显示
- [ ] 抽测:叠加 `end-img-` 与 `fixed-btn-` 场景是否正常(fixed- 优先)
