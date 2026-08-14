// R09/R14/R12/R03 单元验证（scratchpad）
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/skills/pp-d2c/bin/rules');
const R09 = await import(`${BASE}/R09-btn-bgc.mjs`);
const R14 = await import(`${BASE}/R14-fixed-z-index.mjs`);
const R12 = await import(`${BASE}/R12-flat-mode-naming.mjs`);
const R03 = await import(`${BASE}/R03-implicit-image.mjs`);

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}
function P(style = [], jsx = []) {
  return { style: style.map((c, i) => ({ rel: `s${i}.scss`, content: c })), jsx: jsx.map((c, i) => ({ rel: `j${i}.tsx`, content: c })), root: '/tmp/nonexist-xyz' };
}
const grad = { type: 'GRADIENT_LINEAR', visible: true };
const solid = { type: 'SOLID', visible: true, color: { r: 0.5, g: 0.2, b: 0 } };

// ---------- R09 ----------
console.log('R09 btn-bgc-取值:');
function r09(nodes, style, classMap) { return R09.check({ cache: { nodes }, product: P(style), classMap }); }
expect('bgc 渐变 + btn 只有 solid bg → 报1',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'RECTANGLE', name: 'bgc-x', fills: [grad] }] } },
    ['.btn { background-color: #864500; }'], { b1: ['btn'] }).length, 1);
expect('bgc 渐变 + btn 有 linear-gradient → 0',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'RECTANGLE', name: 'bgc-x', fills: [grad] }] } },
    ['.btn { background: linear-gradient(180deg,#864500,#6d3600); }'], { b1: ['btn'] }).length, 0);
expect('bgc 渐变 + gradient 写在 bgc class → 0',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'RECTANGLE', name: 'bgc-x', fills: [grad] }] } },
    ['.btn { padding: 4px; }', '.bgcx { background: radial-gradient(#864500,#6d3600); }'], { b1: ['btn'], g1: ['bgcx'] }).length, 0);
expect('bgc 末位 SOLID → 不判(0)',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'RECTANGLE', name: 'bgc-x', fills: [solid] }] } },
    ['.btn { background-color: #864500; }'], { b1: ['btn'] }).length, 0);
expect('btn 无 bgc 子层 → 0',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'TEXT', name: 'label' }] } },
    ['.btn { background-color: #864500; }'], { b1: ['btn'] }).length, 0);
expect('无 classMap → 0(交R21)',
  r09({ b1: { id: 'b1', type: 'FRAME', name: 'btn-buy', children: [{ id: 'g1', type: 'RECTANGLE', name: 'bgc-x', fills: [grad] }] } },
    ['.btn { background-color: #864500; }'], {}).length, 0);

// ---------- R14 ----------
console.log('R14 fixed-z-index:');
function r14(nodes, style, classMap) { return R14.check({ cache: { nodes }, product: P(style), classMap }); }
const f = (id, name) => ({ id, type: 'FRAME', name });
expect('2 个 fixed 都无 z-index → 报1',
  r14({ a: f('a', 'fixed-status'), b: f('b', 'fixed-bar') }, ['.sa { position: fixed; }', '.bar { position: fixed; }'], { a: ['sa'], b: ['bar'] }).length, 1);
expect('2 个 fixed z-index 全相同 → 报1',
  r14({ a: f('a', 'fixed-status'), b: f('b', 'fixed-bar') }, ['.sa { z-index: 1; }', '.bar { z-index: 1; }'], { a: ['sa'], b: ['bar'] }).length, 1);
expect('2 个 fixed z-index 100/90 → 0',
  r14({ a: f('a', 'fixed-status'), b: f('b', 'fixed-bar') }, ['.sa { z-index: 100; }', '.bar { z-index: 90; }'], { a: ['sa'], b: ['bar'] }).length, 0);
expect('单个 fixed → 0',
  r14({ a: f('a', 'fixed-status') }, ['.sa { position: fixed; }'], { a: ['sa'] }).length, 0);
expect('3 个 fixed 部分缺部分有(不全缺不全同) → 0(保守放行)',
  r14({ a: f('a', 'fixed-status'), b: f('b', 'fixed-bar'), c: f('c', 'fixed-btn') }, ['.sa { z-index: 100; }', '.bar { }', '.btn { z-index: 90; }'], { a: ['sa'], b: ['bar'], c: ['btn'] }).length, 0);

// ---------- R12 ----------
console.log('R12 flat-mode-naming:');
function r12(style, config) { return R12.check({ product: P(style), config }); }
expect('flat + .title 定义2次 → 报1',
  r12(['.title { font-size: 32px; }', '.title { font-size: 24px; }'], { merge: { mode: 'flat' } }).length, 1);
expect('flat + .title/.card 各1次 → 0',
  r12(['.title { font-size: 32px; }', '.card { font-size: 24px; }'], { merge: { mode: 'flat' } }).length, 0);
expect('merge.mode 非 flat → 0',
  r12(['.title { a: 1; }', '.title { a: 2; }'], { merge: { mode: 'component' } }).length, 0);
expect('config 无 merge → 0',
  r12(['.title { a: 1; }', '.title { a: 2; }'], {}).length, 0);
expect('flat + .title{} 与 .title:hover{} → 0(:hover 不算重复定义)',
  r12(['.title { a: 1; }\n.title:hover { a: 2; }'], { merge: { mode: 'flat' } }).length, 0);

// ---------- R03 ----------
console.log('R03 implicit-image:');
const V = () => ({ type: 'VECTOR' });
function r03(nodes, style = [], jsx = [], classMap = {}) { return R03.check({ cache: { nodes }, product: P(style, jsx), classMap }); }
expect('无前缀 + 3 个 VECTOR + 无切图 → 报1',
  r03({ g: { id: 'g', type: 'GROUP', name: 'iconWrap', children: [V(), V(), V()] } }).length, 1);
expect('同上但 jsx 引用了 nodeId → 0(已切)',
  r03({ g: { id: 'g:1', type: 'GROUP', name: 'iconWrap', children: [V(), V(), V()] } }, [], ['<img data-node-id="g:1" src="x.png" />']).length, 0);
expect('无前缀 + 只 2 个 VECTOR(<3) → 0',
  r03({ g: { id: 'g', type: 'GROUP', name: 'iconWrap', children: [V(), V()] } }).length, 0);
expect('子树含 TEXT → 0',
  r03({ g: { id: 'g', type: 'GROUP', name: 'box', children: [V(), V(), V(), { type: 'TEXT' }] } }).length, 0);
expect('img- 前缀 → 0(不判)',
  r03({ g: { id: 'g', type: 'GROUP', name: 'img-hero', children: [V(), V(), V()] } }).length, 0);
expect('3 个 RECTANGLE(可 CSS 化,非硬矢量) → 0',
  r03({ g: { id: 'g', type: 'GROUP', name: 'card', children: [{ type: 'RECTANGLE' }, { type: 'RECTANGLE' }, { type: 'RECTANGLE' }] } }).length, 0);
expect('子树含 btn- 子节点 → 0(复合结构)',
  r03({ g: { id: 'g', type: 'GROUP', name: 'box', children: [V(), V(), V(), { type: 'FRAME', name: 'btn-x' }] } }).length, 0);

console.log(`\nBATCH: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
