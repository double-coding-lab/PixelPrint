/**
 * 前缀推断规则的公共类型与工具。
 *
 * 每个 rules/prefix/*.ts 导出一个 InferFn,由 rules/prefix/infer.ts 编排调用。
 * 规则只判断"这个前缀命中与否",不组合优先级、不做互斥校验。
 */

import type { ConfidenceLevel } from '../prefix-catalog';

/** Figma 节点子集,只依赖判定用到的字段(便于测试 mock)。 */
export type InferrableNode = SceneNode;

export interface InferResult {
  matched: boolean;
  confidence: ConfidenceLevel;
  reason: string[];
}

export type InferFn = (node: InferrableNode) => InferResult;

export const NO_MATCH: InferResult = {
  matched: false,
  confidence: 'low',
  reason: [],
};

export function hit(confidence: ConfidenceLevel, ...reason: string[]): InferResult {
  return { matched: true, confidence, reason };
}

/** 判断节点是否有 children 属性(FRAME / GROUP / COMPONENT / INSTANCE)。 */
export function hasChildren(
  node: SceneNode,
): node is FrameNode | GroupNode | ComponentNode | InstanceNode | ComponentSetNode | SectionNode {
  return 'children' in node;
}

/** 判断节点是否有 layoutMode(FRAME 系)。 */
export function hasLayoutMode(
  node: SceneNode,
): node is FrameNode | ComponentNode | InstanceNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT_SET'
  );
}

export function getFillsArray(node: SceneNode): readonly Paint[] {
  const fills = (node as GeometryMixin).fills;
  if (!fills || fills === figma.mixed) return [];
  return fills as readonly Paint[];
}

export function getStrokesArray(node: SceneNode): readonly Paint[] {
  const strokes = (node as GeometryMixin).strokes;
  if (!strokes) return [];
  return strokes as readonly Paint[];
}

export function getEffectsArray(node: SceneNode): readonly Effect[] {
  const effects = (node as BlendMixin).effects;
  if (!effects) return [];
  return effects as readonly Effect[];
}
