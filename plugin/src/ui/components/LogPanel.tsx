import * as React from 'react';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  at: number;
  level: LogLevel;
  msg: string;
  detail?: string;
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: '#3b82f6',
  success: '#10b981',
  warn: '#f59e0b',
  error: '#ef4444',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 单条日志 → 可复制的文本(带时间、级别、消息、详情)。 */
function serializeEntry(l: LogEntry): string {
  const head = `[${fmtDateTime(l.at)}] [${l.level.toUpperCase()}] ${l.msg}`;
  return l.detail ? `${head}\n${l.detail}` : head;
}

/**
 * 沙箱兼容的复制:先试 Clipboard API,失败退 execCommand,再失败弹提示让用户手动复制。
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  // Fallback:临时 textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function LogPanel({ logs, onClear }: Props) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = React.useState<number | 'all' | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function flashCopied(key: number | 'all') {
    setCopiedId(key);
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1200);
  }

  async function onCopyOne(e: React.MouseEvent, l: LogEntry) {
    e.stopPropagation();
    const ok = await copyText(serializeEntry(l));
    if (ok) flashCopied(l.id);
    else window.prompt('复制失败,自行 Cmd+C:', serializeEntry(l));
  }

  async function onCopyAll() {
    if (logs.length === 0) return;
    const text = logs.map(serializeEntry).join('\n\n');
    const ok = await copyText(text);
    if (ok) flashCopied('all');
    else window.prompt('复制失败,自行 Cmd+C:', text);
  }

  return (
    <div className="log-panel">
      <div className="log-header">
        <span>操作日志</span>
        <span className="log-count">{logs.length}</span>
        <button
          type="button"
          className="log-copy-all"
          onClick={onCopyAll}
          disabled={logs.length === 0}
          title="把所有日志(时间 + 级别 + 消息 + 详情)复制到剪贴板"
        >
          {copiedId === 'all' ? '✓ 已复制' : '复制全部'}
        </button>
        <button type="button" className="log-clear" onClick={onClear}>
          清空
        </button>
      </div>
      <div className="log-list" ref={listRef}>
        {logs.length === 0 ? (
          <div className="log-empty">还没日志。点 Scan / Analyze / AI 建议 会在这里记录。</div>
        ) : (
          logs.map((l) => {
            const hasDetail = !!l.detail;
            const isOpen = expanded.has(l.id);
            const isCopied = copiedId === l.id;
            return (
              <div
                key={l.id}
                className={`log-row lvl-${l.level} ${hasDetail ? 'has-detail' : ''}`}
                onClick={() => hasDetail && toggle(l.id)}
              >
                <div className="log-line">
                  <span className="log-time">{fmtTime(l.at)}</span>
                  <span
                    className="log-dot"
                    style={{ background: LEVEL_COLOR[l.level] }}
                  />
                  <span className="log-msg">{l.msg}</span>
                  <button
                    type="button"
                    className="log-copy-one"
                    onClick={(e) => onCopyOne(e, l)}
                    title="复制这一条(含详情)"
                  >
                    {isCopied ? '✓' : '⧉'}
                  </button>
                  {hasDetail && (
                    <span className="log-caret">{isOpen ? '▾' : '▸'}</span>
                  )}
                </div>
                {isOpen && hasDetail && <pre className="log-detail">{l.detail}</pre>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
