// v1.2.6 bl-/list- 前缀回归:R24 baseline-align、R20 bl- 豁免、loadCache list- 显式 _templateDup
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as R24 from '../../templates/skills/pp-d2c/bin/rules/R24-baseline-align.mjs';
import * as R20 from '../../templates/skills/pp-d2c/bin/rules/R20-absolute-position.mjs';
import { loadCache } from '../../templates/skills/pp-d2c/bin/lib/loadCache.mjs';

const scale2 = { unit: { scale: 2 } };
let pass = 0, fail = 0;
function expect(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

const blNode = { id: 'B', type: 'FRAME', name: 'bl-price', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 } };

function r24(css, classMap = { B: ['bl-price'] }, nodes = { B: blNode }) {
  return R24.check({ cache: { nodes }, product: { style: [{ file: 'index.scss', content: css }], jsx: [] }, config: scale2, classMap });
}

console.log('R24 baseline-align:');
expect('缺 align-items → violation', r24('.bl-price { display: flex; }').some((h) => !h.severity));
expect('center 冒充 → violation', r24('.bl-price { display: flex; align-items: center; }').some((h) => !h.severity));
expect('baseline + flex → 通过', r24('.bl-price { display: flex; align-items: baseline; }').length === 0);
const warnHits = r24('.bl-price { align-items: baseline; }');
expect('baseline 无 display:flex → 仅 warning', warnHits.length === 1 && warnHits[0].severity === 'warning');
expect('无 className → skip(R21 兜底)', r24('.other {}', {}).length === 0);
expect('非 bl- 节点不触发', R24.check({ cache: { nodes: { P: { id: 'P', name: 'price', type: 'FRAME' } } }, product: { style: [{ file: 'a.scss', content: '.price{}' }], jsx: [] }, config: scale2, classMap: { P: ['price'] } }).length === 0);

console.log('R20 bl- 豁免:');
const blParent = { id: 'B', type: 'FRAME', name: 'bl-price', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 } };
const plainParent = { id: 'P', type: 'FRAME', name: 'row', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 } };
const absText = (pid) => ({ id: 'T', type: 'TEXT', name: 'amount', layoutPositioning: 'ABSOLUTE', _parentId: pid, absoluteBoundingBox: { x: 10, y: 5, width: 50, height: 30 } });
const cssNoPos = '.amount { font-size: 40px; }';
expect('bl- 父的 ABSOLUTE 子 → 豁免', R20.check({ cache: { nodes: { B: blParent, T: absText('B') } }, product: { style: [{ file: 'a.scss', content: cssNoPos }], jsx: [] }, config: scale2, classMap: { T: ['amount'] } }).length === 0);
expect('普通父的 ABSOLUTE 子 → 仍拦(对照)', R20.check({ cache: { nodes: { P: plainParent, T: absText('P') } }, product: { style: [{ file: 'a.scss', content: cssNoPos }], jsx: [] }, config: scale2, classMap: { T: ['amount'] } }).length === 1);

console.log('loadCache list- 显式 _templateDup:');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-list-'));
const nodesDir = path.join(root, '.d2c-cache', 'k', 'nodes');
fs.mkdirSync(nodesDir, { recursive: true });
fs.writeFileSync(path.join(nodesDir, 'n.json'), JSON.stringify({
  id: '1:0', name: 'page', type: 'FRAME',
  children: [
    { id: '1:1', name: 'list-cards', type: 'FRAME',
      children: [
        { id: '2:1', name: 'card a', type: 'TEXT' },   // 叶子项:sig 推断不覆盖,list- 显式声明覆盖
        { id: '2:2', name: 'card b', type: 'TEXT' },
        { id: '2:3', name: 'card c', type: 'TEXT' },
      ] },
    { id: '1:2', name: 'plain', type: 'FRAME',
      children: [
        { id: '3:1', name: 'x a', type: 'TEXT' },
        { id: '3:2', name: 'x b', type: 'TEXT' },
      ] },
  ],
}));
const cache = loadCache(root, 'k');
expect('list- 首项不标 dup', cache.nodes['2:1']._templateDup === false);
expect('list- 第 2/3 项(叶子)标 dup', cache.nodes['2:2']._templateDup === true && cache.nodes['2:3']._templateDup === true);
expect('无 list- 的叶子兄弟不标(原逻辑不变)', cache.nodes['3:2']._templateDup === false);
fs.rmSync(root, { recursive: true, force: true });

console.log(`\nR24-BL-LIST: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
