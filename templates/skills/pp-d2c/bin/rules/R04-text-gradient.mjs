// R04 text-gradient（v1.2.3 软→硬迁移）
// 触发: TEXT 节点,fills 非空,末位可见 fill 是 GRADIENT_*/IMAGE
// 期望: 对应 CSS 类含 background-clip: text（或 -webkit-background-clip: text）
//       —— 渐变/图案字必须走 background-clip:text 方案,不能用 solid color 冒充
// 排斥: 末位可见 fill 是 SOLID → 归 R06;baked/hidden/templateDup 跳过;无 className 交 R21
// 保守: 只在「末位 fill 确为 GRADIENT/IMAGE 且 CSS 完全没有 background-clip:text」时报,
//       gradient 具体色值/角度不校验（避免格式差异误判）。与 R06 同一套 TEXT-fills 判定机制。
import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R04';
export const name = 'text-gradient';

const GRADIENT_TYPES = new Set([
  'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND', 'IMAGE',
]);

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.type !== 'TEXT') continue;
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    if (node._inBakedSubtree) continue; // 文字像素已烤进父层 PNG,禁 DOM 交 R17
    if (node._hidden) continue;
    if (node._templateDup) continue; // .map() 数据副本,只校验代表项

    const lastVisible = pickLastVisibleFill(node.fills);
    if (!lastVisible) continue; // 全 invisible
    if (!GRADIENT_TYPES.has(lastVisible.type)) continue; // SOLID → R06;其余类型不判

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) continue; // 不可追溯 → R21 统一报,避免双报

    let hasClipText = false;
    let hitFile = null;
    let hitLine = 0;
    let hitSnippet = '';

    for (const cls of classes) {
      for (const s of product.style) {
        for (const r of collectRuleBodies(s.content, cls)) {
          if (/(?:-webkit-)?background-clip\s*:\s*text/i.test(r.body)) {
            hasClipText = true;
            break;
          }
          if (!hitFile) { hitFile = s.rel; hitLine = r.line; hitSnippet = r.body.slice(0, 200); }
        }
        if (hasClipText) break;
      }
      if (hasClipText) break;
    }

    if (!hasClipText) {
      const kind = lastVisible.type === 'IMAGE' ? '图案(IMAGE)' : `渐变(${lastVisible.type})`;
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `css 含 background-clip: text（源自 fills 末位可见 ${kind}）`,
        actual: hitFile
          ? 'css 未含 background-clip: text（疑用 solid color 冒充渐变/图案字）'
          : 'css 未找到该 class 规则体',
        file: hitFile || '(missing in style)',
        line: hitLine,
        snippet: hitSnippet,
      });
    }
  }

  return violations;
}

function pickLastVisibleFill(fills) {
  for (let i = fills.length - 1; i >= 0; i--) {
    const f = fills[i];
    if (f && f.visible !== false) return f;
  }
  return null;
}
