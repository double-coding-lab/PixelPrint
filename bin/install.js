#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const TEMPLATES_DIR = path.join(__dirname, '../templates')
const CWD = process.cwd()
const CONFIG_PATH = path.join(CWD, 'pp-d2c.config.json')

// ─── argv 解析 ────────────────────────────────────────────────
// 支持 --key value / --key=value 两种写法;bool 短开关(--yes)也接受但目前未使用。
// 未知参数直接忽略,不报错(留给上游 pipeline 传扩展参数)。返回 { flag: value } 对象,
// 已知参数在 CLI_ARG_MAP 里显式列举,避免出现拼写错误默默失效。
const CLI_ARG_MAP = {
  'framework':          'framework',          // react | rn
  'style-format':       'styleFormat',        // scss / scss-modules / less / less-modules / css / css-modules / tailwind / inline
  'adapter-preset':     'adapterPreset',      // rn / taro / xtaro / off / custom
  'merge-mode':         'mergeMode',          // flat | component
  'figma-token':        'figmaToken',         // Figma Personal Access Token
  'figma-base':         'figmaBase',          // 设计稿基准宽度(px)
  'output-unit':        'outputUnit',         // px | vw | rem (仅 react)
  'output-base':        'outputBase',         // 输出基准宽度
  'responsive':         'responsive',         // on | off (仅 rn)
  'assets-dir':         'assetsDir',          // 图片输出目录
  'image-base-url':     'imageBaseUrl',       // 图片 base URL (仅 react)
  'output-dir':         'outputDir',          // 代码输出目录
  'rpx-helper-import':  'rpxHelperImport',    // rpx helper import 路径
  'rpx-helper-name':    'rpxHelperName',      // rpx helper 导出函数名
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    let key, value
    const eq = a.indexOf('=')
    if (eq > -1) {
      key = a.slice(2, eq)
      value = a.slice(eq + 1)
    } else {
      key = a.slice(2)
      const next = argv[i + 1]
      // 下一个 token 如果不是 -- 开头就当作值消费掉
      if (next !== undefined && !next.startsWith('--')) {
        value = next
        i++
      } else {
        value = ''
      }
    }
    const mapped = CLI_ARG_MAP[key]
    if (mapped) out[mapped] = value
    // 未知的 --xxx 静默忽略
  }
  return out
}

// ─── 文件操作 ────────────────────────────────────────────────

// 复制统计:silent=true 时不逐文件打印,只累加计数,由上层统一汇总。
// installFiles 用 silent 模式,把原来 5-10 行 overwrite/copy 日志收成一行"复制 N 个 skill 文件"。
// 独立场景(如 install 命令)仍走 silent=false,逐行日志便于排查。
const _copyStats = { copy: 0, overwrite: 0, skip: 0 }
function resetCopyStats() { _copyStats.copy = 0; _copyStats.overwrite = 0; _copyStats.skip = 0 }

function copyFile(src, dest, silent = false) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  if (fs.existsSync(dest)) {
    _copyStats.skip++
    if (!silent) console.log(`  skip  ${path.relative(CWD, dest)} (already exists)`)
    return
  }
  fs.copyFileSync(src, dest)
  _copyStats.copy++
  if (!silent) console.log(`  copy  ${path.relative(CWD, dest)}`)
}

function copyFileForce(src, dest, silent = false) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  _copyStats.overwrite++
  if (!silent) console.log(`  overwrite  ${path.relative(CWD, dest)}`)
}

// ─── .env 读写(极简,不引 dotenv) ─────────────────────────────
// 只处理 KEY=VALUE,支持 # 注释和引号;不做变量插值。与 figma.mjs::parseEnvFile 语义对齐
const ENV_PATH = path.join(CWD, '.env')

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return { lines: [], map: {} }
  const text = fs.readFileSync(ENV_PATH, 'utf8')
  const lines = text.split(/\r?\n/)
  const map = {}
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    map[m[1]] = val
  }
  return { lines, map }
}

// 追加或更新一个 key,保留其他行不动;value 含空格/引号时自动包双引号
// 原则:.env 已存在就往里写,不覆盖整份;同名 key 就地替换(如果新旧值不同才写 .env.bak,且 bak 不覆盖已有的老 bak)
function upsertEnvVar(key, value) {
  const exists = fs.existsSync(ENV_PATH)
  const needsQuote = /[\s"'#]/.test(value)
  const rendered = needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value
  const targetLine = `${key}=${rendered}`

  if (!exists) {
    fs.writeFileSync(ENV_PATH, targetLine + '\n')
    return { action: 'create' }
  }

  const text = fs.readFileSync(ENV_PATH, 'utf8')
  const lineRe = new RegExp(`^${key}\\s*=.*$`, 'm')
  if (lineRe.test(text)) {
    // 判断新旧值是否真变了,没变就完全不动
    const oldLine = text.match(lineRe)[0]
    if (oldLine === targetLine) return { action: 'unchanged' }
    // 变了才做原地替换;bak 只在不存在时才创建,避免连续跑 init 冲掉真正想恢复的老备份
    const bakPath = ENV_PATH + '.bak'
    if (!fs.existsSync(bakPath)) fs.writeFileSync(bakPath, text)
    const next = text.replace(lineRe, targetLine)
    fs.writeFileSync(ENV_PATH, next)
    return { action: 'replace', backup: fs.existsSync(bakPath) ? bakPath : null }
  }
  // 追加(确保前面有换行)
  const next = text.endsWith('\n') || text.length === 0 ? text + targetLine + '\n' : text + '\n' + targetLine + '\n'
  fs.writeFileSync(ENV_PATH, next)
  return { action: 'append' }
}

// 项目根 .gitignore 保证有 .env 行(否则 token 会被 git 追踪)
function ensureGitignoreHasEnv() {
  const gitignorePath = path.join(CWD, '.gitignore')
  const line = '.env'
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `# Local env (contains FIGMA_TOKEN — never commit)\n${line}\n`)
    console.log('  → 创建 .gitignore 并加入 .env')
    return
  }
  const text = fs.readFileSync(gitignorePath, 'utf8')
  const hasLine = text.split(/\r?\n/).some(l => l.trim() === line || l.trim() === line + '/')
  if (hasLine) return
  const next = text.endsWith('\n') ? text + `\n# Local env (contains FIGMA_TOKEN — never commit)\n${line}\n` : text + `\n\n# Local env (contains FIGMA_TOKEN — never commit)\n${line}\n`
  fs.writeFileSync(gitignorePath, next)
  console.log('  → .gitignore 追加 .env 行')
}

