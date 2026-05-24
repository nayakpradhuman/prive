import { useRef, useState } from 'react';

// Rive binary files begin with the ASCII magic "RIVE"
function isRiveBinary(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf, 0, 4);
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x56 && bytes[3] === 0x45;
}

interface Props { onFile: (f: File, buf: ArrayBuffer) => void; }

export function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [fileError, setFileError] = useState('');

  const load = async (f: File) => {
    setFileError('');
    const buf = await f.arrayBuffer();
    if (!isRiveBinary(buf)) {
      setFileError('Not a valid .riv file — the binary header does not match.');
      return;
    }
    onFile(f, buf);
  };

  const loadUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFetching(true);
    setUrlError('');
    try {
      const res = await fetch(trimmed);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (!isRiveBinary(buf)) throw new Error('Not a valid .riv file — the binary header does not match.');
      const raw = trimmed.split('?')[0];
      const name = raw.split('/').pop() || 'file.riv';
      const file = new File([buf], name.endsWith('.riv') ? name : `${name}.riv`, { type: 'application/octet-stream' });
      onFile(file, buf);
    } catch (e: any) {
      setUrlError(e?.message?.includes('Failed to fetch') ? 'Could not fetch — check the URL or CORS policy.' : `Error: ${e?.message ?? 'Unknown'}`);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8, color: 'var(--fg)' }}>
          Preview Rive files
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-2)' }}>
          Drop a <code style={{ fontFamily: 'var(--mono)', color: 'var(--acc)' }}>.riv</code> file to inspect artboards, state machines, and generate code.
        </p>
      </div>

      <div
        className={`upload-drop-zone${dragging ? ' hovering' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17,8 12,3 7,8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>
          {dragging ? 'Drop to load' : 'Drop your .riv file here'}
        </span>
        <button className="browse-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          Browse files
        </button>
        {fileError && <p className="url-load-error" style={{ marginTop: 8 }}>{fileError}</p>}
      </div>

      <div className="url-load-section">
        <div className="url-load-divider"><span>or load from URL</span></div>
        <div className="url-load-row">
          <input
            className="url-load-input"
            type="url"
            placeholder="https://cdn.example.com/animation.riv"
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError(''); }}
            onKeyDown={e => e.key === 'Enter' && loadUrl()}
            disabled={fetching}
          />
          <button className="url-load-btn" onClick={loadUrl} disabled={fetching || !url.trim()}>
            {fetching ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Load'}
          </button>
        </div>
        {urlError && <p className="url-load-error">{urlError}</p>}
      </div>

      

      <input ref={inputRef} type="file" accept=".riv" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} />
    </div>
  );
}
