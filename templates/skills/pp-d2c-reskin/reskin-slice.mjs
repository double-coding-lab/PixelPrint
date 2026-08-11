#!/usr/bin/env node
// reskin-slice.mjs — pp-d2c-reskin skill 主脚本
//
// 定位:完全独立的切图 skill,只依赖 Node 18+ 内置能力(fetch),不 spawn 任何兄弟 skill 的脚本。
//
// 两种工作模式:
//   1. 有基线(--base <url> 或读到 .d2c-cache/last-page.json):按基线切图清单去每套 --theme 稿子
//      找同名节点切图,报 miss;文件名与基线对齐,便于业务代码写 themeKey→dir 映射。
//   2. 无基线(standalone):每套 --theme 独立扫自己图层树,前缀命中就切,不做跨稿匹配。
//
// 前缀规则(与 pp-d2c §4 图层前缀体系对齐):
//   - img / img-*  → 整层导出 PNG
//   - bg  / bg-*   → 背景图 PNG
//   - 裸标签 img / bg 用父节点 name 辅助命名(sub-hero-card > bg → hero-card__bg.png)
//   - 同一父节点下同名裸标签只切第一个,基线↔换肤按 <parent>||<name> 复合 key 对齐
//
// 依赖: pp-d2c.config.json(读 images.assetsDir)、.env FIGMA_TOKEN、Node 18+

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CWD = process.cwd()
const FIGMA_API = 'https://api.figma.com'
const MAX_RETRIES = 3

// ─── util ───────────────────────────────────────────────────────

function die(msg, code = 1) {
  console.error(`[pp-d2c-reskin] ${msg}`)
  process.exit(code)
}

function findProjectRoot(startDir = CWD) {
  let dir = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(dir, 'pp-d2c.config.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme'
}

// 极简 .env 解析:KEY=VALUE,支持引号和 # 注释,不做变量插值
function parseEnvFile(text) {
  const out = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[m[1]] = val
  }
  return out
}

// token 读取:process.env > 项目根 .env > 兜底 config.figma.token(老项目兼容)
function loadFigmaToken(projectRoot, config) {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    try {
      const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'))
      if (parsed.FIGMA_TOKEN) return parsed.FIGMA_TOKEN
    } catch {}
  }
  return config.figma?.token || null
}

// figma URL 形态:https://www.figma.com/design/<fileKey>/<name>?node-id=<a>-<b>
function parseFigmaUrl(u) {
  try {
    const url = new URL(u)
    const m = url.pathname.match(/\/(design|file)\/([A-Za-z0-9]+)/)
    if (!m) return null
    const fileKey = m[2]
    const rawNode = url.searchParams.get('node-id')
    if (!rawNode) return { fileKey, nodeId: null }
    // URL 里 node-id 用 - 分隔(如 138-2050),API 里用 : 分隔(138:2050)
    const nodeId = rawNode.includes(':') ? rawNode : rawNode.replace(/-/, ':')
    return { fileKey, nodeId }
  } catch {
    return null
  }
}

function parseArgs(argv) {
  const out = { themes: [], dryRun: false, base: null, prefixes: ['img', 'bg'] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') { out.dryRun = true; continue }
    if (a === '--base') { out.base = argv[++i]; continue }
    if (a === '--prefix') {
      out.prefixes = argv[++i].split(',').map(p => p.replace(/-+$/, ''))
      continue
    }
    if (a === '--theme') {
      const raw = argv[++i]
      const eq = raw.indexOf('=')
      if (eq < 0) die(`--theme 参数格式错: ${raw},应为 <name>=<figmaUrl>`)
      const name = raw.slice(0, eq)
      const url = raw.slice(eq + 1)
      out.themes.push({ name, slug: slugify(name), url })
    }
  }
  return out
}

// ─── Figma REST 封装(内嵌,不 spawn) ─────────────────────────

