/**
 * Autolayout 推断:对 layoutMode === 'NONE' 的 frame 反推 auto layout 参数;
 * 已有 auto layout 的 frame 只做校验并生成 warning。
 */
import { AUTOLAYOUT_THRESHOLDS } from '../prefix-catalog';

export interface AutolayoutSpec {
  layoutMode: 'VERTICAL' | 'HORIZONTAL';
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisAlignItems: 'MIN' | 'SPACE_BETWEEN';
}

export interface AutolayoutInferOutcome {
  /** 建议的 spec;null 表示不建议转 auto layout(保留 ABSOLUTE)或已有布局。 */
  spec: AutolayoutSpec | null;
  reason: string[];
  /** 已有 auto layout 时的校验警告(不影响 spec)。 */
  warnings: string[];
  /** 表示"节点已有 auto layout,不需要 apply"。 */
  alreadyAutolayout: boolean;
}

interface ChildGeom {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

function extractGeom(child: SceneNode): ChildGeom | null {
  if (
    !('x' in child) ||
    !('y' in child) ||
    !('width' in child) ||
    !('height' in child)
  ) {
    return null;
  }
  const nc = child as unknown as { x: number; y: number; width: number; height: number };
  return {
    x: nc.x,
    y: nc.y,
    width: nc.width,
    height: nc.height,
    cx: nc.x + nc.width / 2,
    cy: nc.y + nc.height / 2,
  };
}

function variance(nums: number[]): number {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, v) => s + (v - mean) * (v - mean), 0) / nums.length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function inferAutolayout(node: SceneNode): AutolayoutInferOutcome {
  const reason: string[] = [];
  const warnings: string[] = [];

  if (
    node.type !== 'FRAME' &&
    node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE' &&
    node.type !== 'GROUP'
  ) {
    return { spec: null, reason: ['非 FRAME 类型,跳过'], warnings, alreadyAutolayout: false };
  }

  if (!('children' in node)) {
    return { spec: null, reason: [], warnings, alreadyAutolayout: false };
  }

  const frameNode = node as FrameNode;
  const visible = frameNode.children.filter((c) => c.visible !== false);

  // 已有 auto layout → 只校验
  if ('layoutMode' in frameNode && frameNode.layoutMode !== 'NONE') {
    return validateExistingAutolayout(frameNode, visible);
  }

  // 前置过滤
  if (visible.length < AUTOLAYOUT_THRESHOLDS.minChildrenForAutolayout) {
    return {
      spec: null,
      reason: [`可见子 ${visible.length} 个 < 阈值,不判 auto layout`],
      warnings,
      alreadyAutolayout: false,
    };
  }

  const geoms = visible.map(extractGeom).filter((g): g is ChildGeom => g !== null);
  if (geoms.length !== visible.length) {
    return {
      spec: null,
      reason: ['部分子无几何信息,跳过'],
      warnings,
      alreadyAutolayout: false,
    };
  }

  // 主轴判定:x/y 方差比较
  const varX = variance(geoms.map((g) => g.cx));
  const varY = variance(geoms.map((g) => g.cy));
  const ratio = AUTOLAYOUT_THRESHOLDS.primaryAxisVarianceRatio;
  let layoutMode: 'VERTICAL' | 'HORIZONTAL';
  if (varY > varX * ratio) {
    layoutMode = 'VERTICAL';
  } else if (varX > varY * ratio) {
    layoutMode = 'HORIZONTAL';
  } else {
    return {
      spec: null,
      reason: [
        `主副轴散布(varX=${varX.toFixed(1)}, varY=${varY.toFixed(1)}),保留 ABSOLUTE`,
      ],
      warnings,
      alreadyAutolayout: false,
    };
  }
  reason.push(`主轴=${layoutMode} (varX=${varX.toFixed(1)}, varY=${varY.toFixed(1)})`);

  // 按主轴排序,检查不重叠
  const isHorizontal = layoutMode === 'HORIZONTAL';
  const sorted = [...geoms].sort((a, b) => (isHorizontal ? a.x - b.x : a.y - b.y));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevEnd = isHorizontal ? prev.x + prev.width : prev.y + prev.height;
    const curStart = isHorizontal ? cur.x : cur.y;
    if (curStart < prevEnd - AUTOLAYOUT_THRESHOLDS.overlapTolerance) {
      return {
        spec: null,
        reason: [`第 ${i} 与第 ${i - 1} 子主轴重叠,保留 ABSOLUTE`],
        warnings,
        alreadyAutolayout: false,
      };
    }
  }

  // 副轴对齐检查
  const crossCenters = sorted.map((g) => (isHorizontal ? g.cy : g.cx));
  const crossVar = variance(crossCenters);
  const crossStd = Math.sqrt(crossVar);
  // 主轴平均间距
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevEnd = isHorizontal ? prev.x + prev.width : prev.y + prev.height;
    const curStart = isHorizontal ? cur.x : cur.y;
    gaps.push(curStart - prevEnd);
  }
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  if (avgGap > 0 && crossStd / avgGap > AUTOLAYOUT_THRESHOLDS.crossAxisAlignVarianceRatio) {
    return {
      spec: null,
      reason: [
        `副轴中心点标准差 ${crossStd.toFixed(1)} / 主轴均距 ${avgGap.toFixed(1)} > ${AUTOLAYOUT_THRESHOLDS.crossAxisAlignVarianceRatio},非规整排列`,
      ],
      warnings,
      alreadyAutolayout: false,
    };
  }

  // 间距均匀检查
  if (gaps.length >= 2 && avgGap > 0) {
    const gapStd = Math.sqrt(variance(gaps));
    const cv = gapStd / avgGap;
    if (cv > AUTOLAYOUT_THRESHOLDS.primaryAxisSpacingCV) {
      return {
        spec: null,
        reason: [`主轴间距 CV=${cv.toFixed(2)} > ${AUTOLAYOUT_THRESHOLDS.primaryAxisSpacingCV},非均匀`],
        warnings,
        alreadyAutolayout: false,
      };
    }
  }

  // 反推参数
  const itemSpacing = Math.max(0, Math.round(median(gaps)));

  // padding: 父 bbox 边缘 - 首/末子 bbox 边缘
  const frameW = frameNode.width;
  const frameH = frameNode.height;
  const firstStart = isHorizontal ? sorted[0].x : sorted[0].y;
  const lastEnd = isHorizontal
    ? sorted[sorted.length - 1].x + sorted[sorted.length - 1].width
    : sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;

  const paddingMainStart = Math.max(0, Math.round(firstStart));
  const paddingMainEnd = Math.max(0, Math.round((isHorizontal ? frameW : frameH) - lastEnd));

  // 副轴 padding: 用所有子副轴 min/max
  const crossMin = Math.min(...sorted.map((g) => (isHorizontal ? g.y : g.x)));
  const crossMax = Math.max(
    ...sorted.map((g) => (isHorizontal ? g.y + g.height : g.x + g.width)),
  );
  const paddingCrossStart = Math.max(0, Math.round(crossMin));
  const paddingCrossEnd = Math.max(0, Math.round((isHorizontal ? frameH : frameW) - crossMax));

  const paddingTop = isHorizontal ? paddingCrossStart : paddingMainStart;
  const paddingBottom = isHorizontal ? paddingCrossEnd : paddingMainEnd;
  const paddingLeft = isHorizontal ? paddingMainStart : paddingCrossStart;
  const paddingRight = isHorizontal ? paddingMainEnd : paddingCrossEnd;

  const padMax = AUTOLAYOUT_THRESHOLDS.paddingReasonableMax;
  const finalPadTop = paddingTop > padMax ? 0 : paddingTop;
  const finalPadBottom = paddingBottom > padMax ? 0 : paddingBottom;
  const finalPadLeft = paddingLeft > padMax ? 0 : paddingLeft;
  const finalPadRight = paddingRight > padMax ? 0 : paddingRight;

  if (paddingTop > padMax) warnings.push(`paddingTop=${paddingTop} 超阈值,填 0`);
  if (paddingBottom > padMax) warnings.push(`paddingBottom=${paddingBottom} 超阈值,填 0`);
  if (paddingLeft > padMax) warnings.push(`paddingLeft=${paddingLeft} 超阈值,填 0`);
  if (paddingRight > padMax) warnings.push(`paddingRight=${paddingRight} 超阈值,填 0`);

  // counterAxisAlignItems
  const crossMean = crossCenters.reduce((a, b) => a + b, 0) / crossCenters.length;
  const frameCrossSize = isHorizontal ? frameH : frameW;
  const ratioCross = frameCrossSize > 0 ? crossMean / frameCrossSize : 0.5;
  let counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' = 'MIN';
  if (ratioCross > 0.67) counterAxisAlignItems = 'MAX';
  else if (ratioCross > 0.33) counterAxisAlignItems = 'CENTER';

  // primaryAxisAlignItems
  let primaryAxisAlignItems: 'MIN' | 'SPACE_BETWEEN' = 'MIN';
  const edgeStick = AUTOLAYOUT_THRESHOLDS.edgeStickThreshold;
  if (
    paddingMainStart <= edgeStick &&
    paddingMainEnd <= edgeStick &&
    itemSpacing > AUTOLAYOUT_THRESHOLDS.spaceBetweenMinGap
  ) {
    primaryAxisAlignItems = 'SPACE_BETWEEN';
  }

  reason.push(
    `gap=${itemSpacing}(std/mean=${
      avgGap ? (Math.sqrt(variance(gaps)) / avgGap).toFixed(2) : 'n/a'
    })`,
  );
  reason.push(
    `padding T:${finalPadTop} R:${finalPadRight} B:${finalPadBottom} L:${finalPadLeft}`,
  );
  reason.push(`counterAxis=${counterAxisAlignItems}, primaryAxis=${primaryAxisAlignItems}`);

  return {
    spec: {
      layoutMode,
      paddingTop: finalPadTop,
      paddingRight: finalPadRight,
      paddingBottom: finalPadBottom,
      paddingLeft: finalPadLeft,
      itemSpacing,
      counterAxisAlignItems,
      primaryAxisAlignItems,
    },
    reason,
    warnings,
    alreadyAutolayout: false,
  };
}

