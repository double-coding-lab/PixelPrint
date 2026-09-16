/**
 * Scanner 入口(v0.3):遍历 Figma 图层树,生成全量 TreeNode 列表。
 * 不做任何前缀 / autolayout 推断——那是用户手工的活。
 */
import { PREFIX_CATALOG, SCAN_LIMITS } from '../rules/prefix-catalog';
import type { Scope, ScanResult, ScanSummary, TreeNode } from '../types';
import { shouldGenerateCandidate, walk } from './walker';

export interface ScanOptions {
  scope: Scope;
  onProgress?: (scanned: number) => void;
}

function determineRoots(scope: Scope): ReadonlyArray<SceneNode> {
  if (scope === 'selection') {
    const sel = figma.currentPage.selection;
    if (sel.length === 0) return [];
    return sel;
  }
  return figma.currentPage.children;
}

/** 从图层名开头剥出已有 D2C 前缀组合(如 "fixed-sub-"),不匹配返回 null。 */
export function extractExistingPrefix(name: string): string | null {
  const known = Object.keys(PREFIX_CATALOG);
  let matched = '';
  let rest = name;
  outer: while (rest.length > 0) {
    for (const p of known) {
      if (rest.startsWith(p)) {
        matched += p;
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    break;
  }
  return matched || null;
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const roots = determineRoots(opts.scope);
  const tree: TreeNode[] = [];
  const rootIds = roots.map((r) => r.id);

  let scanned = 0;
  let stopReason: string | undefined;

  await walk(
    roots,
    (node, path) => {
      if (scanned >= SCAN_LIMITS.hardStopNodes) {
        stopReason = `节点数超硬上限 ${SCAN_LIMITS.hardStopNodes},请缩小选择范围`;
        return 'stop';
      }

      const parent = node.parent;
      const parentId =
        parent && parent.type !== 'PAGE' && !rootIds.includes(node.id) ? parent.id : null;

      const treeNode: TreeNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        depth: path.length - 1,
        parentId,
        childrenIds: 'children' in node ? node.children.map((c) => c.id) : [],
        isCandidate: shouldGenerateCandidate(node),
        hidden: !node.visible,
        locked: 'locked' in node && (node as SceneNode & { locked: boolean }).locked,
        existingPrefix: extractExistingPrefix(node.name),
      };
      tree.push(treeNode);

      return 'continue';
    },
    (n) => {
      scanned = n;
      if (opts.onProgress) opts.onProgress(scanned);
    },
    SCAN_LIMITS.yieldEveryN,
  );

  const summary: ScanSummary = {
    scope: opts.scope,
    totalNodes: scanned,
    hardStop: stopReason,
  };

  return { tree, rootIds, summary };
}
