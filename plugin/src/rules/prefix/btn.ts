/**
 * btn- 按钮前缀:可点击容器,内部通常含 TEXT。
 *
 * 触发:
 * - 有 reactions.length > 0(Figma prototype 交互)
 * - name 含 "btn" / "button" / "按钮"
 * - 或 frame 内含 TEXT + 有 cornerRadius > 0 或 SOLID fill,子孙 ≤ 5
 */
import { getFillsArray, hasChildren, hit, NO_MATCH, type InferFn } from './types';

const NAME_HINTS = ['btn', 'button', '按钮'];

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

function hasTextDescendant(node: SceneNode): boolean {
  if (node.type === 'TEXT') return true;
  if (!('children' in node)) return false;
  return node.children.some((c) => hasTextDescendant(c));
}

export const inferBtn: InferFn = (node) => {
  const reactions = (node as ReactionMixin).reactions;
  if (reactions && reactions.length > 0) {
    return hit('high', `reactions.length=${reactions.length} → btn-`);
  }

  const lower = node.name.toLowerCase();
  const nameHit = NAME_HINTS.find((w) => lower.includes(w));
  if (nameHit) {
    return hit('medium', `name 含 "${nameHit}" → btn-`);
  }

  if (hasChildren(node) && hasTextDescendant(node)) {
    const descendantCount = countDescendants(node, 6);
    if (descendantCount <= 5) {
      const cornerRadius = (node as CornerMixin).cornerRadius;
      const hasCorner = typeof cornerRadius === 'number' && cornerRadius > 0;
      const fills = getFillsArray(node);
      const hasSolidFill = fills.some((f) => f.type === 'SOLID' && f.visible !== false);
      if (hasCorner || hasSolidFill) {
        return hit(
          'medium',
          `内含 TEXT + ${hasCorner ? 'cornerRadius' : 'SOLID fill'} + 子孙 ${descendantCount} 个 → btn-`,
        );
      }
    }
  }

  return NO_MATCH;
};
