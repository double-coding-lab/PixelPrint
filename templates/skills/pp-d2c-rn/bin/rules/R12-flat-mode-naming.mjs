// R12 flat-mode-naming(rn 版,改写——className 冲突换 StyleSheet key 冲突)
// 触发: config.merge.mode === 'flat'(所有 block 产物合并到一个 styles 命名空间)
// 期望: 同一 styleKey 不被重复定义 ≥2 次(跨文件合并后 JS 对象后键覆盖前键,危害同 CSS 覆盖)
// 保守: 统计范围 = 全部 styles 文件的 StyleSheet.create 顶层 key;
//       config 无 merge.mode 或 ≠ flat → 直接放行(安全降级)

import { listStyleKeys } from '../lib/styleMatch.mjs';

export const id = 'R12';
export const name = 'flat-mode-naming';

export function check({ product, config }) {
  if (!config || !config.merge || config.merge.mode !== 'flat') return [];

  const counts = new Map(); // key -> [{ rel, line }]
  for (const s of product.style) {
    for (const { key, line } of listStyleKeys(s.content)) {
      if (!counts.has(key)) counts.set(key, []);
      counts.get(key).push({ rel: s.rel, line });
    }
  }

  const violations = [];
  for (const [key, occ] of counts) {
    if (occ.length >= 2) {
      violations.push({
        rule: id,
        nodeId: '(n/a)',
        name: `styles.${key}`,
        type: 'StyleSheet',
        expected: `flat 模式下 styleKey 唯一;${key} 应带 block 前缀区分(如 topbar${cap(key)})`,
        actual: `styles.${key} 被定义 ${occ.length} 次(合并后后键覆盖前键): ${occ.map((o) => `${o.rel}:${o.line}`).join(', ')}`,
        file: occ[0].rel,
        line: occ[0].line,
        snippet: '',
      });
    }
  }
  return violations;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
