/** Original pixel cast for Hollowfall. Not traced from any commercial sprite. */

const KIT: Record<string, string[]> = {
  idle: [
    "....wwww....",
    "...wssssw...",
    "...wsseesw..",
    "...wssssw...",
    "....wwww....",
    "...rrrrrr...",
    "..rrrrrrrr..",
    "..rsrrrrsr..",
    "...rrrrrr...",
    "...arrrr....",
    "....nnnn....",
    "...nn..nn...",
    "...nn..nn...",
    "...bb..bb...",
    "...bb..bb...",
    "............",
    "............",
    "............",
  ],
  blink: [
    "....wwww....",
    "...wssssw...",
    "...wsssssw..",
    "...wssssw...",
    "....wwww....",
    "...rrrrrr...",
    "..rrrrrrrr..",
    "..rsrrrrsr..",
    "...rrrrrr...",
    "...arrrr....",
    "....nnnn....",
    "...nn..nn...",
    "...nn..nn...",
    "...bb..bb...",
    "...bb..bb...",
    "............",
    "............",
    "............",
  ],
  runA: [
    "....wwww....",
    "...wssssw...",
    "...wsseesw..",
    "...wssssw...",
    "....wwww....",
    "...rrrrrr...",
    "..rrrrrrrr..",
    "..rsrrrrsr..",
    "...rrrrrr...",
    "...arrrr....",
    "....nnnn....",
    "..nn....nn..",
    "..nn....nn..",
    "..bb....bb..",
    ".bb......bb.",
    "............",
    "............",
    "............",
  ],
  runB: [
    "....wwww....",
    "...wssssw...",
    "...wsseesw..",
    "...wssssw...",
    "....wwww....",
    "...rrrrrr...",
    "..rrrrrrrr..",
    "...srrrrs...",
    "...rrrrrr...",
    "...arrrr....",
    "....nnnn....",
    "....nnnn....",
    "...nn..nn...",
    "...bb..bb...",
    "...bb..bb...",
    "............",
    "............",
    "............",
  ],
  jump: [
    "....wwww....",
    "...wssssw...",
    "...wsseesw..",
    "...wssssw...",
    "....wwww....",
    "...rrrrrr...",
    "..rrrrrrrr..",
    "..rsrrrrsr..",
    "...rrrrrr...",
    "...arrrr....",
    "....nnnn....",
    "...nn..nn...",
    "..bb....bb..",
    ".bb......bb.",
    "............",
    "............",
    "............",
    "............",
  ],
  climbA: [
    "...wwww.....",
    "..wssssw....",
    "..wssees....",
    "..wssssw....",
    "...wwww.....",
    "...rrrr.....",
    "..rrrrrr....",
    "..rrrrrs....",
    ".s.rrrr.....",
    "...rrra.....",
    "...nnnn.....",
    "...nn.n.....",
    "...nn.n.....",
    "...bb.b.....",
    "...bb.b.....",
    "............",
    "............",
    "............",
  ],
  climbB: [
    ".....wwww...",
    "....wssssw..",
    "....seessw..",
    "....wssssw..",
    ".....wwww...",
    ".....rrrr...",
    "....rrrrrr..",
    "....srrrrr..",
    ".....rrrr.s.",
    ".....arrr...",
    ".....nnnn...",
    ".....n.nn...",
    ".....n.nn...",
    ".....b.bb...",
    ".....b.bb...",
    "............",
    "............",
    "............",
  ],
  swim: [
    "............",
    "............",
    "....wwww....",
    "...wssssw...",
    "..wsseesw...",
    "...wssssw...",
    "..rrrrrrrr..",
    ".rrrrrrrrra.",
    "..s..nnnn...",
    ".....nn..n..",
    ".....bb..b..",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  hang: [
    ".....wwww...",
    "....wssssw..",
    "....wssees..",
    "....wssssw..",
    "..s..wwww...",
    "..rrrrrr....",
    "...rrrrrr...",
    "...rrrrr....",
    "...arrr.....",
    "....nnnn....",
    "....nnnn....",
    "...nn..nn...",
    "...bb..bb...",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
};

const NIA = [
  "...hhhhhh...",
  "..hhsssshh..",
  "..hhs..shh..",
  "..hhsssshh..",
  "...hhhhhh...",
  "....dddd....",
  "...dddddd...",
  "..dddddddd..",
  "..dsddddsd..",
  "...dddddd...",
  "...dddddd...",
  "....dddd....",
  "....dd.dd...",
  "...dd...dd..",
  "............",
  "............",
];

const EMBER = [
  "ee..........ee..",
  "eeeeee..eeeeee..",
  ".eekeeeeeeeeke..",
  "..eeeeeeeeee....",
  "...eeeeeeee.....",
  "....eeeeee......",
  "....eeeeee......",
  "....ee..ee......",
  "....ee..ee..e...",
  ".....e..e..eee..",
];

const SCORPION = [
  "......tt..t...",
  ".rrrrrrrr.tt..",
  "rrrrrrrrrrrt..",
  ".rrrrrrrrrr...",
  "..rr....rr....",
  ".rr......rr...",
  "..r......r....",
];

const BAT_A = [
  ".p..........p.",
  "pp..........pp",
  ".pppppppppppp.",
  "...pppeepp....",
  "....pppppp....",
  ".....p..p.....",
];

const BAT_B = [
  "..............",
  ".p..........p.",
  "pppppppppppppp",
  "...pppeepp....",
  "....pppppp....",
  ".p...p..p...p.",
];

const EEL_A = [
  "...ccccccccc....",
  ".cccccccccccccc.",
  "ccceeccccccccccc",
  ".cccccccccccccc.",
  "...cccccccccc...",
];

const EEL_B = [
  "....cccccccc....",
  "..cccccccccccc..",
  ".ccceeccccccccc.",
  "ccccccccccccccc.",
  "..ccccccccccc...",
];

const CONDOR_A = [
  "......cc........",
  "...ccc..ccc.....",
  ".ccccc....ccc...",
  "ccceec......cc..",
  ".ccccc....ccc...",
  "...ccc..ccc.....",
  "......cc........",
  ".....c..c.......",
  ".....c..c.......",
];

const CONDOR_B = [
  "..c..........c..",
  ".ccc...cc...ccc.",
  "ccccc..cc..ccccc",
  ".ccceeccccccec..",
  "..ccccccccccc...",
  "......cc........",
  ".....c..c.......",
  ".....c..c.......",
  "..............c.",
];

const KIT_PAL: Record<string, string> = {
  w: "#f3e2bc",
  s: "#e7a878",
  e: "#1a120c",
  r: "#d2452c",
  n: "#243044",
  b: "#3d2918",
  a: "#8a5a32",
};

export type Sheet = {
  kit: Record<string, HTMLCanvasElement>;
  nia: HTMLCanvasElement;
  ember: HTMLCanvasElement;
  scorpion: HTMLCanvasElement;
  bat: [HTMLCanvasElement, HTMLCanvasElement];
  eel: [HTMLCanvasElement, HTMLCanvasElement];
  condor: [HTMLCanvasElement, HTMLCanvasElement];
};

function bake(rows: string[], palette: Record<string, string>): HTMLCanvasElement {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== w) throw new Error(`sprite row ${row.length} != ${w}: ${row}`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2d");
  g.imageSmoothingEnabled = false;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row.charAt(x);
      if (ch === "." || !palette[ch]) continue;
      g.fillStyle = palette[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

export function bakeSheet(): Sheet {
  const kit: Record<string, HTMLCanvasElement> = {};
  for (const [name, rows] of Object.entries(KIT)) kit[name] = bake(rows, KIT_PAL);
  return {
    kit,
    nia: bake(NIA, { h: "#2a160f", s: "#e7a878", d: "#f0c84a" }),
    ember: bake(EMBER, { e: "#d5dde6", k: "#1a120c" }),
    scorpion: bake(SCORPION, { r: "#e23b3b", t: "#7a1414" }),
    bat: [
      bake(BAT_A, { p: "#9b59c8", e: "#1a120c" }),
      bake(BAT_B, { p: "#9b59c8", e: "#1a120c" }),
    ],
    eel: [
      bake(EEL_A, { c: "#3ad6c4", e: "#083833" }),
      bake(EEL_B, { c: "#3ad6c4", e: "#083833" }),
    ],
    condor: [
      bake(CONDOR_A, { c: "#c5c46a", e: "#1a120c" }),
      bake(CONDOR_B, { c: "#c5c46a", e: "#1a120c" }),
    ],
  };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  footX: number,
  footY: number,
  flip: boolean,
) {
  const w = sprite.width;
  const h = sprite.height;
  const x = Math.round(footX - w / 2);
  const y = Math.round(footY - h);
  if (!flip) {
    ctx.drawImage(sprite, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}
