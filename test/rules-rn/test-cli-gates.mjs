// CLI 级门禁回归:临时项目夹具跑真实 check-rules.mjs 子进程——
// 合规 --block 全绿、GATE-rule-hits(缺失/捏造/占位无降级)、
// --merge 的 GATE-slice-confirm(confirmed:false)与 IMG-reconcile(引用 ∉ manifest)。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.resolve(here, '../../templates/skills/pp-d2c-rn/bin/check-rules.mjs');

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}

function run(args) {
  try {
    const out = execFileSync(process.execPath, [CHECK, ...args], { encoding: 'utf8' });
    return { code: 0, report: JSON.parse(out) };
  } catch (e) {
    let report = null;
    try { report = JSON.parse(e.stdout || 'null'); } catch { /* env error 无 JSON */ }
    return { code: e.status, report, stderr: String(e.stderr || '') };
  }
}
const failedRules = (r) => (r && r.report ? r.report.failed : []);

// ── 夹具:临时项目根 ─────────────────────────────────────────────
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-cli-'));
fs.writeFileSync(path.join(root, 'pp-d2c.config.json'), JSON.stringify({
  project: { framework: 'rn', styleFormat: 'stylesheet' },
  merge: { mode: 'flat' },
  unit: { figmaBase: 375, outputBase: 375, scale: 1, responsive: { enabled: true, helperName: 'rpx' } },
  adapter: { enabled: false },
}));
const nodesDir = path.join(root, '.d2c-cache', 'testkey', 'nodes');
fs.mkdirSync(nodesDir, { recursive: true });
fs.writeFileSync(path.join(nodesDir, '10-1.json'), JSON.stringify({
  id: '10:1', name: 'sub-hero', type: 'FRAME', layoutMode: 'VERTICAL',
  paddingTop: 16, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
  absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 200 },
  children: [{
    id: '10:2', name: 'title', type: 'TEXT',
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }],
    absoluteBoundingBox: { x: 16, y: 16, width: 100, height: 20 },
  }],
}));

