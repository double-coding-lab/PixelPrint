// R14 fixed-z-index（v1.2.3 软→硬迁移）
// 触发: ≥2 个 fixed- 节点(可追溯、非 baked/hidden)
// 期望: 各 fixed 有 z-index 且不全相同(层级可区分)
// 保守: 只报「全部缺 z-index」或「全部 z-index 相同」这两种铁定覆盖的情形;
//       不强求具体递增序/具体值(那有合理变体,会误判)。单个 fixed → 不判。
import { findProperty } from '../lib/cssMatch.mjs';

export const id = 'R14';
export const name = 'fixed-z-index';

export function check({ cache, product, classMap }) {
  const fixed = [];
  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith('fixed-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue; // 不可追溯 → R21
    fixed.push({ nodeId, node, classes });
  }

  if (fixed.length < 2) return []; // 单个/无 → 无层级冲突

  const zvals = fixed.map((f) => {
    const r = findProperty(product.style, f.classes, /z-index\s*:\s*-?\d+/i);
    if (r.hit) {
      const m = r.body.match(/z-index\s*:\s*(-?\d+)/i);
      return { ...f, z: m ? m[1] : null, rel: r.rel, line: r.line };
    }
    return { ...f, z: null, rel: r.firstRel, line: r.firstLine };
  });

  const allMissing = zvals.every((v) => v.z === null);
  const present = zvals.filter((v) => v.z !== null).map((v) => v.z);
  const allSame = present.length === zvals.length && new Set(present).size === 1;

  if (!allMissing && !allSame) return []; // 有区分 → 放行

  const list = zvals.map((v) => `${v.node.name}=${v.z ?? '(缺)'}`).join(', ');
  return [{
    rule: id,
    nodeId: zvals[0].nodeId,
    name: zvals[0].node.name,
    type: zvals[0].node.type,
    expected: '多个 fixed- 元素 z-index 应存在且不全相同(层级可区分)',
    actual: allMissing ? `全部 fixed- 未设 z-index: ${list}` : `全部 fixed- z-index 相同: ${list}`,
    file: zvals[0].rel || '(style)',
    line: zvals[0].line || 0,
    snippet: '',
  }];
}
