export const TILE = 8;
export const COLS = 120;
export const ROWS = 84;
export const VIEW_W = 160;
export const VIEW_H = 192;

export const T = {
  AIR: 0,
  ROCK: 1,
  LADDER: 2,
  PLATFORM: 3,
  WATER: 4,
} as const;

export type Tile = (typeof T)[keyof typeof T];

export type EntKind =
  | "gold"
  | "lantern"
  | "balloon"
  | "scorpion"
  | "bat"
  | "eel"
  | "condor"
  | "nia"
  | "ember"
  | "sun";

export type Spawn = {
  kind: EntKind;
  tx: number;
  /** Solid tile the feet stand on, or flight altitude tile for flyers. */
  feet: number;
  minTx?: number;
  maxTx?: number;
  amp?: number;
};

export type World = {
  tiles: Uint8Array;
  spawns: Spawn[];
  startTx: number;
  startFeet: number;
  exit: { tx: number; ty: number; w: number; h: number };
};

export type Mode = "title" | "play" | "hurt" | "return" | "pause" | "win";

export type Hud = {
  score: number;
  best: number;
  relics: [boolean, boolean, boolean];
  mode: Mode;
  hint: string;
  time: number;
};

export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
