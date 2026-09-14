import * as React from 'react';
import { CandidateTable } from './components/CandidateTable';
import { ScopeSwitcher } from './components/ScopeSwitcher';
import type { AutolayoutSpec } from '../rules/autolayout/infer';
import { checkMutex } from '../guards/mutex';
import type {
  ApplyResult,
  Candidate,
  CodeMessage,
  HealthReport,
  Scope,
  UiMessage,
} from '../types';

function post(msg: UiMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function App() {
  const [scope, setScope] = React.useState<Scope>('page');
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [scanning, setScanning] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [hardStop, setHardStop] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data.pluginMessage as CodeMessage | undefined;
      if (!msg) return;
      switch (msg.type) {
        case 'scanProgress':
          setProgress({ current: msg.scanned, total: msg.total });
          break;
        case 'scanResult': {
          setScanning(false);
          setProgress(null);
          setHardStop(msg.result.summary.hardStop || null);
          setCandidates(msg.result.candidates);
          const initChecked = new Set<string>();
          for (const c of msg.result.candidates) {
            if (c.defaultChecked) initChecked.add(c.id);
          }
          setChecked(initChecked);
          setError(null);
          break;
        }
        case 'applyProgress':
          setProgress({ current: msg.applied, total: msg.total });
          break;
        case 'applyResult': {
          setApplying(false);
          setProgress(null);
          showToast(formatApplyResult(msg.result));
          break;
        }
        case 'reportReady': {
          downloadReport(msg.report);
          showToast('健康报告已导出');
          break;
        }
        case 'error':
          setError(msg.message);
          setScanning(false);
          setApplying(false);
          setProgress(null);
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function onScan() {
    setCandidates([]);
    setChecked(new Set());
    setHardStop(null);
    setError(null);
    setScanning(true);
    setProgress({ current: 0, total: 0 });
    post({ type: 'scan', scope });
  }

  function onApply() {
    const ids = Array.from(checked);
    if (ids.length === 0) {
      showToast('未勾选任何候选');
      return;
    }
    const confirmMsg = `将修改 ${ids.length} 个图层(改名 + auto layout)。Cmd+Z 可整体撤销。是否继续?`;
    if (!window.confirm(confirmMsg)) return;
    setApplying(true);
    setProgress({ current: 0, total: ids.length });
    setError(null);
    post({ type: 'apply', candidateIds: ids });
  }

  function onExport() {
    post({ type: 'exportReport' });
  }

  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(mode: 'checkHigh' | 'invert' | 'clear') {
    if (mode === 'clear') {
      setChecked(new Set());
      return;
    }
    if (mode === 'checkHigh') {
      const next = new Set<string>();
      for (const c of candidates) {
        if (!c.blockApply && c.confidence === 'high') next.add(c.id);
      }
      setChecked(next);
      return;
    }
    // invert
    setChecked((prev) => {
      const next = new Set<string>();
      for (const c of candidates) {
        if (c.blockApply) continue;
        if (!prev.has(c.id)) next.add(c.id);
      }
      return next;
    });
  }

  function editPrefix(id: string, prefix: string | null) {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        // 重新算 blockApply / warnings(仅前缀互斥类,不重跑推断)
        const mutexWarnings = checkMutex(prefix);
        const otherWarnings = c.warnings.filter(
          (w) => !w.code.match(/^(NAM014|NAM016|NAM019|NAM020|SCROLL-MUTEX)/),
        );
        const nextWarnings = [...mutexWarnings, ...otherWarnings];
        const blockApply = mutexWarnings.some((w) => w.level === 'error');
        // suggestedName 简单跟随:如果原 suggestedName 以老前缀开头,替换为新前缀
        let suggestedName = c.suggestedName;
        if (c.suggestedPrefix && suggestedName.startsWith(c.suggestedPrefix)) {
          suggestedName = (prefix || '') + suggestedName.slice(c.suggestedPrefix.length);
        } else if (!c.suggestedPrefix && prefix) {
          suggestedName = prefix + c.currentName;
        } else if (!prefix) {
          suggestedName = c.currentName;
        }
        return {
          ...c,
          suggestedPrefix: prefix,
          suggestedName,
          warnings: nextWarnings,
          blockApply,
        };
      }),
    );
    // 若 block,取消勾选
    setChecked((prev) => {
      const next = new Set(prev);
      const mutexWarnings = checkMutex(prefix);
      if (mutexWarnings.some((w) => w.level === 'error')) next.delete(id);
      return next;
    });
  }

  function editAutolayout(id: string, spec: AutolayoutSpec | null) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, suggestedAutolayout: spec } : c)));
  }

  function focusNode(id: string) {
    post({ type: 'focusNode', nodeId: id });
  }

  const blockedCount = candidates.filter((c) => c.blockApply).length;
  const busy = scanning || applying;

  return (
    <>
      <header className="app-header">
        <span className="title">PixelPrint D2C Prep</span>
        <ScopeSwitcher scope={scope} onChange={setScope} disabled={busy} />
        <button type="button" onClick={onScan} disabled={busy}>
          {scanning ? 'Scanning...' : 'Scan'}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onApply}
          disabled={busy || checked.size === 0}
        >
          {applying ? 'Applying...' : `Apply (${checked.size})`}
        </button>
        <div className="spacer" />
        <button
          type="button"
          onClick={onExport}
          disabled={busy || candidates.length === 0}
          title="导出当前 scope 的健康报告 JSON"
        >
          导出健康报告
        </button>
      </header>
      {progress && progress.total > 0 && (
        <div className="progress-bar">
          <div
            className="fill"
            style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
          />
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}
      {hardStop && <div className="error-banner">{hardStop}</div>}
      <div className="app-body">
        <CandidateTable
          candidates={candidates}
          checked={checked}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          onEditPrefix={editPrefix}
          onEditAutolayout={editAutolayout}
          onFocusNode={focusNode}
        />
      </div>
      <footer className="app-footer">
        <span className="stats">
          候选 {candidates.length} 项 · 已勾选 {checked.size} 项 · 硬规则阻塞 {blockedCount} 项
        </span>
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function formatApplyResult(res: ApplyResult): string {
  if (res.failed.length === 0) return `Apply 成功 ${res.success} 项`;
  const failedLines = res.failed
    .slice(0, 3)
    .map((f) => `${f.nodePath}: ${f.message}`)
    .join('\n');
  return `成功 ${res.success} 项 / 失败 ${res.failed.length} 项\n${failedLines}${
    res.failed.length > 3 ? `\n... 及其他 ${res.failed.length - 3} 项` : ''
  }`;
}

function downloadReport(report: HealthReport): void {
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(
    ts.getHours(),
  )}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  downloadJson(`pp-d2c-prep-report-${stamp}.json`, report);
}
