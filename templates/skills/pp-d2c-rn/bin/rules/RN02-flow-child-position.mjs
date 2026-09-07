// RN02 flow-child-position(RN 特有,v0.3.13「顺流子位置来源硬约束」代码化)
// 触发: 父 layoutMode ∈ {HORIZONTAL, VERTICAL} 且 子 layoutPositioning !== 'ABSOLUTE'(顺流子)
// 校验(位置由父 flex 5 字段负责,子不得自带位置):
//   ① 子 style 禁 position / top / left / right / bottom / margin*(逆推 bbox 绕过父 flex 语义)
//   ② 子 style 的 padding* 非 0 值必须溯源到该子节点 cache 同名字段(只判「cache 无却写了」的
//     凭空捏造分支;数值精度归 R19,避免双报)
//   ③ 子 style 的 flex: 1 仅当 cache layoutGrow === 1 或 layoutSizing* === 'FILL'(违反 FIXED sizing)
// 豁免: fixed- 前缀子(贴屏语义,归 R01/RN01 管);baked/hidden/templateDup;无 styleKey(R21 兜底);
//       属性动态值 unparseable 保守跳过

import { allRuleBodies, getNumericAcross } from '../lib/styleMatch.mjs';

export const id = 'RN02';
export const name = 'flow-child-position';

const BANNED_RE = /(?:^|[,{\s])(position|top|left|right|bottom|margin(?:Top|Bottom|Left|Right|Horizontal|Vertical)?)\s*:/g;
const PADDING_PROPS = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];
const PAD_SHORTHAND = { paddingHorizontal: ['paddingLeft', 'paddingRight'], paddingVertical: ['paddingTop', 'paddingBottom'], padding: PADDING_PROPS };

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const helperName = (config.unit && config.unit.responsive && config.unit.responsive.helperName) || 'rpx';

  for (const [, parent] of Object.entries(cache.nodes)) {
    const lm = parent.layoutMode;
    if (lm !== 'HORIZONTAL' && lm !== 'VERTICAL') continue;
    if (parent._inBakedSubtree || parent._hidden) continue;
    // bl- 基线流容器(v1.1.1):子位置由基线流负责(R24 校验 baseline 落地),顺流子硬约束豁免
    if (typeof parent.name === 'string' && parent.name.startsWith('bl-')) continue;

    for (const child of parent.children || []) {
      if (!child || typeof child !== 'object' || !child.id) continue;
      const node = cache.nodes[child.id] || child;
      if (node.layoutPositioning === 'ABSOLUTE') continue; // 绝对定位子 → R20
      if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
      if (typeof node.name === 'string' && node.name.startsWith('fixed-')) continue; // 贴屏 → R01
      // bg- 铺满层契约本身要求 absolute + top/left(R08/RN03 管辖),不按顺流子判
      if (typeof node.name === 'string' && (node.name.startsWith('bg-') || node.name.trim() === 'bg')) continue;

      const keys = classMap[node.id] || [];
      if (keys.length === 0) continue; // 不可追溯 → R21
      const bodies = allRuleBodies(product.style, keys);
      if (bodies.length === 0) continue;

      // ① 违禁位置属性(显式 0 / rpx(0) 不改变布局,保守放行;position 无数值形态,恒报)
      for (const b of bodies) {
        let m;
        BANNED_RE.lastIndex = 0;
        while ((m = BANNED_RE.exec(b)) !== null) {
          if (m[1] !== 'position') {
            const v = getNumericAcross([b], m[1], helperName);
            if (v && !v.unparseable && v.value === 0) continue;
          }
          violations.push(mk(node, `顺流子(父 ${lm})位置由父 flex 负责(flexDirection/justifyContent/alignItems/gap/padding),子 style 禁 ${m[1]}`, `子 style 出现 ${m[1]}(逆推 bbox 绕过父 flex 语义,视觉整体漂移)`));
        }
      }

      // ② padding 凭空捏造(cache 无同名字段却写了非 0 值)。
      //    子自身也是 autolayout 容器时让位 R19(R19 对 autolayout 容器做全量 padding 对账,含凭空分支)
      const childIsAutolayout = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
      for (const [prop, expands] of Object.entries(childIsAutolayout ? {} : { ...Object.fromEntries(PADDING_PROPS.map((p) => [p, [p]])), ...PAD_SHORTHAND })) {
        const v = getNumericAcross(bodies, prop, helperName);
        if (v == null || v.unparseable || v.value === 0) continue;
        const sourced = expands.some((p) => typeof node[p] === 'number' && node[p] !== 0);
        if (!sourced) {
          violations.push(mk(node, `子 style 的 ${prop} 须溯源 cache 同名 padding 字段(数值精度归 R19)`, `${prop}: ${v.value} 在 cache 中无对应 padding 字段(凭空捏造)`));
        }
      }

      // ③ flex: 1 须有 FILL 依据
      const flexV = getNumericAcross(bodies, 'flex', helperName);
      if (flexV && !flexV.unparseable && flexV.value === 1) {
        const fillOk = node.layoutGrow === 1 || node.layoutSizingHorizontal === 'FILL' || node.layoutSizingVertical === 'FILL';
        if (!fillOk) {
          violations.push(mk(node, 'flex: 1 仅当 Figma layoutGrow=1 或 layoutSizing*=FILL', `flex: 1 但 cache 为 FIXED sizing(尺寸应写事实值)`));
        }
      }
    }
  }

  return violations;

  function mk(node, expected, actual) {
    return { rule: id, nodeId: node.id, name: node.name || '(no name)', type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
}
