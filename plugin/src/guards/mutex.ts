/**
 * 前缀互斥硬规则:命中即阻止 Apply。
 *
 * 规则来源对齐 pp-doctor SKILL(templates/skills/pp-doctor/SKILL.md):
 * - NAM014: fixed- + (bg- / bgc- / x-)  → 不生成节点无法挂 fixed
 * - NAM016: end-   + (bg- / bgc- / x-)  → 同上
 * - NAM019: input- + (bg- / bgc- / x-)  → 同上
 * - NAM020: input- + (img- / btn-)      → 语义冲突
 * - SCROLL-MUTEX-1: scrollx- + scrolly- → 同节点二选一
 * - SCROLL-MUTEX-2: (scrollx-/scrolly-) + (img-/bg-/bgc-/x-/btn-)
 *
 * pp-doctor 规则演进时需同步更新此文件。
 */

export type WarningLevel = 'error' | 'warn' | 'info';

export interface Warning {
  level: WarningLevel;
  code: string;
  message: string;
}

interface MutexRule {
  code: string;
  message: (prefix: string) => string;
  test: (prefixes: Set<string>) => boolean;
}

function hasAny(prefixes: Set<string>, list: string[]): boolean {
  return list.some((p) => prefixes.has(p));
}

const NO_NODE_PREFIXES = ['bg-', 'bgc-', 'x-'];

const RULES: MutexRule[] = [
  {
    code: 'NAM014',
    message: (p) => `fixed- 不能与 bg- / bgc- / x- 叠加(命中 ${p});这些前缀不生成 DOM 节点,fixed 无处可挂`,
    test: (prefixes) => prefixes.has('fixed-') && hasAny(prefixes, NO_NODE_PREFIXES),
  },
  {
    code: 'NAM016',
    message: (p) => `end- 不能与 bg- / bgc- / x- 叠加(命中 ${p})`,
    test: (prefixes) => prefixes.has('end-') && hasAny(prefixes, NO_NODE_PREFIXES),
  },
  {
    code: 'NAM019',
    message: (p) => `input- 不能与 bg- / bgc- / x- 叠加(命中 ${p})`,
    test: (prefixes) => prefixes.has('input-') && hasAny(prefixes, NO_NODE_PREFIXES),
  },
  {
    code: 'NAM020',
    message: (p) => `input- 不能与 img- / btn- 叠加(命中 ${p});语义冲突,需拆父子结构`,
    test: (prefixes) =>
      prefixes.has('input-') && hasAny(prefixes, ['img-', 'btn-']),
  },
  {
    code: 'SCROLL-MUTEX-1',
    message: () => `scrollx- 与 scrolly- 不能同现,同节点只能二选一`,
    test: (prefixes) => prefixes.has('scrollx-') && prefixes.has('scrolly-'),
  },
  {
    code: 'SCROLL-MUTEX-2',
    message: (p) =>
      `scrollx-/scrolly- 不能与 img- / bg- / bgc- / x- / btn- 叠加(命中 ${p});滚动容器必须递归子层`,
    test: (prefixes) =>
      (prefixes.has('scrollx-') || prefixes.has('scrolly-')) &&
      hasAny(prefixes, ['img-', 'bg-', 'bgc-', 'x-', 'btn-']),
  },
];

/**
 * 把组合前缀字符串(如 "fixed-sub-" / "end-btn-")拆成集合。
 */
export function splitCombinedPrefix(combined: string): Set<string> {
  if (!combined) return new Set();
  const tokens: string[] = [];
  const known = [
    'fixed-',
    'end-',
    'list-',
    'bl-',
    'scrollx-',
    'scrolly-',
    'x-',
    'img-',
    'bg-',
    'bgc-',
    'btn-',
    'sub-',
    'input-',
  ];
  let rest = combined;
  outer: while (rest.length > 0) {
    for (const p of known) {
      if (rest.startsWith(p)) {
        tokens.push(p);
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    // 未识别的前缀,停止解析
    break;
  }
  return new Set(tokens);
}

/**
 * 检查组合前缀是否命中互斥规则,返回 warning 列表。
 */
export function checkMutex(combinedPrefix: string | null): Warning[] {
  if (!combinedPrefix) return [];
  const prefixes = splitCombinedPrefix(combinedPrefix);
  const warnings: Warning[] = [];
  for (const rule of RULES) {
    if (rule.test(prefixes)) {
      const p = Array.from(prefixes).join('');
      warnings.push({
        level: 'error',
        code: rule.code,
        message: rule.message(p),
      });
    }
  }
  return warnings;
}
