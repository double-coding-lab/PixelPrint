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
   * 限制合并范围到这些子树内;为空或缺省 = 整页所有顶层 frame。
   * 传入时,walk 只从这些 rootIds 起点 postorder 遍历,不再全页扫描。
   */
  rootIds?: string[];
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
 * 把新 group **在外层 parent 里** 移到"最顶那个合并成员"的原相对位置。
 *
 * ## 关键难点:收缩后的 index 映射
 *
 * 假设 parent 原来 `[X(0), A(1), B(2), Y(3)]`,合并 A、B:
 *   - `figma.group([A,B], parent)` 后 parent.children 变成 `[X, Y, group]`(长度 3,
 *     成员 A、B 被抽走进 group,新 group 默认加在末尾)。
 *   - 我们希望 group 落在**原 B 的位置之后、原 Y 之前** —— 视觉上 group 顶替最顶
 *     成员 B 的 z 层级,不遮 Y。
 *
 * 直接用 `insertChild(maxMemberIndex, group)` **错**:
 *   maxMemberIndex=2 对应**收缩前**的位置,收缩后长度只有 3,index=2 = 末尾 = 最顶,
 *   Y 被挤到 index=1,反而遮住了原本最顶的 Y。
 *
 * ## 正确公式
 *
 * **收缩后 group 位置 = 原父中"位置 ≤ maxMemberIndex 的非成员数"**。
 *
 * 举例:原 [X, A, B, Y],max=2(B)。位置 ≤ 2 的非成员 = X = 1 个 → group index=1
 *   → 结果 [X, group, Y] ✓ group 顶替 B 的 z 层,Y 依然在最顶。
 *
 * ## 为什么选 max 而不是 min
 *
 * Figma Plugin API:`children[0]` = 最底(先绘制),`children[last]` = 最顶。
 * 用 max(最顶成员原位置)让 group 继承"最顶那个成员"的 z 层。因为合并成员通常包含
 * 一个"最上层"的关键视觉(如高亮、文字、图标),其它成员是它的背景;group 落在最顶
 * 成员位置,能让原本压在成员**上方**的兄弟依然在 group 之上,不被遮挡。
 */
