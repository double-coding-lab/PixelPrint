// R01 fixed-position
// 触发: node.name.startsWith('fixed-')
// 期望: 产物 CSS 中该 node 对应类名规则内含 position: fixed

export const id = 'R01';
export const name = 'fixed-position';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const prefix = 'fixed-';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith(prefix)) continue;

    // 反向找 class -> 检查每个 style 文件里该 class 规则内是否含 position: fixed
    const classes = classMap[nodeId] || [];
    if (classes.length === 0) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: `产物 jsx 里 data-node-id="${nodeId}" 缺失 (或未绑 className)`,
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
        const found = findRuleWithProperty(s.content, cls, /position\s*:\s*fixed/i);
        if (found) {
          ok = true;
          break;
        }
        const anyRule = findAnyRule(s.content, cls);
        if (anyRule && !hitFile) {
          hitFile = s.rel;
          hitLine = anyRule.line;
          hitSnippet = anyRule.snippet;
        }
      }
      if (ok) break;
    }

    if (!ok) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: 'css 含 position: fixed',
        actual: 'css 未含 position: fixed (可能只有 relative / static / 无规则)',
        file: hitFile || '(missing in style)',
        line: hitLine,
        snippet: hitSnippet,
      });
    }
  }

  return violations;
}

// 找一个 .cls { ... } 规则并检查里面是否含指定属性正则
function findRuleWithProperty(css, className, propRe) {
  const re = new RegExp(`\\.${escapeRegex(className)}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
  let m;
  while ((m = re.exec(css)) !== null) {
    if (propRe.test(m[1])) return true;
  }
  return false;
}

function findAnyRule(css, className) {
  const re = new RegExp(`\\.${escapeRegex(className)}\\b[^{]*\\{([\\s\\S]*?)\\}`);
  const m = css.match(re);
  if (!m) return null;
  const line = css.slice(0, m.index).split('\n').length;
  return { line, snippet: m[0].slice(0, 200) };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
