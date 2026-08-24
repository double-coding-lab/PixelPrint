#!/usr/bin/env node
// check-rules.mjs — pp-d2c-rn 硬防线脚本 (v1.0.0-P0,聚合器复制自 h5 pp-d2c v1.2.5,四处适配:
//   ① import 换 styleMatch / nodeIdToStyleKey;② ALL_RULES 为 RN 规则清单;
//   ③ IMG-reconcile 文件名正则通用,RN 引用形态(require/source={{uri}}/ImageBackground/FastImage/${ASSET_PREFIX})天然覆盖;
//   ④ CLI 契约、exit code(0/1/2)、GATE 执行顺序不变)
// 覆盖(v1.1.1 全量): 22 条 exit-1(R01-R06/R08/R09/R12/R14/R16-R21/R23/R24 + RN01-RN04)
//   + R22(warning 级) + 四道门禁(GATE-cache-truncation / GATE-rule-hits /
//   IMG-reconcile / GATE-slice-confirm,后两道仅 --merge)。
// RN 特有规则 RN01-RN04 用独立命名空间,与 h5 未来新增的 R24+ 隔离。
// rn 收紧(对 h5 的排他性差异): config 缺 unit 段时 exit 2——rpx 口径下兜底默认 scale
//   会全量误判,强制 config 显式声明。
//
// 用法:
//   node check-rules.mjs --block <blockDir> --cache-key <fileKey> [--root <nodeId>]
//   node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
//   node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R19,R20
//
// exit code:
//   0 — ok=true, 全通过 (可能有 warnings)
//   1 — ok=false, 有 violations
//   2 — 环境错误 (cache/产物/config 缺失)

import path from 'node:path';
import fs from 'node:fs';
import { findProjectRoot, loadConfig, loadCache, inferBlockRoot, pruneToSubtree, findCacheTruncation } from './lib/loadCache.mjs';
import { loadProduct } from './lib/loadProduct.mjs';
import { buildNodeIdToStyleKey } from './lib/nodeIdToStyleKey.mjs';
import { makeReport, printReport } from './lib/report.mjs';

import * as R01 from './rules/R01-fixed-position.mjs';
import * as R02 from './rules/R02-fills-image.mjs';
import * as R03 from './rules/R03-implicit-image.mjs';
import * as R04 from './rules/R04-text-gradient.mjs';
import * as R05 from './rules/R05-space-between.mjs';
import * as R06 from './rules/R06-text-solid-last.mjs';
import * as R08 from './rules/R08-bg-landing-form.mjs';
import * as R09 from './rules/R09-btn-bgc.mjs';
import * as R12 from './rules/R12-flat-mode-naming.mjs';
import * as R14 from './rules/R14-fixed-z-index.mjs';
import * as R16 from './rules/R16-no-flatten-text.mjs';
import * as R17 from './rules/R17-no-baked-dom.mjs';
import * as R18 from './rules/R18-flex-direction.mjs';
import * as R19 from './rules/R19-padding.mjs';
import * as R20 from './rules/R20-absolute-position.mjs';
import * as R21 from './rules/R21-node-id-coverage.mjs';
import * as R22 from './rules/R22-empty-visual-btn.mjs';
import * as R23 from './rules/R23-size-fidelity.mjs';
import * as R24 from './rules/R24-baseline-align.mjs';
import * as RN01 from './rules/RN01-scroll-skeleton.mjs';
import * as RN02 from './rules/RN02-flow-child-position.mjs';
import * as RN03 from './rules/RN03-no-percent-fill.mjs';
import * as RN04 from './rules/RN04-styles-file-separation.mjs';

const ALL_RULES = [
  R01, R02, R03, R04, R05, R06, R08, R09, R12, R14,
  R16, R17, R18, R19, R20, R21, R22, R23, R24,
  RN01, RN02, RN03, RN04,
];

