import fs from 'node:fs';
import path from 'node:path';

export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, 'pp-d2c.config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(projectRoot) {
  const p = path.join(projectRoot, 'pp-d2c.config.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// "子孙不生成独立 DOM" 的前缀：命中即整体导出 / 忽略，不再向内递归，其子孙不应作为
// 独立 DOM 出现，也不应被 R02/R06 逐个溯源。**仅两类**：
//   - bg- / img-（含裸词 bg/img）：整体切图，子孙像素**已烤进父层 PNG**（baked，可见）
//   - x-：整体忽略，子孙**被丢弃**（ignored，不可见）
// **不含 bgc-**：bgc- 是"把盒级 CSS(fills/描边/圆角/阴影) 写到父元素"，子孙**没有烤进任何位图**。
//   若把 bgc- 也算作 baked，会让误放在 bgc- 下的 TEXT 被静默跳过 R06 + R17 禁 DOM → 静默丢内容。
//   故 bgc- 子孙走正常规则：R06 会报"无 className"、R21 会报"不可追溯"，把结构错误暴露出来而非吞掉。
const NO_RENDER_PREFIXES = ['bg-', 'img-', 'x-'];
const NO_RENDER_BARE = ['bg', 'img', 'x'];

export function isNonRecursivePrefix(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (NO_RENDER_PREFIXES.some((p) => n.startsWith(p))) return true;
  if (NO_RENDER_BARE.includes(n)) return true; // 裸词 bg / img / x（与 R16 白名单口径一致）
  return false;
}

// 结构签名：捕捉"同构"——同 type + 同层级子结构（深度 3，不含具体文案）。
// 用于识别 `.map()` 列表项：≥2 个同签名的容器兄弟 = 列表，非首项是数据副本。
function structureSig(node, depth) {
  if (depth <= 0 || !Array.isArray(node.children) || node.children.length === 0) {
    return node.type || '?';
  }
  return (node.type || '?') + '(' + node.children.map((c) => structureSig(c, depth - 1)).join(',') + ')';
}

// 标记某节点 children 中的"模板重复项"：同构容器兄弟里的非首个 → __isDup=true。
// 仅对"有自身子结构的容器"生效（叶子如并列 TEXT "20"/"元" 不算列表项，不误标）。
function markTemplateDups(node) {
  if (!Array.isArray(node.children) || node.children.length < 2) return;
  const seen = new Map(); // sig -> 已出现
  for (const c of node.children) {
    if (!c || typeof c !== 'object' || !c.id) continue;
    if (!Array.isArray(c.children) || c.children.length === 0) continue; // 叶子不参与列表判定
    const sig = structureSig(c, 3);
    if (seen.has(sig)) c.__isDup = true; // 非首个同构兄弟 = 数据副本
    else seen.set(sig, true);
  }
}

export function loadCache(projectRoot, cacheKey) {
  const nodesDir = path.join(projectRoot, '.d2c-cache', cacheKey, 'nodes');
  if (!fs.existsSync(nodesDir)) {
    return { error: `cache dir not found: ${nodesDir}`, nodes: {} };
  }
  const nodes = {};
  const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(nodesDir, f), 'utf8');
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      continue;
    }
    // 自上而下遍历：跟踪 parent / "是否处于整体切图子树" / "是否隐藏" 状态，直接标注节点对象
    // （nodes[id] 存的是同一对象引用，标注即对全局生效）。
    walk(json, nodes, null, false, null, false, false);
  }
  return { nodes };
}

// ── --block 局部化（v1.2.4）────────────────────────────────────
// loadCache 装载的是 fileKey 全量节点;--block 模式产物只覆盖本 block 子树,
// 不裁剪会让 R21/R03 等把 block 外所有应渲染节点误报(sub-agent 被迫解释"外部违规")。

// 从产物 data-node-id 集合推断 block 子树根:全部产物节点的最深公共祖先(LCA)。
export function inferBlockRoot(cacheNodes, classMap) {
  const ids = Object.keys(classMap).filter((id) => cacheNodes[id]);
  if (ids.length === 0) return null;
  const chain = (id) => {
    const arr = [];
    let cur = id;
    while (cur) { arr.push(cur); cur = cacheNodes[cur] ? cacheNodes[cur]._parentId : null; }
    return arr; // 自身在前,根在后
  };
  let common = chain(ids[0]);
  for (let i = 1; i < ids.length; i++) {
    const set = new Set(chain(ids[i]));
    common = common.filter((x) => set.has(x));
    if (common.length === 0) return null;
  }
  return common[0] || null; // 最深公共祖先
}

// 把 cache.nodes 裁剪到 rootId 子树(含 rootId 自身)。rootId 的父不在集合内:
// R20 对 rootId 自身会因父 bbox 缺失保守跳过,块内子孙照常对账。
export function pruneToSubtree(cacheNodes, rootId) {
  if (!rootId || !cacheNodes[rootId]) return cacheNodes;
  const keep = {};
  for (const [id, n] of Object.entries(cacheNodes)) {
    let cur = id;
    while (cur) {
      if (cur === rootId) { keep[id] = n; break; }
      cur = cacheNodes[cur] ? cacheNodes[cur]._parentId : null;
    }
  }
  return keep;
}

function walk(node, acc, parentRealId, inBaked, bakedBy, hidden, templateDup) {
  if (!node || typeof node !== 'object') return;

  let childParentId = parentRealId;
  let childInBaked = inBaked;
  let childBakedBy = bakedBy;
  let childHidden = hidden;
  let childTemplateDup = templateDup;

  if (node.id && node.type) {
    // 节点自身：继承祖先传下来的 baked 状态（前缀节点自身不算 baked，它是切图/忽略目标）
    node._parentId = parentRealId;
    node._inBakedSubtree = inBaked;
    node._bakedBy = inBaked ? bakedBy : null;
    // 隐藏传播：自身 visible===false 或任一祖先隐藏 → 该节点不渲染，对账应整体跳过
    node._hidden = hidden || node.visible === false;
    // 模板重复项：自身被父标为 __isDup（非首个同构兄弟），或祖先已是副本 → 整棵子树是数据副本
    node._templateDup = templateDup || node.__isDup === true;
    acc[node.id] = node;

    childParentId = node.id;
    childHidden = node._hidden;
    childTemplateDup = node._templateDup;
    // 自身若是非递归前缀，则其"子孙"进入 baked 子树（自身不进）
    if (!inBaked && isNonRecursivePrefix(node.name)) {
      childInBaked = true;
      childBakedBy = node.id;
    }
  }

  // 进入 children 前，标记本层的模板重复项（同构容器兄弟的非首个）
  markTemplateDups(node);

  if (Array.isArray(node.children)) {
    for (const c of node.children) walk(c, acc, childParentId, childInBaked, childBakedBy, childHidden, childTemplateDup);
  }
  if (node.document) walk(node.document, acc, childParentId, childInBaked, childBakedBy, childHidden, childTemplateDup);
  if (node.node) walk(node.node, acc, childParentId, childInBaked, childBakedBy, childHidden, childTemplateDup);
  if (node.nodes && typeof node.nodes === 'object' && !Array.isArray(node.nodes)) {
    for (const k of Object.keys(node.nodes)) walk(node.nodes[k], acc, childParentId, childInBaked, childBakedBy, childHidden, childTemplateDup);
  }
}
