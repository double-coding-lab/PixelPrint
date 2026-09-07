// RN03 no-percent-fill(RN 特有,v0.3.12「%-塌陷防御」代码化)
// 触发: bg- 前缀节点(含裸词 bg)
// 校验: 该节点 style 禁 width/height: '100%' 与 absoluteFillObject 引用——
//       父用 minHeight 时 '%' 引用父的计算高度(可能小于 Figma 设计稿高度)跟着塌陷;
//       必须写 Figma 事实固定尺寸 width: rpx(w), height: rpx(h) + top: 0, left: 0
//       (正向契约「必须落 Image + absolute + 数值尺寸」由 R08 承担,本条只拦塌陷写法)
// 跳过: baked/hidden/templateDup;无 styleKey 交 R21

import { allRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'RN03';
export const name = 'no-percent-fill';

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const nm = (node.name || '').trim();
    if (!(nm.startsWith('bg-') || nm === 'bg')) continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯 → R21

    for (const b of allRuleBodies(product.style, keys)) {
      const pm = b.match(/(width|height)\s*:\s*['"](\d+(?:\.\d+)?)%['"]/);
      if (pm) {
        violations.push(mk(nodeId, node, `bg- 铺满层 ${pm[1]} 写 Figma 事实固定尺寸(rpx 数值)`, `${pm[1]}: '${pm[2]}%'(父 minHeight 时 % 引用父计算高度会塌陷)`));
      }
      if (/absoluteFillObject/.test(b)) {
        violations.push(mk(nodeId, node, "bg- 铺满层用 position:'absolute' + top:0,left:0 + Figma 事实尺寸", 'style 引用 StyleSheet.absoluteFillObject(等价于全 % 铺满,父 minHeight 时塌陷)'));
      }
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual) {
    return { rule: id, nodeId, name: node.name, type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
}
