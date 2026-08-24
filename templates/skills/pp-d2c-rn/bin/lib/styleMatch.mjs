// styleMatch — RN StyleSheet 样式匹配（pp-d2c-rn v1.0.0,对位 h5 的 lib/cssMatch.mjs）
//
// 背景:rn 产物样式锚定形态(SKILL v0.3.12 强制)——独立 styles.ts 内
// `const styles = StyleSheet.create({ key: {...}, ... })`,JSX 侧 `style={styles.key}` /
// `style={[styles.a, styles.b]}`。h5 的 cssMatch 全部逻辑围绕 CSS/SCSS 文本选择器,
// 对 JS 对象字面量整体失配,故本文件重写而非改写;导出接口与 cssMatch 同形,规则层迁移成本最小。
//
// 解析策略(轻量词法,零依赖,排他性选择:不用 AST):
//   - 定位每处 `StyleSheet.create(` 后的对象字面量,花括号平衡切出顶层 `key: {...}` 对;
//   - 扫描时跳过字符串('..."..."`...`)与注释(// /* */),避免文案里的花括号干扰计数;
//   - 属性值四形态:纯数字 / rpx(数字) / 字符串字面量 / 其他表达式;
//     Platform.select/三元/变量引用等动态值 → 该属性标 unparseable,数值类规则保守跳过(宁漏报不误判)。

// ── 词法扫描基础:跳过字符串与注释的逐字符游标 ─────────────────────

function isStrOpen(ch) {
  return ch === "'" || ch === '"' || ch === '`';
}

// 从 text[i] 起跳过一个字符串字面量,返回收尾引号后的下标
function skipString(text, i) {
  const quote = text[i];
  i += 1;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === quote) return i + 1;
    i += 1;
  }
  return i;
}

// 从 text[i] 起跳过注释(若 i 处是注释起点),否则原样返回 i
function skipComment(text, i) {
  if (text[i] === '/' && text[i + 1] === '/') {
    const nl = text.indexOf('\n', i);
    return nl < 0 ? text.length : nl + 1;
  }
  if (text[i] === '/' && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end < 0 ? text.length : end + 2;
  }
  return i;
}

