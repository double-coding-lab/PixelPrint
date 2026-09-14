/**
 * Applier:接收用户勾选的候选,原地改 Figma 图层名 + 设 auto layout。
 *
 * 边界:
 * - 单条 try/catch,失败不影响其他条
 * - 只改 name 和 auto layout 相关属性,不改视觉属性、不改层级
 * - Figma 每次消息处理结束自动 commit undo,不显式 commitUndo
 */
import { SCAN_LIMITS } from '../rules/prefix-catalog';
import type { ApplyResult, Candidate, FailedItem } from '../types';

export interface ApplyOptions {
  candidates: Candidate[];
  candidateIds: string[];
  onProgress?: (applied: number, total: number) => void;
}

export async function apply(opts: ApplyOptions): Promise<ApplyResult> {
  const idSet = new Set(opts.candidateIds);
  const targets = opts.candidates.filter((c) => idSet.has(c.id) && !c.blockApply);
  const failed: FailedItem[] = [];
  let success = 0;

  for (let i = 0; i < targets.length; i++) {
    const cand = targets[i];
    try {
      const node = (await figma.getNodeByIdAsync(cand.id)) as SceneNode | null;
      if (!node) {
        failed.push({
          id: cand.id,
          nodePath: cand.nodePath,
          message: '节点已不存在(可能已被删除)',
        });
        continue;
      }
      if ('locked' in node && (node as SceneNode & { locked: boolean }).locked) {
        failed.push({
          id: cand.id,
          nodePath: cand.nodePath,
          message: '节点已锁定',
        });
        continue;
      }

      // 改名
      if (cand.suggestedName && cand.suggestedName !== node.name) {
        node.name = cand.suggestedName;
      }

      // 设 auto layout(仅对 FRAME/COMPONENT/INSTANCE 生效)
      if (cand.suggestedAutolayout) {
        const spec = cand.suggestedAutolayout;
        if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'INSTANCE'
        ) {
          const frame = node as FrameNode;
          frame.layoutMode = spec.layoutMode;
          frame.paddingTop = spec.paddingTop;
          frame.paddingRight = spec.paddingRight;
          frame.paddingBottom = spec.paddingBottom;
          frame.paddingLeft = spec.paddingLeft;
          frame.itemSpacing = spec.itemSpacing;
          frame.counterAxisAlignItems = spec.counterAxisAlignItems;
          frame.primaryAxisAlignItems = spec.primaryAxisAlignItems;
        } else {
          failed.push({
            id: cand.id,
            nodePath: cand.nodePath,
            message: `节点类型 ${node.type} 不支持 auto layout(仅 FRAME 系可设)`,
          });
          continue;
        }
      }

      success += 1;
    } catch (err) {
      failed.push({
        id: cand.id,
        nodePath: cand.nodePath,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (opts.onProgress && (i + 1) % SCAN_LIMITS.yieldEveryN === 0) {
      opts.onProgress(i + 1, targets.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (opts.onProgress) opts.onProgress(targets.length, targets.length);
  return { success, failed };
}
