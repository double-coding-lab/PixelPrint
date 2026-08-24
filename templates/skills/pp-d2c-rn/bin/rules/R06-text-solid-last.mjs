// R06 text-solid-last(rn 版,改写——color 为字符串字面量,兼容 0x 数字色)
// 触发: TEXT 节点,fills 数组非空,末位可见 fill 是 SOLID
// 期望: style 含 color: '#hex'(与 SOLID.color 匹配;0xAARRGGBB 数字色一并识别)
// 排斥: 末位可见 fill 是 GRADIENT/IMAGE → 归 R04
// 跳过: baked/hidden/templateDup;无 styleKey 交 R21;动态色值 unparseable 跳过

import { collectRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R06';
export const name = 'text-solid-last';

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.type !== 'TEXT') continue;
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    if (node._inBakedSubtree) continue;
    if (node._hidden) continue;
    if (node._templateDup) continue;

    const lastVisible = pickLastVisibleFill(node.fills);
    if (!lastVisible) continue;
    if (lastVisible.type !== 'SOLID') continue; // GRADIENT/IMAGE → R04

    const expectedHex = rgbaToHex(lastVisible.color);
    if (!expectedHex) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21

    let ok = false;
    let sawUnparseable = false;
    let hitFile = null;
    let hitLine = 0;
    let hitSnippet = '';
    let actualColor = null;

    for (const key of keys) {
      for (const s of product.style) {
        for (const r of collectRuleBodies(s.content, key)) {
          const found = extractHexColor(r.body);
          if (found === 'unparseable') { sawUnparseable = true; continue; }
          if (found) {
            if (found === expectedHex) { ok = true; break; }
            if (!actualColor) actualColor = found;
          }
          if (!hitFile) { hitFile = s.rel; hitLine = r.line; hitSnippet = r.body.slice(0, 200); }
        }
        if (ok) break;
      }
      if (ok) break;
    }

    if (!ok && sawUnparseable && !actualColor) continue; // 只有动态色值 → 保守跳过

    if (!ok) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `style 含 color: '${expectedHex}'(源自 fills 末位可见 SOLID)`,
        actual: actualColor ? `color: '${actualColor}'(与 SOLID 不符)` : 'style 未含 color',
        file: hitFile || '(missing in style)',
        line: hitLine,
        snippet: hitSnippet,
      });
    }
  }

  return violations;
}

// 从规则体取 color 声明并归一为 #rrggbb;支持 '#hex' 字符串与 0xAARRGGBB 数字色。
// 返回 '#rrggbb' | null(未声明) | 'unparseable'(动态值)
function extractHexColor(body) {
  const m = body.match(/(?:^|[,{\s])color\s*:\s*([^,\n}]+)/);
  if (!m) return null;
  const raw = m[1].trim();
  const str = raw.match(/^['"](#[0-9a-fA-F]{3,8})['"]$/);
  if (str) return normalizeHex(str[1]);
  const num = raw.match(/^0x([0-9a-fA-F]{8})$/);
  if (num) return ('#' + num[1].slice(2)).toLowerCase(); // 0xAARRGGBB → #rrggbb
  return 'unparseable';
}

function pickLastVisibleFill(fills) {
  for (let i = fills.length - 1; i >= 0; i--) {
    const f = fills[i];
    if (f && f.visible !== false) return f;
  }
  return null;
}

function rgbaToHex(color) {
  if (!color) return null;
  const r = Math.round((color.r || 0) * 255);
  const g = Math.round((color.g || 0) * 255);
  const b = Math.round((color.b || 0) * 255);
  return ('#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')).toLowerCase();
}

function normalizeHex(hex) {
  let h = hex.toLowerCase();
  if (h.length === 4) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  } else if (h.length === 9) {
    h = h.slice(0, 7);
  }
  return h;
}
