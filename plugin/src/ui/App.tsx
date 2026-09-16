import * as React from 'react';
import type {
  AnalyzeResult,
  AiSuggestResult,
  CodeMessage,
  MergeResult,
  Scope,
  Suggestion,
  TagResult,
  TreeNode,
  UiMessage,
} from '../types';
import { LogPanel, type LogEntry, type LogLevel } from './components/LogPanel';
import { MergeButton } from './components/MergeButton';
import { QuickTagPanel } from './components/QuickTagPanel';
import { ScopeSwitcher } from './components/ScopeSwitcher';
import { SettingsPopover } from './components/SettingsPopover';
import { SuggestionPanel } from './components/SuggestionPanel';
import { TreeView } from './components/TreeView';

function post(msg: UiMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

const LOG_CAP = 200;

export function App() {
  const [scope, setScope] = React.useState<Scope>('page');
  const [tree, setTree] = React.useState<TreeNode[]>([]);
  const [rootIds, setRootIds] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  /** 面板中的高亮选中(单击树上一行 or 画布 selection 同步来的)。 */
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [scanning, setScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [hardStop, setHardStop] = React.useState<string | null>(null);
  const [scrollToId, setScrollToId] = React.useState<string | null>(null);

  // 建议面板状态
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzingMsg, setAnalyzingMsg] = React.useState<string>('');
  const [aiDegraded, setAiDegraded] = React.useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // 一键合并参数
  const [mergeGap, setMergeGap] = React.useState<number>(12);
  const [mergeMaxRounds, setMergeMaxRounds] = React.useState<number>(10);
  const [mergeMaxItemSize, setMergeMaxItemSize] = React.useState<number>(300);
  const [mergeOverlapThreshold, setMergeOverlapThreshold] = React.useState<number>(0.3);
  const [mergeDeleteHidden, setMergeDeleteHidden] = React.useState<boolean>(true);

  // 一键拆分参数
  const [ungroupDeep, setUngroupDeep] = React.useState<boolean>(false);

  // 操作日志
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = React.useState(false);
  const logSeqRef = React.useRef(0);

  const log = React.useCallback((level: LogLevel, msg: string, detail?: unknown) => {
    setLogs((prev) => {
      logSeqRef.current += 1;
      let detailStr: string | undefined;
      if (detail !== undefined) {
        try {
          detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
        } catch {
          detailStr = String(detail);
        }
      }
      const entry: LogEntry = { id: logSeqRef.current, at: Date.now(), level, msg, detail: detailStr };
      const next = [...prev, entry];
      if (next.length > LOG_CAP) next.splice(0, next.length - LOG_CAP);
      return next;
    });
  }, []);

  const treeById = React.useMemo(() => {
    const m = new Map<string, TreeNode>();
    for (const n of tree) m.set(n.id, n);
    return m;
  }, [tree]);

  /**
   * 操作目标决策:
   * 1. 若有勾选,用勾选列表(批量模式)
   * 2. 否则用高亮 selectedIds(单选/多选模式)
   */
  const targetIds = React.useMemo(() => {
    if (checked.size > 0) return Array.from(checked);
    return Array.from(selectedIds);
  }, [checked, selectedIds]);

  const targetNodes = React.useMemo(
    () =>
      targetIds
        .map((id) => treeById.get(id))
        .filter((n): n is TreeNode => !!n && n.isCandidate),
    [targetIds, treeById],
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data.pluginMessage as CodeMessage | undefined;
      if (!msg) return;
      switch (msg.type) {
        case 'scanProgress':
          setScanProgress(msg.scanned);
          break;
        case 'scanResult': {
          setScanning(false);
          setScanProgress(0);
          setHardStop(msg.result.summary.hardStop || null);
          setTree(msg.result.tree);
          setRootIds(msg.result.rootIds);
          setChecked(new Set());
          setSelectedIds(new Set(msg.result.rootIds.slice(0, 1)));
          setError(null);
          log(
            'success',
            `Scan 完成:${msg.result.tree.length} 节点 · ${msg.result.rootIds.length} 根`,
            msg.result.summary.hardStop ? `⚠ ${msg.result.summary.hardStop}` : undefined,
          );
          break;
        }
        case 'tagResult':
          handleTagResult(msg.result);
          break;
        case 'renameResult':
          if (msg.ok) {
            setTree((prev) =>
              prev.map((n) =>
                n.id === msg.nodeId
                  ? { ...n, name: msg.newName, existingPrefix: extractExistingPrefixLocal(msg.newName) }
                  : n,
              ),
            );
            showToast('已改名');
            log('success', `改名成功 → ${msg.newName}`);
          } else {
            setError(msg.message || '改名失败');
            log('error', `改名失败:${msg.message || '未知'}`);
          }
          break;
        case 'mergeResult':
          handleMergeResult(msg.result);
          break;
        case 'canvasSelectionChanged': {
          if (msg.nodeIds.length === 0) return;
          setSelectedIds(new Set(msg.nodeIds));
          setScrollToId(msg.nodeIds[0]);
          setTimeout(() => setScrollToId(null), 200);
          break;
        }
        case 'analyzeResult': {
          handleAnalyzeResult(msg.result);
          break;
        }
        case 'deleteHiddenResult': {
          handleDeleteHiddenResult(msg);
          break;
        }
        case 'iterativeMergeProgress': {
          setAnalyzingMsg(
            `阶段 ${msg.phase} · 第 ${msg.round} 轮 · 本轮合并 ${msg.merged} 组`,
          );
          log('info', `阶段 ${msg.phase} 第 ${msg.round} 轮 · 合并 ${msg.merged} 组`);
          break;
        }
        case 'iterativeMergeResult': {
          setAnalyzing(false);
          setAnalyzingMsg('');
          const parts = [
            `阶段 O ${msg.oGroups} 组(${msg.oRounds} 轮)`,
            `阶段 A ${msg.aGroups} 组(${msg.aRounds} 轮)`,
            `阶段 B ${msg.bGroups} 组(${msg.bRounds} 轮)`,
          ];
          if (msg.stoppedByLimit) parts.push(`⚠ 阶段 ${msg.stoppedByLimit} 达上限提前停止`);
          parts.push(`${msg.elapsedMs}ms`);
          const done = `一键合并完成:${parts.join(' · ')}`;
          showToast(done);
          log(
            msg.stoppedByLimit ? 'warn' : 'success',
            done,
            '树已改变,建议重新 Scan 查看新结构',
          );
          break;
        }
        case 'diagnoseMergeResult': {
          const head = `诊断 [${msg.aName}] ↔ [${msg.bName}]:${msg.wouldMerge ? '✅ 满足合并条件' : '❌ 不满足'}`;
          const detail = msg.reasons.length
            ? '原因:\n' + msg.reasons.map((r) => `• ${r}`).join('\n') + '\n\n上下文:\n' + JSON.stringify(msg.info, null, 2)
            : '所有条件都满足,应该会被合并。可能是 gap 阈值或迭代未跑到这里,重新点一次一键合并试试。\n\n上下文:\n' + JSON.stringify(msg.info, null, 2);
          showToast(head);
          log(msg.wouldMerge ? 'success' : 'warn', head, detail);
          setShowLogs(true);
          break;
        }
        case 'ungroupResult': {
          const parts: string[] = [];
          parts.push(`拆开 ${msg.ungrouped} 个 group`);
          parts.push(`释放 ${msg.releasedNodes} 个子节点`);
          if (msg.skippedNonGroup) parts.push(`跳过 ${msg.skippedNonGroup} 非 group`);
          if (msg.skippedLocked) parts.push(`跳过 ${msg.skippedLocked} 锁定`);
          const suffix = msg.deep ? '(深拆)' : '(浅拆)';
          const done = `一键拆分完成${suffix}:${parts.join(' · ')}`;
          showToast(done);
          log(
            msg.errors.length > 0 ? 'warn' : msg.ungrouped > 0 ? 'success' : 'info',
            done,
            msg.errors.length > 0 ? '错误:\n' + msg.errors.map((e) => `• ${e}`).join('\n') : undefined,
          );
          if (msg.ungrouped > 0) log('warn', '树已改变,建议重新 Scan 查看新结构');
          break;
        }
        case 'aiSuggestProgress': {
          setAnalyzingMsg(msg.message || msg.phase);
          log('info', `AI 进度:${msg.phase}`, msg.message);
          break;
        }
        case 'aiSuggestResult': {
          handleAiSuggestResult(msg.result);
          break;
        }
        case 'error':
          setError(msg.message);
          setScanning(false);
          setScanProgress(0);
          log('error', `Code 侧错误 [${msg.code}]`, msg.message);
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [log]);

  function handleTagResult(res: TagResult) {
    // 更新 tree 里对应节点的 name / existingPrefix
    if (res.updated.length > 0) {
      setTree((prev) =>
        prev.map((n) => {
          const u = res.updated.find((x) => x.id === n.id);
          if (u && u.newName) {
            return { ...n, name: u.newName, existingPrefix: extractExistingPrefixLocal(u.newName) };
          }
          return n;
        }),
      );
    }
    const parts: string[] = [];
    if (res.success > 0) parts.push(`成功 ${res.success}`);
    if (res.skipped.length > 0) parts.push(`跳过 ${res.skipped.length}`);
    if (res.failed.length > 0) parts.push(`失败 ${res.failed.length}`);
    let toastMsg = parts.join(' · ');
    // 展开跳过/失败原因
    const details: string[] = [];
    for (const item of [...res.skipped, ...res.failed].slice(0, 3)) {
      details.push(`${item.oldName || item.id}: ${item.message}`);
    }
    if (details.length > 0) toastMsg += '\n' + details.join('\n');
    showToast(toastMsg);
    const detailLog: string[] = [];
    for (const item of res.updated.slice(0, 5)) {
      detailLog.push(`✓ ${item.oldName || item.id} → ${item.newName}`);
    }
    for (const item of res.skipped.slice(0, 5)) {
      detailLog.push(`- ${item.oldName || item.id}: ${item.message}`);
    }
    for (const item of res.failed.slice(0, 5)) {
      detailLog.push(`✗ ${item.oldName || item.id}: ${item.message}`);
    }
    log(
      res.failed.length > 0 ? 'error' : res.skipped.length > 0 ? 'warn' : 'success',
      `打标:${toastMsg.split('\n')[0]}`,
      detailLog.join('\n') || undefined,
    );
  }

  function handleMergeResult(res: MergeResult) {
    if (res.success) {
      showToast(`已合并为 ${res.newNodeName};建议 Scan 刷新树`);
      log('success', `合并成功 → ${res.newNodeName}`);
    } else {
      setError(res.message || '合并失败');
      log('error', `合并失败:${res.message || '未知'}`);
    }
  }

  function handleAnalyzeResult(res: AnalyzeResult) {
    setAnalyzing(false);
    setAnalyzingMsg('');
    setSuggestions((prev) => {
      const kept = prev.filter((s) => s.source !== 'code');
      return [...kept, ...res.suggestions];
    });
    setShowSuggestions(true);
    const doneMsg = `生成 ${res.suggestions.length} 条合并建议 · ${res.elapsedMs}ms`;
    showToast(doneMsg);
    log(
      'success',
      doneMsg,
      res.suggestions.length
        ? res.suggestions
            .slice(0, 8)
            .map((s) => `• ${s.suggestedPrefix || s.action} → ${s.nodeIds.length} 节点 (${Math.round(s.confidence * 100)}%): ${s.reason}`)
            .join('\n')
        : undefined,
    );
  }

  function handleAiSuggestResult(res: AiSuggestResult) {
    setAnalyzing(false);
    setAnalyzingMsg('');
    if (res.degraded) {
      setAiDegraded(res.message || 'AI 不可用');
      setShowSuggestions(true);
      log('error', `AI 建议失败`, res.message || '未知');
      return;
    }
    setAiDegraded(null);
    setSuggestions((prev) => {
      const kept = prev.filter((s) => s.source !== 'ai');
      return [...kept, ...res.suggestions];
    });
    setShowSuggestions(true);
    showToast(`AI 建议返回 ${res.suggestions.length} 条`);
    log(
      'success',
      `AI 建议返回 ${res.suggestions.length} 条`,
      res.suggestions.length
        ? res.suggestions
            .slice(0, 8)
            .map((s) => `• ${s.suggestedPrefix || s.action} → ${s.nodeIds.length} 节点 (${Math.round(s.confidence * 100)}%): ${s.reason}`)
            .join('\n')
        : undefined,
    );
  }

  function onAnalyze() {
    setAnalyzing(true);
    setAnalyzingMsg('纯代码分析中...');
    log('info', 'Analyze:纯代码分析开始');
    post({ type: 'analyze' });
  }

  function onOneClickMerge() {
    const gap = Number(mergeGap);
    const rounds = Number(mergeMaxRounds);
    const maxItemSize = Number(mergeMaxItemSize);
    if (!Number.isFinite(gap) || gap < 0 || gap > 200) {
      window.alert('邻近阈值(gap)请填 0~200 的整数');
      return;
    }
    if (!Number.isFinite(rounds) || rounds < 1 || rounds > 50) {
      window.alert('迭代轮数请填 1~50');
      return;
    }
    if (!Number.isFinite(maxItemSize) || maxItemSize < 10 || maxItemSize > 100000) {
      window.alert('最大候选尺寸请填 10~100000');
      return;
    }
    const cleanupPart = mergeDeleteHidden
      ? '1. 永久删除当前页所有隐藏节点(visible=false)与 Slice 节点\n2. 迭代合并同级贴合的图形与文字'
      : '迭代合并同级贴合的图形与文字(不清理隐藏/Slice)';
    const ok = window.confirm(
      `一键合并会:\n\n${cleanupPart}\n\n均可 Cmd+Z 撤销。\n\n参数:gap=${gap}px,size≤${maxItemSize}px,最多 ${rounds} 轮 × 2 阶段。继续?`,
    );
    if (!ok) return;
    setAnalyzing(true);
    setAnalyzingMsg(mergeDeleteHidden ? '清理隐藏 + 迭代合并中...' : '迭代合并中...');
    log(
      'info',
      `一键合并:开始(gap=${gap}px,maxRounds=${rounds},maxItemSize=${maxItemSize}px,清理隐藏=${mergeDeleteHidden ? '是' : '否'})`,
    );
    post({
      type: 'iterativeMerge',
      gap,
      maxRounds: rounds,
      maxItemSize,
      overlapThreshold: mergeOverlapThreshold,
      deleteHiddenFirst: mergeDeleteHidden,
    });
  }

  function onDeleteHidden() {
    const ok = window.confirm(
      '会永久删除当前页所有 visible=false 的可见性隐藏节点(锁定 / Instance 内不动)。Cmd+Z 可撤销。继续?',
    );
    if (!ok) return;
    log('info', '开始清理隐藏节点');
    post({ type: 'deleteHidden' });
  }

  function onDiagnose() {
    const gap = Number(mergeGap);
    const maxItemSize = Number(mergeMaxItemSize);
    if (!Number.isFinite(gap) || gap < 0 || gap > 200) {
      window.alert('gap 请填 0~200');
      return;
    }
    // 若面板高亮里有 2 个,直接用;否则由 code 侧读 Figma selection
    const ids = Array.from(selectedIds);
    log('info', `诊断合并 · gap=${gap} · size≤${maxItemSize} · 选中 ${ids.length} 个`);
    post({
      type: 'diagnoseMerge',
      nodeIds: ids.length >= 2 ? [ids[0], ids[1]] : undefined,
      gap,
      maxItemSize,
    });
  }

  function onUngroupSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      window.alert('请先在 Figma 或树上选中要拆分的 group');
      return;
    }
    const ok = window.confirm(
      `拆分 ${ids.length} 个选中节点${ungroupDeep ? '(深拆:递归到无 GROUP)' : '(浅拆:只拆一层)'}?Cmd+Z 可撤销。`,
    );
    if (!ok) return;
    log(
      'info',
      `一键拆分:选中 ${ids.length} · ${ungroupDeep ? '深拆' : '浅拆'}`,
    );
    post({ type: 'ungroupSelected', nodeIds: ids, deep: ungroupDeep });
  }

  function handleDeleteHiddenResult(msg: {
    deleted: number;
    deletedHidden: number;
    deletedSlice: number;
    skippedLocked: number;
    skippedInstance: number;
  }) {
    const parts: string[] = [];
    if (msg.deletedHidden) parts.push(`隐藏 ${msg.deletedHidden}`);
    if (msg.deletedSlice) parts.push(`Slice ${msg.deletedSlice}`);
    if (msg.skippedLocked) parts.push(`跳过 ${msg.skippedLocked} 锁定`);
    if (msg.skippedInstance) parts.push(`跳过 ${msg.skippedInstance} Instance`);
    const summary = msg.deleted === 0
      ? '没有可清理的隐藏/Slice 节点'
      : `已清理 ${msg.deleted} 个:${parts.join(' · ')}`;
    showToast(summary);
    log(msg.deleted > 0 ? 'success' : 'info', summary);
    if (msg.deleted > 0) {
      log('warn', '节点已删,建议重新 Scan 刷新树');
    }
  }

  function onAiSuggest() {
    setAnalyzing(true);
    setAnalyzingMsg('AI 分析中(首次调用需要几秒到十几秒)...');
    setAiDegraded(null);
    log('info', `AI 建议开始 · scope=${scope}`);
    post({ type: 'aiSuggest', scope });
  }

  function onApplySuggestion(s: Suggestion) {
    if (s.action === 'tag' && s.suggestedPrefix) {
      const isModifier = ['fixed-', 'end-', 'list-', 'bl-'].includes(s.suggestedPrefix);
      log(
        'info',
        `应用建议 → ${s.suggestedPrefix} × ${s.nodeIds.length}`,
        `理由: ${s.reason}`,
      );
      post({
        type: 'tagNodes',
        nodeIds: s.nodeIds,
        prefix: s.suggestedPrefix,
        isModifier,
        onConflict: 'replace',
      });
      setDismissedIds((prev) => new Set(prev).add(s.id));
    } else if (s.action === 'merge' && s.suggestedPrefix) {
      const p = s.suggestedPrefix as string;
      if (p === 'img-' || p === 'sub-' || p === 'bg-') {
        log(
          'info',
          `合并建议 → ${p} × ${s.nodeIds.length}`,
          `理由: ${s.reason}`,
        );
        post({
          type: 'mergeNodes',
          nodeIds: s.nodeIds,
          prefix: p,
        });
        setDismissedIds((prev) => new Set(prev).add(s.id));
      } else {
        showToast(`merge 只支持 img-/sub-/bg-,当前建议前缀为 ${p}`);
        log('warn', `merge 建议前缀不支持:${p}`);
      }
    } else {
      showToast('该建议类型暂不支持一键应用,请手工处理');
      log('warn', `建议类型 ${s.action} 暂不支持一键应用`);
    }
  }

  function onApplyAll(list: Suggestion[]) {
    let applied = 0;
    for (const s of list) {
      if (s.action === 'tag' && s.suggestedPrefix) {
        const isModifier = ['fixed-', 'end-', 'list-', 'bl-'].includes(s.suggestedPrefix);
        post({
          type: 'tagNodes',
          nodeIds: s.nodeIds,
          prefix: s.suggestedPrefix,
          isModifier,
          onConflict: 'replace',
        });
        applied += 1;
      }
    }
    if (applied > 0) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const s of list) if (s.action === 'tag') next.add(s.id);
        return next;
      });
      showToast(`已批量应用 ${applied} 条 tag 建议`);
      log('info', `批量应用 ${applied} 条 tag 建议`);
    } else {
      showToast('当前视图内无可一键应用的 tag 建议');
      log('warn', '批量应用:当前视图无可一键应用的 tag 建议');
    }
  }

  function onDismissSuggestion(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  function onScan() {
    setTree([]);
    setRootIds([]);
    setChecked(new Set());
    setSelectedIds(new Set());
    setHardStop(null);
    setError(null);
    setScanning(true);
    setScanProgress(0);
    log('info', `Scan 开始 · scope=${scope}`);
    post({ type: 'scan', scope });
  }

  function onTag(
    prefix: string,
    isModifier: boolean,
    onConflict: 'replace' | 'stack' | 'skip',
  ) {
    if (targetIds.length === 0) return;
    post({
      type: 'tagNodes',
      nodeIds: targetNodes.map((n) => n.id),
      prefix,
      isModifier,
      onConflict,
    });
  }

  function onRename(nodeId: string, newName: string) {
    post({ type: 'renameNode', nodeId, newName });
  }

  function onMerge(prefix: 'img-' | 'sub-' | 'bg-', nameHint?: string) {
    post({ type: 'mergeSelected', prefix, nameHint });
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSelectRow(id: string, additive: boolean) {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }

  function focusNode(id: string) {
    post({ type: 'focusNode', nodeId: id });
  }

  return (
    <>
      <header className="app-header">
        <span className="title">PP D2C</span>
        <ScopeSwitcher scope={scope} onChange={setScope} disabled={scanning} />
        <button type="button" onClick={onScan} disabled={scanning}>
          {scanning ? `Scan ${scanProgress}...` : 'Scan'}
        </button>
        <div className="header-sep" />
        <button
          type="button"
          className="btn-analyze"
          onClick={onOneClickMerge}
          disabled={scanning || analyzing}
          title="一键合并:先删所有隐藏节点(可选),再迭代把同级贴合的碎片包成 group(先图形后混文字)。Cmd+Z 可撤销。"
        >
          一键合并
        </button>
        <button
          type="button"
          className="btn-ungroup"
          onClick={onUngroupSelected}
          disabled={scanning || analyzing}
          title="一键拆分:对选中的 group 执行 ungroup。默认浅拆,勾深拆递归到无 group。"
        >
          一键拆分
        </button>
        <button
          type="button"
          className="btn-ai"
          onClick={onAiSuggest}
          disabled={scanning || analyzing}
          title="调 ai-proxy(localhost:8787):bg/bgc 消歧 + 视觉分组"
        >
          AI 建议
        </button>
        <SettingsPopover
          gap={mergeGap}
          onGapChange={setMergeGap}
          maxRounds={mergeMaxRounds}
          onMaxRoundsChange={setMergeMaxRounds}
          maxItemSize={mergeMaxItemSize}
          onMaxItemSizeChange={setMergeMaxItemSize}
          overlapThreshold={mergeOverlapThreshold}
          onOverlapThresholdChange={setMergeOverlapThreshold}
          deleteHidden={mergeDeleteHidden}
          onDeleteHiddenChange={setMergeDeleteHidden}
          ungroupDeep={ungroupDeep}
          onUngroupDeepChange={setUngroupDeep}
          onDiagnose={onDiagnose}
          disabled={scanning || analyzing}
        />
        <div className="header-sep" />
        <MergeButton disabled={scanning} onMerge={onMerge} />
        <div className="spacer" />
        <button
          type="button"
          className={`btn-log-toggle ${showLogs ? 'active' : ''}`}
          onClick={() => setShowLogs((v) => !v)}
          title="展开/收起操作日志"
        >
          日志 {logs.length > 0 && <span className="log-badge">{logs.length}</span>}
        </button>
        <div className="app-header-hint">
          {tree.length > 0 && `${tree.length} 节点`}
          {suggestions.length > 0 && ` · ${suggestions.length - dismissedIds.size} 建议`}
        </div>
      </header>
      {scanning && scanProgress > 0 && (
        <div className="progress-bar">
          <div className="fill indeterminate" />
        </div>
      )}
      {error && (
        <div className="error-banner">
          {error}
          <button type="button" className="dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
      {hardStop && <div className="error-banner">{hardStop}</div>}
      <div className="app-body split">
        <div className="split-left">
          <TreeView
            tree={tree}
            rootIds={rootIds}
            checked={checked}
            selectedIds={selectedIds}
            onSelect={onSelectRow}
            onToggleCheck={toggleCheck}
            onFocusNode={focusNode}
            scrollToId={scrollToId}
          />
        </div>
        <div className="split-right">
          {(showSuggestions || analyzing) && (
            <div className="suggestion-drawer">
              <div className="suggestion-drawer-header">
                <span>建议</span>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowSuggestions(false)}
                  title="收起建议面板"
                >
                  ×
                </button>
              </div>
              <SuggestionPanel
                suggestions={suggestions}
                treeById={treeById}
                dismissed={dismissedIds}
                onApply={onApplySuggestion}
                onDismiss={onDismissSuggestion}
                onFocusNode={focusNode}
                onApplyAll={onApplyAll}
                degradedMessage={aiDegraded}
                running={analyzing}
                runningMessage={analyzingMsg}
              />
            </div>
          )}
          <QuickTagPanel
            targetIds={targetIds}
            targetNodes={targetNodes}
            onTag={onTag}
            onRename={onRename}
            onFocusNode={focusNode}
          />
        </div>
      </div>
      {showLogs && (
        <LogPanel logs={logs} onClear={() => setLogs([])} />
      )}
      <footer className="app-footer">
        <span className="stats">
          {checked.size > 0 ? (
            <>批量模式:已勾选 {checked.size} · 点前缀按钮批量打标</>
          ) : (
            <>单选模式:目标 {selectedIds.size} · 在 Figma 画布 Cmd+click 多选 或 树上勾选</>
          )}
        </span>
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/** 本地版:UI 里用的极简前缀识别(和 scanner 保持一致)。 */
function extractExistingPrefixLocal(name: string): string | null {
  const known = [
    'fixed-',
    'end-',
    'list-',
    'bl-',
    'scrollx-',
    'scrolly-',
    'sub-',
    'img-',
    'bg-',
    'bgc-',
    'btn-',
    'input-',
    'x-',
  ];
  let matched = '';
  let rest = name;
  outer: while (rest.length > 0) {
    for (const p of known) {
      if (rest.startsWith(p)) {
        matched += p;
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    break;
  }
  return matched || null;
}