function moveGroupToBottomMemberPosition(
  group: GroupNode | FrameNode,
  memberIds: string[],
  preMergeParentOrder: Map<string, number>,
): void {
  const parent = group.parent;
  if (!parent || !('insertChild' in parent)) return;

  // 1. 找最顶成员的原 index
  let maxMemberIndex = -Infinity;
  const memberSet = new Set(memberIds);
  for (const id of memberIds) {
    const idx = preMergeParentOrder.get(id);
    if (typeof idx === 'number' && idx > maxMemberIndex) maxMemberIndex = idx;
  }
  if (!isFinite(maxMemberIndex)) return;

  // 2. 统计"原父中位置 ≤ maxMemberIndex 的非成员数" —— 这就是收缩后 group 应该在的 index
  let nonMemberCountUpToMax = 0;
  for (const [id, idx] of preMergeParentOrder) {
    if (idx <= maxMemberIndex && !memberSet.has(id)) {
      nonMemberCountUpToMax += 1;
    }
  }

  // 3. 收缩后 parent.children 里 group 的目标 index
  const targetIndex = Math.min(nonMemberCountUpToMax, parent.children.length - 1);

  try {
    (parent as ChildrenMixin & { insertChild: (i: number, n: SceneNode) => void }).insertChild(
      Math.max(0, targetIndex),
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

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 作用域 + 亲密度 合并核心(scope + intimacy)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 老算法(DSU 一次传染)的失败根因:
 *   - 同父下所有满足 edge 的元素被并成一大簇 → 大背景 + 独立卡片一坨扁平合
 *   - 或超上限整簇丢 → 该合的也不合
 *   - 无法区分"卡内亲密"和"跨卡冒进"
 *
 * 新算法思路:
 *   Step 1:构建**包含森林** —— 每个 X 的"作用域父" = 严格包含 X 的最小容器
 *          (与谁 bbox 完全包住 X,谁就是它的作用域父)
 *   Step 2:每个**内部节点**(有 ≥ 2 个严格子)= 一个**合并作用域**
 *          作用域内的成员**只跟同作用域的成员比较亲密度**,不会跟别的作用域串
 *          → 解决"第一个 C 和第二个 C 误合"的问题
 *   Step 3:在每个作用域内跑**亲密度贪心**:
 *          - 相交(overlap ratio ≥ 阈值)→ intimacy = ratio + 1 (1.0..2.0)
 *          - 相邻(bbox gap ≤ 阈值)     → intimacy = (阈值 - gap) / 阈值 (0..1)
 *          - 都不满足 → 无边,不合
 *          挑最紧的对合成 pair,新 pair 加回作用域池继续,直到无对
 *   Step 4:作用域顶层容器**本身不参与合并**(它已经是自然的语义容器)
 *   Step 5:不属于任何作用域的顶层候选(比如你贴的"顶部 C" 只与 X 部分相交、
 *          不被 X 严格包含),保持独立,不合
 */

interface Cand {
  node: SceneNode;
  box: BBox;
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
  if (sessionGroupIds.has(node.id) && !sessionSubGroupIds.has(node.id)) return true;
  if (sessionSubGroupIds.has(node.id)) return false;
  if (hasSettledPrefix(node.name)) return false;
  return true;
}

/** 边策略:决定两个候选算不算"应该合",以及"多亲密"。 */
interface EdgePolicy {
  /** 判"两节点是否有边"。 */
  edge(a: Cand, b: Cand): boolean;
  /** 亲密度:越大越紧。 */
  intimacy(a: Cand, b: Cand): number;
}

/** 严格包含:X 完全在 Y 里,且 X 面积 < Y 面积。 */
function isContainedIn(x: BBox, y: BBox, threshold = 0.9): boolean {
  const ox = Math.max(0, Math.min(x.x + x.width, y.x + y.width) - Math.max(x.x, y.x));
  const oy = Math.max(0, Math.min(x.y + x.height, y.y + y.height) - Math.max(x.y, y.y));
  const overlap = ox * oy;
  if (overlap <= 0) return false;
  const areaX = Math.max(1, x.width * x.height);
  const areaY = Math.max(1, y.width * y.height);
  if (areaX >= areaY) return false;
  return overlap / areaX >= threshold;
}

/**
 * 构建作用域森林。
 * 输入:同一 parent 下的所有候选 pool。
 * 输出:parentIdx[i] = 严格包含 cands[i] 的最小容器在 pool 里的下标(-1 = 无容器)
 */
function buildScopeForest(pool: Cand[], containmentThreshold: number): number[] {
  const n = pool.length;
  const parentIdx: number[] = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let bestP = -1;
    let bestArea = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (isContainedIn(pool[i].box, pool[j].box, containmentThreshold)) {
        const areaJ = pool[j].box.width * pool[j].box.height;
        if (areaJ < bestArea) {
          bestArea = areaJ;
          bestP = j;
        }
      }
    }
    parentIdx[i] = bestP;
  }
  return parentIdx;
}

/**
 * 在作用域内跑"簇聚合"合并(方向 B:消灭两两 pair 套娃)。
 *
 * 输入:作用域内的初始成员 scopeMembers + edge policy(相交 / 相邻 / …)。
 *
 * 做法:
 *   1. 用 policy.edge 建无向图,跑 DSU/BFS 得到**连通分量**(不用亲密度选谁先合;
 *      亲密度只用于"要不要建边"和"给用户的诊断读数")。
 *   2. 每个 size ≥ 2 的分量 —— **一次性** `figma.group(所有成员, parent)` 成扁平 group,
 *      不再两两 pair。既避免嵌套套娃,也避免 pair 后 bbox 膨胀传染。
 *   3. 分量内亲密度平均值可用于调试,不影响是否合。
 *
 * 返回本作用域产生的所有 group 列表。
 */
function mergeInScope(
  parent: SceneNode & ChildrenMixin,
  scopeMembers: Cand[],
  policy: EdgePolicy,
  mergedSignatures: Set<string>,
): SceneNode[] {
  const n = scopeMembers.length;
  if (n < 2) return [];

  // 1. DSU 建连通分量:边 = policy.edge 判定
  const dsu: number[] = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (dsu[x] !== x) {
      dsu[x] = dsu[dsu[x]];
      x = dsu[x];
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) dsu[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (policy.edge(scopeMembers[i], scopeMembers[j])) union(i, j);
    }
  }

  // 2. 分组:root → 成员下标列表
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r)!.push(i);
  }

  // 3. 每个 size ≥ 2 的簇一次性合
  const newGroups: SceneNode[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    const nodes = idxs.map((i) => scopeMembers[i].node);
    // 全部节点都必须还在 parent 里(可能上一轮已被吸收);过滤掉
    const alive = nodes.filter((n) => !n.removed && n.parent && n.parent.id === parent.id);
    if (alive.length < 2) continue;
    // 签名去重:同一批成员集不重复合(防止 session 产物内部自指套娃)
    const sig = membersSignature(alive);
    if (mergedSignatures.has(sig)) continue;
    const preOrder = snapshotParentOrder(parent);
    try {
      const g = figma.group(alive, parent);
      if (g.children.length < 2) {
        try { g.remove(); } catch { /* ignore */ }
        continue;
      }
      mergedSignatures.add(sig);
      preserveOriginalZOrder(g, preOrder);
      moveGroupToBottomMemberPosition(g, alive.map((n) => n.id), preOrder);
      newGroups.push(g);
    } catch {
      /* 边界:节点已被上层吸收 / API 拒绝,跳过 */
    }
  }

  return newGroups;
}

