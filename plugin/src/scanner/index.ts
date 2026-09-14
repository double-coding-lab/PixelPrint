/**
 * Scanner 入口:遍历 Figma 图层树,生成候选清单。
 */
import { checkMutex } from '../guards/mutex';
import { generateName } from '../naming/generate';
import { inferAutolayout } from '../rules/autolayout/infer';
import { inferPrefix } from '../rules/prefix/infer';
import { SCAN_LIMITS } from '../rules/prefix-catalog';
import type { Candidate, Scope, ScanResult, ScanSummary } from '../types';
import { shouldGenerateCandidate, walk } from './walker';

export interface ScanOptions {
  scope: Scope;
  onProgress?: (scanned: number, total: number) => void;
}

function determineRoots(scope: Scope): ReadonlyArray<SceneNode> {
  if (scope === 'selection') {
    const sel = figma.currentPage.selection;
    if (sel.length === 0) return [];
    return sel;
  }
  return figma.currentPage.children;
}

function isTopLevelSub(node: SceneNode): boolean {
  return !!node.parent && node.parent.type === 'PAGE';
}

function decideDefaultChecked(
  confidence: 'high' | 'medium' | 'low',
  blockApply: boolean,
  suggestedPrefix: string | null,
): boolean {
  if (blockApply) return false;
  if (!suggestedPrefix) return false;
  return confidence === 'high' || confidence === 'medium';
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const roots = determineRoots(opts.scope);
  const candidates: Candidate[] = [];

  let scanned = 0;
  let stopReason: string | undefined;

  await walk(
    roots,
    (node, path) => {
      if (scanned >= SCAN_LIMITS.hardStopNodes) {
        stopReason = `节点数超硬上限 ${SCAN_LIMITS.hardStopNodes},请缩小选择范围`;
        return 'stop';
      }

      if (!shouldGenerateCandidate(node)) return 'continue';

      const isLocked = 'locked' in node && (node as SceneNode & { locked: boolean }).locked;

      const prefixOutcome = inferPrefix(node);
      const autoOutcome = inferAutolayout(node);

      const siblingNames: string[] = [];
      if (node.parent && 'children' in node.parent) {
        for (const sib of node.parent.children) {
          if (sib.id !== node.id) siblingNames.push(sib.name);
        }
      }
      const naming = generateName(node.name, prefixOutcome.suggestedPrefix, {
        siblingNames,
        isTopLevelSub: isTopLevelSub(node),
      });

      const mutexWarnings = checkMutex(prefixOutcome.suggestedPrefix);

      const autolayoutWarnings = autoOutcome.warnings.map((m) => ({
        level: 'warn' as const,
        code: 'AUTOLAYOUT_MISMATCH',
        message: m,
      }));

      const warnings = [...mutexWarnings, ...naming.warnings, ...autolayoutWarnings];

      if (isLocked) {
        warnings.push({
          level: 'warn',
          code: 'NODE_LOCKED',
          message: '节点已锁定,Apply 前请先解锁',
        });
      }

      const blockApply =
        mutexWarnings.some((w) => w.level === 'error') || isLocked;

      const hasAnySuggestion =
        !!prefixOutcome.suggestedPrefix ||
        autoOutcome.spec !== null ||
        warnings.some((w) => w.level !== 'info');
      if (!hasAnySuggestion) return 'continue';

      const cand: Candidate = {
        id: node.id,
        nodePath: path.join(' > '),
        currentName: node.name,
        suggestedPrefix: prefixOutcome.suggestedPrefix,
        suggestedName: naming.suggestedName,
        suggestedAutolayout: autoOutcome.spec,
        confidence: prefixOutcome.suggestedPrefix
          ? prefixOutcome.confidence
          : autoOutcome.spec
          ? 'medium'
          : 'low',
        reason: [...prefixOutcome.reason, ...autoOutcome.reason],
        warnings,
        defaultChecked: decideDefaultChecked(
          prefixOutcome.confidence,
          blockApply,
          prefixOutcome.suggestedPrefix,
        ),
        blockApply,
      };
      candidates.push(cand);
      return 'continue';
    },
    (n) => {
      scanned = n;
      if (opts.onProgress) opts.onProgress(scanned, scanned);
    },
    SCAN_LIMITS.yieldEveryN,
  );

  const summary: ScanSummary = {
    scope: opts.scope,
    totalNodes: scanned,
    totalCandidates: candidates.length,
    hardStop: stopReason,
  };

  return { candidates, summary };
}
