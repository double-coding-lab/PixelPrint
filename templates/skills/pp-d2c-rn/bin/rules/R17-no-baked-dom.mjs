// R17 no-baked-dom（v1.2.0 对账新增）
// 触发: 节点处于 bg-/bgc-/img-/x- 整体切图子树内（_inBakedSubtree=true）
// 期望: 该节点的像素已烤进父层切图（或被 x- 整体忽略），产物中【不得】再有其 data-node-id 元素
// 违反: 产物 JSX 出现 data-node-id="<nodeId>" → 双重渲染（文字/图叠一遍，典型 test13 title-text/subtitle 既进 main.png 又出 DOM）
//
// 与 R02/R06 的分工: R02/R06 跳过 baked 子孙（不逐个溯源），"禁 DOM" 由本条正向兜底。

export const id = 'R17';
export const name = 'no-baked-dom';

export function check({ cache, product }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!node._inBakedSubtree) continue;
    if (node._templateDup) continue; // 数据副本，代表项报过即可，避免重复
    // x- 忽略子树里本就不该出现，bg-/bgc-/img- 烤进切图更不该；隐藏与否都不应出 DOM

    const hit = findDomNode(product, nodeId);
    if (hit) {
      const bakedByNode = node._bakedBy ? cache.nodes[node._bakedBy] : null;
      const bakedByName = (bakedByNode && bakedByNode.name) || node._bakedBy || '?';
      const isIgnored = /^x[-]?/.test(String(bakedByName).trim()) || String(bakedByName).trim() === 'x';
      const kind = isIgnored
        ? `处于 x- 忽略子树内（bakedBy=${bakedByName}），该内容被整体忽略，不该渲染`
        : `处于整体切图子树内（bakedBy=${bakedByName}），像素已烤进父层 PNG`;
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `节点${kind}，产物不应有其 data-node-id 元素`,
        actual: `产物 ${hit.rel} 出现 data-node-id="${nodeId}"（${isIgnored ? '被忽略内容却出 DOM' : '双重渲染：切图一份 + DOM 一份'}）`,
        file: hit.rel,
        line: hit.line,
        snippet: hit.snippet,
      });
    }
  }

  return violations;
}

function findDomNode(product, nodeId) {
  const idNorm = nodeId.replace(/:/g, '-');
  const re = new RegExp(`data-node-id=(?:"|\\{['"])(?:${escapeRegex(nodeId)}|${escapeRegex(idNorm)})(?:"|['"]\\})`);
  for (const j of product.jsx) {
    const m = j.content.match(re);
    if (m) {
      const line = j.content.slice(0, m.index).split('\n').length;
      const lineText = j.content.split('\n')[line - 1] || '';
      return { rel: j.rel, line, snippet: lineText.trim().slice(0, 200) };
    }
  }
  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
