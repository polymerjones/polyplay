export type TrackId = string;

export type Track = {
  id: TrackId;
  title: string;
  sub?: string;
  aura: number;
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
