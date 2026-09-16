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

/** bbox 面积。 */
function bboxArea(b: BBox): number {
  return Math.max(1, b.width * b.height);
}

/**
 * 合并后把 group 内部按面积重排:大的在最下(children[0]),小的在最上。
 * 这样父视觉一致 —— 大背景不会遮住小内容。
 *
 * `figma.group()` 之后新 group 里的 children 顺序不完全可控;这里显式用
 * `group.insertChild(index, node)` 重排到期望位置。
 */
function sortGroupChildrenBottomUp(group: GroupNode | FrameNode): void {
  // 收集 (node, area)
  const kids = group.children.slice();
  const withArea = kids.map((n) => {
    const box = 'absoluteBoundingBox' in n ? n.absoluteBoundingBox : null;
    return { node: n, area: box ? bboxArea(box) : 0 };
  });
  // 想要:大 → 小(children[0] 大 = z 最底);同面积保持原顺序
  withArea.sort((a, b) => b.area - a.area);
  for (let i = 0; i < withArea.length; i++) {
    try {
      group.insertChild(i, withArea[i].node);
    } catch {
      /* 若节点已在正确位置或不能移动,跳过 */
    }
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
      // 大元素沉底(否则大背景会覆盖上面的小元素)
      sortGroupChildrenBottomUp(g);
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
      // 大元素沉底(否则大背景会覆盖上面的小元素)
      sortGroupChildrenBottomUp(g);
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
