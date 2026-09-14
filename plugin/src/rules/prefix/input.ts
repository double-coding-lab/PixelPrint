/**
 * input- 输入框前缀:生成 <input type="text">。
 *
 * 触发:
 * - name 含 "输入"/"搜索"/"input"/"search"
 * - 或 frame 内含单一 TEXT 且 TEXT 内容以「请输入」/「Search」/「请填写」开头,父有 stroke
 */
import { getStrokesArray, hit, NO_MATCH, type InferFn } from './types';

const NAME_HINTS = ['输入', '搜索', 'input', 'search', '搜索框', '输入框'];
const PLACEHOLDER_PREFIXES = ['请输入', 'Search', '搜索', '请填写', 'Enter', 'Please'];

export const inferInput: InferFn = (node) => {
  const lower = node.name.toLowerCase();
  const nameHit = NAME_HINTS.find((w) => lower.includes(w));

  if (
    node.type !== 'FRAME' &&
    node.type !== 'GROUP' &&
    node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE'
  ) {
    if (nameHit) return hit('low', `name 含 "${nameHit}" 但类型非 FRAME → input-(需确认)`);
    return NO_MATCH;
  }

  if (!('children' in node)) return NO_MATCH;
  const textChildren = node.children.filter((c) => c.visible !== false && c.type === 'TEXT');

  if (nameHit) {
    return hit('medium', `name 含 "${nameHit}" → input-`);
  }

  if (textChildren.length === 1) {
    const text = textChildren[0] as TextNode;
    const chars = text.characters || '';
    const placeholderHit = PLACEHOLDER_PREFIXES.find((p) => chars.startsWith(p));
    if (placeholderHit) {
      const strokes = getStrokesArray(node);
      const hasStroke = strokes.some((s) => s.visible !== false);
      if (hasStroke) {
        return hit(
          'medium',
          `内含单 TEXT "${chars.slice(0, 12)}..." + 父有描边 → input-`,
        );
      }
      return hit('low', `内含单 TEXT "${chars.slice(0, 12)}..." 但父无描边 → input-(需确认)`);
    }
  }

  return NO_MATCH;
};
