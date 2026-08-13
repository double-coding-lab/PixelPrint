// R23 size-fidelity（v1.2.5 新增）
// 触发: 产物为节点显式声明了 px 宽/高,但与 cache bbox × scale 相差 > 4px。
// 特判: 1px×1px + overflow:hidden 且真实 bbox 面积远大于 1 → 「锚点欺诈」——
//       典型 test28 __screen-ref: 真实 331.5×141(应 663×282px)被写成 1×1 隐藏 div,
//       专为骗过 R02/R21 的存在性+引用检查(agent 自供"校验锚点")。
// 保守跳过(宁漏报不误判):
//   - 未声明 px 宽/高(HUG 不写宽、FILL 写 100%、auto/fit-content) → 布局驱动,不判
//   - TEXT 节点(字体渲染尺寸与 bbox 天然有出入) → 不判
//   - 声明了 padding 且全部规则体均无 box-sizing: border-box → 盒模型不确定,不判
//   - baked / hidden / templateDup / 无 className / 无 bbox → 不判

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R23';
export const name = 'size-fidelity';

const TOL = 4;

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 2;

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    if (node.type === 'TEXT') continue;
    const bbox = node.absoluteBoundingBox;
    if (!bbox || !(bbox.width > 0 && bbox.height > 0)) continue;
    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue;

    const bodies = allBodies(product.style, classes);
    if (bodies.length === 0) continue;

    const declW = lastPx(bodies, 'width');
    const declH = lastPx(bodies, 'height');
    if (declW == null && declH == null) continue; // 布局驱动尺寸,不判

    const expW = Math.round(bbox.width * scale);
    const expH = Math.round(bbox.height * scale);

    // 锚点欺诈特判: 1×1 + overflow:hidden + 真实尺寸远大于 1
    const hasOverflowHidden = bodies.some((b) => /overflow\s*:\s*hidden/i.test(b));
    if (declW === 1 && declH === 1 && hasOverflowHidden && expW > 8 && expH > 8) {
      violations.push(v(nodeId, node, `width:${expW}px height:${expH}px(bbox×${scale})`,
        `1px×1px+overflow:hidden 锚点欺诈——DOM 仅为骗过存在性/引用检查而存在,视觉未渲染(真实 ${expW}×${expH}px)`));
      continue;
    }

    // 盒模型不确定 → 保守跳过
    const hasPadding = bodies.some((b) => /(?:^|[^-\w])padding(?:-\w+)?\s*:/i.test(b));
    const hasBorderBox = bodies.some((b) => /box-sizing\s*:\s*border-box/i.test(b));
    if (hasPadding && !hasBorderBox) continue;

    const problems = [];
    if (declW != null && Math.abs(declW - expW) > TOL) problems.push(`width=${declW}px 应 ${expW}px`);
    if (declH != null && Math.abs(declH - expH) > TOL) problems.push(`height=${declH}px 应 ${expH}px`);
    if (problems.length) {
      violations.push(v(nodeId, node, `width≈${expW}px height≈${expH}px(bbox×${scale},容差 ${TOL}px)`, problems.join('；')));
    }
  }

  return violations;
}

function v(nodeId, node, expected, actual) {
  return {
    rule: id,
    nodeId,
    name: node.name || '(no name)',
    type: node.type,
    expected,
    actual,
    file: '(style)',
    line: 0,
    snippet: '',
  };
}

function allBodies(styleFiles, classes) {
  const out = [];
  for (const cls of classes) {
    for (const s of styleFiles) {
      for (const b of collectRuleBodies(s.content, cls)) out.push(b.body);
    }
  }
  return out;
}

// 取该属性最后一次 px 声明(CSS 后写覆盖);无 px 声明(100%/auto/vw/未写)→ null
function lastPx(bodies, prop) {
  let val = null;
  const re = new RegExp(`(?:^|[^-\\w])${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px\\b`, 'gi');
  for (const b of bodies) {
    for (const m of b.matchAll(re)) val = parseFloat(m[1]);
  }
  return val;
}