// ── rule-hits 存在性门禁(复制自 h5 v1.2.4/v1.2.5,零样式耦合;P1 打开调用) ─────
function checkRuleHitsGate(mode, productDir) {
  const violations = [];
  const need = [];
  if (mode === 'block') {
    need.push({ dir: productDir, label: `block ${path.basename(productDir)}` });
  } else {
    const blocksDir = path.join(productDir, 'blocks');
    let blockDirs = [];
    if (fs.existsSync(blocksDir)) {
      blockDirs = fs.readdirSync(blocksDir)
        .map((d) => path.join(blocksDir, d))
        .filter((p) => {
          try {
            return fs.statSync(p).isDirectory() && fs.readdirSync(p).some((f) => /\.(jsx|tsx)$/.test(f));
          } catch { return false; }
        });
    }
    if (blockDirs.length > 0) for (const d of blockDirs) need.push({ dir: d, label: `block ${path.basename(d)}` });
    else need.push({ dir: productDir, label: '页面根(无 sub-,虚拟 block)' });
  }
  for (const { dir, label } of need) {
    const f = path.join(dir, 'rule-hits.json');
    if (fs.existsSync(f)) {
      let parsed = null;
      try { parsed = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {
        violations.push(gateViolation(label, f, 'rule-hits.json 存在但不是合法 JSON'));
        continue;
      }
      const gb = String((parsed && parsed.generated_by) || '');
      if (/fallback/i.test(gb)) {
        let degraded = false;
        const at2 = path.join(dir, 'assets.txt');
        try {
          degraded = fs.existsSync(at2) && fs.readFileSync(at2, 'utf8').includes('[Rule-Scan 降级]');
        } catch { /* 读不到按无记录处理 */ }
        if (!degraded) {
          violations.push(gateViolation(label, f, `rule-hits 为 fallback 占位(${gb}),但 assets.txt 无 [Rule-Scan 降级] 失败记录——占位仅限真实二次派发失败,疑似用占位绕过 Rule-Scan`));
        }
      }
      continue;
    }
    let fabricated = '';
    const at = path.join(dir, 'assets.txt');
    try {
      if (fs.existsSync(at) && fs.readFileSync(at, 'utf8').includes('rule-hits 消费证明')) {
        fabricated = ';且 assets.txt 已写"rule-hits 消费证明"(疑似捏造,文件并不存在)';
      }
    } catch { /* assets 不可读不影响门禁本身 */ }
    violations.push(gateViolation(label, f, `缺失 ${f}${fabricated}`));
  }
  return violations;
}

function gateViolation(label, file, actual) {
  return {
    rule: 'GATE-rule-hits',
    nodeId: '-',
    name: label,
    type: 'GATE',
    expected: `${label} 必须存在 rule-hits.json(步骤 3.5 Rule-Scan 落盘;二次降级也须写 fallback 占位)`,
    actual,
    file,
    line: 0,
    snippet: '',
  };
}

// ── 切图三方对账(复制自 h5;文件名正则与引用语法无关,RN 五种引用形态天然覆盖;P1 打开调用) ──
function checkImageReconciliation(projectRoot, cacheKey, product) {
  const violations = [];
  const warnings = [];
  const cacheDir = path.join(projectRoot, '.d2c-cache', cacheKey);
  let manifestFiles = [];
  try {
    manifestFiles = fs.readdirSync(cacheDir).filter((f) => /^slice-manifest-.*\.json$/.test(f));
  } catch { /* cache 目录不可读走缺失分支 */ }
  if (manifestFiles.length === 0) {
    warnings.push({ rule: 'IMG-reconcile', reason: '未找到 slice-manifest-*.json,跳过三方对账' });
    return { violations, warnings };
  }
  const entries = new Set();
  for (const mf of manifestFiles) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(cacheDir, mf), 'utf8'));
      for (const t of m.themes || []) {
        for (const e of t.entries || []) entries.add(e.filename);
        if (t.confirmed === false) {
          violations.push({
            rule: 'GATE-slice-confirm',
            nodeId: '-',
            name: `${mf}#${t.slug || ''}`,
            type: 'GATE',
            expected: '步骤 2.6 切图确认暂停后,须经用户确认并执行 figma.mjs confirm-slices 将 manifest confirmed 置 true,再进入生成',
            actual: 'manifest confirmed=false——切图结果未经用户确认(口头"别问了"不豁免;跳过确认的唯一通道是 config slice.confirmBeforeContinue=false,该配置下 reskin-slice 直接落 confirmed=true)',
            file: path.join(cacheDir, mf),
            line: 0,
            snippet: '',
          });
        } else if (t.confirmed === undefined) {
          warnings.push({ rule: 'GATE-slice-confirm', reason: `${mf}#${t.slug || ''} 无 confirmed 字段(legacy manifest,建议重跑 reskin-slice)` });
        }
      }
    } catch { warnings.push({ rule: 'IMG-reconcile', reason: `${mf} 解析失败,已跳过` }); }
  }
  const refRe = /([\w./-]+\.(?:png|jpe?g|webp|svg|gif))/gi;
  const refs = new Set();
  for (const f of [...product.jsx, ...product.style]) {
    for (const m of f.content.matchAll(refRe)) refs.add(path.posix.basename(m[1]));
  }
  const matchedEntries = new Set();
  const refConsumed = (r) => {
    if (entries.has(r)) { matchedEntries.add(r); return true; }
    let hit = false;
    for (const e of entries) {
      if (e.endsWith(r)) { matchedEntries.add(e); hit = true; }
    }
    return hit;
  };
  for (const r of refs) {
    if (!refConsumed(r)) {
      violations.push({
        rule: 'IMG-reconcile',
        nodeId: '-',
        name: r,
        type: 'IMG',
        expected: '产物引用的切图必须来自 slice-manifest(步骤 2.6 只消费清单契约)',
        actual: `产物引用 ${r} 不在任何 slice-manifest 中(疑似绕清单手工切图)`,
        file: '(product)',
        line: 0,
        snippet: '',
      });
    }
  }
  const unused = [...entries].filter((k) => !matchedEntries.has(k));
  if (unused.length) {
    warnings.push({ rule: 'IMG-reconcile', reason: `manifest 中 ${unused.length} 张切图未被产物引用: ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? ' …' : ''}` });
  }
  return { violations, warnings };
}

