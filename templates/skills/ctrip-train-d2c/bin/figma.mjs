#!/usr/bin/env node
// figma.mjs — Figma REST API 封装脚本
// 用途:把 SKILL.md 里"每次都让 LLM 手拼 curl / 手管缓存"的机械动作固化下来。
// 调用约定:
//   node figma.mjs <command> [args...] [--flag=value]
// 输出:
//   stdout 一行 JSON: {ok: true, data: {...}} 或 {ok: false, error: "..."}
//   退出码: 0 成功,非 0 失败
// 依赖: Node 18+ 内置 fetch,无 npm install

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const FIGMA_API = 'https://api.figma.com'
const MAX_RETRIES = 3

// ─── 工具 ────────────────────────────────────────────────────────

function output(obj) {
  console.log(JSON.stringify(obj))
  process.exit(obj.ok ? 0 : 1)
}

function fail(error, extra = {}) {
  output({ ok: false, error, ...extra })
}

function nodeIdSafe(nodeId) {
  return nodeId.replace(/:/g, '_')
}

function findProjectRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(dir, 'ctrip-train-d2c.config.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function loadConfig() {
  const projectRoot = findProjectRoot()
  if (!projectRoot) throw new Error('ctrip-train-d2c.config.json not found in cwd or ancestors')
  const cfg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'ctrip-train-d2c.config.json'), 'utf8'))
  return { config: cfg, projectRoot }
}

function parseFlags(argv) {
  const positional = []
  const flags = {}
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2]
    else positional.push(a)
  }
  return { positional, flags }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function cachePaths(projectRoot, fileKey) {
  const base = path.join(projectRoot, '.d2c-cache', fileKey)
  return {
    base,
    meta: path.join(base, 'meta.json'),
    nodesDir: path.join(base, 'nodes'),
    images: path.join(base, 'images.json'),
  }
}

function tmpScreenshotsDir(projectRoot) {
  return path.join(projectRoot, '.d2c-tmp', 'screenshots')
}

