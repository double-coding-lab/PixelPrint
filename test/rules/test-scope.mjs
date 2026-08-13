// A3 单测: inferBlockRoot(LCA) + pruneToSubtree
import { inferBlockRoot, pruneToSubtree } from '../../templates/skills/pp-d2c/bin/lib/loadCache.mjs';

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✅' : '❌'} ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  if (!ok) fail = 1;
};

// 树: root → sub1 → (a, b→c) ; root → sub2 → d
const nodes = {
  root: { _parentId: null },
  sub1: { _parentId: 'root' },
  a: { _parentId: 'sub1' },
  b: { _parentId: 'sub1' },
  c: { _parentId: 'b' },
  sub2: { _parentId: 'root' },
  d: { _parentId: 'sub2' },
};

// LCA
eq('两叶同 block → sub1', inferBlockRoot(nodes, { a: ['x'], c: ['y'] }), 'sub1');
eq('单节点 → 自身', inferBlockRoot(nodes, { c: ['y'] }), 'c');
eq('跨 block → root', inferBlockRoot(nodes, { a: ['x'], d: ['y'] }), 'root');
eq('classMap 空 → null', inferBlockRoot(nodes, {}), null);
eq('classMap 节点不在 cache → null', inferBlockRoot(nodes, { zzz: ['x'] }), null);

// prune
eq('裁到 sub1', Object.keys(pruneToSubtree(nodes, 'sub1')).sort(), ['a', 'b', 'c', 'sub1']);
eq('裁到 b', Object.keys(pruneToSubtree(nodes, 'b')).sort(), ['b', 'c']);
eq('root 无效 → 原样', Object.keys(pruneToSubtree(nodes, 'nope')).length, 7);
eq('root null → 原样', Object.keys(pruneToSubtree(nodes, null)).length, 7);

console.log(fail ? 'FAIL' : 'ALL PASS');
process.exitCode = fail;
