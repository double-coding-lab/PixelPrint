// R20 absolute-position(rn 版)
// 触发: node.layoutPositioning === 'ABSOLUTE'(脱离父 autolayout 顺流,绝对定位)
// 期望: styles 必须声明 position: 'absolute'(top/left 为 0 可省数值,position 不可省——
//       RN 里不写 position 的元素仍占父 flex 流位挤压兄弟,与 h5 同理);
//       top ≈ (子.bbox.y − 父.bbox.y) × scale;left ≈ (子.bbox.x − 父.bbox.x) × scale(容差 4,rpx 剥壳同域)
// 与 h5 差异: 属性 camelCase + rpx 剥壳;RN 无 inset 简写,该分支删除
// 跳过: baked / hidden / templateDup / 无 styleKey / 父无 bbox / 动态值 unparseable
// fixed- 前缀走骨架分层定位(RN01/R01 域),不是 (子bbox−父bbox) 相对定位,跳过
//
// 核心哲学: 能从 bbox 精确算出的坐标,禁止靠猜 + "需人工核对" 兜底。

import { allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';

export const id = 'R20';
export const name = 'absolute-position';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 1;
  const helper = (config && config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';
  const TOL = 4;

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node.layoutPositioning !== 'ABSOLUTE') continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    if (node.name && node.name.startsWith('fixed-')) continue;

    const parent = node._parentId ? cache.nodes[node._parentId] : null;
    const nb = node.absoluteBoundingBox;
    const pb = parent && parent.absoluteBoundingBox;
    if (!nb || !pb) continue; // 缺 bbox 无法精确计算,不误报

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯,交由 R21

    const bodies = allRuleBodies(product.style, keys);
    if (bodies.length === 0) continue;

    const expLeft = Math.round((nb.x - pb.x) * scale);
    const expTop = Math.round((nb.y - pb.y) * scale);

    const problems = [];
    // position: 'absolute' 声明本身不可省——检查该元素全部 styleKey 的全部规则体
    if (!bodies.some((b) => /position\s*:\s*['"]absolute['"]/.test(b))) {
      problems.push("缺 position: 'absolute'(不声明仍参与父 flex 顺流,占位挤压兄弟)");
    }
    const cssTop = getNumericAcross(bodies, 'top', helper);
    const cssLeft = getNumericAcross(bodies, 'left', helper);
    // 期望值≈0 且产物未显式声明 → 原点绝对定位与顺流视觉等价,容忍不报;
    // unparseable(动态值)→ 该坐标保守跳过;期望非 0 却缺失 / 写了值对不上 → 报。
    if (cssTop == null) {
      if (Math.abs(expTop) > TOL) problems.push(`缺 top(应 ${expTop},丢了真实偏移)`);
    } else if (!cssTop.unparseable && Math.abs(cssTop.value - expTop) > TOL) {
      problems.push(`top=${cssTop.value} 应 ${expTop}`);
    }
    if (cssLeft == null) {
      if (Math.abs(expLeft) > TOL) problems.push(`缺 left(应 ${expLeft},丢了真实偏移)`);
    } else if (!cssLeft.unparseable && Math.abs(cssLeft.value - expLeft) > TOL) {
      problems.push(`left=${cssLeft.value} 应 ${expLeft}`);
    }

    if (problems.length) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `top≈${expTop} left≈${expLeft}((子bbox−父bbox)×${scale},rpx 剥壳同域,父=${node._parentId})`,
        actual: problems.join('；'),
        file: '(style)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}
