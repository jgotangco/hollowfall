import { COLS, ROWS, T, type Spawn, type Tile, type World } from "./types";

function idx(x: number, y: number): number {
  return y * COLS + x;
}

/**
 * The Amber Deep, carved from solid rock.
 * y grows downward. A "floor" is the first rock tile under open space.
 *
 *   surface ridge y7, mouth x56
 *   catwalk y30 from the den to the rope
 *   lower hall floor y36, loft y32, chasm pit y48, balloon ledge y26
 *   lake y48–63, Ember + Nia beneath it, Sunstone under the ledge
 */
export function buildWorld(): World {
  const tiles = new Uint8Array(COLS * ROWS);
  tiles.fill(T.ROCK);

  const get = (x: number, y: number): Tile => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return T.ROCK;
    return tiles[idx(x, y)] as Tile;
  };
  const set = (x: number, y: number, t: Tile) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    tiles[idx(x, y)] = t;
  };
  const fill = (x: number, y: number, w: number, h: number, t: Tile) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) set(xx, yy, t);
    }
  };
  const air = (x: number, y: number, w: number, h: number) => fill(x, y, w, h, T.AIR);
  const rock = (x: number, y: number, w: number, h: number) => fill(x, y, w, h, T.ROCK);
  const water = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (get(xx, yy) === T.AIR) set(xx, yy, T.WATER);
      }
    }
  };
  const ladder = (x: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      const t = get(x, y);
      if (t === T.AIR || t === T.WATER) set(x, y, T.LADDER);
    }
  };
  const platform = (x0: number, x1: number, y: number) => {
    for (let x = x0; x < x1; x++) if (get(x, y) === T.AIR) set(x, y, T.PLATFORM);
  };

  // --- surface ---
  air(0, 0, 120, 7);
  rock(6, 3, 10, 4);
  rock(100, 4, 14, 3);
  air(56, 7, 10, 6); // mouth
  air(58, 13, 6, 17); // shaft down to the catwalk

  // --- upper dens + the hall volume (floor ends up at y 36) ---
  air(4, 18, 34, 12); // left den, floor y 30, x 4–37
  air(34, 22, 50, 14); // hall volume x 34–83, y 22–35
  air(62, 12, 16, 10); // balloon pocket above the hall
  rock(66, 17, 6, 2); // pedestal

  // Catwalk at y 30 so the den still reaches the rope.
  rock(34, 30, 30, 1);
  air(44, 30, 3, 1); // jumpable drop into the lower hall

  // Loft + the step up from the hall floor.
  platform(68, 84, 32);
  air(84, 24, 8, 8); // x 84–91, floor y 32
  air(92, 16, 8, 16); // loft lip x 92–99, floor y 32

  // --- chasm ---
  air(100, 16, 18, 32); // x 100–117, y 16–47, pit floor y 48
  rock(108, 26, 10, 22); // ledge top y 26 — above the loft, so only a balloon reaches it
  air(112, 26, 4, 38); // sunstone shaft x 112–115
  rock(112, 52, 1, 1); // mid landing
  rock(114, 52, 2, 1);
  air(96, 64, 22, 14); // sunstone chamber, floor y 78

  // --- lake ---
  air(6, 48, 90, 16); // x 6–95, y 48–63, floor y 64
  water(8, 53, 86, 11);
  rock(18, 52, 12, 12);
  rock(58, 52, 14, 12);
  air(48, 36, 6, 12); // hall floor opens into the lake
  air(10, 30, 4, 18); // den floor opens into the lake

  // Ember, below the left lake.
  air(4, 66, 34, 12);
  air(8, 64, 4, 2);
  water(8, 62, 4, 2);
  // Nia, below the middle.
  air(44, 66, 34, 12);
  air(48, 64, 4, 2);
  water(48, 62, 4, 2);

  // Ladders last so landings and water can't erase them.
  ladder(60, 7, 30); // daylight rope, stands on the catwalk
  ladder(45, 30, 36); // catwalk hole → lower hall
  ladder(99, 18, 32); // along the loft lip, above its floor
  ladder(100, 18, 48); // pit → lip
  ladder(113, 26, 78); // ledge → sunstone
  ladder(65, 18, 36); // hall floor → pedestal pocket
  ladder(50, 36, 60); // lower hall ↔ lake
  ladder(11, 30, 60); // den ↔ lake
  ladder(9, 60, 78); // lake ↔ Ember
  ladder(49, 58, 78); // lake ↔ Nia

  const spawns: Spawn[] = [
    { kind: "gold", tx: 22, feet: 7 },
    { kind: "gold", tx: 10, feet: 3 },
    { kind: "gold", tx: 50, feet: 7 },
    { kind: "gold", tx: 6, feet: 30 },
    { kind: "gold", tx: 68, feet: 17 },
    { kind: "gold", tx: 94, feet: 32 },
    { kind: "gold", tx: 110, feet: 26 },
    { kind: "gold", tx: 106, feet: 48 },
    { kind: "gold", tx: 24, feet: 52 },
    { kind: "gold", tx: 64, feet: 52 },
    { kind: "gold", tx: 32, feet: 78 },
    { kind: "gold", tx: 70, feet: 78 },
    { kind: "gold", tx: 100, feet: 78 },

    { kind: "lantern", tx: 30, feet: 30 },
    { kind: "lantern", tx: 22, feet: 52 },
    { kind: "lantern", tx: 101, feet: 48 },
    { kind: "lantern", tx: 109, feet: 26 },
    { kind: "lantern", tx: 14, feet: 78 },
    { kind: "lantern", tx: 56, feet: 78 },
    { kind: "lantern", tx: 98, feet: 78 },

    { kind: "scorpion", tx: 32, feet: 7, minTx: 22, maxTx: 40 },
    { kind: "scorpion", tx: 20, feet: 30, minTx: 15, maxTx: 28 },
    { kind: "scorpion", tx: 74, feet: 36, minTx: 62, maxTx: 80 },
    { kind: "scorpion", tx: 24, feet: 78, minTx: 16, maxTx: 30 },
    { kind: "scorpion", tx: 62, feet: 78, minTx: 52, maxTx: 68 },
    { kind: "scorpion", tx: 108, feet: 78, minTx: 102, maxTx: 112 },

    { kind: "bat", tx: 56, feet: 24, minTx: 40, maxTx: 76, amp: 4 },
    { kind: "bat", tx: 94, feet: 20, minTx: 92, maxTx: 99, amp: 5 },
    { kind: "bat", tx: 106, feet: 22, minTx: 101, maxTx: 116, amp: 10 },

    { kind: "eel", tx: 36, feet: 58, minTx: 32, maxTx: 52, amp: 4 },
    { kind: "eel", tx: 80, feet: 58, minTx: 74, maxTx: 92, amp: 4 },

    { kind: "condor", tx: 108, feet: 24, amp: 16 },
    { kind: "balloon", tx: 104, feet: 48 },

    { kind: "ember", tx: 34, feet: 78 },
    { kind: "nia", tx: 72, feet: 78 },
    { kind: "sun", tx: 116, feet: 78 },
  ];

  return {
    tiles,
    spawns,
    startTx: 46,
    startFeet: 7,
    exit: { tx: 57, ty: 4, w: 8, h: 4 },
  };
}

