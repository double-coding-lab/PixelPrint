// R21 node-id-coverage（v1.2.1 对账新增）
// 触发: "应生成独立 DOM"的节点，产物 JSX 里找不到其 data-node-id
// 目的: 让 §5.1.1「data-node-id 全覆盖铁律」机械强制。没有 node-id，R06/R18/R19/R20 全都
//       绑定不到产物 → 遇空 classMap 只能 continue，bug 静默逃逸（典型 test13 small-card-top）。
//       R21 正是"不可追溯"本身的硬拦截：应渲染却无 node-id = 违规。
//
// "应生成独立 DOM"的节点（满足任一）:
//   - TEXT 节点
//   - autolayout 容器（layoutMode ∈ {HORIZONTAL, VERTICAL}）
//   - layoutPositioning === 'ABSOLUTE'（需 R20 校验坐标）
//   - name 前缀 img- / btn- / input-（生成 <img>/<button>/<input>）
// 排斥:
//   - _inBakedSubtree（bg-/img- 整体切图 或 x- 忽略子树，本就不出 DOM）
//   - _hidden（不渲染）
//   - _templateDup（.map() 数据副本，只需代表项挂 id）
//   - name 前缀 bg- / bgc- / x-（自身不生成独立 DOM：bg/bgc 挂父，x 忽略）
//
// .map() 模板项：产物用代表项（variant a）nodeId 挂 data-node-id；R21 对代表项校验，
// 副本已被 _templateDup 跳过。

export const id = 'R21';
export const name = 'node-id-coverage';

const NO_OWN_DOM_PREFIXES = ['bg-', 'bgc-', 'x-'];

export function check({ cache, product }) {
  const violations = [];

  for (const [nodeId, node] of Object.entries(cache.nodes)) {
    if (node._inBakedSubtree || node._hidden || node._templateDup) continue;
    const nm = (node.name || '').trim();
    if (NO_OWN_DOM_PREFIXES.some((p) => nm.startsWith(p)) || nm === 'bg' || nm === 'bgc' || nm === 'x') continue;

    if (!shouldRender(node, nm)) continue;

    if (!hasDomNode(product, nodeId)) {
      violations.push({
        rule: id,
        nodeId,
        name: node.name || '(no name)',
        type: node.type,
        expected: `应生成 DOM 的节点必须挂 data-node-id="${nodeId}"（§5.1.1 铁律；.map() 模板挂代表项 id），否则 R06/R18/R19/R20 无法绑定校验`,
        actual: '产物 JSX 中找不到该 nodeId 的 data-node-id（不可追溯，可能漏画或漏挂 id）',
        file: '(missing in jsx)',
        line: 0,
        snippet: '',
      });
    }
  }

  return violations;
}

function shouldRender(node, nm) {
  if (node.type === 'TEXT') return true;
  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') return true;
  if (node.layoutPositioning === 'ABSOLUTE') return true;
  if (nm.startsWith('img-') || nm.startsWith('btn-') || nm.startsWith('input-')) return true;
  return false;
}

function hasDomNode(product, nodeId) {
  const idNorm = nodeId.replace(/:/g, '-');
  const re = new RegExp(`data-node-id=(?:"|\\{['"])(?:${escapeRegex(nodeId)}|${escapeRegex(idNorm)})(?:"|['"]\\})`);
  for (const j of product.jsx) {
    if (re.test(j.content)) return true;
  }
  return false;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
