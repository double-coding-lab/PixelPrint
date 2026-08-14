#!/usr/bin/env node
// check-rules.mjs — pp-d2c 硬防线脚本 (v1.2.5)
// 覆盖 R01/R02/R03/R04/R05/R06/R08/R09/R12/R14/R16/R17/R18/R19/R20/R21/R23 + R22(warning)
// v1.2.5：(1) GATE-cache-truncation——合并 cache 中空 GROUP/BOOLEAN_OPERATION = depth 截断实锤,
//   截断 cache 会让逐节点对账真空通过(test29: 25 节点 cache 全防线失效);(2) R21 反向对账——
//   产物 data-node-id 必须存在于 cache(幻觉 id);(3) 新增 R23 size-fidelity——显式 px 宽高须
//   ≈ bbox×scale,1×1+overflow:hidden 锚点欺诈点名(test28);(4) GATE-rule-hits 收紧——fallback
//   占位须伴随 assets.txt [Rule-Scan 降级] 记录;(5) GATE-slice-confirm——manifest confirmed
//   须为 true(figma.mjs confirm-slices 留痕,legacy 缺字段仅 warning)。
// v1.2.4：(1) --block 局部化——--root <nodeId> 或从产物 data-node-id 推断(LCA),cache 裁剪到
//   block 子树,消除 R21/R03 对 block 外节点的全量误报;(2) GATE-rule-hits 门禁——rule-hits.json
//   缺失即 exit 1(含 assets.txt 消费证明捏造检测);(3) IMG-reconcile 三方对账(--merge)——产物
//   图片引用必须来自 slice-manifest;(4) R20 增强 position:absolute 声明强制;(5) 新增 R22
//   empty-visual-btn(warning 级);规则可返回 severity:'warning' 进 warnings 不阻断。
// v1.2.3 软→硬迁移：原 Rule-Scan 软防线中机械可判的 5 条下沉硬防线,逐节点对账不依赖 sub- 触发——
//   R03 implicit-image(≥3 真矢量路径无切图) / R04 text-gradient(末位 GRADIENT/IMAGE 须 background-clip:text) /
//   R09 btn-bgc(bgc 渐变须落 gradient) / R12 flat-mode-naming(flat 同名类冲突) / R14 fixed-z-index(多 fixed z 层级)。
//   R07/R10/R11/R13/R15 需 LLM 语义判定,仍留软防线。所有新规则一律保守(宁漏报不误判,边界 skip)。
// v1.2.0 对账升级：loadCache 标注 _inBakedSubtree / _hidden / _templateDup；
//   R02/R06 跳过 baked·隐藏·模板副本 + SCSS &__ 嵌套匹配（lib/cssMatch.mjs）消除假阳性；
//   R17 禁 baked 子孙出 DOM（双重渲染）；R18 flex-direction 忠实度；R19 padding 忠实度；R20 绝对定位坐标忠实度。
// v1.2.1：_inBakedSubtree 移除 bgc-（bgc- 非 baked，子孙走正常规则暴露误放）；
//   新增 R21 node-id-coverage（应渲染节点必挂 data-node-id，机械强制 §5.1.1 铁律，堵 R18/R19/R20 空 classMap 逃逸）。
//
// 用法:
//   node check-rules.mjs --block <blockDir> --cache-key <fileKey>
//   node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
//   node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R05,R06
//
// exit code:
//   0 — ok=true, 全通过 (可能有 warnings)
//   1 — ok=false, 有 violations
//   2 — 环境错误 (cache/产物/config 缺失)

import path from 'node:path';
import fs from 'node:fs';
import { findProjectRoot, loadConfig, loadCache, inferBlockRoot, pruneToSubtree, findCacheTruncation } from './lib/loadCache.mjs';
import { loadProduct } from './lib/loadProduct.mjs';
import { buildNodeIdToClassName } from './lib/nodeIdToClassName.mjs';
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

const ALL_RULES = [R01, R02, R03, R04, R05, R06, R08, R09, R12, R14, R16, R17, R18, R19, R20, R21, R22, R23];

