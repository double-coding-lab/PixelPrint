// R03 implicit-image（v1.2.3 软→硬迁移,极保守）
// 触发: 无任何前缀 + 子树纯几何/容器 + 无 TEXT/INSTANCE/COMPONENT + 无 btn-/input-/sub-/block- 子节点
//       且子树含 ≥3 个「真矢量路径」(VECTOR/BOOLEAN_OPERATION/STAR/REGULAR_POLYGON,CSS 难还原) → 该整体切图
// 期望: assets.txt 有切图记录 且 产物引用(<img>/background url)
// 保守: RECTANGLE/ELLIPSE/LINE 等可 CSS 化的简单形状不计入「必切」信号;阈值 ≥3 真矢量;
//       只抓「一堆真实矢量路径堆叠却没切图」,避免对装饰圆点/单形状/可 CSS 化图形误判。
import fs from 'node:fs';
import path from 'node:path';
import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R03';
export const name = 'implicit-image';

const PREFIXES = ['img-', 'bg-', 'bgc-', 'x-', 'input-', 'sub-', 'block-', 'btn-', 'fixed-', 'end-', 'scrollx-', 'scrolly-'];
const GEOM = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'RECTANGLE', 'ELLIPSE', 'STAR', 'REGULAR_POLYGON', 'LINE']);
const HARD_VECTOR = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'REGULAR_POLYGON']);
const CONTAINER = new Set(['GROUP', 'FRAME']);
const DISQUALIFY_TYPE = new Set(['TEXT', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET']);
const DISQUALIFY_PREFIX = ['btn-', 'input-', 'sub-', 'block-'];
const HARD_VECTOR_THRESHOLD = 3;

export function check({ cache, product, classMap }) {
  const violations = [];
  const assetsText = readAssets(product);

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    if (hasPrefix(node.name)) continue;
    if (!Array.isArray(node.children) || node.children.length === 0) continue; // 叶子不判

    const stat = scanSubtree(node);
    if (!stat.ok) continue; // 含 TEXT/交互/复合前缀/非几何 → 不判
    if (stat.hardVectorCount < HARD_VECTOR_THRESHOLD) continue; // 极保守阈值

    const inAssets = assetsText.includes(nodeId);
    const productRef = mentionsAsset(product, nodeId, classMap);
    if (!inAssets && !productRef) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `整体切图(子树含 ${stat.hardVectorCount} 个矢量路径,CSS 难还原) + 产物引用`,
        actual: 'assets.txt 无切图记录 且 产物未引用该 nodeId 的 img / background url',
        file: '(missing)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}

function hasPrefix(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  return PREFIXES.some((p) => n.startsWith(p));
}

// 遍历子树:命中 disqualify 立即 ok=false;统计真矢量数
function scanSubtree(root) {
  let hardVectorCount = 0;
  let ok = true;
  const stack = [...(root.children || [])];
  while (stack.length) {
    const c = stack.shift();
    if (!c || typeof c !== 'object') continue;
    if (DISQUALIFY_TYPE.has(c.type)) { ok = false; break; }
    if (typeof c.name === 'string' && DISQUALIFY_PREFIX.some((p) => c.name.startsWith(p))) { ok = false; break; }
    if (c.type && !GEOM.has(c.type) && !CONTAINER.has(c.type)) { ok = false; break; } // 非几何/容器 → 不判
    if (HARD_VECTOR.has(c.type)) hardVectorCount++;
    if (Array.isArray(c.children)) stack.push(...c.children);
  }
  return { ok, hardVectorCount };
}

function readAssets(product) {
  try {
    const p = path.join(product.root, 'assets.txt');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  } catch {
    return '';
  }
}

function mentionsAsset(product, nodeId, classMap) {
  const idNorm = nodeId.replace(/:/g, '-');
  for (const j of product.jsx || []) {
    if (j.content.includes(nodeId) || j.content.includes(idNorm)) return true;
  }
  const classes = classMap[nodeId] || [];
  for (const cls of classes) {
    for (const s of product.style) {
      for (const r of collectRuleBodies(s.content, cls)) {
        if (/url\(/i.test(r.body) || /background-image\s*:/i.test(r.body)) return true;
      }
    }
  }
  for (const s of product.style) {
    if (s.content.includes(nodeId) || s.content.includes(idNorm)) return true;
  }
  return false;
}
