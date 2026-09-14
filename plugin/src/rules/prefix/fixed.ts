/**
 * fixed- 视口固定定位前缀。
 *
 * 触发:
 * - constraints.vertical === 'MIN' (贴顶) 或 'MAX' (贴底),且 horizontal === 'STRETCH' / 'CENTER'
 * - 或节点位于父顶部/底部 8% 范围(启发式)
 *
 * 注意 Figma 插件 API 的 ConstraintType 用 MIN/CENTER/MAX/STRETCH/SCALE
 * (与 REST API 的 TOP/BOTTOM/LEFT/RIGHT 不同):
 *   MIN = 贴顶/贴左, MAX = 贴底/贴右, STRETCH = 拉伸.
 */
import { hit, NO_MATCH, type InferFn } from './types';

export const inferFixed: InferFn = (node) => {
  const constraints = (node as ConstraintMixin).constraints;
  if (constraints) {
    const isTopOrBottom = constraints.vertical === 'MIN' || constraints.vertical === 'MAX';
    const isHorizontalStretch =
      constraints.horizontal === 'STRETCH' || constraints.horizontal === 'CENTER';
    if (isTopOrBottom && isHorizontalStretch) {
      return hit(
        'medium',
        `constraints v=${constraints.vertical}(${constraints.vertical === 'MIN' ? '贴顶' : '贴底'}), h=${constraints.horizontal} → fixed-`,
      );
    }
  }

  // 启发式:位于父顶部/底部 8% 范围
  const parent = node.parent;
  if (parent && 'height' in parent && 'y' in node) {
    const parentH = (parent as { height: number }).height;
    if (parentH > 0) {
      const ratio = (node as { y: number }).y / parentH;
      if (ratio < 0.08) {
        return hit('low', `位于父顶部 ${(ratio * 100).toFixed(1)}% → fixed-(启发式)`);
      }
      const bottomRatio = ((node as { y: number; height: number }).y +
        (node as { height: number }).height) / parentH;
      if (bottomRatio > 0.92) {
        return hit('low', `位于父底部 ${((1 - bottomRatio) * 100).toFixed(1)}% → fixed-(启发式)`);
      }
    }
  }

  return NO_MATCH;
};
