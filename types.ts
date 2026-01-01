export interface ShortScript {
  topic: string;
  title: string;
  description: string;
  hook: string;
  body: string;
  cta: string;
  tags: string[];
  visualKeywords: string[]; // Keywords to search for stock footage
  mood: 'energetic' | 'scary' | 'calm' | 'dramatic';
}

export interface GeneratedAsset {
  script: ShortScript;
  videoSegments: VideoSegment[];
  audioUrl: string; // Blob URL
  captions: CaptionWord[];
}

export interface VideoSegment {
  url: string;
  duration: number;
}

export interface CaptionWord {
  text: string;
  startTime: number;
  endTime: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  FETCHING_VIDEOS = 'FETCHING_VIDEOS',
  GENERATING_VOICEOVER = 'GENERATING_VOICEOVER',
  RENDERING_VIDEO = 'RENDERING_VIDEO',
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface YouTubeUser {
  name: string;
  picture: string;
  channelId?: string;
}

export type ChannelProfile = YouTubeUser;