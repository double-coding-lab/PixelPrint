/**
 * pp-d2c 前缀清单 + Scan 上限。
 *
 * 前缀协议来源:.Knowledge/topics/pp-d2c.md 「前缀协议」 与 docs/PixelPrint-设计师图层规范.md。
 * v0.3:去除自动推断,只保留清单;confidence/category/autoInfer 字段作为面板分组信息保留。
 */

export type PrefixCategory = 'base' | 'modifier';

export interface PrefixSpec {
  /** 面板分组:base 基础前缀、modifier 修饰前缀。 */
  category: PrefixCategory;
  /** 一行简介,用于按钮 tooltip。 */
  desc: string;
  /** 生成节点(sub/btn/img/input/scrollx/scrolly),还是不生成 DOM 节点(bg/bgc/x)。 */
  noDom?: boolean;
}

export const PREFIX_CATALOG: Record<string, PrefixSpec> = {
  // 基础前缀
  'sub-': { category: 'base', desc: '独立模块,AI 单独处理生成组件' },
  'img-': { category: 'base', desc: '整块图片,内部不拆解' },
  'bg-': { category: 'base', desc: '背景图,设为父 background-image', noDom: true },
  'bgc-': { category: 'base', desc: '父级背景与装饰(纯 CSS),不生成独立元素', noDom: true },
  'btn-': { category: 'base', desc: '可点击容器' },
  'input-': { category: 'base', desc: '输入框,生成 <input type="text">' },
  'scrollx-': { category: 'base', desc: '横向滚动容器' },
  'scrolly-': { category: 'base', desc: '纵向滚动容器' },
  'x-': { category: 'base', desc: '完全忽略,不生成代码', noDom: true },
  // 修饰前缀
  'fixed-': { category: 'modifier', desc: '视口固定定位(吸顶/吸底/悬浮)' },
  'end-': { category: 'modifier', desc: '贴父末端(逆向布局)' },
  'list-': { category: 'modifier', desc: '同构列表,循环模板渲染' },
  'bl-': { category: 'modifier', desc: '文本基线对齐' },
};

/**
 * 所有已知前缀(按识别时的最大长度优先顺序,便于从图层名剥前缀)。
 */
export const KNOWN_PREFIXES = Object.keys(PREFIX_CATALOG);

/**
 * 旧前缀检测:命中即在面板标黄提示。
 */
export const LEGACY_PREFIX_PATTERNS: RegExp[] = [
  /^card-/i,
  /^blk-/i,
  /^module-/i,
  /^wrap-/i,
  /^content-/i,
];

/**
 * Figma 默认命名。
 */
export const FIGMA_DEFAULT_NAME_PATTERN =
  /^(Frame|Rectangle|Group|Instance|Component|Vector|Ellipse|Polygon|Star|Line|Text) \d+$/;

export const SCAN_LIMITS = {
  softWarnNodes: 1000,
  hardStopNodes: 5000,
  yieldEveryN: 20,
} as const;
