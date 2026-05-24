import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { DiscussionThread } from '../types';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-1f7adb85`;
const authHeader = { Authorization: `Bearer ${publicAnonKey}` };

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export interface CollabSession {
  sessionId: string | null;
  presenceCount: number;
  isCreating: boolean;
  createSession: (file: File, buffer: ArrayBuffer) => Promise<string>;
  loadSession: (id: string) => Promise<{ fileUrl: string; fileName: string; discussions: DiscussionThread[] } | null>;
  subscribeToSession: (id: string, onDiscussions: (d: DiscussionThread[]) => void) => void;
  syncDiscussions: (discussions: DiscussionThread[]) => void;
  uploadVoiceNote: (noteId: string, blob: Blob) => Promise<string>;
  sessionUrl: string | null;
}

export function useCollabSession(): CollabSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [presenceCount, setPresenceCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myKey = useRef(crypto.randomUUID().slice(0, 8));

  // Read session from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('session');
    if (id) setSessionId(id);
  }, []);

  const subscribeToSession = useCallback((id: string, onDiscussions: (d: DiscussionThread[]) => void) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`prive-session-${id}`, {
      config: { presence: { key: myKey.current } },
    });

    channel
      .on('broadcast', { event: 'discussions' }, ({ payload }) => {
        if (payload?.discussions) onDiscussions(payload.discussions);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joinedAt: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
  }, []);

  const syncDiscussions = useCallback((discussions: DiscussionThread[]) => {
    if (!sessionId) return;

    // Broadcast instantly to all peers
    channelRef.current?.send({
      type: 'broadcast',
      event: 'discussions',
      payload: { discussions },
    });

    // Persist to server (fire and forget)
    fetch(`${SERVER}/sessions/${sessionId}/discussions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ discussions }),
    }).catch((e) => console.log('Persist discussions error:', e));
  }, [sessionId]);

  const createSession = useCallback(async (file: File, buffer: ArrayBuffer): Promise<string> => {
    setIsCreating(true);
    try {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: 'application/octet-stream' }), file.name);
      const res = await fetch(`${SERVER}/sessions`, {
        method: 'POST',
        headers: authHeader,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session');
      const id = data.sessionId as string;
      setSessionId(id);

      // Push session ID into URL without reload
      const url = new URL(window.location.href);
      url.searchParams.set('session', id);
      window.history.pushState({}, '', url.toString());

      return id;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const uploadVoiceNote = useCallback(async (noteId: string, blob: Blob): Promise<string> => {
    if (!sessionId) throw new Error('No active session');
    const form = new FormData();
    form.append('file', blob, `${noteId}.webm`);
    form.append('noteId', noteId);
    const res = await fetch(`${SERVER}/sessions/${sessionId}/voice`, {
      method: 'POST',
      headers: authHeader,
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Voice upload failed');
    return data.url as string;
  }, [sessionId]);

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`${SERVER}/sessions/${id}`, { headers: authHeader });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      fileUrl: data.fileUrl as string,
      fileName: data.session.fileName as string,
      discussions: (data.discussions ?? []) as DiscussionThread[],
    };
  }, []);

  const sessionUrl = sessionId
    ? (() => {
        const url = new URL(window.location.href);
        url.searchParams.set('session', sessionId);
        return url.toString();
      })()
    : null;

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return { sessionId, presenceCount, isCreating, createSession, loadSession, subscribeToSession, syncDiscussions, uploadVoiceNote, sessionUrl };
}
