/**
 * 命名生成:根据候选前缀 + 原图层名,生成最终建议名。
 *
 * 场景:
 * 1. 原名有业务义 → 前缀叠加:`sub-订单卡片`
 * 2. 原名是 Figma 默认(Frame 1234) → 兜底:`sub-card-01`
 * 3. 原名已带旧前缀(card- / blk-) → 标黄 warning,不自动改
 * 4. 原名已带 D2C 前缀 → warning "已有前缀,是否覆盖",默认不勾选
 * 5. 同父下同名 → 序号自动递增
 */
import type { Warning } from '../guards/mutex';
import {
  FALLBACK_TYPE_WORDS,
  FIGMA_DEFAULT_NAME_PATTERN,
  LEGACY_PREFIX_PATTERNS,
  PREFIX_CATALOG,
} from '../rules/prefix-catalog';

export interface NamingContext {
  /** 已经决定的兄弟节点最终名称(同父下),用于避免重名。 */
  siblingNames: string[];
  /** 是否是页面根 frame 的直接子(sub- 兜底命名会用 section 而非 card)。 */
  isTopLevelSub: boolean;
}

export interface NamingResult {
  suggestedName: string;
  warnings: Warning[];
  isFallbackName: boolean;
  isOldPrefix: boolean;
  hasExistingD2cPrefix: boolean;
}

/**
 * 检测已有的 D2C 前缀。返回从最前缀开始识别到的所有 D2C 前缀合并串。
 */
function detectExistingD2cPrefix(name: string): string | null {
  const known = Object.keys(PREFIX_CATALOG);
  let matched = '';
  let rest = name;
  outer: while (rest.length > 0) {
    for (const p of known) {
      if (rest.startsWith(p)) {
        matched += p;
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    break;
  }
  return matched || null;
}

/**
 * 从组合前缀中提取兜底类型词。
 */
function chooseFallbackTypeWord(combinedPrefix: string, isTopLevelSub: boolean): string {
  if (combinedPrefix.includes('sub-')) {
    return isTopLevelSub ? FALLBACK_TYPE_WORDS['sub-root-'] : FALLBACK_TYPE_WORDS['sub-'];
  }
  const bases = ['img-', 'bg-', 'bgc-', 'btn-', 'list-', 'input-', 'scrollx-', 'scrolly-', 'x-'];
  for (const p of bases) {
    if (combinedPrefix.includes(p)) return FALLBACK_TYPE_WORDS[p] || 'frame';
  }
  return 'frame';
}

/**
 * 生成不撞名的序号后缀:base-01, base-02 ...
 */
function findUniqueName(base: string, siblings: string[]): string {
  const takenSet = new Set(siblings);
  for (let i = 1; i < 999; i++) {
    const seq = String(i).padStart(2, '0');
    const name = `${base}-${seq}`;
    if (!takenSet.has(name)) return name;
  }
  return `${base}-99`;
}

export function generateName(
  originalName: string,
  suggestedPrefix: string | null,
  ctx: NamingContext,
): NamingResult {
  const warnings: Warning[] = [];

  if (!suggestedPrefix) {
    return {
      suggestedName: originalName,
      warnings,
      isFallbackName: false,
      isOldPrefix: false,
      hasExistingD2cPrefix: false,
    };
  }

  // 1. 已有 D2C 前缀
  const existingD2c = detectExistingD2cPrefix(originalName);
  if (existingD2c) {
    if (existingD2c === suggestedPrefix) {
      // 前缀已就位,建议保持原名(不 apply)
      return {
        suggestedName: originalName,
        warnings: [
          {
            level: 'info',
            code: 'ALREADY_PREFIXED',
            message: `已有前缀 "${existingD2c}",与建议一致,无需修改`,
          },
        ],
        isFallbackName: false,
        isOldPrefix: false,
        hasExistingD2cPrefix: true,
      };
    }
    // 前缀不一致,标提示但按新前缀覆盖(默认不勾选,由 code.ts 层决定)
    warnings.push({
      level: 'warn',
      code: 'EXISTING_D2C_PREFIX',
      message: `已有 D2C 前缀 "${existingD2c}",建议改为 "${suggestedPrefix}";请人工确认`,
    });
    const body = originalName.slice(existingD2c.length);
    const newName = suggestedPrefix + body;
    return {
      suggestedName: newName,
      warnings,
      isFallbackName: false,
      isOldPrefix: false,
      hasExistingD2cPrefix: true,
    };
  }

  // 2. 旧前缀检测(card- / blk- 等)
  const legacyHit = LEGACY_PREFIX_PATTERNS.find((r) => r.test(originalName));
  if (legacyHit) {
    warnings.push({
      level: 'warn',
      code: 'OLD_PREFIX',
      message: `检测到旧前缀 "${originalName.split('-')[0]}-",请人工确认是否覆盖为 "${suggestedPrefix}"`,
    });
    // 保留原名,仅前缀叠加
    return {
      suggestedName: suggestedPrefix + originalName,
      warnings,
      isFallbackName: false,
      isOldPrefix: true,
      hasExistingD2cPrefix: false,
    };
  }

  // 3. Figma 默认命名 → 兜底
  if (FIGMA_DEFAULT_NAME_PATTERN.test(originalName)) {
    const typeWord = chooseFallbackTypeWord(suggestedPrefix, ctx.isTopLevelSub);
    const base = suggestedPrefix + typeWord;
    const unique = findUniqueName(base, ctx.siblingNames);
    warnings.push({
      level: 'info',
      code: 'FALLBACK_NAME',
      message: `原名 "${originalName}" 是 Figma 默认命名,已兜底为 "${unique}",建议人工核对语义`,
    });
    return {
      suggestedName: unique,
      warnings,
      isFallbackName: true,
      isOldPrefix: false,
      hasExistingD2cPrefix: false,
    };
  }

  // 4. 常规:前缀叠加保留原名
  const combined = suggestedPrefix + originalName;
  // 撞名兜底
  if (ctx.siblingNames.includes(combined)) {
    const unique = findUniqueName(combined, ctx.siblingNames);
    warnings.push({
      level: 'info',
      code: 'NAME_COLLISION',
      message: `叠加前缀后与兄弟重名,已自动补序号为 "${unique}"`,
    });
    return {
      suggestedName: unique,
      warnings,
      isFallbackName: false,
      isOldPrefix: false,
      hasExistingD2cPrefix: false,
    };
  }

  return {
    suggestedName: combined,
    warnings,
    isFallbackName: false,
    isOldPrefix: false,
    hasExistingD2cPrefix: false,
  };
}
