// R20 absolute-position（v1.2.0 对账新增）
// 触发: node.layoutPositioning === 'ABSOLUTE'（脱离父 autolayout 顺流，绝对定位）
// 期望: CSS top ≈ (子.bbox.y − 父.bbox.y) × scale；left ≈ (子.bbox.x − 父.bbox.x) × scale（容差 4px）
// 违反: 坐标靠猜（典型 test13 img-huochepiao：真值 left≈-10/top≈-13 溢出到背景上，产物却写 top:40/left:40）
// 跳过: baked / hidden / templateDup / 无 className / 父无 bbox
//
// 核心哲学: 能从 bbox 精确算出的坐标，禁止靠猜 + "需人工核对" 兜底（§6.0.2 已封该逃逸口）。

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R20';
export const name = 'absolute-position';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 2;
  const TOL = 4;

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.layoutPositioning !== 'ABSOLUTE') continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    // fixed- 前缀走 constraints 视口定位（R01 域），不是 (子bbox−父bbox) 相对定位，跳过
    if (node.name && node.name.startsWith('fixed-')) continue;

    const parent = node._parentId ? cache.nodes[node._parentId] : null;
    const nb = node.absoluteBoundingBox;
    const pb = parent && parent.absoluteBoundingBox;
    if (!nb || !pb) continue; // 缺 bbox 无法精确计算，不误报

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue; // 不可追溯，交由 §5.1 生成铁律

    const body = firstBody(product.style, classes);
    if (!body) continue;

    const expLeft = Math.round((nb.x - pb.x) * scale);
    const expTop = Math.round((nb.y - pb.y) * scale);

    // inset 简写兜底：inset: <top> <right> <bottom> <left> | inset: 0（四边）
    const inset = extractInset(body);
    const cssTop = extractPos(body, 'top', inset ? inset[0] : null);
    const cssLeft = extractPos(body, 'left', inset ? inset[3] : null);

    // 期望值≈0 且产物未显式声明 → 原点绝对定位与顺流视觉等价，容忍不报（避免噪声）。
    // 期望非 0 却缺失（丢了真实偏移）、或写了值但对不上（如 huochepiao 40 vs -13）→ 报。
    const problems = [];
    if (cssTop == null) {
      if (Math.abs(expTop) > TOL) problems.push(`缺 top（应 ${expTop}px，丢了真实偏移）`);
    } else if (Math.abs(cssTop - expTop) > TOL) problems.push(`top=${cssTop}px 应 ${expTop}px`);
    if (cssLeft == null) {
      if (Math.abs(expLeft) > TOL) problems.push(`缺 left（应 ${expLeft}px，丢了真实偏移）`);
    } else if (Math.abs(cssLeft - expLeft) > TOL) problems.push(`left=${cssLeft}px 应 ${expLeft}px`);

    if (problems.length) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `top≈${expTop}px left≈${expLeft}px（(子bbox−父bbox)×${scale}，父=${node._parentId}）`,
        actual: problems.join('；'),
        file: '(style)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}

function firstBody(styleFiles, classes) {
  for (const cls of classes) {
    for (const s of styleFiles) {
      const b = collectRuleBodies(s.content, cls);
      if (b.length) return b[0].body;
    }
  }
  return null;
}

// 取 top/left 值：兼容带 px 与无单位 0（`top: 0`）；无显式声明时回落 inset 值。
function extractPos(body, prop, insetVal) {
  const re = new RegExp(`(?:^|[^-\\w])${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)(px)?\\b`, 'i');
  const m = body.match(re);
  if (m) {
    const num = parseFloat(m[1]);
    if (m[2] || num === 0) return num; // 有 px，或无单位的 0
    return null; // 无单位的非 0（%/未知）→ 不比对
  }
  return insetVal; // 回落 inset
}

// 解析 inset 简写为 [top,right,bottom,left]（px 或无单位 0）；含非纯数值 → null
function extractInset(body) {
  const m = body.match(/(?:^|[^-\w])inset\s*:\s*([^;}]+)/i);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/);
  const nums = [];
  for (const p of parts) {
    const mm = p.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
    if (!mm) return null;
    if (!mm[2] && parseFloat(mm[1]) !== 0) return null; // 无单位非 0 放弃
    nums.push(parseFloat(mm[1]));
  }
  if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0]];
  if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]];
  if (nums.length === 3) return [nums[0], nums[1], nums[2], nums[1]];
  if (nums.length >= 4) return [nums[0], nums[1], nums[2], nums[3]];
  return null;
}
