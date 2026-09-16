/**
 * 拆分选中节点(ungroup)。
 *
 * 规则:
 * - 只拆 GROUP;FRAME/COMPONENT/COMPONENT_SET 结构上不同,不能 ungroup(会明确报错)
 * - 锁定节点跳过
 * - Instance 内部不拆(会解绑主件)
 * - **浅拆(deep=false,默认)**:只拆传入的这些节点一层,里面的子 group 保留
 * - **深拆(deep=true)**:递归拆到没有 GROUP 为止(可能一路拆穿,慎用)
 */

export interface UngroupOptions {
  deep?: boolean;
}

export interface UngroupResult {
  ungrouped: number;
  releasedNodes: number;
  skippedNonGroup: number;
  skippedLocked: number;
  errors: string[];
}

async function ungroupOne(
  node: SceneNode,
  result: UngroupResult,
  deep: boolean,
): Promise<SceneNode[]> {
  if ('locked' in node && (node as SceneNode & { locked: boolean }).locked) {
    result.skippedLocked += 1;
    return [];
  }
  if (node.type !== 'GROUP') {
    result.skippedNonGroup += 1;
    return [];
  }
  try {
    const released = figma.ungroup(node);
    result.ungrouped += 1;
    result.releasedNodes += released.length;
    if (deep) {
      // 释放出来的节点里若还有 GROUP,继续拆
      for (const child of released) {
        if (child.type === 'GROUP') {
          await ungroupOne(child, result, true);
        }
      }
    }
    return released as SceneNode[];
  } catch (err) {
    result.errors.push(
      `${node.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

export async function ungroupNodes(
  nodeIds: string[],
  opts: UngroupOptions = {},
): Promise<UngroupResult> {
  const deep = opts.deep === true;
  const result: UngroupResult = {
    ungrouped: 0,
    releasedNodes: 0,
    skippedNonGroup: 0,
    skippedLocked: 0,
    errors: [],
  };

  for (const id of nodeIds) {
    const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
    if (!node) {
      result.errors.push(`节点 ${id} 不存在`);
      continue;
    }
    await ungroupOne(node, result, deep);
  }

  return result;
}
