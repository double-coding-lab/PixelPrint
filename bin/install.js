#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const TEMPLATES_DIR = path.join(__dirname, '../templates')
const CWD = process.cwd()
const CONFIG_PATH = path.join(CWD, 'ctrip-train-d2c.config.json')
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

function installFiles(forceSkills = false, skipConfig = false) {
  console.log('\nctrip-train-d2c: installing files...\n')
  copyDir(path.join(TEMPLATES_DIR, 'skills'), path.join(CWD, '.claude/skills'), forceSkills)
  if (!skipConfig) {
    copyFile(path.join(TEMPLATES_DIR, 'ctrip-train-d2c.config.json'), CONFIG_PATH)
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

// ─── 交互式配置 ──────────────────────────────────────────────

async function runInit() {
  // 先读现有 config（init 自己生成 config，不能让 installFiles 提前复制 templates 模板污染 existing）
  let existing = {}
  if (fs.existsSync(CONFIG_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch {}
  }

  installFiles(true, true)  // init: 强制覆盖 skill 文件；跳过 config 复制（交互完会自己写）

  const p = existing.project || {}
  const m = existing.merge || {}
  const img = existing.images || {}
  const u = existing.unit || {}
  const fig = existing.figma || {}
  const out = existing.output || {}

  console.log('─── 阶段一：Figma MCP 安装提示 ──────────────────────\n')
  console.log('  ⚠️  init 脚本运行在终端进程里，无法直接验证 Claude Code 内的 MCP 状态。')
  console.log('  实际可用性会在 Claude 跑 SKILL 步骤 -1 时调 whoami 探针验证。\n')
  console.log('  如果尚未安装 Figma 官方 MCP，请按以下步骤操作：')
  console.log('  1. 打开 Claude Code')
  console.log('  2. 进入 Settings → Extensions（或直接搜索 Figma）')
  console.log('  3. 找到 Figma 官方插件，点击安装')
  console.log('  4. 按提示完成浏览器 OAuth 认证\n')

  console.log('─── 阶段二：交互式配置 ──────────────────────────────\n')

  const framework = await pickOrUse('[1/8] 项目框架', p.framework, ['react', 'rn'], 'react')

  // 样式方案分两个维度问：方式 + (仅 stylesheet 时) 预处理语法 + 是否走 module
  // 最终 styleFormat 落值规范见 SKILL §0「样式方案标识符」
  let styleFormat
  if (framework === 'rn') {
    styleFormat = await pickOrUse('[2/8] 样式方案', p.styleFormat,
      ['stylesheet', 'styled-components', 'nativewind'], 'stylesheet')
    // RN 只有 1 题；后面 mergeMode 等步骤标号顺延
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

  const assetsDir = await inputOrUse('[4/8] 图片输出目录', img.assetsDir, 'static/')

  const imageBaseUrl = await inputOrUse('[5/8] 图片 base URL', img.imageBaseUrl, 'http://127.0.0.1:8080/')

  const outputDir = await inputOrUse('[6/8] 代码输出目录', out.dir, 'pages/')

  console.log('\n─── 阶段三：单位换算规则 ────────────────────────────\n')
  console.log('  使用 ← → 方向键选择，输入题直接回车使用默认值\n')

  const figmaBase = await inputIntOrUse('[单位1/4] 设计稿基准宽度 (px)', u.figmaBase, 375)

  const outputUnit = await pickOrUse('[单位2/4] 代码使用的单位', u.outputUnit, ['px', 'vw', 'rem'], 'px')

  let outputBase = figmaBase
  let scale = 1
  if (outputUnit === 'px') {
    outputBase = await inputIntOrUse('[单位3/4] 代码 px 基准宽度（如 postcss px2vw 基于 750 则填 750）', u.outputBase, figmaBase * 2)
    scale = outputBase / figmaBase
    console.log(`  → 换算倍数：×${scale}（Figma ${figmaBase}px → 代码 ${figmaBase * scale}px）`)
  } else if (outputUnit === 'vw') {
    outputBase = await inputIntOrUse('[单位3/4] vw 基准宽度（100vw 对应多少 px）', u.outputBase, figmaBase)
    scale = outputBase / figmaBase
    console.log(`  → 换算：Figma ${figmaBase}px → ${(figmaBase * scale / outputBase * 100).toFixed(3)}vw`)
  } else {
    outputBase = await inputIntOrUse('[单位3/4] rem 基准（1rem = 多少 px）', u.outputBase, 16)
    scale = 1
    console.log(`  → 换算：Figma 值 / ${outputBase} rem`)
  }

  const figmaToken = await inputOrUse('[单位4/4] Figma Personal Access Token（用于导出透明图片，回车跳过）', fig.token, '')

  const config = {
    version: '2.0.0',
    project: { name: path.basename(CWD), framework, styleFormat },
    figma: { token: figmaToken },
    merge: { mode: mergeMode },
    unit: { figmaBase, outputUnit, outputBase, scale },
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
      font: 'font-',
      but: 'btn-',
      scrollX: 'scrollx-',
      scrollY: 'scrolly-',
      fixed: 'fixed-',
      ignore: 'x-',
      ...(existing.layers || {})
    },
    output: { dir: outputDir },
    health: existing.health || {
      enabled: true,
      blockOnError: true,
      report: {
        markdown: true,
        json: true,
        dir: ''
      },
      thresholds: {
        maxDepth: 6,
        subBlockMin: 3,
        subBlockMax: 20,
        totalNodesMax: 1500,
        hiddenRatioMax: 0.2,
        paddingAsymmetryMax: 32,
        bgSizeMin: 0.8,
        bgSizeMax: 1.2,
        colorDeltaEMin: 3
      },
      rules: {}
    }
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  console.log('\n  ✓ ctrip-train-d2c.config.json 已写入')

  // 将单位规则注入主 Skill
  const skillPath = path.join(CWD, '.claude/skills/ctrip-train-d2c/SKILL.md')
  if (fs.existsSync(skillPath)) {
    let skillContent = fs.readFileSync(skillPath, 'utf8')
    const unitExample = outputUnit === 'px'
      ? `Figma \`16px\` → 代码写 \`${16 * scale}px\``
      : outputUnit === 'vw'
      ? `Figma \`${outputBase}px\` → 代码写 \`${(outputBase * scale / outputBase * 100).toFixed(3)}vw\``
      : `Figma \`${outputBase}px\` → 代码写 \`1rem\``
    const section = `\n## 项目个性化规则\n> 由 npx @ctrip/train-d2c init 生成，重新执行可更新。\n\n### 单位换算\n- 设计稿基准：${figmaBase}px\n- 代码单位：${outputUnit}，基准：${outputBase}\n- 换算倍数：×${scale}\n- 示例：${unitExample}\n`
    const marker = '\n## 项目个性化规则'
    skillContent = skillContent.includes(marker)
      ? skillContent.slice(0, skillContent.indexOf(marker)) + section
      : skillContent + section
    fs.writeFileSync(skillPath, skillContent)
    console.log('  ✓ 单位换算规则已注入 .claude/skills/ctrip-train-d2c/SKILL.md')
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

  console.log('\n─────────────────────────────────────────────────────')
  console.log('  ⚠️  Figma MCP 需在 Claude Code 中手动安装并完成 OAuth（见阶段一引导）')
  console.log('     init 脚本无法直接验证；Claude 跑 SKILL 步骤 -1 时会调 whoami 探针验证。')
  console.log('  ✓ ctrip-train-d2c.config.json 已配置')
  console.log('  ✓ code-connect/mappings.json 已就绪')
  console.log('\n  Figma MCP 安装完成后，把设计稿链接发给 Claude：')
  console.log('  把这份设计稿转成代码：https://figma.com/design/xxx?node-id=1-2\n')
}

// ─── 入口 ────────────────────────────────────────────────────

const cmd = process.argv[2]

if (cmd === 'init') {
  runInit().catch(err => { console.error(err); process.exit(1) })
} else {
  installFiles()
  console.log('done. 运行 npx @ctrip/train-d2c init 完成环境配置。\n')
}
