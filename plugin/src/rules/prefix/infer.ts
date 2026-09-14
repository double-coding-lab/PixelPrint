/**
 * 前缀推断入口:按组合优先级组合各子规则。
 *
 * 组合规则(与 pp-d2c topic §设计原理一致):
 *   基础前缀优先级:x- > img- > bg- > bgc- > btn- > scrollx-/scrolly- > sub- > input-
 *   修饰前缀:fixed- / end- / list-,叠加在基础前缀左侧;顺序 fixed- > end- > list- > bl-
 *
 * 输出 `suggestedPrefix`:可能是 "fixed-sub-" / "end-btn-" / "sub-" 等组合。
 */
import type { ConfidenceLevel } from '../prefix-catalog';
import { inferBg, inferBgc } from './bg-bgc';
import { inferBtn } from './btn';
import { inferEnd } from './end';
import { inferFixed } from './fixed';
import { inferImg } from './img';
import { inferInput } from './input';
import { inferList } from './list';
import { inferScrollx, inferScrolly } from './scroll';
import { inferSub } from './sub';
import type { InferFn, InferrableNode } from './types';
import { inferX } from './x';

interface PrefixInferOutcome {
  suggestedPrefix: string | null; // 如 "sub-" / "fixed-sub-" / null
  confidence: ConfidenceLevel;
  reason: string[];
}

const BASE_INFERS: Array<{ prefix: string; fn: InferFn }> = [
  { prefix: 'x-', fn: inferX },
  { prefix: 'img-', fn: inferImg },
  { prefix: 'bg-', fn: inferBg },
  { prefix: 'bgc-', fn: inferBgc },
  { prefix: 'scrollx-', fn: inferScrollx },
  { prefix: 'scrolly-', fn: inferScrolly },
  { prefix: 'btn-', fn: inferBtn },
  { prefix: 'input-', fn: inferInput },
  { prefix: 'sub-', fn: inferSub },
];

const MODIFIER_INFERS: Array<{ prefix: string; fn: InferFn }> = [
  { prefix: 'fixed-', fn: inferFixed },
  { prefix: 'end-', fn: inferEnd },
  { prefix: 'list-', fn: inferList },
];

function lowerOf(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  const rank = { high: 3, medium: 2, low: 1 } as const;
  return rank[a] <= rank[b] ? a : b;
}

/**
 * 推断节点应叠加哪些前缀,返回组合后的最终前缀字符串。
 */
export function inferPrefix(node: InferrableNode): PrefixInferOutcome {
  const reasons: string[] = [];
  let confidence: ConfidenceLevel = 'high';

  // 基础前缀:按优先级挑首个命中
  let base: string | null = null;
  for (const item of BASE_INFERS) {
    const r = item.fn(node);
    if (r.matched) {
      base = item.prefix;
      reasons.push(...r.reason);
      confidence = r.confidence;
      break;
    }
  }

  // 修饰前缀:全部检查,依次叠加
  const modifiers: string[] = [];
  for (const item of MODIFIER_INFERS) {
    const r = item.fn(node);
    if (r.matched) {
      modifiers.push(item.prefix);
      reasons.push(...r.reason);
      confidence = lowerOf(confidence, r.confidence);
    }
  }

  if (!base && modifiers.length === 0) {
    return { suggestedPrefix: null, confidence: 'low', reason: [] };
  }

  if (!base && modifiers.length > 0) {
    // 修饰前缀单独命中,不能孤立存在
    return {
      suggestedPrefix: null,
      confidence: 'low',
      reason: [
        ...reasons,
        `⚠️ 命中修饰前缀 ${modifiers.join('/')} 但无基础前缀,需先确认基础前缀`,
      ],
    };
  }

  // 组合:modifiers 从前到后 + base
  const combined = modifiers.join('') + (base || '');
  return { suggestedPrefix: combined, confidence, reason: reasons };
}
