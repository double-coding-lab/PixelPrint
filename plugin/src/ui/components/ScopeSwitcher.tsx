import * as React from 'react';
import type { Scope } from '../../types';

interface Props {
  scope: Scope;
  onChange: (scope: Scope) => void;
  disabled?: boolean;
}

export function ScopeSwitcher({ scope, onChange, disabled }: Props) {
  return (
    <div className="scope-switcher">
      <label className={scope === 'page' ? 'active' : ''}>
        <input
          type="radio"
          name="scope"
          value="page"
          checked={scope === 'page'}
          disabled={disabled}
          onChange={() => onChange('page')}
        />
        <span>整页</span>
      </label>
      <label className={scope === 'selection' ? 'active' : ''}>
        <input
          type="radio"
          name="scope"
          value="selection"
          checked={scope === 'selection'}
          disabled={disabled}
          onChange={() => onChange('selection')}
        />
        <span>选中节点</span>
      </label>
    </div>
  );
}
