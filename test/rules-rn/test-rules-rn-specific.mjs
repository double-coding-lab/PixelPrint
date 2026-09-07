// RN 特有规则与退化校验单测:RN01 骨架、RN02 顺流子(含三豁免)、RN03 %-塌陷、
// RN04 styles 分离、R04/R09 退化留痕(assets.txt [退化告警] 行,载体已拍板)。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as R04 from '../../templates/skills/pp-d2c-rn/bin/rules/R04-text-gradient.mjs';
import * as R09 from '../../templates/skills/pp-d2c-rn/bin/rules/R09-btn-bgc.mjs';
import * as RN01 from '../../templates/skills/pp-d2c-rn/bin/rules/RN01-scroll-skeleton.mjs';
import * as RN02 from '../../templates/skills/pp-d2c-rn/bin/rules/RN02-flow-child-position.mjs';
import * as RN03 from '../../templates/skills/pp-d2c-rn/bin/rules/RN03-no-percent-fill.mjs';
import * as RN04 from '../../templates/skills/pp-d2c-rn/bin/rules/RN04-styles-file-separation.mjs';

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}

const CONFIG = { unit: { scale: 1, responsive: { enabled: true, helperName: 'rpx' } }, adapter: { enabled: false } };
const S = (obj) => [{ rel: 'styles.ts', content: `const styles = StyleSheet.create(${obj});` }];
const P = (styles, jsx, root = '/tmp/nonexist-rn') => ({
  style: S(styles), jsx: jsx.map((c, i) => ({ rel: `j${i}.tsx`, content: c })), root,
});

// ---------- RN01 scroll-skeleton ----------
console.log('RN01 scroll-skeleton:');
const skeletonJsx = '<View data-node-id="1:0" style={styles.root}><ScrollView style={styles.scroll}><View style={styles.scrollContent} /></ScrollView></View>';
function rn01(styles, jsx, mode) { return RN01.check({ product: P(styles, [jsx]), config: CONFIG, mode }); }
const errOnly = (hits) => hits.filter((h) => h.severity !== 'warning');
expect('--merge 合规骨架 → 0', errOnly(rn01("{ root: { flex: 1 }, scroll: {}, scrollContent: { minHeight: rpx(1579) } }", skeletonJsx, 'merge')).length, 0);
expect('--merge 无 ScrollView → 违规(硬错①)', errOnly(rn01('{ root: {} }', '<View style={styles.root} />', 'merge')).length, 1);
expect('--merge scrollContent 写死 height → 违规(硬错②)', errOnly(rn01("{ root: {}, scrollContent: { height: rpx(1579) } }", skeletonJsx, 'merge')).length, 1);
expect("--merge scrollContent overflow:'hidden' → 违规(硬错③)", errOnly(rn01("{ root: {}, scrollContent: { minHeight: rpx(10), overflow: 'hidden' } }", skeletonJsx, 'merge')).length, 1);
expect("--merge root overflow:'hidden' → 违规(硬错④)", errOnly(rn01("{ root: { overflow: 'hidden' }, scrollContent: { minHeight: rpx(10) } }", skeletonJsx, 'merge')).length, 1);
expect('--merge scrollContent key 缺失 → 降 warning 不阻断', rn01('{ root: {} }', skeletonJsx, 'merge').some((h) => h.severity === 'warning'), true);
expect('--block 反向: block 产物套骨架 → 违规', errOnly(rn01("{ scrollContent: { minHeight: rpx(10) } }", skeletonJsx, 'block')).length, 1);
expect('--block 普通 scrollx- ScrollView(styleKey 非 scrollContent)不误伤 → 0', errOnly(rn01('{ list: {} }', '<ScrollView horizontal style={styles.list} />', 'block')).length, 0);

// ---------- RN02 flow-child-position ----------
console.log('RN02 flow-child-position(三豁免):');
function rn02(child, styles, cm) {
  const parent = { type: 'FRAME', name: 'col', layoutMode: 'VERTICAL', children: [child] };
  return RN02.check({ cache: { nodes: { 'p:1': parent, [child.id]: child } }, product: P(styles, ['<View />']), config: CONFIG, classMap: cm });
}
const flowChild = { id: 'c:1', type: 'FRAME', name: 'card' };
const CM1 = { 'c:1': ['a'] };
expect('顺流子写 marginTop → 违规', rn02(flowChild, '{ a: { marginTop: rpx(24) } }', CM1).length, 1);
expect('顺流子写 position/top → 违规(计 2 条:position+top)', rn02(flowChild, "{ a: { position: 'absolute', top: rpx(10) } }", CM1).length, 2);
expect('豁免①: 显式 0 值 margin 放行 → 0', rn02(flowChild, '{ a: { marginTop: 0 } }', CM1).length, 0);
expect('豁免②: bg- 前缀子不按顺流子判 → 0', rn02({ id: 'c:2', type: 'RECTANGLE', name: 'bg-card' }, "{ b: { position: 'absolute', top: 0 } }", { 'c:2': ['b'] }).length, 0);
expect('豁免③: 子自身 autolayout 容器,padding 让位 R19 → 0', rn02({ id: 'c:3', type: 'FRAME', name: 'inner', layoutMode: 'VERTICAL' }, '{ c: { paddingTop: rpx(12) } }', { 'c:3': ['c'] }).length, 0);
expect('非容器子凭空 paddingTop → 违规(cache 无同名字段)', rn02(flowChild, '{ a: { paddingTop: rpx(12) } }', CM1).length, 1);
expect('padding 溯源 cache 同名字段 → 0(数值精度归 R19)', rn02({ ...flowChild, paddingTop: 12 }, '{ a: { paddingTop: rpx(99) } }', CM1).length, 0);
expect('flex:1 无 FILL 依据 → 违规', rn02(flowChild, '{ a: { flex: 1 } }', CM1).length, 1);
expect('flex:1 有 layoutGrow=1 → 0', rn02({ ...flowChild, layoutGrow: 1 }, '{ a: { flex: 1 } }', CM1).length, 0);
expect('fixed- 前缀子豁免(归 R01)→ 0', rn02({ id: 'c:4', type: 'FRAME', name: 'fixed-btn' }, "{ d: { position: 'absolute' } }", { 'c:4': ['d'] }).length, 0);

