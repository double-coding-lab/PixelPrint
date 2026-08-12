// cssMatch — 共享 CSS/SCSS 选择器匹配（v1.2.0）
//
// 背景：D2C 产物按 config.styleFormat 可能是平铺 CSS（`.page__foo { }`）
// 或 SCSS 嵌套（`.page { &__foo { } }`）。若规则只用 `\.classname` 平铺正则匹配，
// 遇到 SCSS `&__foo` / `&-foo` 嵌套写法会整体匹配不到 → 大量假阳性
// （test13 事故：R06 47 条假阳性全因产物是 `&__cd-num` 嵌套、正则找的是 `.page__cd-num`）。
//
// 本 lib 提炼自 R01 v1.1.0 补丁，统一供 R01/R02/R06/R18/R19 复用，杜绝各规则各自实现导致的嵌套盲区。
//
// 已知边界：正则按 `{...}` 最近闭合截取规则体，对"同块内既有声明又有嵌套子选择器"的场景
// 只截到第一个 `}`。D2C 产物的叶子选择器（承载具体声明）通常无内层嵌套，此边界可接受；
// 需要更强解析时再升级为词法栈解析。

const RE_ESC = /[.*+?^${}()|[\]\\]/g;
function esc(s) {
  return s.replace(RE_ESC, '\\$&');
}

// className "test13-page__cd-num" → ["__cd-num", "-num"]
// className "page-fixed-bar"      → ["-bar"]（无 __）
// className "foo"                 → []（无分隔符，无 scss 嵌套形态可推）
export function deriveScssSuffixes(className) {
  const out = new Set();
  const idxDouble = className.lastIndexOf('__');
  if (idxDouble >= 0) out.add(className.slice(idxDouble)); // "__cd-num"
  const idxDash = className.lastIndexOf('-');
  if (idxDash > 0) out.add('-' + className.slice(idxDash + 1)); // "-num"
  return Array.from(out);
}

// 收集某 className 在一段 css 里的所有规则体（平铺 + SCSS &__ / &- 嵌套）。
// 返回 [{ body, line }]（body = `{ }` 内文本，line = 选择器所在行）。
export function collectRuleBodies(css, className) {
  const cn = (className || '').trim();
  if (!cn) return [];
  const out = [];

  // 1) 平铺完整选择器： .foo { ... } | .parent .foo { ... }
  const directRe = new RegExp(`\\.${esc(cn)}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
  let m;
  while ((m = directRe.exec(css)) !== null) {
    out.push({ body: m[1], line: css.slice(0, m.index).split('\n').length });
  }

  // 2) SCSS 嵌套 &__xxx / &-xxx
  for (const suffix of deriveScssSuffixes(cn)) {
    const nestedRe = new RegExp(`&${esc(suffix)}\\b[^{]*\\{([\\s\\S]*?)\\}`, 'g');
    while ((m = nestedRe.exec(css)) !== null) {
      out.push({ body: m[1], line: css.slice(0, m.index).split('\n').length });
    }
  }

  return out;
}

// 在多个 style 文件里，某 nodeId 的任一 className 是否有规则体命中 propRe。
// classes = classMap[nodeId]（可能多个）；styleFiles = product.style（[{ content, rel }]）。
// 命中返回 { hit:true, rel, line, body }；否则 { hit:false, firstRel, firstLine, firstSnippet }
// （firstX 给出该 className 找到的第一个规则体，便于报错定位）。
export function findProperty(styleFiles, classes, propRe) {
  let firstRel = null, firstLine = 0, firstSnippet = '';
  for (const cls of classes || []) {
    for (const s of styleFiles) {
      const bodies = collectRuleBodies(s.content, cls);
      for (const r of bodies) {
        if (propRe.test(r.body)) {
          return { hit: true, rel: s.rel, line: r.line, body: r.body };
        }
        if (!firstRel) {
          firstRel = s.rel;
          firstLine = r.line;
          firstSnippet = r.body.slice(0, 200);
        }
      }
    }
  }
  return { hit: false, firstRel, firstLine, firstSnippet };
}

// 取某 nodeId 第一个 className 的规则体（用于需要读取声明值的规则，如 R19 padding）。
// 返回 { body, rel, line } 或 null。
export function firstRuleBody(styleFiles, classes) {
  for (const cls of classes || []) {
    for (const s of styleFiles) {
      const bodies = collectRuleBodies(s.content, cls);
      if (bodies.length) return { body: bodies[0].body, rel: s.rel, line: bodies[0].line };
    }
  }
  return null;
}
