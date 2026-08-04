#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const TEMPLATES_DIR = path.join(__dirname, '../templates')
const CWD = process.cwd()
const CONFIG_PATH = path.join(CWD, 'pp-d2c.config.json')
const MAPPINGS_PATH = path.join(CWD, 'code-connect/mappings.json')

// ─── 文件操作 ────────────────────────────────────────────────

function copyFile(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  if (fs.existsSync(dest)) {
    console.log(`  skip  ${path.relative(CWD, dest)} (already exists)`)
    return
  }
  fs.copyFileSync(src, dest)
  console.log(`  copy  ${path.relative(CWD, dest)}`)
}

function copyFileForce(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`  overwrite  ${path.relative(CWD, dest)}`)
}

function copyDir(srcDir, destDir, force = false) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest, force)
    } else {
      force ? copyFileForce(src, dest) : copyFile(src, dest)
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
  const { skipRn = false } = options
  console.log('\npp-d2c: installing files...\n')
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills')
  const skillsDst = path.join(CWD, '.claude/skills')
  for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (skipRn && entry.name === 'pp-d2c-rn') continue
    copyDir(path.join(skillsSrc, entry.name), path.join(skillsDst, entry.name), forceSkills)
  }
  if (!skipConfig) {
    copyFile(path.join(TEMPLATES_DIR, 'pp-d2c.config.json'), CONFIG_PATH)
  }
  copyFile(path.join(TEMPLATES_DIR, 'code-connect/mappings.json'), MAPPINGS_PATH)
  console.log('')
}

// ─── 选择器（方向键 + 回车） ─────────────────────────────────

