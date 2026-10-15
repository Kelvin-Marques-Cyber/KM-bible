import {
  STATIONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type JourneyState,
} from "./campaign-engine";
import type { ChronicleEpisode } from "./campaign-content";
import { ambientActors, type AmbientActor } from "./campaign-ambient";

export const SCENE_WIDTH = 480,
  SCENE_HEIGHT = 270;
const W = SCENE_WIDTH,
  H = SCENE_HEIGHT,
  X = W / WORLD_WIDTH,
  Y = H / WORLD_HEIGHT;
type Palette = {
  sky: string;
  horizon: string;
  hills: string;
  hills2: string;
  ground: string;
  shade: string;
  stone: string;
  water: string;
  highlight: string;
};
const THEMES: Record<string, Palette> = {
  garden: {
    sky: "#5c9b9b",
    horizon: "#a3cdbc",
    hills: "#6d956e",
    hills2: "#436c5a",
    ground: "#829f64",
    shade: "#527d54",
    stone: "#a9a17c",
    water: "#4f899b",
    highlight: "#eed098",
  },
  flood: {
    sky: "#303e59",
    horizon: "#65748a",
    hills: "#53607a",
    hills2: "#354d67",
    ground: "#6c735e",
    shade: "#465d60",
    stone: "#9a9584",
    water: "#477b91",
    highlight: "#f0c393",
  },
  city: {
    sky: "#5d7b91",
    horizon: "#d6b5a0",
    hills: "#b29172",
    hills2: "#8b695a",
    ground: "#aa926e",
    shade: "#776451",
    stone: "#d4ba8b",
    water: "#577d85",
    highlight: "#f8e3b1",
  },
  desert: {
    sky: "#507da6",
    horizon: "#edc596",
    hills: "#b89577",
    hills2: "#b37d5a",
    ground: "#c3a679",
    shade: "#9e7956",
    stone: "#dbbc8e",
    water: "#548aa0",
    highlight: "#f8d992",
  },
  palace: {
    sky: "#43557e",
    horizon: "#9ca3b3",
    hills: "#8a8289",
    hills2: "#645c74",
    ground: "#a79a8d",
    shade: "#7c6e75",
    stone: "#d4c0a9",
    water: "#496f86",
    highlight: "#e5d3b2",
  },
  river: {
    sky: "#497c96",
    horizon: "#b2bfae",
    hills: "#73968c",
    hills2: "#587c78",
    ground: "#82a181",
    shade: "#587b62",
    stone: "#c7b99a",
    water: "#478fa6",
    highlight: "#ede2a6",
  },
  mountain: {
    sky: "#354c77",
    horizon: "#bcb6a5",
    hills: "#696e8a",
    hills2: "#444c6e",
    ground: "#929c85",
    shade: "#546d67",
    stone: "#c3bbb1",
    water: "#5489a8",
    highlight: "#f2d5a5",
  },
  egypt: {
    sky: "#4b809d",
    horizon: "#d3bc91",
    hills: "#ac9978",
    hills2: "#967955",
    ground: "#ccb58a",
    shade: "#957e5e",
    stone: "#dec79c",
    water: "#488b9e",
    highlight: "#e9ce98",
  },
  sea: {
    sky: "#54769a",
    horizon: "#a1b5bc",
    hills: "#6c8f96",
    hills2: "#4c7887",
    ground: "#879a90",
    shade: "#6a8384",
    stone: "#d3c2a5",
    water: "#427e9b",
    highlight: "#f5ddb7",
  },
  temple: {
    sky: "#465b7f",
    horizon: "#9eafbc",
    hills: "#777d8e",
    hills2: "#666c7b",
    ground: "#b2a48b",
    shade: "#887e6b",
    stone: "#ddd0b6",
    water: "#547f91",
    highlight: "#ecd1a3",
  },
  fields: {
    sky: "#608f9d",
    horizon: "#b6ccb2",
    hills: "#779b78",
    hills2: "#638061",
    ground: "#a9a472",
    shade: "#817d50",
    stone: "#ccba90",
    water: "#648e9c",
    highlight: "#f4dca9",
  },
  village: {
    sky: "#607f9c",
    horizon: "#d0c2ad",
    hills: "#a5a089",
    hills2: "#7b866b",
    ground: "#a9a071",
    shade: "#857952",
    stone: "#dac39e",
    water: "#608ca1",
    highlight: "#f4d4a6",
  },
  upper: {
    sky: "#3f4a64",
    horizon: "#8e8794",
    hills: "#77707f",
    hills2: "#655567",
    ground: "#8b786c",
    shade: "#675c53",
    stone: "#c7b3a4",
    water: "#69848d",
    highlight: "#efc99a",
  },
};
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}
function poly(c: CanvasRenderingContext2D, points: number[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
function tree(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: Palette,
  seed: number,
) {
  rect(c, x - 10, y - 2, 26, 6, "#172e3244");
  rect(c, x - 2, y - 19, 5, 21, "#77563c");
  rect(c, x + 1, y - 15, 2, 15, "#4b4535");
  for (const [dx, dy, w, h] of [
    [-15, -29, 31, 14],
    [-11, -39, 22, 15],
    [-18, -24, 35, 9],
  ])
    rect(c, x + dx, y + dy, w, h, p.hills2);
  rect(c, x - 11, y - 35, 18, 8, p.hills);
  rect(c, x - 6, y - 39, 14, 5, p.shade);
  rect(c, x - 14, y - 23, 9, 3, "#ffffff14");
  if (seed % 3 === 0) {
    rect(c, x - 8, y - 24, 2, 2, "#d4ae68");
    rect(c, x + 5, y - 30, 2, 2, "#d4ae68");
  }
}
function building(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: Palette,
  kind: string,
) {
  rect(c, x - 26, y - 2, 57, 8, "#172e3244");
  rect(c, x - 24, y - 37, 48, 38, p.stone);
  rect(c, x + 13, y - 34, 11, 35, p.shade);
  rect(c, x - 26, y - 42, 51, 7, p.shade);
  rect(c, x - 23, y - 43, 43, 3, p.highlight);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++)
      rect(
        c,
        x - 22 + col * 11 + (row % 2 ? 4 : 0),
        y - 31 + row * 9,
        8,
        1,
        "#66563e30",
      );
  rect(c, x - 5, y - 21, 12, 22, "#304044");
  rect(c, x - 7, y - 23, 16, 3, "#685d4e");
  rect(c, x - 16, y - 28, 5, 7, "#526e78");
  if (kind === "temple" || kind === "palace") {
    for (const dx of [-19, 14]) {
      rect(c, x + dx, y - 37, 5, 36, p.highlight);
      rect(c, x + dx - 2, y - 37, 9, 3, p.stone);
    }
    poly(c, [x - 29, y - 44, x, y - 59, x + 29, y - 44], p.stone);
  }
  if (kind === "egypt") {
    rect(c, x - 25, y - 54, 5, 15, p.stone);
    rect(c, x + 21, y - 54, 5, 15, p.stone);
  }
}
function terrain(c: CanvasRenderingContext2D, e: ChronicleEpisode) {
  const p = THEMES[e.setting] ?? THEMES.village,
    night = ["birth", "passover", "supper", "lions"].includes(e.id);
  const sky = night ? "#26374f" : p.sky;
  rect(c, 0, 0, W, H, p.ground);
  rect(c, 0, 0, W, 45, sky);
  for (let y = 25; y < 49; y += 4)
    rect(c, 0, y, W, 4, p.horizon + (y < 37 ? "65" : "bb"));
  if (night) {
    for (let i = 0; i < 30; i++)
      rect(
        c,
        hash(e.id + "star" + i) % W,
        hash("starY" + i) % 34,
        1,
        1,
        "#f4e4bf",
      );
    if (e.id !== "newjerusalem") {
      rect(c, 420, 12, 12, 12, "#e3dfbc");
      rect(c, 424, 10, 10, 12, sky);
    }
  }
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < 14; i++) {
      const x = i * 42 - 24,
        base = 39 + layer * 12,
        height = 10 + (hash(e.id + layer + i) % 24);
      poly(
        c,
        [
          x,
          base + 15,
          x + 18,
          base - height,
          x + 39,
          base - height + 12,
          x + 62,
          base + 15,
        ],
        layer ? p.hills2 : p.hills,
      );
    }
  rect(c, 0, 53, W, H - 53, p.ground);
  for (let i = 0; i < 1800; i++) {
    const x = hash(e.id + "grain" + i) % W,
      y = 54 + (hash(e.id + "grainY" + i) % (H - 54));
    rect(
      c,
      x,
      y,
      i % 5 === 0 ? 3 : 1,
      1,
      i % 11 === 0 ? p.highlight + "66" : p.shade + "66",
    );
  }
  for (let i = 0; i < 32; i++) {
    const x = hash(e.id + "patch" + i) % W,
      y = 62 + (hash(e.id + "patchY" + i) % 200);
    rect(c, x, y, 18 + (hash("pw" + i) % 26), 2, p.shade + "22");
    rect(c, x + 6, y + 2, 22, 4, p.shade + "19");
  }
  if (["garden", "fields", "river"].includes(e.setting))
    for (let i = 0; i < 35; i++) {
      const x = 45 + (hash(e.id + "flower" + i) % 390),
        y = 105 + (hash("fy" + i) % 154);
      rect(c, x, y, 1, 4, p.hills2);
      rect(c, x - 1, y - 1, 3, 2, i % 3 === 0 ? "#d2ada6" : "#d5cc9b");
    }
  if (["palace", "temple", "city", "upper"].includes(e.setting)) {
    for (let y = 74; y < H; y += 14)
      for (let x = y % 28 ? -12 : 0; x < W; x += 26) {
        rect(c, x, y, 24, 1, p.shade + "66");
        rect(c, x + 24, y, 1, 14, p.shade + "44");
      }
  }
  // World projection and walkable ground share coordinates; no beacons float in the sky.
  c.lineJoin = "round";
  c.lineCap = "round";
  for (const [width, color] of [
    [18, p.shade + "99"],
    [14, p.stone + "cc"],
    [9, p.stone],
  ] as const) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(17 * X, 17.5 * Y);
    c.lineTo(17 * X, 10 * Y);
    c.lineTo(5 * X, 10 * Y);
    c.lineTo(5 * X, 6 * Y);
    c.moveTo(17 * X, 10 * Y);
    c.lineTo(16.5 * X, 4.7 * Y);
    c.moveTo(17 * X, 10 * Y);
    c.lineTo(29 * X, 10 * Y);
    c.lineTo(29 * X, 7 * Y);
    c.stroke();
  }
  for (let i = 0; i < 50; i++) {
    const x = 75 + (hash(e.id + "pebble" + i) % 340),
      y = 128 + (hash("pebY" + i) % 117);
    if (i % 2) rect(c, x, y, 2, 1, p.highlight + "88");
  }
  if (["river", "sea", "flood"].includes(e.setting)) {
    for (let y = 53; y < H; y += 3) {
      const bank = 24 + Math.round(Math.sin(y / 38) * 4);
      rect(c, 0, y, bank + 6, 3, p.stone);
      rect(c, 0, y, bank, 3, p.water);
    }
  }
  if (e.setting === "fields")
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 9; col++) {
        const x = 112 + col * 8,
          y = 166 + row * 10;
        rect(c, x, y, 1, 5, "#dbbc73");
        rect(c, x - 2, y, 5, 1, "#e6ca81");
      }
  if (["city", "palace", "temple", "egypt", "upper"].includes(e.setting)) {
    // Distant skyline is illustrative, not an archaeological reconstruction.
    for (let i = 0; i < 8; i++) {
      const x = i * 63 - 9,
        y = 62 + (hash(e.id + "roof" + i) % 7);
      rect(c, x, y - 22, 46, 23, p.stone);
      rect(c, x + 31, y - 20, 15, 21, p.shade);
      rect(c, x + 12, y - 13, 7, 14, "#425052");
      rect(c, x - 2, y - 25, 50, 4, p.shade);
    }
  }
  if (e.setting === "desert" || e.setting === "egypt") {
    for (let i = 0; i < 18; i++) {
      const x = hash(e.id + "dune" + i) % W,
        y = 70 + (hash("dy" + i) % 180);
      rect(c, x, y, 14, 1, p.highlight + "44");
      rect(c, x + 8, y + 2, 13, 1, p.shade + "44");
    }
  }
  // Low foreground foliage and corner rocks frame, rather than cover, the playable path.
  for (let i = 0; i < 14; i++) {
    const x = i * 38 + (hash(e.id + "grass" + i) % 12);
    rect(c, x, 263, 4, 7, p.shade);
    rect(c, x + 3, 260, 2, 10, p.hills2);
  }
}
function fixture(
  c: CanvasRenderingContext2D,
  e: ChronicleEpisode,
  i: number,
  p: Palette,
) {
  const x = STATIONS[i].x * X,
    y = STATIONS[i].y * Y;
  rect(c, x - 12, y - 1, 27, 6, "#172e3255");
  if (e.id === "resurrection" && i === 0) {
    poly(
      c,
      [
        x - 18,
        y,
        x - 18,
        y - 24,
        x - 10,
        y - 31,
        x + 12,
        y - 31,
        x + 20,
        y - 23,
        x + 20,
        y,
      ],
      p.stone,
    );
    rect(c, x - 6, y - 20, 15, 21, "#233436");
    rect(c, x - 4, y - 17, 10, 18, "#0c2028");
    rect(c, x + 23, y - 5, 11, 10, p.shade);
    return;
  }
  if (["garden", "creation"].includes(e.id) && i === 1) {
    tree(c, x, y, p, i);
    return;
  }
  if (e.id === "ark" && i === 1) {
    rect(c, x - 28, y - 24, 57, 23, "#78533e");
    for (let row = 0; row < 4; row++)
      rect(c, x - 26, y - 21 + row * 6, 53, 1, "#ba8e61");
    poly(c, [x - 31, y - 25, x, y - 45, x + 32, y - 25], "#5b4338");
    rect(c, x - 4, y - 18, 9, 17, "#403a32");
    return;
  }
  if ((e.id === "birth" || e.id === "supper") && i === 1) {
    rect(c, x - 13, y - 10, 28, 5, "#ab8256");
    rect(c, x - 10, y - 5, 3, 8, "#69533b");
    rect(c, x + 10, y - 5, 3, 8, "#69533b");
    rect(c, x - 7, y - 13, 12, 3, "#ebd7aa");
    return;
  }
  if (e.id === "sea" && i === 2) {
    rect(c, x - 24, y - 4, 49, 5, "#a6bfbe");
    rect(c, x - 25, y - 13, 6, 12, p.water);
    rect(c, x + 20, y - 13, 6, 12, p.water);
    return;
  }
  if (e.id === "garden" && i === 2) {
    rect(c, x - 17, y - 33, 5, 33, p.stone);
    rect(c, x + 13, y - 33, 5, 33, p.stone);
    rect(c, x - 17, y - 35, 35, 5, p.stone);
    return;
  }
  if (["temple", "palace"].includes(e.setting) && i === 1) {
    rect(c, x - 13, y - 7, 27, 7, p.shade);
    rect(c, x - 10, y - 11, 21, 4, p.stone);
    rect(c, x - 7, y - 22, 15, 11, p.highlight);
    rect(c, x - 5, y - 20, 11, 8, "#b9a77e");
    return;
  }
  // Scrolls, vessels and archives have distinct silhouettes at each investigation point.
  if (i === 0) {
    rect(c, x - 9, y - 13, 19, 13, "#8e6845");
    rect(c, x - 11, y - 15, 23, 4, "#ceb37c");
    rect(c, x - 2, y - 11, 5, 5, p.highlight);
  }
  if (i === 1) {
    rect(c, x - 7, y - 18, 15, 17, "#dbd0ac");
    rect(c, x - 10, y - 19, 20, 3, "#aa895c");
    rect(c, x - 10, y - 3, 20, 3, "#aa895c");
    for (let n = 0; n < 3; n++) rect(c, x - 3, y - 14 + n * 4, 8, 1, "#8c8d73");
  }
  if (i === 2) {
    rect(c, x - 8, y - 16, 17, 16, p.stone);
    rect(c, x - 5, y - 22, 11, 7, p.shade);
    rect(c, x - 3, y - 21, 7, 3, "#554e44");
    rect(c, x + 5, y - 13, 4, 9, p.shade);
  }
}
function sprite(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: JourneyState,
  t: number,
  moving: boolean,
  e: ChronicleEpisode,
) {
  const stride = moving ? [0, 2, 0, -2][Math.floor(t / 115) % 4] : 0,
    bob = moving && stride !== 0 ? 1 : 0;
  // Prologue and visions use a reading lantern, not an invented human witness.
  if (!e.hero.includes("(ficção)")) {
    rect(c, x - 6, y, 13, 3, "#182b3544");
    rect(c, x - 4, y - 18 + bob, 9, 12, "#e4c996");
    rect(c, x - 6, y - 20 + bob, 13, 3, "#8f7754");
    rect(c, x - 5, y - 7 + bob, 11, 3, "#8f7754");
    rect(c, x - 1, y - 17 + bob, 3, 9, "#fff1ba");
    rect(c, x - 1, y - 25 + bob, 3, 4, "#b29d6d");
    return;
  }
  const cloth = e.saga === 4 ? "#bd7c61" : e.saga === 3 ? "#8987b2" : "#688c91",
    shadow = e.saga === 4 ? "#805444" : "#405c70";
  rect(c, x - 8, y - 1, 18, 5, "#14293255");
  rect(c, x - 5, y - 6 + stride, 4, 7, "#35404b");
  rect(c, x + 2, y - 6 - stride, 4, 7, "#35404b");
  rect(c, x - 6, y + stride, 6, 2, "#654c37");
  rect(c, x + 2, y - stride, 6, 2, "#654c37");
  poly(
    c,
    [x - 5, y - 18 + bob, x + 5, y - 18 + bob, x + 7, y - 4, x - 7, y - 4],
    cloth,
  );
  rect(c, x + 3, y - 17 + bob, 3, 12, shadow);
  rect(c, x - 5, y - 16 + bob, 3, 9, "#bdd4c333");
  rect(c, x - 6, y - 9, 13, 2, "#d1af78");
  rect(c, x - 7, y - 17 - stride * 0.5, 3, 10, "#bb8c69");
  rect(c, x + 6, y - 17 + stride * 0.5, 3, 10, "#d2a37b");
  rect(c, x - 5, y - 29 + bob, 11, 12, "#d6ae88");
  rect(c, x + 3, y - 28 + bob, 3, 10, "#b88c70");
  rect(c, x - 6, y - 30 + bob, 13, 5, "#493c3c");
  rect(c, x - 6, y - 27 + bob, 2, 5, "#493c3c");
  rect(c, x + 5, y - 27 + bob, 2, 6, "#493c3c");
  if (g.facing !== "up") {
    const blink = Math.floor(t / 180) % 31 === 0,
      eyeY = y - 23 + bob;
    if (g.facing !== "right") rect(c, x - 3, eyeY, 2, blink ? 1 : 2, "#28313b");
    if (g.facing !== "left") rect(c, x + 3, eyeY, 2, blink ? 1 : 2, "#28313b");
    rect(c, x, eyeY + 4, 2, 1, "#8d5b53");
  } else rect(c, x - 5, y - 27 + bob, 11, 7, "#584541");
  rect(c, x - 6, y - 20 + bob, 12, 3, "#d9c08b");
  rect(c, x - 7, y - 20 + bob, 2, 10, "#bba06e");
  // A small satchel makes the witness recognizable without weapons or supernatural powers.
  rect(c, x + 5, y - 13, 5, 7, "#936b49");
  rect(c, x + 6, y - 12, 3, 2, "#d1ac73");
}

