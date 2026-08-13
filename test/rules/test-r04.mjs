// R04 单元验证（scratchpad，不进 skill 分发）
// 直接 import R04.check() 单元测，构造 fixture cache/product/classMap。
import * as R04 from '../../templates/skills/pp-d2c/bin/rules/R04-text-gradient.mjs';

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${actual}, want ${expected}`); }
}

const gradFill = { type: 'GRADIENT_LINEAR', visible: true };
const imageFill = { type: 'IMAGE', visible: true };
const solidFill = { type: 'SOLID', visible: true, color: { r: 1, g: 1, b: 1 } };

function run(node, style, classMap) {
  return R04.check({
    cache: { nodes: { 'n1': node } },
    product: { style: style.map((c, i) => ({ rel: `s${i}.scss`, content: c })), jsx: [], root: '/tmp' },
    classMap,
  });
}

// case 1: 末位渐变 + CSS 无 background-clip:text → 违规
expect('渐变字用 solid color 冒充 → 报 1',
  run({ type: 'TEXT', name: 'title', fills: [gradFill] }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 1);

// case 2: 末位渐变 + CSS 有 -webkit-background-clip:text → 不报
expect('渐变字走 background-clip:text → 0',
  run({ type: 'TEXT', name: 'title', fills: [gradFill] },
    ['.title { background: linear-gradient(180deg,#fff,#aaa); -webkit-background-clip: text; color: transparent; }'],
    { n1: ['title'] }).length, 0);

// case 3: 末位 IMAGE 图案字 + 无 clip → 报
expect('图案字无 clip → 报 1',
  run({ type: 'TEXT', name: 'title', fills: [imageFill] }, ['.title { color: #333; }'], { n1: ['title'] }).length, 1);

// case 4: 末位 SOLID → R04 不管（归 R06）
expect('末位 SOLID → R04 不报（归 R06）',
  run({ type: 'TEXT', name: 'title', fills: [solidFill] }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 0);

// case 5: 多层 fills 末位 SOLID 覆盖渐变 → R04 不管
expect('渐变在下、SOLID 在末位 → R04 不报',
  run({ type: 'TEXT', name: 'title', fills: [gradFill, solidFill] }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 0);

// case 6: 无 className → R04 不报（交 R21）
expect('无 className → R04 不报（交 R21）',
  run({ type: 'TEXT', name: 'title', fills: [gradFill] }, ['.title { color: #fff; }'], {}).length, 0);

// case 7: baked 子树 TEXT → skip
expect('baked 子树 → skip',
  run({ type: 'TEXT', name: 'title', fills: [gradFill], _inBakedSubtree: true }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 0);

// case 8: hidden → skip
expect('hidden → skip',
  run({ type: 'TEXT', name: 'title', fills: [gradFill], _hidden: true }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 0);

// case 9: 非 TEXT（FRAME 带渐变 fills）→ R04 不管（只管 TEXT）
expect('非 TEXT → R04 不报',
  run({ type: 'FRAME', name: 'box', fills: [gradFill] }, ['.box { color: #fff; }'], { n1: ['box'] }).length, 0);

// case 10: 末位渐变 fill visible:false，前一层 SOLID 可见 → 取 SOLID → R04 不管
expect('末位渐变不可见、前层 SOLID 可见 → R04 不报',
  run({ type: 'TEXT', name: 'title', fills: [solidFill, { type: 'GRADIENT_LINEAR', visible: false }] }, ['.title { color: #fff; }'], { n1: ['title'] }).length, 0);

console.log(`\nR04: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
