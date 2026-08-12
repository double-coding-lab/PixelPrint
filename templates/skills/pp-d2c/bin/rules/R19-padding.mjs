// R19 padding（v1.2.0 对账新增）
// 触发: autolayout 容器且 Figma 声明了 padding（paddingTop/Right/Bottom/Left 任一非 0），或产物写了 padding
// 期望: CSS padding 四值 ≈ Figma paddingT/R/B/L × scale（容差 2px）
// 违反:
//   - Figma pad0 但产物写了非 0 padding（凭空捏造，典型 test13 small-card-top: Figma 四边 0 却写 padding:0 12px）
//   - Figma 有 padding 但产物缺失或数值对不上
// 跳过: baked / hidden / templateDup 副本 / 无 className

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R19';
export const name = 'padding';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 2;
  const TOL = 2;

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const lm = node.layoutMode;
    if (lm !== 'HORIZONTAL' && lm !== 'VERTICAL') continue; // padding 仅在 autolayout 容器有意义
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue;

    const body = firstBody(product.style, classes);
    if (!body) continue;

    // Figma 期望值（未声明视为 0）
    const fig = [
      Math.round((node.paddingTop || 0) * scale),
      Math.round((node.paddingRight || 0) * scale),
      Math.round((node.paddingBottom || 0) * scale),
      Math.round((node.paddingLeft || 0) * scale),
    ];
    const figAllZero = fig.every((v) => v === 0);

    const css = extractPadding(body); // null | [t,r,b,l]
    if (!css) {
      // 产物未写 padding：Figma 也 0 → OK；Figma 有 padding → 缺失违规
      if (!figAllZero) {
        violations.push(mk(nodeId, node, `padding: ${fig.join('px ')}px（Figma ×${scale}）`, '产物未写 padding'));
      }
      continue;
    }

    // 逐边比对
    const bad = css.some((v, i) => Math.abs(v - fig[i]) > TOL);
    if (bad) {
      const reason = figAllZero ? '（Figma 四边 padding 均为 0，产物凭空加了 padding）' : '';
      violations.push(mk(nodeId, node, `padding ≈ [${fig.join(', ')}]px（Figma ×${scale}）`, `产物 padding = [${css.join(', ')}]px${reason}`));
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual) {
    return { rule: id, nodeId, name: node.name || '(no name)', type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
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

// 解析 CSS padding 简写 / 拆分为 [top,right,bottom,left]（px）。取规则体里"最后一次" padding 声明。
// 只认 px 值；含非 px（%/auto/var）→ 放弃比对返回 null（不误报）。
function extractPadding(body) {
  // longhand 优先覆盖 shorthand：先取 shorthand，再用 longhand 覆盖对应边
  let vals = null;
  const sh = lastMatch(body, /(?:^|[^-\w])padding\s*:\s*([^;}]+)/gi);
  if (sh) {
    const parts = sh.trim().split(/\s+/);
    const nums = [];
    for (const p of parts) {
      const mm = p.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
      if (!mm) return null; // 含 %/auto/var/calc 等非 px → 放弃比对，不误报
      if (!mm[2] && parseFloat(mm[1]) !== 0) return null; // 无单位非 0（如 rem 缺写）→ 放弃
      nums.push(parseFloat(mm[1])); // 无单位 0 或带 px → 取数值
    }
    if (nums.length === 1) vals = [nums[0], nums[0], nums[0], nums[0]];
    else if (nums.length === 2) vals = [nums[0], nums[1], nums[0], nums[1]];
    else if (nums.length === 3) vals = [nums[0], nums[1], nums[2], nums[1]];
    else if (nums.length >= 4) vals = [nums[0], nums[1], nums[2], nums[3]];
  }
  const lh = {
    0: lastMatch(body, /padding-top\s*:\s*(-?\d+(?:\.\d+)?)px/gi),
    1: lastMatch(body, /padding-right\s*:\s*(-?\d+(?:\.\d+)?)px/gi),
    2: lastMatch(body, /padding-bottom\s*:\s*(-?\d+(?:\.\d+)?)px/gi),
    3: lastMatch(body, /padding-left\s*:\s*(-?\d+(?:\.\d+)?)px/gi),
  };
  const hasLh = Object.values(lh).some((x) => x != null);
  if (!vals && !hasLh) return null;
  if (!vals) vals = [0, 0, 0, 0];
  for (const i of [0, 1, 2, 3]) if (lh[i] != null) vals[i] = parseFloat(lh[i]);
  return vals.map((v) => Math.round(v));
}

function lastMatch(body, re) {
  let m, last = null;
  while ((m = re.exec(body)) !== null) last = m[1];
  return last;
}
