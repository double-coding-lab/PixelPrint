#!/usr/bin/env node
// check-rules.mjs — pp-d2c 硬防线脚本 (v1.0.0)
// 覆盖 R01/R02/R05/R06/R08 (本骨架先跑 R01/R02, T2 补齐 R05/R06/R08)
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
import * as R05 from './rules/R05-space-between.mjs';
import * as R06 from './rules/R06-text-solid-last.mjs';
import * as R08 from './rules/R08-bg-landing-form.mjs';

const ALL_RULES = [R01, R02, R05, R06, R08];

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
  process.stdout.write(`check-rules.mjs (pp-d2c v1.0.0)

Usage:
  node check-rules.mjs --block <blockDir> --cache-key <fileKey>
  node check-rules.mjs --merge <pageDir>  --cache-key <fileKey>
  node check-rules.mjs --block <blockDir> --cache-key <fileKey> --force-skip R05,R06

Rules covered: R01 R02 R05 R06 R08
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
