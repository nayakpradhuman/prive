export type InputType = 'boolean' | 'number' | 'trigger';

export interface RiveInputInfo {
  name: string;
  type: InputType;
  defaultValue?: number | boolean;
}

export interface RiveEventInfo {
  name: string;
  type: 'general' | 'openUrl';
}

export interface RiveFileInfo {
  fileName: string;
  fileSize: number;
  artboards: string[];
  stateMachinesByArtboard: Record<string, string[]>;
  inputsByStateMachine: Record<string, RiveInputInfo[]>;
  animationsByArtboard: Record<string, string[]>;
  eventsByArtboard: Record<string, RiveEventInfo[]>;
  textRunsByArtboard: Record<string, string[]>;
}

export interface VoiceNote {
  id: string;
  url: string;
  duration: number;
  createdAt: number;
}

export type DiscussionEntityType = 'file' | 'artboard' | 'sm' | 'input';

export interface DiscussionComment {
  id: string;
  authorId?: string;
  text: string;
  voiceNotes: VoiceNote[];
  createdAt: number;
}

export interface DiscussionThread {
  id: string;
  authorId?: string;
  entityType: DiscussionEntityType | null;
  entityKey: string | null;   // 'file' | artboardName | 'ab::sm' | 'ab::sm::input'
  entityLabel: string;
  badge: string;
  badgeClass: string;
  annotationText: string;
  annotationVoiceNotes: VoiceNote[];
  comments: DiscussionComment[];
  createdAt: number;
}

export type CodeFramework = 'react' | 'js' | 'flutter' | 'swift' | 'kotlin' | 'html';

export type BgMode = 'auto' | 'white' | 'black';
export type Align = 'tl'|'tc'|'tr'|'ml'|'mc'|'mr'|'bl'|'bc'|'br';
export type RiveFit = 'contain' | 'cover' | 'fill' | 'fitWidth' | 'fitHeight' | 'none';
