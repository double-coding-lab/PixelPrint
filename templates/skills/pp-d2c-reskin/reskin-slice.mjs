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
//   - 匹配去重按 <parent>||<name> 复合 key(裸标签 + 带子名统一走此规则)
//   - 同名带子名(如 3 个 img-icon 分处不同父)自动加父路径 slug 前缀区分文件名,不再静默丢图
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

// slug: 用于 --theme name (子目录名 + shell 参数),严格 ASCII 化保稳
// 空串兜底为 'theme',主要用于命令行参数场景;文件名场景另用 slugForFilename
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme'
}

// 图片文件名 slug: 保留 CJK 中日韩表意文字,避免纯中文图层名全部撞成同一个 slug
// 现代 FS / Metro / Webpack / RN require 都能吃中文文件名,不做 ASCII 化
// 空串兜底传入 fallback(通常是 nodeId 冒号形式,不撞车)
function slugForFilename(s, fallback) {
  const cleaned = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
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
  // dedupeSiblings 默认 false:同父下同名节点(auto-layout 循环卡片)全部切出;
  // 打开 → 同 <parent>||<name> 只切第一个,兼容极少数"循环项刻意重复,切一次即可"场景
  //
  // outManifest (v1.1.0 pp-d2c Step 1.5 契约): 写切图清单到指定路径,格式:
  //   { generatedAt, mode, themes: [{ slug, entries: [{ nodeId, name, parentName, filename, filepath, sliceWidth?, sliceHeight? }] }] }
  const out = { themes: [], dryRun: false, base: null, prefixes: ['img', 'bg'], dedupeSiblings: false, outManifest: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') { out.dryRun = true; continue }
    if (a === '--dedupe-siblings') { out.dedupeSiblings = true; continue }
    if (a === '--base') { out.base = argv[++i]; continue }
    if (a === '--out-manifest') { out.outManifest = argv[++i]; continue }
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

// 读 PNG 前 24 字节的 IHDR chunk 拿宽高 (纯 Node fs, 无第三方依赖)
// 用于 v1.1.0 bg 溢出检测: 断言导出的 png 尺寸 ≈ node.absoluteBoundingBox * scale
function readPngDimensions(pngPath) {
  const fd = fs.openSync(pngPath, 'r')
  try {
    const buf = Buffer.alloc(24)
    fs.readSync(fd, buf, 0, 24, 0)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A + IHDR chunk (length[4] "IHDR" width[4] height[4])
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      throw new Error('not a PNG file')
    }
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return { width, height }
  } finally {
    fs.closeSync(fd)
  }
}

// 断言 png 尺寸 ≈ node bbox * scale (容差 4px 覆盖亚像素舍入)
// 返回 null = 通过; 返回 string = 违规原因
function assertPngSize(pngPath, node, scale) {
  if (!node || !node.absoluteBoundingBox) return null
  const bb = node.absoluteBoundingBox
  const expectedW = Math.round(bb.width * scale)
  const expectedH = Math.round(bb.height * scale)
  let actual
  try {
    actual = readPngDimensions(pngPath)
  } catch (e) {
    return `PNG 读取失败: ${e.message}`
  }
  const dx = Math.abs(actual.width - expectedW)
  const dy = Math.abs(actual.height - expectedH)
  const TOL = 4
  if (dx > TOL || dy > TOL) {
    return `png ${actual.width}x${actual.height} 与 node bbox ${expectedW}x${expectedH} 相差 dx=${dx} dy=${dy} (兄弟节点溢出到 renderBounds?)`
  }
  return null
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
    // renderBounds 是 Figma 出图真实裁剪范围(含描边/投影/子元素溢出);
    // boundingBox 是名义框,遇 mask/clip 时会锁死 → 排查 PNG 尺寸不符预期时看前者
    const renderBounds = node.absoluteRenderBounds || null
    const boundingBox = node.absoluteBoundingBox || null
    out.push({
      id: node.id,
      name,
      parentName,
      pathStack: [...pathStack, name],
      renderBounds,
      boundingBox,
    })
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectSliceNodes(child, prefixes, out, [...pathStack, name], name)
    }
  }
  return out
}

