/**
 * 视觉分组建议(纯代码,不依赖 AI):
 *
 * 目标:找出图层里"视觉上贴在一起、明显应该合并成一个 img- 组"的**图片类叶子**簇。
 *
 * 规则:
 * 1. 遍历所有容器(FRAME/GROUP/COMPONENT/COMPONENT_SET),postorder 从内到外
 * 2. 对每个容器的**直接子节点**筛出"图片类叶子":
 *    - IMAGE fill 的 RECTANGLE / ELLIPSE
 *    - VECTOR / STAR / POLYGON / BOOLEAN_OPERATION
 *    - 且尺寸 ≤ MAX_ITEM_SIZE(排除大背景图)
 * 3. 用并查集把"紧邻"的图片类叶子并成簇(bbox 边距离 ≤ CLOSE_GAP)
 * 4. 每个 size ≥ MIN_CLUSTER 的簇输出一条 merge 建议
 * 5. 容器本身已被推荐 img-(见 imageParent.ts)则跳过(避免和父层建议重复)
 * 6. 容器只有一个 img 类叶子群 = 全部子节点几乎都是 → 交给 imageParent,本文件不推
 *
 * 之所以"从内到外":Figma 组件复用场景下,内层紧凑的小图标组往往先该被识别为一整块 img-,
 * 才轮到考虑外层大容器。postorder 保证内层簇先被 emit,UI 呈现和用户思路一致。
 */

const CLOSE_GAP = 12;             // 邻近阈值(bbox 边到边像素)
const MIN_CLUSTER = 2;            // 簇最少 2 个节点
const MAX_ITEM_SIZE = 300;        // 单个叶子最大尺寸(px);超过视为大图,不进簇
const MAX_CLUSTER_SIZE = 12;      // 簇最多 12 个节点(避免一整个大列表被识别为一组)
const HARD_MAX_DEPTH = 20;

const IMAGE_LEAF_TYPES = new Set<NodeType>([
  'VECTOR',
  'STAR',
  'POLYGON',
  'BOOLEAN_OPERATION',
]);

const CONTAINER_TYPES = new Set<NodeType>([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'COMPONENT_SET',
]);

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 节点是不是"图片类叶子"(值得进簇的那种)。 */
function isImageLeaf(node: SceneNode): boolean {
  if (IMAGE_LEAF_TYPES.has(node.type)) return true;
  if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
    const fills = 'fills' in node ? node.fills : null;
    if (fills && fills !== figma.mixed && Array.isArray(fills)) {
      return fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
    }
  }
  return false;
}

function bboxOf(node: SceneNode): BBox | null {
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    return node.absoluteBoundingBox;
  }
  return null;
}

/** 两个 bbox 的最短边距离(负数视作重叠,取 0)。 */
function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.max(dx, dy);
}

/** 已有 img-/bg-/bgc-/x- 或已被父级 img- 覆盖的场景跳过。 */
function hasSettledPrefix(name: string): boolean {
  return (
    name.startsWith('img-') ||
    name.startsWith('bg-') ||
    name.startsWith('bgc-') ||
    name.startsWith('x-') ||
    name.startsWith('sub-')
  );
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

export interface GroupSuggestion {
  parentId: string;
  parentName: string;
  memberIds: string[];
  gapMax: number;
  /** 是否所有成员都是 VECTOR / IMAGE fill,而不是纯几何形。 */
  allImageish: boolean;
}

/**
 * 对给定 rootIds 产出视觉分组建议。
 */
export async function detectVisualGroups(
  rootIds: string[],
): Promise<GroupSuggestion[]> {
  const out: GroupSuggestion[] = [];
  const seen = new Set<string>();

  async function walk(nodeId: string, depth: number): Promise<void> {
    if (depth >= HARD_MAX_DEPTH) return;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node) return;
    if (node.visible === false) return;

    // postorder:先下钻(内层簇先 emit)
    if ('children' in node && node.type !== 'INSTANCE') {
      for (const c of node.children) await walk(c.id, depth + 1);
    }

    // 只在容器上做簇检测
    if (!CONTAINER_TYPES.has(node.type)) return;
    if (!('children' in node)) return;

    // 收集直接子里"合格"的图片类叶子
    const cands: Array<{ id: string; name: string; box: BBox }> = [];
    for (const c of node.children) {
      if (c.visible === false) continue;
      if (hasSettledPrefix(c.name)) continue;
      if (!isImageLeaf(c)) continue;
      const bb = bboxOf(c);
      if (!bb) continue;
      if (bb.width > MAX_ITEM_SIZE || bb.height > MAX_ITEM_SIZE) continue;
      cands.push({ id: c.id, name: c.name, box: bb });
    }
    if (cands.length < MIN_CLUSTER) return;

    // 并查集:两两 gap ≤ CLOSE_GAP 合并
    const dsu = new DSU(cands.length);
    let anyGap = 0;
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const g = bboxGap(cands[i].box, cands[j].box);
        if (g <= CLOSE_GAP) {
          dsu.union(i, j);
          if (g > anyGap) anyGap = g;
        }
      }
    }

    // 归类
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < cands.length; i++) {
      const r = dsu.find(i);
      const arr = clusters.get(r) || [];
      arr.push(i);
      clusters.set(r, arr);
    }

    for (const idxs of clusters.values()) {
      if (idxs.length < MIN_CLUSTER) continue;
      if (idxs.length > MAX_CLUSTER_SIZE) continue;
      // 计算簇内最大 gap 作为置信度参考
      let maxGap = 0;
      for (let i = 0; i < idxs.length; i++) {
        for (let j = i + 1; j < idxs.length; j++) {
          const g = bboxGap(cands[idxs[i]].box, cands[idxs[j]].box);
          if (g > maxGap && g <= CLOSE_GAP * 3) maxGap = g;
        }
      }
      out.push({
        parentId: node.id,
        parentName: node.name,
        memberIds: idxs.map((i) => cands[i].id),
        gapMax: maxGap,
        allImageish: true, // 由 isImageLeaf 保证
      });
    }
  }

  for (const rid of rootIds) await walk(rid, 0);
  return out;
}
