export type TrackId = string;

export type Track = {
  id: TrackId;
  title: string;
  sub?: string;
  aura: number;
  audioUrl?: string;
  artUrl?: string;
  artGrad?: string;
  audioBlob?: Blob;
  artBlob?: Blob;
  persistedNumericId?: number;
};

export type LoopRegion = {
  start: number;
  end: number;
  active: boolean;
  editing: boolean;
};
