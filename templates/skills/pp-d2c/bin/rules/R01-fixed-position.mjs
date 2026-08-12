// R01 fixed-position
// 触发: node.name.startsWith('fixed-')
// 期望: 产物 CSS 中该 node 对应类名规则内含 position: fixed
//
// v1.1.0 修复 (test12 事故):
// - 只走 classMap[nodeId] 反查, 禁止再走 name 派生兜底
// - SCSS 支持 &__foo / &-foo 嵌套语法, 通过 selector 后缀匹配
// - classMap 空 → 真报 R01 (jsx 缺 data-node-id 或未绑 className)
// v1.2.0: 嵌套匹配逻辑提炼到 lib/cssMatch.mjs 共享；跳过隐藏节点。

import { findProperty } from '../lib/cssMatch.mjs';

export const id = 'R01';
export const name = 'fixed-position';

export function check({ cache, product, classMap }) {
  const violations = [];
  const prefix = 'fixed-';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith(prefix)) continue;
    if (node._hidden) continue; // 隐藏节点不渲染，不校验

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

    const found = findProperty(product.style, classes, /position\s*:\s*fixed/i);
    if (!found.hit) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: 'css 含 position: fixed',
        actual: 'css 未含 position: fixed (可能只有 relative / static / 无规则)',
        file: found.firstRel || '(missing in style)',
        line: found.firstLine || 0,
        snippet: found.firstSnippet || '',
      });
    }
  }

  return violations;
}
