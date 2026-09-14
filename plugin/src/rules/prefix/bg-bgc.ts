/**
 * bg- vs bgc- 语义前缀判定。
 *
 * bg-(切图):fills 含 IMAGE / GRADIENT_RADIAL、fills 多层、effects 复杂(> 1 或含 blur)。
 * bgc-(CSS):fills 纯 SOLID / 简单 GRADIENT_LINEAR + 简单 stroke + cornerRadius。
 *
 * 只对"可能是背景装饰的容器"起判定作用——判定前需先看:
 * - 有子且子层不构成主内容(即节点不是内容承载,是装饰底板)
 * - 无子或子只是装饰元素
 *
 * 返回两个候选:'bg-' 或 'bgc-';由调用方选其中之一。
 */
import { getEffectsArray, getFillsArray, hasChildren, hit, NO_MATCH, type InferFn } from './types';

export const inferBgOrBgc: InferFn = (node) => {
  // 只在 FRAME/GROUP/RECT 上判定,TEXT/VECTOR 跳过
  if (
    node.type !== 'FRAME' &&
    node.type !== 'GROUP' &&
    node.type !== 'RECTANGLE' &&
    node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE'
  ) {
    return NO_MATCH;
  }

  const fills = getFillsArray(node);
  const effects = getEffectsArray(node);

  const visibleFills = fills.filter((f) => f.visible !== false);
  if (visibleFills.length === 0 && effects.filter((e) => e.visible !== false).length === 0) {
    return NO_MATCH;
  }

  const hasImageFill = visibleFills.some((f) => f.type === 'IMAGE');
  const hasRadialGradient = visibleFills.some((f) => f.type === 'GRADIENT_RADIAL');
  const hasAngularGradient = visibleFills.some((f) => f.type === 'GRADIENT_ANGULAR');
  const hasDiamondGradient = visibleFills.some((f) => f.type === 'GRADIENT_DIAMOND');
  const multiFill = visibleFills.length > 1;
  const hasBlurEffect = effects.some(
    (e) => e.visible !== false && (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR'),
  );
  const effectCount = effects.filter((e) => e.visible !== false).length;

  // 判定为 bg-(切图)
  if (
    hasImageFill ||
    hasRadialGradient ||
    hasAngularGradient ||
    hasDiamondGradient ||
    multiFill ||
    hasBlurEffect ||
    effectCount > 1
  ) {
    const reasons: string[] = [];
    if (hasImageFill) reasons.push('含 IMAGE fill');
    if (hasRadialGradient) reasons.push('含 GRADIENT_RADIAL');
    if (hasAngularGradient) reasons.push('含 GRADIENT_ANGULAR');
    if (hasDiamondGradient) reasons.push('含 GRADIENT_DIAMOND');
    if (multiFill) reasons.push(`fills ${visibleFills.length} 层`);
    if (hasBlurEffect) reasons.push('含 blur effect');
    if (effectCount > 1) reasons.push(`effects ${effectCount} 项`);
    return { matched: true, confidence: 'medium', reason: [`${reasons.join(' + ')} → bg-`] };
  }

  // 判定为 bgc-(CSS-able)
  const isSimpleFill =
    visibleFills.length <= 1 &&
    visibleFills.every((f) => f.type === 'SOLID' || f.type === 'GRADIENT_LINEAR');
  const cornerRadius = (node as CornerMixin).cornerRadius;
  const hasCorner = typeof cornerRadius === 'number' && cornerRadius > 0;
  const strokes = (node as GeometryMixin).strokes;
  const hasSimpleStroke = strokes && strokes.length > 0 && strokes.length <= 1;

  if (isSimpleFill && (hasCorner || hasSimpleStroke || effectCount === 1)) {
    const reasons: string[] = [];
    reasons.push(visibleFills[0]?.type === 'GRADIENT_LINEAR' ? '简单线性渐变' : '纯 SOLID');
    if (hasCorner) reasons.push(`cornerRadius=${cornerRadius}`);
    if (hasSimpleStroke) reasons.push('单层描边');
    if (effectCount === 1) reasons.push('单一 shadow');
    return { matched: true, confidence: 'medium', reason: [`${reasons.join(' + ')} → bgc-`] };
  }

  // 纯 SOLID 无装饰 → 也建议 bgc-(低置信,因为可能是内容容器)
  if (isSimpleFill && visibleFills.length === 1) {
    return hit('low', '仅 SOLID fill 无装饰 → bgc-(需人工确认)');
  }

  return NO_MATCH;
};

/**
 * 明确判定为 bg-。
 */
export const inferBg: InferFn = (node) => {
  const r = inferBgOrBgc(node);
  if (r.matched && r.reason.some((s) => s.endsWith('→ bg-'))) return r;
  return NO_MATCH;
};

/**
 * 明确判定为 bgc-。
 */
export const inferBgc: InferFn = (node) => {
  const r = inferBgOrBgc(node);
  if (r.matched && r.reason.some((s) => s.endsWith('→ bgc-'))) return r;
  return NO_MATCH;
};
