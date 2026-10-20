import { Sound } from "./audio";
import { buildWorld } from "./level";
import { bakeSheet, drawSprite, type Sheet } from "./sprites";
import {
  COLS,
  ROWS,
  T,
  TILE,
  VIEW_H,
  VIEW_W,
  type EntKind,
  type Hud,
  type Mode,
  type Spawn,
  type World,
} from "./types";

const PW = 8;
const PH = 14;
const RUN = 72;
const JUMP_V = -165;
const G_UP = 340;
const G_DOWN = 900;
const G_APEX = 190;
const COYOTE = 0.11;
const BUFFER = 0.12;
const STEP = 1 / 60;

type Ent = {
  kind: EntKind;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  phase: number;
  originX: number;
  originY: number;
  minX: number;
  maxX: number;
  amp: number;
  alive: boolean;
  held: boolean;
  returning: boolean;
  lit: boolean;
  id: number;
};

type Part = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  grav: number;
  on: boolean;
};

type Pop = { x: number; y: number; life: number; text: string; on: boolean };

export type GameApi = {
  destroy: () => void;
  unlock: () => void;
  start: () => void;
  togglePause: () => void;
  restart: () => void;
  setHeld: (code: string, on: boolean) => void;
  toggleMute: () => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  paintMap: (canvas: HTMLCanvasElement) => void;
};

const DIGITS: Record<string, string> = {
  "0": "111101101101111",
  "1": "010010010010010",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001001001001",
  "8": "111101111101111",
  "9": "111101111001111",
  "+": "010010111010010",
};

function hash(a: number, b: number, c = 0): number {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function sizeOf(kind: EntKind): { w: number; h: number } {
  switch (kind) {
    case "gold":
      return { w: 8, h: 6 };
    case "lantern":
      return { w: 8, h: 12 };
    case "balloon":
      return { w: 12, h: 18 };
    case "scorpion":
      return { w: 12, h: 8 };
    case "bat":
      return { w: 12, h: 6 };
    case "eel":
      return { w: 14, h: 5 };
    case "condor":
      return { w: 14, h: 8 };
    case "nia":
      return { w: 10, h: 14 };
    case "ember":
      return { w: 14, h: 10 };
    case "sun":
      return { w: 8, h: 10 };
  }
}

function approach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(target, v + delta);
  if (v > target) return Math.max(target, v - delta);
  return target;
}

declare global {
  interface Window {
    __controlsTest?: {
      setKeys: (codes: string[]) => void;
      getX: () => number;
      getY: () => number;
      getSpeed: () => number;
      getFacing: () => number;
      getMode: () => string;
    };
  }
}