function validateExistingAutolayout(
  frame: FrameNode,
  visible: SceneNode[],
): AutolayoutInferOutcome {
  const warnings: string[] = [];
  const reason: string[] = [`已有 auto layout: ${frame.layoutMode}`];

  if (visible.length < 2) {
    return { spec: null, reason, warnings, alreadyAutolayout: true };
  }

  const geoms = visible.map(extractGeom).filter((g): g is ChildGeom => g !== null);
  const isHorizontal = frame.layoutMode === 'HORIZONTAL';

  // 反推 padding/gap 并与声明值比对
  const sorted = [...geoms].sort((a, b) => (isHorizontal ? a.x - b.x : a.y - b.y));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevEnd = isHorizontal ? prev.x + prev.width : prev.y + prev.height;
    const curStart = isHorizontal ? cur.x : cur.y;
    gaps.push(curStart - prevEnd);
  }
  const actualGap = gaps.length ? Math.round(median(gaps)) : 0;
  const declaredGap = frame.itemSpacing;

  if (Math.abs(actualGap - declaredGap) > 2) {
    warnings.push(
      `itemSpacing 声明 ${declaredGap}, 实际 ${actualGap}(容差 ±2)`,
    );
  }

  return { spec: null, reason, warnings, alreadyAutolayout: true };
}
