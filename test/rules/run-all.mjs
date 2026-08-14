#!/usr/bin/env node
// pp-d2c 硬防线规则回归入口：node test/rules/run-all.mjs（或 npm test）
// 逐个子进程跑 test-*.mjs，任一失败则 exit 1。
// 测试对象是 templates/skills/pp-d2c/bin/（主本）；pp-d2c-fast/bin 与主本逐字节同步，测主本即覆盖 fast。
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
