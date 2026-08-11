#!/usr/bin/env node
// reskin-slice.mjs — pp-d2c-reskin skill 主脚本
//
// 流程:
//   1. 读 .d2c-cache/last-page.json 拿基线 (fileKey, rootNodeId)
//   2. 通过 figma.mjs fetch-node 拉基线子树,遍历出所有切图位 (img- / bg- / bgc-)
//   3. 解析用户传入的换肤稿 URL(可多个),对每套稿子:
//      a. figma.mjs fetch-node 拉换肤子树
//      b. 按 name 严格匹配基线切图清单里的每一项
//      c. 命中 → figma.mjs export-image 到 assetsDir 根(临时名 theme-<slug>__<orig>)
//      d. 移到 <assetsDir>/theme-<slug>/<orig>.png 子目录
//      e. 未命中 → 记入 missed 报告
//   4. 输出汇总 + 每套稿子的 hit/miss 表
//
// 依赖:pp-d2c/bin/figma.mjs 已存在(即项目已跑过 pp-d2c init)
// 参数:
//   --theme <name>=<figmaUrl>   一套换肤稿,可重复传多次
//   --dry-run                   只扫基线清单,不拉换肤稿也不切图
//   --base <figmaUrl>           覆盖基线 URL(默认读 last-page.json)
//   --prefix <list>             限定切图前缀(默认 img,bg,bgc)

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const CWD = process.cwd()

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

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme'
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
    // node-id 参数用 - 分隔(如 138-2050),内部 API 用 : 分隔(138:2050)
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
      // --prefix img,bg 或 --prefix img-,bg-,bgc-  两种写法都兼容:剥去末尾 - 只保留裸词
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

// ─── figma.mjs 调用封装 ─────────────────────────────────────────

function runFigma(figmaScript, args, opts = {}) {
  const res = spawnSync('node', [figmaScript, ...args], {
    encoding: 'utf8',
    ...opts,
  })
  if (res.status !== 0) {
    // figma.mjs 失败时会 stdout 一行 JSON {ok:false,error}
    try {
      const j = JSON.parse(res.stdout.trim().split('\n').pop())
      throw new Error(j.error || res.stderr || 'figma.mjs failed')
    } catch (e) {
      throw new Error(res.stderr || res.stdout || `figma.mjs exit=${res.status}`)
    }
  }
  const line = res.stdout.trim().split('\n').pop()
  return JSON.parse(line).data
}

// ─── 遍历子树抽切图位 ─────────────────────────────────────────

// 判断节点 name 是否为切图位:裸词(img / bg)或带子名(img-* / bg-*)都算
// prefixes 是裸词数组(如 ['img','bg']),从 --prefix 参数或默认值来
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
    // 基线切图产物文件名:
    //   - 带子名 img-hero / bg-card-top → hero / card-top
    //   - 裸 img / bg → 借父节点 name 拼:<parent>__<prefix>(避免多个裸 bg 撞名)
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

function figmaNameToFilename(name, parentName) {
  // 裸词 img / bg → 借父节点 name(去前缀 + slug 化)拼出可区分的文件名
  if (name === 'img' || name === 'bg') {
    const parent = parentName ? slugify(parentName.replace(/^(img|bg|sub|block|scrollx|scrolly|fixed|end|btn|input|x)-/, '')) : 'root'
    return `${parent || 'root'}__${name}`
  }
  // 带子名 img-hero / bg-card-top → 去前缀 + slug 化
  const stripped = name.replace(/^(img|bg)-/, '')
  return slugify(stripped)
}

