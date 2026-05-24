import { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  title?: string;
  className?: string;
}

export function Select({ value, options, onChange, title, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { setOpen(o => !o); return; }
    if (!open) return;
    const idx = options.findIndex(o => o.value === value);
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(options[Math.min(idx + 1, options.length - 1)].value); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(options[Math.max(idx - 1, 0)].value); }
  }

  const selected = options.find(o => o.value === value);

  return (
    <div
      ref={ref}
      className={['prive-select', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-flex' }}
      onKeyDown={onKey}
      tabIndex={0}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      title={title}
    >
      <button
        className="prive-select-trigger"
        onClick={() => setOpen(o => !o)}
        tabIndex={-1}
        type="button"
      >
        <span className="prive-select-label">{selected?.label ?? value}</span>
        <svg className="prive-select-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {open && (
        <div className="prive-select-menu" role="listbox">
          {options.map(opt => (
            <button
              key={opt.value}
              className="prive-select-item"
              role="option"
              aria-selected={opt.value === value}
              data-on={opt.value === value ? '1' : '0'}
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
              tabIndex={-1}
              type="button"
            >
              {opt.value === value && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
