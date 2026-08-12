// R06 text-solid-last
// 触发: TEXT 节点,fills 数组非空,末位可见 fill 是 SOLID
// 期望: 对应 CSS 类含 color: #HEX (与 SOLID.color 匹配)
// 排斥: 末位可见 fill 是 GRADIENT/IMAGE → 归 R04 判定,不在此处

// v1.2.0: 跳过 baked 子树 TEXT 与隐藏节点；SCSS 嵌套匹配走 lib/cssMatch.mjs（修 &__ 盲区假阳性）。
import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R06';
export const name = 'text-solid-last';

export function check({ cache, product, config, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.type !== 'TEXT') continue;
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    // 处于 bg-/bgc-/img-/x- 整体切图子树内的 TEXT → 文字像素已烤进父层切图，
    // 不作为独立 DOM 渲染，无需校验字色。跳过，消除对账假阳性（v1.2.0）。禁 DOM 交由 R17。
    if (node._inBakedSubtree) continue;
    if (node._hidden) continue; // 隐藏 TEXT 不渲染，不校验
    if (node._templateDup) continue; // .map() 列表数据副本，只校验代表项

    const lastVisible = pickLastVisibleFill(node.fills);
    if (!lastVisible) continue; // 全 invisible → 走默认 (略过)
    if (lastVisible.type !== 'SOLID') continue; // 走 R04

    const expectedHex = rgbaToHex(lastVisible.color);
    if (!expectedHex) continue;

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `css 含 color: ${expectedHex}`,
        actual: '产物中无对应 className',
        file: '(missing in jsx)',
        line: 0,
        snippet: '',
      });
      continue;
    }

    let ok = false;
    let hitFile = null;
    let hitLine = 0;
    let hitSnippet = '';
    let actualColor = null;

    for (const cls of classes) {
      for (const s of product.style) {
        const rules = collectRuleBodies(s.content, cls);
        for (const r of rules) {
          const colorMatch = r.body.match(/(?:^|[^-\w])color\s*:\s*(#[0-9a-fA-F]{3,8})/);
          if (colorMatch) {
            const found = normalizeHex(colorMatch[1]);
            if (found === expectedHex) { ok = true; break; }
            if (!actualColor) actualColor = found;
          }
          if (!hitFile) { hitFile = s.rel; hitLine = r.line; hitSnippet = r.body.slice(0, 200); }
        }
        if (ok) break;
      }
      if (ok) break;
    }

    if (!ok) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `css 含 color: ${expectedHex} (源自 fills 末位可见 SOLID)`,
        actual: actualColor ? `css color: ${actualColor} (与 SOLID 不符)` : 'css 未含 color',
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
    h = h.slice(0, 7); // 忽略 alpha
  }
  return h;
}

