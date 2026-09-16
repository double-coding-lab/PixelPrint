/**
 * 合并诊断:给两个节点 id,回答"为什么它们没被合到一起"。
 *
 * 按算法约束依次检查,返回第一个失败原因(以及全部诊断上下文,便于 UI 展示)。
 */

const IMAGE_LEAF_TYPES = new Set<NodeType>([
  'VECTOR',
  'STAR',
  'POLYGON',
  'BOOLEAN_OPERATION',
]);

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.max(dx, dy);
}

function isLocked(n: SceneNode): boolean {
  return 'locked' in n && (n as SceneNode & { locked: boolean }).locked;
}

function hasSettledPrefix(name: string): boolean {
  return (
    name.startsWith('img-') ||
    name.startsWith('bg-') ||
    name.startsWith('bgc-') ||
    name.startsWith('x-') ||
    name.startsWith('sub-')
  );
}

function isImageLeaf(n: SceneNode): boolean {
  if (IMAGE_LEAF_TYPES.has(n.type)) return true;
  if (n.type === 'RECTANGLE' || n.type === 'ELLIPSE') {
    if ('fills' in n) {
      const fills = n.fills;
      if (fills !== figma.mixed && Array.isArray(fills)) {
        return fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
      }
    }
  }
  return false;
}

export interface DiagnoseInput {
  aId: string;
  bId: string;
  gap?: number;
  maxItemSize?: number;
}

export interface DiagnoseResult {
  aName: string;
  bName: string;
  reasons: string[];
  wouldMerge: boolean;
  /** 诊断上下文,便于 UI 展示细节 */
  info: Record<string, unknown>;
}