function parseArgv(argv) {
  const args = { mode: null, dir: null, cacheKey: null, root: null, forceSkip: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--block') { args.mode = 'block'; args.dir = argv[++i]; }
    else if (a === '--merge') { args.mode = 'merge'; args.dir = argv[++i]; }
    else if (a === '--cache-key') { args.cacheKey = argv[++i]; }
    else if (a === '--root') { args.root = argv[++i]; }
    else if (a === '--force-skip') {
      args.forceSkip = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`check-rules.mjs (pp-d2c-rn v1.0.0)

Usage:
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> [--root <nodeId>]
  node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R19,R20

--root: block 子树根 nodeId(局部化对账范围);缺省时 --block 模式自动从产物 data-node-id 推断(LCA)

Rules (21 exit-1): R01-R06 R08 R09 R12 R14 R16-R21 R23 + RN01-RN04
Warning 级: R22 empty-visual-btn
Gates: GATE-cache-truncation / GATE-rule-hits(全模式);IMG-reconcile / GATE-slice-confirm(--merge)
Exit: 0=ok, 1=violations, 2=env-error
`);
}

function fatal(msg) {
  process.stderr.write(`[check-rules] ERROR: ${msg}\n`);
  process.exit(2);
}

function main() {
  const args = parseArgv(process.argv);
  if (!args.mode || !args.dir) fatal('missing --block <dir> or --merge <dir>');
  if (!args.cacheKey) fatal('missing --cache-key <fileKey>');

  const productDir = path.resolve(args.dir);
  const product = loadProduct(productDir);
  if (product.error) fatal(product.error);
  if (product.jsx.length === 0 && product.style.length === 0) {
    fatal(`no jsx/style found under ${productDir}`);
  }

  const projectRoot = findProjectRoot(productDir);
  if (!projectRoot) fatal('pp-d2c.config.json not found in ancestors of ' + productDir);
  const config = loadConfig(projectRoot);
  if (!config) fatal('failed to load pp-d2c.config.json at ' + projectRoot);
  // rn 收紧: unit 段必须显式声明——rpx 口径下兜底默认 scale 会让 R19/R20/R23 全量误判
  if (!config.unit || typeof config.unit.scale !== 'number') {
    fatal('config.unit.scale missing — rn 侧禁止兜底默认,请在 pp-d2c.config.json 显式声明 unit 段');
  }

  const cache = loadCache(projectRoot, args.cacheKey);
  if (cache.error) fatal(cache.error);

  const classMap = buildNodeIdToStyleKey(product.jsx);

  const checked = [];
  const skipped = [];
  const violations = [];
  const warnings = [];

  // --block 局部化: cache 装载的是 fileKey 全量,block 产物只覆盖本子树,
  // 必须裁剪到 block 根,否则 R21 等把 block 外节点全部误报。
  if (args.root && !cache.nodes[args.root]) {
    fatal(`--root ${args.root} not found in cache`);
  }
  let scopeRoot = args.root;
  if (!scopeRoot && args.mode === 'block') {
    scopeRoot = inferBlockRoot(cache.nodes, classMap);
    if (!scopeRoot) {
      warnings.push({ rule: 'scope', reason: '--block 无法从产物 data-node-id 推断子树根,退回全量 cache 对账(可能出现 block 外误报,建议显式 --root)' });
    }
  }
  if (scopeRoot) {
    const before = Object.keys(cache.nodes).length;
    cache.nodes = pruneToSubtree(cache.nodes, scopeRoot);
    warnings.push({ rule: 'scope', reason: `对账范围=子树 ${scopeRoot}(${args.root ? '--root' : '产物推断'}), cache ${before}→${Object.keys(cache.nodes).length} 节点` });
  }

  // cache 完整性门禁(GATE-cache-truncation): 截断 cache 会让逐节点对账真空通过,
  // 必须先于一切规则拦截——空 GROUP/BOOLEAN_OPERATION = fetch depth 截断实锤。
  const trunc = findCacheTruncation(cache.nodes);
  for (const t of trunc.hard) {
    violations.push({
      rule: 'GATE-cache-truncation',
      nodeId: t.nodeId,
      name: t.name,
      type: t.type,
      expected: 'GROUP/BOOLEAN_OPERATION 在 Figma 中必有子节点;cache 中为空 = fetch-node depth 截断,该子树内容缺失',
      actual: '空容器(不带 --depth 重拉该子树后重新生成与对账;凭截断 cache 出码必然丢内容)',
      file: '(cache)',
      line: 0,
      snippet: '',
    });
  }
  for (const t of trunc.soft) {
    warnings.push({ rule: 'GATE-cache-truncation', reason: `${t.name}(${t.nodeId}) ${t.type} children 为空,疑似截断` });
  }

  // GATE-rule-hits: rule-hits.json 缺失/捏造/占位无降级记录 → exit 1(执行顺序对齐 h5:
  // cache-truncation → rule-hits → 规则循环 → merge 时 IMG-reconcile)
  for (const v of checkRuleHitsGate(args.mode, productDir)) violations.push(v);

  for (const rule of ALL_RULES) {
    checked.push(rule.id);
    if (args.forceSkip.includes(rule.id)) {
      skipped.push(rule.id);
      warnings.push({ rule: rule.id, reason: 'skipped via --force-skip' });
      continue;
    }
    try {
      const hits = rule.check({ cache, product, config, classMap, mode: args.mode });
      // severity=warning 的命中进 warnings 不阻断;其余进 violations
      for (const h of hits) {
        if (h.severity === 'warning') warnings.push({ rule: h.rule, reason: `${h.name}(${h.nodeId}): ${h.actual}`, detail: h });
        else violations.push(h);
      }
    } catch (e) {
      warnings.push({ rule: rule.id, reason: `rule crashed: ${e.message}` });
    }
  }

  // 切图三方对账 + 确认留痕(仅 --merge:产物引用 ⊆ slice-manifest;manifest confirmed 必须为 true)
  if (args.mode === 'merge') {
    const rec = checkImageReconciliation(projectRoot, args.cacheKey, product);
    violations.push(...rec.violations);
    warnings.push(...rec.warnings);
  }

  const report = makeReport({ checked, skipped, violations, warnings });
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

main();
