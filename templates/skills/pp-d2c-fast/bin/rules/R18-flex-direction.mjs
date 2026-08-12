// R18 flex-direction（v1.2.0 对账新增）
// 触发: autolayout 容器（layoutMode === 'HORIZONTAL' | 'VERTICAL'）
// 期望: VERTICAL → CSS 含 flex-direction: column；HORIZONTAL → 不得写 flex-direction: column（row 为 flex 默认，可省）
// 违反: 方向写反（典型 test13 small-card-top：Figma VERTICAL 却写 flex-direction: row）
// 跳过: baked / hidden / templateData 副本 / 无 className（不可追溯，交由 §5.1 data-node-id 铁律在生成侧兜底）

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R18';
export const name = 'flex-direction';

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const lm = node.layoutMode;
    if (lm !== 'HORIZONTAL' && lm !== 'VERTICAL') continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue; // 不可追溯：本条不报，由 §5.1 生成铁律保证挂 id

    const body = firstBodyWithFlex(product.style, classes);
    if (!body) continue; // 无 display:flex 规则体（可能非 flex 实现），不在本条判定

    const dir = extractFlexDirection(body);
    if (lm === 'VERTICAL') {
      if (dir !== 'column') {
        violations.push(mk(nodeId, node, 'flex-direction: column（Figma layoutMode=VERTICAL）', dir ? `flex-direction: ${dir}` : '未写 flex-direction（默认 row，纵向布局会横排）'));
      }
    } else {
      // HORIZONTAL
      if (dir === 'column') {
        violations.push(mk(nodeId, node, 'flex-direction: row 或省略（Figma layoutMode=HORIZONTAL）', 'flex-direction: column（方向写反）'));
      }
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual) {
    return { rule: id, nodeId, name: node.name || '(no name)', type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
}

// 找该 nodeId 第一个含 display:flex 的规则体
function firstBodyWithFlex(styleFiles, classes) {
  for (const cls of classes) {
    for (const s of styleFiles) {
      for (const r of collectRuleBodies(s.content, cls)) {
        if (/display\s*:\s*flex/i.test(r.body)) return r.body;
      }
    }
  }
  return null;
}

function extractFlexDirection(body) {
  const m = body.match(/flex-direction\s*:\s*([a-z-]+)/i);
  return m ? m[1].toLowerCase() : null;
}
