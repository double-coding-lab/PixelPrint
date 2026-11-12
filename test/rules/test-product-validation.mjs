// 回归: baked SPACE_BETWEEN、flat merge 子稿、整体 img padding，以及 R23 不退化。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCache } from '../../templates/skills/pp-d2c/bin/lib/loadCache.mjs';
import { loadProduct } from '../../templates/skills/pp-d2c/bin/lib/loadProduct.mjs';
import { buildNodeIdToClassName } from '../../templates/skills/pp-d2c/bin/lib/nodeIdToClassName.mjs';
import * as R05 from '../../templates/skills/pp-d2c/bin/rules/R05-space-between.mjs';
import * as R12 from '../../templates/skills/pp-d2c/bin/rules/R12-flat-mode-naming.mjs';
import * as R17 from '../../templates/skills/pp-d2c/bin/rules/R17-no-baked-dom.mjs';
import * as R19 from '../../templates/skills/pp-d2c/bin/rules/R19-padding.mjs';
import * as R23 from '../../templates/skills/pp-d2c/bin/rules/R23-size-fidelity.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-validation-'));
const config = { merge: { mode: 'flat' }, unit: { scale: 2 } };
let failed = 0;
function test(name, run) {
  try { run(); console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function context(node, jsx, css) {
  const product = { jsx: [{ rel: 'index.tsx', content: jsx }], style: [{ rel: 'index.scss', content: css }] };
  return { cache: { nodes: { '1:1': node } }, product, config, classMap: buildNodeIdToClassName(product.jsx) };
}

try {
  test('R05 使用真实 cache 标记排除 baked/hidden/templateDup；R17 仍拦截 baked DOM', () => {
    const space = (id, extra = {}) => ({ id, name: id, type: 'FRAME', primaryAxisAlignItems: 'SPACE_BETWEEN', ...extra });
    write('.d2c-cache/key/nodes/root.json', JSON.stringify({
      id: 'root', type: 'FRAME', children: [
        { id: 'img', type: 'FRAME', name: 'img-hero', children: [space('baked')] },
        space('hidden', { visible: false }),
        { id: 'list', type: 'FRAME', name: 'list-items', children: [space('first'), space('dup')] },
      ],
    }));
    const cache = loadCache(root, 'key');
    const product = { jsx: [{ rel: 'index.tsx', content: '<div data-node-id="baked" className="bad" />' }], style: [] };
    const ctx = { cache, product, config, classMap: { baked: ['bad'] } };
    assert.deepEqual(R05.check(ctx).map((v) => v.nodeId), ['first']);
    assert.deepEqual(R17.check(ctx).map((v) => v.nodeId), ['baked']);
    ctx.classMap.first = ['first'];
    product.style = [{ rel: 'index.scss', content: '.first { justify-content: space-between; }' }];
    assert.equal(R05.check(ctx).length, 0);
  });

  write('page/index.tsx', "import './index.scss'; export default () => <div data-node-id=\"1:1\" className=\"title\" />;");
  write('page/index.scss', '.title { color: red; }');
  write('page/blocks/card/index.tsx', "import './index.scss'; export default () => <div />;");
  write('page/blocks/card/index.scss', '.title { color: blue; }');
  test('flat merge 不扫描未引用子稿；block 独立校验与默认递归行为保留', () => {
    const product = loadProduct(path.join(root, 'page'), { mode: 'merge' });
    assert.deepEqual(product.style.map((s) => s.rel), ['index.scss']);
    assert.equal(R12.check({ product, config }).length, 0);
    assert.equal(loadProduct(path.join(root, 'page/blocks/card'), { mode: 'block' }).style.length, 1);
    assert.equal(loadProduct(path.join(root, 'page')).style.length, 2);
    assert.equal(fs.existsSync(path.join(root, 'page/blocks/card/index.scss')), true);
  });
  test('CLI --merge 实际启用依赖范围，--block 独立校验仍通过，动态路径显式提示', () => {
    write('pp-d2c.config.json', JSON.stringify(config));
    write('package.json', JSON.stringify({ dependencies: { react: '*' } }));
    write('.d2c-cache/cli/nodes/root.json', JSON.stringify({ id: '1:1', type: 'RECTANGLE', name: 'deco' }));
    write('page/blocks/card/rule-hits.json', '{}');
    write('page/rule-hits.json', '{}');
    write('page/blocks/old/index.tsx', 'export default () => <section />;'); // 无报告的旧子稿
    write('page/index.tsx', "import React from 'react'; import './index.scss'; export default () => <div data-node-id=\"1:1\" className=\"title\" />;");
    const cli = fileURLToPath(new URL('../../templates/skills/pp-d2c/bin/check-rules.mjs', import.meta.url));
    const run = (mode, dir) => {
      const result = spawnSync(process.execPath, [cli, mode, path.join(root, dir), '--cache-key', 'cli'], { encoding: 'utf8' });
      assert.ok(result.stdout, result.stderr);
      return { status: result.status, report: JSON.parse(result.stdout) };
    };
    const merge = run('--merge', 'page');
    assert.equal(merge.status, 0, JSON.stringify(merge.report));
    assert.equal(run('--block', 'page/blocks/card').status, 0);
    write('page/index.tsx', "import './index.scss'; import './blocks/card';");
    const conflict = run('--merge', 'page');
    assert.equal(conflict.status, 1);
    assert.ok(conflict.report.failed.includes('R12'));
    fs.unlinkSync(path.join(root, 'page/blocks/card/rule-hits.json'));
    assert.ok(run('--merge', 'page').report.failed.includes('GATE-rule-hits'));
    write('page/blocks/card/rule-hits.json', '{}');
    write('page/index.tsx', "import './blocks/outer/blocks/leaf/Card';");
    write('page/blocks/outer/index.tsx', 'export default () => <main />;'); // 外层没有被引用
    write('page/blocks/outer/blocks/leaf/Card.tsx', 'export default () => <aside />;');
    const missingLeaf = run('--merge', 'page').report.violations.filter((v) => v.rule === 'GATE-rule-hits');
    assert.equal(missingLeaf.length, 1);
    assert.ok(missingLeaf[0].file.endsWith('blocks/leaf/rule-hits.json'));
    write('page/blocks/outer/blocks/leaf/rule-hits.json', '{}');
    assert.equal(run('--merge', 'page').status, 0);
    write('page/index.tsx', 'export default () => <div />;');
    fs.unlinkSync(path.join(root, 'page/rule-hits.json'));
    assert.ok(run('--merge', 'page').report.failed.includes('GATE-rule-hits'));
    write('page/rule-hits.json', '{}');
    write('page/index.tsx', "import('./blocks/' + name);");
    const dynamic = run('--merge', 'page').report;
    assert.ok(dynamic.warnings.some((w) => w.rule === 'product-scope'));
    assert.ok(dynamic.failed.includes('GATE-rule-hits')); // 依赖不确定时保留原全量门禁
  });
  test('真实静态依赖经 TS barrel、require、字面量动态 import 与 Sass partial 递归，循环不重复', () => {
    write('page/index.tsx', "import './index.scss'; import { Card } from './bridge'; import('./lazy'); require('./required');");
    write('page/bridge.ts', "export { default as Card } from './blocks/card';");
    write('page/lazy.tsx', 'export default () => <aside />;');
    write('page/required.js', "require('./bridge');");
    write('page/index.scss', "@use './shared'; @forward './tokens'; @import './extra', './other'; .title { color: red; }");
    write('page/_shared.scss', "@use './tokens'; .shared { color: green; }");
    write('page/tokens/_index.scss', "$color: red;");
    write('page/_extra.scss', '.extra { color: red; }');
    write('page/_other.scss', '.other { color: red; }');
    const product = loadProduct(path.join(root, 'page'), { mode: 'merge' });
    assert.equal(product.warnings?.length || 0, 0);
    assert.deepEqual(product.style.map((s) => s.rel).sort(), ['_extra.scss', '_other.scss', '_shared.scss', 'blocks/card/index.scss', 'index.scss', 'tokens/_index.scss'].sort());
    assert.ok(product.jsx.some((j) => j.rel === 'lazy.tsx'));
    assert.equal(R12.check({ product, config }).length, 1); // 真正引用的重复仍报。
  });
  for (const ref of ["import(`./blocks/${name}`)", "import('./blocks/' + name)", "require(target)", "import.meta.glob('./blocks/**/*.tsx')", "import './missing'", "import Card from '@/blocks/card'"]) {
    test(`不确定依赖保守退回全量并提示: ${ref}`, () => {
      write('page/index.tsx', `${ref};`);
      const product = loadProduct(path.join(root, 'page'), { mode: 'merge' });
      assert.ok(product.style.some((s) => s.rel === 'blocks/card/index.scss'));
      assert.ok(product.warnings?.length > 0);
    });
  }
  test('动态 Sass 引用保守退回，不把注释或 URL 当依赖', () => {
    write('page/index.tsx', "// import('./missing')\nimport './index.scss';");
    write('page/index.scss', '@import "./themes/#{$theme}";');
    assert.ok(loadProduct(path.join(root, 'page'), { mode: 'merge' }).warnings?.length > 0);
    write('page/index.scss', '/* @import "./missing"; */ @use "sass:math"; @import url("https://example.com/a.css"); .a { background: url("https://example.com/a.png"); }');
    const product = loadProduct(path.join(root, 'page'), { mode: 'merge' });
    assert.equal(product.warnings?.length || 0, 0);
    assert.deepEqual(product.style.map((s) => s.rel), ['index.scss']);
    write('page/index.scss', '@import url(https://example.com/a.css); @import "./extra";');
    assert.ok(loadProduct(path.join(root, 'page'), { mode: 'merge' }).style.some((s) => s.rel === '_extra.scss'));
    write('page/index.scss', '@import "./extra", $theme;');
    assert.ok(loadProduct(path.join(root, 'page'), { mode: 'merge' }).warnings?.length > 0);
  });
  test('无明确页面入口时提示并保留全量扫描', () => {
    fs.renameSync(path.join(root, 'page/index.tsx'), path.join(root, 'page/Page.tsx'));
    const product = loadProduct(path.join(root, 'page'), { mode: 'merge' });
    assert.ok(product.warnings?.length > 0);
    assert.ok(product.style.some((s) => s.rel === 'blocks/card/index.scss'));
  });

  test('依赖按最近项目标记的 realpath 限界；../、绝对路径及 symlink 越界都不读取源码', () => {
    const project = path.join(root, 'boundary/project');
    const page = path.join(project, 'page');
    const outside = path.join(root, 'boundary/project-outside'); // 同前缀兄弟目录也必须拦截
    write('boundary/project/page/index.tsx', "import '../shared';");
    write('boundary/project/page/unused.scss', '.unused { color: red; }');
    write('boundary/project/shared.js', 'export const value = 1;');
    write('boundary/project-outside/secret.js', 'export const secret = 1;');
    write('boundary/project-outside/secret.tsx', 'export default () => <div />;');
    write('boundary/project-outside/secret.scss', '.secret { color: blue; }');
    const realOutside = fs.realpathSync(outside);
    const originalRead = fs.readFileSync;
    const externalReads = [];
    fs.readFileSync = function(file, ...args) {
      const real = fs.realpathSync(file);
      const rel = path.relative(realOutside, real);
      if (rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))) {
        externalReads.push(real);
        throw new Error('外部源码被读取');
      }
      return originalRead.call(this, file, ...args);
    };
    try {
      for (const marker of ['package.json', 'pp-d2c.config.json']) {
        write(`boundary/project/${marker}`, '{}');
        // 外层已有 config/package；最近标记必须优先，且 /tmp realpath 别名不误伤。
        write('boundary/project/page/index.tsx', "import '../shared';");
        let product = loadProduct(page, { mode: 'merge' });
        assert.equal(product.scope, 'entry');
        assert.ok(product.jsx.some((j) => j.rel === '../shared.js'));
        write('boundary/project/page/index.tsx', `import ${JSON.stringify(path.join(project, 'shared.js'))};`);
        assert.equal(loadProduct(page, { mode: 'merge' }).scope, 'entry');
        for (const ref of ['../../project-outside/secret.js', path.join(outside, 'secret.js')]) {
          write('boundary/project/page/index.tsx', `import ${JSON.stringify(ref)};`);
          product = loadProduct(page, { mode: 'merge' });
          assert.notEqual(product.scope, 'entry');
          assert.ok(product.warnings?.some((w) => w.includes('项目边界')));
          assert.ok(product.style.some((s) => s.rel === 'unused.scss')); // 保守回退仍保留内部源码
          assert.ok(product.jsx.every((j) => !path.relative(realOutside, j.file).startsWith('secret')));
        }
        write('boundary/project/page/index.tsx', "import './index.scss';");
        for (const ref of ['../../project-outside/secret', path.join(outside, 'secret.scss')]) {
          write('boundary/project/page/index.scss', `@use ${JSON.stringify(ref)};`);
          product = loadProduct(page, { mode: 'merge' });
          assert.ok(product.warnings?.some((w) => w.includes('项目边界')));
          assert.ok(product.style.every((s) => !s.content.includes('.secret')));
        }
        fs.unlinkSync(path.join(project, marker));
      }
      write('boundary/project/package.json', '{}');
      fs.symlinkSync(path.join(outside, 'secret.js'), path.join(page, 'linked.js'));
      fs.symlinkSync(path.join(outside, 'secret.tsx'), path.join(page, 'linked.tsx'));
      fs.symlinkSync(path.join(outside, 'secret.scss'), path.join(page, 'linked.scss'));
      fs.symlinkSync(outside, path.join(page, 'linked-dir'), 'dir');
      write('boundary/project/page/index.tsx', "import './linked.js'; import './linked-dir/secret.js'; import './linked.scss';");
      for (const mode of ['merge', 'block', undefined]) {
        const product = loadProduct(page, { mode });
        assert.ok(product.warnings?.some((w) => w.includes('项目边界')));
        assert.ok(product.jsx.every((j) => !j.rel.startsWith('linked')));
        assert.ok(product.style.every((s) => !s.rel.startsWith('linked')));
      }
      fs.unlinkSync(path.join(page, 'index.tsx'));
      fs.symlinkSync(path.join(outside, 'secret.tsx'), path.join(page, 'index.tsx'));
      assert.ok(loadProduct(page, { mode: 'merge' }).warnings?.some((w) => w.includes('项目边界')));
      fs.unlinkSync(path.join(page, 'index.tsx'));
      write('boundary/project-outside/package.json', JSON.stringify({ main: 'secret.js' }));
      fs.mkdirSync(path.join(project, 'node_modules'), { recursive: true });
      fs.symlinkSync(outside, path.join(project, 'node_modules/external-link'), 'dir');
      write('boundary/project/page/index.tsx', "import 'external-link';");
      assert.ok(loadProduct(page, { mode: 'merge' }).warnings?.some((w) => w.includes('项目边界')));
      // 合法的项目内 symlink 仍能解析，并按 realpath 去重。
      fs.symlinkSync(path.join(project, 'shared.js'), path.join(page, 'inside.js'));
      write('boundary/project/page/index.tsx', "import './inside.js'; import '../shared';");
      const product = loadProduct(page, { mode: 'merge' });
      assert.equal(product.jsx.filter((j) => j.content === 'export const value = 1;').length, 1);
      assert.deepEqual(externalReads, []);
    } finally { fs.readFileSync = originalRead; }
  });

  const node = { name: 'img-hero', type: 'FRAME', layoutMode: 'VERTICAL', paddingTop: 12, paddingRight: 8, paddingBottom: 12, paddingLeft: 8, absoluteBoundingBox: { width: 100, height: 50 } };
  const img = '<img data-node-id="1:1" className="hero" src="hero.png" />';
  test('R19 整体切图 img 不重复要求内部 padding，额外 padding 仍报', () => {
    assert.equal(R19.check(context(node, img, '.hero { width: 200px; height: 100px; }')).length, 0);
    assert.equal(R19.check(context(node, img, '.hero { padding: 24px 16px; }')).length, 1);
    assert.equal(R19.check(context(node, img, '.hero { padding: 0; }')).length, 0);
  });
  test('R19 真实 DOM、无 src、自造 data-baked、仅名称、混合 DOM 不豁免', () => {
    for (const jsx of [
      '<div data-node-id="1:1" className="hero" />',
      '<div data-node-id="1:1" className="hero" data-baked="true" />',
      '<img data-node-id="1:1" className="hero" />',
      '<img data-node-id="1:1" className="hero" src={images.hero} />',
      '<img data-node-id="1:1" className="hero" src={IMG.hero} />',
      '<div data-node-id="1:1" className="hero"><img src="hero.png" /></div>',
      '<img data-node-id="1:1" className="hero" src={undefined} />',
      '<img data-node-id="1:1" className="hero" src={\'\'} />',
      img + '<div data-node-id="1:1" className="hero" />',
    ]) assert.equal(R19.check(context(node, jsx, '.hero { display: block; }')).length, 1);
    assert.equal(R19.check(context({ ...node, name: 'container' }, img, '.hero { display: block; }')).length, 1);
    assert.equal(R19.check(context(node, '<div data-node-id="1:1" className="hero" />', '.hero { padding: 24px 16px; }')).length, 0);
  });
  test('R23 仍检查整体切图尺寸并拦截 1×1 隐藏锚点', () => {
    assert.equal(R23.check(context(node, img, '.hero { width: 200px; height: 100px; }')).length, 0);
    assert.equal(R23.check(context(node, img, '.hero { width: 150px; height: 100px; }')).length, 1);
    assert.match(R23.check(context(node, img, '.hero { width: 1px; height: 1px; overflow: hidden; }'))[0].actual, /锚点欺诈/);
  });
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
