import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const installer = path.join(root, 'bin/install.js');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pp-install-contract-'));
try {
  const run = (args) => execFileSync(process.execPath, [installer, ...args], {
    cwd: directory,
    env: { ...process.env, FIGMA_TOKEN: 'offline-test-token' },
    encoding: 'utf8',
    timeout: 15000,
  });
  // 两种宿主及RN/H5入口都能实际读到共享规则；普通install保留本地定制。
  run(['install']);
  for (const host of ['.claude', '.codex']) {
    const skills = path.join(directory, host, 'skills');
    const contract = path.join(skills, 'pp-d2c-reskin/EXECUTION-CONTRACT.md');
    assert.equal(await fs.readFile(contract, 'utf8'), await fs.readFile(path.join(root, 'templates/skills/pp-d2c-reskin/EXECUTION-CONTRACT.md'), 'utf8'));
    for (const skill of ['pp-d2c', 'pp-d2c-rn', 'pp-fix-partial', 'pp-d2c-reskin']) {
      const source = await fs.readFile(path.join(skills, skill, 'SKILL.md'), 'utf8');
      const reference = [...source.matchAll(/\]\(([^)]+EXECUTION-CONTRACT\.md)\)/g)];
      assert.ok(reference.length, skill);
      for (const [, relative] of reference) await fs.access(path.resolve(skills, skill, relative));
    }
    await fs.writeFile(contract, 'locally customized');
  }
  run(['install']);
  assert.equal(await fs.readFile(path.join(directory, '.codex/skills/pp-d2c-reskin/EXECUTION-CONTRACT.md'), 'utf8'), 'locally customized');
  // 实际走RN init，只有目录使用交互默认；不访问网络，config和Skill在临时项目中生成。
  await fs.rm(path.join(directory, 'pp-d2c.config.json'));
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [installer, 'init', '--framework', 'rn', '--adapter-preset', 'rn', '--responsive', 'off', '--merge-mode', 'flat', '--assets-dir', 'assets/', '--figma-base', '375', '--figma-token', 'offline-test-token'], {
      cwd: directory,
      env: { ...process.env, FIGMA_TOKEN: 'offline-test-token' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let answered = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('RN init did not finish: ' + output.slice(-1800))); }, 15000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (!answered && output.includes('[6/6] 代码输出目录')) { answered = true; child.stdin.end('\n'); }
    });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('RN init failed: ' + output)); });
  });
  const config = JSON.parse(await fs.readFile(path.join(directory, 'pp-d2c.config.json'), 'utf8'));
  assert.equal(config.project.framework, 'rn');
  assert.equal(config.output.dir, 'pages/');
  await fs.access(path.join(directory, '.codex/skills/pp-d2c-reskin/EXECUTION-CONTRACT.md'));
  console.log('✓ 共享执行规则双宿主分发、保留定制与RN默认目录通过');
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
