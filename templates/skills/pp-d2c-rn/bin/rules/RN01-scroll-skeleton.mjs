// RN01 scroll-skeleton(RN 特有,v0.3.13「rn 页面根强制骨架」代码化)
// --merge(页面级)校验:
//   ① 页面 jsx 必须出现滚动容器标签(ScrollView + tagMap.ScrollView)——rn 分支不判视口,一律套骨架
//   ② styles 存在 scrollContent key 时:必须用 minHeight(写死 height 即违规——内容超高会被裁)
//   ③ root / scrollContent 规则体禁 overflow: 'hidden'(阻止滚动)
//   ②③ 依赖 SKILL §4.1.1 固定骨架命名(root/scroll/scrollContent);key 缺失时降 warning(判不了)
// --block(反向)校验: block 产物不得含页面骨架——styles 有 scrollContent key 且 jsx 有滚动容器
//   即违规(sub-agent 派发进来的内层 block 不套骨架;scrollx-/scrolly- 的普通 ScrollView 不误伤,
//   因其 styleKey 不叫 scrollContent)
// fixed-* 不入 ScrollView 的逐节点判定由 R01 ③ 承担,本条不重复报

import { collectRuleBodies } from '../lib/styleMatch.mjs';
import { scrollTags } from '../lib/rnTags.mjs';

export const id = 'RN01';
export const name = 'scroll-skeleton';

export function check({ product, config, mode }) {
  const hits = [];
  const sTags = scrollTags(config);
  const scrollRe = new RegExp(`<(?:${sTags.join('|')})\\b`);
  const jsxHasScroll = product.jsx.some((j) => scrollRe.test(j.content));
  const scrollContentBodies = collectBodies(product.style, 'scrollContent');
  const rootBodies = collectBodies(product.style, 'root');

  if (mode === 'merge') {
    // ① 骨架存在性
    if (!jsxHasScroll) {
      hits.push(mk('页面根未套 ScrollView 骨架', `页面 jsx 必须为 View(root) > ${sTags[0]} > View(scrollContent) 固定骨架(rn 不判视口,一律套)`, `jsx 中未找到 ${sTags.join('/')} 标签(根 View 直接装内容,RN 的 View 天然不滚,超高内容会被裁)`));
      return hits; // 骨架都没有,后续判定无意义
    }

    // ② scrollContent 用 minHeight 不用 height
    if (scrollContentBodies.length === 0) {
      hits.push({ ...mk('scrollContent key 缺失', 'styles 含 scrollContent(SKILL §4.1.1 固定骨架命名)', 'styles 未找到 scrollContent key,骨架细则判不了,请人工复核页面根结构'), severity: 'warning' });
    } else {
      for (const b of scrollContentBodies) {
        const hasMinHeight = /minHeight\s*:/.test(b.body);
        const hasHeight = /(?:^|[,{\s])height\s*:/.test(b.body);
        if (hasHeight && !hasMinHeight) {
          hits.push(mk('scrollContent 写死 height', 'scrollContent 用 minHeight(内容不足时至少这么高,超出自动增高)', `scrollContent 写死 height(内容超高会被裁);${b.rel}:${b.line}`));
        }
        if (/overflow\s*:\s*['"]hidden['"]/.test(b.body)) {
          hits.push(mk('scrollContent overflow hidden', "scrollContent 禁 overflow: 'hidden'(阻止滚动)", `${b.rel}:${b.line} 出现 overflow: 'hidden'`));
        }
      }
    }

    // ③ root 禁 overflow hidden
    for (const b of rootBodies) {
      if (/overflow\s*:\s*['"]hidden['"]/.test(b.body)) {
        hits.push(mk('root overflow hidden', "root 禁 overflow: 'hidden'(承接 fixed-*,不得裁剪)", `${b.rel}:${b.line} 出现 overflow: 'hidden'`));
      }
    }
  } else {
    // --block 反向: block 内出现页面骨架(scrollContent key + 滚动容器)即违规
    if (jsxHasScroll && scrollContentBodies.length > 0) {
      hits.push(mk('block 内套页面骨架', 'sub-agent 派发的 block 产物不套 ScrollView 骨架(骨架只属于页面根,由主 agent 合并时套)', `block 产物同时存在 ${sTags.join('/')} 标签与 scrollContent key(${scrollContentBodies[0].rel}:${scrollContentBodies[0].line})`));
    }
  }

  return hits;

  function mk(nameStr, expected, actual) {
    return { rule: id, nodeId: '(page)', name: nameStr, type: 'SKELETON', expected, actual, file: '(product)', line: 0, snippet: '' };
  }
}

function collectBodies(styleFiles, key) {
  const out = [];
  for (const s of styleFiles) {
    for (const r of collectRuleBodies(s.content, key)) out.push({ ...r, rel: s.rel });
  }
  return out;
}
