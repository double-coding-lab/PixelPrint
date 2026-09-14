import * as React from 'react';
import type { Warning } from '../../guards/mutex';

interface Props {
  warnings: Warning[];
}

const LEVEL_CLASS: Record<Warning['level'], string> = {
  error: 'badge badge-error',
  warn: 'badge badge-warn',
  info: 'badge badge-info',
};

export function WarningBadge({ warnings }: Props) {
  if (warnings.length === 0) return <span className="badge badge-none">-</span>;
  return (
    <div className="warning-badge-list">
      {warnings.map((w, i) => (
        <span
          key={i}
          className={LEVEL_CLASS[w.level]}
          title={w.message}
        >
          {w.code}
        </span>
      ))}
    </div>
  );
}