/**
 * 阶段 O 专用:一次性 N 元合(方向 A:大背景 + 兄弟小元素合并)。
 *
 * 语义:找到"容器候选"C(严格包含 ≥ 2 个兄弟,或与 ≥ 2 个兄弟相交),
 * 一次性把 C + 所有被它包含 / 与它相交的兄弟合成一组。**不走两两 pair,
 * 不走作用域框架,不排除容器自己**。
 *
 * 挑选策略:选**受众最多**的候选(严格包含 + 相交的兄弟数最大)作为本轮 anchor;
 * 一轮只处理一个 anchor,剩下的靠 for round 迭代继续。
 */
function mergeInContainerByAnchor(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  overlapThreshold: number,
  containmentThreshold: number,
  mergedSignatures: Set<string>,
): SceneNode[] {
  const n = cands.length;
  if (n < 2) return [];

  // 对每个候选,统计"被它严格包含 或 与它显著相交"的其它候选下标
  const receivers: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      // j 被 i 严格包含
      if (isContainedIn(cands[j].box, cands[i].box, containmentThreshold)) {
        receivers[i].push(j);
        continue;
      }
      // 或者 i 与 j 显著相交(且面积相近,不属于严格包含关系)
      if (bboxOverlapRatio(cands[i].box, cands[j].box) >= overlapThreshold) {
        // 排除已经作为严格包含加入的
        if (!receivers[i].includes(j)) receivers[i].push(j);
      }
    }
  }

  // 挑受众最多的 anchor
  let anchor = -1;
  let bestCount = 1; // 至少要吸引 2 个兄弟(anchor + 2 members = size 3),避免琐碎合并
  for (let i = 0; i < n; i++) {
    if (receivers[i].length > bestCount) {
      bestCount = receivers[i].length;
      anchor = i;
    }
  }
  if (anchor < 0) return [];

  const memberIdx = new Set<number>([anchor, ...receivers[anchor]]);
  const members = Array.from(memberIdx).map((i) => cands[i].node);
  const alive = members.filter((n) => !n.removed && n.parent && n.parent.id === parent.id);
  if (alive.length < 2) return [];

  // 签名去重:同一批成员集不重复合
  const sig = membersSignature(alive);
  if (mergedSignatures.has(sig)) return [];

  const preOrder = snapshotParentOrder(parent);
  try {
    const g = figma.group(alive, parent);
    if (g.children.length < 2) {
      try { g.remove(); } catch { /* ignore */ }
      return [];
    }
    mergedSignatures.add(sig);
    preserveOriginalZOrder(g, preOrder);
    moveGroupToBottomMemberPosition(g, alive.map((n) => n.id), preOrder);
    return [g];
  } catch {
    return [];
  }
}