// 从 text[openIdx]('{' 或 '[' 或 '(')起做括号平衡,返回配对收尾符的下标;失配返回 -1
function matchBalanced(text, openIdx) {
  const open = text[openIdx];
  const close = open === '{' ? '}' : open === '[' ? ']' : ')';
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    const j = skipComment(text, i);
    if (j !== i) { i = j; continue; }
    const ch = text[i];
    if (isStrOpen(ch)) { i = skipString(text, i); continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

// ── StyleSheet.create 定位与顶层 key 切分 ────────────────────────

// 返回 [{ text, offset }]:每个 StyleSheet.create({...}) 的对象字面量文本(含首尾花括号)与其在全文的起始下标
function createBlocks(styleText) {
  const out = [];
  const re = /StyleSheet\s*\.\s*create\s*\(/g;
  let m;
  while ((m = re.exec(styleText)) !== null) {
    const braceIdx = styleText.indexOf('{', m.index + m[0].length - 1);
    if (braceIdx < 0) continue;
    const end = matchBalanced(styleText, braceIdx);
    if (end < 0) continue;
    out.push({ text: styleText.slice(braceIdx, end + 1), offset: braceIdx });
  }
  return out;
}

// 切出对象字面量(含首尾花括号)顶层的 key: {...} 条目。
// 返回 [{ key, body, start }]:body = 值对象 `{}` 内文本,start = key 在块内的下标。
// 值不是对象字面量的顶层条目(如展开运算符、简写)跳过——StyleSheet.create 顶层值必为对象。
function topLevelEntries(blockText) {
  const out = [];
  let i = 1; // 跳过起始 '{'
  const end = blockText.length - 1; // 收尾 '}'
  while (i < end) {
    const j = skipComment(blockText, i);
    if (j !== i) { i = j; continue; }
    const ch = blockText[i];
    if (isStrOpen(ch)) { i = skipString(blockText, i); continue; }
    if (/[\s,]/.test(ch)) { i += 1; continue; }
    // 尝试匹配 key(裸标识符或引号 key)
    const rest = blockText.slice(i);
    const km = rest.match(/^([A-Za-z_$][\w$]*|'[^']*'|"[^"]*")\s*:\s*/);
    if (!km) {
      // 非 key 起点(如展开运算符 ...base):跳到本条目结束(下一个顶层逗号)
      i = skipTopLevelValue(blockText, i, end);
      continue;
    }
    const keyRaw = km[1];
    const key = keyRaw.replace(/^['"]|['"]$/g, '');
    const valIdx = i + km[0].length;
    if (blockText[valIdx] === '{') {
      const close = matchBalanced(blockText, valIdx);
      if (close < 0) break;
      out.push({ key, body: blockText.slice(valIdx + 1, close), start: i });
      i = close + 1;
    } else {
      i = skipTopLevelValue(blockText, valIdx, end);
    }
  }
  return out;
}

// 从 from 起跳过一个顶层值(直到深度 0 的逗号或对象收尾),返回新下标
function skipTopLevelValue(blockText, from, end) {
  let i = from;
  let depth = 0;
  while (i < end) {
    const j = skipComment(blockText, i);
    if (j !== i) { i = j; continue; }
    const ch = blockText[i];
    if (isStrOpen(ch)) { i = skipString(blockText, i); continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) return i + 1;
    i += 1;
  }
  return i;
}

// ── 导出接口(与 cssMatch 同形) ──────────────────────────────────

// 收集某 styleKey 在一段 styles 文本里的所有规则体。
// 返回 [{ body, line }](body = 该 key 值对象 `{}` 内文本,line = key 所在行)。
export function collectRuleBodies(styleText, styleKey) {
  const key = (styleKey || '').trim();
  if (!key) return [];
  const out = [];
  for (const block of createBlocks(styleText)) {
    for (const entry of topLevelEntries(block.text)) {
      if (entry.key !== key) continue;
      const abs = block.offset + entry.start;
      out.push({ body: entry.body, line: styleText.slice(0, abs).split('\n').length });
    }
  }
  return out;
}

// 在多个 style 文件里,某 nodeId 的任一 styleKey 是否有规则体命中 propRe。
// keys = classMap[nodeId](可能多个);styleFiles = product.style([{ content, rel }])。
// 命中返回 { hit:true, rel, line, body };否则 { hit:false, firstRel, firstLine, firstSnippet }。
export function findProperty(styleFiles, keys, propRe) {
  let firstRel = null, firstLine = 0, firstSnippet = '';
  for (const key of keys || []) {
    for (const s of styleFiles) {
      const bodies = collectRuleBodies(s.content, key);
      for (const r of bodies) {
        if (propRe.test(r.body)) {
          return { hit: true, rel: s.rel, line: r.line, body: r.body };
        }
        if (!firstRel) {
          firstRel = s.rel;
          firstLine = r.line;
          firstSnippet = r.body.slice(0, 200);
        }
      }
    }
  }
  return { hit: false, firstRel, firstLine, firstSnippet };
}

// 取某 nodeId 第一个 styleKey 的规则体(用于需要读取声明值的规则,如 R19 padding)。
// 返回 { body, rel, line } 或 null。
export function firstRuleBody(styleFiles, keys) {
  for (const key of keys || []) {
    for (const s of styleFiles) {
      const bodies = collectRuleBodies(s.content, key);
      if (bodies.length) return { body: bodies[0].body, rel: s.rel, line: bodies[0].line };
    }
  }
  return null;
}

// 收集某 nodeId 全部 styleKey 的全部规则体文本(R20/R23 跨规则体取值用)。
export function allRuleBodies(styleFiles, keys) {
  const out = [];
  for (const key of keys || []) {
    for (const s of styleFiles) {
      for (const r of collectRuleBodies(s.content, key)) out.push(r.body);
    }
  }
  return out;
}

// 列出一段 styles 文本里全部 StyleSheet.create 顶层 key 及其行号(R12 跨文件重复定义检测用)。
// 返回 [{ key, line }],同名 key 多次定义会出现多条。
export function listStyleKeys(styleText) {
  const out = [];
  for (const block of createBlocks(styleText)) {
    for (const entry of topLevelEntries(block.text)) {
      const abs = block.offset + entry.start;
      out.push({ key: entry.key, line: styleText.slice(0, abs).split('\n').length });
    }
  }
  return out;
}

// ── 数值取用(统一 rpx 剥壳,供 R19/R20/R23 复用) ─────────────────

// 从规则体取某属性的数值声明(取最后一次,对齐"后写覆盖"直觉):
//   propName: 16          → { value: 16, viaRpx: false }
//   propName: rpx(16)     → { value: 16, viaRpx: true }(helperName 可配,默认 rpx)
//   propName: '100%' / Platform.select / 三元 / 变量 → { unparseable: true }
//   未声明 → null
// 对账口径:期望 = Figma 原值 × config.unit.scale,rpx(x) 剥壳后的 x 与期望同域直接比
// (rn 模板 config unit.scale=1、responsive.enabled=true,rpx 参数即 Figma 原值)。
export function getNumeric(body, propName, helperName = 'rpx') {
  const re = new RegExp(`(?:^|[,{\\s])${propName}\\s*:\\s*([^,\\n}]+)`, 'g');
  let raw = null;
  let m;
  while ((m = re.exec(body)) !== null) raw = m[1].trim();
  if (raw == null) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return { value: parseFloat(raw), viaRpx: false };
  const rpxRe = new RegExp(`^${helperName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)$`);
  const rm = raw.match(rpxRe);
  if (rm) return { value: parseFloat(rm[1]), viaRpx: true };
  return { unparseable: true };
}

// 跨多个规则体取某属性数值(后出现的规则体覆盖先出现):
// 任一规则体给出可解析值 → 取最后一个可解析值;仅出现 unparseable → { unparseable:true };都没写 → null。
export function getNumericAcross(bodies, propName, helperName = 'rpx') {
  let last = null;
  let sawUnparseable = false;
  for (const b of bodies) {
    const r = getNumeric(b, propName, helperName);
    if (r == null) continue;
    if (r.unparseable) { sawUnparseable = true; continue; }
    last = r;
  }
  if (last) return last;
  if (sawUnparseable) return { unparseable: true };
  return null;
}
