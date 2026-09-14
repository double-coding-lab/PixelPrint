/**
 * pp-d2c 前缀清单 + Autolayout 判定阈值 + Scan 上限。
 *
 * 前缀协议来源:.Knowledge/topics/pp-d2c.md 「前缀协议」 与 docs/PixelPrint-设计师图层规范.md。
 * 修改此文件视为修改插件产出契约,需同步更新 rules/prefix/*.ts 与 guards/mutex.ts。
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type PrefixCategory = 'core-mechanical' | 'semantic' | 'special';

export interface PrefixSpec {
  /** 置信度默认档:high 默认勾选、medium 默认勾选、low 默认不勾选。 */
  confidence: ConfidenceLevel;
  category: PrefixCategory;
  /** 修饰前缀:只能与基础前缀叠加、不可孤立出现。 */
  modifier?: boolean;
  /** v1 是否自动推断;false 表示只允许面板手动加。 */
  autoInfer?: boolean;
}

export const PREFIX_CATALOG: Record<string, PrefixSpec> = {
  'x-': { confidence: 'high', category: 'core-mechanical' },
  'img-': { confidence: 'high', category: 'core-mechanical' },
  'btn-': { confidence: 'medium', category: 'core-mechanical' },
  'fixed-': { confidence: 'medium', category: 'core-mechanical', modifier: true },
  'end-': { confidence: 'medium', category: 'core-mechanical', modifier: true },
  'scrollx-': { confidence: 'medium', category: 'core-mechanical' },
  'scrolly-': { confidence: 'medium', category: 'core-mechanical' },
  'bg-': { confidence: 'medium', category: 'semantic' },
  'bgc-': { confidence: 'medium', category: 'semantic' },
  'sub-': { confidence: 'medium', category: 'semantic' },
  'list-': { confidence: 'medium', category: 'semantic', modifier: true },
  'input-': { confidence: 'medium', category: 'special' },
  'bl-': { confidence: 'low', category: 'semantic', modifier: true, autoInfer: false },
};

/**
 * 组合优先级(与 pp-d2c topic §设计原理一致):
 *   x- > img- > bg- > bgc- > btn- > scrollx-/scrolly- > 无前缀
 * 修饰前缀 fixed- / end- / bl- / list- 最后叠加,顺序:
 *   fixed- 在最前,然后 end-,然后 list-,然后 bl-,再拼基础前缀。
 */
export const BASE_PREFIX_PRIORITY: string[] = [
  'x-',
  'img-',
  'bg-',
  'bgc-',
  'btn-',
  'scrollx-',
  'scrolly-',
  'sub-',
  'input-',
];

export const MODIFIER_PREFIX_ORDER: string[] = ['fixed-', 'end-', 'list-', 'bl-'];

/**
 * 旧前缀检测:命中即在面板标黄,不自动改。
 */
export const LEGACY_PREFIX_PATTERNS: RegExp[] = [
  /^card-/i,
  /^blk-/i,
  /^module-/i,
  /^section-/i,
  /^wrap-/i,
  /^content-/i,
];

/**
 * Figma 默认命名:命中即走兜底命名。
 */
export const FIGMA_DEFAULT_NAME_PATTERN =
  /^(Frame|Rectangle|Group|Instance|Component|Vector|Ellipse|Polygon|Star|Line|Text) \d+$/;

export const AUTOLAYOUT_THRESHOLDS = {
  /** 副轴中心点方差 / 主轴平均间距,超过此比例视为非规整排列。 */
  crossAxisAlignVarianceRatio: 0.2,
  /** 主轴间距变异系数(std/mean),超过此值视为间距非均匀。 */
  primaryAxisSpacingCV: 0.3,
  /** 少于此值不判定 auto layout。 */
  minChildrenForAutolayout: 2,
  /** bbox 主轴重叠容差(px)。 */
  overlapTolerance: 2,
  /** padding 反推值上限,超过判为异常不写。 */
  paddingReasonableMax: 200,
  /** 首末子贴父边缘的容差,用于判定 SPACE_BETWEEN。 */
  edgeStickThreshold: 4,
  /** 主轴间距超过此值 + 首末贴边才启用 SPACE_BETWEEN。 */
  spaceBetweenMinGap: 20,
  /** 主副轴方差比阈值:大者需 > 小者 × 此倍数才认定主轴。 */
  primaryAxisVarianceRatio: 4,
} as const;

export const SCAN_LIMITS = {
  /** 超过此值弹提示可中断。 */
  softWarnNodes: 1000,
  /** 超过此值直接拒绝 Scan(与 pp-doctor 硬上限对齐)。 */
  hardStopNodes: 5000,
  /** 每处理 N 个节点让出主线程一次。 */
  yieldEveryN: 20,
} as const;

/**
 * naming 兜底命名的类型词表(前缀 -> 默认类型词)。
 */
export const FALLBACK_TYPE_WORDS: Record<string, string> = {
  'sub-': 'card',
  'sub-root-': 'section',
  'img-': 'image',
  'bg-': 'background',
  'bgc-': 'box',
  'btn-': 'button',
  'list-': 'list',
  'input-': 'field',
  'scrollx-': 'scroll',
  'scrolly-': 'scroll',
  'x-': 'ignore',
};