/** Low-cost animated crowd and flock silhouettes. Decorative only; they
 * neither speak scripture nor participate in the chapter's three objectives. */
function ambientSprite(c: CanvasRenderingContext2D, a: AmbientActor) {
  const x = Math.round(a.x), y = Math.round(a.y);
  rect(c, x - 8, y - 1, 17, 3, "#12292944");
  if (a.kind === "sheep") {
    const step = a.step === 1 || a.step === 3 ? 1 : 0;
    rect(c, x - 8, y - 6 + step, 3, 7, "#53473b");
    rect(c, x + 3, y - 6 - step, 3, 7, "#53473b");
    rect(c, x - 12, y - 18, 21, 12, "#eee0c0");
    rect(c, x - 9, y - 22, 14, 8, "#fff1d5");
    rect(c, x + (a.facing > 0 ? 5 : -11), y - 16, 7, 8, "#927c63");
    rect(c, x + (a.facing > 0 ? 9 : -8), y - 13, 2, 2, "#273531");
    return;
  }
  const stride = [0, 1, 0, -1][a.step];
  rect(c, x - 5, y - 5 + stride, 4, 6, "#4f4639");
  rect(c, x + 2, y - 5 - stride, 4, 6, "#4f4639");
  poly(c, [x - 6,y - 20,x + 5,y - 20,x + 8,y - 6,x - 7,y - 6], a.costume);
  rect(c, x - 7, y - 18, 3, 9, "#bb9473");
  rect(c, x + 6, y - 18, 3, 9, "#bb9473");
  rect(c, x - 5, y - 30, 11, 11, "#cfad89");
  rect(c, x - 6, y - 31, 13, 4, "#514238");
  rect(c, x + (a.facing > 0 ? 2 : -3), y - 25, 2, 2, "#2d3738");
  rect(c, x - 6, y - 20, 12, 3, "#dac08e");
}

