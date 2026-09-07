// R02 fills-image(rn 版,改写——判定骨架同 h5,引用形态换 RN)
// 触发: node.fills[].some(f => f.type === 'IMAGE' && f.visible !== false)
// 期望: assets.txt 有该 nodeId 切图记录 且 产物引用该切图
//       (RN 引用形态: <Image data-node-id> / require('...png') / source={{uri}} / ${ASSET_PREFIX};
//        nodeId 或其 `-` 归一形出现在 jsx/style 即算引用——与 h5 同口径)
// 排斥: x- 前缀忽略;baked/hidden/templateDup 跳过(禁 DOM 交 R17)

import fs from 'node:fs';
import path from 'node:path';
import { collectRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R02';
export const name = 'fills-image';

export function check({ cache, product, classMap }) {
  const violations = [];
  const ignorePrefix = 'x-';

  const assetsPath = path.join(product.root, 'assets.txt');
  const assetsText = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, 'utf8') : '';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    const hasImage = node.fills.some((f) => f && f.type === 'IMAGE' && f.visible !== false);
    if (!hasImage) continue;
    if (node.name && node.name.startsWith(ignorePrefix)) continue;
    if (node._inBakedSubtree) continue;
    if (node._hidden) continue;
    if (node._templateDup) continue;

    const inAssets = assetsText.includes(nodeId);
    const productMention = mentionsNodeIdAsset(product, nodeId, classMap);

    if (!inAssets && !productMention.hit) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: 'assets.txt 有此 nodeId 切图记录 且 产物引用该切图',
        actual: 'assets.txt 未记录 且 产物中未找到该 nodeId 相关 <Image> / require / uri 引用',
        file: '(missing)',
        line: 0,
        snippet: '',
      });
      continue;
    }

    if (!productMention.hit) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: '产物 jsx 或 styles 引用该 nodeId 切图',
        actual: 'assets.txt 已记录但产物未引用',
        file: '(missing in product)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}

function mentionsNodeIdAsset(product, nodeId, classMap) {
  const idNorm = nodeId.replace(/:/g, '-');
  for (const j of product.jsx) {
    if (j.content.includes(nodeId) || j.content.includes(idNorm)) return { hit: true };
  }
  const keys = classMap[nodeId] || [];
  for (const key of keys) {
    for (const s of product.style) {
      for (const r of collectRuleBodies(s.content, key)) {
        if (/require\s*\(/.test(r.body) || /\buri\s*:/.test(r.body)) return { hit: true };
      }
    }
  }
  for (const s of product.style) {
    if (s.content.includes(nodeId) || s.content.includes(idNorm)) return { hit: true };
  }
  return { hit: false };
}
