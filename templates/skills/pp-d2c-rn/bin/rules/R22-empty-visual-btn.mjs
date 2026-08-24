// R22 empty-visual-btn(rn 版,改写,warning 级不阻断)
// 触发: btn- 节点在产物中存在(有 styleKey),但自身与子树均无可见视觉——
//       style 无 backgroundColor/borderWidth/borderColor、jsx 无图片家族标签挂载、
//       无 LinearGradient、子树无可见 TEXT、bbox 面积 > 0 → 空视觉按钮(透明热区)嫌疑
// 保守: 仅 warning——部分设计确实用透明热区叠在整图上,不能 exit 1;
//       但必须让主 agent 在 QA 段看见并复核(常见根因: cache 截断 / 该切图没切 / 漏画内容)
// 跳过: baked / hidden / templateDup / 无 styleKey

import { collectRuleBodies } from '../lib/styleMatch.mjs';
import { imageTags, findImageTagWithNodeId } from '../lib/rnTags.mjs';

export const id = 'R22';
export const name = 'empty-visual-btn';

const VISUAL_STYLE = /backgroundColor\s*:|borderWidth\s*:|borderColor\s*:/;

export function check({ cache, product, config, classMap }) {
  const hits = [];
  const tags = imageTags(config);

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const nm = (node.name || '').trim();
    if (!(nm.startsWith('btn-') || nm === 'btn')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const bbox = node.absoluteBoundingBox;
    if (!bbox || !(bbox.width > 0 && bbox.height > 0)) continue;
    if (!classMap[nodeId] || classMap[nodeId].length === 0) continue; // 不可追溯,交 R21

    if (subtreeHasVisibleText(node)) continue;

    const ids = collectSubtreeIds(node, nodeId);
    if (ids.some((id2) => hasVisualStyle(product.style, classMap[id2] || []))) continue;
    if (ids.some((id2) => product.jsx.some((j) => findImageTagWithNodeId(j.content, tags, id2).length > 0))) continue;
    if (ids.some((id2) => jsxNodeNearLinearGradient(product.jsx, id2))) continue;

    hits.push({
      rule: id,
      severity: 'warning',
      nodeId,
      name: node.name || '(no name)',
      type: node.type,
      expected: 'btn- 节点应有可见视觉(文字/backgroundColor/边框/图片/渐变);纯透明热区须人工确认是否叠在整图上',
      actual: '产物按钮无文字、无 backgroundColor/边框、无图片家族标签,疑似空视觉按钮(常见根因: cache 深度截断 / 该切图没切)',
      file: '(style)',
      line: 0,
      snippet: '',
    });
  }

  return hits;
}

function subtreeHasVisibleText(root) {
  let found = false;
  const walk = (n) => {
    if (found || !n || typeof n !== 'object') return;
    if (n.visible === false) return;
    if (n.type === 'TEXT' && String(n.characters || '').trim()) { found = true; return; }
    for (const c of n.children || []) walk(c);
  };
  walk(root);
  return found;
}

function collectSubtreeIds(root, rootId) {
  const ids = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.id) ids.push(n.id);
    for (const c of n.children || []) walk(c);
  };
  walk(root);
  if (ids.length === 0) ids.push(rootId);
  return ids;
}

function hasVisualStyle(styleFiles, keys) {
  for (const key of keys) {
    for (const s of styleFiles) {
      for (const b of collectRuleBodies(s.content, key)) {
        if (VISUAL_STYLE.test(b.body)) return true;
      }
    }
  }
  return false;
}

// 该 nodeId 标签所在文件同时出现 <LinearGradient → 视为渐变视觉(全文件级保守判定,宁漏报)
function jsxNodeNearLinearGradient(jsxFiles, nodeId) {
  const esc = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idRe = new RegExp(`data-node-id=["']${esc}["']`);
  return jsxFiles.some((f) => idRe.test(f.content) && /<LinearGradient\b/.test(f.content));
}
