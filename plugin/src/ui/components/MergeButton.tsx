import * as React from 'react';

interface Props {
  disabled?: boolean;
  onMerge: (prefix: 'img-' | 'sub-' | 'bg-', nameHint?: string) => void;
}

/**
 * 合并选中节点按钮:让用户在 Figma 画布多选后,一键把它们包成一个父 frame + 加前缀。
 * 弹一个小菜单选择前缀,并可选输入名字。
 */
export function MergeButton({ disabled, onMerge }: Props) {
  const [open, setOpen] = React.useState(false);
  const [prefix, setPrefix] = React.useState<'img-' | 'sub-' | 'bg-'>('img-');
  const [nameHint, setNameHint] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  function submit() {
    onMerge(prefix, nameHint.trim() || undefined);
    setOpen(false);
    setNameHint('');
  }

  return (
    <div className="merge-button-wrap" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="把 Figma 画布上选中的多个节点合并为一个父 frame,并加前缀"
      >
        合并选中节点 ▾
      </button>
      {open && (
        <div className="merge-popover">
          <div className="row">
            <label>前缀</label>
            <select value={prefix} onChange={(e) => setPrefix(e.target.value as typeof prefix)}>
              <option value="img-">img-(整体切图)</option>
              <option value="sub-">sub-(独立模块)</option>
              <option value="bg-">bg-(整体背景)</option>
            </select>
          </div>
          <div className="row">
            <label>名字</label>
            <input
              type="text"
              placeholder="couponPack(可留空)"
              value={nameHint}
              onChange={(e) => setNameHint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          <div className="row hint">
            先在 Figma 画布多选(Cmd+click)节点,再点下方按钮
          </div>
          <div className="row">
            <button type="button" className="primary" onClick={submit}>
              合并
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
