// RN04 styles-file-separation(RN 特有,v0.3.12「styles.ts 强制独立文件」代码化)
// 触发: 全产物 jsx 文件
// 校验:
//   ① jsx 文件内禁出现 StyleSheet.create(样式必须在独立 styles 文件,否则响应式改写 /
//     adapter 改写会触碰 JSX,且 styleMatch 引擎按独立文件对账)
//   ② jsx 内禁静态 inline style 对象 style={{...}}(逃出 styleMatch 对账 → 数值规则全部失明)
// 放行: style={[styles.a, 动态变量]} 数组形态(动态成员不参与机械对账,由 nodeIdToStyleKey 忽略)

export const id = 'RN04';
export const name = 'styles-file-separation';

export function check({ product }) {
  const violations = [];

  for (const j of product.jsx) {
    const lines = j.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/StyleSheet\s*\.\s*create/.test(line)) {
        violations.push(mk(j.rel, i + 1, line.trim(), 'StyleSheet.create 只出现在独立 styles 文件(styles.ts / *.styles.ts)', 'jsx 文件内出现 StyleSheet.create(样式与 JSX 混写)'));
      }
      if (/style=\{\{/.test(line)) {
        violations.push(mk(j.rel, i + 1, line.trim(), 'style 一律绑定 styles.<key>(独立文件对账);动态样式用 style={[styles.x, 动态变量]} 数组形态', 'jsx 出现静态 inline style 对象 style={{...}}(逃出 styleMatch 对账,数值规则全部失明)'));
      }
    }
  }

  return violations;

  function mk(file, line, snippet, expected, actual) {
    return { rule: id, nodeId: '(n/a)', name: file, type: 'JSX', expected, actual, file, line, snippet: snippet.slice(0, 200) };
  }
}