export function createGame(
  canvas: HTMLCanvasElement,
  hooks: {
    onHud: (hud: Hud) => void;
    onSettings: (s: { music: number; sfx: number; muted: boolean }) => void;
  },
): GameApi {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const ctx: CanvasRenderingContext2D = context;
  ctx.imageSmoothingEnabled = false;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  const world: World = buildWorld();
  const tiles = world.tiles;
  const sheet: Sheet = bakeSheet();
  const worldCanvas = bakeWorld(tiles);
  const sound = new Sound();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const held = new Set<string>();
  let override: Set<string> | null = null;
  const shown = new Set<string>();
  const parts: Part[] = Array.from({ length: 100 }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: "#fff", grav: 0, on: false,
  }));
  const pops: Pop[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, life: 0, text: "", on: false }));

  const player = {
    x: 0, y: 0, w: PW, h: PH, vx: 0, vy: 0, facing: 1,
    grounded: true, climbing: false, onBalloon: -1, coyote: COYOTE,
    landT: 0, dropT: 0, climbLock: 0, balloonLock: 0, cut: false, wasSwim: false,
  };

  let ents: Ent[] = [];
  let mode: Mode = "title";
  let score = 0;
  let best = 0;
  let bank = 0;
  let cpX = 0;
  let cpY = 0;
  let cpId = -1;
  let relics: [boolean, boolean, boolean] = [false, false, false];
  let hint = "";
  let hintT = 0;
  let runTime = 0;
  let anim = 0;
  let invuln = 0;
  let hurtT = 0;
  let trauma = 0;
  let flash = 0;
  let frameN = 0;
  let camX = 0;
  let camY = 0;
  let retT = 0;
  let retDur = 1;
  let retSX = 0;
  let retSY = 0;
  let retScore0 = 0;
  let wispX = 0;
  let wispY = 0;
  let lastThou = 0;
  let jumpPrev = false;
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let dead = false;
  let pubKey = "";
  const visited = new Uint8Array(COLS * ROWS);

  function tileAt(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.ROCK;
    return tiles[ty * COLS + tx] ?? T.ROCK;
  }
  function solid(tx: number, ty: number): boolean {
    return tileAt(tx, ty) === T.ROCK;
  }
  function waterAt(tx: number, ty: number): boolean {
    return tileAt(tx, ty) === T.WATER;
  }
  function platformAt(tx: number, ty: number): boolean {
    return tileAt(tx, ty) === T.PLATFORM;
  }

  function load() {
    try {
      const raw = localStorage.getItem("hollowfall-v1");
      if (!raw) return;
      const p = JSON.parse(raw) as { best?: number; music?: number; sfx?: number; muted?: boolean };
      if (typeof p.best === "number") best = p.best;
      if (typeof p.music === "number") sound.musicVol = p.music;
      if (typeof p.sfx === "number") sound.sfxVol = p.sfx;
      if (typeof p.muted === "boolean") sound.muted = p.muted;
    } catch {
      /* ignore broken saves */
    }
    sound.setMusic(sound.musicVol);
    sound.setSfx(sound.sfxVol);
    sound.setMuted(sound.muted);
    hooks.onSettings({ music: sound.musicVol, sfx: sound.sfxVol, muted: sound.muted });
  }

  function save() {
    localStorage.setItem(
      "hollowfall-v1",
      JSON.stringify({ best, music: sound.musicVol, sfx: sound.sfxVol, muted: sound.muted }),
    );
  }

  function spawnEnt(s: Spawn, id: number): Ent {
    const { w, h } = sizeOf(s.kind);
    const fly = s.kind === "bat" || s.kind === "eel" || s.kind === "condor";
    const y = fly ? s.feet * TILE - h / 2 : s.feet * TILE - h;
    const x = s.tx * TILE + (TILE - w) / 2;
    return {
      kind: s.kind, x, y, w, h, dir: id % 2 === 0 ? 1 : -1, phase: id,
      originX: x, originY: y,
      minX: (s.minTx ?? s.tx) * TILE,
      maxX: ((s.maxTx ?? s.tx) + 1) * TILE,
      amp: s.amp ?? 0,
      alive: true, held: false, returning: false, lit: false, id,
    };
  }

  function reset() {
    ents = world.spawns.map(spawnEnt);
    player.x = world.startTx * TILE;
    player.y = world.startFeet * TILE - PH;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.grounded = true;
    player.climbing = false;
    player.onBalloon = -1;
    player.coyote = COYOTE;
    player.cut = false;
    player.wasSwim = false;
    score = 0;
    bank = 0;
    cpX = player.x;
    cpY = player.y;
    cpId = -1;
    relics = [false, false, false];
    runTime = 0;
    invuln = 0;
    hint = "";
    hintT = 0;
    shown.clear();
    visited.fill(0);
    for (const p of parts) p.on = false;
    for (const p of pops) p.on = false;
    camX = player.x - 30;
    camY = Math.max(0, player.y - 70);
  }

  function publish() {
    const key = `${mode}|${score}|${best}|${relics.join("")}|${hint}|${Math.floor(runTime)}`;
    if (key === pubKey) return;
    pubKey = key;
    hooks.onHud({
      score, best, relics: [relics[0], relics[1], relics[2]], mode, hint, time: runTime,
    });
  }

  function say(text: string, key?: string) {
    if (key) {
      if (shown.has(key)) return;
      shown.add(key);
    }
    hint = text;
    hintT = 3.5;
  }

  function burst(x: number, y: number, n: number, color: string, speed: number, grav = 40) {
    let left = n;
    for (const p of parts) {
      if (p.on) continue;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      p.on = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - speed * 0.35;
      p.life = p.max = 0.28 + Math.random() * 0.35;
      p.color = color;
      p.grav = grav;
      if (--left <= 0) break;
    }
  }

  function popup(x: number, y: number, text: string) {
    const p = pops.find((q) => !q.on);
    if (!p) return;
    p.on = true;
    p.x = x;
    p.y = y;
    p.life = 0.85;
    p.text = text;
  }

  function award(n: number) {
    score += n;
    if (score > best) {
      best = score;
      save();
    }
  }

  function overlapSolid(x: number, y: number, w: number, h: number, insetX: number, insetY: number): boolean {
    const x0 = Math.floor((x + insetX) / TILE);
    const x1 = Math.floor((x + w - 1e-3 - insetX) / TILE);
    const y0 = Math.floor((y + insetY) / TILE);
    const y1 = Math.floor((y + h - 1e-3 - insetY) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
    }
    return false;
  }

  function moveX() {
    player.x += player.vx * STEP;
    if (!overlapSolid(player.x, player.y, player.w, player.h, 0, 2)) return;
    if (player.vx > 0) {
      const tx = Math.floor((player.x + player.w - 1e-3) / TILE);
      player.x = tx * TILE - player.w;
    } else if (player.vx < 0) {
      const tx = Math.floor(player.x / TILE);
      player.x = (tx + 1) * TILE;
    }
    player.vx = 0;
  }

  function moveY() {
    const oldY = player.y;
    const prevVy = player.vy;
    player.y += player.vy * STEP;
    if (overlapSolid(player.x, player.y, player.w, player.h, 1, 0)) {
      if (player.vy >= 0) {
        const ty = Math.floor((player.y + player.h - 1e-3) / TILE);
        player.y = ty * TILE - player.h;
        if (prevVy > 90) {
          sound.land();
          burst(player.x + 4, player.y + player.h, 5, "#c4924a", 22, 80);
          player.landT = 0.08;
          trauma = Math.max(trauma, 0.18);
        }
        player.vy = 0;
        player.grounded = true;
      } else {
        const ty = Math.floor(player.y / TILE);
        player.y = (ty + 1) * TILE;
        player.vy = 0;
      }
    }
    if (player.vy >= 0 && player.dropT <= 0) {
      const x0 = Math.floor((player.x + 1) / TILE);
      const x1 = Math.floor((player.x + player.w - 2) / TILE);
      const ty = Math.floor((player.y + player.h - 1e-3) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (!platformAt(tx, ty)) continue;
        const top = ty * TILE;
        if (oldY + player.h <= top + 1.25 && player.y + player.h >= top) {
          player.y = top - player.h;
          if (prevVy > 90) {
            sound.land();
            player.landT = 0.08;
          }
          player.vy = 0;
          player.grounded = true;
        }
      }
    }
  }

  function probe(): boolean {
    const y = player.y + player.h + 0.6;
    const ty = Math.floor(y / TILE);
    const x0 = Math.floor((player.x + 1) / TILE);
    const x1 = Math.floor((player.x + player.w - 2) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (solid(tx, ty)) return true;
      if (player.dropT <= 0 && platformAt(tx, ty)) return true;
    }
    return false;
  }

  function ladderCol(): number | null {
    const x0 = Math.floor((player.x + 1) / TILE);
    const x1 = Math.floor((player.x + player.w - 2) / TILE);
    const y0 = Math.floor(player.y / TILE);
    const y1 = Math.floor((player.y + player.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T.LADDER) return tx;
    }
    return null;
  }

  function waterState(): "dry" | "wade" | "swim" {
    const cx = Math.floor((player.x + player.w / 2) / TILE);
    const mid = Math.floor((player.y + player.h * 0.42) / TILE);
    const feet = Math.floor((player.y + player.h - 1) / TILE);
    if (waterAt(cx, mid)) return "swim";
    if (waterAt(cx, feet)) return "wade";
    return "dry";
  }

  function doJump() {
    player.vy = JUMP_V;
    player.grounded = false;
    player.coyote = 0;
    player.cut = false;
    sound.jump();
    burst(player.x + 4, player.y + player.h, 3, "#e6c98a", 16, 20);
  }

  function releaseBalloon(jumpOff: boolean, dir: number) {
    const b = ents[player.onBalloon];
    if (b) {
      b.held = false;
      b.returning = true;
    }
    player.onBalloon = -1;
    player.balloonLock = 0.18;
    player.vy = jumpOff ? -80 : 30;
    player.vx = dir * RUN;
  }

  function hurt() {
    if (invuln > 0 || mode !== "play") return;
    mode = "hurt";
    hurtT = 0.08;
    trauma = 0.8;
    flash = 1;
    player.climbing = false;
    if (player.onBalloon >= 0) releaseBalloon(false, 0);
    sound.hurt();
  }

  function beginReturn() {
    mode = "return";
    retSX = player.x + player.w / 2;
    retSY = player.y + player.h / 2;
    const dist = Math.hypot(cpX + PW / 2 - retSX, cpY + PH / 2 - retSY);
    retDur = Math.min(2.3, Math.max(0.55, dist / 150));
    retT = 0;
    retScore0 = score;
    lastThou = Math.floor(score / 1000);
    wispX = retSX;
    wispY = retSY;
    sound.setMode("return");
  }

  function overlaps(a: Ent, pad = 0): boolean {
    return (
      player.x < a.x + a.w - pad &&
      player.x + player.w > a.x + pad &&
      player.y < a.y + a.h - pad &&
      player.y + player.h > a.y + pad
    );
  }

  function updateEnemies(dt: number) {
    for (const e of ents) {
      if (!e.alive) continue;
      if (e.kind === "balloon") {
        if (e.held) continue;
        if (e.returning) {
          e.x += (e.originX - e.x) * Math.min(1, dt * 1.8);
          e.y += (e.originY - e.y) * Math.min(1, dt * 1.8);
          if (Math.hypot(e.originX - e.x, e.originY - e.y) < 1.2) {
            e.x = e.originX;
            e.y = e.originY;
            e.returning = false;
          }
        }
        continue;
      }
      if (e.kind === "scorpion") {
        const dir = e.dir;
        const next = e.x + dir * 26 * dt;
        const front = dir > 0 ? next + e.w : next;
        const foot = e.y + e.h + 0.5;
        const wall = solid(Math.floor(front / TILE), Math.floor((e.y + 2) / TILE));
        const floor = solid(Math.floor((dir > 0 ? next + e.w - 1 : next) / TILE), Math.floor(foot / TILE))
          || platformAt(Math.floor((dir > 0 ? next + e.w - 1 : next) / TILE), Math.floor(foot / TILE));
        if (wall || !floor || next < e.minX || next + e.w > e.maxX) e.dir = -dir;
        else e.x = next;
        continue;
      }
      if (e.kind === "bat" || e.kind === "eel") {
        e.phase += dt * (e.kind === "bat" ? 1.6 : 1.3);
        const speed = e.kind === "bat" ? 36 : 30;
        const next = e.x + e.dir * speed * dt;
        if (e.kind === "eel") {
          const tx = Math.floor((e.dir > 0 ? next + e.w : next) / TILE);
          const ty = Math.floor((e.y + e.h / 2) / TILE);
          if (!waterAt(tx, ty)) e.dir *= -1;
        }
        if (next < e.minX || next + e.w > e.maxX) e.dir *= -1;
        else e.x = next;
        e.y = e.originY + Math.sin(e.phase) * e.amp;
        continue;
      }
      if (e.kind === "condor") {
        e.phase += dt * 0.85;
        e.x = e.originX + Math.cos(e.phase) * 30;
        e.y = e.originY + Math.sin(e.phase * 1.5) * e.amp;
      }
    }
  }

  function updatePlay(dt: number, edge: boolean, buffered: boolean) {
    runTime += dt;
    invuln = Math.max(0, invuln - dt);
    player.dropT = Math.max(0, player.dropT - dt);
    player.climbLock = Math.max(0, player.climbLock - dt);
    player.balloonLock = Math.max(0, player.balloonLock - dt);
    player.landT = Math.max(0, player.landT - dt);
    if (hintT > 0) {
      hintT -= dt;
      if (hintT <= 0) hint = "";
    }

    const leftRight = (down("ArrowRight") || down("KeyD") ? 1 : 0) - (down("ArrowLeft") || down("KeyA") ? 1 : 0);
    const up = down("ArrowUp") || down("KeyW");
    const downKey = down("ArrowDown") || down("KeyS");
    const jumping = down("Space") || down("KeyZ") || down("KeyJ");
    if (leftRight !== 0) player.facing = leftRight;

    const water = waterState();
    if (water === "swim" && !player.wasSwim) {
      sound.splash();
      burst(player.x + 4, player.y, 6, "#7ec8f0", 20, -10);
      say("Swim with the stick. Jump where the water meets air.", "swim");
    }
    player.wasSwim = water === "swim";
    if (mode === "play") sound.setMode(water === "swim" ? "water" : "explore");

    if (player.onBalloon >= 0) {
      const b = ents[player.onBalloon];
      if (!b) player.onBalloon = -1;
      else {
        const nx = b.x + leftRight * 52 * dt;
        const ny = b.y - 44 * dt;
        const hang = (bx: number, by: number) => ({
          x: bx + b.w / 2 - player.w / 2,
          y: by + b.h - 4,
        });
        const h1 = hang(nx, b.y);
        if (!overlapSolid(h1.x, h1.y, player.w, player.h, 0, 0)) b.x = nx;
        const h2 = hang(b.x, ny);
        if (!overlapSolid(h2.x, h2.y, player.w, player.h, 0, 0)) b.y = ny;
        const h = hang(b.x, b.y);
        player.x = h.x;
        player.y = h.y;
        player.vx = leftRight * 52;
        player.vy = -44;
        player.climbing = false;
        if (edge || downKey) releaseBalloon(edge, leftRight);
        afterMove(dt);
        return;
      }
    }

    if (player.balloonLock <= 0 && !player.climbing && water !== "swim" && up) {
      for (const e of ents) {
        if (e.kind !== "balloon" || e.returning || !e.alive) continue;
        if (!overlaps(e, -2)) continue;
        e.held = true;
        player.onBalloon = e.id;
        player.climbing = false;
        player.vx = 0;
        player.vy = 0;
        sound.balloon();
        say("Up holds. Down or jump drops you.", "balloon");
        break;
      }
      if (player.onBalloon >= 0) {
        afterMove(dt);
        return;
      }
    }

    const col = ladderCol();
    if (player.climbing) {
      if (col === null) player.climbing = false;
      else {
        player.x = col * TILE + (TILE - player.w) / 2;
        player.vx = 0;
        if (edge) {
          player.climbing = false;
          player.climbLock = 0.16;
          player.vy = JUMP_V * 0.86;
          player.vx = leftRight * RUN;
          sound.jump();
        } else {
          player.vy = up ? -58 : downKey ? 58 : 0;
          moveY();
          player.grounded = probe();
          if (downKey && player.grounded && !up) player.climbing = false;
        }
        afterMove(dt);
        return;
      }
    } else if (col !== null && player.climbLock <= 0 && player.onBalloon < 0 && (up || (downKey && !player.grounded))) {
      player.climbing = true;
      player.vx = 0;
      player.vy = 0;
      say("Up and down climb. Jump lets go.", "ladder");
      afterMove(dt);
      return;
    }

    if (water === "swim") {
      player.climbing = false;
      const tx = leftRight;
      const ty = (downKey ? 1 : 0) - (up ? 1 : 0);
      player.vx = approach(player.vx, tx * 50, 220 * dt);
      player.vy = approach(player.vy, ty * 46, 220 * dt);
      const cx = Math.floor((player.x + player.w / 2) / TILE);
      const head = Math.floor((player.y - 1) / TILE);
      const headAir = !waterAt(cx, head);
      if (edge && headAir) {
        player.vy = JUMP_V * 0.92;
        player.wasSwim = false;
        sound.jump();
      } else if (headAir && player.vy < 0 && !up) player.vy = 0;
      moveX();
      moveY();
      player.grounded = false;
      if (Math.random() < 0.15) burst(player.x + 4, player.y + 4, 1, "#cfefff", 8, -20);
      afterMove(dt);
      return;
    }

    const wasGround = player.grounded;
    if (!wasGround) {
      const g = player.vy < 0 ? (player.vy > -42 ? G_APEX : G_UP) : G_DOWN;
      player.vy = Math.min(230, player.vy + g * dt);
    }
    const max = water === "wade" ? RUN * 0.72 : RUN;
    if (leftRight !== 0) player.vx = approach(player.vx, leftRight * max, (player.grounded ? 1600 : 900) * dt);
    else player.vx = approach(player.vx, 0, (player.grounded ? 1800 : 280) * dt);

    if (downKey && edge && player.grounded) player.dropT = 0.18;
    const canJump = (player.grounded || player.coyote > 0) && !(downKey && edge);
    if ((edge || buffered) && canJump) doJump();
    if (!jumping && player.vy < -30 && !player.cut) {
      player.vy *= 0.48;
      player.cut = true;
    }

    moveX();
    moveY();
    player.grounded = probe();
    if (player.grounded) {
      player.coyote = COYOTE;
      if (player.vy > 0) player.vy = 0;
    } else player.coyote = Math.max(0, player.coyote - dt);

    if (player.grounded && Math.abs(player.vx) > 24 && Math.floor(anim * 10) !== Math.floor((anim - dt) * 10)) {
      burst(player.x + player.w / 2, player.y + player.h, 1, "#6b3e16", 10, 30);
    }
    afterMove(dt);
  }

  let jumpBuffer = 0;

  function updatePlayFixed(dt: number) {
    const jumping = down("Space") || down("KeyZ") || down("KeyJ");
    const edge = jumping && !jumpPrev;
    jumpPrev = jumping;
    if (edge) jumpBuffer = BUFFER;
    else jumpBuffer = Math.max(0, jumpBuffer - dt);
    updatePlay(dt, edge, jumpBuffer > 0);
    if (player.vy < -10) jumpBuffer = 0;
  }

  function afterMove(dt: number) {
    if (mode !== "play") return;
    // pickups + hazards
    for (const e of ents) {
      if (!e.alive) continue;
      if (!overlaps(e, e.kind === "scorpion" || e.kind === "bat" || e.kind === "eel" || e.kind === "condor" ? 1 : 0)) continue;
      if (e.kind === "gold") {
        e.alive = false;
        award(4000);
        sound.gold();
        popup(e.x, e.y, "+4000");
        burst(e.x + 4, e.y, 8, "#ffd23a", 30, 50);
      } else if (e.kind === "lantern") {
        const moved = cpId !== e.id;
        if (moved || score > bank) {
          cpX = e.x + e.w / 2 - PW / 2;
          cpY = e.y + e.h - PH;
          cpId = e.id;
          if (score > bank) bank = score;
          e.lit = true;
          if (moved) {
            sound.lantern();
            burst(e.x + 4, e.y, 5, "#ffb000", 18, 10);
            say("Lantern keeps your score. A fall burns the rest.", "lantern");
          }
        }
      } else if (e.kind === "nia" || e.kind === "ember" || e.kind === "sun") {
        e.alive = false;
        const idx = e.kind === "nia" ? 0 : e.kind === "ember" ? 1 : 2;
        relics[idx] = true;
        award(15000);
        sound.relic();
        popup(e.x, e.y, "+15000");
        burst(e.x + 4, e.y, 14, e.kind === "ember" ? "#d5dde6" : "#ffd23a", 36, 40);
        trauma = Math.max(trauma, 0.35);
        const name = e.kind === "nia" ? "Nia" : e.kind === "ember" ? "Ember" : "The Sunstone";
        if (relics[0] && relics[1] && relics[2]) say(`${name} is yours. The rope at the mouth is lit.`, "rope");
        else say(`${name} found.`, `${e.kind}-got`);
      } else if (e.kind === "scorpion" || e.kind === "bat" || e.kind === "eel" || e.kind === "condor") {
        hurt();
        return;
      }
    }

    if (relics[0] && relics[1] && relics[2]) {
      const ex = world.exit.tx * TILE;
      const ey = world.exit.ty * TILE;
      const ew = world.exit.w * TILE;
      const eh = world.exit.h * TILE;
      if (player.x < ex + ew && player.x + player.w > ex && player.y < ey + eh && player.y + player.h > ey) {
        mode = "win";
        award(20000);
        sound.setMode("win");
        sound.relic();
        burst(player.x, player.y, 24, "#ffd23a", 40, 20);
        trauma = 0.5;
        return;
      }
    }

    const look = player.facing * 18;
    focus(dt, player.x + player.w / 2, player.y + player.h / 2, look);
    reveal();
  }

  function focus(dt: number, fx: number, fy: number, look: number) {
    const tx = fx - VIEW_W / 2 + look;
    const ty = fy - VIEW_H / 2 + 6;
    const k = 1 - Math.exp(-8 * dt);
    camX += (tx - camX) * k;
    camY += (ty - camY) * k;
    camX = Math.max(0, Math.min(COLS * TILE - VIEW_W, camX));
    camY = Math.max(0, Math.min(ROWS * TILE - VIEW_H, camY));
  }

  function reveal() {
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE));
    const y1 = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) visited[y * COLS + x] = 1;
    }
  }

  function update(dt: number) {
    anim += dt;
    frameN++;
    trauma = Math.max(0, trauma - dt * 1.5);
    flash = Math.max(0, flash - dt * 3);
    if (mode !== "pause") {
      for (const p of parts) {
        if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.on = false;
          continue;
        }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const p of pops) {
        if (!p.on) continue;
        p.life -= dt;
        p.y -= 12 * dt;
        if (p.life <= 0) p.on = false;
      }
    }

    if (mode === "pause") {
      publish();
      return;
    }
    if (mode === "title") {
      updateEnemies(dt);
      focus(dt, player.x + 16, player.y + 70, 0);
      publish();
      return;
    }
    if (mode === "win") {
      publish();
      return;
    }
    if (mode === "hurt") {
      hurtT -= dt;
      if (hurtT <= 0) beginReturn();
      publish();
      return;
    }
    if (mode === "return") {
      updateEnemies(dt);
      retT += dt;
      const u = Math.min(1, retT / retDur);
      const e = u * u * (3 - 2 * u);
      wispX = retSX + (cpX + PW / 2 - retSX) * e;
      wispY = retSY + (cpY + PH / 2 - retSY) * e;
      score = Math.round(retScore0 + (bank - retScore0) * e);
      const thou = Math.floor(score / 1000);
      if (thou < lastThou) {
        sound.blip();
        lastThou = thou;
      }
      if (Math.random() < 0.7) burst(wispX, wispY, 1, "#ffb000", 12, 0);
      focus(dt, wispX, wispY, 0);
      if (u >= 1) {
        score = bank;
        player.x = cpX;
        player.y = cpY;
        player.vx = 0;
        player.vy = 0;
        player.grounded = true;
        player.climbing = false;
        player.onBalloon = -1;
        invuln = 1.2;
        mode = "play";
        sound.setMode("explore");
      }
      publish();
      return;
    }

    updateEnemies(dt);
    updatePlayFixed(dt);
    publish();
  }

  function render() {
    const shake = reduced ? 0 : trauma * trauma * 4;
    const sx = (hash(frameN, 3) / 4294967296) * 2 - 1;
    const sy = (hash(frameN, 9) / 4294967296) * 2 - 1;
    const cx = Math.round(camX + sx * shake);
    const cy = Math.round(camY + sy * shake);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(worldCanvas, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    waterShine(cx, cy);
    if (relics[0] && relics[1] && relics[2]) drawRope(cx, cy);
    for (const e of ents) if (e.alive) drawEnt(e, cx, cy);
    if (mode === "return") drawWisp(cx, cy);
    else if (mode !== "hurt" || Math.floor(anim * 20) % 2 === 0) drawPlayer(cx, cy);
    for (const p of parts) {
      if (!p.on) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 2, 2);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) if (p.on) drawText(p.text, p.x - cx, p.y - cy, "#fff6e4");
    drawHud();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,246,228,${flash * 0.28})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function waterShine(cx: number, cy: number) {
    const x0 = Math.max(0, Math.floor(cx / TILE));
    const y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(COLS - 1, Math.floor((cx + VIEW_W) / TILE));
    const y1 = Math.min(ROWS - 1, Math.floor((cy + VIEW_H) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!waterAt(tx, ty) || waterAt(tx, ty - 1)) continue;
        const px = tx * TILE - cx;
        const py = ty * TILE - cy;
        const wob = Math.sin(anim * 4 + tx * 0.7) > 0 ? 0 : 1;
        ctx.fillStyle = "#9fd4ff";
        ctx.fillRect(px, py + wob, 8, 1);
        ctx.fillStyle = "#e7f6ff";
        ctx.fillRect(px + ((tx + Math.floor(anim * 3)) % 5), py, 2, 1);
      }
    }
  }

  function drawRope(cx: number, cy: number) {
    for (let i = 0; i < 7; i++) {
      const wy = (anim * 28 + i * 8) % 52;
      const wx = 60 * TILE + Math.sin(anim * 3 + i) * 1.5;
      ctx.fillStyle = i % 2 ? "#fff6e4" : "#ffb000";
      ctx.fillRect(Math.round(wx - cx), Math.round(wy - cy), 2, 2);
    }
  }

  function drawEnt(e: Ent, cx: number, cy: number) {
    const x = e.x - cx;
    const y = e.y - cy;
    if (e.kind === "gold") {
      ctx.fillStyle = "#c48810";
      ctx.fillRect(x, y + 1, 8, 5);
      ctx.fillStyle = "#ffd23a";
      ctx.fillRect(x + 1, y, 6, 4);
      ctx.fillStyle = "#fff6e4";
      ctx.fillRect(x + 2, y + 1, 2, 1);
      return;
    }
    if (e.kind === "lantern") {
      const active = cpId === e.id;
      ctx.fillStyle = "#3a2416";
      ctx.fillRect(x + 3, y + 5, 2, 7);
      ctx.fillStyle = e.lit || active ? "#ffb000" : "#5c4632";
      ctx.fillRect(x + 1, y + (active ? Math.sin(anim * 6) * 0.4 : 0), 6, 5);
      if (active) {
        ctx.fillStyle = "#fff6e4";
        ctx.fillRect(x + 3, y + 1, 2, 2);
      }
      return;
    }
    if (e.kind === "balloon") {
      const by = y + (e.held || e.returning ? 0 : Math.sin(anim * 2 + e.id) * 1.2);
      for (let row = 0; row < 10; row++) {
        const inset = row < 2 || row > 8 ? 3 : row < 4 || row > 6 ? 1 : 0;
        ctx.fillStyle = row % 3 === 0 ? "#f3e2bc" : "#d2452c";
        ctx.fillRect(x + inset, by + row, 12 - inset * 2, 1);
      }
      ctx.fillStyle = "#f3e2bc";
      ctx.fillRect(x + 5, by + 10, 2, 6);
      ctx.fillRect(x + 3, by + 16, 6, 2);
      return;
    }
    if (e.kind === "sun") {
      const pulse = 1 + Math.sin(anim * 5) * 0.2;
      ctx.fillStyle = "#fff6e4";
      ctx.fillRect(x + 3, y, 2, 2);
      ctx.fillStyle = "#ffd23a";
      ctx.fillRect(x + 2, y + 2, 4, 2);
      ctx.fillRect(x + 1, y + 4, 6, 2);
      ctx.fillRect(x + 2, y + 6, 4, 2);
      ctx.fillStyle = "#c48810";
      ctx.globalAlpha = 0.45 + pulse * 0.2;
      ctx.fillRect(x, y + 3, 8, 2);
      ctx.globalAlpha = 1;
      return;
    }
    const footX = e.x + e.w / 2 - cx;
    const footY = e.y + e.h - cy;
    if (e.kind === "scorpion") drawSprite(ctx, sheet.scorpion, footX, footY, e.dir < 0);
    else if (e.kind === "bat") drawSprite(ctx, sheet.bat[Math.floor(anim * 8) % 2]!, footX, footY, e.dir < 0);
    else if (e.kind === "eel") drawSprite(ctx, sheet.eel[Math.floor(anim * 6) % 2]!, footX, footY, e.dir < 0);
    else if (e.kind === "condor") drawSprite(ctx, sheet.condor[Math.floor(anim * 5) % 2]!, footX, footY, Math.cos(e.phase) > 0);
    else if (e.kind === "nia") drawSprite(ctx, sheet.nia, footX, footY + Math.sin(anim * 3) * 0.4, false);
    else if (e.kind === "ember") drawSprite(ctx, sheet.ember, footX, footY, false);
  }

  function drawPlayer(cx: number, cy: number) {
    if (mode !== "hurt" && invuln > 0 && Math.floor(anim * 14) % 2 === 0) return;
    const water = waterState();
    let name = "idle";
    if (player.onBalloon >= 0) name = "hang";
    else if (player.climbing) name = Math.floor(player.y / 6) % 2 === 0 ? "climbA" : "climbB";
    else if (water === "swim") name = "swim";
    else if (!player.grounded) name = "jump";
    else if (Math.abs(player.vx) > 8) name = Math.floor(anim * 10) % 2 === 0 ? "runA" : "runB";
    else if (Math.floor(anim * 1.5) % 8 === 0) name = "blink";
    const sprite = sheet.kit[name] ?? sheet.kit.idle;
    if (!sprite) return;
    const bob = mode === "title" ? Math.sin(anim * 3) * 0.6 : 0;
    const squash = player.landT > 0 ? 1 : 0;
    drawSprite(ctx, sprite, player.x + player.w / 2 - cx, player.y + player.h - cy + bob + squash, player.facing < 0);
  }

  function drawWisp(cx: number, cy: number) {
    const x = Math.round(wispX - cx);
    const y = Math.round(wispY - cy);
    ctx.fillStyle = "#ffb000";
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = "#fff6e4";
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }

  function drawHud() {
    const label = Math.max(0, Math.min(999999, Math.floor(score))).toString().padStart(6, "0");
    drawText(label, VIEW_W - 4 - label.length * 8, 4, "#f3e2bc");
    relicPip(0, relics[0], 4, 4);
    relicPip(1, relics[1], 14, 4);
    relicPip(2, relics[2], 24, 4);
  }

  function relicPip(i: number, got: boolean, x: number, y: number) {
    ctx.fillStyle = got ? "#ffd23a" : "#3a3024";
    if (i === 0) {
      ctx.fillRect(x + 2, y, 3, 2);
      ctx.fillRect(x + 1, y + 2, 5, 4);
    } else if (i === 1) {
      ctx.fillRect(x, y, 2, 2);
      ctx.fillRect(x + 5, y, 2, 2);
      ctx.fillRect(x + 1, y + 2, 5, 3);
    } else {
      ctx.fillRect(x + 3, y, 2, 2);
      ctx.fillRect(x + 1, y + 2, 6, 2);
      ctx.fillRect(x + 3, y + 4, 2, 2);
    }
  }

  function drawText(text: string, x: number, y: number, color: string) {
    let pen = x;
    for (const ch of text) {
      const g = DIGITS[ch];
      if (!g) {
        pen += 8;
        continue;
      }
      ctx.fillStyle = "#000";
      for (let i = 0; i < 15; i++) {
        if (g.charAt(i) !== "1") continue;
        ctx.fillRect(pen + (i % 3) * 2 + 1, y + Math.floor(i / 3) * 2 + 1, 2, 2);
      }
      ctx.fillStyle = color;
      for (let i = 0; i < 15; i++) {
        if (g.charAt(i) !== "1") continue;
        ctx.fillRect(pen + (i % 3) * 2, y + Math.floor(i / 3) * 2, 2, 2);
      }
      pen += 8;
    }
  }

  function down(code: string): boolean {
    return override ? override.has(code) : held.has(code);
  }

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const block = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];
    if (block.includes(e.code)) e.preventDefault();
    if (e.type === "keydown") {
      sound.unlock();
      held.add(e.code);
      if (e.repeat) return;
      if ((e.code === "Enter" || e.code === "Space") && mode === "title") start();
      if (e.code === "KeyM") toggleMute();
      if (e.code === "Escape") {
        if (mode === "play") mode = "pause";
        else if (mode === "pause") mode = "play";
        publish();
      }
    } else held.delete(e.code);
  }

  function onBlur() {
    held.clear();
  }

  function onVis() {
    if (document.visibilityState === "visible") {
      if (sound) void sound.unlock();
    } else held.clear();
  }

  function start() {
    sound.unlock();
    reset();
    mode = "play";
    say("Arrows move. Z or Space jumps.");
    sound.setMode("explore");
    jumpPrev = down("Space") || down("KeyZ") || down("KeyJ");
    jumpBuffer = 0;
    pubKey = "";
    publish();
  }

  function toggleMute() {
    sound.setMuted(!sound.muted);
    save();
    hooks.onSettings({ music: sound.musicVol, sfx: sound.sfxVol, muted: sound.muted });
  }

  function loop(now: number) {
    if (dead) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      update(STEP);
      acc -= STEP;
      n++;
    }
    render();
    sound.pump();
    raf = requestAnimationFrame(loop);
  }

  load();
  reset();
  mode = "title";
  sound.setMode("title");
  publish();

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);

  window.__controlsTest = {
    setKeys(codes: string[]) {
      override = new Set(codes);
    },
    getX: () => player.x,
    getY: () => player.y,
    getSpeed: () => player.vx,
    getFacing: () => player.facing,
    getMode: () => mode,
  };

  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      if (window.__controlsTest) delete window.__controlsTest;
      sound.close();
    },
    unlock() {
      sound.unlock();
    },
    start,
    togglePause() {
      if (mode === "play") mode = "pause";
      else if (mode === "pause") mode = "play";
      pubKey = "";
      publish();
    },
    restart() {
      start();
    },
    setHeld(code: string, on: boolean) {
      sound.unlock();
      if (on) held.add(code);
      else held.delete(code);
    },
    toggleMute,
    setMusic(v: number) {
      sound.setMusic(v);
      save();
    },
    setSfx(v: number) {
      sound.setSfx(v);
      save();
    },
    paintMap(target: HTMLCanvasElement) {
      const s = 2;
      target.width = COLS * s;
      target.height = ROWS * s;
      const g = target.getContext("2d");
      if (!g) return;
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#000";
      g.fillRect(0, 0, target.width, target.height);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!visited[y * COLS + x]) continue;
          const t = tileAt(x, y);
          g.fillStyle = t === T.ROCK ? "#4a2c12" : t === T.WATER ? "#1d5cb0" : t === T.LADDER ? "#c4924a" : "#24180f";
          g.fillRect(x * s, y * s, s, s);
        }
      }
      g.fillStyle = "#e8a317";
      g.fillRect(Math.floor(player.x / TILE) * s, Math.floor(player.y / TILE) * s, s + 1, s + 1);
    },
  };
}

