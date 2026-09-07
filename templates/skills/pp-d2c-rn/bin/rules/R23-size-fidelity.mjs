// R23 size-fidelity(rn 版)
// 触发: 产物为节点显式声明了数值宽/高(含 rpx 包装),但与 cache bbox × scale 相差 > 4。
// 特判: width:1 height:1 + overflow:'hidden' 且真实 bbox 远大于 1 → 「锚点欺诈」——
//       真实尺寸缩成隐藏 View 只为骗过 R02/R21 存在性检查(h5 test28 同款手法)。
// 与 h5 差异: RN 恒为 border-box,h5 的「声明 padding 且无 box-sizing:border-box → 跳过」
//   盒模型分支删除,覆盖面比 h5 更大;数值经 rpx 剥壳同域比对。
// 保守跳过(宁漏报不误判):
//   - 未声明数值宽/高('100%'/flex 驱动/未写)→ 布局驱动,不判
//   - TEXT 节点(字体渲染尺寸与 bbox 天然有出入)→ 不判
//   - baked / hidden / templateDup / 无 styleKey / 无 bbox / 动态值 unparseable → 不判

import { allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';

export const id = 'R23';
export const name = 'size-fidelity';

const TOL = 4;

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 1;
  const helper = (config && config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    if (node.type === 'TEXT') continue;
    const bbox = node.absoluteBoundingBox;
    if (!bbox || !(bbox.width > 0 && bbox.height > 0)) continue;
    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue;

    const bodies = allRuleBodies(product.style, keys);
    if (bodies.length === 0) continue;

    const w = getNumericAcross(bodies, 'width', helper);
    const h = getNumericAcross(bodies, 'height', helper);
    const declW = w && !w.unparseable ? w.value : null;
    const declH = h && !h.unparseable ? h.value : null;
    if (declW == null && declH == null) continue; // 布局驱动尺寸或动态值,不判

    const expW = Math.round(bbox.width * scale);
    const expH = Math.round(bbox.height * scale);

    // 锚点欺诈特判: 1×1 + overflow:'hidden' + 真实尺寸远大于 1
    const hasOverflowHidden = bodies.some((b) => /overflow\s*:\s*['"]hidden['"]/.test(b));
    if (declW === 1 && declH === 1 && hasOverflowHidden && expW > 8 && expH > 8) {
      violations.push(v(nodeId, node, `width:${expW} height:${expH}(bbox×${scale})`,
        `width:1 height:1 + overflow:'hidden' 锚点欺诈——元素仅为骗过存在性/引用检查而存在,视觉未渲染(真实 ${expW}×${expH})`));
      continue;
    }

    const problems = [];
    if (declW != null && Math.abs(declW - expW) > TOL) problems.push(`width=${declW} 应 ${expW}`);
    if (declH != null && Math.abs(declH - expH) > TOL) problems.push(`height=${declH} 应 ${expH}`);
    if (problems.length) {
      violations.push(v(nodeId, node, `width≈${expW} height≈${expH}(bbox×${scale},rpx 剥壳同域,容差 ${TOL})`, problems.join('；')));
    }
  }

  return violations;
}

function v(nodeId, node, expected, actual) {
  return {
    rule: id,
    nodeId,
    name: node.name || '(no name)',
    type: node.type,
    expected,
    actual,
    file: '(style)',
    line: 0,
    snippet: '',
  };
}
