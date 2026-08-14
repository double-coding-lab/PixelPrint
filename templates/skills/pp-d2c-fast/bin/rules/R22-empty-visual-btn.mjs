// R22 empty-visual-btn（v1.2.4 新增，warning 级不阻断）
// 触发: btn- 节点在产物中存在(有 className)，但自身与子树均无可见视觉——
//       CSS 无 background/渐变、JSX 无 <img> 挂载、子树无可见 TEXT、bbox 面积 > 0
//       → 空视觉按钮(透明热区)嫌疑（典型 test24 btn-qiang: cache 深度截断丢内容,产物只剩热区）。
// 保守: 仅 warning——部分设计确实用透明热区叠在整图上(bg- 父层已含按钮视觉),不能 exit 1;
//       但必须让主 agent 在 QA 段看见并复核(常见根因: cache 截断 / 该切图没切 / 漏画内容)。
// 跳过: baked / hidden / templateDup / 无 className。

import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R22';
export const name = 'empty-visual-btn';

const VISUAL_CSS = /background(?:-image|-color)?\s*:|(?:linear|radial|conic)-gradient\s*\(|url\s*\(/i;

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const nm = (node.name || '').trim();
    if (!(nm.startsWith('btn-') || nm === 'btn')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const bbox = node.absoluteBoundingBox;
    if (!bbox || !(bbox.width > 0 && bbox.height > 0)) continue;
    if (!classMap[nodeId] || classMap[nodeId].length === 0) continue; // 不可追溯,交 R21

    // 子树任一可见 TEXT → 文字按钮,有视觉
    if (subtreeHasVisibleText(node)) continue;

    // 自身或子树任一有 className 的节点,其 CSS 含背景/渐变/url → 有视觉
    const ids = collectSubtreeIds(node, cache.nodes, nodeId);
    if (ids.some((id2) => hasVisualCss(product.style, classMap[id2] || []))) continue;

    // 子树任一节点在 JSX 中以 <img> 呈现,或标签上带内联背景(style={{backgroundImage}}) → 有视觉
    if (ids.some((id2) => jsxHasImg(product.jsx, id2) || jsxHasInlineVisual(product.jsx, id2))) continue;

    violations.push({
      rule: id,
      severity: 'warning',
      nodeId,
      name: node.name || '(no name)',
      type: node.type,
      expected: 'btn- 节点应有可见视觉(文字/背景/图片);纯透明热区须人工确认是否叠在整图上',
      actual: '产物 button 无文字、无 background、无 <img>,疑似空视觉按钮(常见根因: cache 深度截断 / 该切图没切)',
      file: '(style)',
      line: 0,
      snippet: '',
    });
  }

  return violations;
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

// btn 子树全部节点 id（含自身）；以 cache.nodes 的 _parentId 链兜底,树上直接走 children
function collectSubtreeIds(root, cacheNodes, rootId) {
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

function hasVisualCss(styleFiles, classes) {
  for (const cls of classes) {
    for (const s of styleFiles) {
      for (const b of collectRuleBodies(s.content, cls)) {
        if (VISUAL_CSS.test(b.body)) return true;
      }
    }
  }
  return false;
}

function jsxHasImg(jsxFiles, nodeId) {
  const esc = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<img[^>]*data-node-id=["']${esc}["']`, 'i');
  return jsxFiles.some((f) => re.test(f.content));
}

// 切图消费契约允许 JSX 内联 style={{ backgroundImage: ... }} 挂图,同一标签内出现 background 即算有视觉
function jsxHasInlineVisual(jsxFiles, nodeId) {
  const esc = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<[a-zA-Z][^>]*data-node-id=["']${esc}["'][^>]*>`, 'i');
  for (const f of jsxFiles) {
    const m = f.content.match(re);
    if (m && /background/i.test(m[0])) return true;
  }
  return false;
}
