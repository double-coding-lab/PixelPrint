// R01 fixed-position
// 触发: node.name.startsWith('fixed-')
// 期望: 产物 CSS 中该 node 对应类名规则内含 position: fixed
//
// v1.1.0 修复 (test12 事故):
// - 只走 classMap[nodeId] 反查, 禁止再走 name 派生兜底
// - SCSS 支持 &__foo / &-foo 嵌套语法, 通过 selector 后缀匹配
// - classMap 空 → 真报 R01 (jsx 缺 data-node-id 或未绑 className)

export const id = 'R01';
export const name = 'fixed-position';

export function check({ cache, product, classMap }) {
  const violations = [];
  const prefix = 'fixed-';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith(prefix)) continue;

    const classes = classMap[nodeId] || [];
    if (classes.length === 0) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: `jsx 里 data-node-id="${nodeId}" 元素绑定 className, 才能在 CSS 中反查 position: fixed`,
        actual: '产物 jsx 未找到 data-node-id + className 映射; 若产物无该 nodeId 视为漏画',
        file: '(missing in jsx)',
        line: 0,
        snippet: '',
      });
      continue;
    }

    let ok = false;
    let firstHitFile = null;
    let firstHitLine = 0;
    let firstHitSnippet = '';
    outer: for (const cls of classes) {
      for (const s of product.style) {
        const found = findRuleContainingProperty(s.content, cls, /position\s*:\s*fixed/i);
        if (found) {
          ok = true;
          break outer;
        }
        const anyRule = findAnyRule(s.content, cls);
        if (anyRule && !firstHitFile) {
          firstHitFile = s.rel;
          firstHitLine = anyRule.line;
          firstHitSnippet = anyRule.snippet;
        }
      }
    }

    if (!ok) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: 'css 含 position: fixed',
        actual: 'css 未含 position: fixed (可能只有 relative / static / 无规则)',
        file: firstHitFile || '(missing in style)',
        line: firstHitLine,
        snippet: firstHitSnippet,
      });
    }
  }

  return violations;
}

// 在 CSS/SCSS 里搜含指定 className 的规则并检查属性
// 支持形态:
//   a. 完整选择器      `.foo { ... }`  |  `.parent .foo { ... }`
//   b. SCSS `&` 嵌套    `&__bar { ... }` (className 拼装为 parent__bar)
//   c. SCSS `&-xxx`     `&-bar { ... }` (className 拼装为 parent-bar)
//   d. 后缀匹配         className 结尾 = 选择器最后一段
function findRuleContainingProperty(css, className, propRe) {
  const cn = className.trim();
  if (!cn) return false;

  // 1) 完整选择器直接匹配
  const escaped = cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directRe = new RegExp(`\\.${escaped}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
  let m;
  while ((m = directRe.exec(css)) !== null) {
    if (propRe.test(m[1])) return true;
  }

  // 2) SCSS 嵌套 &__xxx / &-xxx: 求 className 里 __ 或 - 的最后一段
  const scssSuffixes = deriveScssSuffixes(cn);
  for (const suffix of scssSuffixes) {
    const suffixEsc = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // &__foo { ... } 或 &-foo { ... }
    const nestedRe = new RegExp(`&${suffixEsc}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
    while ((m = nestedRe.exec(css)) !== null) {
      if (propRe.test(m[1])) return true;
    }
  }

  return false;
}

// className "test12-page__fixed-bar" → ["__fixed-bar", "-fixed-bar"]
// className "page-fixed-bar" → ["-fixed-bar"] (无 __)
// className "foo" → [] (无分隔符则无 scss 嵌套形态可推)
function deriveScssSuffixes(className) {
  const out = new Set();
  const idxDouble = className.lastIndexOf('__');
  if (idxDouble >= 0) {
    out.add(className.slice(idxDouble)); // "__fixed-bar"
  }
  const idxDash = className.lastIndexOf('-');
  if (idxDash > 0) {
    out.add('-' + className.slice(idxDash + 1)); // 只切最后一段(fixed-bar 结构下不够准, 但保守能匹到 &-bar)
  }
  // 补一个: 从 className 里去掉常见 BEM 前缀 (parent-page__ / parent__)
  // 主要为了兼容 `test12-page__fixed-bar` → scss 里 `&__fixed-bar`
  return Array.from(out);
}

function findAnyRule(css, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\.${escaped}\\b[^{]*\\{([\\s\\S]*?)\\}`);
  const m = css.match(re);
  if (!m) return null;
  const line = css.slice(0, m.index).split('\n').length;
  return { line, snippet: m[0].slice(0, 200) };
}
