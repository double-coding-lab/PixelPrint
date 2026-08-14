// R09 btn-bgc-取值（v1.2.3 软→硬迁移）
// 触发: btn- 节点子树含 bgc- 子层,且 bgc- 末位可见 fill 是 GRADIENT_*
// 期望: btn-（或 bgc-）对应 CSS background 用 gradient 形态(linear/radial/conic-gradient)
// 保守: 只判「该有 gradient 却是 solid/缺失」,不校验具体色值/角度(避免格式误判);
//       bgc 末位 SOLID → 按 background-color 取,不算 R09;bgc IMAGE → 归 R02。
//       gradient 形态出现在 btn 或 bgc 任一 class 即通过,避免「bgc 渲染成子 div」误判。
import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R09';
export const name = 'btn-bgc-取值';

const GRAD = new Set(['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND']);

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith('btn-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const bgc = findBgcDescendant(node);
    if (!bgc) continue;
    const last = pickLastVisibleFill(bgc.fills);
    if (!last || !GRAD.has(last.type)) continue; // 只在 bgc 末位可见是 GRADIENT 时判

    // 收集 btn + bgc 两处 class（background 可能写在任一处）
    const classes = [...(classMap[nodeId] || []), ...(bgc.id ? classMap[bgc.id] || [] : [])];
    if (classes.length === 0) continue; // 不可追溯 → R21

    let hasGradient = false;
    let hasSolidBg = false;
    let hitFile = null;
    let hitLine = 0;
    let hitSnippet = '';

    for (const cls of classes) {
      for (const s of product.style) {
        for (const r of collectRuleBodies(s.content, cls)) {
          if (/\b(?:linear|radial|conic)-gradient\s*\(/i.test(r.body)) { hasGradient = true; break; }
          if (/background(?:-color)?\s*:\s*(?:#|rgb|hsl)/i.test(r.body)) hasSolidBg = true;
          if (!hitFile) { hitFile = s.rel; hitLine = r.line; hitSnippet = r.body.slice(0, 200); }
        }
        if (hasGradient) break;
      }
      if (hasGradient) break;
    }

    if (!hasGradient) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: `css background 用 gradient（取自 bgc- 子层末位 ${last.type}）`,
        actual: hasSolidBg
          ? 'css background 是 solid color（疑用 solid 冒充渐变）'
          : 'css 未含 gradient 形态',
        file: hitFile || '(missing in style)',
        line: hitLine,
        snippet: hitSnippet,
      });
    }
  }

  return violations;
}

function findBgcDescendant(node) {
  if (!Array.isArray(node.children)) return null;
  const stack = [...node.children];
  while (stack.length) {
    const c = stack.shift();
    if (!c || typeof c !== 'object') continue;
    if (typeof c.name === 'string' && c.name.startsWith('bgc-')) return c;
    if (Array.isArray(c.children)) stack.push(...c.children);
  }
  return null;
}

function pickLastVisibleFill(fills) {
  if (!Array.isArray(fills)) return null;
  for (let i = fills.length - 1; i >= 0; i--) {
    const f = fills[i];
    if (f && f.visible !== false) return f;
  }
  return null;
}
