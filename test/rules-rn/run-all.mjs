#!/usr/bin/env node
// pp-d2c-rn 硬防线规则回归入口：node test/rules-rn/run-all.mjs（npm test 串跑 h5 + rn 两套）
// 逐个子进程跑 test-*.mjs，任一失败则 exit 1。
// 测试对象是 templates/skills/pp-d2c-rn/bin/(RN 侧防线 v1.0.0:21 条 exit-1 + R22 + 4 门禁)。
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.startsWith('test-') && f.endsWith('.mjs')).sort();

let failed = 0;
for (const f of files) {
  process.stdout.write(`\n━━ ${f} ━━\n`);
  try {
    execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}
process.stdout.write(`\n${failed ? `✗ ${failed}/${files.length} 个测试文件失败` : `✓ ${files.length} 个测试文件全部通过`}\n`);
process.exit(failed ? 1 : 0);
