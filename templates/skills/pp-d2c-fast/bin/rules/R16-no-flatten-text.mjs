// R16 no-flatten-text
// 触发: GROUP/FRAME/COMPONENT/INSTANCE 子树含 TEXT，且节点 name 前缀不在白名单
// 白名单: img- / bg- （含裸词 img / bg，全等或以 xxx- 开头）
// 反查: 产物 jsx 中出现 `<img ... data-node-id="<该节点>" ... />` → 违规
//
// 语义: 禁止用整体切图替代含 TEXT 的容器；否则 TEXT 无障碍缺失、无法本地化、按钮不可点击
// 排斥: img-/bg- 节点自身就是拿来切图/挂 background 的，天然免疫

export const id = 'R16';
export const name = 'no-flatten-text';

const WHITELIST_PREFIXES = ['img-', 'bg-'];
const WHITELIST_BARE = ['img', 'bg'];
const CONTAINER_TYPES = new Set(['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE']);

export function check({ cache, product }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node.type || !CONTAINER_TYPES.has(node.type)) continue;
    if (!node.name) continue;
    if (isWhitelisted(node.name)) continue;
    if (!subtreeHasText(node, cache.nodes)) continue;

    const hits = findImgReferencingNode(product.jsx, nodeId);
    for (const hit of hits) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name,
        type: node.type,
        expected: `不得对含 TEXT 的 ${node.type}（前缀非 img-/bg-）整体切图；应按 §4.3 前缀规则拆解 TEXT / btn / img / bg 子节点`,
        actual: `产物 jsx 出现 <img data-node-id="${nodeId}">，意味着该容器被整体烤成位图`,
        file: hit.file,
        line: hit.line,
        snippet: hit.snippet,
      });
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

// 递归判定：子树内是否存在 TEXT 节点
// 通过 cache.nodes 反查 children（避免 node 对象子引用不全）
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

// 在 jsx 里搜 <img ... data-node-id="<nodeId>" ... />
// 允许属性顺序任意；跨行也扫（松散匹配到 </img> 或 />）
function findImgReferencingNode(jsxFiles, nodeId) {
  const hits = [];
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 匹配 <img ...(可跨行)... data-node-id="<nodeId>" ...(可跨行)... />
  // 或反向：data-node-id 在前、闭合在后
  const re = new RegExp(`<img\\b[^>]*?data-node-id=["']${escaped}["'][^>]*?/?>`, 'gs');

  for (const j of jsxFiles) {
    let m;
    while ((m = re.exec(j.content)) !== null) {
      const before = j.content.slice(0, m.index);
      const line = before.split('\n').length;
      hits.push({
        file: j.rel,
        line,
        snippet: m[0].length > 200 ? m[0].slice(0, 200) + '...' : m[0],
      });
    }
  }
  return hits;
}
