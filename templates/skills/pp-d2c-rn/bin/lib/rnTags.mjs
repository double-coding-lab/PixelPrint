// RN 内核标签集(pp-d2c-rn v1.0.0)——规则脚本共享。
// adapter 启用时,产物标签被 config.adapter.tagMap 映射(如 Image→XImage),
// 规则的标签识别集必须并入映射后的名字,否则 adapter 产物全部漏判。
// tagMap 缺失/未启用时按 RN 原生标签集判,不误报。

const IMAGE_NATIVE = ['Image', 'ImageBackground', 'FastImage'];
const SCROLL_NATIVE = ['ScrollView'];

function mapped(config, kernelTag) {
  const a = config && config.adapter;
  if (!a || a.enabled !== true || !a.tagMap) return null;
  const v = a.tagMap[kernelTag];
  return typeof v === 'string' && /^[A-Z][\w.]*$/.test(v) ? v : null;
}

// 图片家族标签(R08/R16/R22 用):Image/ImageBackground/FastImage + tagMap.Image 映射值
export function imageTags(config) {
  const out = [...IMAGE_NATIVE];
  const m = mapped(config, 'Image');
  if (m && !out.includes(m)) out.push(m);
  return out;
}

// 滚动容器标签(R01/RN01 用):ScrollView + tagMap.ScrollView 映射值
export function scrollTags(config) {
  const out = [...SCROLL_NATIVE];
  const m = mapped(config, 'ScrollView');
  if (m && !out.includes(m)) out.push(m);
  return out;
}

// 在 jsx 文本里搜「图片家族标签 + data-node-id=<nodeId>」,返回 [{ line, snippet }]
export function findImageTagWithNodeId(content, tags, nodeId) {
  const esc = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<(?:${tags.join('|')})\\b[^>]*?data-node-id=["']${esc}["'][^>]*?/?>`, 'gs');
  const hits = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    hits.push({
      line: content.slice(0, m.index).split('\n').length,
      snippet: m[0].length > 200 ? m[0].slice(0, 200) + '...' : m[0],
    });
  }
  return hits;
}

// 计算一段 jsx 文本里滚动容器的开闭区间 [start, end](含嵌套,栈配对)。
// 开闭数不平衡(判不了)返回 null;无滚动容器返回 []。自闭合 <ScrollView ... /> 视为零长区间跳过。
export function scrollViewIntervals(content, tags) {
  const tokenRe = new RegExp(`<(/?)(?:${tags.join('|')})\\b`, 'g');
  const intervals = [];
  const stack = [];
  let m;
  while ((m = tokenRe.exec(content)) !== null) {
    if (m[1] === '/') {
      const open = stack.pop();
      if (open === undefined) return null; // 闭多于开
      intervals.push([open, tokenRe.lastIndex]);
    } else {
      // 自闭合:标签头在下一个 '>' 前以 '/>' 结束 → 不入栈
      const gt = content.indexOf('>', m.index);
      if (gt > 0 && content[gt - 1] === '/') continue;
      stack.push(m.index);
    }
  }
  if (stack.length) return null; // 开多于闭
  return intervals;
}
