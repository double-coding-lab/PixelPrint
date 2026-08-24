// 产物装载(改写自 h5 的 lib/loadProduct.mjs)——rn 侧样式文件识别从后缀名改为双条件:
// 文件名匹配 styles.ts|styles.js|*.styles.ts|*.styles.js 且内容含 StyleSheet.create
// (避免把业务 .ts 误收为样式文件)。返回结构 { jsx, style } 字段名与 h5 一致,规则层无感。
import fs from 'node:fs';
import path from 'node:path';

const JSX_EXTS = ['.jsx', '.tsx'];
const STYLE_NAME_RE = /(?:^|\.)styles\.(?:ts|js)$/;

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
    } else if (STYLE_NAME_RE.test(e.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('StyleSheet.create')) {
        style.push({ file: full, rel, content });
      }
    }
  }
}

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i);
}