// 基础文件名(不带父路径前缀,可能与其他节点撞):裸标签借父 name 拼,带子名去前缀 slug 化
// 冲突消解在 resolveFilenameCollisions() 里统一做,这里只出"意图名"
function baseFilename(name, parentName, nodeId) {
  const idSafe = String(nodeId || '').replace(/:/g, '_') || 'node'
  if (name === 'img' || name === 'bg') {
    const parentStripped = parentName
      ? parentName.replace(/^(img|bg|sub|block|scrollx|scrolly|fixed|end|btn|input|x)-/, '')
      : 'root'
    const parentSlug = slugForFilename(parentStripped, idSafe)
    return `${parentSlug}__${name}`
  }
  const stripped = name.replace(/^(img|bg)-/, '')
  return slugForFilename(stripped, idSafe)
}

// 收 pathStack 里除自身外最近的一层祖先 name 做前缀(跳过通用组名"编组"/"Group"及 slice 名自身)
// 目的:img-icon × 3 分处不同父 Frame → frame-722__icon / frame-726__icon / frame-730__icon
function parentPrefixSlug(pathStack, nodeId) {
  const idSafe = String(nodeId || '').replace(/:/g, '_') || 'node'
  const GENERIC = new Set(['编组', 'group', 'frame'])
  // pathStack 最后一项是自身 name,倒数第二项才是父;继续往上找到第一个非通用名
  for (let i = pathStack.length - 2; i >= 0; i--) {
    const raw = String(pathStack[i] || '').toLowerCase().trim()
    if (!raw) continue
    if (GENERIC.has(raw)) continue
    // "Frame 722" 这种带数字的具体名 → 保留;"编组 6" / "Group 12" → 也保留(数字给了区分度)
    const slug = slugForFilename(pathStack[i], idSafe)
    if (slug && slug !== idSafe) return slug
  }
  return idSafe  // 全是通用名兜底用 nodeId
}

// 冲突消解:同 basename 的 slice 依次加父路径前缀,极端撞名的兜底 nodeId
// 输入 slices 已经过 matchKey 去重(auto-layout 循环项之类),同 basename 只可能是"真的不同父路径下的同名"
function resolveFilenameCollisions(slices) {
  const byBase = new Map()
  for (const s of slices) {
    const base = baseFilename(s.name, s.parentName, s.id)
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base).push(s)
  }
  for (const [base, group] of byBase) {
    if (group.length === 1) {
      group[0].filename = base
      continue
    }
    // 撞车:每个都加父路径前缀
    const usedNames = new Map()
    for (const s of group) {
      const prefix = parentPrefixSlug(s.pathStack, s.id)
      let candidate = `${prefix}__${base}`
      // 极少数二次撞名(两个父路径 slug 又相同)→ nodeId 兜底
      if (usedNames.has(candidate)) {
        candidate = `${prefix}__${base}__${String(s.id).replace(/:/g, '_')}`
      }
      usedNames.set(candidate, true)
      s.filename = candidate
    }
  }
  return slices
}