type Layer = { y: number; draw: () => void };
export class CampaignRenderer {
  private background: HTMLCanvasElement | null = null;
  private id = "";
  private steps = -1;
  private movedAt = 0;
  private visited: number[] = [];
  private sparks: { x: number; y: number; at: number }[] = [];
  reset() {
    this.background = null;
    this.id = "";
    this.visited = [];
    this.sparks = [];
    this.steps = -1;
  }
  draw(
    c: CanvasRenderingContext2D,
    e: ChronicleEpisode,
    g: JourneyState,
    time: number,
    reduced = false,
  ) {
    c.imageSmoothingEnabled = false;
    const p = THEMES[e.setting] ?? THEMES.village;
    if (this.id !== e.id) {
      this.reset();
      this.id = e.id;
      this.visited = [...g.visited];
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const context = canvas.getContext("2d", { alpha: false });
      if (context) {
        terrain(context, e);
        this.background = canvas;
      }
    }
    if (this.background) c.drawImage(this.background, 0, 0);
    else terrain(c, e);
    if (g.steps !== this.steps) {
      this.steps = g.steps;
      this.movedAt = time;
    }
    const moving = time - this.movedAt < 120 && g.steps > 0 && !reduced;
    for (const i of g.visited)
      if (!this.visited.includes(i))
        this.sparks.push({
          x: STATIONS[i].x * X,
          y: STATIONS[i].y * Y - 15,
          at: time,
        });
    this.visited = [...g.visited];
    const t = reduced ? 0 : time;
    // The transparent banks animate over cached terrain; no full-map regeneration per frame.
    if (["river", "sea", "flood"].includes(e.setting))
      for (let i = 0; i < 18; i++) {
        const y = 60 + i * 12,
          x = 4 + Math.sin(t / 700 + i) * 6;
        rect(c, x, y, 10 + (i % 7), 1, "#a9d7d0a0");
        if (i % 3 === 0) rect(c, 15, y + 4, 7, 1, "#dae7d177");
      }
    // Dust / leaves / rain use deterministic particles, never an unbounded emitter.
    for (let i = 0; i < 12 && !reduced; i++) {
      const x =
        ((hash(e.id + "air" + i) % W) +
          t * (e.setting === "flood" ? 0.016 : 0.004)) %
        W;
      const y = 40 + ((hash("airY" + i) + Math.sin(t / 1000 + i) * 6) % 210);
      rect(
        c,
        x,
        y,
        e.setting === "flood" ? 1 : 2,
        e.setting === "flood" ? 5 : 1,
        p.highlight + "66",
      );
    }
    const layers: Layer[] = [];
    // Side buildings match the existing solid zones; sparse trees avoid the three paths.
    for (const x of [18, 462])
      layers.push({
        y: 14 * Y,
        draw: () => {
          if (["garden", "river", "fields"].includes(e.setting)) {
            tree(c, x, 14 * Y, p, hash(e.id + x));
          } else if (
            ["desert", "mountain", "sea", "flood"].includes(e.setting)
          ) {
            const y = 14 * Y;
            poly(
              c,
              [
                x - 25,
                y,
                x - 21,
                y - 27,
                x - 8,
                y - 36,
                x + 17,
                y - 30,
                x + 26,
                y,
              ],
              p.shade,
            );
            poly(
              c,
              [x - 21, y - 27, x - 8, y - 36, x + 4, y - 16, x - 15, y - 15],
              p.stone,
            );
            rect(c, x - 16, y + 1, 36, 4, "#1b303833");
          } else building(c, x, 14 * Y, p, e.setting);
        },
      });
    if (
      ![
        "desert",
        "egypt",
        "sea",
        "flood",
        "upper",
        "palace",
        "temple",
        "city",
      ].includes(e.setting)
    ) {
      for (const [x, y] of [
        [30, 102],
        [126, 245],
        [337, 240],
        [455, 112],
      ])
        layers.push({ y, draw: () => tree(c, x, y, p, hash(e.id + x)) });
    } else
      for (const [x, y] of [
        [120, 238],
        [337, 237],
      ])
        layers.push({
          y,
          draw: () => {
            poly(
              c,
              [x - 9, y, x - 5, y - 10, x + 5, y - 13, x + 12, y],
              p.shade,
            );
            rect(c, x - 4, y - 9, 7, 2, p.stone);
          },
        });
    for (let i = 0; i < 3; i++)
      layers.push({ y: STATIONS[i].y * Y, draw: () => fixture(c, e, i, p) });
    // Three background villagers in populated settings, animals in pastoral
    // settings. Positions are animation-only: no additional save writes.
    for (const actor of ambientActors(e, t, reduced))
      layers.push({ y: actor.y, draw: () => ambientSprite(c, actor) });
    layers.push({
      y: g.y * Y,
      draw: () =>
        sprite(c, Math.round(g.x * X), Math.round(g.y * Y), g, t, moving, e),
    });
    layers.sort((a, b) => a.y - b.y);
    for (const layer of layers) layer.draw();
    for (let i = 0; i < 3; i++) {
      const pos = STATIONS[i],
        x = pos.x * X,
        y = pos.y * Y,
        known = g.visited.includes(i),
        near = Math.hypot(g.x - pos.x, g.y - pos.y) <= 2.6;
      const pulse = reduced ? 0 : Math.round(Math.sin(time / 450 + i) * 2);
      if (!known) {
        rect(c, x - 3, y - 38 + pulse, 6, 6, "#eacb7d");
        rect(c, x - 1, y - 36 + pulse, 2, 2, "#fff4bd");
      }
      c.font = "bold 8px monospace";
      c.textAlign = "center";
      c.fillStyle = "#122932dd";
      c.fillRect(Math.round(x - 10), Math.round(y + 8), 20, 12);
      c.fillStyle = known ? "#acd9b3" : "#f5dca3";
      c.fillText(
        known ? "✓" : String(i + 1).padStart(2, "0"),
        Math.round(x),
        Math.round(y + 17),
      );
      if (near && !known && g.phase === "explore") {
        rect(c, x - 15, y + 23, 31, 10, "#172b32e6");
        c.fillStyle = "#f3deac";
        c.fillText("E / ↵", x, y + 31);
      }
      if (e.id === "bush" && i === 1) {
        for (let f = 0; f < 3; f++) {
          const flicker = reduced ? 0 : Math.floor(time / 160 + f) % 3;
          poly(
            c,
            [
              x - 9 + f * 7,
              y - 8,
              x - 7 + f * 7,
              y - 29 - flicker * 3,
              x - 3 + f * 7,
              y - 17,
              x - 1 + f * 7,
              y - 8,
            ],
            "#e7ac60",
          );
          rect(c, x - 6 + f * 7, y - 14, 2, 5, "#fae3a0");
        }
      }
    }
    this.sparks = this.sparks.filter((s) => time - s.at < 1000);
    for (const s of this.sparks)
      for (let i = 0; i < 9 && !reduced; i++) {
        const elapsed = (time - s.at) / 1000,
          angle = (i * Math.PI * 2) / 9,
          spread = elapsed * 28;
        c.globalAlpha = 1 - elapsed;
        rect(
          c,
          s.x + Math.cos(angle) * spread,
          s.y + Math.sin(angle) * spread - elapsed * 16,
          2,
          2,
          "#ffe3a5",
        );
        c.globalAlpha = 1;
      }
    // Pixel-stepped lighting and a low-cost vignette add depth without WebGL.
    const light = c.createLinearGradient(0, 0, W, H);
    light.addColorStop(0, "#ffedc318");
    light.addColorStop(0.5, "#ffffff00");
    light.addColorStop(1, "#08202e38");
    c.fillStyle = light;
    c.fillRect(0, 0, W, H);
    rect(c, 0, 0, W, 2, "#182d36");
    rect(c, 0, H - 3, W, 3, "#182d36");
  }
}
