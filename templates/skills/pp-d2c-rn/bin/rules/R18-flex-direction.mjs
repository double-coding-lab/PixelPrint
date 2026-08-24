// R18 flex-direction(rn 版,判定与 h5 镜像——RN flex 默认 column,web 默认 row)
// 触发: autolayout 容器(layoutMode === 'HORIZONTAL' | 'VERTICAL')
// 期望: VERTICAL → flexDirection 省略或 'column' 均合法(RN 默认即 column);
//       HORIZONTAL → 必须显式 flexDirection: 'row'(或 'row-reverse'),缺失或写 column 均违规
// 违反: 方向写反 / HORIZONTAL 漏写(默认 column 会把横排竖排)
// 前置: 该节点有 style 绑定(RN 全员 flex,无 display:flex 门槛——与 h5 的差异点)
// 跳过: baked / hidden / templateDup 副本 / 无 styleKey(不可追溯,R21 兜底)/ 动态值 unparseable

import { collectRuleBodies } from '../lib/styleMatch.mjs';

export const id = 'R18';
export const name = 'flex-direction';

export function check({ cache, product, classMap }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    const lm = node.layoutMode;
    if (lm !== 'HORIZONTAL' && lm !== 'VERTICAL') continue;
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;

    const keys = classMap[nodeId] || [];
    if (keys.length === 0) continue; // 不可追溯:本条不报,由 R21 硬拦

    const body = firstBody(product.style, keys);
    if (body == null) continue; // 有绑定但 styles 里找不到规则体:RN04(P1)拦 inline,本条不判

    const dir = extractFlexDirection(body);
    if (dir === 'unparseable') continue; // Platform.select/三元等动态方向,保守跳过

    if (lm === 'VERTICAL') {
      if (dir != null && dir !== 'column') {
        violations.push(mk(nodeId, node, "flexDirection: 'column' 或省略(Figma layoutMode=VERTICAL;RN 默认即 column)", `flexDirection: '${dir}'(方向写反)`));
      }
    } else {
      // HORIZONTAL:RN 默认 column,必须显式声明横向
      if (dir == null) {
        violations.push(mk(nodeId, node, "flexDirection: 'row'(Figma layoutMode=HORIZONTAL;RN 默认 column,不写会竖排)", '未写 flexDirection(默认 column,横向布局会竖排)'));
      } else if (dir !== 'row' && dir !== 'row-reverse') {
        violations.push(mk(nodeId, node, "flexDirection: 'row'(Figma layoutMode=HORIZONTAL)", `flexDirection: '${dir}'(方向写反)`));
      }
    }
  }

  return violations;

  function mk(nodeId, node, expected, actual) {
    return { rule: id, nodeId, name: node.name || '(no name)', type: node.type, expected, actual, file: '(style)', line: 0, snippet: '' };
  }
}

function firstBody(styleFiles, keys) {
  for (const key of keys) {
    for (const s of styleFiles) {
      const bodies = collectRuleBodies(s.content, key);
      if (bodies.length) return bodies[0].body;
    }
  }
  return null;
}

// 取 flexDirection 声明:'row' | 'column' | 'row-reverse' | 'column-reverse' | null(未写)| 'unparseable'(动态值)
function extractFlexDirection(body) {
  const m = body.match(/flexDirection\s*:\s*([^,\n}]+)/);
  if (!m) return null;
  const raw = m[1].trim();
  const sm = raw.match(/^['"](row|column|row-reverse|column-reverse)['"]$/);
  return sm ? sm[1] : 'unparseable';
}
