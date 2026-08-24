// R19 padding(rn 版)
// 触发: autolayout 容器且 Figma 声明了 padding(任一非 0),或产物写了 padding*
// 期望: styles 的 padding 数值(rpx 剥壳)≈ Figma paddingT/R/B/L × config.unit.scale(容差 2)
//       rn 模板 unit.scale=1、rpx 参数即 Figma 原值,期望即 Figma 原值本身
// 违反:
//   - Figma pad0 但产物写了非 0 padding(凭空捏造)
//   - Figma 有 padding 但产物缺失或数值对不上
// RN 属性形态: SKILL 强制四边独立写(paddingTop 等 camelCase);padding / paddingVertical /
//   paddingHorizontal 简写按 RN 语义参与合成(具体边覆盖简写)
// 跳过: baked / hidden / templateDup / 无 styleKey / 任一 padding 属性 unparseable(动态值,宁漏报)

import { firstRuleBody, getNumeric } from '../lib/styleMatch.mjs';

export const id = 'R19';
export const name = 'padding';

const PROPS = ['padding', 'paddingVertical', 'paddingHorizontal', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const scale = (config && config.unit && config.unit.scale) || 1; // rn 模板默认 1(聚合器已强制 unit 存在)
  const helper = (config && config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';
  const TOL = 2;

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const lm = node.layoutMode;
    if (lm !== 'HORIZONTAL' && lm !== 'VERTICAL') continue; // padding 仅在 autolayout 容器有意义
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue;

    const rb = firstRuleBody(product.style, keys);
    if (!rb) continue;

    // Figma 期望值(未声明视为 0)
    const fig = [
      Math.round((node.paddingTop || 0) * scale),
      Math.round((node.paddingRight || 0) * scale),
      Math.round((node.paddingBottom || 0) * scale),
      Math.round((node.paddingLeft || 0) * scale),
    ];
    const figAllZero = fig.every((v) => v === 0);

    const css = extractPadding(rb.body, helper); // null | 'unparseable' | [t,r,b,l]
    if (css === 'unparseable') continue; // 动态值,保守跳过
    if (!css) {
      // 产物未写 padding:Figma 也 0 → OK;Figma 有 padding → 缺失违规
      if (!figAllZero) {
        violations.push(mk(nodeId, node, `padding ≈ [${fig.join(', ')}](Figma ×${scale},rpx 剥壳同域)`, '产物未写 padding'));
      }
      continue;
    }

    // 逐边比对
    const bad = css.some((v, i) => Math.abs(v - fig[i]) > TOL);
    if (bad) {
      const reason = figAllZero ? '(Figma 四边 padding 均为 0,产物凭空加了 padding)' : '';
      violations.push(mk(nodeId, node, `padding ≈ [${fig.join(', ')}](Figma ×${scale})`, `产物 padding = [${css.join(', ')}]${reason}`));
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual) {
    return { rule: id, nodeId, name: node.name || '(no name)', type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
}

// 从规则体合成 [top,right,bottom,left](rpx 已剥壳):
// RN 语义——具体边(paddingTop)覆盖轴简写(paddingVertical)覆盖全简写(padding)。
// 任一已声明属性 unparseable → 整体返回 'unparseable'(不误报);全部未声明 → null。
function extractPadding(body, helper) {
  const val = {};
  for (const p of PROPS) {
    const r = getNumeric(body, p, helper);
    if (r == null) continue;
    if (r.unparseable) return 'unparseable';
    val[p] = r.value;
  }
  if (Object.keys(val).length === 0) return null;
  let t = 0, rr = 0, b = 0, l = 0;
  if (val.padding != null) { t = rr = b = l = val.padding; }
  if (val.paddingVertical != null) { t = b = val.paddingVertical; }
  if (val.paddingHorizontal != null) { rr = l = val.paddingHorizontal; }
  if (val.paddingTop != null) t = val.paddingTop;
  if (val.paddingRight != null) rr = val.paddingRight;
  if (val.paddingBottom != null) b = val.paddingBottom;
  if (val.paddingLeft != null) l = val.paddingLeft;
  return [t, rr, b, l].map((v) => Math.round(v));
}
