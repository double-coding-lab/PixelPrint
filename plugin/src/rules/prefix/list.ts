/**
 * list- 同构列表前缀:声明子元素是同构列表项。
 *
 * 触发:
 * - 内有 ≥ 2 个同构子(类型 + 深度 3 子结构签名相同)
 */
import { hasChildren, hit, NO_MATCH, type InferFn } from './types';

/**
 * 生成节点的结构签名:type + 直接子 type 列表 + 深度 3 内的子结构。
 * 与 pp-d2c loadCache 的 structureSig 语义一致。
 */
function structureSig(node: SceneNode, depth: number): string {
  if (depth <= 0) return node.type;
  if (!('children' in node)) return node.type;
  const children = node.children;
  if (children.length === 0) return `${node.type}[]`;
  const childSigs = children.map((c) => structureSig(c, depth - 1)).join(',');
  return `${node.type}[${childSigs}]`;
}

export const inferList: InferFn = (node) => {
  if (!hasChildren(node)) return NO_MATCH;
  const visibleChildren = node.children.filter((c) => c.visible !== false);
  if (visibleChildren.length < 2) return NO_MATCH;

  // 计算所有子的结构签名,统计相同签名的最大簇
  const sigs = visibleChildren.map((c) => structureSig(c, 3));
  const counts = new Map<string, number>();
  for (const s of sigs) counts.set(s, (counts.get(s) || 0) + 1);

  let maxCluster = 0;
  for (const v of counts.values()) if (v > maxCluster) maxCluster = v;

  if (maxCluster >= 2 && maxCluster / visibleChildren.length >= 0.6) {
    return hit(
      'medium',
      `同构簇 ${maxCluster}/${visibleChildren.length} → list-`,
    );
  }

  return NO_MATCH;
};
