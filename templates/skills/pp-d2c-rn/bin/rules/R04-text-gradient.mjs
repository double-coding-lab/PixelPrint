// R04 text-gradient(rn 版,语义变更——RN 无 background-clip:text,校验目标改为「退化正确性」)
// 触发: TEXT 节点,fills 非空,末位可见 fill 是 GRADIENT_*/IMAGE
// 期望(按 RN 特性退化表):
//   ① 产物 Text color 等于渐变首 stop 色值(rgba 归一化后 RGB 三通道各容差 1/255,规避舍入误判);
//     末位是 IMAGE(图案字)时无首 stop,不比色值,只查 ②
//   ② assets.txt 有该 nodeId 的 `[退化告警]` 行(退化必须留痕,QA 段可复核)
// 违反: 产物写了首 stop 之外的臆造纯色 / 缺退化告警行
// 跳过: baked/hidden/templateDup;无 styleKey 交 R21;color 动态值 unparseable 只查 ②

import fs from 'node:fs';
import path from 'node:path';
import { collectRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R04';
export const name = 'text-gradient';

const GRADIENT_TYPES = new Set([
  'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND', 'IMAGE',
]);

export function check({ cache, product, classMap }) {
  const violations = [];
  const assetsPath = path.join(product.root, 'assets.txt');
  const assetsText = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, 'utf8') : '';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.type !== 'TEXT') continue;
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const lastVisible = pickLastVisibleFill(node.fills);
    if (!lastVisible) continue;
    if (!GRADIENT_TYPES.has(lastVisible.type)) continue; // SOLID → R06

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21

    // ② 退化告警留痕:assets.txt 必须有含该 nodeId 的 [退化告警] 行
    const degradeLogged = assetsText
      .split('\n')
      .some((l) => l.includes('[退化告警]') && l.includes(nodeId));
    if (!degradeLogged) {
      violations.push(mk(nodeId, node, `assets.txt 含该 nodeId 的 [退化告警] 行(渐变/图案字在 RN 退化为纯色,必须留痕)`, 'assets.txt 无该 nodeId 的 [退化告警] 记录', '(assets.txt)', 0, ''));
    }

    // ① 首 stop 色值比对(仅 GRADIENT_* 有 stop;IMAGE 图案字跳过)
    const firstStop = lastVisible.type !== 'IMAGE' ? pickFirstStop(lastVisible) : null;
    if (!firstStop) continue;
    const expected = toRgb(firstStop.color);
    if (!expected) continue;

    const declared = extractColor(product.style, keys);
    if (declared === null) {
      violations.push(mk(nodeId, node, `color 为渐变首 stop 色值 ${fmtRgb(expected)}(退化表:GRADIENT 退化为第一个 stop)`, 'styles 未声明 color', '(style)', 0, ''));
      continue;
    }
    if (declared === 'unparseable') continue; // 动态色值保守跳过,留痕已由 ② 保证
    if (!rgbClose(declared, expected)) {
      violations.push(mk(nodeId, node, `color = 首 stop ${fmtRgb(expected)}`, `color = ${fmtRgb(declared)}(首 stop 之外的臆造纯色)`, '(style)', 0, ''));
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual, file, line, snippet) {
    return { rule: id, nodeId, name: node.name || '(no name)', type: node.type, expected, actual, file, line, snippet };
  }
}

function pickLastVisibleFill(fills) {
  for (let i = fills.length - 1; i >= 0; i--) {
    const f = fills[i];
    if (f && f.visible !== false) return f;
  }
  return null;
}

function pickFirstStop(fill) {
  const stops = fill.gradientStops;
  return Array.isArray(stops) && stops.length ? stops[0] : null;
}

// Figma color {r,g,b,a∈0..1} → [r,g,b]∈0..255
function toRgb(color) {
  if (!color) return null;
  return [
    Math.round((color.r || 0) * 255),
    Math.round((color.g || 0) * 255),
    Math.round((color.b || 0) * 255),
  ];
}

// 从 styles 取 color 声明,归一化为 [r,g,b];支持 '#hex' 与 'rgba(r,g,b,a)' 字符串。
// 返回 [r,g,b] | null(未声明) | 'unparseable'(动态/无法归一)
function extractColor(styleFiles, keys) {
  let found = null;
  for (const key of keys) {
    for (const s of styleFiles) {
      for (const r of collectRuleBodies(s.content, key)) {
        const m = r.body.match(/(?:^|[,{\s])color\s*:\s*([^,\n}]+)/);
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
  return Array.isArray(a) && Array.isArray(b) && a.every((v, i) => Math.abs(v - b[i]) <= 1);
}

function fmtRgb(c) {
  return Array.isArray(c) ? `rgb(${c.join(',')})` : String(c);
}
