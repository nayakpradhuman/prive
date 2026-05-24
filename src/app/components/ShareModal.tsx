import { useState } from 'react';

interface Props {
  sessionUrl: string | null;
  presenceCount: number;
  isCreating: boolean;
  fileName: string;
  onShare: () => void;
  onClose: () => void;
}

export function ShareModal({ sessionUrl, presenceCount, isCreating, fileName, onShare, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!sessionUrl) return;
    await navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-modal">
        {/* Header */}
        <div className="share-modal-head">
          <div className="share-modal-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <div>
            <div className="share-modal-title">Collaborate</div>
            <div className="share-modal-sub">Share this file with your team for live discussion sync</div>
          </div>
          <button className="share-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* File being shared */}
        <div className="share-file-row">
          <div className="share-file-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </div>
          <span className="share-file-name">{fileName}</span>
        </div>

        {/* Session link area */}
        {!sessionUrl ? (
          <div className="share-generate">
            <p className="share-generate-hint">
              Generate a live collaboration link. Anyone with the link can view the file and post to the discussion in real-time.
            </p>
            <button className="share-generate-btn" onClick={onShare} disabled={isCreating}>
              {isCreating ? (
                <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> Uploading…</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg> Generate collaboration link</>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Live indicator */}
            <div className="share-live-row">
              <span className="share-live-dot" />
              <span className="share-live-label">Live session active</span>
              <span className="share-presence">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                {presenceCount} online
              </span>
            </div>

            {/* URL field */}
            <div className="share-url-row">
              <input className="share-url-input" readOnly value={sessionUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
              <button className="share-copy-btn" onClick={copy}>
                {copied ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg> Copied!</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</>
                )}
              </button>
            </div>

            {/* Roles */}
            <div className="share-roles">
              <div className="share-role-card">
                <div className="share-role-icon share-role-dev">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
                  </svg>
                </div>
                <div>
                  <div className="share-role-name">Developer</div>
                  <div className="share-role-hint">Controls, code generation, inputs</div>
                </div>
              </div>
              <div className="share-role-sep">+</div>
              <div className="share-role-card">
                <div className="share-role-icon share-role-des">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div>
                  <div className="share-role-name">Designer</div>
                  <div className="share-role-hint">Preview, annotations, discussion</div>
                </div>
              </div>
            </div>

            <p className="share-sync-note">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-.07-5.79"/>
              </svg>
              Discussions sync in real-time for everyone on this link
            </p>
          </>
        )}
      </div>
    </div>
  );
}
