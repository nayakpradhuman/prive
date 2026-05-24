import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';

export interface MentionOption {
  label: string;
  value: string;
  badge?: string;
  badgeClass?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  smOptions: MentionOption[];
  artboardOptions: MentionOption[];
  inputOptions: MentionOption[];
  className?: string;
}

type Trigger = '/' | '@' | '#';

interface MentionState {
  trigger: Trigger;
  insertAt: number; // position in main textarea where the trigger char was
}

const TRIGGER_LABELS: Record<Trigger, string> = {
  '/': 'State Machines',
  '@': 'Artboards',
  '#': 'Inputs',
};

export function MentionInput({ value, onChange, onSubmit, placeholder, rows = 2, smOptions, artboardOptions, inputOptions, className }: Props) {
  const [mention, setMention] = useState<MentionState | null>(null);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getOptions = (m: MentionState | null, query: string): MentionOption[] => {
    if (!m) return [];
    const q = query.toLowerCase();
    const pool = m.trigger === '/' ? smOptions : m.trigger === '@' ? artboardOptions : inputOptions;
    if (!q) return pool;
    return pool.filter(o => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  };

  // Focus dropdown input when mention opens
  useEffect(() => {
    if (mention && dropdownInputRef.current) {
      setTimeout(() => dropdownInputRef.current?.focus(), 0);
    }
  }, [mention]);

  const closeMention = () => {
    setMention(null);
    setDropdownQuery('');
    setActiveIdx(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const selectOption = (opt: MentionOption) => {
    if (!mention) return;
    const insert = `${mention.trigger}${opt.value} `;
    const before = value.slice(0, mention.insertAt);
    const after = value.slice(mention.insertAt);
    const next = before + insert + after;
    onChange(next);
    setMention(null);
    setDropdownQuery('');
    setActiveIdx(0);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const pos = before.length + insert.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    });
  };

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    const pos = e.target.selectionStart ?? v.length;
    // Detect if the last typed char is a trigger
    const lastChar = v[pos - 1];
    if ((lastChar === '/' || lastChar === '@' || lastChar === '#') && !mention) {
      // Open dropdown, remove the trigger char from textarea value
      const before = v.slice(0, pos - 1);
      const after = v.slice(pos);
      onChange(before + after);
      setMention({ trigger: lastChar as Trigger, insertAt: pos - 1 });
      setDropdownQuery('');
      setActiveIdx(0);
    } else {
      onChange(v);
    }
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !mention && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleDropdownInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDropdownQuery(e.target.value);
    setActiveIdx(0);
  };

  const handleDropdownKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const opts = getOptions(mention, dropdownQuery);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, opts.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (opts[activeIdx]) selectOption(opts[activeIdx]);
      return;
    }
    if (e.key === 'Escape') { closeMention(); return; }
  };

  const opts = getOptions(mention, dropdownQuery);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        className={className ?? 'disc-input'}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={handleTextareaChange}
        onKeyDown={handleTextareaKeyDown}
      />

      {mention && (
        <div
          ref={dropdownRef}
          className="mention-dropdown mention-dropdown-panel"
          onMouseDown={e => e.preventDefault()}
        >
          {/* Header */}
          <div className="mention-panel-header" style={{ borderColor: 'var(--bg-4)' }}>
            <span className="mention-panel-title">{TRIGGER_LABELS[mention.trigger]}</span>
            <button
              className="mention-panel-close"
              onClick={closeMention}
              tabIndex={-1}
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Dedicated search input */}
          <div className="mention-panel-search-wrap">
            <svg className="mention-panel-search-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={dropdownInputRef}
              className="mention-panel-search"
              type="text"
              value={dropdownQuery}
              onChange={handleDropdownInputChange}
              onKeyDown={handleDropdownKeyDown}
              placeholder={`Search ${TRIGGER_LABELS[mention.trigger].toLowerCase()}…`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Options list */}
          <div className="mention-panel-list">
            {opts.length === 0 ? (
              <div className="mention-panel-empty">No matches</div>
            ) : (
              opts.map((o, i) => (
                <button
                  key={o.value}
                  className="mention-item"
                  data-active={i === activeIdx ? '1' : '0'}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={e => { e.preventDefault(); selectOption(o); }}
                >
                  {o.badge && <span className={`ibadge ${o.badgeClass ?? ''}`} style={{ fontSize: 8, width: 16, height: 16 }}>{o.badge}</span>}
                  <span className="mention-item-label">{o.value}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
