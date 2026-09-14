/**
 * 健康报告:改造完成后重扫当前 scope,统计前缀/autolayout 分布。
 */
import { LEGACY_PREFIX_PATTERNS, PREFIX_CATALOG } from '../rules/prefix-catalog';
import { checkMutex } from '../guards/mutex';
import { inferAutolayout } from '../rules/autolayout/infer';
import { FIGMA_DEFAULT_NAME_PATTERN } from '../rules/prefix-catalog';
import type { HealthReport, Scope } from '../types';
import { shouldGenerateCandidate, walk } from '../scanner/walker';
import { SCAN_LIMITS } from '../rules/prefix-catalog';

function determineRoots(scope: Scope): ReadonlyArray<SceneNode> {
  if (scope === 'selection') return figma.currentPage.selection;
  return figma.currentPage.children;
}

function extractLeadingPrefix(name: string): string | null {
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

export async function generateReport(scope: Scope): Promise<HealthReport> {
  const roots = determineRoots(scope);
  const prefixDistribution: Record<string, number> = {};
  let totalFrames = 0;
  let hasAutolayout = 0;
  let absoluteButConvertible = 0;
  let absoluteKept = 0;
  let mutexViolations = 0;
  let fallbackNames = 0;
  let oldPrefixDetected = 0;
  const candidates: HealthReport['candidates'] = [];

  await walk(
    roots,
    (node) => {
      if (!shouldGenerateCandidate(node)) return 'continue';
      totalFrames += 1;

      const prefix = extractLeadingPrefix(node.name);
      if (prefix) {
        prefixDistribution[prefix] = (prefixDistribution[prefix] || 0) + 1;
        // 检查互斥
        if (checkMutex(prefix).some((w) => w.level === 'error')) mutexViolations += 1;
      } else {
        prefixDistribution['(no-prefix)'] = (prefixDistribution['(no-prefix)'] || 0) + 1;
      }

      if (LEGACY_PREFIX_PATTERNS.some((r) => r.test(node.name))) oldPrefixDetected += 1;
      if (FIGMA_DEFAULT_NAME_PATTERN.test(node.name)) {
        // Figma 默认名仍存在,说明未做兜底命名
      } else if (
        prefix &&
        /^(sub-|img-|bg-|bgc-|btn-|list-|input-|scrollx-|scrolly-|x-)/.test(prefix)
      ) {
        // 检测兜底命名:形如 <prefix><typeword>-01
        const body = node.name.slice(prefix.length);
        if (/^(card|section|image|background|box|button|list|field|scroll|ignore|frame)-\d{2}$/.test(body)) {
          fallbackNames += 1;
        }
      }

      // Autolayout 统计
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        const frame = node as FrameNode;
        if (frame.layoutMode !== 'NONE') {
          hasAutolayout += 1;
        } else {
          const outcome = inferAutolayout(node);
          if (outcome.spec) absoluteButConvertible += 1;
          else absoluteKept += 1;
        }
      }

      candidates.push({
        id: node.id,
        finalName: node.name,
        hasAutolayout:
          (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
          (node as FrameNode).layoutMode !== 'NONE',
        warnings: prefix ? checkMutex(prefix).map((w) => w.message) : [],
      });

      return 'continue';
    },
    undefined,
    SCAN_LIMITS.yieldEveryN,
  );

  // 用 ISO 时间(避免带毫秒过长)
  const now = new Date();
  const scanTime = now.toISOString();

  return {
    scanTime,
    scope,
    totalFrames,
    prefixDistribution,
    autolayoutCoverage: {
      hasAutolayout,
      absoluteButConvertible,
      absoluteKept,
    },
    mutexViolations,
    fallbackNames,
    oldPrefixDetected,
    candidates,
  };
}
