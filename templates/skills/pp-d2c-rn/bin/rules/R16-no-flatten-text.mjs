// R16 no-flatten-text(rn 版,改写——<img> 标签集换 RN 图片家族 + adapter 感知)
// 触发: GROUP/FRAME/COMPONENT/INSTANCE 子树含 TEXT,且节点 name 前缀不在白名单
// 白名单: img- / bg-(含裸词 img / bg)
// 反查: 产物 jsx 中出现「图片家族标签 + data-node-id=<该节点>」→ 违规
//       标签集 = Image/ImageBackground/FastImage + config.adapter.tagMap.Image 映射值
// 语义: 禁止用整体切图替代含 TEXT 的容器;整体导出的图无法承载动态数据,业务侧完全无救

import { imageTags, findImageTagWithNodeId } from '../lib/rnTags.mjs';

export const id = 'R16';
export const name = 'no-flatten-text';

const WHITELIST_PREFIXES = ['img-', 'bg-'];
const WHITELIST_BARE = ['img', 'bg'];
const CONTAINER_TYPES = new Set(['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE']);

export function check({ cache, product, config }) {
  const violations = [];
  const tags = imageTags(config);

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.type || !CONTAINER_TYPES.has(node.type)) continue;
    if (!node.name) continue;
    if (isWhitelisted(node.name)) continue;
    if (!subtreeHasText(node, cache.nodes)) continue;

    for (const j of product.jsx) {
      for (const hit of findImageTagWithNodeId(j.content, tags, nodeId)) {
        violations.push({
          rule: id,
          nodeId,
          name: node.name,
          type: node.type,
          expected: `不得对含 TEXT 的 ${node.type}(前缀非 img-/bg-)整体切图;应按 §4.3 前缀规则拆解 TEXT / btn / img / bg 子节点`,
          actual: `产物 jsx 出现 <${tags.join('|')} data-node-id="${nodeId}">,该容器被整体烤成位图`,
          file: j.rel,
          line: hit.line,
          snippet: hit.snippet,
        });
      }
    }
  }

  return violations;
}

function isWhitelisted(nodeName) {
  const name = nodeName.trim();
  if (WHITELIST_BARE.includes(name)) return true;
  for (const p of WHITELIST_PREFIXES) {
    if (name.startsWith(p) && name.length > p.length) return true;
  }
  return false;
}

function subtreeHasText(root, allNodes) {
  const stack = [root];
  const visited = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || !cur.id || visited.has(cur.id)) continue;
    visited.add(cur.id);
    if (cur.type === 'TEXT') return true;
    if (Array.isArray(cur.children)) {
      for (const child of cur.children) {
        if (child && child.id && allNodes[child.id]) {
          stack.push(allNodes[child.id]);
        } else {
          stack.push(child);
        }
      }
    }
  }
  return false;
}
