/**
 * 合并当前 Figma 选中节点:把它们包在一个新的父 FRAME 里,并加指定前缀。
 *
 * 规则:
 * - 选中节点必须 ≥ 2 且属于同一个父(不同父无法直接 group)
 * - Instance / 锁定节点跳过
 * - 生成的父 frame 使用 figma.group() → 转 frame(保留 auto layout 语义空间)
 *
 * 前缀命名:
 *   img-<nameHint | image-01>
 *   sub-<nameHint | card-01>
 *   bg-<nameHint | background-01>
 */
import type { MergeResult } from '../types';

const DEFAULT_NAME: Record<'img-' | 'sub-' | 'bg-', string> = {
  'img-': 'image',
  'sub-': 'card',
  'bg-': 'background',
};

export async function mergeSelectedNodes(
  prefix: 'img-' | 'sub-' | 'bg-',
  nameHint?: string,
): Promise<MergeResult> {
  const selection = figma.currentPage.selection;
  if (selection.length < 2) {
    return { success: false, message: '请先在 Figma 画布上 Cmd+click 选中至少 2 个节点' };
  }
  return mergeNodeArray(selection as SceneNode[], prefix, nameHint);
}

/**
 * 合并给定 nodeId 列表(用于"建议一键合并",不依赖 Figma 当前选中)。
 * 会先把 currentPage.selection 设成这些节点,便于回滚。
 */
export async function mergeNodesByIds(
  nodeIds: string[],
  prefix: 'img-' | 'sub-' | 'bg-',
  nameHint?: string,
): Promise<MergeResult> {
  const nodes: SceneNode[] = [];
  const missing: string[] = [];
  for (const id of nodeIds) {
    const n = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
    if (!n) {
      missing.push(id);
      continue;
    }
    nodes.push(n);
  }
  if (missing.length > 0) {
    return { success: false, message: `找不到节点:${missing.join(', ')}(可能已被删除,请 Scan 刷新)` };
  }
  if (nodes.length < 2) {
    return { success: false, message: '合并至少需要 2 个节点' };
  }
  // 先高亮到画布,若失败用户能看见改前状态
  try {
    figma.currentPage.selection = nodes;
  } catch {
    /* ignore */
  }
  return mergeNodeArray(nodes, prefix, nameHint);
}

async function mergeNodeArray(
  selection: SceneNode[],
  prefix: 'img-' | 'sub-' | 'bg-',
  nameHint?: string,
): Promise<MergeResult> {
  // 过滤锁定 / instance
  const invalid: string[] = [];
  for (const node of selection) {
    if ('locked' in node && (node as SceneNode & { locked: boolean }).locked) {
      invalid.push(`${node.name}(已锁定)`);
    }
  }
  if (invalid.length > 0) {
    return {
      success: false,
      message: `以下节点无法合并:${invalid.join('、')};请先在 Figma 中解锁再试`,
    };
  }

  // 检查是否同父
  const parent = selection[0].parent;
  if (!parent) {
    return { success: false, message: '选中节点的父不存在,无法合并' };
  }
  for (const node of selection) {
    if (node.parent !== parent) {
      return {
        success: false,
        message: '选中节点分属不同父层,无法直接合并;请先把它们移到同一个父层再合并',
      };
    }
  }

  // 用 figma.group() 把选中节点包成 GROUP
  let group: GroupNode;
  try {
    group = figma.group(selection, parent);
  } catch (err) {
    return {
      success: false,
      message: `Figma group 失败:${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 起名
  const typeWord = nameHint && nameHint.length > 0 ? nameHint : `${DEFAULT_NAME[prefix]}-01`;
  const newName = `${prefix}${typeWord}`;
  group.name = newName;

  // 选中新 group,方便用户看到结果
  figma.currentPage.selection = [group];
  figma.viewport.scrollAndZoomIntoView([group]);

  return {
    success: true,
    newNodeId: group.id,
    newNodeName: newName,
  };
}
