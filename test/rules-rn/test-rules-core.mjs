// 移植规则核心单测:R18 方向镜像(与 h5 行为相反,回归价值最高)、R19 padding 对账、
// R20 绝对定位、R23 尺寸忠实度(锚点欺诈 + RN 无盒模型跳过)、R21 反向对账。
import * as R18 from '../../templates/skills/pp-d2c-rn/bin/rules/R18-flex-direction.mjs';
import * as R19 from '../../templates/skills/pp-d2c-rn/bin/rules/R19-padding.mjs';
import * as R20 from '../../templates/skills/pp-d2c-rn/bin/rules/R20-absolute-position.mjs';
import * as R21 from '../../templates/skills/pp-d2c-rn/bin/rules/R21-node-id-coverage.mjs';
import * as R23 from '../../templates/skills/pp-d2c-rn/bin/rules/R23-size-fidelity.mjs';

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}

const CONFIG = { unit: { scale: 1, responsive: { enabled: true, helperName: 'rpx' } } };
const P = (styles, jsx = ['<View data-node-id="n:1" style={styles.a} />']) => ({
  style: [{ rel: 'styles.ts', content: `const styles = StyleSheet.create(${styles});` }],
  jsx: jsx.map((c, i) => ({ rel: `j${i}.tsx`, content: c })),
  root: '/tmp/nonexist-rn',
});
const CM = { 'n:1': ['a'] };

// ---------- R18 方向镜像 ----------
console.log('R18 flex-direction(RN 默认 column,判定与 h5 镜像):');
const vNode = { type: 'FRAME', name: 'col', layoutMode: 'VERTICAL' };
const hNode = { type: 'FRAME', name: 'row', layoutMode: 'HORIZONTAL' };
function r18(node, body) {
  return R18.check({ cache: { nodes: { 'n:1': node } }, product: P(body), config: CONFIG, classMap: CM });
}
expect('VERTICAL 省略 flexDirection → 合法(RN 默认即 column)', r18(vNode, '{ a: { width: 10 } }').length, 0);
expect("VERTICAL 显式 'column' → 合法", r18(vNode, "{ a: { flexDirection: 'column' } }").length, 0);
expect("VERTICAL 写 'row' → 违规", r18(vNode, "{ a: { flexDirection: 'row' } }").length, 1);
expect('HORIZONTAL 缺 flexDirection → 违规(默认 column 会竖排)', r18(hNode, '{ a: { width: 10 } }').length, 1);
expect("HORIZONTAL 'row' → 合法", r18(hNode, "{ a: { flexDirection: 'row' } }").length, 0);
expect("HORIZONTAL 'row-reverse' → 合法(同为横向)", r18(hNode, "{ a: { flexDirection: 'row-reverse' } }").length, 0);
expect('动态方向(三元)→ unparseable 保守跳过', r18(hNode, "{ a: { flexDirection: isRTL ? 'row-reverse' : 'row' } }").length, 0);
expect('无 styleKey → 不报(R21 兜底)', R18.check({ cache: { nodes: { 'n:1': hNode } }, product: P('{ a: {} }'), config: CONFIG, classMap: {} }).length, 0);

