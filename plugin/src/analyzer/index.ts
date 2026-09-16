/**
 * Analyzer 聚合入口(纯代码,不依赖 AI)。
 *
 * - analyze():跑视觉分组建议(merge img-),从内到外
 * - oneClickMerge():等同 analyze(v1 语义,只生成建议不删任何东西)
 *
 * 清理隐藏节点单独走 code.ts 的 deleteHidden 消息,产出 deleteHiddenResult。
 */
import type { AnalyzeResult, Suggestion } from '../types';
import { detectVisualGroups } from './visualGroup';

export { deleteHiddenNodes } from './deleteHidden';
export { iterativeMerge } from './mergeIterative';
export type { IterativeMergeOptions, IterativeMergeResult } from './mergeIterative';
export { diagnoseMerge } from './diagnoseMerge';
export type { DiagnoseInput, DiagnoseResult } from './diagnoseMerge';
export { ungroupNodes } from './ungroup';
export type { UngroupOptions, UngroupResult } from './ungroup';

export interface AnalyzeOptions {
  /** 目标根节点 id 列表。若为空,fallback 到 currentPage.children。 */
  rootIds?: string[];
}

let seq = 0;
function makeId(kind: string): string {
  seq += 1;
  return `code-${kind}-${seq}`;
}

async function buildGroupSuggestions(roots: string[]): Promise<Suggestion[]> {
  const groups = await detectVisualGroups(roots);
  const suggestions: Suggestion[] = [];
  for (const g of groups) {
    const gapScore = 1 - Math.min(1, g.gapMax / 12);
    const sizeScore = Math.min(1, (g.memberIds.length - 2) / 4 + 0.6);
    const confidence = Math.min(0.9, 0.55 + gapScore * 0.2 + sizeScore * 0.15);
    suggestions.push({
      id: makeId('group'),
      source: 'code',
      nodeIds: g.memberIds,
      action: 'merge',
      suggestedPrefix: 'img-',
      reason: `视觉贴合(gap ≤ ${Math.round(g.gapMax)}px)的 ${g.memberIds.length} 个图形层建议合并为一个 img- 组(位于「${g.parentName}」下)`,
      confidence,
    });
  }
  return suggestions;
}

export async function analyze(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const t0 = Date.now();
  let roots = opts.rootIds ?? [];
  if (roots.length === 0) roots = figma.currentPage.children.map((c) => c.id);
  const suggestions = await buildGroupSuggestions(roots);
  return { suggestions, elapsedMs: Date.now() - t0, scannedNodes: roots.length };
}

/**
 * 一键合并:等同 analyze,只生成合并建议。清理隐藏由单独按钮触发。
 */
export async function oneClickMerge(): Promise<AnalyzeResult> {
  return analyze();
}
