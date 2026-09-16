import * as React from 'react';

interface Props {
  gap: number;
  onGapChange: (v: number) => void;
  maxRounds: number;
  onMaxRoundsChange: (v: number) => void;
  maxItemSize: number;
  onMaxItemSizeChange: (v: number) => void;
  overlapThreshold: number;
  onOverlapThresholdChange: (v: number) => void;
  deleteHidden: boolean;
  onDeleteHiddenChange: (v: boolean) => void;
  ungroupDeep: boolean;
  onUngroupDeepChange: (v: boolean) => void;
  onDiagnose: () => void;
  disabled?: boolean;
}

/**
 * ⚙ 参数弹出面板:头部一个齿轮按钮,点开显示所有二级参数。
 * 折叠状态下头部只留 5 个动作按钮,避免拥挤。
 */
export function SettingsPopover({
  gap,
  onGapChange,
  maxRounds,
  onMaxRoundsChange,
  maxItemSize,
  onMaxItemSizeChange,
  overlapThreshold,
  onOverlapThresholdChange,
  deleteHidden,
  onDeleteHiddenChange,
  ungroupDeep,
  onUngroupDeepChange,
  onDiagnose,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="settings-popover-wrap" ref={rootRef}>
      <button
        type="button"
        className={`btn-settings ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="合并 / 拆分参数与工具"
      >
        ⚙ 参数
      </button>
      {open && (
        <div className="settings-popover">
          <div className="settings-section">
            <div className="settings-section-title">一键合并</div>
            <label className="settings-row" title="邻近阈值(px):两个 bbox 边距离 ≤ 此值视为紧邻">
              <span>gap(px)</span>
              <input
                type="number"
                min={0}
                max={200}
                value={gap}
                onChange={(e) => onGapChange(Number(e.target.value))}
                disabled={disabled}
              />
            </label>
            <label className="settings-row" title="每阶段最大迭代轮数(阶段 A 图形,阶段 B 混文字)">
              <span>最大轮数</span>
              <input
                type="number"
                min={1}
                max={50}
                value={maxRounds}
                onChange={(e) => onMaxRoundsChange(Number(e.target.value))}
                disabled={disabled}
              />
            </label>
            <label
              className="settings-row"
              title="单个候选最大尺寸(px):超过视为大背景不参与。想让大图合并请调大"
            >
              <span>最大尺寸</span>
              <input
                type="number"
                min={10}
                max={100000}
                value={maxItemSize}
                onChange={(e) => onMaxItemSizeChange(Number(e.target.value))}
                disabled={disabled}
              />
            </label>
            <label
              className="settings-row"
              title="阶段 O 相交阈值(0~1):bbox 重叠面积 / 较小 bbox ≥ 此值 → 视为相交合并。调高更严,调低更宽"
            >
              <span>相交阈值</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={overlapThreshold}
                onChange={(e) => onOverlapThresholdChange(Number(e.target.value))}
                disabled={disabled}
              />
            </label>
            <label
              className="settings-check"
              title="合并前先清理:visible=false 的隐藏节点 + 所有 Slice 节点(锁定 / Instance 不动)"
            >
              <input
                type="checkbox"
                checked={deleteHidden}
                onChange={(e) => onDeleteHiddenChange(e.target.checked)}
                disabled={disabled}
              />
              合并前清理隐藏/Slice
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">一键拆分</div>
            <label className="settings-check" title="勾选:递归拆到无 GROUP(慎用);不勾:只拆一层">
              <input
                type="checkbox"
                checked={ungroupDeep}
                onChange={(e) => onUngroupDeepChange(e.target.checked)}
                disabled={disabled}
              />
              深拆(递归)
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">调试</div>
            <button
              type="button"
              className="settings-diagnose-btn"
              onClick={() => {
                setOpen(false);
                onDiagnose();
              }}
              disabled={disabled}
              title="在 Figma 或树上选中恰好 2 个节点后点这个,报告为什么它们没被合并"
            >
              诊断为什么没合并
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
