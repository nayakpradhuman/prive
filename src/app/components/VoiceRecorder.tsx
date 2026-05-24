import { useState, useRef, useEffect } from 'react';
import { VoiceNote } from '../types';

interface Props {
  notes: VoiceNote[];
  onChange: (notes: VoiceNote[]) => void;
  label?: string;
  compact?: boolean;
  uploadBlob?: (id: string, blob: Blob) => Promise<string>;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '00')}`;
}

export function VoiceRecorder({ notes, onChange, label, compact, uploadBlob }: Props) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  // Keep a ref to notes to avoid stale closures in the async onstop handler
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const id = Math.random().toString(36).slice(2);

        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setSeconds(0);

        let url: string;
        if (uploadBlob) {
          setUploading(true);
          try {
            url = await uploadBlob(id, blob);
          } catch {
            // Fallback to local blob URL if upload fails
            url = URL.createObjectURL(blob);
          } finally {
            setUploading(false);
          }
        } else {
          url = URL.createObjectURL(blob);
        }

        const note: VoiceNote = { id, url, duration, createdAt: Date.now() };
        onChange([...notesRef.current, note]);
      };
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      mr.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      // eslint-disable-next-line no-alert
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
  };

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    // Only revoke blob: URLs — signed https URLs don't need revocation
    if (note?.url.startsWith('blob:')) URL.revokeObjectURL(note.url);
    onChange(notes.filter(n => n.id !== id));
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div className="voice-section">
      {label && <div className={compact ? 'inp-group-label' : 'usage-label'}>{label}</div>}

      {notes.map((n, i) => (
        <div key={n.id} className="voice-note">
          <span className="vn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </span>
          <div className="vn-info">
            <span className="vn-label">Note {i + 1}</span>
            <span className="vn-time">{fmt(n.duration)}</span>
          </div>
          <audio className="vn-audio" src={n.url} controls />
          <button className="vn-del" onClick={() => deleteNote(n.id)} title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}

      {uploading && (
        <div className="voice-uploading">
          <span className="spinner" style={{ width: 12, height: 12 }} />
          <span>Uploading…</span>
        </div>
      )}

      {recording ? (
        <div className="voice-recording">
          <span className="rec-dot active" />
          <span className="rec-time">{fmt(seconds)}</span>
          <span className="rec-label">Recording…</span>
          <button className="rec-stop" onClick={stopRecording}>Stop</button>
        </div>
      ) : !uploading && (
        <button className="voice-record-btn" onClick={startRecording}>
          <span className="rec-dot" />
          Record voice note
        </button>
      )}
    </div>
  );
}
