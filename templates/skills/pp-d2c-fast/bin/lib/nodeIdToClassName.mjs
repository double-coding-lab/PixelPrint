// 从 jsx 里 grep 出 data-node-id={"X:Y"} 或 data-node-id="X:Y" 对应的 className={styles.foo} / className="foo"
// 建立 nodeId -> [className, ...] 的 map

export function buildNodeIdToClassName(jsxFiles) {
  const map = new Map(); // nodeId -> Set<className>

  for (const { content } of jsxFiles) {
    scanFile(content, map);
  }

  const out = {};
  for (const [k, v] of map) out[k] = Array.from(v);
  return out;
}

function scanFile(src, map) {
  // 简易 JSX 标签匹配 (足够 v1.0.0): 逐行 or 逐标签扫
  // 用 <XXX ... data-node-id="..." ... /> 或 <XXX ... />...</XXX>
  // 允许 attrs 之间任意换行 (className 和 data-node-id 顺序不定)
  const tagRe = /<[A-Za-z][A-Za-z0-9-]*\b([^<>]*?)\/?>/gs;
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const attrs = m[1];
    if (!attrs) continue;
    const nodeId = pickAttr(attrs, 'data-node-id');
    if (!nodeId) continue;
    const cls = pickClassName(attrs);
    if (!cls || cls.length === 0) continue;
    if (!map.has(nodeId)) map.set(nodeId, new Set());
    for (const c of cls) map.get(nodeId).add(c);
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

function pickClassName(attrs) {
  // className="a b c"
  const m1 = attrs.match(/\bclassName="([^"]+)"/);
  if (m1) return m1[1].split(/\s+/).filter(Boolean);
  // className={styles.foo}
  const m2 = attrs.match(/\bclassName=\{styles\.([A-Za-z_][A-Za-z0-9_]*)\}/);
  if (m2) return [m2[1]];
  // className={`${styles.foo} ${styles.bar}`} — 简易匹配
  const m3 = attrs.match(/\bclassName=\{`([^`]+)`\}/);
  if (m3) {
    const names = [];
    const inner = m3[1];
    const partRe = /styles\.([A-Za-z_][A-Za-z0-9_]*)/g;
    let mm;
    while ((mm = partRe.exec(inner)) !== null) names.push(mm[1]);
    return names;
  }
  // className={clsx(styles.foo, styles.bar)} / className={classNames(...)}
  const m4 = attrs.match(/\bclassName=\{(?:clsx|classNames|cx)\(([^)]+)\)\}/);
  if (m4) {
    const names = [];
    const partRe = /styles\.([A-Za-z_][A-Za-z0-9_]*)/g;
    let mm;
    while ((mm = partRe.exec(m4[1])) !== null) names.push(mm[1]);
    return names;
  }
  return null;
}
