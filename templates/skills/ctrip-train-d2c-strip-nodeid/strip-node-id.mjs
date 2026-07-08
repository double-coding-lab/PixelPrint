#!/usr/bin/env node
// ctrip-train-d2c-strip-nodeid
// 清理 D2C 生成产物里注入的 data-node-id="..." 调试锚点。
//
// 用法：
//   node strip-node-id.mjs                # 从 ctrip-train-d2c.config.json 读 output.dir，实际写入
//   node strip-node-id.mjs --dry-run      # 只预览，不写盘
//   node strip-node-id.mjs --dir pages    # 覆盖扫描目录
//   node strip-node-id.mjs --ext tsx,jsx  # 覆盖扫描扩展名（逗号分隔，不带点）
//
// 退出码：0=成功；1=参数错 / 目标目录不存在 / IO 失败

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const CWD = process.cwd()

const args = parseArgs(process.argv.slice(2))
const dryRun = args['dry-run'] === true
const extList = (args.ext || 'tsx,jsx,ts,js,html,htm').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

let scanDir = args.dir
if (!scanDir) {
  const configPath = path.join(CWD, 'ctrip-train-d2c.config.json')
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      scanDir = cfg?.output?.dir || 'pages/'
    } catch {
      scanDir = 'pages/'
    }
  } else {
    scanDir = 'pages/'
  }
}

const absDir = path.resolve(CWD, scanDir)
if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
  console.error(`[strip-node-id] 目录不存在或不是目录：${absDir}`)
  process.exit(1)
}

// 匹配 data-node-id="..." / data-node-id='...' / data-node-id={...}
// 前导空格一起吃掉，避免留下 `<div  >`。
const RE = /\s+data-node-id\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g

let filesScanned = 0
let filesChanged = 0
let hitsTotal = 0
const changedFiles = []

walk(absDir)

console.log('')
console.log(`[strip-node-id] mode        : ${dryRun ? 'dry-run（未写盘）' : '实际清理'}`)
console.log(`[strip-node-id] scanDir     : ${path.relative(CWD, absDir) || '.'}`)
console.log(`[strip-node-id] extensions  : ${extList.join(', ')}`)
console.log(`[strip-node-id] files scan  : ${filesScanned}`)
console.log(`[strip-node-id] files hit   : ${filesChanged}`)
console.log(`[strip-node-id] attrs strip : ${hitsTotal}`)
if (changedFiles.length > 0) {
  console.log('')
  console.log('[strip-node-id] 命中文件：')
  for (const f of changedFiles) console.log('  · ' + path.relative(CWD, f))
}
if (dryRun && hitsTotal > 0) {
  console.log('')
  console.log('[strip-node-id] 去掉 --dry-run 后重新执行即可写盘。')
}
process.exit(0)

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue
      walk(full)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase()
      if (!extList.includes(ext)) continue
      handleFile(full)
    }
  }
}

function handleFile(file) {
  filesScanned++
  const original = fs.readFileSync(file, 'utf8')
  RE.lastIndex = 0
  const matches = original.match(RE)
  if (!matches || matches.length === 0) return
  filesChanged++
  hitsTotal += matches.length
  changedFiles.push(file)
  if (dryRun) return
  const next = original.replace(RE, '')
  fs.writeFileSync(file, next)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') { out['dry-run'] = true; continue }
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1]
      if (val !== undefined && !val.startsWith('--')) { out[key] = val; i++ } else { out[key] = true }
    }
  }
  return out
}
