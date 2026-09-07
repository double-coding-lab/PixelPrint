// R09 btn-bgc-取值(rn 版,语义变更——RN 无 CSS gradient,二选一合法)
// 触发: btn- 节点子树含 bgc- 子层,且 bgc- 末位可见 fill 是 GRADIENT_*
// 期望(二选一):
//   ① 产物引用 LinearGradient 组件(import 存在 且 jsx 出现 <LinearGradient)
//   ② 按退化表落首 stop 纯色 backgroundColor(btn/bgc 任一 key),且 assets.txt 有
//     btn 或 bgc nodeId 的 [退化告警] 行
// 保守: ① 的「该节点区间出现」用全文件级判定(文本区间法对非自闭合标签不可靠,宁漏报);
//       首 stop 色值比对 rgba 归一化、RGB 三通道容差 1/255
// 跳过: baked/hidden/templateDup;btn 与 bgc 均无 styleKey 交 R21

import fs from 'node:fs';
import path from 'node:path';
import { collectRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R09';
export const name = 'btn-bgc-取值';

const GRAD = new Set(['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND']);

export function check({ cache, product, classMap }) {
  const violations = [];
  const assetsPath = path.join(product.root, 'assets.txt');
  const assetsText = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, 'utf8') : '';

  // ① 全文件级 LinearGradient 判定(import + 标签同时出现)
  const jsxAll = product.jsx.map((j) => j.content).join('\n');
  const hasLinearGradient = /import[^;]*LinearGradient[^;]*from/.test(jsxAll) && /<LinearGradient\b/.test(jsxAll);

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith('btn-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const bgc = findBgcDescendant(node);
    if (!bgc) continue;
    const last = pickLastVisibleFill(bgc.fills);
    if (!last || !GRAD.has(last.type)) continue;

    const keys = [...(classMap[nodeId] || []), ...(bgc.id ? classMap[bgc.id] || [] : [])];
    if (keys.length === 0) continue; // 不可追溯 → R21

    if (hasLinearGradient) continue; // ① 满足

    // ② 退化路径:首 stop 纯色 backgroundColor + 退化告警行
    const expected = toRgb(pickFirstStop(last));
    const declared = extractBgColor(product.style, keys);
    const colorOk = declared === 'unparseable' || (Array.isArray(declared) && Array.isArray(expected) && rgbClose(declared, expected));
    const degradeLogged = assetsText
      .split('\n')
      .some((l) => l.includes('[退化告警]') && (l.includes(nodeId) || (bgc.id && l.includes(bgc.id))));

    if (declared == null) {
      violations.push(mk(nodeId, node, `LinearGradient 组件 或 首 stop 纯色 backgroundColor + assets.txt [退化告警] 行(源自 bgc- 末位 ${last.type})`, '产物无 LinearGradient,也无 backgroundColor(渐变按钮视觉丢失)', last));
      continue;
    }
    if (!colorOk) {
      violations.push(mk(nodeId, node, `退化 backgroundColor = 渐变首 stop ${fmtRgb(expected)}`, `backgroundColor = ${fmtRgb(declared)}(首 stop 之外的臆造纯色)`, last));
    }
    if (!degradeLogged) {
      violations.push(mk(nodeId, node, 'assets.txt 含 btn/bgc nodeId 的 [退化告警] 行(渐变→纯色退化必须留痕)', 'assets.txt 无 [退化告警] 记录', last));
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual, last) {
    return { rule: id, nodeId, name: node.name, type: node.type, expected, actual, file: '(style)', line: 0, snippet: `bgc last fill: ${last.type}` };
  }
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

function pickFirstStop(fill) {
  const stops = fill && fill.gradientStops;
  return Array.isArray(stops) && stops.length ? stops[0] : null;
}

function toRgb(stop) {
  const color = stop && stop.color;
  if (!color) return null;
  return [
    Math.round((color.r || 0) * 255),
    Math.round((color.g || 0) * 255),
    Math.round((color.b || 0) * 255),
  ];
}

// 取 backgroundColor 声明并归一为 [r,g,b];返回 [r,g,b] | null | 'unparseable'
function extractBgColor(styleFiles, keys) {
  let found = null;
  for (const key of keys) {
    for (const s of styleFiles) {
      for (const r of collectRuleBodies(s.content, key)) {
        const m = r.body.match(/backgroundColor\s*:\s*([^,\n}]+)/);
        if (!m) continue;
        const raw = m[1].trim();
        const hex = raw.match(/^['"]#([0-9a-fA-F]{3,8})['"]$/);
        if (hex) { found = hexToRgb(hex[1]); continue; }
        const rgba = raw.match(/^['"]rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgba) { found = [+rgba[1], +rgba[2], +rgba[3]]; continue; }
        found = 'unparseable';
      }
    }
  }
  return found;
}

function hexToRgb(h) {
  let x = h.toLowerCase();
  if (x.length === 3 || x.length === 4) x = x.slice(0, 3).split('').map((c) => c + c).join('');
  if (x.length === 8) x = x.slice(0, 6);
  if (x.length !== 6) return 'unparseable';
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}

function rgbClose(a, b) {
  return a.every((v, i) => Math.abs(v - b[i]) <= 1);
}

function fmtRgb(c) {
  return Array.isArray(c) ? `rgb(${c.join(',')})` : String(c);
}
