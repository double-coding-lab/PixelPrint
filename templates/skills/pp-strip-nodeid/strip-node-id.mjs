#!/usr/bin/env node
// pp-strip-nodeid
// 清理 D2C 生成产物里注入的 data-node-id="..." 调试锚点。
//
// 用法：
//   node strip-node-id.mjs                # 从 pp-d2c.config.json 读 output.dir，实际写入
//   node strip-node-id.mjs --dry-run      # 只预览，不写盘
//   node strip-node-id.mjs --dir pages    # 覆盖扫描目录
//   node strip-node-id.mjs --ext tsx,jsx  # 覆盖扫描扩展名（逗号分隔，不带点）
//   node strip-node-id.mjs --no-anchors   # 不写 .d2c-cache/anchors/,只做剥除
//
// 剥除前会自动把 nodeId → (file, startLine, endLine) 存到
// .d2c-cache/anchors/<pageDirSlug>.json,供 pp-fix-partial 精确定位。
// 加 --no-anchors 关掉这行为。
//
// 退出码：0=成功；1=参数错 / 目标目录不存在 / IO 失败

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const CWD = process.cwd()

const args = parseArgs(process.argv.slice(2))
const dryRun = args['dry-run'] === true
const writeAnchors = args['no-anchors'] !== true
const extList = (args.ext || 'tsx,jsx,ts,js,html,htm').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

let scanDir = args.dir
if (!scanDir) {
  const configPath = path.join(CWD, 'pp-d2c.config.json')
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
// 捕获 nodeId 用的正则(单独一遍扫,便于取值):形如 138:1830 或 138-1830
const RE_CAPTURE = /data-node-id\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g
// JSX 元素起始标签开头(向前找):找 < 后跟大小写字母的位置
const RE_TAG_OPEN = /<[A-Za-z][A-Za-z0-9]*/

let filesScanned = 0
let filesChanged = 0
let hitsTotal = 0
const changedFiles = []

// pageDirSlug → { [nodeId]: { file, start, end } }
// pageDirSlug = scanDir 下第一层目录名(如 Italo);扫到的文件位于 scanDir/<slug>/... 就归到 <slug>
// scanDir 根直下的文件归到 slug = '__root__'
const anchorsByPage = {}

walk(absDir)

console.log('')
console.log(`[strip-node-id] mode        : ${dryRun ? 'dry-run（未写盘）' : '实际清理'}`)
console.log(`[strip-node-id] scanDir     : ${path.relative(CWD, absDir) || '.'}`)
console.log(`[strip-node-id] extensions  : ${extList.join(', ')}`)
console.log(`[strip-node-id] anchors     : ${writeAnchors ? '写入 .d2c-cache/anchors/' : '禁用(--no-anchors)'}`)
console.log(`[strip-node-id] files scan  : ${filesScanned}`)
console.log(`[strip-node-id] files hit   : ${filesChanged}`)
console.log(`[strip-node-id] attrs strip : ${hitsTotal}`)
if (changedFiles.length > 0) {
  console.log('')
  console.log('[strip-node-id] 命中文件：')
  for (const f of changedFiles) console.log('  · ' + path.relative(CWD, f))
}
if (writeAnchors && !dryRun) {
  const cacheDir = path.join(CWD, '.d2c-cache/anchors')
  fs.mkdirSync(cacheDir, { recursive: true })
  const pageCount = Object.keys(anchorsByPage).length
  let anchorCount = 0
  for (const [slug, anchors] of Object.entries(anchorsByPage)) {
    const dest = path.join(cacheDir, `${slug}.json`)
    fs.writeFileSync(dest, JSON.stringify(anchors, null, 2))
    anchorCount += Object.keys(anchors).length
  }
  console.log('')
  console.log(`[strip-node-id] anchors written: ${anchorCount} 个锚点 → ${pageCount} 个 page 档案`)
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

  // 剥前先抽 anchors(基于剥之前的原文,行号才准)
  if (writeAnchors) collectAnchors(file, original)

  if (dryRun) return
  const next = original.replace(RE, '')
  fs.writeFileSync(file, next)
}

// 抽 anchors:对每个 data-node-id="X",找它所属 JSX 元素的起始行 + 闭合行(或行本身)
// 简化处理:JSX 元素开始 = 从 attr 位置往前找最近的 < + 大写字母;
// JSX 元素结束 = 从 attr 位置往后找匹配的 > 或 /> 收尾。
// 这个粗粒度定位对"块级 sub-*"够用;深层嵌套内的替换 pp-fix-partial 侧会做二次校验。
function collectAnchors(file, source) {
  const relFile = path.relative(CWD, file)
  const slug = deriveSlug(relFile)
  const anchors = anchorsByPage[slug] || (anchorsByPage[slug] = {})

  RE_CAPTURE.lastIndex = 0
  let m
  while ((m = RE_CAPTURE.exec(source)) !== null) {
    const rawNodeId = (m[1] || m[2] || m[3] || '').trim()
    if (!rawNodeId) continue
    // 规范化 138-1830 → 138:1830 作 key
    const nodeId = rawNodeId.replace(/-/g, ':')
    const attrIndex = m.index

    // 起始:从 attr 往前找 <Tag(不跨行找 tag 名,但允许跨行找 <)
    let start = attrIndex
    while (start > 0 && source[start] !== '<') start--
    // 收尾:从 attr 往后找该标签的 > 或 />
    let end = attrIndex
    let depth = 0
    while (end < source.length) {
      const ch = source[end]
      if (ch === '<') depth++
      if (ch === '>' && depth <= 1) { end++; break }
      end++
    }
    const startLine = source.slice(0, start).split('\n').length
    const endLine = source.slice(0, end).split('\n').length
    // 同 nodeId 出现多次时取第一次
    if (!anchors[nodeId]) {
      anchors[nodeId] = {
        file: relFile,
        start: startLine,
        end: endLine
      }
    }
  }
}

// pages/Italo/blocks/sub-tab-list/index.jsx → 'Italo'
// pages/index.jsx → '__root__'
// src/pages/Italo/... → 'Italo'
function deriveSlug(relFile) {
  const parts = relFile.split(path.sep)
  const scanRel = path.relative(CWD, absDir).split(path.sep).filter(Boolean)
  // 找 relFile 在 scanRel 之后的第一个目录名
  let i = 0
  while (i < scanRel.length && i < parts.length && parts[i] === scanRel[i]) i++
  const first = parts[i]
  if (!first) return '__root__'
  if (i === parts.length - 1) return '__root__'  // scanDir 直下的文件
  return first.replace(/[^A-Za-z0-9]/g, '_')
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') { out['dry-run'] = true; continue }
    if (a === '--no-anchors') { out['no-anchors'] = true; continue }
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1]
      if (val !== undefined && !val.startsWith('--')) { out[key] = val; i++ } else { out[key] = true }
    }
  }
  return out
}
