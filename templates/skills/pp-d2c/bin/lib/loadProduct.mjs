import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const STYLE_EXTS = ['.scss', '.less', '.css', '.module.scss', '.module.less', '.module.css'];
const JSX_EXTS = ['.jsx', '.tsx'];
const MODULE_EXTS = ['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs'];
const CSS_EXTS = ['.scss', '.less', '.css'];

export function loadProduct(dir, { mode } = {}) {
  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) {
    return { error: `product dir not found: ${absDir}`, jsx: [], style: [] };
  }
  const jsx = [];
  const style = [];
  const warnings = [];
  const boundary = projectBoundary(absDir, warnings);
  const root = boundary.readPath(absDir);
  if (!root) return { error: warnings.join('; '), jsx, style };
  walk(root, root, jsx, style, boundary);
  const product = { root: absDir, jsx, style };
  if (mode === 'merge') return loadEntryProduct(root, product, boundary, warnings);
  return warnings.length ? { ...product, warnings } : product;
}

/**
 * 以最近项目标记限定读取范围；无标记时限于产物目录，读取前按 realpath 检查边界。
 */
function projectBoundary(start, warnings) {
  let dir = start;
  while (!['pp-d2c.config.json', 'package.json'].some((name) => isFile(path.join(dir, name)))) {
    const parent = path.dirname(dir);
    if (parent === dir) { dir = start; break; }
    dir = parent;
  }
  const root = fs.realpathSync(dir);
  return {
    root,
    /** 返回边界内的 realpath；越界或解析失败时记录 warning 并返回 null。 */
    readPath(file) {
      let real;
      try { real = fs.realpathSync(file); }
      catch (e) { warnings.push(`无法解析源码 realpath: ${file} (${e.code})`); return null; }
      const rel = path.relative(root, real);
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        warnings.push(`依赖超出项目边界 ${root}: ${file}`);
        return null;
      }
      return real;
    },
  };
}

/**
 * 从根 index 收集实际引用的合并产物；依赖范围不确定时保留边界内全量扫描并提示。
 */
