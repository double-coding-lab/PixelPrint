import * as React from 'react';
import type { Candidate } from '../../types';
import type { AutolayoutSpec } from '../../rules/autolayout/infer';
import { AutolayoutEditor } from './AutolayoutEditor';
import { WarningBadge } from './WarningBadge';
import { PREFIX_CATALOG } from '../../rules/prefix-catalog';

interface Props {
  candidates: Candidate[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (mode: 'checkHigh' | 'invert' | 'clear') => void;
  onEditPrefix: (id: string, prefix: string | null) => void;
  onEditAutolayout: (id: string, spec: AutolayoutSpec | null) => void;
  onFocusNode: (id: string) => void;
}

const CONFIDENCE_COLOR: Record<Candidate['confidence'], string> = {
  high: 'confidence-high',
  medium: 'confidence-medium',
  low: 'confidence-low',
};

const PREFIX_OPTIONS = ['(保持不变)', ...Object.keys(PREFIX_CATALOG)];

export function CandidateTable({
  candidates,
  checked,
  onToggle,
  onToggleAll,
  onEditPrefix,
  onEditAutolayout,
  onFocusNode,
}: Props) {
  return (
    <div className="candidate-table">
      <div className="table-toolbar">
        <button type="button" onClick={() => onToggleAll('checkHigh')}>
          全选高置信
        </button>
        <button type="button" onClick={() => onToggleAll('invert')}>
          反选
        </button>
        <button type="button" onClick={() => onToggleAll('clear')}>
          清空
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}>☑</th>
            <th style={{ minWidth: 200 }}>节点路径</th>
            <th style={{ minWidth: 140 }}>当前名</th>
            <th style={{ minWidth: 110 }}>建议前缀</th>
            <th style={{ minWidth: 160 }}>autolayout</th>
            <th style={{ width: 64 }}>置信度</th>
            <th style={{ minWidth: 120 }}>备注</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const isChecked = checked.has(c.id);
            const rowClass = [
              c.blockApply ? 'row-blocked' : '',
              c.warnings.some((w) => w.code === 'OLD_PREFIX' || w.code === 'EXISTING_D2C_PREFIX')
                ? 'row-warn'
                : '',
              c.warnings.some((w) => w.code === 'FALLBACK_NAME') ? 'row-info' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <tr key={c.id} className={rowClass}>
                <td>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={c.blockApply}
                    onChange={() => onToggle(c.id)}
                    title={c.blockApply ? '硬规则命中,不可 apply' : ''}
                  />
                </td>
                <td className="cell-path">
                  <button
                    type="button"
                    className="link"
                    onClick={() => onFocusNode(c.id)}
                    title="点击在 Figma 中聚焦"
                  >
                    {c.nodePath}
                  </button>
                </td>
                <td className="cell-current">{c.currentName}</td>
                <td>
                  <select
                    value={c.suggestedPrefix || '(保持不变)'}
                    onChange={(e) =>
                      onEditPrefix(c.id, e.target.value === '(保持不变)' ? null : e.target.value)
                    }
                  >
                    {PREFIX_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="suggested-name" title={c.suggestedName}>
                    → {c.suggestedName}
                  </div>
                </td>
                <td>
                  <AutolayoutEditor
                    spec={c.suggestedAutolayout}
                    onChange={(spec) => onEditAutolayout(c.id, spec)}
                  />
                </td>
                <td className={`confidence-cell ${CONFIDENCE_COLOR[c.confidence]}`}>
                  {c.confidence}
                </td>
                <td>
                  <WarningBadge warnings={c.warnings} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="empty-state">
          尚无候选。选择「整页」或选中节点后点 Scan。
        </div>
      )}
    </div>
  );
}