function copyDir(srcDir, destDir, force = false, silent = false) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest, force, silent)
    } else {
      force ? copyFileForce(src, dest, silent) : copyFile(src, dest, silent)
    }
  }
}

// 把 .d2c-cache/ 和 .d2c-tmp/ 追加到项目 .gitignore（已存在则跳过）
function ensureGitignoreEntries() {
  const gitignorePath = path.join(CWD, '.gitignore')
  const entries = ['.d2c-cache/', '.d2c-tmp/']
  const header = '# pp-d2c cache & temp'

  let existing = ''
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf8')
  }

  const lines = existing.split(/\r?\n/).map(l => l.trim())
  const hasEntry = e => lines.some(l => l === e || l === e.replace(/\/$/, ''))

  const missing = entries.filter(e => !hasEntry(e))
  if (missing.length === 0) {
    console.log('  skip  .gitignore (.d2c-cache/ / .d2c-tmp/ 已存在)')
    return
  }

  const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n')
  const appended = (needsLeadingNewline ? '\n' : '') +
    (existing.length > 0 ? '\n' : '') +
    header + '\n' + missing.join('\n') + '\n'

  fs.writeFileSync(gitignorePath, existing + appended)
  console.log(`  ${existing.length > 0 ? 'append' : 'create'}  .gitignore  (+ ${missing.join(' + ')})`)
}

function installFiles(forceSkills = false, skipConfig = false, options = {}) {
  const { skipRn = false, skipH5 = false, silent = false } = options
  if (!silent) console.log('\npp-d2c: installing files...\n')
  resetCopyStats()
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills')
  const skillsDst = path.join(CWD, '.claude/skills')
  // pp-style 是 pp-d2c 的规则速查手册,pp-doctor 是静态体检 skill;两者当前无独立触发入口、
  // 没有工具调用能力、内容与主 SKILL 重复,默认不落到用户项目。需要时把它们从
  // pp 仓 templates/skills/ 手工 cp 过来即可
  const OPT_IN_ONLY = new Set(['pp-style', 'pp-doctor'])
  const installedSkills = []
  for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    // 按 framework 对称过滤:h5 项目跳 pp-d2c-rn,rn 项目跳 pp-d2c
    // 目的是避免另一分支的主 SKILL 污染当前项目.claude/skills/,让 Claude Code
    // 只看到匹配当前 framework 的主 SKILL(pp-strip-nodeid / pp-fix-partial 等辅助 SKILL 两端通用,继续装)
    if (skipRn && entry.name === 'pp-d2c-rn') continue
    if (skipH5 && entry.name === 'pp-d2c') continue
    if (OPT_IN_ONLY.has(entry.name)) continue
    copyDir(path.join(skillsSrc, entry.name), path.join(skillsDst, entry.name), forceSkills, silent)
    installedSkills.push(entry.name)
  }
  if (!skipConfig) {
    copyFile(path.join(TEMPLATES_DIR, 'pp-d2c.config.json'), CONFIG_PATH, silent)
  }
  if (silent) {
    // 汇总一行:动词按主要动作挑(overwrite > copy > skip),文件总数 + skill 列表
    const total = _copyStats.copy + _copyStats.overwrite + _copyStats.skip
    const verb = _copyStats.overwrite > 0 ? '刷新' : _copyStats.copy > 0 ? '安装' : '跳过'
    console.log(`  ${verb} ${installedSkills.length} 个 skill(${installedSkills.join(' / ')}),共 ${total} 个文件到 .claude/skills/`)
  }
  if (!silent) console.log('')
}

// ─── 选择器（方向键 + 回车） ─────────────────────────────────
// choices 支持两种形态:
//   1) 字符串数组 ['a', 'b'] —— label 与 value 同源,无 hint
//   2) 对象数组 [{ value:'flat', hint:'单文件合并…(默认)' }] —— 值和展示文案解耦,hint 用灰色显示在选项右侧
// 返回值永远是选中项的 value(字符串数组模式下 value === 字符串本身)
function normalizeChoices(choices) {
  return choices.map(c => typeof c === 'string' ? { value: c, hint: '' } : { value: c.value, hint: c.hint || '' })
}

