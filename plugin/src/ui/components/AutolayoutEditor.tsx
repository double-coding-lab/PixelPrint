import * as React from 'react';
import type { AutolayoutSpec } from '../../rules/autolayout/infer';

interface Props {
  spec: AutolayoutSpec | null;
  onChange?: (spec: AutolayoutSpec | null) => void;
}

/**
 * 极简展示 + 可展开编辑面板。
 * 编辑面板允许改 gap 和四方向 padding、mode 与两轴 align。
 */
export function AutolayoutEditor({ spec, onChange }: Props) {
  const [expanded, setExpanded] = React.useState(false);

  if (!spec) {
    return <span className="autolayout-summary autolayout-none">-</span>;
  }

  const summary = `${spec.layoutMode === 'HORIZONTAL' ? 'HOR' : 'VER'} · gap ${spec.itemSpacing} · pad ${spec.paddingTop},${spec.paddingRight},${spec.paddingBottom},${spec.paddingLeft}`;

  function update<K extends keyof AutolayoutSpec>(key: K, value: AutolayoutSpec[K]) {
    if (!spec || !onChange) return;
    onChange({ ...spec, [key]: value });
  }

  return (
    <div className="autolayout-editor">
      <button
        type="button"
        className="autolayout-summary"
        onClick={() => setExpanded((v) => !v)}
      >
        {summary} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="autolayout-panel">
          <div className="row">
            <label>Mode</label>
            <select
              value={spec.layoutMode}
              onChange={(e) => update('layoutMode', e.target.value as AutolayoutSpec['layoutMode'])}
            >
              <option value="VERTICAL">VERTICAL</option>
              <option value="HORIZONTAL">HORIZONTAL</option>
            </select>
          </div>
          <div className="row">
            <label>Gap</label>
            <input
              type="number"
              value={spec.itemSpacing}
              onChange={(e) => update('itemSpacing', Number(e.target.value) || 0)}
            />
          </div>
          <div className="row">
            <label>Padding T/R/B/L</label>
            <input
              type="number"
              value={spec.paddingTop}
              onChange={(e) => update('paddingTop', Number(e.target.value) || 0)}
            />
            <input
              type="number"
              value={spec.paddingRight}
              onChange={(e) => update('paddingRight', Number(e.target.value) || 0)}
            />
            <input
              type="number"
              value={spec.paddingBottom}
              onChange={(e) => update('paddingBottom', Number(e.target.value) || 0)}
            />
            <input
              type="number"
              value={spec.paddingLeft}
              onChange={(e) => update('paddingLeft', Number(e.target.value) || 0)}
            />
          </div>
          <div className="row">
            <label>Counter</label>
            <select
              value={spec.counterAxisAlignItems}
              onChange={(e) =>
                update('counterAxisAlignItems', e.target.value as AutolayoutSpec['counterAxisAlignItems'])
              }
            >
              <option value="MIN">MIN</option>
              <option value="CENTER">CENTER</option>
              <option value="MAX">MAX</option>
            </select>
          </div>
          <div className="row">
            <label>Primary</label>
            <select
              value={spec.primaryAxisAlignItems}
              onChange={(e) =>
                update('primaryAxisAlignItems', e.target.value as AutolayoutSpec['primaryAxisAlignItems'])
              }
            >
              <option value="MIN">MIN</option>
              <option value="SPACE_BETWEEN">SPACE_BETWEEN</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
