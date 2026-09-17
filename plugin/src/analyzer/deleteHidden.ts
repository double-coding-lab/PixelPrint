/**
 * 一键清理:递归删除设计稿里不该进 D2C 的辅助元素。
 *
 * 三类目标(顶层 PAGE 不动,从 currentPage.children 开始):
 * 1. **隐藏节点**(visible=false):设计师故意藏起来的备份/未启用状态
 * 2. **Slice 节点**(type=SLICE):Figma 切图辅助,不产 DOM
 *
 * 边界:
 * - 锁定节点跳过(可能故意锁着不让 D2C 动)
 * - INSTANCE 内部不下钻(避免解绑主件),但 INSTANCE 本身若被隐藏也会被删
 * - `figma.remove()` 递归删子孙,不用手动逐层删
 */

export interface DeleteHiddenResult {
  deleted: number;
  /** 明细:隐藏节点删了几个 */
  deletedHidden: number;
  /** 明细:slice 删了几个 */
  deletedSlice: number;
  skippedLocked: number;
  skippedInstance: number;
}

export async function deleteHiddenNodes(rootIds?: string[]): Promise<DeleteHiddenResult> {
  let deletedHidden = 0;
  let deletedSlice = 0;
  let skippedLocked = 0;
  let skippedInstance = 0;

  function isLocked(node: SceneNode): boolean {
    return 'locked' in node && (node as SceneNode & { locked: boolean }).locked;
  }

  async function visit(node: SceneNode): Promise<void> {
    // 1) Slice:类型判定优先于隐藏(slice 也可能是可见的)
    if (node.type === 'SLICE') {
      if (isLocked(node)) {
        skippedLocked += 1;
        return;
      }
      try {
        node.remove();
        deletedSlice += 1;
      } catch {
        /* ignore */
      }
      return;
    }

    // 2) INSTANCE:不下钻,只判它自己是否隐藏
    if (node.type === 'INSTANCE') {
      if (node.visible === false) {
        if (isLocked(node)) {
          skippedLocked += 1;
          return;
        }
        try {
          node.remove();
          deletedHidden += 1;
        } catch {
          skippedInstance += 1;
        }
      }
      return;
    }

    // 3) 隐藏节点
    if (node.visible === false) {
      if (isLocked(node)) {
        skippedLocked += 1;
        return;
      }
      try {
        node.remove();
        deletedHidden += 1;
      } catch {
        /* ignore */
      }
      return;
    }

    // 4) 可见非 Slice,深入子层
    if ('children' in node) {
      // 先复制 children 列表:递归里 remove 会改动 parent.children,直接迭代会跳
      const kids = [...node.children];
      for (const c of kids) await visit(c);
    }
  }

  // 起点:rootIds 非空则用它,否则整页顶层
  if (rootIds && rootIds.length > 0) {
    for (const id of rootIds) {
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
      if (!node || node.removed) continue;
      await visit(node);
    }
  } else {
    const roots = [...figma.currentPage.children];
    for (const r of roots) await visit(r);
  }

  return {
    deleted: deletedHidden + deletedSlice,
    deletedHidden,
    deletedSlice,
    skippedLocked,
    skippedInstance,
  };
}
