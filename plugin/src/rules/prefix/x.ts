/**
 * x- 忽略前缀:图层不生成代码。
 *
 * 触发:
 * - visible === false
 * - name 含"注释"/"辅助"/"guide"/"annotation"/"标注"关键词
 */
import { hit, NO_MATCH, type InferFn } from './types';

const HINT_WORDS = ['注释', '辅助', '标注', '备注', 'guide', 'annotation', 'note'];

export const inferX: InferFn = (node) => {
  if (!node.visible) {
    return hit('high', 'visible=false → x-');
  }
  const lower = node.name.toLowerCase();
  for (const w of HINT_WORDS) {
    if (lower.includes(w)) {
      return hit('high', `name 含 "${w}" → x-`);
    }
  }
  return NO_MATCH;
};