async function figmaFetch(pathAndQuery, token) {
  let lastErr
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${FIGMA_API}${pathAndQuery}`, {
        headers: { 'X-Figma-Token': token },
      })
      if (res.status === 401 || res.status === 403) {
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

// ─── 命令: verify-token ─────────────────────────────────────────

async function cmdVerifyToken() {
  const { config } = loadConfig()
  const token = config.figma?.token
  if (!token) return fail('figma.token 未在 ctrip-train-d2c.config.json 配置')
  try {
    const me = await figmaFetch('/v1/me', token)
    output({ ok: true, data: { email: me.email, handle: me.handle } })
  } catch (e) {
    fail(e.message)
  }
}

// ─── 命令: cache-check <fileKey> ────────────────────────────────

async function cmdCacheCheck(positional) {
  const [fileKey] = positional
  if (!fileKey) return fail('用法: figma cache-check <fileKey>')

  const { config, projectRoot } = loadConfig()
  const token = config.figma?.token
  if (!token) return fail('figma.token 未配置')

  const paths = cachePaths(projectRoot, fileKey)

  let remoteLastModified
  try {
    const meta = await figmaFetch(`/v1/files/${fileKey}?depth=1`, token)
    remoteLastModified = meta.lastModified
  } catch (e) {
    return fail(`拉取文件 metadata 失败: ${e.message}`)
  }

  let localLastModified = null
  if (fs.existsSync(paths.meta)) {
    try {
      localLastModified = JSON.parse(fs.readFileSync(paths.meta, 'utf8')).lastModified
    } catch { /* meta 损坏,视为无缓存 */ }
  }

  if (localLastModified === remoteLastModified) {
    return output({ ok: true, data: { status: 'hit', lastModified: remoteLastModified } })
  }

  // miss: 清空整份缓存,重建目录 + meta.json
  if (fs.existsSync(paths.base)) fs.rmSync(paths.base, { recursive: true, force: true })
  ensureDir(paths.nodesDir)
  fs.writeFileSync(paths.meta, JSON.stringify({
    lastModified: remoteLastModified,
    cachedAt: new Date().toISOString(),
  }, null, 2))
  fs.writeFileSync(paths.images, JSON.stringify({}, null, 2))

  output({
    ok: true,
    data: {
      status: 'miss',
      lastModified: remoteLastModified,
      previousLastModified: localLastModified,
    },
  })
}

// ─── 命令: fetch-node <fileKey> <nodeId> [--depth=N] ────────────

async function cmdFetchNode(positional, flags) {
  const [fileKey, nodeId] = positional
  if (!fileKey || !nodeId) return fail('用法: figma fetch-node <fileKey> <nodeId> [--depth=N]')

  const depth = flags.depth ? parseInt(flags.depth, 10) : undefined
  const { config, projectRoot } = loadConfig()
  const token = config.figma?.token
  if (!token) return fail('figma.token 未配置')

  const paths = cachePaths(projectRoot, fileKey)
  ensureDir(paths.nodesDir)
  const cacheFile = path.join(paths.nodesDir, `${nodeIdSafe(nodeId)}.json`)

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (!depth || (cached._depth && cached._depth >= depth)) {
        return output({ ok: true, data: { cached: true, node: cached.node } })
      }
    } catch { /* 缓存损坏,重拉 */ }
  }

  try {
    const q = new URLSearchParams({ ids: nodeId })
    if (depth) q.set('depth', String(depth))
    const resp = await figmaFetch(`/v1/files/${fileKey}/nodes?${q.toString()}`, token)
    const doc = resp.nodes?.[nodeId]?.document
    if (!doc) return fail(`节点 ${nodeId} 在文件 ${fileKey} 中未找到`)

    fs.writeFileSync(cacheFile, JSON.stringify({ _depth: depth || null, node: doc }, null, 2))
    output({ ok: true, data: { cached: false, node: doc } })
  } catch (e) {
    fail(e.message)
  }
}

// ─── 命令: export-image <fileKey> <nodeId> [--format=png] ───────

async function cmdExportImage(positional, flags) {
  const [fileKey, nodeId] = positional
  if (!fileKey || !nodeId) return fail('用法: figma export-image <fileKey> <nodeId> --filename=<name> [--format=png|svg] [--scale=1|2] [--preserve-effect]')

  const format = flags.format || 'png'
  const scale = flags.scale ? parseInt(flags.scale, 10) : 2
  const useAbsoluteBounds = !flags['preserve-effect']
  const filename = flags.filename
  if (!filename) return fail('缺少 --filename=<name>')

  const { config, projectRoot } = loadConfig()
  const token = config.figma?.token
  if (!token) return fail('figma.token 未配置')

  const assetsDir = config.images?.assetsDir || 'static/'
  const paths = cachePaths(projectRoot, fileKey)

  // 处理 projectRoot 与 assetsDir 之间的路径拼接(允许 assetsDir 以 / 开头)
  const localDir = path.join(projectRoot, assetsDir.replace(/^\//, ''))
  const ext = format === 'svg' ? 'svg' : format
  const localPath = path.join(localDir, `${filename}.${ext}`)

  // 存在即跳过: images.json 有记录 + 磁盘文件真实存在
  let imagesIndex = {}
  if (fs.existsSync(paths.images)) {
    try { imagesIndex = JSON.parse(fs.readFileSync(paths.images, 'utf8')) } catch {}
  }
  const cached = imagesIndex[nodeId]
  if (cached && cached.path && fs.existsSync(cached.path) && cached.format === format) {
    return output({ ok: true, data: { path: cached.path, reused: true, format } })
  }

  try {
    const q = new URLSearchParams({ ids: nodeId, format, scale: String(scale) })
    if (useAbsoluteBounds) q.set('use_absolute_bounds', 'true')
    if (format === 'svg') q.delete('scale')
    const resp = await figmaFetch(`/v1/images/${fileKey}?${q.toString()}`, token)
    const url = resp.images?.[nodeId]
    if (!url) return fail(`Figma /v1/images 未返回 ${nodeId} 的 URL`)

    ensureDir(localDir)
    await downloadToFile(url, localPath)

    imagesIndex[nodeId] = { path: localPath, format, filename: `${filename}.${ext}` }
    if (!fs.existsSync(paths.base)) ensureDir(paths.base)
    fs.writeFileSync(paths.images, JSON.stringify(imagesIndex, null, 2))

    output({ ok: true, data: { path: localPath, reused: false, format } })
  } catch (e) {
    fail(e.message)
  }
}

// ─── 命令: screenshot <fileKey> <nodeId> [--tag=leaf|whole|block] ─

async function cmdScreenshot(positional, flags) {
  const [fileKey, nodeId] = positional
  if (!fileKey || !nodeId) return fail('用法: figma screenshot <fileKey> <nodeId> [--tag=leaf|whole|block] [--scale=2]')

  const tag = flags.tag || 'block'
  const scale = flags.scale ? parseInt(flags.scale, 10) : 2

  const { config, projectRoot } = loadConfig()
  const token = config.figma?.token
  if (!token) return fail('figma.token 未配置')

  const dir = tmpScreenshotsDir(projectRoot)
  const destPath = path.join(dir, `${tag}-${nodeIdSafe(nodeId)}.png`)

  try {
    const q = new URLSearchParams({ ids: nodeId, format: 'png', scale: String(scale) })
    const resp = await figmaFetch(`/v1/images/${fileKey}?${q.toString()}`, token)
    const url = resp.images?.[nodeId]
    if (!url) return fail(`Figma /v1/images 未返回 ${nodeId} 的截图 URL`)
    await downloadToFile(url, destPath)
    output({ ok: true, data: { path: destPath, tag } })
  } catch (e) {
    fail(e.message)
  }
}

// ─── 命令: cleanup-tmp ──────────────────────────────────────────

function cmdCleanupTmp() {
  try {
    const { projectRoot } = loadConfig()
    const dir = tmpScreenshotsDir(projectRoot)
    const existed = fs.existsSync(dir)
    if (existed) fs.rmSync(dir, { recursive: true, force: true })
    output({ ok: true, data: { removed: existed, path: dir } })
  } catch (e) {
    fail(e.message)
  }
}

// ─── 分发 ──────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv
const { positional, flags } = parseFlags(rest)

const commands = {
  'verify-token': () => cmdVerifyToken(),
  'cache-check': () => cmdCacheCheck(positional),
  'fetch-node': () => cmdFetchNode(positional, flags),
  'export-image': () => cmdExportImage(positional, flags),
  'screenshot': () => cmdScreenshot(positional, flags),
  'cleanup-tmp': () => cmdCleanupTmp(),
}

if (!cmd || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
  console.error(`
figma.mjs — Figma REST API helper

用法:
  node figma.mjs verify-token
  node figma.mjs cache-check <fileKey>
  node figma.mjs fetch-node <fileKey> <nodeId> [--depth=N]
  node figma.mjs export-image <fileKey> <nodeId> --filename=<name> [--format=png|svg] [--scale=1|2] [--preserve-effect]
  node figma.mjs screenshot <fileKey> <nodeId> [--tag=leaf|whole|block] [--scale=2]
  node figma.mjs cleanup-tmp

所有命令都从 cwd 向上查找 ctrip-train-d2c.config.json 拿 figma.token 和 assetsDir。
输出统一为 stdout 一行 JSON: {ok: true, data: {...}} 或 {ok: false, error: "..."}。
退出码 0 表示成功,非零表示失败。
`)
  process.exit(2)
}

commands[cmd]().catch(e => fail(e.message || String(e)))
