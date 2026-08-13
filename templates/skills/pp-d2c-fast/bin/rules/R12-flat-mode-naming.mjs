// R12 flat-mode-naming（v1.2.3 软→硬迁移）
// 触发: config.merge.mode === 'flat'（所有 block 产物合并到一个文件）
// 期望: 同一 className 不被多个顶层规则体重复定义(合并后互相覆盖)
// 保守: 只统计「纯 .class {」顶层选择器,不含 .class:hover / .a .class / .class.x 等修饰形态;
//       config 无 merge.mode 或 ≠ flat → 直接放行(安全降级)。
export const id = 'R12';
export const name = 'flat-mode-naming';

export function check({ product, config }) {
  if (!config || !config.merge || config.merge.mode !== 'flat') return [];

  const counts = new Map(); // class -> [{ rel, line }]
  const re = /(?:^|[\s}])\.([a-zA-Z_][\w-]*)\s*\{/g;

  for (const s of product.style) {
    let m;
    while ((m = re.exec(s.content)) !== null) {
      const cls = m[1];
      const line = s.content.slice(0, m.index).split('\n').length;
      if (!counts.has(cls)) counts.set(cls, []);
      counts.get(cls).push({ rel: s.rel, line });
    }
    re.lastIndex = 0;
  }

  const violations = [];
  for (const [cls, occ] of counts) {
    if (occ.length >= 2) {
      violations.push({
        rule: id,
        nodeId: '(n/a)',
        name: `.${cls}`,
        type: 'CSS',
        expected: `flat 模式下 className 唯一;.${cls} 应带 block 前缀区分(如 .topbar${cap(cls)})`,
        actual: `.${cls} 被定义 ${occ.length} 次(合并后互相覆盖): ${occ.map((o) => `${o.rel}:${o.line}`).join(', ')}`,
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
