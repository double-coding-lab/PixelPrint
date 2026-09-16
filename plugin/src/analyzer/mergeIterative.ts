/**
 * 迭代合并(一键合并的核心算法)。
 *
 * 目标:自动把"视觉上贴在一起的最小同级元素"层层裹成 group,直到收敛。
 *
 * ## 两阶段
 *
 * **阶段 A(图形碎片)**:每轮只把"图形类叶子 + 上轮生成的 img- group"当作候选,
 * 找同父直接兄弟中 bbox 边距 ≤ CLOSE_GAP 的簇,合并成 `img-image-NN`;循环到无新合并。
 *
 * **阶段 B(纳入文字与其它)**:阶段 A 收敛后开始,候选放宽到"任意可见叶子/GROUP/FRAME",
 * 合并成 `sub-card-NN`(混入文字后语义不再是纯图,换前缀)。
 *
 * ## 收敛条件
 * - 某一轮遍历完没有产生新的 group → 停
 * - 或达到 maxRounds 上限
 *
 * ## 边界
 * - INSTANCE 不动(不下钻、不作为候选、不作为父)
 * - 锁定节点不动
 * - 单个候选尺寸 > MAX_ITEM_SIZE 视为大背景,不参与
 * - 簇 size ≥ 2 且 ≤ MAX_CLUSTER_SIZE 才合并
 * - 已带 img-/bg-/bgc-/x-/sub- 前缀的**不作为原始碎片候选**(用户已定案);
 *   但如果是本次运行阶段 A 产生的 img- group,那它作为候选参与后续轮次(记录在 sessionGroupIds)
 *
 * ## 命名递增
 * 全局 seq,阶段 A: `img-image-01`, `-02`;阶段 B: `sub-card-01`, `-02`。
 */

export interface IterativeMergeOptions {
  /** 邻近阈值(px)。默认 12。 */
  gap?: number;
  /** 每阶段最大迭代轮数。默认 10。 */
  maxRounds?: number;
  /** 单个候选最大尺寸(px)。默认 300,超过视为大背景不参与(阶段 A/B)。 */
  maxItemSize?: number;
  /** 单簇成员上限。默认 12。 */
  maxClusterSize?: number;
  /**
   * 阶段 O 的 bbox 重叠占比阈值(0..1)。默认 0.3。
   * 语义:两个 bbox 的重叠面积 / 较小 bbox 面积 ≥ 此值 → 视为相交,合并。
   * 阈值调高更严(必须大幅重叠),调低更宽(轻微擦边也合)。
   */
  overlapThreshold?: number;
  /** 进度回调。 */
  onProgress?: (phase: 'O' | 'A' | 'B', round: number, mergedThisRound: number) => void;
}

export interface IterativeMergeResult {
  /** 阶段 O 产生的 group 数(相交合并) */
  oGroups: number;
  /** 阶段 A 产生的 group 数 */
  aGroups: number;
  /** 阶段 B 产生的 group 数 */
  bGroups: number;
  /** 阶段 O 用了几轮 */
  oRounds: number;
  /** 阶段 A 用了几轮 */
  aRounds: number;
  /** 阶段 B 用了几轮 */
  bRounds: number;
  /** 命中 maxRounds 提前停止的阶段('O' | 'A' | 'B' | null) */
  stoppedByLimit: 'O' | 'A' | 'B' | null;
  elapsedMs: number;
}

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const IMAGE_LEAF_TYPES = new Set<NodeType>([
  'VECTOR',
  'STAR',
  'POLYGON',
  'BOOLEAN_OPERATION',
]);

function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.max(dx, dy);
}

/**
 * 计算 bbox 重叠面积 / 较小 bbox 面积。
 * - 0 表示完全不重叠
 * - 1 表示较小的完全被较大的包住(或彼此完全重合)
 * - 中间值表示实质相交(> 0)
 */
function bboxOverlapRatio(a: BBox, b: BBox): number {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const overlap = ox * oy;
  if (overlap <= 0) return 0;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const smaller = Math.max(1, Math.min(areaA, areaB));
  return overlap / smaller;
}

