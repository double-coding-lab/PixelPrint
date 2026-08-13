// v1.2.5 防线加固批单测：GATE-cache-truncation(基座) / R21 反向对账 / R23 size-fidelity
// 事故来源: test29(浅 cache 真空通过 + 幻觉 id)、test28(1×1 锚点欺诈)。
import { findCacheTruncation } from '../../templates/skills/pp-d2c/bin/lib/loadCache.mjs';
import * as R21 from '../../templates/skills/pp-d2c/bin/rules/R21-node-id-coverage.mjs';
import * as R23 from '../../templates/skills/pp-d2c/bin/rules/R23-size-fidelity.mjs';

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}
const P = (style = [], jsx = []) => ({
  style: style.map((c, i) => ({ rel: `s${i}.scss`, content: c })),
  jsx: jsx.map((c, i) => ({ rel: `j${i}.jsx`, content: c })),
  root: '/tmp/nonexist',
});

// ---------- GATE-cache-truncation 基座 ----------
console.log('findCacheTruncation:');
expect('空 GROUP → hard 1',
  findCacheTruncation({ a: { type: 'GROUP', name: 'Group 1', children: [] } }).hard.length, 1);
expect('空 BOOLEAN_OPERATION → hard 1',
  findCacheTruncation({ a: { type: 'BOOLEAN_OPERATION', name: '形状' } }).hard.length, 1);
expect('空 FRAME → 0(可合法为空)',
  findCacheTruncation({ a: { type: 'FRAME', name: 'spacer', children: [] } }).hard.length, 0);
expect('空 INSTANCE → soft 1',
  findCacheTruncation({ a: { type: 'INSTANCE', name: 'icon' } }).soft.length, 1);
expect('GROUP 有 children → 0',
  findCacheTruncation({ a: { type: 'GROUP', name: 'g', children: [{ id: 'x' }] } }).hard.length, 0);
expect('baked 子树空 GROUP → 0(像素已烤进 PNG)',
  findCacheTruncation({ a: { type: 'GROUP', name: 'g', children: [], _inBakedSubtree: true } }).hard.length, 0);
expect('hidden 空 GROUP → 0',
  findCacheTruncation({ a: { type: 'GROUP', name: 'g', children: [], _hidden: true } }).hard.length, 0);
expect('bg- 前缀空 GROUP → 0(整体切图目标)',
  findCacheTruncation({ a: { type: 'GROUP', name: 'bg-hero', children: [] } }).hard.length, 0);

// ---------- R21 反向对账 ----------
console.log('R21 反向(幻觉 id):');
// cache 节点用 RECTANGLE(不命中正向 shouldRender),隔离只测反向
const rectCache = { nodes: { 'r:1': { type: 'RECTANGLE', name: 'deco' } } };
expect('产物 id 不在 cache → 报 1(幻觉 id)',
  R21.check({ cache: rectCache, product: P([], ['<div data-node-id="ghost:9" />']) }).length, 1);
expect('产物 id 在 cache → 0',
  R21.check({ cache: rectCache, product: P([], ['<div data-node-id="r:1" />']) }).length, 0);
expect('表达式形式 data-node-id={x} → 不判',
  R21.check({ cache: rectCache, product: P([], ['<div data-node-id={item.nodeId} />']) }).length, 0);
expect('正向仍在: cache TEXT 未挂 id → 报 1',
  R21.check({ cache: { nodes: { t1: { type: 'TEXT', name: 'title' } } }, product: P([], ['<div />']) }).length, 1);

// ---------- R23 size-fidelity ----------
console.log('R23 size-fidelity:');
const scale2 = { unit: { scale: 2 } };
function r23(node, css, classMap = { n1: ['a'] }) {
  return R23.check({ cache: { nodes: { n1: node } }, product: P([css]), config: scale2, classMap });
}
const box = (w, h, type = 'FRAME') => ({ type, name: 'box', absoluteBoundingBox: { x: 0, y: 0, width: w, height: h } });

expect('宽高与 bbox×2 一致 → 0',
  r23(box(100, 50), '.a { width: 200px; height: 100px; }').length, 0);
expect('宽偏差 > 4px → 报 1',
  r23(box(100, 50), '.a { width: 150px; height: 100px; }').length, 1);
expect('test28 锚点欺诈: 1×1+overflow:hidden vs 331.5×141 → 报 1',
  r23(box(331.5, 141), '.a { width: 1px; height: 1px; overflow: hidden; }').length, 1);
expect('锚点欺诈 message 点名',
  r23(box(331.5, 141), '.a { width: 1px; height: 1px; overflow: hidden; }')[0].actual.includes('锚点欺诈'), true);
expect('未声明宽高(HUG/布局驱动) → 0',
  r23(box(100, 50), '.a { display: flex; }').length, 0);
expect('width:100%(非 px) → 0',
  r23(box(100, 50), '.a { width: 100%; }').length, 0);
expect('TEXT 节点 → 不判',
  r23(box(100, 50, 'TEXT'), '.a { width: 10px; height: 10px; }').length, 0);
expect('有 padding 无 border-box → 盒模型不确定跳过',
  r23(box(100, 50), '.a { width: 150px; padding: 10px; }').length, 0);
expect('有 padding 且 border-box → 照判(报 1)',
  r23(box(100, 50), '.a { width: 150px; padding: 10px; box-sizing: border-box; }').length, 1);
expect('无 className → 0',
  r23(box(100, 50), '.a { width: 1px; }', {}).length, 0);
expect('容差内(±4px) → 0',
  r23(box(100, 50), '.a { width: 203px; height: 98px; }').length, 0);

console.log(`\nV125: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
