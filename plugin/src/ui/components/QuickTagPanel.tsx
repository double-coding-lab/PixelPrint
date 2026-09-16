import * as React from 'react';
import { PREFIX_CATALOG } from '../../rules/prefix-catalog';
import type { TreeNode } from '../../types';

interface Props {
  /** 当前操作目标节点 id 列表:优先用勾选、次选画布选中、次选面板高亮。 */
  targetIds: string[];
  /** 目标节点(用于展示名字与已有前缀)。 */
  targetNodes: TreeNode[];
  onTag: (prefix: string, isModifier: boolean, onConflict: 'replace' | 'stack' | 'skip') => void;
  onRename: (nodeId: string, newName: string) => void;
  onFocusNode: (id: string) => void;
}

const BASE_PREFIXES = Object.entries(PREFIX_CATALOG)
  .filter(([, spec]) => spec.category === 'base')
  .map(([p, spec]) => ({ prefix: p, ...spec }));

const MODIFIER_PREFIXES = Object.entries(PREFIX_CATALOG)
  .filter(([, spec]) => spec.category === 'modifier')
  .map(([p, spec]) => ({ prefix: p, ...spec }));

export function QuickTagPanel({
  targetIds,
  targetNodes,
  onTag,
  onRename,
  onFocusNode,
}: Props) {
  const count = targetIds.length;
  const single = count === 1 ? targetNodes[0] : null;
  const [renameDraft, setRenameDraft] = React.useState<string>('');

  React.useEffect(() => {
    setRenameDraft(single?.name || '');
  }, [single?.id, single?.name]);

  if (count === 0) {
    return (
      <div className="quicktag-panel empty">
        <div className="quicktag-empty">
          <div className="quicktag-empty-title">未选中节点</div>
          <div className="quicktag-empty-hint">
            方法 1:在 Figma 画布上点选节点(单选或 Cmd+click 多选)
            <br />
            方法 2:在左侧树上点选一行,或勾选多行
          </div>
        </div>
      </div>
    );
  }

  function handleTag(prefix: string, isModifier: boolean) {
    // 已有基础前缀时,默认弹确认;修饰前缀直接叠加
    if (!isModifier) {
      const anyHasBase = targetNodes.some((n) => {
        if (!n.existingPrefix) return false;
        const tokens = n.existingPrefix.match(/[a-z]+-/g) || [];
        return tokens.some((t) => {
          const spec = PREFIX_CATALOG[t];
          return spec && spec.category === 'base' && t !== prefix;
        });
      });
      if (anyHasBase) {
        const choice = window.confirm(
          `其中部分节点已有基础前缀。\n\n点「确定」= 替换成 ${prefix}\n点「取消」= 保持已有前缀,不改动这些节点`,
        );
        onTag(prefix, false, choice ? 'replace' : 'skip');
        return;
      }
    }
    onTag(prefix, isModifier, 'stack');
  }

  return (
    <div className="quicktag-panel">
      {/* 头部:显示目标 */}
      <div className="quicktag-header">
        {single ? (
          <>
            <div className="quicktag-target">
              <span className="quicktag-target-badge">{single.type}</span>
              <span className="quicktag-target-name" title={single.name}>
                {single.name || '(未命名)'}
              </span>
              <button
                type="button"
                className="quicktag-focus-btn"
                onClick={() => onFocusNode(single.id)}
              >
                聚焦 →
              </button>
            </div>
            {single.existingPrefix && (
              <div className="quicktag-existing-hint">
                当前前缀:<code>{single.existingPrefix}</code>
              </div>
            )}
            {(single.hidden || single.locked) && (
              <div className="quicktag-flags">
                {single.hidden && <span className="tag tag-hidden">隐藏</span>}
                {single.locked && <span className="tag tag-locked">锁定</span>}
              </div>
            )}
          </>
        ) : (
          <div className="quicktag-target">
            <span className="quicktag-target-badge multi">批量</span>
            <span className="quicktag-target-name">已选 {count} 个节点</span>
          </div>
        )}
      </div>

      {/* 单节点:重命名 */}
      {single && !single.locked && (
        <div className="quicktag-section quicktag-rename">
          <div className="section-title">直接改名</div>
          <div className="rename-row">
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameDraft.trim() && renameDraft !== single.name) {
                  onRename(single.id, renameDraft.trim());
                }
              }}
            />
            <button
              type="button"
              disabled={!renameDraft.trim() || renameDraft === single.name}
              onClick={() => onRename(single.id, renameDraft.trim())}
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 基础前缀 */}
      <div className="quicktag-section">
        <div className="section-title">基础前缀(会替换已有基础前缀)</div>
        <div className="prefix-grid">
          {BASE_PREFIXES.map(({ prefix, desc, noDom }) => (
            <button
              key={prefix}
              type="button"
              className={`prefix-btn base ${noDom ? 'no-dom' : ''}`}
              title={desc}
              onClick={() => handleTag(prefix, false)}
            >
              <span className="prefix-btn-label">{prefix}</span>
              <span className="prefix-btn-desc">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 修饰前缀 */}
      <div className="quicktag-section">
        <div className="section-title">修饰前缀(叠加到已有前缀之前)</div>
        <div className="prefix-grid">
          {MODIFIER_PREFIXES.map(({ prefix, desc }) => (
            <button
              key={prefix}
              type="button"
              className="prefix-btn modifier"
              title={desc}
              onClick={() => handleTag(prefix, true)}
            >
              <span className="prefix-btn-label">{prefix}</span>
              <span className="prefix-btn-desc">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="quicktag-tip">
        提示:操作后 Figma 图层名立即变化,Cmd+Z 可撤销。多选状态下所有前缀点击会同时应用到 {count}{' '}
        个节点。
      </div>
    </div>
  );
}
