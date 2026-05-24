import { useState, useCallback, useRef, useEffect } from 'react';
import { Rive } from '@rive-app/webgl2';
import { RiveFileInfo, RiveInputInfo, DiscussionThread, BgMode, Align, RiveFit } from './types';
import { UploadZone } from './components/UploadZone';
import { PreviewStage } from './components/PreviewStage';
import { ControlsCard } from './components/ControlsCard';
import { CodeCard } from './components/CodeCard';
import { DiscussionPanel } from './components/DiscussionPanel';
import { ShareModal } from './components/ShareModal';
import { useCollabSession } from './hooks/useCollabSession';
import { Select } from './components/Select';
type AppTab = 'preview' | 'code';

const FIT_OPTS: { value: RiveFit; label: string }[] = [
  { value: 'contain',   label: 'Contain'    },
  { value: 'cover',     label: 'Cover'      },
  { value: 'fill',      label: 'Fill'       },
  { value: 'fitWidth',  label: 'Fit Width'  },
  { value: 'fitHeight', label: 'Fit Height' },
  { value: 'none',      label: 'None'       },
];

const ALIGNS: Align[] = ['tl','tc','tr','ml','mc','mr','bl','bc','br'];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const [prevBuffer, setPrevBuffer] = useState<ArrayBuffer | null>(null);
  const [riveInfo, setRiveInfo] = useState<RiveFileInfo | null>(null);
  const [riveInstance, setRiveInstance] = useState<Rive | null>(null);
  const [selectedArtboard, setSelectedArtboard] = useState('');
  const [selectedSM, setSelectedSM] = useState('');
  const [bgMode, setBgMode] = useState<BgMode>('auto');
  const [align, setAlign] = useState<Align>('mc');
  const [fit, setFit] = useState<RiveFit>('contain');
  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [tab, setTab] = useState<AppTab>('preview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [playing, setPlaying] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const fileRef = useRef<File | null>(null);
  const infoSetRef = useRef(false);
  const pendingDiscussions = useRef<DiscussionThread[] | null>(null);

  const collab = useCollabSession();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Load session from URL on mount
  useEffect(() => {
    if (!collab.sessionId) return;
    setSessionLoading(true);
    collab.loadSession(collab.sessionId).then((data) => {
      if (!data) { setSessionLoading(false); return; }
      // Store discussions to apply after file loads
      pendingDiscussions.current = data.discussions;
      // Fetch file and load it
      fetch(data.fileUrl)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const f = new File([buf], data.fileName, { type: 'application/octet-stream' });
          handleFile(f, buf);
          setSessionLoading(false);
        })
        .catch(() => setSessionLoading(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab.sessionId]);

  // Subscribe to real-time when we have a session + file
  useEffect(() => {
    if (!collab.sessionId || !file) return;
    collab.subscribeToSession(collab.sessionId, (incoming) => {
      setDiscussions(incoming);
    });
  }, [collab.sessionId, file]);

  // Apply pending discussions once riveInfo is available (after session file loads)
  useEffect(() => {
    if (riveInfo && pendingDiscussions.current !== null) {
      setDiscussions(pendingDiscussions.current);
      pendingDiscussions.current = null;
    }
  }, [riveInfo]);

  const handleFile = useCallback((f: File, buf: ArrayBuffer) => {
    fileRef.current = f;
    infoSetRef.current = false;
    setFile(f);
    setBuffer(buf);
    setRiveInfo(null);
    setRiveInstance(null);
    setSelectedArtboard('');
    setSelectedSM('');
    setDiscussions([]);
    setTab('preview');
    setPlaying(true);
  }, []);

  const handleInfoExtracted = useCallback((info: Omit<RiveFileInfo, 'fileName' | 'fileSize'>) => {
    const f = fileRef.current;
    if (!f) return;
    setRiveInfo({ ...info, fileName: f.name, fileSize: f.size });
    if (!infoSetRef.current) {
      infoSetRef.current = true;
      const firstAB = info.artboards[0] ?? '';
      const firstSM = info.stateMachinesByArtboard[firstAB]?.[0] ?? '';
      setSelectedArtboard(firstAB);
      setSelectedSM(firstSM);
    }
  }, []);

  const handleArtboardChange = (ab: string) => {
    setSelectedArtboard(ab);
    setSelectedSM(riveInfo?.stateMachinesByArtboard[ab]?.[0] ?? '');
  };

  // Sync discussions to session whenever they change
  const handleDiscussionsChange = useCallback((threads: DiscussionThread[]) => {
    setDiscussions(threads);
    if (collab.sessionId) collab.syncDiscussions(threads);
  }, [collab.sessionId, collab.syncDiscussions]);

  const togglePlay = () => {
    if (!riveInstance) return;
    playing ? riveInstance.pause() : riveInstance.play();
    setPlaying(p => !p);
  };

  const resetAnim = () => {
    if (!riveInstance) return;
    riveInstance.reset({ autoPlay: true });
    setPlaying(true);
  };

  const downloadFile = () => {
    if (!file || !buffer) return;
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareCreate = async () => {
    if (!file || !buffer) return;
    try {
      const id = await collab.createSession(file, buffer);
      // Persist existing discussions to new session
      if (discussions.length > 0) {
        collab.syncDiscussions(discussions);
      }
      // Subscribe to the new session
      collab.subscribeToSession(id, (incoming) => setDiscussions(incoming));
    } catch (e) {
      console.log('Share create error:', e);
    }
  };

  const allInputs: { ab: string; sm: string; inp: RiveInputInfo }[] = riveInfo
    ? Object.entries(riveInfo.stateMachinesByArtboard).flatMap(([ab, sms]) =>
        sms.flatMap(sm =>
          (riveInfo.inputsByStateMachine[`${ab}::${sm}`] ?? []).map(inp => ({ ab, sm, inp }))
        )
      )
    : [];

  if (sessionLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
        <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>Loading shared session…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav className="topnav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="nav-mark">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="var(--acc-fg)" />
            </svg>
          </div>
          <span className="nav-name">prive</span>
          {file && (
            <div className="nav-file" style={{ marginLeft: 4 }}>
              <span className="nav-dot" />
              <span className="nav-fn">{file.name}</span>
              <span className="nav-sz">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>
        <div className="nav-right">
          {file && (
            <>
              {/* Live session indicator */}
              {collab.sessionId && (
                <div className="nav-live-pill">
                  <span className="nav-live-dot" />
                  <span>Live</span>
                  <span className="nav-live-count">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    {collab.presenceCount}
                  </span>
                </div>
              )}
              <button className="nav-btn nav-btn-icon" onClick={downloadFile} title="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Download
              </button>
              <button
                className={`nav-btn nav-btn-icon${collab.sessionId ? ' nav-btn-live' : ''}`}
                onClick={() => setShowShare(true)}
                title="Collaborate"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {collab.sessionId ? 'Collab' : 'Share'}
              </button>
              <span className="nav-sep" />
              <button className="nav-btn" onClick={() => { setPrevFile(file); setPrevBuffer(buffer); setFile(null); setBuffer(null); setRiveInfo(null); setRiveInstance(null); }}>
                ↑ New file
              </button>
            </>
          )}
          <button className="nav-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </nav>

      {/* Share / Collaborate modal */}
      {showShare && file && (
        <ShareModal
          sessionUrl={collab.sessionUrl}
          presenceCount={collab.presenceCount}
          isCreating={collab.isCreating}
          fileName={file.name}
          onShare={handleShareCreate}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Page */}
      <div className="prive-page">
        {!file ? (
          <>
            {prevFile && prevBuffer && (
              <div className="prev-file-bar">
                <button
                  className="prev-file-btn"
                  onClick={() => { setFile(prevFile); setBuffer(prevBuffer); setPrevFile(null); setPrevBuffer(null); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15,18 9,12 15,6"/>
                  </svg>
                  Back to <strong>{prevFile.name}</strong>
                </button>
              </div>
            )}
            <UploadZone onFile={handleFile} />
          </>
        ) : (
          <>
            {/* Tab bar */}
            <div className="prive-tabs">
              <button className="prive-tab" data-on={tab === 'preview' ? '1' : '0'} onClick={() => setTab('preview')}>
                Preview
              </button>
              <button className="prive-tab" data-on={tab === 'code' ? '1' : '0'} onClick={() => setTab('code')}>
                Code
              </button>
              {riveInfo && (
                <div className="prive-tabs-stats">
                  <span>{riveInfo.artboards.length} artboard{riveInfo.artboards.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{Object.values(riveInfo.stateMachinesByArtboard).flat().length} SMs</span>
                  <span>·</span>
                  <span>{allInputs.length} inputs</span>
                </div>
              )}
            </div>

            <div className="prive-body">
              <div className="prive-main">

                {/* ── Preview tab ── */}
                {tab === 'preview' && (
                  <>
                    <div className="main-grid">
                      {/* Preview card with inline toolbar */}
                      <div className="preview-wrap">
                        <div className="preview-toolbar" style={{ borderColor: 'var(--bg-4)', justifyContent: 'space-between' }}>
                          {/* Left: Playback */}
                          {riveInstance ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button className={`play-btn-sm${playing ? '' : ' play-btn-sm-acc'}`} onClick={togglePlay}>
                                {playing ? (
                                  <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                                ) : (
                                  <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Play</>
                                )}
                              </button>
                              <button className="play-btn-sm" onClick={resetAnim}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/>
                                </svg>
                                Reset
                              </button>
                            </div>
                          ) : <div />}
                          {/* Right: Background + Alignment + Fit */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button className="bg-swatch-sm bg-swatch-sm-checker" data-on={bgMode === 'auto' ? '1' : '0'} title="Auto" onClick={() => setBgMode('auto')} />
                              <button className="bg-swatch-sm" data-on={bgMode === 'white' ? '1' : '0'} style={{ background: '#fff', borderColor: bgMode === 'white' ? 'var(--acc)' : 'var(--bg-4)' }} title="White" onClick={() => setBgMode('white')} />
                              <button className="bg-swatch-sm" data-on={bgMode === 'black' ? '1' : '0'} style={{ background: '#111', borderColor: bgMode === 'black' ? 'var(--acc)' : 'var(--bg-4)' }} title="Black" onClick={() => setBgMode('black')} />
                            </div>
                            <span className="preview-toolbar-sep" style={{ background: 'var(--bg-4)' }} />
                            <Select
                              value={fit}
                              options={FIT_OPTS}
                              onChange={v => setFit(v as RiveFit)}
                              title="Fit mode"
                            />
                            <span className="preview-toolbar-sep" style={{ background: 'var(--bg-4)' }} />
                            <div className="align-g9-sm">
                              {ALIGNS.map(a => (
                                <button key={a} className="align-c9-sm" data-on={align === a ? '1' : '0'} onClick={() => setAlign(a)} title={a}>
                                  <span className="align-c9-sm-dot" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <PreviewStage
                          buffer={buffer}
                          artboard={selectedArtboard}
                          stateMachine={selectedSM}
                          bgMode={bgMode}
                          align={align}
                          fit={fit}
                          fileKey={file.name + file.size}
                          onInfoExtracted={handleInfoExtracted}
                          onRiveReady={setRiveInstance}
                          onFile={handleFile}
                        />
                      </div>

                      {riveInfo && riveInstance && (
                        <ControlsCard
                          info={riveInfo}
                          rive={riveInstance}
                          selectedArtboard={selectedArtboard}
                          selectedSM={selectedSM}
                          onArtboardChange={handleArtboardChange}
                          onSMChange={setSelectedSM}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* ── Code tab ── */}
                {tab === 'code' && riveInfo && (
                  <CodeCard
                    info={riveInfo}
                    selectedArtboard={selectedArtboard}
                    selectedSM={selectedSM}
                    threads={discussions}
                    align={align}
                    fit={fit}
                    onFitChange={setFit}
                  />
                )}
              </div>

              {riveInfo && (
                <DiscussionPanel
                  threads={discussions}
                  info={riveInfo}
                  onThreadsChange={handleDiscussionsChange}
                  uploadBlob={collab.sessionId ? collab.uploadVoiceNote : undefined}
                  mobileOpen={discOpen}
                  onMobileClose={() => setDiscOpen(false)}
                />
              )}

              {/* Mobile FAB — hidden on desktop via CSS */}
              {riveInfo && (
                <button className="disc-fab" onClick={() => setDiscOpen(o => !o)} aria-label="Discussions">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {discussions.length > 0 && (
                    <span className="disc-fab-badge">{discussions.length}</span>
                  )}
                </button>
              )}
            </div>

            <div className="prive-footer">
              prive — Rive file previewer · WebGL2 renderer · {new Date().getFullYear()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
