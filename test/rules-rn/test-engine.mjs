// styleMatch 引擎单测:rpx 剥壳(getNumeric/getNumericAcross)、key 枚举(listStyleKeys)、
// data-node-id → styleKey 绑定(buildNodeIdToStyleKey 单值/数组/动态成员忽略)。
import { getNumeric, getNumericAcross, listStyleKeys, collectRuleBodies } from '../../templates/skills/pp-d2c-rn/bin/lib/styleMatch.mjs';
import { buildNodeIdToStyleKey } from '../../templates/skills/pp-d2c-rn/bin/lib/nodeIdToStyleKey.mjs';

let pass = 0, fail = 0;
function expect(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${a}, want ${e}`); }
}

// ---------- getNumeric:rpx 剥壳 ----------
console.log('getNumeric:');
expect('纯数字', getNumeric('{ width: 20 }', 'width'), { value: 20, viaRpx: false });
expect('rpx 包装剥壳', getNumeric('{ paddingTop: rpx(16) }', 'paddingTop'), { value: 16, viaRpx: true });
expect('rpx 小数', getNumeric('{ width: rpx(331.5) }', 'width'), { value: 331.5, viaRpx: true });
expect('自定义 helper 名', getNumeric('{ width: px2dp(10) }', 'width', 'px2dp'), { value: 10, viaRpx: true });
expect("'100%' → unparseable", getNumeric("{ width: '100%' }", 'width'), { unparseable: true });
expect('三元表达式 → unparseable', getNumeric('{ width: isIOS ? 10 : 20 }', 'width'), { unparseable: true });
expect('未声明 → null', getNumeric('{ height: 10 }', 'width'), null);
expect('同属性后写覆盖', getNumeric('{ width: 10, width: rpx(30) }', 'width'), { value: 30, viaRpx: true });

// ---------- getNumericAcross:跨规则体 ----------
console.log('getNumericAcross:');
expect('后规则体覆盖前', getNumericAcross(['{ width: 10 }', '{ width: rpx(20) }'], 'width'), { value: 20, viaRpx: true });
expect('仅 unparseable → unparseable', getNumericAcross(["{ width: '50%' }"], 'width'), { unparseable: true });
expect('可解析优先于 unparseable', getNumericAcross(['{ width: 12 }', "{ width: '50%' }"], 'width'), { value: 12, viaRpx: false });
expect('都没写 → null', getNumericAcross(['{ height: 1 }'], 'width'), null);

// ---------- listStyleKeys:R12 重复 key 检测基座 ----------
console.log('listStyleKeys:');
const dupText = `const styles = StyleSheet.create({\n  card: { width: 10 },\n  title: { fontSize: 14 },\n  card: { height: 20 },\n});`;
expect('同名 key 多次定义各出一条', listStyleKeys(dupText).filter((k) => k.key === 'card').length, 2);
expect('嵌套对象不误收为顶层 key', listStyleKeys('const styles = StyleSheet.create({ a: { shadowOffset: { width: 0, height: 2 } } });').map((k) => k.key), ['a']);

// ---------- collectRuleBodies ----------
console.log('collectRuleBodies:');
const bodyText = 'const styles = StyleSheet.create({ a: { width: rpx(10), shadowOffset: { width: 0, height: 2 } }, b: { height: 1 } });';
expect('嵌套花括号取整体', collectRuleBodies(bodyText, 'a').length, 1);
expect('体内含嵌套对象内容', collectRuleBodies(bodyText, 'a')[0].body.includes('shadowOffset'), true);

// ---------- buildNodeIdToStyleKey ----------
console.log('buildNodeIdToStyleKey:');
const jsx = (c) => [{ rel: 'index.tsx', content: c }];
expect('单值绑定', buildNodeIdToStyleKey(jsx('<View data-node-id="1:1" style={styles.root} />')), { '1:1': ['root'] });
expect('数组全收 styles 成员', buildNodeIdToStyleKey(jsx('<View data-node-id="1:2" style={[styles.a, styles.b]} />')), { '1:2': ['a', 'b'] });
expect('数组内动态成员忽略', buildNodeIdToStyleKey(jsx('<View data-node-id="1:3" style={[styles.a, dynamicX]} />')), { '1:3': ['a'] });
expect('无 style 绑定不入 map', buildNodeIdToStyleKey(jsx('<View data-node-id="1:4" />')), {});
expect('attrs 换行也能匹配', buildNodeIdToStyleKey(jsx('<View\n  data-node-id="1:5"\n  style={styles.x}\n/>')), { '1:5': ['x'] });

console.log(`\nENGINE: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