function bakeWorld(tiles: Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.imageSmoothingEnabled = false;
  const solidAt = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return tiles[ty * COLS + tx] === T.ROCK;
  };
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = tiles[ty * COLS + tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (t === T.AIR && ty < 7) {
        const bands = ["#1e4f9a", "#2460b0", "#2d72c4", "#3a84d2", "#4a96de", "#62aae8", "#8ec8f4"];
        g.fillStyle = bands[ty] ?? "#8ec8f4";
        g.fillRect(x, y, 8, 8);
        const n = hash(tx, ty, 3);
        if (ty >= 2 && ty <= 4 && n % 13 === 0) {
          g.fillStyle = "#eaf6ff";
          g.fillRect(x + (n % 4), y + 2, 4, 1);
          g.fillRect(x + (n % 3) + 1, y + 3, 2, 1);
        }
      } else if (t === T.ROCK && ty < 7) {
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const n = hash(tx + px, ty + py, 11);
            const trunk = ty >= 5 && (px === 3 || px === 4);
            const col = trunk
              ? n % 2 === 0
                ? "#6b3a1c"
                : "#8d5428"
              : py < 2 || n % 7 === 0
                ? "#b6e86a"
                : n % 5 === 0
                  ? "#1d5a28"
                  : "#2f8a3c";
            g.fillStyle = col;
            g.fillRect(x + px, y + py, 1, 1);
          }
        }
      } else if (t === T.ROCK) {
        let mask = 0;
        if (!solidAt(tx, ty - 1)) mask |= 1;
        if (!solidAt(tx + 1, ty)) mask |= 2;
        if (!solidAt(tx, ty + 1)) mask |= 4;
        if (!solidAt(tx - 1, ty)) mask |= 8;
        const grass = ty === 7 && (mask & 1) !== 0;
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            let rim = 8;
            if (mask & 1) rim = Math.min(rim, py);
            if (mask & 2) rim = Math.min(rim, 7 - px);
            if (mask & 4) rim = Math.min(rim, 7 - py);
            if (mask & 8) rim = Math.min(rim, px);
            const n = hash(tx + px, ty + py, mask);
            if (rim === 0 && n % 5 === 0) continue;
            const col =
              grass && py <= 1
                ? n % 3 === 0
                  ? "#d6f08a"
                  : "#3ea84a"
                : rim <= 0
                  ? n % 3 === 0
                    ? "#ffe6a8"
                    : "#e2b15a"
                  : rim === 1
                    ? "#c4843a"
                    : n % 11 === 0
                      ? "#4a2c12"
                      : "#a86828";
            g.fillStyle = col;
            g.fillRect(x + px, y + py, 1, 1);
          }
        }
      } else if (t === T.WATER) {
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const n = hash(tx, ty, px + py * 8);
            g.fillStyle = n % 7 === 0 ? "#0c2c66" : "#1a4f9c";
            g.fillRect(x + px, y + py, 1, 1);
          }
        }
      } else if (t === T.LADDER) {
        g.fillStyle = "#5c3a1e";
        g.fillRect(x + 1, y, 1, 8);
        g.fillRect(x + 6, y, 1, 8);
        g.fillStyle = "#c4924a";
        g.fillRect(x + 1, y + 2, 6, 1);
        g.fillRect(x + 1, y + 6, 6, 1);
      } else if (t === T.PLATFORM) {
        g.fillStyle = "#5c3a1e";
        g.fillRect(x, y + 2, 8, 2);
        g.fillStyle = "#e6c98a";
        g.fillRect(x, y, 8, 2);
      }
    }
  }
  return canvas;
}
