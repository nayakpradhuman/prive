import { useState } from 'react';
import { DiscussionThread, DiscussionComment, RiveFileInfo, VoiceNote } from '../types';
import { VoiceRecorder } from './VoiceRecorder';
import { MentionInput, MentionOption } from './MentionInput';

function uid() { return Math.random().toString(36).slice(2); }
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMyUserId(): string {
  const key = 'prive-user-id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID().slice(0, 16);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function renderText(text: string) {
  const parts = text.split(/(\/?[\w.]+|@[\w.]+|#[\w.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('/')) return <span key={i} className="mention-tag mention-sm">{part}</span>;
    if (part.startsWith('@')) return <span key={i} className="mention-tag mention-ab">{part}</span>;
    if (part.startsWith('#')) return <span key={i} className="mention-tag mention-inp">{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

// ── Determine entity from first mention in text ──────────────────
function parseEntityFromText(text: string, info: RiveFileInfo): Pick<DiscussionThread, 'entityType' | 'entityKey' | 'entityLabel' | 'badge' | 'badgeClass'> {
  const smMatch = text.match(/\/([\w\s]+)/);
  const abMatch = text.match(/@([\w\s]+)/);
  const inpMatch = text.match(/#([\w\s]+)/);

  if (smMatch) {
    const smName = smMatch[1].trim();
    const ab = Object.keys(info.stateMachinesByArtboard).find(a => info.stateMachinesByArtboard[a].includes(smName)) ?? '';
    return { entityType: 'sm', entityKey: `${ab}::${smName}`, entityLabel: smName, badge: 'SM', badgeClass: 'sm-badge' };
  }
  if (abMatch) {
    const abName = abMatch[1].trim();
    return { entityType: 'artboard', entityKey: abName, entityLabel: abName, badge: 'AB', badgeClass: 'ab-badge' };
  }
  if (inpMatch) {
    const inpName = inpMatch[1].trim();
    return { entityType: 'input', entityKey: inpName, entityLabel: inpName, badge: '#', badgeClass: 'inp-badge' };
  }
  return { entityType: null, entityKey: null, entityLabel: '', badge: '', badgeClass: '' };
}

// ── Build mention option lists ───────────────────────────────────
function buildOptions(info: RiveFileInfo) {
  const sms: MentionOption[] = Object.entries(info.stateMachinesByArtboard).flatMap(([, sms]) =>
    sms.map(sm => ({ label: sm, value: sm, badge: 'SM', badgeClass: 'sm-badge' }))
  );
  const artboards: MentionOption[] = info.artboards.map(ab => ({ label: ab, value: ab, badge: 'AB', badgeClass: 'ab-badge' }));
  const inputs: MentionOption[] = Object.values(info.inputsByStateMachine).flat().map(i => ({
    label: i.name, value: i.name,
    badge: i.type === 'boolean' ? 'B' : i.type === 'number' ? 'N' : 'T',
    badgeClass: i.type === 'boolean' ? 'ib-b' : i.type === 'number' ? 'ib-n' : 'ib-t',
  }));
  return { sms, artboards, inputs };
}

// ── Comment component ────────────────────────────────────────────
function Comment({ comment, isMine, onDelete }: { comment: DiscussionComment; isMine: boolean; onDelete: () => void }) {
  return (
    <div className={`disc-comment ${isMine ? 'disc-comment--mine' : 'disc-comment--other'}`}>
      {!isMine && <span className="disc-comment-who">Other</span>}
      <div className="disc-comment-bubble">
        {comment.text ? <div className="disc-comment-text">{renderText(comment.text)}</div> : null}
        {comment.voiceNotes.map((n) => (
          <div key={n.id} className="disc-vn">
            <span className="disc-vn-icon">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
            </span>
            <audio className="disc-vn-audio" src={n.url} controls />
            <span className="disc-vn-dur">{Math.floor(n.duration / 60)}:{String(n.duration % 60).padStart(2, '0')}</span>
          </div>
        ))}
      </div>
      <div className="disc-comment-meta">
        {isMine && <span className="disc-comment-who disc-comment-who--mine">You</span>}
        <span className="disc-comment-time">{fmtTime(comment.createdAt)}</span>
        <button className="disc-comment-del" onClick={onDelete} title="Delete">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Thread component ─────────────────────────────────────────────
function Thread({ thread, info, myUserId, onUpdate, onDelete, uploadBlob }: {
  thread: DiscussionThread;
  info: RiveFileInfo;
  myUserId: string;
  onUpdate: (t: DiscussionThread) => void;
  onDelete: () => void;
  uploadBlob?: (id: string, blob: Blob) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const [annotDraft, setAnnotDraft] = useState(thread.annotationText);
  const [commentText, setCommentText] = useState('');
  const [commentVoices, setCommentVoices] = useState<VoiceNote[]>([]);

  const { sms, artboards, inputs } = buildOptions(info);

  const saveAnnotation = () => {
    onUpdate({ ...thread, annotationText: annotDraft });
    setEditingAnnotation(false);
  };

  const addComment = () => {
    if (!commentText.trim() && commentVoices.length === 0) return;
    const comment: DiscussionComment = {
      id: uid(), authorId: myUserId, text: commentText.trim(), voiceNotes: commentVoices, createdAt: Date.now(),
    };
    onUpdate({ ...thread, comments: [...thread.comments, comment] });
    setCommentText('');
    setCommentVoices([]);
  };

  const deleteComment = (cid: string) =>
    onUpdate({ ...thread, comments: thread.comments.filter(c => c.id !== cid) });

  return (
    <div className="disc-thread">
      <div className="disc-thread-head" onClick={() => setExpanded(e => !e)}>
        <div className="disc-thread-meta">
          {thread.badge && (
            <span className={`disc-badge ${thread.badgeClass}`}>{thread.badge}</span>
          )}
          <span className="disc-thread-label">
            {thread.entityLabel || 'General'}
          </span>
          {thread.comments.length > 0 && (
            <span className="disc-reply-count">{thread.comments.length}</span>
          )}
        </div>
        <div className="disc-thread-actions">
          <button className="disc-icon-btn" onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete thread">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--fg-3)', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="disc-thread-body">
          {/* Annotation text */}
          {editingAnnotation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MentionInput
                value={annotDraft}
                onChange={setAnnotDraft}
                rows={3}
                className="disc-input"
                smOptions={sms}
                artboardOptions={artboards}
                inputOptions={inputs}
                placeholder="Describe this annotation…"
              />
              <VoiceRecorder compact
                notes={thread.annotationVoiceNotes}
                onChange={notes => onUpdate({ ...thread, annotationVoiceNotes: notes })}
                uploadBlob={uploadBlob}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button className="ann-cancel" onClick={() => { setAnnotDraft(thread.annotationText); setEditingAnnotation(false); }}>Cancel</button>
                <button className="ann-save-btn" onClick={saveAnnotation}>Save</button>
              </div>
            </div>
          ) : (
            <div className="disc-annotation" onClick={() => { setAnnotDraft(thread.annotationText); setEditingAnnotation(true); }}>
              {thread.annotationText ? (
                <span className="disc-ann-text">{renderText(thread.annotationText)}</span>
              ) : (
                <span className="disc-ann-placeholder">Add annotation…</span>
              )}
              <span className="disc-ann-edit-icon">✎</span>
            </div>
          )}

          {/* Annotation voice notes (show when not editing) */}
          {!editingAnnotation && thread.annotationVoiceNotes.length > 0 && thread.annotationVoiceNotes.map(n => (
            <div key={n.id} className="disc-vn">
              <span className="disc-vn-icon">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
              </span>
              <audio className="disc-vn-audio" src={n.url} controls />
            </div>
          ))}

          {/* Comments */}
          {thread.comments.length > 0 && (
            <div className="disc-comments">
              {thread.comments.map(c => (
                <Comment key={c.id} comment={c} isMine={c.authorId === myUserId} onDelete={() => deleteComment(c.id)} />
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="disc-reply-area">
            <MentionInput
              value={commentText}
              onChange={setCommentText}
              onSubmit={addComment}
              rows={2}
              className="disc-input"
              smOptions={sms}
              artboardOptions={artboards}
              inputOptions={inputs}
              placeholder="Reply… use / for SM, @ for artboard, # for input"
            />
            <div className="disc-reply-bar">
              <VoiceRecorder compact notes={commentVoices} onChange={setCommentVoices} uploadBlob={uploadBlob} />
              <button className="disc-send-btn" onClick={addComment} disabled={!commentText.trim() && commentVoices.length === 0}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compose new thread ───────────────────────────────────────────
function ComposeThread({ info, myUserId, onAdd, uploadBlob }: { info: RiveFileInfo; myUserId: string; onAdd: (t: DiscussionThread) => void; uploadBlob?: (id: string, blob: Blob) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<VoiceNote[]>([]);
  const { sms, artboards, inputs } = buildOptions(info);

  const submit = () => {
    if (!text.trim() && voices.length === 0) return;
    const entity = parseEntityFromText(text, info);
    const thread: DiscussionThread = {
      id: uid(),
      authorId: myUserId,
      ...entity,
      annotationText: text.trim(),
      annotationVoiceNotes: voices,
      comments: [],
      createdAt: Date.now(),
    };
    onAdd(thread);
    setText('');
    setVoices([]);
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="disc-compose-btn" onClick={() => setOpen(true)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New discussion
      </button>
    );
  }

  return (
    <div className="disc-compose-form">
      <div className="disc-compose-hint">
        Use <span className="mention-tag mention-sm">/SM</span> &nbsp;
        <span className="mention-tag mention-ab">@Artboard</span> &nbsp;
        <span className="mention-tag mention-inp">#Input</span> to tag
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={submit}
          rows={2}
          className="disc-input"
          smOptions={sms}
          artboardOptions={artboards}
          inputOptions={inputs}
          placeholder="Describe your annotation or note…"
        />
        <VoiceRecorder compact notes={voices} onChange={setVoices} uploadBlob={uploadBlob} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', paddingTop: 2 }}>
        <button className="disc-send-btn" onClick={submit} disabled={!text.trim() && voices.length === 0}>Post</button>
        <button className="ann-cancel" onClick={() => { setOpen(false); setText(''); setVoices([]); }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────
interface Props {
  threads: DiscussionThread[];
  info: RiveFileInfo;
  onThreadsChange: (threads: DiscussionThread[]) => void;
  uploadBlob?: (id: string, blob: Blob) => Promise<string>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DiscussionPanel({ threads, info, onThreadsChange, uploadBlob, mobileOpen, onMobileClose }: Props) {
  const myUserId = getMyUserId();

  const updateThread = (id: string, updated: DiscussionThread) =>
    onThreadsChange(threads.map(t => t.id === id ? updated : t));

  const deleteThread = (id: string) =>
    onThreadsChange(threads.filter(t => t.id !== id));

  const addThread = (t: DiscussionThread) =>
    onThreadsChange([...threads, t]);

  return (
    <>
      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div className="disc-backdrop" onClick={onMobileClose} />
      )}
    <div className={`disc-panel${mobileOpen ? ' disc-panel-open' : ''}`}>
      <div className="disc-head">
        <div className="disc-drag-handle" />
        <span className="disc-title">Discussion</span>
        {threads.length > 0 && (
          <span className="disc-count">{threads.length}</span>
        )}
        {onMobileClose && (
          <button className="disc-mobile-close" onClick={onMobileClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      <div className="disc-body">
        {threads.length === 0 ? (
          <div className="disc-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-3)', marginBottom: 8 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No discussions yet.</p>
            <p style={{ marginTop: 4 }}>Start a thread to annotate state machines, artboards, or inputs for your team.</p>
          </div>
        ) : (
          <>
            <div className="disc-body-label">
              <span className="disc-body-label-text">Threads</span>
              <span className="disc-body-label-line" />
            </div>
            <div className="disc-threads-grid">
              {threads.map(thread => (
                <Thread
                  key={thread.id}
                  thread={thread}
                  info={info}
                  myUserId={myUserId}
                  onUpdate={updated => updateThread(thread.id, updated)}
                  onDelete={() => deleteThread(thread.id)}
                  uploadBlob={uploadBlob}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="disc-compose" style={{ borderColor: 'var(--bg-4)' }}>
        <div className="disc-compose-zone-label">
          <span className="disc-compose-zone-label-text">New Thread</span>
          <span className="disc-compose-zone-label-line" style={{ background: 'var(--bg-4)' }} />
        </div>
        <div className="disc-compose-inner">
          <ComposeThread info={info} myUserId={myUserId} onAdd={addThread} uploadBlob={uploadBlob} />
        </div>
      </div>
    </div>
    </>
  );
}
