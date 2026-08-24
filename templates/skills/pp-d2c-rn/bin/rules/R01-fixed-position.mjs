// R01 fixed-position(rn 版,语义变更——RN 没有 CSS position:fixed)
// 触发: node.name.startsWith('fixed-')
// 期望(fixed-* 铁律,SKILL §4.1.1):
//   ① style 含 position: 'absolute'
//   ② style 含 zIndex 且 ≥ 100(高于 ScrollView 内容)
//   ③ 该元素位于根 View 直接子层——data-node-id 不出现在任何 ScrollView 开闭区间内
//     (ScrollView 内的 absolute 相对内容容器定位,滚动时跟着动,无法承载"贴屏"语义)
// 判不了降 warning: ScrollView 开闭数不平衡(文本区间法失效)时该文件的 ③ 判定降 warning
// 跳过: hidden / baked / templateDup;无 styleKey 交 R21;zIndex 动态值 unparseable 跳过 ② 判定

import { findProperty, allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';
import { scrollTags, scrollViewIntervals } from '../lib/rnTags.mjs';

export const id = 'R01';
export const name = 'fixed-position';

const Z_INDEX_MIN = 100;

export function check({ cache, product, config, classMap }) {
  const hits = [];
  const sTags = scrollTags(config);
  const helperName = (config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.name || !node.name.startsWith('fixed-')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21 统一报

    // ① position: 'absolute'
    const pos = findProperty(product.style, keys, /position\s*:\s*['"]absolute['"]/);
    if (!pos.hit) {
      hits.push(mk(nodeId, node, "style 含 position: 'absolute'(RN 无 position:fixed,贴屏 = 根 View 直接子层 + absolute)", "style 未含 position: 'absolute'", pos.firstRel, pos.firstLine, pos.firstSnippet));
    }

    // ② zIndex ≥ 100
    const bodies = allRuleBodies(product.style, keys);
    const z = getNumericAcross(bodies, 'zIndex', helperName);
    if (z == null) {
      hits.push(mk(nodeId, node, `style 含 zIndex ≥ ${Z_INDEX_MIN}(高于 ScrollView 内容)`, '未写 zIndex', '(style)', 0, ''));
    } else if (!z.unparseable && z.value < Z_INDEX_MIN) {
      hits.push(mk(nodeId, node, `zIndex ≥ ${Z_INDEX_MIN}`, `zIndex: ${z.value}(低于 fixed-* 层级下限)`, '(style)', 0, ''));
    }

    // ③ 不在 ScrollView 区间内(贴屏必须放根 View 直接子层)
    for (const j of product.jsx) {
      const esc = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const idRe = new RegExp(`data-node-id=["']${esc}["']`, 'g');
      let m;
      while ((m = idRe.exec(j.content)) !== null) {
        const intervals = scrollViewIntervals(j.content, sTags);
        if (intervals === null) {
          hits.push({ ...mk(nodeId, node, 'fixed-* 位于根 View 直接子层(ScrollView 外)', `${j.rel} 中 ${sTags.join('/')} 开闭数不平衡,区间法判不了,请人工复核该 fixed-* 位置`, j.rel, 0, ''), severity: 'warning' });
          break;
        }
        const inside = intervals.some(([s, e]) => m.index > s && m.index < e);
        if (inside) {
          const line = j.content.slice(0, m.index).split('\n').length;
          hits.push(mk(nodeId, node, 'fixed-* 一律放 ScrollView 外、根 View 直接子层(RN 内 absolute 会跟内容滚)', `data-node-id 出现在 ${sTags.join('/')} 区间内`, j.rel, line, ''));
        }
      }
    }
  }

  return hits;

  function mk(nodeId, node, expected, actual, file, line, snippet) {
    return { rule: id, nodeId, name: node.name, type: node.type, expected, actual, file: file || '(style)', line: line || 0, snippet: snippet || '' };
  }
}