const GLYPH: Record<number, string> = {
  [T.AIR]: ".",
  [T.ROCK]: "#",
  [T.LADDER]: "H",
  [T.PLATFORM]: "=",
  [T.WATER]: "~",
};

export function ascii(world: World = buildWorld()): string {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let line = y.toString().padStart(2, "0") + " ";
    for (let x = 0; x < COLS; x++) line += GLYPH[world.tiles[idx(x, y)] ?? T.ROCK];
    rows.push(line);
  }
  return rows.join("\n");
}

export function spawnProblems(world: World = buildWorld()): string[] {
  const problems: string[] = [];
  const tileAt = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.ROCK;
    return world.tiles[idx(tx, ty)];
  };
  const grounded: Array<Spawn["kind"]> = [
    "gold",
    "lantern",
    "scorpion",
    "balloon",
    "ember",
    "nia",
    "sun",
  ];
  for (const s of world.spawns) {
    if (!grounded.includes(s.kind)) {
      if (tileAt(s.tx, s.feet) === T.ROCK) {
        problems.push(`${s.kind} in rock @ ${s.tx},${s.feet}`);
      }
      continue;
    }
    const feet = tileAt(s.tx, s.feet);
    const above = tileAt(s.tx, s.feet - 1);
    if (feet !== T.ROCK && feet !== T.PLATFORM) {
      problems.push(`${s.kind} feet miss floor @ ${s.tx},${s.feet} tile=${feet}`);
    }
    if (above === T.ROCK) problems.push(`${s.kind} buried @ ${s.tx},${s.feet - 1}`);
  }
  if (tileAt(world.startTx, world.startFeet) !== T.ROCK) problems.push("start floor");
  if (tileAt(world.startTx, world.startFeet - 1) === T.ROCK) problems.push("start buried");
  return problems;
}
