import * as React from 'react';
import type { Suggestion, TreeNode } from '../../types';

interface Props {
  suggestions: Suggestion[];
  /** 用于展示 nodeId → 节点名字。 */
  treeById: Map<string, TreeNode>;
  /** 本地隐藏的建议 id 列表(用户点了「忽略」)。 */
  dismissed: Set<string>;
  onApply: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
  onFocusNode: (nodeId: string) => void;
  onApplyAll?: (filtered: Suggestion[]) => void;
  /** 触发"清理隐藏节点"操作(独立按钮,不影响建议)。 */
  onDeleteHidden?: () => void;
  /** 提示信息(如 AI degraded)。 */
  degradedMessage?: string | null;
  running?: boolean;
  runningMessage?: string;
}

function shortName(node: TreeNode | undefined, id: string): string {
  if (!node) return id;
  return node.name || '(未命名)';
}

/** 从簇里第一个成员反推它们的父层节点(用于树状分组)。 */
function findParentId(
  s: Suggestion,
  treeById: Map<string, TreeNode>,
): string | null {
  const first = treeById.get(s.nodeIds[0]);
  return first?.parentId || null;
}

export function SuggestionPanel({
  suggestions,
  treeById,
  dismissed,
  onApply,
  onDismiss,
  onFocusNode,
  onApplyAll,
  onDeleteHidden,
  degradedMessage,
  running,
  runningMessage,
}: Props) {
  const [tab, setTab] = React.useState<'all' | 'code' | 'ai'>('all');
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.id));
  const filtered = visible.filter((s) => (tab === 'all' ? true : s.source === tab));

  const codeCount = visible.filter((s) => s.source === 'code').length;
  const aiCount = visible.filter((s) => s.source === 'ai').length;

  // 按父层分组(merge 类)+ 单独一组(非 merge)
  const merges = filtered.filter((s) => s.action === 'merge');
  const nonMerges = filtered.filter((s) => s.action !== 'merge');

  const mergesByParent = React.useMemo(() => {
    const map = new Map<string, { parentName: string; items: Suggestion[] }>();
    for (const s of merges) {
      const parentId = findParentId(s, treeById) || '(unknown)';
      const parentNode = treeById.get(parentId);
      const parentName = parentNode ? parentNode.name || '(未命名)' : '(未知父层)';
      const bucket = map.get(parentId) || { parentName, items: [] };
      bucket.items.push(s);
      map.set(parentId, bucket);
    }
    return map;
  }, [merges, treeById]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="suggestion-panel">
      <div className="suggestion-header">
        <div className="suggestion-tabs">
          <button
            type="button"
            className={tab === 'all' ? 'active' : ''}
            onClick={() => setTab('all')}
          >
            全部 {visible.length}
          </button>
          <button
            type="button"
            className={tab === 'code' ? 'active' : ''}
            onClick={() => setTab('code')}
          >
            纯代码 {codeCount}
          </button>
          <button
            type="button"
            className={tab === 'ai' ? 'active' : ''}
            onClick={() => setTab('ai')}
          >
            AI {aiCount}
          </button>
        </div>
        {onApplyAll && filtered.length > 0 && (
          <button
            type="button"
            className="apply-all-btn"
            onClick={() => onApplyAll(filtered)}
            title={`一次应用当前视图的 ${filtered.length} 条建议`}
          >
            全部应用({filtered.length})
          </button>
        )}
        {onDeleteHidden && (
          <button
            type="button"
            className="delete-hidden-btn"
            onClick={onDeleteHidden}
            title="删除当前页所有隐藏节点(会弹二次确认)"
          >
            清理隐藏节点
          </button>
        )}
      </div>

      {running && (
        <div className="suggestion-running">
          <span className="spinner" /> {runningMessage || '分析中...'}
        </div>
      )}

      {degradedMessage && (
        <div className="suggestion-degraded">⚠ {degradedMessage}</div>
      )}

      {filtered.length === 0 && !running && (
        <div className="suggestion-empty">
          {suggestions.length === 0 ? (
            <>暂无建议。点右上「一键合并」跑分组建议,或「AI 建议」调 ai-proxy。</>
          ) : (
            <>该分类下无建议。切到其他 tab 查看。</>
          )}
        </div>
      )}

      <div className="suggestion-list">
        {/* 非 merge 类建议(平铺) */}
        {nonMerges.map((s) => (
          <SuggestionRow
            key={s.id}
            s={s}
            treeById={treeById}
            onApply={onApply}
            onDismiss={onDismiss}
            onFocusNode={onFocusNode}
          />
        ))}

        {/* merge 类建议按父层分组 */}
        {Array.from(mergesByParent.entries()).map(([parentId, group]) => {
          const isCollapsed = collapsed.has(parentId);
          return (
            <div key={parentId} className="suggestion-group">
              <div
                className="suggestion-group-header"
                onClick={() => toggleCollapse(parentId)}
              >
                <span className="group-caret">{isCollapsed ? '▸' : '▾'}</span>
                <span className="group-label">合并建议 · 父层</span>
                <span
                  className="group-parent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusNode(parentId);
                  }}
                  title="点击聚焦到父层"
                >
                  {group.parentName}
                </span>
                <span className="group-count">{group.items.length} 条</span>
                <button
                  type="button"
                  className="group-apply-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    for (const s of group.items) onApply(s);
                  }}
                  title="应用该父层下所有合并建议"
                >
                  应用全部
                </button>
              </div>
              {!isCollapsed &&
                group.items.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    s={s}
                    treeById={treeById}
                    onApply={onApply}
                    onDismiss={onDismiss}
                    onFocusNode={onFocusNode}
                    inGroup
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RowProps {
  s: Suggestion;
  treeById: Map<string, TreeNode>;
  onApply: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
  onFocusNode: (id: string) => void;
  inGroup?: boolean;
}

function SuggestionRow({ s, treeById, onApply, onDismiss, onFocusNode, inGroup }: RowProps) {
  const primaryNode = treeById.get(s.nodeIds[0]);
  const isMulti = s.nodeIds.length > 1;
  return (
    <div className={`suggestion-row source-${s.source} ${inGroup ? 'in-group' : ''}`}>
      <div className="suggestion-badge">{s.source === 'code' ? '代码' : 'AI'}</div>
      <div className="suggestion-body">
        <div className="suggestion-line">
          <span className="suggestion-action">
            {s.action === 'merge' ? '合并' : s.action === 'delete' ? '删除' : '打标'}
          </span>
          {s.suggestedPrefix && <span className="suggestion-prefix">{s.suggestedPrefix}</span>}
          <span
            className="suggestion-target"
            title={s.nodeIds.join('\n')}
            onClick={() => onFocusNode(s.nodeIds[0])}
          >
            {isMulti ? `${s.nodeIds.length} 个节点` : shortName(primaryNode, s.nodeIds[0])}
          </span>
          <span className="suggestion-confidence" title="置信度">
            {Math.round(s.confidence * 100)}%
          </span>
        </div>
        <div className="suggestion-reason">{s.reason}</div>
        {isMulti && (
          <div className="suggestion-members">
            {s.nodeIds.slice(0, 5).map((nid) => (
              <span
                key={nid}
                className="suggestion-member"
                onClick={() => onFocusNode(nid)}
                title="点击聚焦该节点"
              >
                {shortName(treeById.get(nid), nid)}
              </span>
            ))}
            {s.nodeIds.length > 5 && (
              <span className="suggestion-member-more">+{s.nodeIds.length - 5}</span>
            )}
          </div>
        )}
      </div>
      <div className="suggestion-actions">
        <button
          type="button"
          className="btn-apply"
          onClick={() => onApply(s)}
          title="应用该建议"
        >
          应用
        </button>
        <button
          type="button"
          className="btn-dismiss"
          onClick={() => onDismiss(s.id)}
          title="忽略该建议(本次会话内)"
        >
          忽略
        </button>
      </div>
    </div>
  );
}