function loadEntryProduct(root, fallback, boundary, warnings) {
  const entries = MODULE_EXTS.map((ext) => path.join(root, `index${ext}`)).filter(isFile);
  const seen = new Set();
  const jsx = [];
  const style = [];
  if (entries.length !== 1) warnings.push('页面根需有唯一 index.{tsx,jsx,ts,js,mjs,cjs} 入口');
  else visit(entries[0]);
  if (warnings.length) {
    // 已解析到的产物目录外、项目边界内依赖也不能在退回时丢掉。
    const union = (all, reachable) => [...new Map([...all, ...reachable].map((f) => [f.file, f])).values()];
    return { ...fallback, jsx: union(fallback.jsx, jsx), style: union(fallback.style, style),
      warnings: [...new Set(warnings)].map((reason) => `merge 依赖范围无法确定，保留全量扫描: ${reason}`) };
  }
  return { root, jsx, style, scope: 'entry' };

  /** 递归收集边界内源码依赖，按 realpath 去重。 */
  function visit(file) {
    file = boundary.readPath(file);
    if (!file) return;
    if (seen.has(file)) return;
    seen.add(file);
    const ext = path.extname(file);
    if (!MODULE_EXTS.includes(ext) && !CSS_EXTS.includes(ext)) return; // 图片/JSON 等不是源码依赖
    const content = fs.readFileSync(file, 'utf8');
    const record = { file, rel: path.relative(root, file), content };
    (CSS_EXTS.includes(ext) ? style : jsx).push(record);
    const refs = dependencies(content, CSS_EXTS.includes(ext));
    if (refs.uncertain) warnings.push(`${record.rel}: 动态或不支持的 import/require`);
    for (const ref of refs.values) {
      if (/^(?:https?:|data:|sass:|node:|\/\/)/i.test(ref)) continue;
      if (/[$#]\{|\\/.test(ref)) {
        warnings.push(`${record.rel}: 动态路径 ${ref}`);
        continue;
      }
      const spec = ref.replace(/[?#].*$/, '');
      const isStyle = CSS_EXTS.includes(ext);
      const resolved = resolveLocal(path.resolve(path.dirname(file), spec), isStyle);
      if ((spec.startsWith('.') || path.isAbsolute(spec) || isStyle) && resolved) { visit(resolved); continue; }
      // 带明确非源码扩展的静态资源无需跟进（但不能把路径别名当作外部包）。
      if (/\.(?:png|jpe?g|gif|webp|svg|avif|woff2?|ttf|json)$/i.test(spec)) continue;
      if (!spec.startsWith('.') && !spec.startsWith('/') && !isStyle) {
        try {
          const external = createRequire(file).resolve(spec);
          if (path.isAbsolute(external)) {
            const safe = boundary.readPath(external);
            if (safe && !safe.includes(`${path.sep}node_modules${path.sep}`) && isFile(safe)) visit(safe);
          }
          continue;
        } catch {
          // 校验环境可能尚未 npm install；显式声明的第三方包不是页面子稿。
          if (isDeclaredPackage(file, spec, boundary)) continue;
        }
      }
      warnings.push(`${record.rel}: 无法解析 ${ref}`);
    }
  }
}

/** 判断路径是否指向现存文件。 */
function isFile(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

/** 在项目边界内查找 package.json，判断包是否已显式声明。 */
function isDeclaredPackage(file, spec, boundary) {
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  let dir = path.dirname(file);
  while (true) {
    const manifest = path.join(dir, 'package.json');
    if (isFile(manifest)) {
      const safe = boundary.readPath(manifest);
      if (!safe) return false;
      try {
        const pkg = JSON.parse(fs.readFileSync(safe, 'utf8'));
        return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some((key) => Object.hasOwnProperty.call(pkg[key] || {}, name));
      } catch { return false; }
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === boundary.root) return false;
    dir = parent;
  }
}

/** 按源码扩展名、目录入口及样式 partial 规则解析本地依赖候选。 */
function resolveLocal(base, isStyle) {
  const exts = isStyle ? CSS_EXTS : [...MODULE_EXTS, ...CSS_EXTS];
  const candidates = [base, ...exts.map((e) => base + e), ...exts.map((e) => path.join(base, `index${e}`))];
  if (isStyle) {
    const dir = path.dirname(base), name = path.basename(base);
    candidates.push(path.join(dir, `_${name}`), ...exts.map((e) => path.join(dir, `_${name}${e}`)),
      ...exts.map((e) => path.join(base, `_index${e}`)));
  }
  return candidates.find(isFile);
}

/**
 * 跳过注释并提取字面量依赖，将动态或不支持的引用标记为不确定。
 */
function dependencies(src, isStyle) {
  // SCSS 也允许未加引号的远程 url，不能把其中 // 误当作行注释吞掉后续 import。
  if (isStyle) src = src.replace(/url\(\s*((?:https?:|\/\/)[^'"\s)]+)\s*\)/g, (_, url) => `url(${JSON.stringify(url)})`);
  const tokens = (src.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g) || [])
    .filter((t) => !t.startsWith('//') && !t.startsWith('/*'));
  const values = [];
  let uncertain = false;
  const literal = (s) => s && /^['"`]/.test(s);
  const add = (s) => {
    if (!literal(s)) { uncertain = true; return; }
    values.push(s.slice(1, -1));
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (isStyle) {
      if (t !== '@' || !['import', 'use', 'forward'].includes(tokens[i + 1])) continue;
      const statement = [];
      for (i += 2; i < tokens.length && tokens[i] !== ';'; i++) statement.push(tokens[i]);
      const refs = statement.filter(literal);
      if (!refs.length && !/^url\(https?:/.test(statement.join(''))) uncertain = true;
      if (statement.some((part) => part.startsWith('$') || part === '#')) uncertain = true;
      for (const ref of refs) add(ref);
      continue;
    }
    if (t !== 'import' && t !== 'export' && t !== 'require') continue;
    if (tokens[i + 1] === '.') {
      // import.meta 本身不是动态依赖；glob/context 是。
      if (t === 'require' || tokens.slice(i + 2, i + 6).includes('glob') || tokens.slice(i + 2, i + 6).includes('globEager')) uncertain = true;
      continue;
    }
    if (tokens[i + 1] === '(') {
      if (literal(tokens[i + 2]) && tokens[i + 3] === ')') add(tokens[i + 2]);
      else uncertain = true;
    } else if (t === 'import' && literal(tokens[i + 1])) add(tokens[i + 1]);
    else if (t !== 'require') {
      // static import / export ... from '...'; 不跨到下一条 import/export。
      for (let j = i + 1; j < tokens.length && ![';', 'import', 'export'].includes(tokens[j]); j++) {
        if (tokens[j] === 'from') { add(tokens[j + 1]); break; }
      }
    }
  }
  return { values, uncertain };
}

function walk(root, dir, jsx, style, boundary) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const safe = boundary.readPath(full);
      if (safe) walk(root, safe, jsx, style, boundary);
      continue;
    }
    const ext = getExt(e.name);
    if (JSX_EXTS.includes(ext) || STYLE_EXTS.includes(ext)) {
      const safe = boundary.readPath(full);
      if (!safe) continue;
      const record = { file: safe, rel: path.relative(root, safe), content: fs.readFileSync(safe, 'utf8') };
      (JSX_EXTS.includes(ext) ? jsx : style).push(record);
    }
  }
}

function getExt(name) {
  if (name.endsWith('.module.scss')) return '.module.scss';
  if (name.endsWith('.module.less')) return '.module.less';
  if (name.endsWith('.module.css')) return '.module.css';
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i);
}