// ─── 主流程 ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const projectRoot = findProjectRoot()
  if (!projectRoot) die('未找到 pp-d2c.config.json,请先在项目根跑 pp-d2c init')

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'pp-d2c.config.json'), 'utf8'))
  const assetsDir = (config.images?.assetsDir || 'static/').replace(/^\//, '')

  // 定位 figma.mjs:优先 pp-d2c(H5),回退 pp-d2c-rn
  const figmaCandidates = [
    path.join(projectRoot, '.claude/skills/pp-d2c/bin/figma.mjs'),
    path.join(projectRoot, '.claude/skills/pp-d2c-rn/bin/figma.mjs'),
  ]
  const figmaScript = figmaCandidates.find(p => fs.existsSync(p))
  if (!figmaScript) die(`未找到 figma.mjs:${figmaCandidates.join(' 或 ')}`)

  if (args.themes.length === 0 && !args.dryRun) {
    die('未传 --theme <name>=<figmaUrl>;至少传一套稿子,或加 --dry-run 只扫基线')
  }

  // ─── 尝试拿基线(可选):优先 --base,其次 last-page.json,都没有则走 standalone 模式 ───
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

  // ─── 有基线:拉基线子树 → 生成切图清单(用于跨稿 name 对齐 + miss 报告) ───
  let uniqSlices = null
  if (hasBase) {
    console.log('[pp-d2c-reskin] 拉基线子树...')
    const baseTree = runFigma(figmaScript, ['fetch-node', baseFileKey, baseNodeId])
    const sliceList = collectSliceNodes(baseTree.node || baseTree.nodes?.[baseNodeId]?.document || baseTree, args.prefixes)

    // 去重 key:裸 img/bg → <parent>||<name>;带子名 → name
    const seenKeys = new Set()
    uniqSlices = sliceList.filter(s => {
      const k = (s.name === 'img' || s.name === 'bg')
        ? `${s.parentName || 'root'}||${s.name}`
        : s.name
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

  // ─── 逐套稿子:切图 + 归子目录 ─────────────
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

    let themeTree
    try {
      themeTree = runFigma(figmaScript, ['fetch-node', themeFileKey, themeNodeId])
    } catch (e) {
      console.log(`  × fetch-node 失败:${e.message}`)
      reports.push({ theme: theme.name, error: e.message, hit: 0, miss: hasBase ? uniqSlices.length : 0 })
      continue
    }

    // 输出目录:<assetsDir>/theme-<slug>/
    const outDirRel = path.join(assetsDir, `theme-${theme.slug}`)
    const outDirAbs = path.join(projectRoot, outDirRel)
    fs.mkdirSync(outDirAbs, { recursive: true })

    // ─── 决定这套稿子要切哪些位 ─────────────
    // 有基线:按基线清单去换肤稿里找同 key 节点,miss 单独报
    // 无基线:直接扫当前稿子自己的子树,前缀命中的节点就是切图位
    let sliceItems  // 形如 [{ name, parentName, filename, nodeId, matchedFrom: 'base'|'self' }, ...]
    let missNames = []

    if (hasBase) {
      // 建换肤稿匹配表(与基线 _matchKey 语义一致)
      const themeNameMap = new Map()
      ;(function walk(n, parentName) {
        if (!n) return
        const name = n.name || ''
        const key = (name === 'img' || name === 'bg')
          ? `${parentName || 'root'}||${name}`
          : name
        if (name && !themeNameMap.has(key)) themeNameMap.set(key, n.id)
        if (Array.isArray(n.children)) n.children.forEach(c => walk(c, name))
      })(themeTree.node || themeTree.nodes?.[themeNodeId]?.document || themeTree, null)

      sliceItems = []
      for (const slice of uniqSlices) {
        const themeNode = themeNameMap.get(slice._matchKey)
        if (!themeNode) {
          console.log(`  ? miss  ${slice.name}${slice.parentName ? ` (under ${slice.parentName})` : ''}  (换肤稿无对应节点)`)
          missNames.push(slice.name)
          continue
        }
        sliceItems.push({
          name: slice.name,
          parentName: slice.parentName,
          filename: slice.filename,
          nodeId: themeNode,
        })
      }
    } else {
      // standalone:直接扫当前稿子
      const selfList = collectSliceNodes(themeTree.node || themeTree.nodes?.[themeNodeId]?.document || themeTree, args.prefixes)
      const seenKeys = new Set()
      sliceItems = []
      for (const s of selfList) {
        const key = (s.name === 'img' || s.name === 'bg')
          ? `${s.parentName || 'root'}||${s.name}`
          : s.name
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

    // ─── 逐位切图 ─────────────
    const hits = []
    for (const item of sliceItems) {
      // export-image 落到 assetsDir 根,临时名加 theme slug 前缀避免与基线冲突
      const tmpFilename = `__reskin_tmp_${theme.slug}_${item.filename}`
      try {
        const r = runFigma(figmaScript, [
          'export-image', themeFileKey, item.nodeId,
          `--filename=${tmpFilename}`,
          '--format=png',
        ])
        const finalAbs = path.join(outDirAbs, `${item.filename}.png`)
        fs.renameSync(r.path, finalAbs)
        const finalRel = path.relative(projectRoot, finalAbs)
        console.log(`  · hit   ${item.name}  →  ${finalRel}${r.reused ? ' (reused)' : ''}`)
        hits.push({ name: item.name, path: finalRel })
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

  // ─── 汇总 ─────────────────────────────────────────────
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
