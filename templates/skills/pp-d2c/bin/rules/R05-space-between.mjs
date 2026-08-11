// R05 space-between
// 触发: primaryAxisAlignItems === 'SPACE_BETWEEN' (Figma AutoLayout)
// 期望: 对应 CSS 类含 justify-content: space-between
// 反向 warning: 类内含 margin-*:auto / justify-content:flex-* / gap:auto 之类模拟法

export const id = 'R05';
export const name = 'space-between';

export function check({ cache, product, config, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.primaryAxisAlignItems !== 'SPACE_BETWEEN') continue;

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: '产物 jsx 里 data-node-id 缺失或无 className',
        actual: '产物中无对应 className',
        file: '(missing in jsx)',
        line: 0,
        snippet: '',
      });
      continue;
    }

    let ok = false;
    let hitFile = null;
    let hitLine = 0;
    let hitSnippet = '';

    for (const cls of classes) {
      for (const s of product.style) {
        const rules = collectRules(s.content, cls);
        for (const r of rules) {
          if (/justify-content\s*:\s*space-between/i.test(r.body)) {
            ok = true;
            break;
          }
          if (!hitFile) {
            hitFile = s.rel;
            hitLine = r.line;
            hitSnippet = r.snippet;
          }
        }
        if (ok) break;
      }
      if (ok) break;
    }

    if (!ok) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: 'css 含 justify-content: space-between',
        actual: 'css 未含 justify-content: space-between (可能用 margin/flex-end 模拟)',
        file: hitFile || '(missing in style)',
        line: hitLine,
        snippet: hitSnippet,
      });
    }
  }

  return violations;
}

function collectRules(css, className) {
  const re = new RegExp(`\\.${escapeRegex(className)}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const line = css.slice(0, m.index).split('\n').length;
    out.push({ line, body: m[1], snippet: m[0].slice(0, 200) });
  }
  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
