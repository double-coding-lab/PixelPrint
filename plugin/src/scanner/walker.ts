/**
 * 深度优先遍历工具。
 *
 * v0.2 全量树模式:
 * - 递归所有 SceneNode(含 TEXT / VECTOR / LINE 等叶子)
 * - Instance 不下钻(避免解绑主件的隐式副作用)
 * - x- 前缀子树 **也下钻**(以便 UI 树完整;打标时 candidate 层自己会过滤)
 * - shouldGenerateCandidate 仅决定"能否被打前缀 / 加 autolayout",不决定树是否收录
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

    // Instance 不下钻(仍然避免解绑主件)
    if (node.type === 'INSTANCE') return;

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
