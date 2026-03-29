export type TrackId = string;

export type Track = {
  id: TrackId;
  demoId?: string;
  isDemo?: boolean;
  title: string;
  sub?: string;
  aura: number;
  waveformPeaks?: number[];
  audioUrl?: string;
  artUrl?: string;
  artVideoUrl?: string;
  artGrad?: string;
  audioBlob?: Blob;
  artBlob?: Blob;
  persistedId?: string;
  missingAudio?: boolean;
  missingArt?: boolean;
  artworkSource?: "auto" | "user";
};

export type LoopRegion = {
  start: number;
  end: number;
  active: boolean;
  editing: boolean;
};

export type LoopMode = "off" | "track" | "region";

export type RepeatTrackMode = "off" | "loop-one" | "threepeat";
