---
id: pp-d2c-fast
revision: 0
summary: pp-d2c-fast
primary: feature
confidence: inferred
tags: [policy]
---
# pp-d2c-fast

> pp-d2c 的**快速模式**：基于 pp-d2c v1.2.1 拷贝 + 砍除已被 `check-rules.mjs` 逐节点对账覆盖的手写自证块（A 梯队），保留全部决策引导。原 pp-d2c 不动，二者并存，用户按需触发。

> 执行前须先读依赖主题 `pp-d2c`（fast 只讲与 pp-d2c 的差异，完整规则、裁决树、坐标公式、前缀语义均以 `pp-d2c` 为准）。

## 适用场景 / 触发词

- 想用 pp-d2c 出码但追求省 token / 少自证来回
- 触发：pp-d2c-fast、快速模式、D2C 快速模式、精简版 d2c

## 与 pp-d2c 的唯一差异：砍了哪些自证块

fast 版删除以下**已被 check-rules 覆盖**的手写自证（质量下限由机器兜底，最坏返工一轮）：

- A1 字色 fills 溯源 → **R06**
- A2 页面根 padding-top 尺寸源证明 → **R19**
- A3 §6.0.2 四条硬规则 grep 交叉验证 5 条 → **R01/R02/R08/R06/R05**（**保留 R04 GRADIENT 一条**，R04 不在 check-rules）
- A4 data-node-id 守恒 grep 自证 + §5.1.1 手动逐个自检 → **R21**
- A5 rule-hits 消费证明表 + rule-hits 聚合 → **check-rules exit 0**（每 block 交付前已跑）

共砍约 71 行；`# pp-d2c-fast Skill` banner 首段标注精简范围。

## 完全保留（与 pp-d2c 一致）

- 硬防线 check-rules **16 条 + R22 warning 级 + GATE-rule-hits / IMG-reconcile 门禁**（`bin/` `rules/` 与 pp-d2c 字节相同）
- §4.3 含 TEXT 容器裁决树、前缀语义、R20 坐标公式
- §5.1.1 data-node-id **铁律规则说明**（挂 id 是 R21 前提）
- §6.0.2 **精简证明块**保留三项：assets 消费契约、GRADIENT/IMAGE 字色（R04）、min-height 尺寸源
- §6.2 URL 自检、样式大类 P/M/J grep、图片切图 3 行溯源

## 分发

- `install.js` 无条件双写到 `.claude/skills` + `.codex/skills`；framework 属 **h5**（`skipH5` 时与 pp-d2c 一起跳，rn 项目不装）
- 新目录放进 `templates/skills/` 即自动分发，见 [[pp-install-dispatch]]

## 边界与禁止

- 追求最高保真 / 首次跑通复杂稿 → 用 pp-d2c（完整防线）
- fast 的质量下限由 check-rules 兜底；**禁止**"机器已覆盖仍要求手写自证"
- **禁止**砍 R04 GRADIENT 自证（check-rules 无此规则，砍了渐变字色无防线）

## 维护约定

- pp-d2c 每次升级（规则 / bin / 裁决树），须**同步到 pp-d2c-fast**——独立 skill 双份并存的维护成本

## 相关

- [[pp-d2c]]（完整防线版，依赖主题）
