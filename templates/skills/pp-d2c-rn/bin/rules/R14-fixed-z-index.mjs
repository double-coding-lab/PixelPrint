// R14 fixed-z-index(rn 版,改写——z-index 换 camelCase zIndex 数字属性)
// 触发: ≥2 个 fixed- 节点(可追溯、非 baked/hidden)
// 期望: 各 fixed 有 zIndex 且不全相同(层级可区分)
// 保守: 只报「全部缺 zIndex」或「全部 zIndex 相同」;不强求具体递增序;单个 fixed → 不判;
//       动态值 unparseable 视为「有值但不可比」,该节点不计入全缺/全同统计

import { allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';

export const id = 'R14';
export const name = 'fixed-z-index';

export function check({ cache, product, config, classMap }) {
  const helperName = (config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';
  const fixed = [];
  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith('fixed-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21
    fixed.push({ nodeId, node, keys });
  }

  if (fixed.length < 2) return [];

  const zvals = fixed.map((f) => {
    const r = getNumericAcross(allRuleBodies(product.style, f.keys), 'zIndex', helperName);
    if (r == null) return { ...f, z: null };
    if (r.unparseable) return { ...f, z: 'dynamic' };
    return { ...f, z: r.value };
  });

  const comparable = zvals.filter((v) => v.z !== 'dynamic');
  if (comparable.length < 2) return []; // 大多为动态值 → 判不了,保守放行

  const allMissing = comparable.every((v) => v.z === null);
  const present = comparable.filter((v) => v.z !== null).map((v) => v.z);
  const allSame = present.length === comparable.length && new Set(present).size === 1;

  if (!allMissing && !allSame) return [];

  const list = zvals.map((v) => `${v.node.name}=${v.z ?? '(缺)'}`).join(', ');
  return [{
    rule: id,
    nodeId: comparable[0].nodeId,
    name: comparable[0].node.name,
    type: comparable[0].node.type,
    expected: '多个 fixed- 元素 zIndex 应存在且不全相同(层级可区分)',
    actual: allMissing ? `全部 fixed- 未设 zIndex: ${list}` : `全部 fixed- zIndex 相同: ${list}`,
    file: '(style)',
    line: 0,
    snippet: '',
  }];
}