function snapshotParentOrder(parent: SceneNode & ChildrenMixin): Map<string, number> {
  const m = new Map<string, number>();
  parent.children.forEach((c, idx) => m.set(c.id, idx));
  return m;
}

/**
 * 成员集签名:排序后的 id 用 | 拼接。用来在 session 级别去重"同一批成员再包一层"这种
 * 自指套娃 —— 上一轮已经把 [BG, A, B, C] 合成 G,下一轮 visit(G) 时 G.children 仍是
 * [BG, A, B, C],anchor / 簇条件再次满足;签名一查 → 拒绝,收敛。
 *
 * 允许"成员集不同的合并"进入(比如 G 内部还有更细的子孙可细分),因此比"session 产物
 * 内部不管"的粗暴 gate 保留了合并力度。
 */
function membersSignature(nodes: SceneNode[]): string {
  return nodes.map((n) => n.id).sort().join('|');
}

/**
 * 一轮"作用域 + 亲密度"合并的调度器:
 *   1. 构建包含森林
 *   2. 对每个"内部节点"(严格子 ≥ 2)—— 作为一个作用域,在其严格子集上跑 mergeInScope
 *   3. 顶层"孤儿"(不被任何人严格包含的候选)也算一个作用域,跑一遍 mergeInScope
 *
 * 注意:作用域**容器本身**不参与合并;只合它的严格子们。
 *      如果一个候选既是别人的严格子,也是别人的作用域容器,它仍然可能作为**它的作用域父**的成员参与合并
 *      —— 这自然形成"洋葱"层级(内层作用域先合,外层作用域再拿内层作用域的容器当成员合)。
 *      但这里做**一轮**只处理一层作用域;上层由外层 for round 迭代自然接手。
 */
function mergeByScopeAndIntimacy(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  policy: EdgePolicy,
  containmentThreshold: number,
  mergedSignatures: Set<string>,
): SceneNode[] {
  if (cands.length < 2) return [];
  const n = cands.length;
  const parentIdx = buildScopeForest(cands, containmentThreshold);
  const childrenOf: number[][] = Array.from({ length: n }, () => []);
  const roots: number[] = [];
  for (let i = 0; i < n; i++) {
    if (parentIdx[i] >= 0) childrenOf[parentIdx[i]].push(i);
    else roots.push(i);
  }

  const newGroups: SceneNode[] = [];

  for (let i = 0; i < n; i++) {
    const kids = childrenOf[i];
    if (kids.length < 2) continue;
    const isLeafScope = kids.every((c) => childrenOf[c].length === 0);
    if (!isLeafScope) continue;
    const members = kids.map((k) => cands[k]);
    const groups = mergeInScope(parent, members, policy, mergedSignatures);
    newGroups.push(...groups);
  }

  const orphans = roots
    .filter((i) => childrenOf[i].length === 0)
    .map((i) => cands[i]);
  if (orphans.length >= 2) {
    const groups = mergeInScope(parent, orphans, policy, mergedSignatures);
    newGroups.push(...groups);
  }

  return newGroups;
}

/**
 * 阶段 O(overlap 主导)的边策略:只有相交才有边;亲密度 = overlap ratio。
 */
function overlapPolicy(overlapThreshold: number): EdgePolicy {
  return {
    edge: (a, b) => bboxOverlapRatio(a.box, b.box) >= overlapThreshold,
    intimacy: (a, b) => bboxOverlapRatio(a.box, b.box) + 1, // 1.0 ~ 2.0 高于 gap 亲密度
  };
}

