/**
 * sub- 独立模块前缀:AI 单独处理,生成独立组件。
 *
 * 触发(启发式,置信度中):
 * - 是顶层页面 frame 的直接子(或最多两级)
 * - 子孙节点数 > 8
 * - 与兄弟主轴间距 > 24px(是独立版块非紧密内容)
 */
import { hit, NO_MATCH, type InferFn } from './types';

const DESCENDANT_THRESHOLD = 8;
const SIBLING_GAP_THRESHOLD = 24;
const MAX_DEPTH_FROM_PAGE_CHILD = 2;

function countDescendants(node: SceneNode, cap: number): number {
  if (!('children' in node)) return 0;
  let n = 0;
  for (const c of node.children) {
    n += 1;
    if (n > cap) return n;
    n += countDescendants(c, cap - n);
    if (n > cap) return n;
  }
  return n;
}

function depthFromPageChild(node: SceneNode): number {
  // 计算从「Page 的直接子」到该节点的深度;返回 -1 表示节点不在 Page 树里
  let depth = 0;
  let cur: BaseNode | null = node;
  while (cur && cur.parent && cur.parent.type !== 'PAGE') {
    depth += 1;
    cur = cur.parent;
    if (depth > 10) return -1;
  }
  return cur && cur.parent && cur.parent.type === 'PAGE' ? depth : -1;
}

export const inferSub: InferFn = (node) => {
  if (
    node.type !== 'FRAME' &&
    node.type !== 'GROUP' &&
    node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE'
  ) {
    return NO_MATCH;
  }

  const depth = depthFromPageChild(node);
  if (depth < 0 || depth > MAX_DEPTH_FROM_PAGE_CHILD) return NO_MATCH;

  const descendants = countDescendants(node, DESCENDANT_THRESHOLD * 2);
  if (descendants < DESCENDANT_THRESHOLD) return NO_MATCH;

  // 与兄弟间距(可选检查,主要靠深度 + 子孙数)
  const parent = node.parent;
  let siblingGapNote = '';
  if (parent && 'children' in parent && 'y' in node) {
    const idx = (parent as FrameNode).children.findIndex((c) => c.id === node.id);
    if (idx > 0) {
      const prev = (parent as FrameNode).children[idx - 1] as unknown as {
        y: number;
        height: number;
      };
      const cur = node as unknown as { y: number };
      const gap = cur.y - (prev.y + prev.height);
      if (gap > SIBLING_GAP_THRESHOLD) {
        siblingGapNote = `,与上兄弟间距 ${gap.toFixed(1)}px`;
      }
    }
  }

  return hit(
    'medium',
    `Page 深度 ${depth}, 子孙 ${descendants} 个${siblingGapNote} → sub-`,
  );
};