// ---------- RN03 no-percent-fill ----------
console.log('RN03 no-percent-fill:');
const bgNode = { type: 'RECTANGLE', name: 'bg-body' };
function rn03(styles) { return RN03.check({ cache: { nodes: { 'n:1': bgNode } }, product: P(styles, ['<View />']), classMap: { 'n:1': ['a'] } }); }
expect("width: '100%' → 违规", rn03("{ a: { width: '100%' } }").length, 1);
expect('absoluteFillObject → 违规', rn03('{ a: { ...StyleSheet.absoluteFillObject } }').length, 1);
expect('Figma 事实尺寸(rpx 数值)→ 0', rn03("{ a: { position: 'absolute', top: 0, left: 0, width: rpx(375), height: rpx(1579) } }").length, 0);

// ---------- RN04 styles-file-separation ----------
console.log('RN04 styles-file-separation:');
function rn04(jsxContent) { return RN04.check({ product: { jsx: [{ rel: 'index.tsx', content: jsxContent }], style: [], root: '/tmp/x' } }); }
expect('jsx 内 StyleSheet.create → 违规', rn04('const styles = StyleSheet.create({ a: {} });').length, 1);
expect('静态 inline style={{...}} → 违规', rn04('<View style={{ width: 10 }} />').length, 1);
expect('style={[styles.a, 动态变量]} 数组形态放行 → 0', rn04('<View style={[styles.a, animatedStyle]} />').length, 0);
expect('正常绑定 → 0', rn04('<View style={styles.a} />').length, 0);

// ---------- R04 / R09 退化留痕(assets.txt 载体) ----------
console.log('R04/R09 退化留痕:');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-degrade-'));
fs.writeFileSync(path.join(tmp, 'assets.txt'), '切图溯源...\n[退化告警] n:1 GRADIENT_LINEAR → 纯色 #ff0000(接 react-native-linear-gradient 可还原)\n[退化告警] g:1 bgc 渐变 → 纯色\n');

const gradText = {
  type: 'TEXT', name: 'title',
  fills: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ color: { r: 1, g: 0, b: 0, a: 1 } }, { color: { r: 0, g: 0, b: 1, a: 1 } }] }],
};
function r04(styles, root) {
  return R04.check({ cache: { nodes: { 'n:1': gradText } }, product: P(styles, ['<Text />'], root), classMap: { 'n:1': ['a'] } });
}
expect('无 assets.txt(缺退化告警行)→ 违规', r04("{ a: { color: '#ff0000' } }", '/tmp/nonexist-rn').length, 1);
expect('告警行齐 + color=首 stop → 0', r04("{ a: { color: '#ff0000' } }", tmp).length, 0);
expect('告警行齐但臆造纯色 → 违规', r04("{ a: { color: '#00ff00' } }", tmp).length, 1);

const btnCache = {
  nodes: {
    'b:1': {
      type: 'FRAME', name: 'btn-go',
      children: [{ id: 'g:1', type: 'RECTANGLE', name: 'bgc-grad', fills: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ color: { r: 1, g: 0, b: 0, a: 1 } }] }] }],
    },
  },
};
function r09(styles, jsx, root) {
  return R09.check({ cache: btnCache, product: P(styles, [jsx], root), classMap: { 'b:1': ['btn'] } });
}
expect('LinearGradient 路径(import+标签)→ 0', r09('{ btn: {} }', "import LinearGradient from 'react-native-linear-gradient';\n<LinearGradient colors={c} />", '/tmp/nonexist-rn').length, 0);
expect('退化路径: 首 stop backgroundColor + 告警行 → 0', r09("{ btn: { backgroundColor: '#ff0000' } }", '<Pressable />', tmp).length, 0);
expect('两路皆无(无 backgroundColor 无告警)→ 违规', r09('{ btn: { borderRadius: 8 } }', '<Pressable />', '/tmp/nonexist-rn').length, 1);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nRN-SPECIFIC: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
