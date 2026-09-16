import * as React from 'react';
import type { TreeNode } from '../../types';

interface Props {
  tree: TreeNode[];
  rootIds: string[];
  checked: Set<string>;
  selectedIds: Set<string>; // 面板高亮(可能是画布同步来的)
  onSelect: (id: string, additive: boolean) => void;
  onToggleCheck: (id: string) => void;
  onFocusNode: (id: string) => void;
  /** 需要滚动到视野中央的节点 id(通常来自画布 selection 联动)。 */
  scrollToId?: string | null;
}

const ROW_HEIGHT = 26;
const INDENT_PER_LEVEL = 14;
const VIEWPORT_BUFFER = 8;

interface Row {
  node: TreeNode;
  visualDepth: number;
}

function flattenTree(
  tree: TreeNode[],
  rootIds: string[],
  expanded: Set<string>,
): Row[] {
  const byId = new Map<string, TreeNode>();
  for (const n of tree) byId.set(n.id, n);

  const rows: Row[] = [];

  function walkNode(id: string, visualDepth: number): void {
    const node = byId.get(id);
    if (!node) return;
    rows.push({ node, visualDepth });
    if (expanded.has(id) && node.childrenIds.length > 0) {
      for (const cid of node.childrenIds) {
        if (byId.has(cid)) walkNode(cid, visualDepth + 1);
      }
    }
  }

  for (const rid of rootIds) walkNode(rid, 0);
  return rows;
}

export function TreeView({
  tree,
  rootIds,
  checked,
  selectedIds,
  onSelect,
  onToggleCheck,
  onFocusNode,
  scrollToId,
}: Props) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    const byId = new Map(tree.map((n) => [n.id, n]));
    for (const rid of rootIds) {
      s.add(rid);
      const root = byId.get(rid);
      if (root) for (const cid of root.childrenIds) if (byId.has(cid)) s.add(cid);
    }
    return s;
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(500);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = React.useMemo(
    () => flattenTree(tree, rootIds, expanded),
    [tree, rootIds, expanded],
  );

  // 画布选中节点自动展开父链 + 滚动到视野
  React.useEffect(() => {
    if (!scrollToId) return;
    const byId = new Map(tree.map((n) => [n.id, n]));
    const target = byId.get(scrollToId);
    if (!target) return;
    // 展开所有祖先
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur: TreeNode | undefined = target;
      let depth = 0;
      while (cur && cur.parentId && depth < 30) {
        next.add(cur.parentId);
        cur = byId.get(cur.parentId);
        depth += 1;
      }
      return next;
    });
  }, [scrollToId, tree]);

  // 滚动到目标行
  React.useEffect(() => {
    if (!scrollToId || !containerRef.current) return;
    const idx = rows.findIndex((r) => r.node.id === scrollToId);
    if (idx < 0) return;
    const targetTop = idx * ROW_HEIGHT;
    const el = containerRef.current;
    if (targetTop < el.scrollTop || targetTop > el.scrollTop + el.clientHeight - ROW_HEIGHT * 2) {
      el.scrollTop = Math.max(0, targetTop - el.clientHeight / 2);
    }
  }, [scrollToId, rows]);

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIEWPORT_BUFFER);
  const endIdx = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + VIEWPORT_BUFFER,
  );
  const visible = rows.slice(startIdx, endIdx);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="tree-view"
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="tree-view-inner" style={{ height: totalHeight }}>
        {visible.map((row, i) => {
          const actualIdx = startIdx + i;
          const top = actualIdx * ROW_HEIGHT;
          const node = row.node;
          const isExpanded = expanded.has(node.id);
          const hasChildren = node.childrenIds.length > 0;
          const isSelected = selectedIds.has(node.id);
          const isChecked = checked.has(node.id);
          const isCandidate = node.isCandidate;

          const rowClass = [
            'tree-row',
            isSelected ? 'selected' : '',
            !isCandidate ? 'non-candidate' : '',
            node.hidden ? 'hidden' : '',
            node.locked ? 'locked' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={node.id}
              className={rowClass}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                paddingLeft: 4 + row.visualDepth * INDENT_PER_LEVEL,
              }}
              onClick={(e) => onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              onDoubleClick={() => onFocusNode(node.id)}
              title={node.hidden ? '隐藏节点' : node.locked ? '已锁定' : ''}
            >
              <button
                type="button"
                className="tree-caret"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleExpand(node.id);
                }}
                tabIndex={-1}
              >
                {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
              </button>
              <input
                type="checkbox"
                className="tree-check"
                checked={isChecked}
                disabled={!isCandidate || node.locked}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleCheck(node.id);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="tree-type" data-type={node.type}>
                {shortType(node.type)}
              </span>
              <span className="tree-name">{node.name || '(未命名)'}</span>
              {node.existingPrefix && (
                <span className="tree-existing-prefix" title={`已有前缀 ${node.existingPrefix}`}>
                  {node.existingPrefix}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <div className="tree-empty">尚无数据。点 Scan 遍历当前 scope。</div>
      )}
    </div>
  );
}

function shortType(t: NodeType): string {
  const map: Partial<Record<NodeType, string>> = {
    FRAME: 'F',
    GROUP: 'G',
    COMPONENT: 'C',
    COMPONENT_SET: 'CS',
    INSTANCE: 'I',
    RECTANGLE: 'R',
    TEXT: 'T',
    VECTOR: 'V',
    ELLIPSE: 'E',
    POLYGON: 'P',
    STAR: '★',
    LINE: 'L',
    BOOLEAN_OPERATION: 'B',
  };
  return map[t] || '?';
}
