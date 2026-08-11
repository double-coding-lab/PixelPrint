// R08 bg-landing-form
// 触发: node.name.startsWith('bg-') 或 name === 'bg'
// 反向扫产物,禁止:
//   - jsx: <img ... src=".../bg-..." ... />  或  <img ... src=".../bg.<ext>" ... />
//   - jsx: style={{ ... background... }}
//   - jsx: className="...-bg..." 里空 div (无 children) 且挂 bg
//   - scss: ::before / ::after { ... background-image ... }

export const id = 'R08';
export const name = 'bg-landing-form';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const bgPrefix = 'bg-';

  // 先看 cache 有没有 bg- 节点 — 用于生成 nodeId 提示
  const bgNodes = [];
  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name) continue;
    if (node.name.startsWith(bgPrefix) || node.name === 'bg') {
      bgNodes.push({ nodeId, name: node.name });
    }
  }
  if (bgNodes.length === 0) return violations;

  // jsx 反向扫
  for (const j of product.jsx) {
    const lines = j.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // <img src=".../bg-XXX" or .../bg.<ext>
      if (/<img\b[^>]*src=[^>]*bg-/i.test(line)) {
        violations.push(mkV(id, j.rel, i + 1, line.trim(), '<img src="...bg-..."> 应用父容器 background-image 代替', bgNodes[0]));
      } else if (/<img\b[^>]*src=[^>]*\/bg\.[a-z]{2,5}["'`)]/i.test(line)) {
        violations.push(mkV(id, j.rel, i + 1, line.trim(), '<img src="...bg.<ext>"> 应用父容器 background-image 代替', bgNodes[0]));
      }

      // inline style background
      if (/style=\{\{[^}]*background/i.test(line)) {
        violations.push(mkV(id, j.rel, i + 1, line.trim(), 'inline style 挂 background 应用 className + scss background', bgNodes[0]));
      }
    }

    // 空 div 挂 bg-* (整个 <div /> 或空标签,自闭合 or 只有空白 children)
    // 简易匹配: <div className={styles.bg...} data-node-id=... />
    const emptyBgDivRe = /<div\b[^>]*className=\{styles\.(bg[A-Za-z0-9_]*)\}[^>]*\/>/g;
    let m;
    while ((m = emptyBgDivRe.exec(j.content)) !== null) {
      const idx = j.content.slice(0, m.index).split('\n').length;
      violations.push(mkV(id, j.rel, idx, m[0], '空 <div className={styles.bg...} /> 应作为父容器 background 或用父节点直接挂', bgNodes[0]));
    }
  }

  // scss 反向扫 ::before / ::after 挂 background-image
  for (const s of product.style) {
    // 简易: 检索 ::before { ... background-image ... } 块
    const pseudoRe = /::(before|after)\s*\{([\s\S]*?)\}/g;
    let m;
    while ((m = pseudoRe.exec(s.content)) !== null) {
      if (/background-image\s*:/i.test(m[2]) || /background\s*:[^;]*url\(/i.test(m[2])) {
        const idx = s.content.slice(0, m.index).split('\n').length;
        violations.push(mkV(id, s.rel, idx, m[0].slice(0, 200), `::${m[1]} 挂 background-image 应改为父节点直接 background`, bgNodes[0]));
      }
    }
  }

  return violations;
}

function mkV(rule, file, line, snippet, expected, bgNode) {
  return {
    rule,
    nodeId: bgNode ? bgNode.nodeId : '(bg node in cache)',
    name: bgNode ? bgNode.name : '(bg node)',
    type: 'JSX/SCSS',
    expected,
    actual: snippet,
    file,
    line,
    snippet,
  };
}