// ── rule-hits 存在性门禁(v1.2.4,问题5) ─────────────────────────
// Rule-Scan 是步骤 3.5 硬性动作;v1.2.2 起无 sub- 页面也必须对页面根跑一次(虚拟 block)。
// test24-27 实测: agent 跳过 Rule-Scan 并在 assets.txt 捏造"§3.5 允许合并到 UI 侧"许可
// → 文本约束拦不住,此处机械兜底。缺失 = violation(exit 1);降级占位(v0.3.21-fallback)算存在。
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
    else need.push({ dir: productDir, label: '页面根(无 sub-,v1.2.2 虚拟 block)' });
  }
  for (const { dir, label } of need) {
    const f = path.join(dir, 'rule-hits.json');
    if (fs.existsSync(f)) {
      let parsed = null;
      try { parsed = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {
        violations.push(gateViolation(label, f, 'rule-hits.json 存在但不是合法 JSON'));
        continue;
      }
      // v1.2.5 收紧: fallback 占位仅限「Rule-Scan 真实二次失败」——必须伴随 assets.txt 的
      // [Rule-Scan 降级] 记录(含失败原因)。无记录 = 用占位绕门禁(典型 test29:
      // rule-hits 写 fallback 占位,assets.txt 却写"Rule-Scan 降级: 无",自相矛盾)。
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
    // 防捏造: 文件缺失但 assets.txt 已写消费证明
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
    expected: `${label} 必须存在 rule-hits.json(步骤 3.5 Rule-Scan 落盘;二次降级也须写 v0.3.21-fallback 占位)`,
    actual,
    file,
    line: 0,
    snippet: '',
  };
}

// ── 切图三方对账(v1.2.4,问题3;--merge 时执行) ───────────────────
// 产物图片引用必须来自 slice-manifest(步骤 2.6 只消费清单契约):
//   产物引用 ∉ manifest → violation(疑似绕清单手工切图);
//   manifest 条目未被引用 → warning(可能隐藏层/被裁,不阻断)。
// manifest 缺失 → warning 跳过(旧项目/无图页面不硬卡)。assets.txt 侧对账留给主 agent §6 文本层。
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
        // 切图确认留痕(v1.2.5,GATE-slice-confirm): reskin-slice 落盘 confirmed:false,
        // 用户确认后由 figma.mjs confirm-slices 翻 true;false = 未经确认就走到了合并阶段。
        // 字段缺失(v1.2.5 前的 legacy manifest) → warning 不阻断。
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
  // 保守匹配: JSX 动态拼接(如 \`\${x}__bg.png\`)会让正则只捕到文件名尾部碎片;
  // manifest 任一条目以该碎片结尾即视为已消费,宁漏报不误判。
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
  process.stdout.write(`check-rules.mjs (pp-d2c v1.2.5)

Usage:
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> [--root <nodeId>]
  node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R05,R06

--root: block 子树根 nodeId(局部化对账范围);缺省时 --block 模式自动从产物 data-node-id 推断(LCA)

Rules covered: R01 R02 R03 R04 R05 R06 R08 R09 R12 R14 R16 R17 R18 R19 R20 R21 R23 R22(warn)
Gates: GATE-cache-truncation(cache 完整性) GATE-rule-hits(存在性+fallback 收紧)
       IMG-reconcile(--merge 三方对账) GATE-slice-confirm(--merge 切图确认留痕)
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

  const cache = loadCache(projectRoot, args.cacheKey);
  if (cache.error) fatal(cache.error);

  const classMap = buildNodeIdToClassName(product.jsx);

  const checked = [];
  const skipped = [];
  const violations = [];
  const warnings = [];

  // --block 局部化(v1.2.4): cache 装载的是 fileKey 全量,block 产物只覆盖本子树,
  // 必须裁剪到 block 根,否则 R21/R03 等把 block 外节点全部误报。
  // 根来源: --root 显式指定 > 从产物 data-node-id 推断(LCA); merge 模式默认全量。
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

  // cache 完整性门禁(v1.2.5,GATE-cache-truncation): 截断 cache 会让逐节点对账真空通过,
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

  // rule-hits 存在性门禁(v1.2.4): Rule-Scan 未跑 → 直接违规,不看规则结果
  for (const v of checkRuleHitsGate(args.mode, productDir)) violations.push(v);

  // 切图三方对账(v1.2.4): 合并阶段核对产物图片引用 ↔ slice-manifest
  if (args.mode === 'merge') {
    const rec = checkImageReconciliation(projectRoot, args.cacheKey, product);
    for (const v of rec.violations) violations.push(v);
    for (const w of rec.warnings) warnings.push(w);
  }

  for (const rule of ALL_RULES) {
    checked.push(rule.id);
    if (args.forceSkip.includes(rule.id)) {
      skipped.push(rule.id);
      warnings.push({ rule: rule.id, reason: 'skipped via --force-skip' });
      continue;
    }
    try {
      const hits = rule.check({ cache, product, config, classMap });
      // severity=warning 的命中(如 R22)进 warnings 不阻断;其余进 violations
      for (const h of hits) {
        if (h.severity === 'warning') warnings.push({ rule: h.rule, reason: `${h.name}(${h.nodeId}): ${h.actual}`, detail: h });
        else violations.push(h);
      }
    } catch (e) {
      warnings.push({ rule: rule.id, reason: `rule crashed: ${e.message}` });
    }
  }

  const report = makeReport({ checked, skipped, violations, warnings });
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

main();
