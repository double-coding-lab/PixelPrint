/**
 * end- 贴父末端前缀:父 autoLayout 里贴向末端。
 *
 * 触发:
 * - 父有 layoutMode !== 'NONE'
 * - 是父最后一个可见子
 * - 与前一兄弟主轴间距 > 兄弟间平均间距 × 2(明显有额外留白)
 */
import { hit, NO_MATCH, type InferFn } from './types';

export const inferEnd: InferFn = (node) => {
  const parent = node.parent;
  if (!parent || !('layoutMode' in parent)) return NO_MATCH;
  const layoutMode = (parent as FrameNode).layoutMode;
  if (layoutMode !== 'HORIZONTAL' && layoutMode !== 'VERTICAL') return NO_MATCH;

  if (!('children' in parent)) return NO_MATCH;
  const visibleChildren = (parent as FrameNode).children.filter((c) => c.visible !== false);
  if (visibleChildren.length < 3) return NO_MATCH; // 2 个子无所谓 end-,直接用 SPACE_BETWEEN
  const lastVisible = visibleChildren[visibleChildren.length - 1];
  if (lastVisible.id !== node.id) return NO_MATCH;

  // 计算主轴间距
  const axis = layoutMode === 'HORIZONTAL' ? 'x' : 'y';
  const sizeAxis = layoutMode === 'HORIZONTAL' ? 'width' : 'height';

  const positions = visibleChildren.map((c) => {
    const nc = c as unknown as { x: number; y: number; width: number; height: number };
    return {
      start: nc[axis],
      end: nc[axis] + nc[sizeAxis],
    };
  });

  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    gaps.push(positions[i].start - positions[i - 1].end);
  }
  if (gaps.length < 2) return NO_MATCH;

  const lastGap = gaps[gaps.length - 1];
  const otherGaps = gaps.slice(0, -1);
  const avgOther = otherGaps.reduce((a, b) => a + b, 0) / otherGaps.length;

  if (avgOther > 0 && lastGap > avgOther * 2) {
    return hit(
      'medium',
      `父 ${layoutMode},末位间距 ${lastGap.toFixed(1)} > 平均 ${avgOther.toFixed(1)} × 2 → end-`,
    );
  }

  return NO_MATCH;
};
