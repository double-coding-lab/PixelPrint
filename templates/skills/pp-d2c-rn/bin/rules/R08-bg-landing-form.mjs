// R08 bg-landing-form(rn 版,语义变更——RN 无 background-image,bg- 是独立 Image 层契约)
// 触发: node.name.startsWith('bg-') 或 name === 'bg'
// 期望(SKILL §4.1.1 bg- 铺满层契约):
//   ① 该 nodeId 在 jsx 中落在图片家族标签上(Image/ImageBackground/FastImage + tagMap.Image)
//   ② style 含 position: 'absolute'
//   ③ width/height 为数值(rpx)固定尺寸——Figma 事实尺寸,数值精度由 R23 对账
//   (禁 '100%' 与 absoluteFillObject 由 RN03 专责,本条不重复报)
// 跳过: baked(祖先也是 bg-/img-)/hidden/templateDup;无 styleKey 交 R21

import { findProperty, allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';
import { imageTags, findImageTagWithNodeId } from '../lib/rnTags.mjs';

export const id = 'R08';
export const name = 'bg-landing-form';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const tags = imageTags(config);
  const helperName = (config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const nm = (node.name || '').trim();
    if (!(nm.startsWith('bg-') || nm === 'bg')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21

    // ① 落在图片家族标签上
    const tagHits = product.jsx.flatMap((j) => findImageTagWithNodeId(j.content, tags, nodeId).map((h) => ({ ...h, rel: j.rel })));
    if (tagHits.length === 0) {
      violations.push(mk(nodeId, node, `bg- 在 RN 落地为独立 <${tags[0]}>(挂父容器内头部)`, `jsx 中该 nodeId 未出现在 ${tags.join('/')} 标签上(可能被写成空 View / 背景被省略)`, '(jsx)', 0, ''));
      continue; // 标签形态都不对,后续 style 判定意义不大
    }

    // ② position: 'absolute'
    const pos = findProperty(product.style, keys, /position\s*:\s*['"]absolute['"]/);
    if (!pos.hit) {
      violations.push(mk(nodeId, node, "bg- 铺满层 style 含 position: 'absolute' + top: 0, left: 0", "style 未含 position: 'absolute'", pos.firstRel, pos.firstLine, pos.firstSnippet));
    }

    // ③ width/height 数值固定尺寸(数值精度归 R23,这里只判「声明了且可解析」)
    const bodies = allRuleBodies(product.style, keys);
    for (const prop of ['width', 'height']) {
      const v = getNumericAcross(bodies, prop, helperName);
      if (v == null) {
        violations.push(mk(nodeId, node, `bg- 铺满层 ${prop} 为 Figma 事实固定尺寸(rpx 数值)`, `style 未声明数值 ${prop}(用 '100%'/absoluteFillObject 在父 minHeight 下会塌陷,见 RN03)`, '(style)', 0, ''));
      }
      // unparseable(如 '100%')交 RN03 专责,不在此双报
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual, file, line, snippet) {
    return { rule: id, nodeId, name: node.name, type: node.type, expected, actual, file: file || '(style)', line: line || 0, snippet: snippet || '' };
  }
}