/**
 * 合并后按**原父层里的 z-order** 恢复 group 内部顺序。
 *
 * Figma 图层顺序 = z-order:`parent.children[0]` 在最底(z 最小),末尾在最顶。
 * 用户在设计稿里的排布已经表达了 z 意图 —— 例如大背景可能画在**顶层**当浮层
 * 蒙层 / 突出高亮框;按面积粗暴沉底会颠倒它。
 *
 * `figma.group(nodes, parent)` 之后新 group 里 children 的顺序不一定保留原样,
 * 这里显式用合并前记录的 index map,`group.insertChild(i, node)` 恢复到原相对次序。
 */
function preserveOriginalZOrder(
  group: GroupNode | FrameNode,
  originalOrder: Map<string, number>,
): void {
  const kids = group.children.slice();
  // originalOrder 里的 index 小 = 原父里更靠底 = 新 group children[0]
  kids.sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));
  for (let i = 0; i < kids.length; i++) {
    try {
      group.insertChild(i, kids[i]);
    } catch {
      /* 若节点已在正确位置或不能移动,跳过 */
    }
  }
}

/**
 * 把新 group **在外层 parent 里** 移到"所有被合并元素中最底那一个"的原位置。
 *
 * `figma.group(nodes, parent)` 默认把新 group 放到 parent 的**最末尾(最顶层)**,
 * 等于所有被合并的元素整体上浮。如果被合并的元素里有原本在很底的背景层、上面还压
 * 着别的兄弟,合并后这些兄弟就被新 group 遮住了——外部 z-order 被破坏。
 *
 * 正确做法:新 group 的位置 = **合并前所有成员在 parent.children 里最小的那个 index**。
 * 这样合并前后外部 z 关系保持一致。
 *
 * 参数 `preMergeParentOrder` 是合并**前**父层的 children id → index 快照;
 * `memberIds` 是本簇即将被合并的所有节点 id。
 */
function moveGroupToBottomMemberPosition(
  group: GroupNode | FrameNode,
  memberIds: string[],
  preMergeParentOrder: Map<string, number>,
): void {
  const parent = group.parent;
  if (!parent || !('insertChild' in parent)) return;
  let minIndex = Infinity;
  for (const id of memberIds) {
    const idx = preMergeParentOrder.get(id);
    if (typeof idx === 'number' && idx < minIndex) minIndex = idx;
  }
  if (!isFinite(minIndex)) return;
  try {
    (parent as ChildrenMixin & { insertChild: (i: number, n: SceneNode) => void }).insertChild(
      minIndex,
      group,
    );
  } catch {
    /* 边界情况下 Figma 可能拒绝(比如 index 越界),忽略 */
  }
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

/** 阶段 A 候选:图形类叶子(自然碎片)+ 本次运行生成的 img- group(可继续滚)。 */
function isPhaseACandidate(node: SceneNode, sessionGroupIds: Set<string>): boolean {
  // 本轮产物,直接参与
  if (sessionGroupIds.has(node.id)) return true;
  // 已定名的节点不重复卷入
  if (hasSettledPrefix(node.name)) return false;
  // 图形叶子
  if (IMAGE_LEAF_TYPES.has(node.type)) return true;
  if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
    if ('fills' in node) {
      const fills = node.fills;
      if (fills !== figma.mixed && Array.isArray(fills)) {
        return fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
      }
    }
  }
  return false;
}

/**
 * 阶段 O 候选:任何**可见、未锁、非 INSTANCE、未打前缀**的直接子都参与。
 *
 * 这里**不检查 maxItemSize** —— 相交检测的目标就是"大背景 + 上面一堆小元素",
 * 大背景本身尺寸就大,若还用 size 卡就永远漏。用户手动锁定不想动的就锁上。
 */
function isPhaseOCandidate(node: SceneNode, sessionGroupIds: Set<string>): boolean {
  if (node.type === 'INSTANCE') return false;
  if (sessionGroupIds.has(node.id)) return true;
  if (hasSettledPrefix(node.name)) return false;
  return true;
}

