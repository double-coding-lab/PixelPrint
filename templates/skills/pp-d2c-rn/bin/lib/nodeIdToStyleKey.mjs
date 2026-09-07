// 从 jsx 里 grep 出 data-node-id="X:Y" 对应的 style={styles.foo} / style={[styles.a, styles.b]}
// 建立 nodeId -> [styleKey, ...] 的 map(改写自 h5 的 lib/nodeIdToClassName.mjs;
// rn 产物无 className,绑定凭证是 styles 对象的 key)。
// 数组形态里非 styles. 成员(动态变量、inline 对象)忽略——动态部分不参与机械对账。

export function buildNodeIdToStyleKey(jsxFiles) {
  const map = new Map(); // nodeId -> Set<styleKey>

  for (const { content } of jsxFiles) {
    scanFile(content, map);
  }

  const out = {};
  for (const [k, v] of map) out[k] = Array.from(v);
  return out;
}

function scanFile(src, map) {
  // 简易 JSX 标签匹配(与 h5 同骨架): <Tag ... data-node-id="..." ... /> 允许 attrs 换行
  const tagRe = /<[A-Za-z][A-Za-z0-9.-]*\b([^<>]*?)\/?>/gs;
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const attrs = m[1];
    if (!attrs) continue;
    const nodeId = pickAttr(attrs, 'data-node-id');
    if (!nodeId) continue;
    const keys = pickStyleKeys(attrs);
    if (!keys || keys.length === 0) continue;
    if (!map.has(nodeId)) map.set(nodeId, new Set());
    for (const k of keys) map.get(nodeId).add(k);
  }
}

function pickAttr(attrs, name) {
  // name="value" 或 name={"value"} 或 name={'value'}
  const re1 = new RegExp(`\\b${name}="([^"]+)"`);
  const m1 = attrs.match(re1);
  if (m1) return m1[1];
  const re2 = new RegExp(`\\b${name}=\\{['"]([^'"]+)['"]\\}`);
  const m2 = attrs.match(re2);
  if (m2) return m2[1];
  return null;
}

function pickStyleKeys(attrs) {
  // style={styles.foo}
  const m1 = attrs.match(/\bstyle=\{styles\.([A-Za-z_$][\w$]*)\}/);
  if (m1) return [m1[1]];
  // style={[styles.a, styles.b, dynamicX]} — 收全部 styles.X 成员,其余忽略
  const m2 = attrs.match(/\bstyle=\{\[([^\]]*)\]\}/s);
  if (m2) {
    const names = [];
    const partRe = /styles\.([A-Za-z_$][\w$]*)/g;
    let mm;
    while ((mm = partRe.exec(m2[1])) !== null) names.push(mm[1]);
    return names;
  }
  return null;
}
