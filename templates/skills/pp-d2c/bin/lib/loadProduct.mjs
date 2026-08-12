import fs from 'node:fs';
import path from 'node:path';

const STYLE_EXTS = ['.scss', '.less', '.css', '.module.scss', '.module.less', '.module.css'];
const JSX_EXTS = ['.jsx', '.tsx'];

export function loadProduct(dir) {
  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) {
    return { error: `product dir not found: ${absDir}`, jsx: [], style: [] };
  }
  const jsx = [];
  const style = [];
  walk(absDir, absDir, jsx, style);
  return { root: absDir, jsx, style };
}

function walk(root, dir, jsx, style) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(root, full, jsx, style);
      continue;
    }
    const ext = getExt(e.name);
    const rel = path.relative(root, full);
    if (JSX_EXTS.includes(ext)) {
      jsx.push({ file: full, rel, content: fs.readFileSync(full, 'utf8') });
    } else if (STYLE_EXTS.includes(ext)) {
      style.push({ file: full, rel, content: fs.readFileSync(full, 'utf8') });
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