export async function diagnoseMerge(input: DiagnoseInput): Promise<DiagnoseResult> {
  const gap = input.gap ?? 12;
  const maxItemSize = input.maxItemSize ?? 300;
  const info: Record<string, unknown> = { gap, maxItemSize };
  const reasons: string[] = [];

  const a = (await figma.getNodeByIdAsync(input.aId)) as SceneNode | null;
  const b = (await figma.getNodeByIdAsync(input.bId)) as SceneNode | null;
  const aName = a?.name || input.aId;
  const bName = b?.name || input.bId;

  if (!a) reasons.push(`节点 A 不存在(${input.aId})`);
  if (!b) reasons.push(`节点 B 不存在(${input.bId})`);
  if (!a || !b) return { aName, bName, reasons, wouldMerge: false, info };

  info.aType = a.type;
  info.bType = b.type;
  info.aVisible = a.visible;
  info.bVisible = b.visible;
  info.aLocked = isLocked(a);
  info.bLocked = isLocked(b);
  info.aName = a.name;
  info.bName = b.name;

  // 1) 可见性
  if (a.visible === false) reasons.push('A 不可见(visible=false)');
  if (b.visible === false) reasons.push('B 不可见(visible=false)');

  // 2) 锁定
  if (isLocked(a)) reasons.push('A 被锁定(🔒),算法主动跳过');
  if (isLocked(b)) reasons.push('B 被锁定(🔒),算法主动跳过');

  // 3) INSTANCE
  if (a.type === 'INSTANCE') reasons.push('A 是 INSTANCE,算法不下钻也不动 INSTANCE 内部');
  if (b.type === 'INSTANCE') reasons.push('B 是 INSTANCE,算法不下钻也不动 INSTANCE 内部');

  // 4) 已定名(带 pp-d2c 前缀)
  if (hasSettledPrefix(a.name))
    reasons.push(`A 已带 pp-d2c 前缀(${a.name}),算法视为用户已定案不再改`);
  if (hasSettledPrefix(b.name))
    reasons.push(`B 已带 pp-d2c 前缀(${b.name}),算法视为用户已定案不再改`);

  // 5) 同父
  const aParent = a.parent;
  const bParent = b.parent;
  info.aParentId = aParent?.id ?? null;
  info.bParentId = bParent?.id ?? null;
  info.aParentName = aParent?.name ?? null;
  info.bParentName = bParent?.name ?? null;
  info.aParentType = aParent?.type ?? null;
  info.bParentType = bParent?.type ?? null;
  if (!aParent || !bParent) {
    reasons.push('A 或 B 的父节点缺失');
  } else if (aParent.id !== bParent.id) {
    reasons.push(
      `A 和 B 不同父层(A 在「${aParent.name}」,B 在「${bParent.name}」),算法只合并同父直接兄弟`,
    );
  }

  // 6) 父层是否为容器 / 是否锁定
  if (aParent && bParent && aParent.id === bParent.id) {
    const p = aParent as SceneNode & { children?: readonly SceneNode[] };
    if (!('children' in p)) {
      reasons.push('父层不是容器类节点,无法在其中建 group');
    } else {
      info.parentChildCount = p.children!.length;
      if ('locked' in p && (p as SceneNode & { locked: boolean }).locked) {
        reasons.push('父层被锁定,算法不进');
      }
    }
  }

  // 7) BBox 存在
  const aBox = 'absoluteBoundingBox' in a ? a.absoluteBoundingBox : null;
  const bBox = 'absoluteBoundingBox' in b ? b.absoluteBoundingBox : null;
  info.aBox = aBox;
  info.bBox = bBox;
  if (!aBox) reasons.push('A 没有 absoluteBoundingBox(可能是零尺寸)');
  if (!bBox) reasons.push('B 没有 absoluteBoundingBox');

  // 8) 单个尺寸不超上限
  if (aBox) {
    if (aBox.width > maxItemSize || aBox.height > maxItemSize) {
      reasons.push(
        `A 尺寸 ${Math.round(aBox.width)}×${Math.round(aBox.height)} 超 maxItemSize=${maxItemSize},视为大背景不参与`,
      );
    }
  }
  if (bBox) {
    if (bBox.width > maxItemSize || bBox.height > maxItemSize) {
      reasons.push(
        `B 尺寸 ${Math.round(bBox.width)}×${Math.round(bBox.height)} 超 maxItemSize=${maxItemSize},视为大背景不参与`,
      );
    }
  }

  // 9) bbox gap
  if (aBox && bBox) {
    const g = bboxGap(aBox as BBox, bBox as BBox);
    info.gapPx = Math.round(g);
    if (g > gap) {
      reasons.push(
        `A 和 B 边距离 ≈ ${Math.round(g)}px,超过 gap=${gap}px,不算紧邻。把头部 gap 加大到 ≥ ${Math.ceil(g)} 再试`,
      );
    }
  }

  // 10) 阶段判定
  const aIsImage = isImageLeaf(a);
  const bIsImage = isImageLeaf(b);
  info.aIsImageLeaf = aIsImage;
  info.bIsImageLeaf = bIsImage;
  if (!aIsImage || !bIsImage) {
    // 阶段 A 只吃图形叶子,若都不是就必须靠阶段 B(会,但需要 A 已跑完且没别的阻塞)
    if (!aIsImage) info.aPhase = 'B(非图形叶子)';
    else info.aPhase = 'A(图形叶子)';
    if (!bIsImage) info.bPhase = 'B(非图形叶子)';
    else info.bPhase = 'A(图形叶子)';
  } else {
    info.aPhase = 'A(图形叶子)';
    info.bPhase = 'A(图形叶子)';
  }

  // 11) 合并后父.children < 2 守卫
  if (aParent && bParent && aParent.id === bParent.id && 'children' in aParent) {
    const childCount = (aParent as SceneNode & { children: readonly SceneNode[] }).children.length;
    // 只算 A、B 两个成员的最保守场景
    if (childCount - 2 + 1 < 2) {
      reasons.push(
        `父层只有 ${childCount} 个直接子,合并 A+B 后只剩 1 个子(合并守卫拒绝:等于给父层重命名)`,
      );
    }
  }

  return {
    aName,
    bName,
    reasons,
    wouldMerge: reasons.length === 0,
    info,
  };
}
