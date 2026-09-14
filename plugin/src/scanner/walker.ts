/**
 * 深度优先遍历工具。
 *
 * 边界:
 * - 不递归进 Instance(避免解绑主件)
 * - 不递归进 x- 前缀子树
 * - 只对 FRAME/GROUP/COMPONENT/COMPONENT_SET/RECTANGLE 生成候选
 * - TEXT / VECTOR / LINE / ELLIPSE 等叶子跳过(不打前缀)
 */

export type NodeVisitor = (
  node: SceneNode,
  path: string[],
) => 'continue' | 'skip' | 'stop';

const CANDIDATE_TYPES = new Set<NodeType>([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'INSTANCE',
  'COMPONENT_SET',
  'RECTANGLE',
]);

export function shouldGenerateCandidate(node: SceneNode): boolean {
  return CANDIDATE_TYPES.has(node.type);
}

export function isExistingXPrefix(name: string): boolean {
  return name.startsWith('x-');
}

export async function walk(
  roots: ReadonlyArray<SceneNode>,
  visitor: NodeVisitor,
  onProgress?: (scanned: number) => void,
  yieldEveryN = 20,
): Promise<number> {
  let scanned = 0;
  let stopFlag = false;

  async function visit(node: SceneNode, path: string[]): Promise<void> {
    if (stopFlag) return;
    scanned += 1;
    if (onProgress && scanned % yieldEveryN === 0) {
      onProgress(scanned);
      // 让出主线程
      await new Promise((r) => setTimeout(r, 0));
    }

    const action = visitor(node, path);
    if (action === 'stop') {
      stopFlag = true;
      return;
    }
    if (action === 'skip') return;

    // Instance 不下钻
    if (node.type === 'INSTANCE') return;
    // x- 前缀子树不下钻
    if (isExistingXPrefix(node.name)) return;

    if ('children' in node) {
      const children = node.children;
      for (const c of children) {
        await visit(c, [...path, c.name]);
        if (stopFlag) return;
      }
    }
  }

  for (const root of roots) {
    if (stopFlag) break;
    await visit(root, [root.name]);
  }

  if (onProgress) onProgress(scanned);
  return scanned;
}

export function nodePath(node: SceneNode): string {
  const parts: string[] = [];
  let cur: BaseNode | null = node;
  let depth = 0;
  while (cur && depth < 20) {
    if (cur.type === 'PAGE') {
      parts.unshift(cur.name);
      break;
    }
    if ('name' in cur) parts.unshift(cur.name);
    cur = cur.parent;
    depth += 1;
  }
  return parts.join(' > ');
}