// ---------- R19 padding ----------
console.log('R19 padding(rpx 剥壳,期望 = Figma × scale):');
const padNode = { type: 'FRAME', name: 'box', layoutMode: 'VERTICAL', paddingTop: 16, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
function r19(node, body) {
  return R19.check({ cache: { nodes: { 'n:1': node } }, product: P(body), config: CONFIG, classMap: CM });
}
expect('rpx(16) 对上 Figma 16 → 0', r19(padNode, '{ a: { paddingTop: rpx(16) } }').length, 0);
expect('纯数字 16 同样对上 → 0', r19(padNode, '{ a: { paddingTop: 16 } }').length, 0);
expect('20 ≠ 16(容差 2)→ 违规', r19(padNode, '{ a: { paddingTop: rpx(20) } }').length, 1);
expect('容差内 17 → 0', r19(padNode, '{ a: { paddingTop: 17 } }').length, 0);
expect('Figma 无 padding 产物凭空写 → 违规', r19({ type: 'FRAME', name: 'p0', layoutMode: 'VERTICAL' }, '{ a: { paddingTop: rpx(12) } }').length, 1);
expect('动态值 → unparseable 整节点跳过', r19(padNode, '{ a: { paddingTop: Platform.select({ ios: 16, android: 12 }) } }').length, 0);

// ---------- R20 absolute-position ----------
console.log('R20 absolute-position:');
const absCache = {
  nodes: {
    'p:1': { type: 'FRAME', name: 'parent', absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 800 } },
    'n:1': { type: 'FRAME', name: 'badge', layoutPositioning: 'ABSOLUTE', _parentId: 'p:1', absoluteBoundingBox: { x: 100, y: 200, width: 40, height: 40 } },
  },
};
function r20(body) { return R20.check({ cache: absCache, product: P(body), config: CONFIG, classMap: CM }); }
expect("正确 absolute + top/left → 0", r20("{ a: { position: 'absolute', top: rpx(200), left: rpx(100) } }").length, 0);
expect("缺 position: 'absolute' → 违规(v1.2.4 增强移植)", r20('{ a: { top: rpx(200), left: rpx(100) } }').length, 1);
expect('top 数值偏差 > 4 → 违规', r20("{ a: { position: 'absolute', top: rpx(300), left: rpx(100) } }").length, 1);
expect('fixed- 前缀 → 跳过(骨架分层定位,归 R01/RN01)', R20.check({
  cache: { nodes: { 'p:1': absCache.nodes['p:1'], 'n:1': { ...absCache.nodes['n:1'], name: 'fixed-badge' } } },
  product: P('{ a: {} }'), config: CONFIG, classMap: CM,
}).length, 0);

// ---------- R21 反向对账 ----------
console.log('R21 反向对账(幻觉 id):');
const rectCache = { nodes: { 'r:1': { type: 'RECTANGLE', name: 'deco' } } };
const jsxP = (c) => ({ style: [], jsx: [{ rel: 'j.tsx', content: c }], root: '/tmp/nonexist-rn' });
expect('产物 id 不在 cache → 报 1(幻觉 id)', R21.check({ cache: rectCache, product: jsxP('<View data-node-id="ghost:9" />') }).length, 1);
expect('产物 id 在 cache → 0', R21.check({ cache: rectCache, product: jsxP('<View data-node-id="r:1" />') }).length, 0);
expect('正向仍在: cache TEXT 未挂 id → 报 1', R21.check({ cache: { nodes: { t1: { type: 'TEXT', name: 'title' } } }, product: jsxP('<View />') }).length, 1);

// ---------- R23 size-fidelity ----------
console.log('R23 size-fidelity(rpx 剥壳;RN 恒 border-box,无盒模型跳过):');
const box = (w, h, type = 'FRAME') => ({ type, name: 'box', absoluteBoundingBox: { x: 0, y: 0, width: w, height: h } });
function r23(node, body, cm = CM) {
  return R23.check({ cache: { nodes: { 'n:1': node } }, product: P(body), config: CONFIG, classMap: cm });
}
expect('rpx 剥壳后与 bbox 一致 → 0', r23(box(331.5, 141), '{ a: { width: rpx(331.5), height: rpx(141) } }').length, 0);
expect('宽偏差 > 4 → 违规', r23(box(100, 50), '{ a: { width: rpx(150), height: rpx(50) } }').length, 1);
expect("锚点欺诈: 1×1 + overflow:'hidden' vs 331.5×141 → 违规", r23(box(331.5, 141), "{ a: { width: 1, height: 1, overflow: 'hidden' } }").length, 1);
expect('锚点欺诈 message 点名', r23(box(331.5, 141), "{ a: { width: 1, height: 1, overflow: 'hidden' } }")[0].actual.includes('锚点欺诈'), true);
expect("'100%' → unparseable 不判", r23(box(100, 50), "{ a: { width: '100%' } }").length, 0);
expect('未声明宽高(布局驱动)→ 0', r23(box(100, 50), '{ a: { flex: 1 } }').length, 0);
expect('TEXT 节点 → 不判', r23(box(100, 50, 'TEXT'), '{ a: { width: 10, height: 10 } }').length, 0);
expect('有 padding 照判(RN 恒 border-box,h5 的盒模型跳过分支已删)→ 违规', r23(box(100, 50), '{ a: { width: 150, height: 50, padding: 10 } }').length, 1);

console.log(`\nCORE: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