// matchKey:恒用 <parent>||<name> 复合 key
// - 裸标签沿用旧语义
// - 带子名图层(img-icon / bg-card)也用父辅助 → 3 个同名 img-icon 分处不同父就是 3 个不同 key,都保留
// - aligned-to-base 模式下换肤稿若父 Frame 改名会 miss,这是应有的严格性(父路径漂移=对不齐)
function matchKey(name, parentName) {
  return `${parentName || 'root'}||${name}`
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

    // 同父下同名去重(默认不做,--dedupe-siblings 开启)。跨父同名恒保留(不同 matchKey)
    let dedupedList = sliceList
    if (args.dedupeSiblings) {
      const seenKeys = new Set()
      dedupedList = []
      for (const s of sliceList) {
        const k = matchKey(s.name, s.parentName)
        if (seenKeys.has(k)) continue
        seenKeys.add(k)
        s._matchKey = k
        dedupedList.push(s)
      }
    } else {
      // 不 dedup 也要挂 _matchKey,给下游对齐用(此时同 matchKey 的多项会共存)
      for (const s of sliceList) s._matchKey = matchKey(s.name, s.parentName)
    }
    // 冲突消解:同 basename 加父路径前缀,再次撞名兜底 nodeId
    uniqSlices = resolveFilenameCollisions(dedupedList)

    console.log(`[pp-d2c-reskin] 基线切图清单:${uniqSlices.length} 项(扫描到 ${sliceList.length}, dedupe-siblings=${args.dedupeSiblings ? 'on' : 'off'})`)
    for (const s of uniqSlices) {
      const rb = s.renderBounds
      const rTag = rb ? `render=${Math.round(rb.width)}x${Math.round(rb.height)}` : 'render=?'
      console.log(`  · ${s.name}  →  ${s.filename}.png  (nodeId=${s.id}, ${rTag})`)
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
      // 建换肤稿匹配表:同 matchKey 下的多个节点按遍历顺序收成数组
      // 基线里同结构 3 个 img-icon → 换肤稿也按顺序取对应 3 个,一对一
      const themeGroups = new Map()
      ;(function walk(n, parentName) {
        if (!n) return
        const name = n.name || ''
        if (name) {
          const key = matchKey(name, parentName)
          if (!themeGroups.has(key)) themeGroups.set(key, [])
          themeGroups.get(key).push(n.id)
        }
        if (Array.isArray(n.children)) n.children.forEach(c => walk(c, name))
      })(themeDoc, null)

      // 基线里同 matchKey 出现第几次,就取换肤稿数组里第几个
      const baseCursor = new Map()
      sliceItems = []
      for (const slice of uniqSlices) {
        const cursor = baseCursor.get(slice._matchKey) || 0
        baseCursor.set(slice._matchKey, cursor + 1)
        const themeArr = themeGroups.get(slice._matchKey) || []
        const themeNodeIdInSkin = themeArr[cursor]
        if (!themeNodeIdInSkin) {
          const detail = themeArr.length === 0
            ? '换肤稿无对应节点'
            : `换肤稿仅 ${themeArr.length} 个同结构节点,基线第 ${cursor + 1} 个无匹配`
          console.log(`  ? miss  ${slice.name}${slice.parentName ? ` (under ${slice.parentName})` : ''}  (${detail})`)
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
      // standalone:直接扫当前稿子;同结构 dedup 受 --dedupe-siblings 控制
      const selfList = collectSliceNodes(themeDoc, args.prefixes)
      let dedupedSelf = selfList
      if (args.dedupeSiblings) {
        const seenKeys = new Set()
        dedupedSelf = []
        for (const s of selfList) {
          const key = matchKey(s.name, s.parentName)
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          dedupedSelf.push(s)
        }
      }
      // 冲突消解后再落名(跨父同名 → 父路径前缀区分)
      const resolvedSelf = resolveFilenameCollisions(dedupedSelf)
      sliceItems = resolvedSelf.map(s => ({
        name: s.name,
        parentName: s.parentName,
        filename: s.filename,
        nodeId: s.id,
        renderBounds: s.renderBounds,
        boundingBox: s.boundingBox,
      }))
      console.log(`  自扫切图清单:${sliceItems.length} 项(扫描到 ${selfList.length}, dedupe-siblings=${args.dedupeSiblings ? 'on' : 'off'})`)
    }

    // 逐位切图(串行,避免 Figma /v1/images 并发限流)
    const hits = []
    const manifestEntries = []
    const sizeWarnings = []
    for (const item of sliceItems) {
      const destAbs = path.join(outDirAbs, `${item.filename}.png`)
      try {
        await exportImageToPath(themeFileKey, item.nodeId, token, destAbs)
        const destRel = path.relative(projectRoot, destAbs)
        const rb = item.renderBounds
        // aligned-to-base 场景下 item.renderBounds 未透传(用的是换肤稿节点),不打 render 尺寸
        const rTag = rb ? `  render=${Math.round(rb.width)}x${Math.round(rb.height)}` : ''
        console.log(`  · hit   ${item.name}  →  ${destRel}   (nodeId=${item.nodeId}${rTag})`)
        hits.push({ name: item.name, path: destRel })

        // v1.1.0 bg 溢出检测: png 尺寸应 ≈ node bbox × scale
        // 主要针对 bg-* 前缀: 如果 Figma 把兄弟节点溢出烤进 png, png 尺寸会明显大于 bbox
        const pseudoNode = item.boundingBox ? { absoluteBoundingBox: item.boundingBox } : null
        const warn = pseudoNode ? assertPngSize(destAbs, pseudoNode, 2) : null
        if (warn) {
          console.log(`    ⚠️  尺寸告警: ${warn}`)
          sizeWarnings.push({ nodeId: item.nodeId, name: item.name, reason: warn })
        }

        manifestEntries.push({
          nodeId: item.nodeId,
          name: item.name,
          parentName: item.parentName || null,
          filename: `${item.filename}.png`,
          filepath: destRel,
          renderWidth: rb ? Math.round(rb.width) : null,
          renderHeight: rb ? Math.round(rb.height) : null,
          bboxWidth: item.boundingBox ? Math.round(item.boundingBox.width) : null,
          bboxHeight: item.boundingBox ? Math.round(item.boundingBox.height) : null,
          sizeWarning: warn || null,
        })
      } catch (e) {
        console.log(`  × err   ${item.name}  (${e.message})`)
        missNames.push(`${item.name} (${e.message})`)
      }
    }

    reports.push({
      theme: theme.name, slug: theme.slug, outDir: outDirRel,
      hit: hits.length, miss: missNames.length, missNames,
      mode: hasBase ? 'aligned-to-base' : 'standalone',
      manifestEntries,
      sizeWarnings,
    })
    console.log(`  → ${theme.name}: hit=${hits.length}, ${hasBase ? 'miss' : 'err'}=${missNames.length}`)
  }

  // 汇总
  console.log('\n[pp-d2c-reskin] ── 汇总 ──')
  // 打时间戳给下游 agent 一个"本次跑的"标识,避免拿旧 PNG 当当前行为的证据
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`  产物写入时间: ${stamp}`)
  for (const r of reports) {
    const tag = r.error ? `× ${r.error}` : `✓ hit=${r.hit} ${r.mode === 'standalone' ? 'err' : 'miss'}=${r.miss} [${r.mode}]`
    console.log(`  ${r.theme.padEnd(20)}  ${tag}  ${r.outDir || ''}`)
    if (r.missNames?.length) {
      console.log(`    ${r.mode === 'standalone' ? 'errors' : 'missed'}: ${r.missNames.join(', ')}`)
    }
  }

  // v1.1.0: 写清单供 pp-d2c Step 1.5 消费
  if (args.outManifest) {
    // v1.2.5 确认留痕: 默认 confirmed:false,用户在步骤 2.6 确认后由 figma.mjs confirm-slices 翻 true;
    // pp-d2c.config.json 配 slice.confirmBeforeContinue === false(全自动流水)时直接落 true。
    let autoConfirm = false
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'pp-d2c.config.json'), 'utf8'))
      autoConfirm = cfg && cfg.slice && cfg.slice.confirmBeforeContinue === false
    } catch { /* 无 config 按需确认 */ }
    const manifest = {
      generatedAt: stamp,
      mode: hasBase ? 'aligned-to-base' : 'standalone',
      themes: reports
        .filter(r => !r.error)
        .map(r => ({
          slug: r.slug,
          outDir: r.outDir,
          hit: r.hit,
          miss: r.miss,
          confirmed: autoConfirm,
          entries: r.manifestEntries || [],
        })),
    }
    const manifestAbs = path.isAbsolute(args.outManifest)
      ? args.outManifest
      : path.resolve(projectRoot, args.outManifest)
    ensureDir(path.dirname(manifestAbs))
    fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2))
    console.log(`  切图清单: ${path.relative(projectRoot, manifestAbs)}`)
  }
}

main().catch(e => die(e.stack || e.message))