const STYLES = `import { StyleSheet } from 'react-native';
import { rpx } from '@/utils/rpx';
const styles = StyleSheet.create({
  hero: { width: rpx(375), paddingTop: rpx(16) },
  title: { color: '#333333', fontSize: rpx(14) },
});
export default styles;
`;
const JSX_BLOCK = `import { View, Text } from 'react-native';
import styles from './styles';
export default function Hero() {
  return (
    <View data-node-id="10:1" style={styles.hero}>
      <Text data-node-id="10:2" style={styles.title}>标题</Text>
    </View>
  );
}
`;
function mkBlock(name, { ruleHits = '{"generated_by":"rule-scan v1","hits":[]}', assets = '切图溯源:无切图\n' } = {}) {
  const dir = path.join(root, 'blocks', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.tsx'), JSX_BLOCK);
  fs.writeFileSync(path.join(dir, 'styles.ts'), STYLES);
  if (ruleHits != null) fs.writeFileSync(path.join(dir, 'rule-hits.json'), ruleHits);
  if (assets != null) fs.writeFileSync(path.join(dir, 'assets.txt'), assets);
  return dir;
}

// ── 1. 合规 --block 全绿 ─────────────────────────────────────────
console.log('合规 --block:');
const okDir = mkBlock('ok');
const okRun = run(['--block', okDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('exit 0', okRun.code, 0);
expect('ok:true', okRun.report && okRun.report.ok, true);
expect('violations 空', okRun.report && okRun.report.violations.length, 0);

// ── 2. GATE-rule-hits ────────────────────────────────────────────
console.log('GATE-rule-hits:');
const missDir = mkBlock('miss', { ruleHits: null });
const missRun = run(['--block', missDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('缺失 rule-hits.json → exit 1', missRun.code, 1);
expect('failed 含 GATE-rule-hits', failedRules(missRun).includes('GATE-rule-hits'), true);

const fabDir = mkBlock('fab', { ruleHits: null, assets: '切图溯源:无\nrule-hits 消费证明:已按 §3.5 消费\n' });
const fabRun = run(['--block', fabDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('捏造检测: assets 有消费证明但文件缺失 → 违规点名"疑似捏造"',
  fabRun.report && fabRun.report.violations.some((v) => v.rule === 'GATE-rule-hits' && v.actual.includes('疑似捏造')), true);

const fbDir = mkBlock('fb', { ruleHits: '{"generated_by":"v0.3.21-fallback","hits":[]}' });
const fbRun = run(['--block', fbDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('fallback 占位无 [Rule-Scan 降级] 记录 → exit 1(v1.2.5 收紧)', fbRun.code, 1);

const fbOkDir = mkBlock('fbok', { ruleHits: '{"generated_by":"v0.3.21-fallback","hits":[]}', assets: '[Rule-Scan 降级] 二次派发失败,已降级 UI 侧自读规则库\n' });
const fbOkRun = run(['--block', fbOkDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('fallback 占位 + 降级记录互证 → exit 0', fbOkRun.code, 0);

// ── 3. --merge: GATE-slice-confirm + IMG-reconcile ───────────────
console.log('--merge 门禁:');
const pageDir = path.join(root, 'pages', 'home');
fs.mkdirSync(pageDir, { recursive: true });
fs.writeFileSync(path.join(pageDir, 'index.tsx'), `import { View, Text, ScrollView, Image } from 'react-native';
import styles from './styles';
export default function Home() {
  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View data-node-id="10:1" style={styles.scrollContent}>
          <Image source={require('./assets/hero.png')} style={styles.bgBody} />
          <Image source={require('./assets/ghost.png')} style={styles.ghost} />
          <Text data-node-id="10:2" style={styles.title}>标题</Text>
        </View>
      </ScrollView>
    </View>
  );
}
`);
fs.writeFileSync(path.join(pageDir, 'styles.ts'), `import { StyleSheet } from 'react-native';
import { rpx } from '@/utils/rpx';
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {},
  scrollContent: { width: rpx(375), minHeight: rpx(200), paddingTop: rpx(16) },
  bgBody: { position: 'absolute', top: 0, left: 0, width: rpx(375), height: rpx(200) },
  ghost: { width: rpx(10), height: rpx(10) },
  title: { color: '#333333' },
});
export default styles;
`);
fs.writeFileSync(path.join(pageDir, 'rule-hits.json'), '{"generated_by":"rule-scan v1","hits":[]}');
fs.writeFileSync(path.join(pageDir, 'assets.txt'), '切图溯源:hero.png\n');
fs.writeFileSync(path.join(root, '.d2c-cache', 'testkey', 'slice-manifest-home.json'), JSON.stringify({
  themes: [{ slug: 'home', confirmed: false, entries: [{ filename: 'hero.png' }] }],
}));

const mergeRun = run(['--merge', pageDir, '--cache-key', 'testkey']);
expect('confirmed:false + 幽灵引用 → exit 1', mergeRun.code, 1);
expect('failed 含 GATE-slice-confirm', failedRules(mergeRun).includes('GATE-slice-confirm'), true);
expect('failed 含 IMG-reconcile(ghost.png ∉ manifest)',
  mergeRun.report && mergeRun.report.violations.some((v) => v.rule === 'IMG-reconcile' && v.name === 'ghost.png'), true);

// confirmed 翻 true + 移除幽灵引用 → 全绿
fs.writeFileSync(path.join(root, '.d2c-cache', 'testkey', 'slice-manifest-home.json'), JSON.stringify({
  themes: [{ slug: 'home', confirmed: true, entries: [{ filename: 'hero.png' }] }],
}));
let jsx = fs.readFileSync(path.join(pageDir, 'index.tsx'), 'utf8');
fs.writeFileSync(path.join(pageDir, 'index.tsx'), jsx.replace(/^.*ghost\.png.*\n/m, ''));
const mergeOk = run(['--merge', pageDir, '--cache-key', 'testkey']);
expect('confirm-slices 翻 true 后 → exit 0', mergeOk.code, 0);

// ── 4. rn 收紧: config 缺 unit → exit 2 ──────────────────────────
console.log('config 缺 unit:');
fs.writeFileSync(path.join(root, 'pp-d2c.config.json'), JSON.stringify({ project: { framework: 'rn' } }));
const noUnit = run(['--block', okDir, '--cache-key', 'testkey', '--root', '10:1']);
expect('exit 2(环境错误,禁止兜底默认 scale)', noUnit.code, 2);

fs.rmSync(root, { recursive: true, force: true });
console.log(`\nCLI-GATES: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