async function figmaFetch(pathAndQuery, token) {
  let lastErr
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${FIGMA_API}${pathAndQuery}`, {
        headers: { 'X-Figma-Token': token },
      })
      if (res.status === 403 || res.status === 401) {
        throw new Error(`Figma API auth failed (HTTP ${res.status}); token invalid, expired, or lacks permission`)
      }
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Figma API error HTTP ${res.status}: ${body.slice(0, 200)}`)
      }
      const json = await res.json()
      if (json.err) throw new Error(`Figma API returned err: ${json.err}`)
      return json
    } catch (e) {
      lastErr = e
      if (i < MAX_RETRIES - 1) await sleep(Math.pow(2, i) * 1000)
    }
  }
  throw lastErr
}

async function downloadToFile(url, destPath) {
  let lastErr
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`download HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      ensureDir(path.dirname(destPath))
      fs.writeFileSync(destPath, buf)
      return
    } catch (e) {
      lastErr = e
      if (i < MAX_RETRIES - 1) await sleep(Math.pow(2, i) * 1000)
    }
  }
  throw lastErr
}

// 拉一个 frame 的子树 JSON
async function fetchNodeTree(fileKey, nodeId, token) {
  const q = new URLSearchParams({ ids: nodeId })
  const resp = await figmaFetch(`/v1/files/${fileKey}/nodes?${q.toString()}`, token)
  const doc = resp.nodes?.[nodeId]?.document
  if (!doc) throw new Error(`Figma /v1/files/${fileKey}/nodes 未返回 ${nodeId} 的 document`)
  return doc
}

// 单节点导出为 PNG,直接落到指定路径
async function exportImageToPath(fileKey, nodeId, token, destPath, scale = 2) {
  const q = new URLSearchParams({
    ids: nodeId,
    format: 'png',
    scale: String(scale),
    use_absolute_bounds: 'true',
  })
  const resp = await figmaFetch(`/v1/images/${fileKey}?${q.toString()}`, token)
  const url = resp.images?.[nodeId]
  if (!url) throw new Error(`Figma /v1/images 未返回 ${nodeId} 的 URL`)
  await downloadToFile(url, destPath)
}

// ─── 前缀匹配 + 图层遍历 ─────────────────────────────────────

function isSliceName(name, prefixes) {
  for (const p of prefixes) {
    if (name === p) return true
    if (name.startsWith(p + '-')) return true
  }
  return false
}

function collectSliceNodes(node, prefixes, out = [], pathStack = [], parentName = null) {
  if (!node) return out
  const name = node.name || ''
  if (isSliceName(name, prefixes)) {
    out.push({
      id: node.id,
      name,
      parentName,
      filename: figmaNameToFilename(name, parentName),
      pathStack: [...pathStack, name],
    })
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectSliceNodes(child, prefixes, out, [...pathStack, name], name)
    }
  }
  return out
}

// 裸标签 img/bg 借父节点 name 拼可区分文件名;带子名去前缀 slug 化
function figmaNameToFilename(name, parentName) {
  if (name === 'img' || name === 'bg') {
    const parent = parentName
      ? slugify(parentName.replace(/^(img|bg|sub|block|scrollx|scrolly|fixed|end|btn|input|x)-/, ''))
      : 'root'
    return `${parent || 'root'}__${name}`
  }
  const stripped = name.replace(/^(img|bg)-/, '')
  return slugify(stripped)
}

function matchKey(name, parentName) {
  if (name === 'img' || name === 'bg') return `${parentName || 'root'}||${name}`
  return name
}

// ─── 主流程 ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const projectRoot = findProjectRoot()
  if (!projectRoot) die('未找到 pp-d2c.config.json,请先在项目根跑 pp-d2c init')

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'pp-d2c.config.json'), 'utf8'))
  const assetsDir = (config.images?.assetsDir || 'static/').replace(/^\//, '')

  const token = loadFigmaToken(projectRoot, config)
  if (!token) die('FIGMA_TOKEN 未配置,请在项目根 .env 写 FIGMA_TOKEN=xxx')

  if (args.themes.length === 0 && !args.dryRun) {
    die('未传 --theme <name>=<figmaUrl>;至少传一套稿子,或加 --dry-run 只扫基线')
  }

  // ─── 基线来源:--base > last-page.json > 无(standalone) ─────
  let baseFileKey = null, baseNodeId = null, baseSource = null
  if (args.base) {
    const parsed = parseFigmaUrl(args.base)
    if (!parsed || !parsed.nodeId) die('--base 必须是含 node-id 的完整 figma URL')
    baseFileKey = parsed.fileKey
    baseNodeId = parsed.nodeId
    baseSource = '--base'
  } else {
    const lastPagePath = path.join(projectRoot, '.d2c-cache/last-page.json')
    if (fs.existsSync(lastPagePath)) {
      try {
        const lp = JSON.parse(fs.readFileSync(lastPagePath, 'utf8'))
        if (lp.fileKey && (lp.rootNodeId || lp.nodeId)) {
          baseFileKey = lp.fileKey
          baseNodeId = lp.rootNodeId || lp.nodeId
          baseSource = 'last-page.json'
        }
      } catch {}
    }
  }
  const hasBase = !!(baseFileKey && baseNodeId)

  console.log(`[pp-d2c-reskin] projectRoot : ${projectRoot}`)
  console.log(`[pp-d2c-reskin] assetsDir   : ${assetsDir}`)
  console.log(`[pp-d2c-reskin] base        : ${hasBase ? `${baseFileKey} / ${baseNodeId} (${baseSource})` : '无(standalone 模式,每套稿子独立切)'}`)
  console.log(`[pp-d2c-reskin] prefixes    : ${args.prefixes.join(' ')}`)
  console.log(`[pp-d2c-reskin] themes      : ${args.themes.length} 套`)
  console.log(`[pp-d2c-reskin] mode        : ${args.dryRun ? 'dry-run' : 'export'}`)
  console.log('')

  // ─── 有基线:先拉基线子树 → 生成切图清单 ─────────────────
  let uniqSlices = null
  if (hasBase) {
    console.log('[pp-d2c-reskin] 拉基线子树...')
    const baseDoc = await fetchNodeTree(baseFileKey, baseNodeId, token)
    const sliceList = collectSliceNodes(baseDoc, args.prefixes)

    const seenKeys = new Set()
    uniqSlices = sliceList.filter(s => {
      const k = matchKey(s.name, s.parentName)
      if (seenKeys.has(k)) return false
      seenKeys.add(k)
      s._matchKey = k
      return true
    })

    console.log(`[pp-d2c-reskin] 基线切图清单:${uniqSlices.length} 项(去重前 ${sliceList.length})`)
    for (const s of uniqSlices) {
      console.log(`  · ${s.name}  →  ${s.filename}.png  (nodeId=${s.id})`)
    }
    console.log('')
  }

  if (args.dryRun) {
    console.log(hasBase
      ? '[pp-d2c-reskin] dry-run 完成,未拉换肤稿'
      : '[pp-d2c-reskin] dry-run + 无基线:什么都没扫,请传 --theme 或 --base 或 --dry-run --base=<url>')
    return
  }

  // ─── 逐套稿子:切图 + 归子目录 ─────────────────────────
  const reports = []
  for (const theme of args.themes) {
    console.log(`\n[pp-d2c-reskin] === theme: ${theme.name} (slug=${theme.slug}) ===`)
    const parsed = parseFigmaUrl(theme.url)
    if (!parsed || !parsed.nodeId) {
      console.log(`  × URL 解析失败,跳过:${theme.url}`)
      reports.push({ theme: theme.name, error: 'invalid url', hit: 0, miss: hasBase ? uniqSlices.length : 0 })
      continue
    }
    const { fileKey: themeFileKey, nodeId: themeNodeId } = parsed

    let themeDoc
    try {
      themeDoc = await fetchNodeTree(themeFileKey, themeNodeId, token)
    } catch (e) {
      console.log(`  × fetchNodeTree 失败:${e.message}`)
      reports.push({ theme: theme.name, error: e.message, hit: 0, miss: hasBase ? uniqSlices.length : 0 })
      continue
    }

    const outDirRel = path.join(assetsDir, `theme-${theme.slug}`)
    const outDirAbs = path.join(projectRoot, outDirRel)
    ensureDir(outDirAbs)

    // 决定这套稿子要切哪些位
    let sliceItems, missNames = []

    if (hasBase) {
      // 建换肤稿匹配表(与基线 _matchKey 语义一致)
      const themeNameMap = new Map()
      ;(function walk(n, parentName) {
        if (!n) return
        const name = n.name || ''
        const key = matchKey(name, parentName)
        if (name && !themeNameMap.has(key)) themeNameMap.set(key, n.id)
        if (Array.isArray(n.children)) n.children.forEach(c => walk(c, name))
      })(themeDoc, null)

      sliceItems = []
      for (const slice of uniqSlices) {
        const themeNodeIdInSkin = themeNameMap.get(slice._matchKey)
        if (!themeNodeIdInSkin) {
          console.log(`  ? miss  ${slice.name}${slice.parentName ? ` (under ${slice.parentName})` : ''}  (换肤稿无对应节点)`)
          missNames.push(slice.name)
          continue
        }
        sliceItems.push({
          name: slice.name,
          parentName: slice.parentName,
          filename: slice.filename,
          nodeId: themeNodeIdInSkin,
        })
      }
    } else {
      // standalone:直接扫当前稿子
      const selfList = collectSliceNodes(themeDoc, args.prefixes)
      const seenKeys = new Set()
      sliceItems = []
      for (const s of selfList) {
        const key = matchKey(s.name, s.parentName)
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        sliceItems.push({
          name: s.name,
          parentName: s.parentName,
          filename: s.filename,
          nodeId: s.id,
        })
      }
      console.log(`  自扫切图清单:${sliceItems.length} 项`)
    }

    // 逐位切图(串行,避免 Figma /v1/images 并发限流)
    const hits = []
    for (const item of sliceItems) {
      const destAbs = path.join(outDirAbs, `${item.filename}.png`)
      try {
        await exportImageToPath(themeFileKey, item.nodeId, token, destAbs)
        const destRel = path.relative(projectRoot, destAbs)
        console.log(`  · hit   ${item.name}  →  ${destRel}`)
        hits.push({ name: item.name, path: destRel })
      } catch (e) {
        console.log(`  × err   ${item.name}  (${e.message})`)
        missNames.push(`${item.name} (${e.message})`)
      }
    }

    reports.push({
      theme: theme.name, slug: theme.slug, outDir: outDirRel,
      hit: hits.length, miss: missNames.length, missNames,
      mode: hasBase ? 'aligned-to-base' : 'standalone',
    })
    console.log(`  → ${theme.name}: hit=${hits.length}, ${hasBase ? 'miss' : 'err'}=${missNames.length}`)
  }

  // 汇总
  console.log('\n[pp-d2c-reskin] ── 汇总 ──')
  for (const r of reports) {
    const tag = r.error ? `× ${r.error}` : `✓ hit=${r.hit} ${r.mode === 'standalone' ? 'err' : 'miss'}=${r.miss} [${r.mode}]`
    console.log(`  ${r.theme.padEnd(20)}  ${tag}  ${r.outDir || ''}`)
    if (r.missNames?.length) {
      console.log(`    ${r.mode === 'standalone' ? 'errors' : 'missed'}: ${r.missNames.join(', ')}`)
    }
  }
}

main().catch(e => die(e.stack || e.message))
