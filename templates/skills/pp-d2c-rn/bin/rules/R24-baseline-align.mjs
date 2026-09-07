// R24 baseline-align(v1.1.1 新增,bl- 前缀;与 h5 R24 同语义,匹配层为 StyleSheet)
// 触发: 图层名以 bl- 开头的容器——设计师显式声明"直接 Text 子元素按文本基线对齐"。
// 期望: 该容器 style 必须声明 alignItems: 'baseline';缺失或写成其他对齐值均为 violation。
//       RN 全员 flex 但默认 flexDirection 为 column,基线对齐是横排语义——
//       容器未声明 flexDirection: 'row' 时 → warning(Figma HORIZONTAL autolayout 场景由 R18 强制 row,此处不阻断)。
// 配套: bl- 容器的直接子层在 R20/RN02 豁免(位置由基线流负责,不再逐个绝对定位/不按顺流子判)。
// 跳过(宁漏报不误判): baked / hidden / templateDup / 无 styleKey(R21 兜底) / 无规则体。

import { allRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R24';
export const name = 'baseline-align';

export function check({ cache, product, config, classMap }) {
  const hits = [];
  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (typeof node.name !== 'string' || !node.name.startsWith('bl-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21
    const bodies = allRuleBodies(product.style, keys);
    if (bodies.length === 0) continue;
    const joined = bodies.join('\n');

    const m = joined.match(/alignItems\s*:\s*['"]([a-z-]+)['"]/i);
    if (!m || m[1].toLowerCase() !== 'baseline') {
      hits.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: "alignItems: 'baseline'(bl- 前缀 = 直接 Text 子元素文本基线对齐)",
        actual: m ? `alignItems: '${m[1]}'` : '未声明 alignItems',
        file: '(style)',
        line: 0,
        snippet: '',
      });
      continue;
    }
    if (!/flexDirection\s*:\s*['"]row(-reverse)?['"]/i.test(joined)) {
      hits.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        severity: 'warning',
        expected: "flexDirection: 'row'(RN 默认 column,基线对齐是横排语义)",
        actual: "已声明 alignItems: 'baseline' 但未声明 flexDirection: 'row'",
        file: '(style)',
        line: 0,
        snippet: '',
      });
    }
  }
  return hits;
}