/** 阶段 O 的簇聚合:两两 overlap ratio ≥ 阈值即 union。 */
function mergeInContainerByOverlap(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  overlapThreshold: number,
  maxClusterSize: number,
): SceneNode[] {
  if (cands.length < 2) return [];

  const dsu = new DSU(cands.length);
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      if (bboxOverlapRatio(cands[i].box, cands[j].box) >= overlapThreshold) {
        dsu.union(i, j);
      }
    }
  }
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < cands.length; i++) {
    const r = dsu.find(i);
    const arr = clusters.get(r) || [];
    arr.push(i);
    clusters.set(r, arr);
  }

  const newGroups: SceneNode[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    if (idxs.length > maxClusterSize) continue;
    // 合并守卫:父层合并后不能只剩 1 个子
    const remainingAfterMerge = parent.children.length - idxs.length + 1;
    if (remainingAfterMerge < 2) continue;
    const nodes = idxs.map((i) => cands[i].node);
    const memberIds = nodes.map((n) => n.id);
    // 关键:合并前先记录父层每个子的 z-order 快照
    // (parent.children 索引小 = z 更底;用户在 Figma 画的顺序就是他表达的 z 意图,不能按面积推翻)
    // 该快照同时用于:
    //   1) group 内部按原顺序恢复(preserveOriginalZOrder)
    //   2) group 在外层的位置 = 成员中最底那一个的原 index(moveGroupToBottomMemberPosition)
    const preMergeParentOrder = new Map<string, number>();
    parent.children.forEach((c, idx) => {
      preMergeParentOrder.set(c.id, idx);
    });
    try {
      const g = figma.group(nodes, parent);
      if (g.children.length < 2) {
        try {
          g.remove();
        } catch {
          /* ignore */
        }
        continue;
      }
      // group 内部:恢复原始 z-order —— 谁在下面还是在下面,谁在上面还是在上面
      preserveOriginalZOrder(g, preMergeParentOrder);
      // group 外部:移到"最底成员"的原位置,避免整簇被 figma.group 默认置顶后遮挡其他兄弟
      moveGroupToBottomMemberPosition(g, memberIds, preMergeParentOrder);
      newGroups.push(g);
    } catch {
      // 单次失败(比如节点已被上一步吸收),下一轮再看
    }
  }
  return newGroups;
}

/**
 * 阶段 O 的一轮遍历:postorder,对每个容器做 overlap 聚簇合并。
 */
async function walkOnceOverlap(
  overlapThreshold: number,
  maxClusterSize: number,
  sessionGroupIds: Set<string>,
): Promise<number> {
  let merged = 0;
  const seen = new Set<string>();

  async function visit(nodeId: string, depth: number): Promise<void> {
    if (depth > 40) return;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node) return;
    if (node.removed) return;
    if (node.visible === false) return;
    if (node.type === 'INSTANCE') return;

    // postorder:先下钻
    if ('children' in node) {
      const kids = [...node.children];
      for (const c of kids) await visit(c.id, depth + 1);
    }

    if (!('children' in node)) return;
    if (isLocked(node)) return;

    // 收集直接子候选(不受 maxItemSize 限制)
    const cands: Cand[] = [];
    for (const c of node.children) {
      if (c.visible === false) continue;
      if (isLocked(c)) continue;
      if (!isPhaseOCandidate(c, sessionGroupIds)) continue;
      const b = getBBox(c);
      if (!b) continue;
      cands.push({ node: c, box: b });
    }

    const newGroups = mergeInContainerByOverlap(node, cands, overlapThreshold, maxClusterSize);
    for (const g of newGroups) sessionGroupIds.add(g.id);
    merged += newGroups.length;
  }

  const roots = [...figma.currentPage.children];
  for (const r of roots) await visit(r.id, 0);
  return merged;
}

/**
 * 阶段 B 候选:阶段 A 之后仍未成组的所有可见节点(包括文字、GROUP、FRAME),但 INSTANCE 不动。
 *
 * 注意:阶段 B **不复用**本次运行生成的 sub- group(否则会一层层套娃)。
 * A 阶段的 img- group 允许继续被 B 阶段合并(合理:一堆图 + 一段文字合成一张卡)。
 */
function isPhaseBCandidate(
  node: SceneNode,
  sessionGroupIds: Set<string>,
  sessionSubGroupIds: Set<string>,
): boolean {
  if (node.type === 'INSTANCE') return false;
  // A 阶段的 img- group 允许再作候选(帮 B 组合"图 + 文")
  if (sessionGroupIds.has(node.id) && !sessionSubGroupIds.has(node.id)) return true;
  // B 阶段自产的 sub- group 一次成型,不再回锅
  if (sessionSubGroupIds.has(node.id)) return false;
  if (hasSettledPrefix(node.name)) return false;
  return true;
}