/**
 * 阶段 A/B(gap 主导)的边策略:相交或相邻都有边;亲密度分档 —— 相交 > 相邻。
 * 相交场景仍然让 overlap 主导(比如 A ⊂ B 的紧密视觉包含),但也允许 gap 邻近的合。
 */
function gapPolicy(gap: number, overlapThreshold: number): EdgePolicy {
  return {
    edge: (a, b) => {
      if (bboxOverlapRatio(a.box, b.box) >= overlapThreshold) return true;
      return bboxGap(a.box, b.box) <= gap;
    },
    intimacy: (a, b) => {
      const r = bboxOverlapRatio(a.box, b.box);
      if (r >= overlapThreshold) return r + 1; // 1.0 ~ 2.0
      const g = bboxGap(a.box, b.box);
      return Math.max(0, (gap - g) / Math.max(1, gap)); // 0 ~ 1
    },
  };
}

/**
 * 阶段 O 的簇聚合入口(方向 A):不走作用域框架,直接用 anchor 一次性 N 元合。
 * 目标:大背景 + 上面一堆小元素合成一组。
 */
function mergeInContainerByOverlap(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  overlapThreshold: number,
  _maxClusterSize: number,
  mergedSignatures: Set<string>,
): SceneNode[] {
  return mergeInContainerByAnchor(parent, cands, overlapThreshold, 0.9, mergedSignatures);
}

/**
 * 阶段 A/B 的簇聚合入口:使用作用域 + gap policy。
 */
function mergeInContainer(
  parent: SceneNode & ChildrenMixin,
  cands: Cand[],
  gap: number,
  _maxClusterSize: number,
  _prefix: 'img-' | 'sub-',
  _namer: () => string,
  mergedSignatures: Set<string>,
): SceneNode[] {
  const overlapThreshold = 0.3;
  return mergeByScopeAndIntimacy(parent, cands, gapPolicy(gap, overlapThreshold), 0.9, mergedSignatures);
}

/**
 * 阶段 O 的一轮遍历:postorder,对每个容器做作用域 + overlap 合并。
 * @param rootIds 遍历起点;缺省 = 整页所有顶层 frame。
 */
async function walkOnceOverlap(
  overlapThreshold: number,
  maxClusterSize: number,
  sessionGroupIds: Set<string>,
  mergedSignatures: Set<string>,
  rootIds?: string[],
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

    const newGroups = mergeInContainerByOverlap(node, cands, overlapThreshold, maxClusterSize, mergedSignatures);
    for (const g of newGroups) sessionGroupIds.add(g.id);
    merged += newGroups.length;
  }

  const roots = rootIds && rootIds.length > 0 ? rootIds : figma.currentPage.children.map((c) => c.id);
  for (const r of roots) await visit(r, 0);
  return merged;
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
  mergedSignatures: Set<string>,
  extraGroupIds?: Set<string>,
  rootIds?: string[],
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

    const newGroups = mergeInContainer(node, cands, gap, maxClusterSize, prefix, namer, mergedSignatures);
    for (const g of newGroups) {
      sessionGroupIds.add(g.id);
      if (extraGroupIds) extraGroupIds.add(g.id);
    }
    merged += newGroups.length;
  }

  const roots = rootIds && rootIds.length > 0 ? rootIds : figma.currentPage.children.map((c) => c.id);
  for (const r of roots) await visit(r, 0);
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
  const mergedSignatures = new Set<string>();
  const rootIds = opts.rootIds && opts.rootIds.length > 0 ? opts.rootIds : undefined;
  let seqA = 0;
  let seqB = 0;
  let stoppedByLimit: 'O' | 'A' | 'B' | null = null;

  // 阶段 O:相交合并(先跑,让大背景和它上面的小元素成组)
  let oGroups = 0;
  let oRounds = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const merged = await walkOnceOverlap(overlapThreshold, maxClusterSize, sessionGroupIds, mergedSignatures, rootIds);
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
      mergedSignatures,
      undefined,
      rootIds,
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
      mergedSignatures,
      sessionSubGroupIds,
      rootIds,
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
