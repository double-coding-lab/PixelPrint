/**
 * scrollx- / scrolly- 滚动容器前缀。
 *
 * 触发:
 * - node.overflowDirection === 'HORIZONTAL' / 'VERTICAL' / 'BOTH'
 * - 或子层沿主轴超出父 bbox(启发式)
 */
import { hit, NO_MATCH, type InferFn } from './types';

export const inferScrollx: InferFn = (node) => {
  const overflow = (node as FrameNode).overflowDirection;
  if (overflow === 'HORIZONTAL' || overflow === 'BOTH') {
    return hit('high', `overflowDirection=${overflow} → scrollx-`);
  }

  if (
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    'width' in node
  ) {
    const w = (node as FrameNode).width;
    const visible = (node as FrameNode).children.filter((c) => c.visible !== false);
    if (visible.length >= 2) {
      // 判断:子按 x 排列,总跨度 > 父宽度 * 1.2
      const rights = visible.map(
        (c) => (c as unknown as { x: number; width: number }).x + (c as unknown as { width: number }).width,
      );
      const lefts = visible.map((c) => (c as unknown as { x: number }).x);
      const totalSpan = Math.max(...rights) - Math.min(...lefts);
      if (totalSpan > w * 1.2) {
        return hit(
          'medium',
          `子层横向总跨度 ${totalSpan.toFixed(0)} > 父宽 ${w.toFixed(0)} × 1.2 → scrollx-`,
        );
      }
    }
  }

  return NO_MATCH;
};

export const inferScrolly: InferFn = (node) => {
  const overflow = (node as FrameNode).overflowDirection;
  if (overflow === 'VERTICAL' || overflow === 'BOTH') {
    return hit('high', `overflowDirection=${overflow} → scrolly-`);
  }

  if (
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    'height' in node
  ) {
    const h = (node as FrameNode).height;
    const visible = (node as FrameNode).children.filter((c) => c.visible !== false);
    if (visible.length >= 2) {
      const bottoms = visible.map(
        (c) =>
          (c as unknown as { y: number; height: number }).y +
          (c as unknown as { height: number }).height,
      );
      const tops = visible.map((c) => (c as unknown as { y: number }).y);
      const totalSpan = Math.max(...bottoms) - Math.min(...tops);
      if (totalSpan > h * 1.2) {
        return hit(
          'medium',
          `子层纵向总跨度 ${totalSpan.toFixed(0)} > 父高 ${h.toFixed(0)} × 1.2 → scrolly-`,
        );
      }
    }
  }

  return NO_MATCH;
};
