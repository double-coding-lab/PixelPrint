// R05 space-between(rn 版,改写——属性名换 camelCase 字符串值)
// 触发: primaryAxisAlignItems === 'SPACE_BETWEEN'(Figma AutoLayout)
// 期望: style 含 justifyContent: 'space-between'
// 反向 warning: margin*: 'auto' 模拟法在 RN 无效(RN 不支持 auto margin 撑开),单独报 warning
// 跳过: baked/hidden/templateDup;无 styleKey 交 R21

import { findProperty, allRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R05';
export const name = 'space-between';

export function check({ cache, product, classMap }) {
  const hits = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.primaryAxisAlignItems !== 'SPACE_BETWEEN') continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21

    const found = findProperty(product.style, keys, /justifyContent\s*:\s*['"]space-between['"]/);
    if (!found.hit) {
      hits.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: "justifyContent: 'space-between'(Figma primaryAxisAlignItems=SPACE_BETWEEN)",
        actual: "style 未含 justifyContent: 'space-between'",
        file: found.firstRel || '(missing in style)',
        line: found.firstLine || 0,
        snippet: found.firstSnippet || '',
      });
    }

    // margin auto 模拟法在 RN 无效,发现即 warning(不阻断,提醒改回 space-between)
    const bodies = allRuleBodies(product.style, keys);
    if (bodies.some((b) => /margin\w*\s*:\s*['"]auto['"]/.test(b))) {
      hits.push({
        rule: id,
        severity: 'warning',
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: "space-between 用 justifyContent 表达",
        actual: "style 出现 margin*: 'auto'(RN 不支持 auto margin 撑开,该写法无效)",
        file: '(style)',
        line: 0,
        snippet: '',
      });
    }
  }

  return hits;
}