function select(label, choices, defaultVal) {
  return new Promise(resolve => {
    const norm = normalizeChoices(choices)
    let idx = Math.max(0, norm.findIndex(c => c.value === defaultVal))
    if (idx < 0) idx = 0
    let rendered = false
    // 多行渲染:label 一行 + 每个选项一行。上一版单行平铺遇到长选项会终端硬 wrap,
    // 只清 \r\x1b[K 清不到 wrap 出来的行 → 方向键切换时堆多行。改成回到起点用 \x1b[0J 清到底。
    const totalLines = norm.length + 1

    // 计算 value 列宽度,让 hint 对齐
    const maxValueLen = norm.reduce((m, c) => Math.max(m, c.value.length), 0)

    function renderLine(c, selected) {
      const marker = selected ? '  \x1b[36m●' : '   '
      const valueColored = selected ? `\x1b[36m${c.value}\x1b[0m` : c.value
      const pad = ' '.repeat(maxValueLen - c.value.length + 2)
      const hint = c.hint ? `\x1b[90m${c.hint}\x1b[0m` : ''
      return `${marker} ${valueColored}${pad}${hint}\n`
    }

    function render() {
      if (rendered) {
        // 光标上移 totalLines 行,再清到屏幕底部
        process.stdout.write(`\x1b[${totalLines}A\x1b[0J`)
      }
      process.stdout.write(`  ${label}:\n`)
      for (let i = 0; i < norm.length; i++) {
        process.stdout.write(renderLine(norm[i], i === idx))
      }
      rendered = true
    }

    render()

    const onData = buf => {
      const key = buf.toString()
      if (key === '\x1b[D' || key === '\x1b[A') {       // ← ↑
        idx = (idx - 1 + norm.length) % norm.length
        render()
      } else if (key === '\x1b[C' || key === '\x1b[B') { // → ↓
        idx = (idx + 1) % norm.length
        render()
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.removeListener('data', onData)
        process.stdin.pause()
        // 确认后擦掉多行菜单,换成单行 "label: 选中值 灰色hint"
        process.stdout.write(`\x1b[${totalLines}A\x1b[0J`)
        const chosen = norm[idx]
        const hintTail = chosen.hint ? ` \x1b[90m${chosen.hint}\x1b[0m` : ''
        process.stdout.write(`  ${label}: \x1b[36m${chosen.value}\x1b[0m${hintTail}\n`)
        resolve(chosen.value)
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function confirm(label, defaultNo = true) {
  const choices = defaultNo ? ['No', 'Yes'] : ['Yes', 'No']
  return select(label, choices, choices[0]).then(v => v === 'Yes')
}

function input(label, defaultVal) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`  ${label} [${defaultVal}]: `, answer => {
      rl.close()
      resolve(answer.trim() || defaultVal)
    })
  })
}

// ─── 已配置时跳过询问的辅助函数 ─────────────────────────────

function hasValue(v) {
  return v !== undefined && v !== null && v !== ''
}

function logUseExisting(label, value) {
  process.stdout.write(`  ${label}: \x1b[36m${value}\x1b[0m \x1b[90m(沿用现有配置)\x1b[0m\n`)
}

function logUseCli(label, value) {
  process.stdout.write(`  ${label}: \x1b[36m${value}\x1b[0m \x1b[90m(命令行参数)\x1b[0m\n`)
}

// 三个 or-use 系列统一 CLI > existing > 交互 的优先级。
// cliVal 是从 argv 解析出来的字符串,undefined 表示用户没在命令行传这项;传了但等于空字符串
// 视为"用户想清空",按 hasValue 规则由后续逻辑决定是否落到默认值(具体分支各自处理)。
async function pickOrUse(label, currentVal, choices, defaultVal, cliVal) {
  const values = choices.map(c => typeof c === 'string' ? c : c.value)
  if (hasValue(cliVal) && values.includes(cliVal)) {
    logUseCli(label, cliVal)
    return cliVal
  }
  if (hasValue(currentVal) && values.includes(currentVal)) {
    logUseExisting(label, currentVal)
    return currentVal
  }
  return await select(label, choices, defaultVal)
}

async function inputOrUse(label, currentVal, defaultVal, cliVal) {
  if (hasValue(cliVal)) {
    logUseCli(label, cliVal)
    return cliVal
  }
  if (hasValue(currentVal)) {
    logUseExisting(label, currentVal)
    return currentVal
  }
  return await input(label, defaultVal)
}

async function inputIntOrUse(label, currentVal, defaultVal, cliVal) {
  if (hasValue(cliVal) && Number.isFinite(Number(cliVal))) {
    logUseCli(label, cliVal)
    return Number(cliVal)
  }
  if (hasValue(currentVal) && Number.isFinite(Number(currentVal))) {
    logUseExisting(label, currentVal)
    return Number(currentVal)
  }
  return parseInt(await input(label, String(defaultVal))) || defaultVal
}

// ─── adapter 预设加载 ────────────────────────────────────
// 每个预设是 templates/adapter-presets/*.json,结构见该目录 README.md。
// 抽出成独立文件的动机:让外部团队加自己的映射不用改 install.js 常量,只加 JSON 就行。
const PRESETS_DIR = path.join(TEMPLATES_DIR, 'adapter-presets')

function loadAdapterPresets() {
  if (!fs.existsSync(PRESETS_DIR)) return []
  const list = []
  for (const entry of fs.readdirSync(PRESETS_DIR)) {
    if (!entry.endsWith('.json')) continue
    try {
      const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, entry), 'utf8'))
      // _sourceFile 记录 JSON 文件名(含扩展名),供 CLI --adapter-preset 反查 preset id 使用
      if (preset && preset.name && preset.adapter) {
        preset._sourceFile = entry
        list.push(preset)
      }
    } catch (e) {
      console.warn(`  ⚠️  adapter-presets/${entry} 解析失败,跳过: ${e.message}`)
    }
  }
  return list
}

// ─── 交互式配置 ──────────────────────────────────────────────