function isLocked(node: SceneNode): boolean {
  return 'locked' in node && (node as SceneNode & { locked: boolean }).locked;
}

function getBBox(node: SceneNode): BBox | null {
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    return node.absoluteBoundingBox;
  }
  return null;
}

/** 并查集。 */
class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

interface Cand {
  node: SceneNode;
  box: BBox;
}

/**
 * 对给定容器的直接子做一轮聚簇合并。返回本轮新产生的 group 列表。
 */
function mergeInContainer(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  gap: number,
  maxClusterSize: number,
  prefix: 'img-' | 'sub-',
  namer: () => string,
): SceneNode[] {
  if (cands.length < 2) return [];

  const dsu = new DSU(cands.length);
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      if (bboxGap(cands[i].box, cands[j].box) <= gap) {
        dsu.union(i, j);
      }
    }
  }
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < cands.length; i++) {
    const r = dsu.find(i);
    const arr = clusters.get(r) || [];
    arr.push(i);
    clusters.set(r, arr);
  }

  const newGroups: SceneNode[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    if (idxs.length > maxClusterSize) continue;
    // ⚠ 关键:如果这次合并会让父层直接子数量掉到 < 2(即簇覆盖了父的所有子,或只剩一个非候选),
    // 就跳过 —— 那种合并等于给父层重命名,毫无意义,还会污染树。
    // 计算:合并后 parent.children 数 = 当前 children 数 - 簇大小 + 1(新 group)
    const remainingAfterMerge = parent.children.length - idxs.length + 1;
    if (remainingAfterMerge < 2) continue;
    const nodes = idxs.map((i) => cands[i].node);
    const memberIds = nodes.map((n) => n.id);
    // 关键:合并前先记录父层每个子的 z-order 快照(用于内部顺序恢复 + 外部位置定位)
    const preMergeParentOrder = new Map<string, number>();
    parent.children.forEach((c, idx) => {
      preMergeParentOrder.set(c.id, idx);
    });
    try {
      const g = figma.group(nodes, parent);
      // 兜底:group 建出来后 children < 2(理论上不会,但防 Figma API 边界 bug)
      if (g.children.length < 2) {
        try {
          g.remove();
        } catch {
          /* ignore */
        }
        continue;
      }
      // group 内部:恢复原始 z-order —— 谁在下面还是在下面,谁在上面还是在上面
      preserveOriginalZOrder(g, preMergeParentOrder);
      // group 外部:移到"最底成员"的原位置,避免整簇被 figma.group 默认置顶后遮挡其他兄弟
      moveGroupToBottomMemberPosition(g, memberIds, preMergeParentOrder);
      // 不改名 —— 保留 Figma 默认名(Group N),前缀语义留给用户或 AI 后续打标
      newGroups.push(g);
    } catch {
      // 单次失败(比如节点已被上一步吸收),下一轮再看
    }
  }
  return newGroups;
}

/**
 * 一轮遍历:postorder(先下钻)对每个容器做一次 mergeInContainer,返回本轮新 group 数。
 * 新生成的 group id 会被 push 到 sessionGroupIds 和 (可选) extraGroupIds(阶段 B 用来追踪 sub-)。
 */
