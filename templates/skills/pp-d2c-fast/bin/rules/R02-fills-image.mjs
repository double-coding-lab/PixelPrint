// R02 fills-image
// 触发: node.fills[].some(f => f.type === 'IMAGE' && f.visible !== false)
// 期望:
//   - assets.txt 中有该 nodeId 的切图记录 (fileName)
//   - 产物 CSS (或 jsx <img>) 引用该切图
// 排斥: 节点前缀是 x- → 忽略

// v1.2.0: 跳过 baked 子树与隐藏节点；CSS url 匹配走 lib/cssMatch.mjs（修 &__ 嵌套盲区）。
import fs from 'node:fs';
import path from 'node:path';
import { collectRuleBodies } from '../lib/cssMatch.mjs';

export const id = 'R02';
export const name = 'fills-image';

export function check({ cache, product, config, classMap }) {
  const violations = [];
  const ignorePrefix = 'x-';

  // 读 assets.txt (在 product root)
  const assetsPath = path.join(product.root, 'assets.txt');
  const assetsText = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, 'utf8') : '';

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (!Array.isArray(node.fills) || node.fills.length === 0) continue;
    const hasImage = node.fills.some((f) => f && f.type === 'IMAGE' && f.visible !== false);
    if (!hasImage) continue;
    if (node.name && node.name.startsWith(ignorePrefix)) continue;
    // 处于 bg-/img- 整体切图子树（像素已烤进父层 PNG）或 x- 忽略子树内 → 不应逐个溯源。
    // 跳过，消除对账假阳性（v1.2.0；v1.2.1 起不含 bgc-）。这类子孙的"禁 DOM"约束交由 R17。
    if (node._inBakedSubtree) continue;
    if (node._hidden) continue; // 隐藏节点不渲染，不校验
    if (node._templateDup) continue; // .map() 列表数据副本，只校验代表项

    // 检查 assets.txt 里是否提到此 nodeId
    const inAssets = assetsText.includes(nodeId);

    // 检查产物是否 (a) jsx 有 <img src=... nodeId 相关> 或 (b) style 有 url(...对应文件)
    const productMention = mentionsNodeIdAsset(product, nodeId, classMap);

    if (!inAssets && !productMention.hit) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: 'assets.txt 有此 nodeId 切图记录 且 产物引用该切图',
        actual: 'assets.txt 未记录 且 产物中未找到该 nodeId 相关 <img> / background url',
        file: '(missing)',
        line: 0,
        snippet: '',
      });
      continue;
    }

    if (!productMention.hit) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: '产物 jsx 或 CSS 引用该 nodeId 切图',
        actual: 'assets.txt 已记录但产物未引用',
        file: '(missing in product)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}

function mentionsNodeIdAsset(product, nodeId, classMap) {
  // 简易: nodeId 直接串在产物 (jsx / style) 里就算 hit;
  //       或该 nodeId 对应 className 的 css 规则里含 url(
  const idNorm = nodeId.replace(/:/g, '-');
  for (const j of product.jsx) {
    if (j.content.includes(nodeId) || j.content.includes(idNorm)) return { hit: true };
  }
  const classes = classMap[nodeId] || [];
  for (const cls of classes) {
    for (const s of product.style) {
      for (const r of collectRuleBodies(s.content, cls)) {
        if (/url\(/i.test(r.body) || /background-image\s*:/i.test(r.body)) return { hit: true };
      }
    }
  }
  for (const s of product.style) {
    if (s.content.includes(nodeId) || s.content.includes(idNorm)) return { hit: true };
  }
  return { hit: false };
}
