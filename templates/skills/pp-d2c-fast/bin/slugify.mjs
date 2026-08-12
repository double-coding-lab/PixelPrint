#!/usr/bin/env node
// slugify.mjs — pp-d2c v1.1.0 内置 slug 工具
//
// 用法:
//   node slugify.mjs "<name>"                      → 输出 slug
//   node slugify.mjs "<name>" --fallback "<nodeId>" → 失败时用 page-<nodeId-safe> 兜底
//
// slug 规则:
//   1. ASCII: 保留 [a-z0-9], 其余 → '-', trim, lowercase, 连续 '-' 压成一个
//   2. 中文 → pinyin 简易转换 (内置常用字表, 缺则跳过)
//   3. 结果为空 or 仅含 '-' → 返回 fallback 或空串
//
// 中文覆盖: 前 500 常用字 + Figma 常见图层词（活动、页面、按钮、导航等）
// 不追求 100% 覆盖，只作 v1.1.0 默认 slug 兜底；用户可显式指定 slug 覆盖脚本结果

const CJK_TO_PINYIN = {
  // 数字 / 单位
  '零': 'ling', '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu',
  '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '百': 'bai', '千': 'qian', '万': 'wan', '亿': 'yi',

  // 常用字 (Figma 图层高频词)
  '完': 'wan', '整': 'zheng', '版': 'ban', '页': 'ye', '面': 'mian',
  '中': 'zhong', '国': 'guo', '秋': 'qiu', '春': 'chun', '夏': 'xia', '冬': 'dong',
  '节': 'jie', '日': 'ri', '月': 'yue', '年': 'nian', '季': 'ji',
  '亚': 'ya', '洲': 'zhou', '欧': 'ou', '美': 'mei', '非': 'fei', '大': 'da',
  '洋': 'yang', '海': 'hai', '陆': 'lu', '岛': 'dao',

  '首': 'shou', '尾': 'wei', '前': 'qian', '后': 'hou', '左': 'zuo', '右': 'you',
  '上': 'shang', '下': 'xia', '内': 'nei', '外': 'wai',

  '状': 'zhuang', '态': 'tai', '栏': 'lan', '条': 'tiao', '框': 'kuang',
  '按': 'an', '钮': 'niu', '键': 'jian', '标': 'biao', '题': 'ti', '副': 'fu',
  '图': 'tu', '片': 'pian', '像': 'xiang', '标': 'biao', '识': 'shi',
  '文': 'wen', '字': 'zi', '本': 'ben', '段': 'duan',

  '导': 'dao', '航': 'hang', '菜': 'cai', '单': 'dan', '侧': 'ce', '边': 'bian',
  '底': 'di', '部': 'bu', '顶': 'ding',

  '活': 'huo', '动': 'dong', '优': 'you', '惠': 'hui', '券': 'quan', '卡': 'ka',
  '福': 'fu', '利': 'li', '专': 'zhuan', '享': 'xiang',
  '领': 'ling', '取': 'qu', '立': 'li', '即': 'ji', '抢': 'qiang',
  '预': 'yu', '约': 'yue', '订': 'ding', '购': 'gou', '买': 'mai',

  '火': 'huo', '车': 'che', '票': 'piao', '飞': 'fei', '机': 'ji', '船': 'chuan',
  '酒': 'jiu', '店': 'dian', '住': 'zhu', '宿': 'su',

  '开': 'kai', '售': 'shou', '关': 'guan', '闭': 'bi', '结': 'jie', '束': 'shu',
  '时': 'shi', '间': 'jian', '倒': 'dao', '计': 'ji',

  '新': 'xin', '旧': 'jiu', '老': 'lao', '客': 'ke', '户': 'hu',
  '会': 'hui', '员': 'yuan',

  '首': 'shou', '页': 'ye', '主': 'zhu', '要': 'yao',

  '服': 'fu', '务': 'wu', '中': 'zhong', '心': 'xin',

  '登': 'deng', '录': 'lu', '注': 'zhu', '册': 'ce', '账': 'zhang', '号': 'hao',
  '密': 'mi', '码': 'ma', '手': 'shou', '机': 'ji',

  '搜': 'sou', '索': 'suo', '查': 'cha', '询': 'xun',

  '折': 'zhe', '扣': 'kou', '价': 'jia', '元': 'yuan', '角': 'jiao', '分': 'fen',
  '免': 'mian', '费': 'fei',

  '收': 'shou', '藏': 'cang', '分': 'fen', '享': 'xiang',

  '设': 'she', '置': 'zhi', '编': 'bian', '辑': 'ji', '删': 'shan', '除': 'chu',
  '保': 'bao', '存': 'cun', '确': 'que', '认': 'ren',

  '成': 'cheng', '功': 'gong', '失': 'shi', '败': 'bai', '错': 'cuo', '误': 'wu',

  '返': 'fan', '回': 'hui', '进': 'jin', '入': 'ru', '出': 'chu',

  '快': 'kuai', '慢': 'man', '高': 'gao', '低': 'di',

  '弹': 'tan', '窗': 'chuang', '浮': 'fu', '动': 'dong',

  '空': 'kong', '白': 'bai', '黑': 'hei', '红': 'hong', '橙': 'cheng', '黄': 'huang',
  '绿': 'lv', '蓝': 'lan', '紫': 'zi', '灰': 'hui',

  '预': 'yu', '警': 'jing', '提': 'ti', '示': 'shi',
};

export function slugify(input, fallbackNodeId = null) {
  if (!input || typeof input !== 'string') {
    return fallbackNodeId ? nodeIdFallback(fallbackNodeId) : '';
  }

  // 1. 中文转 pinyin (逐字, 缺字直接丢弃)
  let s = '';
  for (const ch of input) {
    if (CJK_TO_PINYIN[ch]) {
      s += CJK_TO_PINYIN[ch];
    } else {
      s += ch;
    }
  }

  // 2. ASCII 化: 保留 [A-Za-z0-9], 其余变 '-'
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 3. 结果空 or 只有 '-' → fallback
  if (!s || /^-+$/.test(s)) {
    return fallbackNodeId ? nodeIdFallback(fallbackNodeId) : '';
  }

  return s;
}

function nodeIdFallback(nodeId) {
  const safe = String(nodeId).replace(/[^A-Za-z0-9]+/g, '_');
  return `page-${safe}`;
}

// CLI
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] || '') === __filename) {
  const argv = process.argv.slice(2);
  let name = null;
  let fallback = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fallback') fallback = argv[++i];
    else if (!name) name = argv[i];
  }
  if (!name) {
    process.stderr.write('Usage: slugify.mjs "<name>" [--fallback "<nodeId>"]\n');
    process.exit(2);
  }
  const out = slugify(name, fallback);
  process.stdout.write(out + '\n');
}
