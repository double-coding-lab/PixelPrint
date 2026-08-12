---
id: pp-doctor
revision: 0
summary: pp-doctor
primary: policy
confidence: inferred
tags: [config, module]
---
# pp-doctor

> D2C 设计稿健康检测 SKILL（`templates/skills/pp-doctor/`）的执行约定与卡顿排查路由摘要。完整规则定义见 `docs/d2c-health-check-spec.md`，可执行步骤见同名 SKILL.md。

## 适用场景 / 触发词

- 用户反馈"doctor 卡住"、"步骤 2 卡很久"、"健康检测无响应"、"体检不返回"
- 维护者修改 doctor 流程、阈值、报告格式时定位读哪份文件
- 主 SKILL `pp-d2c` 集成调用 doctor 时排查阻塞原因

## 文件分工（读取优先级）

| 文件 | 角色 |
|------|------|
| `templates/skills/pp-doctor/SKILL.md` | 可执行步骤（步骤 -1 ~ 6），运行时由 Agent 直接遵循 |
| `docs/d2c-health-check-spec.md` | 规则源 / 决策记录（含 P0/P1/P2 优先级、阈值由来） |
| `templates/skills/pp-d2c/SKILL.md` 步骤 0.5 | 主 SKILL 的集成调用约定与阻塞决策 |

## 步骤 2 子流程（v0.2 已落地）

原"一次性 `get_metadata` + 后置阈值"在 2000+ 节点稿子上表现为长时间无响应。**已拆为 4 个子步骤**，规模阈值前置：

| 子步骤 | 行为 | 解决的问题 |
|--------|------|-----------|
| **2.0 进度提示** | 调用 `get_metadata` 之前必须输出 `📥 正在拉取图层树...`，附 ESC 中断与改更小 nodeId 提示 | 区分"程序卡死 / 程序在干活" |
| **2.1 拉取** | `get_metadata(fileKey, nodeId)` 失败**不重试**，直接终止 | 重试只会让用户多等一倍 |
| **2.2 规模快检** | 返回后第一件事统计 `nodeCount` / `depthMax`，先于任何打标：`> 5000 终止 / > 1500 标记 oversizeWarning / 其他放行` | 提前止损，不让大稿用户白等打标 + 规则扫描 |
| **2.3 属性打标** | 原打标逻辑保持不变，末尾输出 `🏷  属性打标完成` | 让用户看到从拉取到打标的进度推进 |

> **为什么不做"先浅扫再全量"**：Figma MCP 的 `get_metadata` 没有 depth/limit 参数；多调一次 `get_screenshot` 做规模预估反而双倍延迟。从输入侧（用户改选更小 nodeId）规避是更便宜的解。

## 卡顿排查（外部表现 → 处置）

doctor 表现"长时间无响应"时，**99% 卡在步骤 2.1**。完整 5 行排查表见 SKILL.md 末尾"步骤 2 卡住排查清单"，常用前 3 行：

| 现象 | 多半原因 | 处置 |
|------|---------|------|
| 输出"📥 正在拉取..."后 >1min 无新输出 | nodeId 选中了整页 / 包含多张稿的大容器 | 在 Figma 里点具体 frame，重新 Copy link to selection |
| 同一稿之前能跑、现在卡住 | Figma 服务端波动 / 网络抖动 | 等 30s 重试一次；仍失败按 ESC 改更小 nodeId |
| 出现"📊 图层树拉取完成：N 个节点"后立刻终止 | `nodeCount > 5000` 硬上限 | 拆稿；或主 SKILL 里只对某个 sub- 单独跑 |

## 关键阈值（由 `pp-d2c.config.json` 控制）

| 阈值 | 默认值 | 行为 |
|------|--------|------|
| `health.thresholds.totalNodesMax` | 1500 | 超过命中 FEA003（warn），仍继续扫 |
| 硬上限（不可配置） | 5000 | 步骤 2.2 直接终止，不进入打标 |
| `health.enabled` | true | false 时直接退出，不做任何检测 |
| `health.blockOnError` | true | 集成模式下 grade=F 是否阻塞主 SKILL 生成 |

## 边界与禁止

- doctor 是**只读**：禁止调 Figma REST API 导出图片、禁止修改设计稿
- 禁止跳过步骤 -1 的 MCP 预检
- 禁止扫描 > 5000 节点子树（性能保护，已在 2.2 前置）
- 集成模式禁止写文件（仅 return JSON 给主 SKILL）
- 步骤 2.0 的进度提示**不可省略**：这是用户区分"卡死 / 在干活"的唯一信号

## 已知未落地优化（留待 P1）

- spec §2.2 提过"按 sub- 块独立扫描后汇总"作为大稿降耗方案，需要拆 `get_metadata` 调用 + 上下文合并，本次未实施
- 真正的 timeout：SKILL.md 由 LLM 执行没有 `setTimeout`，目前用"可见进度 + ESC 中断"替代
