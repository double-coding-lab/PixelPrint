// R24 baseline-align(v1.2.6 新增,bl- 前缀)
// 触发: 图层名以 bl- 开头的容器——设计师显式声明"直接 TEXT 子元素按文本基线对齐"。
// 期望: 该容器规则体必须声明 align-items: baseline(SCSS 嵌套写法经 cssMatch 展开同样命中);
//       缺失或写成其他对齐值(center/flex-start/flex-end/stretch)均为 violation。
//       容器规则体未见 display: flex 时 baseline 不生效 → warning(不阻断,可能由上层 flex 上下文承接)。
// 配套: bl- 容器的直接子层在 R20 豁免坐标对账(位置由基线流负责,不再逐个绝对定位)。
// 跳过(宁漏报不误判): baked / hidden / templateDup / 无 className(R21 兜底) / 无规则体。

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R24';
export const name = 'baseline-align';

function allBodies(styleFiles, classes) {
  const out = [];
  for (const cls of classes) {
    for (const s of styleFiles) {
      for (const r of collectRuleBodies(s.content, cls)) out.push(r.body);
    }
  }
  return out;
}

export function check({ cache, product, config, classMap }) {
  const hits = [];
  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (typeof node.name !== 'string' || !node.name.startsWith('bl-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue; // 不可追溯 → R21
    const bodies = allBodies(product.style, classes);
    if (bodies.length === 0) continue;
    const joined = bodies.join('\n');

    const m = joined.match(/align-items\s*:\s*([a-z-]+)/i);
    if (!m || m[1].toLowerCase() !== 'baseline') {
      hits.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: 'align-items: baseline(bl- 前缀 = 直接 TEXT 子元素文本基线对齐)',
        actual: m ? `align-items: ${m[1]}` : '未声明 align-items',
        file: '(style)',
        line: 0,
        snippet: '',
      });
      continue;
    }
    if (!/display\s*:\s*(inline-)?flex/i.test(joined)) {
      hits.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        severity: 'warning',
        expected: 'display: flex(baseline 对齐需 flex 容器)',
        actual: '已声明 align-items: baseline 但容器规则体未见 display: flex',
        file: '(style)',
        line: 0,
        snippet: '',
      });
    }
  }
  return hits;
}
