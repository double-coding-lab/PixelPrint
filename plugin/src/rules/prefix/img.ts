/**
 * img- 整块图片前缀:整块导出为图片,内部不拆解。
 *
 * 触发:
 * - 节点自身有 IMAGE 类型 fill
 * - 或 frame 内只有 1 个子且子是 RECT + IMAGE fill / 单一 VECTOR
 */
import { getFillsArray, hasChildren, hit, NO_MATCH, type InferFn } from './types';

export const inferImg: InferFn = (node) => {
  const fills = getFillsArray(node);
  const hasImageFill = fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
  if (hasImageFill) {
    return hit('high', '自身 fills 含 IMAGE → img-');
  }

  if (hasChildren(node)) {
    const visibleChildren = node.children.filter((c) => c.visible !== false);
    if (visibleChildren.length === 1) {
      const child = visibleChildren[0];
      if (child.type === 'RECTANGLE' || child.type === 'ELLIPSE' || child.type === 'POLYGON') {
        const childFills = getFillsArray(child);
        if (childFills.some((f) => f.type === 'IMAGE' && f.visible !== false)) {
          return hit('high', '单一 RECT 子含 IMAGE fill → img-');
        }
      }
      if (child.type === 'VECTOR') {
        return hit('medium', '单一 VECTOR 子 → img-(可能是插画)');
      }
    }
  }

  return NO_MATCH;
};