async function walkOnce(
  gap: number,
  maxItemSize: number,
  maxClusterSize: number,
  isCandidate: (n: SceneNode) => boolean,
  prefix: 'img-' | 'sub-',
  namer: () => string,
  sessionGroupIds: Set<string>,
  extraGroupIds?: Set<string>,
): Promise<number> {
  let merged = 0;
  const seen = new Set<string>();

  async function visit(nodeId: string, depth: number): Promise<void> {
    if (depth > 40) return;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node) return;
    if (node.removed) return;
    if (node.visible === false) return;
    if (node.type === 'INSTANCE') return;

    // 先下钻(postorder)
    if ('children' in node) {
      const kids = [...node.children];
      for (const c of kids) await visit(c.id, depth + 1);
    }

    // 只有容器才作为聚簇父层
    if (!('children' in node)) return;
    if (isLocked(node)) return;

    // 收集直接子里的候选
    const cands: Cand[] = [];
    for (const c of node.children) {
      if (c.visible === false) continue;
      if (isLocked(c)) continue;
      if (!isCandidate(c)) continue;
      const b = getBBox(c);
      if (!b) continue;
      if (b.width > maxItemSize || b.height > maxItemSize) continue;
      cands.push({ node: c, box: b });
    }

    const newGroups = mergeInContainer(node, cands, gap, maxClusterSize, prefix, namer);
    for (const g of newGroups) {
      sessionGroupIds.add(g.id);
      if (extraGroupIds) extraGroupIds.add(g.id);
    }
    merged += newGroups.length;
  }

  const roots = [...figma.currentPage.children];
  for (const r of roots) await visit(r.id, 0);
  return merged;
}

/**
 * 一键迭代合并主入口。
 *
 * 阶段:
 * - **O(Overlap 相交)**:找出和多个兄弟 bbox 相交的节点(通常是大背景),
 *   连同所有和它相交的兄弟一起合并。不受 maxItemSize 限制。
 * - **A(图形碎片 gap)**:同父兄弟里 bbox 边距 ≤ gap 的图形叶子合并。
 * - **B(混文字 gap)**:候选放宽到 TEXT/GROUP/FRAME,gap 判定同 A。
 *
 * 每阶段迭代到本轮 0 新合并即收敛。
 */
export async function iterativeMerge(opts: IterativeMergeOptions = {}): Promise<IterativeMergeResult> {
  const gap = opts.gap ?? 12;
  const maxRounds = opts.maxRounds ?? 10;
  const maxItemSize = opts.maxItemSize ?? 300;
  const maxClusterSize = opts.maxClusterSize ?? 12;
  const overlapThreshold = opts.overlapThreshold ?? 0.3;
  const onProgress = opts.onProgress;

  const t0 = Date.now();
  const sessionGroupIds = new Set<string>();
  const sessionSubGroupIds = new Set<string>();
  let seqA = 0;
  let seqB = 0;
  let stoppedByLimit: 'O' | 'A' | 'B' | null = null;

  // 阶段 O:相交合并(先跑,让大背景和它上面的小元素成组)
  let oGroups = 0;
  let oRounds = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const merged = await walkOnceOverlap(overlapThreshold, maxClusterSize, sessionGroupIds);
    oGroups += merged;
    oRounds = round;
    if (onProgress) onProgress('O', round, merged);
    if (merged === 0) break;
    if (round === maxRounds && merged > 0) stoppedByLimit = 'O';
  }

  // 阶段 A:图形碎片 gap
  let aGroups = 0;
  let aRounds = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const merged = await walkOnce(
      gap,
      maxItemSize,
      maxClusterSize,
      (n) => isPhaseACandidate(n, sessionGroupIds),
      'img-',
      () => `image-${String(++seqA).padStart(2, '0')}`,
      sessionGroupIds,
    );
    aGroups += merged;
    aRounds = round;
    if (onProgress) onProgress('A', round, merged);
    if (merged === 0) break;
    if (round === maxRounds && merged > 0 && stoppedByLimit === null) stoppedByLimit = 'A';
  }

  // 阶段 B:候选放宽,允许纳入文字与其它
  let bGroups = 0;
  let bRounds = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const merged = await walkOnce(
      gap,
      maxItemSize,
      maxClusterSize,
      (n) => isPhaseBCandidate(n, sessionGroupIds, sessionSubGroupIds),
      'sub-',
      () => `card-${String(++seqB).padStart(2, '0')}`,
      sessionGroupIds,
      sessionSubGroupIds,
    );
    bGroups += merged;
    bRounds = round;
    if (onProgress) onProgress('B', round, merged);
    if (merged === 0) break;
    if (round === maxRounds && merged > 0 && stoppedByLimit === null) stoppedByLimit = 'B';
  }

  return {
    oGroups,
    aGroups,
    bGroups,
    oRounds,
    aRounds,
    bRounds,
    stoppedByLimit,
    elapsedMs: Date.now() - t0,
  };
}
