// R20 v1.2.4 增强单测：position: absolute 声明强制
import * as R20 from '../../templates/skills/pp-d2c/bin/rules/R20-absolute-position.mjs';

const scale2 = { unit: { scale: 2 } };

function mkCase(name, { nodes, css, classMap, expectRules }) {
  const cache = { nodes };
  const product = { style: [{ file: 'index.scss', content: css }], jsx: [] };
  const violations = R20.check({ cache, product, config: scale2, classMap });
  const got = violations.map((v) => v.nodeId).sort();
  const want = expectRules.sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✅' : '❌'} ${name}  got=[${got}] want=[${want}]`);
  if (!ok) { console.log(JSON.stringify(violations, null, 1)); process.exitCode = 1; }
}

const parent = { id: 'P', type: 'FRAME', name: 'wrap', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 } };
function absNode(id, x, y) {
  return { id, type: 'GROUP', name: 'Group ' + id, layoutPositioning: 'ABSOLUTE', _parentId: 'P', absoluteBoundingBox: { x, y, width: 10, height: 10 } };
}

// 1. 正确产物: position:absolute + 正确 top/left → 通过
mkCase('abs+正确坐标 通过', {
  nodes: { P: parent, A: absNode('A', 5, 10) },
  css: '.a { position: absolute; left: 10px; top: 20px; }',
  classMap: { A: ['a'] },
  expectRules: [],
});

// 2. test27 回归: exp≈0 无 top/left,但 position:relative → 违规(缺 position:absolute)
mkCase('test27 回归: relative 被拦', {
  nodes: { P: parent, A: absNode('A', 0, 0) },
  css: '.a { position: relative; width: 663px; height: 282px; }',
  classMap: { A: ['a'] },
  expectRules: ['A'],
});

// 3. exp≈0 且声明了 position:absolute,无 top/left → 通过(容忍不报保留)
mkCase('exp≈0 + absolute 无数值 通过', {
  nodes: { P: parent, A: absNode('A', 0, 0) },
  css: '.a { position: absolute; width: 10px; }',
  classMap: { A: ['a'] },
  expectRules: [],
});

// 4. position 声明在同类第二条规则体 → 通过(anyBodyHas 跨规则体)
mkCase('position 在第二规则体 通过', {
  nodes: { P: parent, A: absNode('A', 0, 0) },
  css: '.a { width: 10px; }\n.a { position: absolute; }',
  classMap: { A: ['a'] },
  expectRules: [],
});

// 5. 既有行为保留: absolute 声明了但坐标错 → 违规
mkCase('坐标错仍拦(既有行为)', {
  nodes: { P: parent, A: absNode('A', 5, 10) },
  css: '.a { position: absolute; left: 40px; top: 40px; }',
  classMap: { A: ['a'] },
  expectRules: ['A'],
});

// 6. 非 ABSOLUTE 节点 relative → 不管
mkCase('非 ABSOLUTE 不判', {
  nodes: { P: parent, A: { ...absNode('A', 0, 0), layoutPositioning: undefined } },
  css: '.a { position: relative; }',
  classMap: { A: ['a'] },
  expectRules: [],
});

// 7. 无 className → 跳过(交 R21)
mkCase('无 className 跳过', {
  nodes: { P: parent, A: absNode('A', 0, 0) },
  css: '.a { position: relative; }',
  classMap: {},
  expectRules: [],
});

console.log(process.exitCode ? 'FAIL' : 'ALL PASS');