function select(label, choices, defaultVal) {
  return new Promise(resolve => {
    let idx = Math.max(0, choices.indexOf(defaultVal))

    function render() {
      // 清除已渲染的行
      process.stdout.write(`\r\x1b[K`)
      const parts = choices.map((c, i) => i === idx ? `\x1b[36m● ${c}\x1b[0m` : `  ${c}`)
      process.stdout.write(`  ${label}: ${parts.join('  ')}\x1b[0K`)
    }

    render()

    const onData = buf => {
      const key = buf.toString()
      if (key === '\x1b[D' || key === '\x1b[A') {       // ← ↑
        idx = (idx - 1 + choices.length) % choices.length
        render()
      } else if (key === '\x1b[C' || key === '\x1b[B') { // → ↓
        idx = (idx + 1) % choices.length
        render()
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.removeListener('data', onData)
        process.stdin.pause()
        process.stdout.write(`\r\x1b[K  ${label}: \x1b[36m${choices[idx]}\x1b[0m\n`)
        resolve(choices[idx])
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

async function pickOrUse(label, currentVal, choices, defaultVal) {
  if (hasValue(currentVal) && choices.includes(currentVal)) {
    logUseExisting(label, currentVal)
    return currentVal
  }
  return await select(label, choices, defaultVal)
}

async function inputOrUse(label, currentVal, defaultVal) {
  if (hasValue(currentVal)) {
    logUseExisting(label, currentVal)
    return currentVal
  }
  return await input(label, defaultVal)
}

async function inputIntOrUse(label, currentVal, defaultVal) {
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
      if (preset && preset.name && preset.adapter) list.push(preset)
    } catch (e) {
      console.warn(`  ⚠️  adapter-presets/${entry} 解析失败,跳过: ${e.message}`)
    }
  }
  return list
}

// ─── 交互式配置 ──────────────────────────────────────────────

async function runInit() {
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

  console.log('─── 阶段一：Figma Personal Access Token 说明 ─────────\n')
  console.log('  ⚠️  v0.3 起本 SKILL 完全走 Figma REST API,不再依赖 MCP。')
  console.log('  你只需要一个 Figma Personal Access Token 即可运行(在后续阶段三输入)。\n')
  console.log('  Token 生成路径:')
  console.log('  1. 打开 https://www.figma.com/ 登录')
  console.log('  2. 右上角头像 → Settings → Security')
  console.log('  3. 找到 Personal access tokens,点击 "Generate new token"')
  console.log('  4. 权限勾选 "File content: Read-only" 即可')
  console.log('  5. 复制 token 后不要关闭窗口(离开后无法再次查看)\n')

  console.log('─── 阶段二：交互式配置 ──────────────────────────────\n')

  const framework = await pickOrUse('[1/8] 项目框架', p.framework, ['react', 'rn'], 'react')

  // 先问完 framework 再复制 SKILL 文件:react 项目不需要装 rn SKILL,反之亦然
  installFiles(true, true, { skipRn: framework !== 'rn' })  // init: 强制覆盖 skill 文件；跳过 config 复制

  // 样式方案分两个维度问：方式 + (仅 stylesheet 时) 预处理语法 + 是否走 module
  // 最终 styleFormat 落值规范见 SKILL §0「样式方案标识符」
  let styleFormat
  let adapterCfg = null  // rn 分支下才会填,react 分支保持 null(config 不写 adapter 段)
  let pickedPreset = null  // 若走预设分支,记录命中的 preset 对象;供 helper 复制阶段选源
  if (framework === 'rn') {
    // rn 分支样式方案写死 StyleSheet.create + 行内 style,不再询问
    // 理由:styled-components / nativewind 需要额外依赖且 SKILL 侧未落地生成模板,现阶段只支持 stylesheet
    styleFormat = 'stylesheet'
    console.log('  [2/8] 样式方案: \x1b[36mstylesheet\x1b[0m \x1b[90m(rn 分支固定用 StyleSheet.create + 行内 style)\x1b[0m')

    // ─── 【新增】adapter 引导 ─────────────────────────
    // adapter 把 RN 原生标签映射到 xtaro / taro / 其他框架
    const existingAdapter = existing.adapter || {}
    const existingEnabledYn = existingAdapter.enabled === true ? 'Yes' : existingAdapter.enabled === false ? 'No' : null
    const enableAdapterYn = await pickOrUse('[2.1/8] 是否启用 adapter 映射(把 RN 标签映射到 xtaro/taro 等)',
      existingEnabledYn, ['No', 'Yes'], 'No')
    const enableAdapter = enableAdapterYn === 'Yes'

    if (!enableAdapter) {
      adapterCfg = { enabled: false, tagMap: {}, importMap: {}, propMap: {}, reactImport: 'react' }
    } else {
      // 判断是否已存在完整 adapter 配置,已有则直接沿用
      const hasExistingMap = existingAdapter.tagMap && Object.keys(existingAdapter.tagMap).length > 0
      if (hasExistingMap) {
        logUseExisting('[2.2/8] adapter 映射', `${Object.keys(existingAdapter.tagMap).length} 条(沿用)`)
        adapterCfg = {
          enabled: true,
          tagMap: existingAdapter.tagMap || {},
          importMap: existingAdapter.importMap || {},
          propMap: existingAdapter.propMap || {},
          reactImport: existingAdapter.reactImport || 'react'
        }
      } else {
        // 扫 templates/adapter-presets/ 目录,把每个 preset 的 name 列成选项,末尾追加"自定义"兜底
        const presets = loadAdapterPresets()
        const CUSTOM_LABEL = '自定义'
        const choices = [...presets.map(p => p.name), CUSTOM_LABEL]
        const defaultChoice = presets[0]?.name || CUSTOM_LABEL
        const picked = await select('[2.2/8] 选择预设 adapter', choices, defaultChoice)

        if (picked === CUSTOM_LABEL) {
          adapterCfg = { enabled: true, tagMap: {}, importMap: {}, propMap: {}, reactImport: 'react' }
          console.log('  → adapter.enabled=true,请后续在 pp-d2c.config.json 手动填 tagMap / importMap / propMap')
        } else {
          const hit = presets.find(p => p.name === picked)
          adapterCfg = { ...hit.adapter }
          pickedPreset = hit
          console.log(`  → 已写入 ${hit.name} 预设(${hit.description || '见 templates/adapter-presets/README.md'})`)
        }
      }
    }

    // ─── 【新增】响应式 rpx() 包装引导 ──────────────────
    // RN 数值默认是 dp/pt(iOS pt / Android dp),不同屏宽下同一数值物理尺寸不同。
    // 启用 rpx 包装 → SKILL 在 layout / spacing / borderRadius / fontSize 类属性上调用 rpx(),
    // 由 helper 按 Dimensions.get('window').width / figmaBase 线性缩放。
    const existingUnit = existing.unit || {}
    const existingResp = existingUnit.responsive || {}
    const existingRespYn = existingResp.enabled === true ? 'Yes' : existingResp.enabled === false ? 'No' : null
    const enableRespYn = await pickOrUse(
      '[2.3/8] 是否启用响应式 rpx() 包装(按屏宽线性缩放尺寸)',
      existingRespYn, ['Yes', 'No'], 'Yes'
    )
    var responsiveCfg = null  // 到 config 阶段合并到 unit 段
    if (enableRespYn === 'Yes') {
      const helperImport = await inputOrUse(
        '[2.4/8] rpx helper import 路径',
        existingResp.helperImport, '@/utils/rpx'
      )
      const helperName = await inputOrUse(
        '[2.5/8] rpx helper 导出函数名',
        existingResp.helperName, 'rpx'
      )
      responsiveCfg = { enabled: true, helperImport, helperName }
    } else {
      responsiveCfg = { enabled: false, helperImport: '@/utils/rpx', helperName: 'rpx' }
    }
    // RN 分支后面 mergeMode 等步骤标号顺延
  } else {
    // 从现有 styleFormat 反推三个维度的当前值（兼容老 config）
    const existing2a = (() => {
      if (p.styleFormat === 'tailwind') return 'tailwind'
      if (p.styleFormat === 'inline') return 'inline'
      if (p.styleFormat && /^(scss|less|css)(-modules)?$/.test(p.styleFormat)) return 'stylesheet'
      return null
    })()
    const existing2b = (() => {
      if (!p.styleFormat) return null
      const m = p.styleFormat.match(/^(scss|less|css)(-modules)?$/)
      return m ? m[1] : null
    })()
    const existing2c = (() => {
      if (!p.styleFormat) return null
      return /-modules$/.test(p.styleFormat) ? 'Yes' : 'No'
    })()

    const styleMode = await pickOrUse('[2a/8] 样式方式', existing2a,
      ['stylesheet', 'tailwind', 'inline'], 'stylesheet')

    if (styleMode === 'stylesheet') {
      const syntax = await pickOrUse('[2b/8] 预处理语法', existing2b,
        ['scss', 'less', 'css'], 'scss')
      const useModulesYn = await pickOrUse('[2c/8] 是否启用 css-modules', existing2c,
        ['No', 'Yes'], 'No')
      const useModules = useModulesYn === 'Yes'
      styleFormat = useModules ? `${syntax}-modules` : syntax
    } else {
      styleFormat = styleMode
    }
  }

  const mergeMode = await pickOrUse('[3/8] 合并模式', m.mode, ['component', 'flat'], 'component')

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
  const assetsDir = await inputOrUse('[4/8] 图片输出目录', img.assetsDir, defaultAssetsDir)

  // rn 分支:图片 base URL 固定为空,不再询问
  let imageBaseUrl
  if (isRn) {
    imageBaseUrl = ''
    console.log(`  [5/8] 图片 base URL: \x1b[36m(空)\x1b[0m \x1b[90m(rn 分支走 require 引用,不用远程 URL)\x1b[0m`)
  } else {
    imageBaseUrl = await inputOrUse('[5/8] 图片 base URL', img.imageBaseUrl, defaultImageBaseUrl)
  }

  const outputDir = await inputOrUse('[6/8] 代码输出目录', out.dir, defaultOutputDir)

  console.log('\n─── 阶段三：单位换算规则 ────────────────────────────\n')
  console.log('  使用 ← → 方向键选择，输入题直接回车使用默认值\n')

  const figmaBase = await inputIntOrUse(
    isRn ? '[单位1/2] 设计稿基准宽度 (px)' : '[单位1/4] 设计稿基准宽度 (px)',
    u.figmaBase, 375
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
    outputUnit = await pickOrUse('[单位2/4] 代码使用的单位', u.outputUnit, ['px', 'vw', 'rem'], 'px')
    if (outputUnit === 'px') {
      outputBase = await inputIntOrUse('[单位3/4] 代码 px 基准宽度(如 postcss px2vw 基于 750 则填 750)', u.outputBase, figmaBase * 2)
      scale = outputBase / figmaBase
      console.log(`  → 换算倍数:×${scale}(Figma ${figmaBase}px → 代码 ${figmaBase * scale}px)`)
    } else if (outputUnit === 'vw') {
      outputBase = await inputIntOrUse('[单位3/4] vw 基准宽度(100vw 对应多少 px)', u.outputBase, figmaBase)
      scale = outputBase / figmaBase
      console.log(`  → 换算:Figma ${figmaBase}px → ${(figmaBase * scale / outputBase * 100).toFixed(3)}vw`)
    } else {
      outputBase = await inputIntOrUse('[单位3/4] rem 基准(1rem = 多少 px)', u.outputBase, 16)
      scale = 1
      console.log(`  → 换算:Figma 值 / ${outputBase} rem`)
    }
  }

  const figmaToken = await inputOrUse(
    isRn ? '[单位2/2] Figma Personal Access Token(用于导出透明图片,回车跳过)'
         : '[单位4/4] Figma Personal Access Token(用于导出透明图片,回车跳过)',
    fig.token, ''
  )

  const config = {
    version: '2.0.0',
    project: { name: path.basename(CWD), framework, styleFormat },
    figma: { token: figmaToken },
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
    const section = `\n## 项目个性化规则\n> 由 npx @double-coding/pixel-pilot init 生成，重新执行可更新。\n\n### 单位换算\n- 设计稿基准：${figmaBase}px\n- 代码单位：${outputUnit}，基准：${outputBase}\n- 换算倍数：×${scale}\n- 示例：${unitExample}\n`
    const marker = '\n## 项目个性化规则'
    skillContent = skillContent.includes(marker)
      ? skillContent.slice(0, skillContent.indexOf(marker)) + section
      : skillContent + section
    fs.writeFileSync(skillPath, skillContent)
    console.log(`  ✓ 单位换算规则已注入 ${path.relative(CWD, skillPath)}`)
  }

  console.log('\n─── 阶段四：mappings.json ───────────────────────────\n')
  if (fs.existsSync(MAPPINGS_PATH)) {
    let existingMappings = null
    try { existingMappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8')) } catch {}
    const hasComponents = existingMappings && Array.isArray(existingMappings.components) && existingMappings.components.length > 0
    if (hasComponents) {
      console.log(`  skip  mappings.json (已有 ${existingMappings.components.length} 条映射，沿用现有配置)`)
    } else {
      fs.writeFileSync(MAPPINGS_PATH, JSON.stringify({ components: [] }, null, 2))
      console.log('  ✓ mappings.json 已重置为空模板（原文件无有效映射）')
    }
  } else {
    fs.mkdirSync(path.dirname(MAPPINGS_PATH), { recursive: true })
    fs.writeFileSync(MAPPINGS_PATH, JSON.stringify({ components: [] }, null, 2))
    console.log('  ✓ mappings.json 已初始化')
  }

  console.log('\n─── 阶段五：追加 .gitignore ─────────────────────────\n')
  ensureGitignoreEntries()

  console.log('\n─────────────────────────────────────────────────────')
  console.log('  ✓ v0.3 起完全走 Figma REST API,无需 MCP;确保 figma.token 已配置即可。')
  console.log('  ✓ pp-d2c.config.json 已配置')
  console.log('  ✓ code-connect/mappings.json 已就绪')
  console.log('  ✓ .gitignore 已追加 .d2c-cache/ / .d2c-tmp/')
  console.log('\n  把设计稿链接发给 Claude 即可开始生成:')
  console.log('  把这份设计稿转成代码:https://figma.com/design/xxx?node-id=1-2\n')
}

// ─── 入口 ────────────────────────────────────────────────────

const cmd = process.argv[2]

function printHelp() {
  console.log(`
Usage:
  npx @double-coding/pixel-pilot init      交互式初始化项目（推荐）
  npx @double-coding/pixel-pilot install   仅复制模板文件，不进入交互
  npx @double-coding/pixel-pilot help      显示本帮助
`)
}

if (cmd === 'init') {
  runInit().catch(err => { console.error(err); process.exit(1) })
} else if (cmd === 'install') {
  installFiles()
  console.log('done. 运行 npx @double-coding/pixel-pilot init 完成环境配置。\n')
} else if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printHelp()
} else {
  console.error(`Unknown command: ${cmd}\n`)
  printHelp()
  process.exit(1)
}
