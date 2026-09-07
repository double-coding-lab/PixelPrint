// v1.1.1 bl-/list- 前缀回归(rn):R24 baseline-align、R20/RN02 bl- 豁免、
// IMG-reconcile 共享条目(sharedFrom)不误报 + 幽灵引用仍报
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R24 from '../../templates/skills/pp-d2c-rn/bin/rules/R24-baseline-align.mjs';
import * as R20 from '../../templates/skills/pp-d2c-rn/bin/rules/R20-absolute-position.mjs';
import * as RN02 from '../../templates/skills/pp-d2c-rn/bin/rules/RN02-flow-child-position.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.resolve(here, '../../templates/skills/pp-d2c-rn/bin/check-rules.mjs');
const CONF = { unit: { figmaBase: 375, outputBase: 375, scale: 1, responsive: { enabled: true, helperName: 'rpx' } } };

let pass = 0, fail = 0;
function expect(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}
const styleFiles = (content) => [{ file: 'styles.ts', content }];

console.log('R24 baseline-align(rn):');
const blNode = { id: 'B', type: 'FRAME', name: 'bl-price', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 } };
function r24(css, classMap = { B: ['blPrice'] }) {
  return R24.check({ cache: { nodes: { B: blNode } }, product: { style: styleFiles(css), jsx: [] }, config: CONF, classMap });
}
expect('缺 alignItems → violation', r24("const styles = StyleSheet.create({ blPrice: { flexDirection: 'row' } });").some((h) => !h.severity));
expect("center 冒充 → violation", r24("const styles = StyleSheet.create({ blPrice: { flexDirection: 'row', alignItems: 'center' } });").some((h) => !h.severity));
expect('baseline + row → 通过', r24("const styles = StyleSheet.create({ blPrice: { flexDirection: 'row', alignItems: 'baseline' } });").length === 0);
const w = r24("const styles = StyleSheet.create({ blPrice: { alignItems: 'baseline' } });");
expect('baseline 缺 row → 仅 warning', w.length === 1 && w[0].severity === 'warning');

console.log('R20/RN02 bl- 豁免(rn):');
const blParent = { id: 'B', type: 'FRAME', name: 'bl-price', layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 } };
const absText = { id: 'T', type: 'TEXT', name: 'amount', layoutPositioning: 'ABSOLUTE', _parentId: 'B', absoluteBoundingBox: { x: 10, y: 5, width: 50, height: 30 } };
expect('R20: bl- 父的 ABSOLUTE 子豁免', R20.check({ cache: { nodes: { B: blParent, T: absText } }, product: { style: styleFiles('const styles = StyleSheet.create({ amount: { fontSize: rpx(40) } });'), jsx: [] }, config: CONF, classMap: { T: ['amount'] } }).length === 0);
const flowChild = { id: 'F', type: 'TEXT', name: 'unit', absoluteBoundingBox: { x: 60, y: 10, width: 30, height: 20 } };
const blFlow = { ...blParent, children: [flowChild] };
const plainFlow = { id: 'P', type: 'FRAME', name: 'row', layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 }, children: [flowChild] };
const cssMargin = 'const styles = StyleSheet.create({ unit: { marginTop: rpx(10) } });';
expect('RN02: bl- 父的顺流子(带 marginTop)豁免', RN02.check({ cache: { nodes: { B: blFlow, F: flowChild } }, product: { style: styleFiles(cssMargin), jsx: [] }, config: CONF, classMap: { F: ['unit'] } }).length === 0);
expect('RN02: 普通父的顺流子(带 marginTop)仍拦(对照)', RN02.check({ cache: { nodes: { P: plainFlow, F: flowChild } }, product: { style: styleFiles(cssMargin), jsx: [] }, config: CONF, classMap: { F: ['unit'] } }).length >= 1);

console.log('IMG-reconcile 共享条目(CLI --merge):');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-bl-list-'));
fs.writeFileSync(path.join(root, 'pp-d2c.config.json'), JSON.stringify({
  project: { framework: 'rn', styleFormat: 'stylesheet' },
  merge: { mode: 'flat' },
  unit: CONF.unit,
  adapter: { enabled: false },
}));
const nodesDir = path.join(root, '.d2c-cache', 'k', 'nodes');
fs.mkdirSync(nodesDir, { recursive: true });
fs.writeFileSync(path.join(nodesDir, 'n.json'), JSON.stringify({
  id: '10:1', name: 'sub-hero', type: 'FRAME', layoutMode: 'VERTICAL',
  absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 200 },
  children: [{
    id: '10:2', name: 'title', type: 'TEXT',
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }],
    absoluteBoundingBox: { x: 16, y: 16, width: 100, height: 20 },
  }],
}));
const pageDir = path.join(root, 'pages', 'home');
fs.mkdirSync(pageDir, { recursive: true });
function writePage(extraImg) {
  fs.writeFileSync(path.join(pageDir, 'index.tsx'), `import { View, Text, ScrollView, Image } from 'react-native';
import styles from './styles';
export default function Home() {
  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View data-node-id="10:1" style={styles.scrollContent}>
          <Image source={require('./assets/card-bg.png')} style={styles.cardBg} />
${extraImg}
          <Text data-node-id="10:2" style={styles.title}>标题</Text>
        </View>
      </ScrollView>
    </View>
  );
}
`);
}
writePage('');
fs.writeFileSync(path.join(pageDir, 'styles.ts'), `import { StyleSheet } from 'react-native';
import { rpx } from '@/utils/rpx';
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {},
  scrollContent: { width: rpx(375), minHeight: rpx(200) },
  cardBg: { position: 'absolute', top: 0, left: 0, width: rpx(375), height: rpx(200) },
  title: { color: '#333333' },
});
export default styles;
`);
fs.writeFileSync(path.join(pageDir, 'rule-hits.json'), '{"generated_by":"rule-scan v1","hits":[]}');
fs.writeFileSync(path.join(pageDir, 'assets.txt'), '切图溯源:card-bg.png(list- 共享,sharedFrom=20:1)\n');
// list- 去重后的 manifest:两条同 filename,第二条 sharedFrom 指向首项
fs.writeFileSync(path.join(root, '.d2c-cache', 'k', 'slice-manifest-home.json'), JSON.stringify({
  themes: [{ slug: 'home', confirmed: true, entries: [
    { nodeId: '20:1', filename: 'card-bg.png' },
    { nodeId: '20:2', filename: 'card-bg.png', sharedFrom: '20:1' },
  ] }],
}));
function run(args) {
  try {
    const out = execFileSync(process.execPath, [CHECK, ...args], { encoding: 'utf8' });
    return { code: 0, report: JSON.parse(out) };
  } catch (e) {
    let report = null;
    try { report = JSON.parse(e.stdout || 'null'); } catch { /* ignore */ }
    return { code: e.status, report };
  }
}
const okRun = run(['--merge', pageDir, '--cache-key', 'k']);
expect('共享条目被单次引用 → exit 0(不误报)', okRun.code === 0);
expect('无 card-bg.png 的 unused warning', !(okRun.report && (okRun.report.warnings || []).some((x) => String(x.reason || '').includes('card-bg.png'))));
writePage("          <Image source={require('./assets/ghost.png')} style={styles.cardBg} />");
const ghostRun = run(['--merge', pageDir, '--cache-key', 'k']);
expect('幽灵引用仍拦(ghost.png ∉ manifest)', ghostRun.code === 1 && ghostRun.report.violations.some((v) => v.rule === 'IMG-reconcile'));
fs.rmSync(root, { recursive: true, force: true });

console.log(`\nR24-BL-LIST(rn): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