async function runInit(cliArgs = {}) {
  // 先读现有 config（init 自己生成 config，不能让 installFiles 提前复制 templates 模板污染 existing）
  let existing = {}
  if (fs.existsSync(CONFIG_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch {}
  }

  const p = existing.project || {}
  const m = existing.merge || {}
  const img = existing.images || {}
  const u = existing.unit || {}
  const fig = existing.figma || {}
  const out = existing.output || {}

  // 检查已有 token(env / .env / 旧 config / CLI --figma-token),有的话就跳过完整劝导,只留一行提示
  const preexistingToken = process.env.FIGMA_TOKEN || readEnvFile().map.FIGMA_TOKEN || fig.token || cliArgs.figmaToken
  if (preexistingToken) {
    console.log('─── 阶段一:Figma Token ─────────────────────────────\n')
    console.log('  ✓ 检测到已配置的 FIGMA_TOKEN,阶段三会沿用(如需换 token,重跑并传 --figma-token)\n')
  } else {
    console.log('─── 阶段一:Figma Token 生成指南 ────────────────────\n')
    console.log('  v0.3 起完全走 Figma REST API,只需一个 Personal Access Token(阶段三输入):')
    console.log('    1. 打开 https://www.figma.com/ 登录 → 头像 → Settings → Security')
    console.log('    2. Personal access tokens → Generate new token')
    console.log('    3. 权限勾选 "File content: Read-only",复制 token(离开无法再看)\n')
  }

  console.log('─── 阶段二:交互式配置 ──────────────────────────────\n')

  // ─── 平铺项目框架 + 方案 ──────────────────────────────
  // 把 H5(React)的样式方案 + RN 的 adapter 预设全部铺开成同一层选项,
  // 用户一次选中就同时敲定 framework / styleFormat(H5)/ adapterCfg(RN),
  // 后续 [2a/2b/2c] 或 [2.1] 子问题不再分开问。
  const presets = loadAdapterPresets()
  const flatOptions = []
  // H5 stylesheet 变体:三种预处理语法 × 两种 modules(scss/less/css × 是否 modules)
  for (const syn of ['scss', 'less', 'css']) {
    flatOptions.push({ label: `React / ${syn.toUpperCase()}`, framework: 'react', styleFormat: syn })
    flatOptions.push({ label: `React / ${syn.toUpperCase()} Modules`, framework: 'react', styleFormat: `${syn}-modules` })
  }
  flatOptions.push({ label: 'React / Tailwind', framework: 'react', styleFormat: 'tailwind' })
  flatOptions.push({ label: 'React / Inline Style', framework: 'react', styleFormat: 'inline' })
  // RN 各 preset,再加"自定义"/"不启用"两个兜底
  for (const preset of presets) {
    // preset.json 里 name 形如 "pure React Native / Expo",这里取文件名做 CLI 标识(rn / taro / xtaro),
    // 避免中文 / 特殊字符出现在 --adapter-preset 值里
    const presetId = path.basename(preset._sourceFile || '', '.json') || preset.name.toLowerCase()
    flatOptions.push({ label: `RN / ${preset.name}`, framework: 'rn', adapterKind: 'preset', preset, presetId })
  }
  flatOptions.push({ label: 'RN / 自定义标签映射(后续手填)', framework: 'rn', adapterKind: 'custom', presetId: 'custom' })
  flatOptions.push({ label: 'RN / 不启用组件映射(保留 RN 原写法)', framework: 'rn', adapterKind: 'off', presetId: 'off' })

  // CLI 参数反查:优先级最高
  // --framework=react --style-format=scss → 命中 React / SCSS
  // --framework=rn --adapter-preset=xtaro → 命中 RN / 携程 xtaro
  let cliLabel = null
  if (hasValue(cliArgs.framework)) {
    if (cliArgs.framework === 'react') {
      const sf = cliArgs.styleFormat
      const hit = hasValue(sf) ? flatOptions.find(o => o.framework === 'react' && o.styleFormat === sf) : null
      if (hit) cliLabel = hit.label
      else if (hasValue(sf)) console.warn(`  ⚠️  --style-format=${sf} 在 React 分支下没有匹配预设,忽略 CLI 命中,回退交互`)
    } else if (cliArgs.framework === 'rn') {
      const pid = cliArgs.adapterPreset
      const hit = hasValue(pid) ? flatOptions.find(o => o.framework === 'rn' && o.presetId === pid) : null
      if (hit) cliLabel = hit.label
      else if (hasValue(pid)) console.warn(`  ⚠️  --adapter-preset=${pid} 无法匹配已加载的 RN 预设(可选值:${flatOptions.filter(o => o.framework === 'rn').map(o => o.presetId).join(' / ')}),忽略 CLI 命中,回退交互`)
    } else {
      console.warn(`  ⚠️  --framework=${cliArgs.framework} 无效(可选 react / rn),忽略 CLI 命中,回退交互`)
    }
  }

  // 反推现有 config 对应的平铺项 label(能命中就走"沿用",避免每次 init 都重选)
  let existingLabel = null
  if (p.framework === 'react') {
    const found = flatOptions.find(o => o.framework === 'react' && o.styleFormat === p.styleFormat)
    if (found) existingLabel = found.label
  } else if (p.framework === 'rn') {
    const ad = existing.adapter || {}
    const hasMap = ad.tagMap && Object.keys(ad.tagMap).length > 0
    if (ad.enabled === false) {
      existingLabel = flatOptions.find(o => o.adapterKind === 'off')?.label
    } else if (!hasMap) {
      existingLabel = flatOptions.find(o => o.adapterKind === 'custom')?.label
    } else {
      // 按 View 目标标签反查匹配 preset
      const viewTarget = ad.tagMap.View
      const hit = flatOptions.find(o => o.preset && o.preset.adapter && o.preset.adapter.tagMap && o.preset.adapter.tagMap.View === viewTarget)
      if (hit) existingLabel = hit.label
    }
  }

  let selectedLabel, isReused = false
  const flatLabels = flatOptions.map(o => o.label)
  if (cliLabel) {
    logUseCli('[1/6] 项目框架 + 方案', cliLabel)
    selectedLabel = cliLabel
    // CLI 命中时 isReused 保持 false,让 rn 分支走"重新按 preset 组装 adapterCfg"分支,
    // 而不是走"沿用旧 config.adapter"分支——用户显式换 preset 就是要覆盖旧映射
  } else if (existingLabel) {
    logUseExisting('[1/6] 项目框架 + 方案', existingLabel)
    selectedLabel = existingLabel
    isReused = true
  } else {
    selectedLabel = await select('[1/6] 项目框架 + 方案', flatLabels, flatLabels[0])
  }
  const selectedOpt = flatOptions.find(o => o.label === selectedLabel)
  const framework = selectedOpt.framework

  // 选完 framework 才复制 SKILL(h5 项目跳 pp-d2c-rn,rn 项目跳 pp-d2c;避免另一分支主 SKILL 污染)
  installFiles(true, true, { skipRn: framework !== 'rn', skipH5: framework === 'rn', silent: true })

  let styleFormat
  let adapterCfg = null
  let pickedPreset = null
  let responsiveCfg = null

  if (framework === 'rn') {
    // rn 分支样式方案写死 stylesheet(StyleSheet.create + 行内 style)
    styleFormat = 'stylesheet'

    // 从平铺项组装 adapterCfg
    // 若是沿用已有 config 且 adapter 存在 → 保留用户可能的手动定制(propMap/importMap)
    if (isReused && existing.adapter && (existing.adapter.tagMap || existing.adapter.enabled === false)) {
      const oldAd = existing.adapter
      adapterCfg = {
        enabled: oldAd.enabled !== false,
        tagMap: oldAd.tagMap || {},
        importMap: oldAd.importMap || {},
        propMap: oldAd.propMap || {},
        reactImport: oldAd.reactImport || 'react'
      }
      if (oldAd.referenceDoc) adapterCfg.referenceDoc = oldAd.referenceDoc
      if (oldAd._presetSource) adapterCfg._presetSource = oldAd._presetSource
      // 兜底补齐 referenceDoc / _presetSource(v1.0.1 之前 install.js 漏写)
      if (selectedOpt.preset && (!adapterCfg.referenceDoc || !adapterCfg._presetSource)) {
        if (!adapterCfg.referenceDoc && selectedOpt.preset.referenceDoc) adapterCfg.referenceDoc = selectedOpt.preset.referenceDoc
        if (!adapterCfg._presetSource) adapterCfg._presetSource = PRESETS_DIR
        console.log(`  → 补齐 adapter.referenceDoc / _presetSource(匹配 ${selectedOpt.preset.name} 预设)`)
      }
      if (selectedOpt.preset) pickedPreset = selectedOpt.preset
    } else if (selectedOpt.adapterKind === 'off') {
      adapterCfg = { enabled: false, tagMap: {}, importMap: {}, propMap: {}, reactImport: 'react' }
    } else if (selectedOpt.adapterKind === 'custom') {
      // 给 6 键 tagMap 骨架 + 空 importMap / propMap,让用户手动填目标标签名 / import 源 / prop 重命名。
      // 空字符串比缺键更好——config schema 保持稳定,pp-d2c-rn SKILL 检测到空串会报错提示补齐,不会当成 preset 命中。
      adapterCfg = {
        enabled: true,
        tagMap: {
          View: '',
          Text: '',
          Image: '',
          Pressable: '',
          TextInput: '',
          ScrollView: ''
        },
        importMap: {},
        propMap: {},
        reactImport: 'react'
      }
      console.log('  → adapter.enabled=true,已生成 6 键空 tagMap 骨架,请在 pp-d2c.config.json 里填入目标标签 / importMap / propMap')
    } else {
      const hit = selectedOpt.preset
      adapterCfg = { ...hit.adapter }
      if (hit.referenceDoc) adapterCfg.referenceDoc = hit.referenceDoc
      adapterCfg._presetSource = PRESETS_DIR
      pickedPreset = hit
      console.log(`  → 已写入 ${hit.name} 预设(${hit.description || '见 templates/adapter-presets/README.md'})`)
    }

    // ─── 响应式 rpx() 包装引导 ─────────────────────────
    const existingUnit = existing.unit || {}
    const existingResp = existingUnit.responsive || {}
    const existingRespYn = existingResp.enabled === true ? 'Yes' : existingResp.enabled === false ? 'No' : null
    // --responsive on|off 映射到 Yes/No,其他值(包括空字符串)当作未传
    const cliRespYn = cliArgs.responsive === 'on' ? 'Yes' : cliArgs.responsive === 'off' ? 'No' : undefined
    const enableRespYn = await pickOrUse(
      '[2/6] 是否启用响应式 rpx() 包装(按屏宽线性缩放尺寸)',
      existingRespYn, ['Yes', 'No'], 'Yes', cliRespYn
    )
    if (enableRespYn === 'Yes') {
      const helperImport = await inputOrUse('[2.1/6] rpx helper import 路径', existingResp.helperImport, '@/utils/rpx', cliArgs.rpxHelperImport)
      const helperName = await inputOrUse('[2.2/6] rpx helper 导出函数名', existingResp.helperName, 'rpx', cliArgs.rpxHelperName)
      responsiveCfg = { enabled: true, helperImport, helperName }
    } else {
      responsiveCfg = { enabled: false, helperImport: '@/utils/rpx', helperName: 'rpx' }
    }
  } else {
    // react 分支的 styleFormat 已在 [1/6] 里选完,这里只做展示不再交互
    styleFormat = selectedOpt.styleFormat
    console.log(`  [2/6] 样式方案: \x1b[36m${styleFormat}\x1b[0m \x1b[90m(在 [1/6] 里已选定,不再单独询问)\x1b[0m`)
  }

  const mergeMode = await pickOrUse('[3/6] 合并模式', m.mode, [
    { value: 'flat',      hint: '单文件合并,所有子 block 展开到主文件(默认)' },
    { value: 'component', hint: '组件化拆分,每个子 block 独立目录' }
  ], 'flat', cliArgs.mergeMode)

  // rn / react 分支的默认值分叉:
  // - rn 项目走 require('./assets/xxx.png') 编译期路径,imageBaseUrl 为空,assetsDir 固定 assets/,代码在 src/pages/
  // - react (h5) 项目走远程 URL, static/ + http://127... 是老约定
  const isRn = framework === 'rn'
  const defaultAssetsDir   = isRn ? 'assets/'    : 'static/'
  const defaultImageBaseUrl= isRn ? ''            : 'http://127.0.0.1:8080/'
  const defaultOutputDir   = isRn ? 'src/pages/'  : 'pages/'

  // 图片输出目录 rn/react 都作为输入题:
  // rn 默认 assets/(项目根 assets),但各家 RN 项目目录组织不同(如 src/assets/、src/Images/<页面>/)
  // 强制写死会绑架用户,保留输入让用户能改。imageBaseUrl 才是真正的 rn 特化项(走 require 不走 URL)。
  const assetsDir = await inputOrUse('[4/6] 图片输出目录', img.assetsDir, defaultAssetsDir, cliArgs.assetsDir)

  // rn 分支:图片 base URL 固定为空,不再询问
  let imageBaseUrl
  if (isRn) {
    imageBaseUrl = ''
    console.log(`  [5/6] 图片 base URL: \x1b[36m(空)\x1b[0m \x1b[90m(rn 分支走 require 引用,不用远程 URL)\x1b[0m`)
  } else {
    imageBaseUrl = await inputOrUse('[5/6] 图片 base URL', img.imageBaseUrl, defaultImageBaseUrl, cliArgs.imageBaseUrl)
  }

  const outputDir = await inputOrUse('[6/6] 代码输出目录', out.dir, defaultOutputDir, cliArgs.outputDir)

  console.log('\n─── 阶段三：单位换算规则 ────────────────────────────\n')
  console.log('  使用 ← → 方向键选择，输入题直接回车使用默认值\n')

  const figmaBase = await inputIntOrUse(
    isRn ? '[单位1/2] 设计稿基准宽度 (px)' : '[单位1/4] 设计稿基准宽度 (px)',
    u.figmaBase, 375, cliArgs.figmaBase
  )

  let outputUnit, outputBase, scale
  if (isRn) {
    // rn 分支:不问单位、不问输出基准
    // - RN style 数值就是数字(iOS pt / Android dp),没有 px/vw/rem 概念
    // - outputBase 永远等于 figmaBase,scale 永远 1(Figma 里画的数字直接就是 rn 产物里的数字)
    outputUnit = 'px'      // 内部标记为 px 表示"数字模式",不代表输出带 px 单位字符串
    outputBase = figmaBase
    scale = 1
    console.log(`  [单位2/2] 换算:\x1b[36mRN 数字模式(scale=1,figmaBase=${figmaBase} pt)\x1b[0m \x1b[90m(rn 分支固定,不做 px/vw/rem 单位选择)\x1b[0m`)
  } else {
    outputUnit = await pickOrUse('[单位2/4] 代码使用的单位', u.outputUnit, ['px', 'vw', 'rem'], 'px', cliArgs.outputUnit)
    if (outputUnit === 'px') {
      outputBase = await inputIntOrUse('[单位3/4] 代码 px 基准宽度(如 postcss px2vw 基于 750 则填 750)', u.outputBase, figmaBase * 2, cliArgs.outputBase)
      scale = outputBase / figmaBase
      console.log(`  → 换算倍数:×${scale}(Figma ${figmaBase}px → 代码 ${figmaBase * scale}px)`)
    } else if (outputUnit === 'vw') {
      outputBase = await inputIntOrUse('[单位3/4] vw 基准宽度(100vw 对应多少 px)', u.outputBase, figmaBase, cliArgs.outputBase)
      scale = outputBase / figmaBase
      console.log(`  → 换算:Figma ${figmaBase}px → ${(figmaBase * scale / outputBase * 100).toFixed(3)}vw`)
    } else {
      outputBase = await inputIntOrUse('[单位3/4] rem 基准(1rem = 多少 px)', u.outputBase, 16, cliArgs.outputBase)
      scale = 1
      console.log(`  → 换算:Figma 值 / ${outputBase} rem`)
    }
  }

  // Figma Token 现在存 .env FIGMA_TOKEN,不再写入 pp-d2c.config.json
  // 默认值优先级:process.env > 项目根 .env > 旧 config.figma.token(迁移场景)
  const envCurrent = readEnvFile().map.FIGMA_TOKEN || ''
  const legacyTokenInConfig = fig.token || ''
  const defaultToken = process.env.FIGMA_TOKEN || envCurrent || legacyTokenInConfig
  const figmaToken = await inputOrUse(
    isRn ? '[单位2/2] Figma Personal Access Token(存到项目根 .env,回车跳过)'
         : '[单位4/4] Figma Personal Access Token(存到项目根 .env,回车跳过)',
    defaultToken, '', cliArgs.figmaToken
  )

  // 落盘 .env + 保证 .gitignore 屏蔽 .env
  if (figmaToken) {
    const r = upsertEnvVar('FIGMA_TOKEN', figmaToken)
    if (r.action === 'create') console.log('  ✓ 已创建 .env 并写入 FIGMA_TOKEN=<hidden>')
    else if (r.action === 'append') console.log('  ✓ 已向现有 .env 追加 FIGMA_TOKEN=<hidden>')
    else if (r.action === 'unchanged') console.log('  ✓ .env 中 FIGMA_TOKEN 已是最新值,未改动')
    else {
      const bakHint = r.backup ? `(原值备份到 ${path.relative(CWD, r.backup)})` : '(存在 .env.bak,保留旧备份)'
      console.log(`  ✓ 已更新现有 .env 中的 FIGMA_TOKEN=<hidden> ${bakHint}`)
    }
    ensureGitignoreHasEnv()
    if (legacyTokenInConfig) {
      console.log('  → 检测到旧 pp-d2c.config.json 里的 figma.token,已迁移到 .env,config 中将移除 figma 段')
    }
  } else {
    console.log('  ⚠️  未填 FIGMA_TOKEN,后续切图会失败;可手动编辑项目根 .env 补上')
  }

  const config = {
    version: '2.0.0',
    project: { name: path.basename(CWD), framework, styleFormat },
    merge: { mode: mergeMode },
    unit: framework === 'rn'
      ? { figmaBase, outputUnit, outputBase, scale, responsive: responsiveCfg }
      : { figmaBase, outputUnit, outputBase, scale },
    images: {
      assetsDir,
      imageBaseUrl,
      preserveEffectIds: existing.images?.preserveEffectIds || []
    },
    layers: {
      sub: 'sub-',
      block: 'block-',
      img: 'img-',
      bg: 'bg-',
      bgColor: 'bgc-',
      but: 'btn-',
      scrollX: 'scrollx-',
      scrollY: 'scrolly-',
      fixed: 'fixed-',
      end: 'end-',
      input: 'input-',
      ignore: 'x-',
      ...(existing.layers || {})
    },
    output: { dir: outputDir },
    // rn 项目默认关闭 doctor(不接卫星 SKILL);react 项目保留完整 health 段
    health: framework === 'rn'
      ? (existing.health || { enabled: false })
      : (existing.health || {
        enabled: true,
        blockOnError: true,
        report: { markdown: true, json: true, dir: '' },
        thresholds: {
          maxDepth: 6, subBlockMin: 3, subBlockMax: 20, totalNodesMax: 1500,
          hiddenRatioMax: 0.2, paddingAsymmetryMax: 32,
          bgSizeMin: 0.8, bgSizeMax: 1.2, colorDeltaEMin: 3
        },
        rules: {}
      }),
    // 【新增】rn 分支写 adapter 段;react 项目不写
    ...(framework === 'rn' ? { adapter: adapterCfg } : {})
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  console.log('\n  ✓ pp-d2c.config.json 已写入')

  // rn + 响应式启用时,复制 rpx helper 到项目(存在则跳过,不覆盖用户自定义)
  // 落地路径按 helperImport 反推:
  //   `@/utils/rpx` → `src/utils/rpx.ts`(默认约定 @ 指向 src)
  //   相对路径开头(如 `./utils/rpx`) → 走 CWD + 该路径
  //   绝对 npm 包名(如 `@mylib/rpx`)→ 认为是外部包,不落地文件
  if (framework === 'rn' && responsiveCfg && responsiveCfg.enabled) {
    // helper 源文件优先级:
    //   1. 命中预设且预设声明了 helperTemplate → adapter-presets/<helperTemplate>
    //      (例: xtaro 预设走 xtaro.rpx.ts,内部用 Taro.getSystemInfoSync 而非 Dimensions,
    //      因为 xtaro H5 端 webpack 不解析 react-native 的 Flow 语法)
    //   2. 无预设或预设没声明 helperTemplate → rn-helpers/rpx.ts(pure RN 默认版)
    let helperTemplate = path.join(TEMPLATES_DIR, 'rn-helpers/rpx.ts')
    if (pickedPreset && pickedPreset.helperTemplate) {
      const presetHelper = path.join(PRESETS_DIR, pickedPreset.helperTemplate)
      if (fs.existsSync(presetHelper)) {
        helperTemplate = presetHelper
        console.log(`  info  使用预设自带 helper 模板:${pickedPreset.helperTemplate}`)
      } else {
        console.warn(`  ⚠️  预设 ${pickedPreset.name} 声明 helperTemplate=${pickedPreset.helperTemplate} 但文件不存在,回退到默认 pure RN 模板`)
      }
    }
    let destRel = null
    const imp = responsiveCfg.helperImport
    if (imp.startsWith('@/')) {
      destRel = path.join('src', imp.slice(2) + '.ts')
    } else if (imp.startsWith('./') || imp.startsWith('../')) {
      destRel = imp + '.ts'
    } else if (imp.startsWith('/')) {
      destRel = imp.slice(1) + '.ts'
    }
    // 其他形式(npm 包名如 `@ctrip/rpx`)不落地文件,只在 SKILL 里作为 import 源引用
    if (destRel) {
      const dest = path.join(CWD, destRel)
      if (fs.existsSync(dest)) {
        console.log(`  skip  ${destRel} (rpx helper 已存在,保留你的自定义实现)`)
      } else {
        const helperSrc = fs.readFileSync(helperTemplate, 'utf8')
          // 替换 helper 模板里的默认 rpx 函数名为 config 里的自定义名字(如果用户改过)
          .replace(/export function rpx\(/g, `export function ${responsiveCfg.helperName}(`)
          // 替换 DESIGN_BASE 常量为实际 figmaBase
          .replace(/^const DESIGN_BASE = 375$/m, `const DESIGN_BASE = ${figmaBase}`)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, helperSrc)
        console.log(`  create  ${destRel}(rpx helper,基准 ${figmaBase}pt,函数名 ${responsiveCfg.helperName})`)
      }
    } else {
      console.log(`  info  helperImport "${imp}" 看起来是外部包,SKILL 会按此路径引用,不落地本地 helper 文件`)
    }
  }

  // 将单位规则注入主 Skill(按 framework 分叉:react → h5 SKILL;rn → rn SKILL)
  const skillPath = framework === 'rn'
    ? path.join(CWD, '.claude/skills/pp-d2c-rn/SKILL.md')
    : path.join(CWD, '.claude/skills/pp-d2c/SKILL.md')
  if (fs.existsSync(skillPath)) {
    let skillContent = fs.readFileSync(skillPath, 'utf8')
    const unitExample = outputUnit === 'px'
      ? `Figma \`16px\` → 代码写 \`${16 * scale}px\``
      : outputUnit === 'vw'
      ? `Figma \`${outputBase}px\` → 代码写 \`${(outputBase * scale / outputBase * 100).toFixed(3)}vw\``
      : `Figma \`${outputBase}px\` → 代码写 \`1rem\``
    const section = `\n## 项目个性化规则\n> 由 npx @double-coding/pixel-print init 生成，重新执行可更新。\n\n### 单位换算\n- 设计稿基准：${figmaBase}px\n- 代码单位：${outputUnit}，基准：${outputBase}\n- 换算倍数：×${scale}\n- 示例：${unitExample}\n`
    const marker = '\n## 项目个性化规则'
    skillContent = skillContent.includes(marker)
      ? skillContent.slice(0, skillContent.indexOf(marker)) + section
      : skillContent + section
    fs.writeFileSync(skillPath, skillContent)
    console.log(`  ✓ 单位换算规则已注入 ${path.relative(CWD, skillPath)}`)
  }

  console.log('\n─── 阶段四:追加 .gitignore ─────────────────────────\n')
  ensureGitignoreEntries()

  console.log('\n─── 完成 ────────────────────────────────────────────\n')
  console.log(`  ✓ pp-d2c.config.json    framework=${framework} · merge=${mergeMode} · unit=${outputUnit}(base ${outputBase}) · out=${outputDir}`)
  if (framework === 'rn') {
    // adapter 摘要:preset 用 preset name,custom 提示 6 键待填,off 说明关闭
    const ad = config.adapter
    let adapterLine
    if (ad.enabled === false) adapterLine = 'off(保留 RN 原写法)'
    else if (pickedPreset) adapterLine = `${pickedPreset.name}`
    else adapterLine = '自定义(config.adapter.tagMap 6 键待填)'
    console.log(`  ✓ adapter               ${adapterLine}`)
    if (responsiveCfg && responsiveCfg.enabled) {
      console.log(`  ✓ 响应式 rpx()          ${responsiveCfg.helperImport} · ${responsiveCfg.helperName}()`)
    }
  }
  console.log(`  ✓ .env                  FIGMA_TOKEN ${figmaToken ? '已写入' : '未配置(切图前手动补上)'}`)
  console.log(`  ✓ .gitignore            .d2c-cache/ · .d2c-tmp/ · .env`)
  console.log('\n  把设计稿链接发给 Claude 即可开始生成,例:')
  console.log('    把这份设计稿转成代码:https://figma.com/design/xxx?node-id=1-2\n')
}

// ─── clean-cache ─────────────────────────────────────────────
// 递归删除 .d2c-cache/(figma / images / anchors / last-page.json)。
// 用途:hash 对比坏了、缓存污染,或用户想彻底重来。
// 与主 SKILL "SKILL 结束时的清理动作"分工:主 SKILL 只清 .d2c-tmp/screenshots/,
// 本命令是 .d2c-cache/ 的显式手动清理入口。

function rmDirRecursive(dir) {
  if (!fs.existsSync(dir)) return { removed: false }
  fs.rmSync(dir, { recursive: true, force: true })
  return { removed: true }
}

function runCleanCache() {
  const cacheDir = path.join(CWD, '.d2c-cache')
  console.log('\npp-d2c clean-cache: 清理 .d2c-cache/ 目录\n')
  if (!fs.existsSync(cacheDir)) {
    console.log(`  info  ${path.relative(CWD, cacheDir) || '.d2c-cache'} 不存在,无需清理\n`)
    return
  }
  // 列一下清理前的内容,让用户知道删了什么
  const items = []
  for (const sub of ['figma', 'images', 'anchors']) {
    const p = path.join(cacheDir, sub)
    if (fs.existsSync(p)) {
      const count = fs.readdirSync(p).length
      items.push(`  · ${sub}/ (${count} 项)`)
    }
  }
  const lastPage = path.join(cacheDir, 'last-page.json')
  if (fs.existsSync(lastPage)) items.push('  · last-page.json')
  if (items.length > 0) {
    console.log('  待清理内容:')
    items.forEach(l => console.log(l))
  }
  rmDirRecursive(cacheDir)
  console.log(`\n  ✓ 已清理 ${path.relative(CWD, cacheDir) || '.d2c-cache'} 及其全部内容\n`)
  console.log('  info  下次跑 pp-d2c / pp-d2c-rn 会重新拉 figma 元数据 + 重导图片(不复用旧缓存)\n')
}

// ─── 入口 ────────────────────────────────────────────────────

const cmd = process.argv[2]
const rest = process.argv.slice(3)

function printHelp() {
  console.log(`
Usage:
  npx @double-coding/pixel-print init [options]   交互式初始化项目（推荐）
  npx @double-coding/pixel-print install          仅复制模板文件，不进入交互
  npx @double-coding/pixel-print clean-cache      清理 .d2c-cache/(figma / images / anchors / last-page.json)
  npx @double-coding/pixel-print help             显示本帮助

init 支持的 CLI 快捷参数（未传的项照常进入交互;CLI > 现有 config > 交互输入）:
  --framework <react|rn>                  项目框架
  --style-format <scss|scss-modules|less|less-modules|css|css-modules|tailwind|inline>
                                          React 分支样式方案(rn 忽略,固定 stylesheet)
  --adapter-preset <rn|taro|xtaro|off|custom>
                                          RN 组件映射预设(react 忽略)
  --merge-mode <flat|component>           合并模式(默认 flat)
  --figma-token <TOKEN>                   Figma Personal Access Token(写入 .env)
  --figma-base <PX>                       设计稿基准宽度,默认 375
  --output-unit <px|vw|rem>               代码单位(仅 react)
  --output-base <PX>                      输出基准宽度
  --responsive <on|off>                   是否启用 rpx 响应式包装(仅 rn)
  --assets-dir <PATH>                     图片输出目录
  --image-base-url <URL>                  图片 base URL(仅 react)
  --output-dir <PATH>                     代码输出目录
  --rpx-helper-import <PATH>              rpx helper import 路径(仅 rn + responsive)
  --rpx-helper-name <NAME>                rpx helper 导出函数名(仅 rn + responsive)

例:
  npx @double-coding/pixel-print init --framework rn --adapter-preset xtaro --merge-mode flat
  npx @double-coding/pixel-print init --framework react --style-format scss --output-unit vw --output-base 750
`)
}

if (cmd === 'init') {
  const cliArgs = parseArgs(rest)
  runInit(cliArgs).catch(err => { console.error(err); process.exit(1) })
} else if (cmd === 'install') {
  installFiles()
  console.log('done. 运行 npx @double-coding/pixel-print init 完成环境配置。\n')
} else if (cmd === 'clean-cache') {
  runCleanCache()
} else if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printHelp()
} else {
  console.error(`Unknown command: ${cmd}\n`)
  printHelp()
  process.exit(1)
}
