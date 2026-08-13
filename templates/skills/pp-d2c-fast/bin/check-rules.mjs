#!/usr/bin/env node
// check-rules.mjs — pp-d2c 硬防线脚本 (v1.2.3)
// 覆盖 R01/R02/R03/R04/R05/R06/R08/R09/R12/R14/R16/R17/R18/R19/R20/R21
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
import { findProjectRoot, loadConfig, loadCache } from './lib/loadCache.mjs';
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

const ALL_RULES = [R01, R02, R03, R04, R05, R06, R08, R09, R12, R14, R16, R17, R18, R19, R20, R21];

function parseArgv(argv) {
  const args = { mode: null, dir: null, cacheKey: null, forceSkip: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--block') { args.mode = 'block'; args.dir = argv[++i]; }
    else if (a === '--merge') { args.mode = 'merge'; args.dir = argv[++i]; }
    else if (a === '--cache-key') { args.cacheKey = argv[++i]; }
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
  process.stdout.write(`check-rules.mjs (pp-d2c v1.2.3)

Usage:
  node check-rules.mjs --block <blockDir> --cache-key <fileKey>
  node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R05,R06

Rules covered: R01 R02 R03 R04 R05 R06 R08 R09 R12 R14 R16 R17 R18 R19 R20 R21
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

  for (const rule of ALL_RULES) {
    checked.push(rule.id);
    if (args.forceSkip.includes(rule.id)) {
      skipped.push(rule.id);
      warnings.push({ rule: rule.id, reason: 'skipped via --force-skip' });
      continue;
    }
    try {
      const hits = rule.check({ cache, product, config, classMap });
      for (const h of hits) violations.push(h);
    } catch (e) {
      warnings.push({ rule: rule.id, reason: `rule crashed: ${e.message}` });
    }
  }

  const report = makeReport({ checked, skipped, violations, warnings });
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

main();
