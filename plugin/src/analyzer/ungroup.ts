/**
 * 拆分选中节点(ungroup)。
 *
 * 规则:
 * - 只拆 **GROUP** → 走 figma.ungroup(),原生 API 保持 z 顺序
 * - **FRAME / COMPONENT / INSTANCE / COMPONENT_SET / 其他类型都跳过**,归到 skippedNonGroup
 *   (FRAME 含 autolayout 结构上不同,不拆;Instance / Component 拆会解绑主件)
 * - 锁定节点跳过
 * - **浅拆(deep=false)**:只拆传入的这些节点一层,里面的子 group 保留
 * - **深拆(deep=true,默认)**:递归拆到没有 GROUP 为止(FRAME / INSTANCE / COMPONENT 不拆)
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
      // 释放出来的节点里若还有 GROUP,继续拆;FRAME/INSTANCE/... 一律不动
      for (const child of released) {
        if (child.removed) continue;
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
