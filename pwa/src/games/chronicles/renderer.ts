/** Original, procedural pixel artwork. All coordinates below are authored in a 32 px tile. */
export type Facing = 'up' | 'down' | 'left' | 'right';
export type SceneActor = {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: 'npc' | 'object';
  palette?: string;
};
export type SceneWorld = {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: string[];
  actors: SceneActor[];
  exits?: Array<{ x: number; y: number; width: number; height: number; label: string }>;
};
export type ScenePlayer = { x: number; y: number; facing: Facing };

const TILE = 32;
const TAU = Math.PI * 2;
const COLORS = {
  grass: '#7b8756', grassDark: '#63764b', grassLight: '#9b9d68',
  earth: '#bca572', stone: '#d6c399', ink: '#293b37',
};

function random(x: number, y = 0, salt = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tileAt(world: SceneWorld, x: number, y: number): string {
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return ' ';
  return world.tiles.length === world.height
    ? (world.tiles[y]?.[x] ?? '.')
    : (world.tiles[y * world.width + x] ?? '.');
}

function polygon(ctx: CanvasRenderingContext2D, points: number[][], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, opacity = 0.2): void {
  ctx.fillStyle = `rgba(33,48,40,${opacity})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.15, 0, TAU);
  ctx.fill();
}

type Structure = { x: number; y: number; w: number; h: number };
type DrawItem = { depth: number; draw: () => void };

function buildings(world: SceneWorld): Structure[] {
  const result: Structure[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (tileAt(world, x, y) !== 'h' || seen.has(`${x}:${y}`)) continue;
      // The map's rectangular habitation footprints become one coherent building.
      let w = 1;
      while (x + w < world.width && tileAt(world, x + w, y) === 'h' && !seen.has(`${x + w}:${y}`)) w++;
      let h = 1;
      while (y + h < world.height) {
        let full = true;
        for (let dx = 0; dx < w; dx++) {
          if (tileAt(world, x + dx, y + h) !== 'h' || seen.has(`${x + dx}:${y + h}`)) full = false;
        }
        if (!full) break;
        h++;
      }
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) seen.add(`${x + dx}:${y + dy}`);
      result.push({ x, y, w, h });
    }
  }
  return result;
}

function drawGround(ctx: CanvasRenderingContext2D, world: SceneWorld, interior: boolean, desert: boolean): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tile = tileAt(world, x, y);
      const px = x * TILE;
      const py = y * TILE;
      const seed = random(x, y, 2);
      const grass = desert ? '#c8b181' : COLORS.grass;
      pixel(ctx, px, py, TILE, TILE, tile === '~' ? '#3b8b89' : tile === 's' ? '#c8b181' : tile === 'f' || interior ? '#bca788' : grass);
      if (tile === '~') {
        pixel(ctx, px, py, TILE, TILE, seed > 0.5 ? '#3e9291' : '#398888');
        for (let i = 0; i < 4; i++) {
          pixel(ctx, px + random(x, y, i + 3) * 25, py + random(x, y, i + 11) * 30, 5 + i, 1, '#469a95');
        }
        const shore = '#a6aa76';
        if (tileAt(world, x - 1, y) !== '~') {
          pixel(ctx, px, py, 3, TILE, shore);
          pixel(ctx, px + 3, py, 2, TILE, '#77ad99');
        }
        if (tileAt(world, x + 1, y) !== '~') {
          pixel(ctx, px + 29, py, 3, TILE, shore);
          pixel(ctx, px + 27, py, 2, TILE, '#77ad99');
        }
        if (tileAt(world, x, y - 1) !== '~') {
          pixel(ctx, px, py, TILE, 3, shore);
          pixel(ctx, px, py + 3, TILE, 2, '#77ad99');
        }
        if (tileAt(world, x, y + 1) !== '~') {
          pixel(ctx, px, py + 29, TILE, 3, shore);
          pixel(ctx, px, py + 27, TILE, 2, '#77ad99');
        }
        continue;
      }
      if (tile === 'f' || interior) {
        const stoneColors = ['#c9b595', '#c3b08f', '#bfa98b'];
        for (let row = 0; row < 2; row++) {
          const offset = (y * 2 + row) % 2 ? -10 : 0;
          for (let col = 0; col < 3; col++) {
            const sx = Math.max(0, offset + col * 22);
            const sw = Math.min(TILE - sx, 21 + Math.min(0, offset + col * 22));
            if (sw > 0) pixel(ctx, px + sx, py + row * 16 + 1, sw, 14, stoneColors[Math.floor(random(x + col, y + row) * 3)]);
          }
        }
        pixel(ctx, px + 4 + seed * 10, py + 7, 4, 1, '#d3c09e');
        continue;
      }
      const isRoad = tile === ':';
      if (isRoad) {
        pixel(ctx, px, py, TILE, TILE, seed > 0.5 ? '#bea77a' : '#bca473');
        const edge = '#aa9a6b';
        if (tileAt(world, x - 1, y) !== ':') {
          for (let i = 0; i < 8; i++) pixel(ctx, px, py + i * 4, 2 + random(x, y + i) * 3, 4, edge);
        }
        if (tileAt(world, x + 1, y) !== ':') {
          for (let i = 0; i < 8; i++) pixel(ctx, px + 29 - random(x + i, y) * 2, py + i * 4, 4, 4, edge);
        }
        if (tileAt(world, x, y - 1) !== ':') pixel(ctx, px, py, TILE, 2, edge);
        if (tileAt(world, x, y + 1) !== ':') pixel(ctx, px, py + 30, TILE, 2, edge);
      }
      const specks = isRoad || tile === 's' || desert ? 8 : 16;
      for (let i = 0; i < specks; i++) {
        const dx = Math.floor(random(x, y, i + 8) * 30);
        const dy = Math.floor(random(x, y, i + 37) * 30);
        const light = random(x, y, i + 19) > 0.45;
        pixel(ctx, px + dx, py + dy, light ? 2 : 1, 1, isRoad || tile === 's' || desert
          ? (light ? '#cfbb8d' : '#ae9669') : (light ? '#929c68' : '#6e7f50'));
      }
      if (!isRoad && tile !== 's' && seed > 0.43 && !desert) {
        const tx = px + 5 + random(x, y, 9) * 23;
        const ty = py + 8 + random(x, y, 11) * 20;
        pixel(ctx, tx, ty - 3, 1, 4, '#567148');
        pixel(ctx, tx - 2, ty - 1, 1, 3, '#567148');
        pixel(ctx, tx + 2, ty - 2, 1, 3, '#a7aa70');
        if (seed > 0.9) {
          pixel(ctx, tx + 7, ty - 4, 2, 2, '#d9c286');
          pixel(ctx, tx + 9, ty - 2, 2, 2, '#e3d3a0');
        }
      }
      if (tile === 's' && seed > 0.67) {
        pixel(ctx, px + 11, py + 15, 8, 4, '#a38f6a');
        pixel(ctx, px + 12, py + 14, 6, 3, '#dcc79e');
      }
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 7, 3, 24, 9, 0.22);
  polygon(ctx, [[-4, 3], [-6, -12], [-3, -25], [1, -25], [1, -11], [5, 2]], '#64583e');
  pixel(ctx, -2, -18, 2, 19, '#ad9361');
  polygon(ctx, [[-2, -13], [-14, -27], [-12, -29], [1, -20], [10, -30], [12, -27], [1, -11]], '#796448');
  const sway = Math.sin(time * 0.8 + seed * TAU) > 0.65 ? 1 : 0;
  ctx.translate(sway, 0);
  const clusters = [[-20, -39, 19, 18], [-10, -47, 22, 20], [7, -39, 17, 17], [-16, -29, 30, 13], [-26, -33, 15, 11]];
  clusters.forEach(([cx, cy, w, h], i) => {
    pixel(ctx, cx + 3, cy, w - 6, h, '#3d6048');
    pixel(ctx, cx, cy + 4, w, h - 8, '#3d6048');
    pixel(ctx, cx + 2, cy + 2, w - 5, h - 7, i % 2 ? '#6e8256' : '#637e53');
    pixel(ctx, cx + 5, cy + 1, w - 10, 3, '#8d9a68');
    for (let j = 0; j < 9; j++) {
      const lx = cx + 2 + random(i, seed, j) * (w - 4);
      const ly = cy + 3 + random(seed, i, j + 9) * (h - 6);
      pixel(ctx, lx, ly, 3, 1, j % 3 === 0 ? '#b2b580' : '#87976a');
      if (j === 4 || j === 7) pixel(ctx, lx, ly + 2, 1, 2, '#324e42');
    }
  });
  ctx.restore();
}

function drawWall(ctx: CanvasRenderingContext2D, world: SceneWorld, x: number, y: number, interior: boolean): void {
  const px = x * TILE;
  const py = y * TILE;
  const height = interior ? 22 : 17;
  pixel(ctx, px + 5, py + 18, 32, 15, 'rgba(42,48,34,0.13)');
  pixel(ctx, px, py + 12 - height, TILE, height + 18, '#a28f73');
  pixel(ctx, px, py + 10 - height, TILE, 7, '#dbc8a4');
  pixel(ctx, px + 1, py + 12 - height, TILE - 2, 3, '#ead9b4');
  for (let row = 0; row < Math.ceil(height / 8) + 1; row++) {
    const ry = py + 18 - row * 8;
    pixel(ctx, px, ry, TILE, 1, '#8c7d67');
    pixel(ctx, px + (row % 2 ? 8 : 20), ry - 6, 1, 6, '#8c7d67');
    pixel(ctx, px + 2, ry - 6, 6 + random(x, y, row) * 6, 1, '#b9a686');
  }
  if (tileAt(world, x, y + 1) === '#') pixel(ctx, px, py + 28, TILE, 4, '#b8a384');
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Structure, tent: boolean, seed: number): void {
  const x = b.x * TILE;
  const bottom = (b.y + b.h) * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const roofY = bottom - h - 15;
  shadow(ctx, x + w / 2 + 8, bottom + 3, w * 0.61, 12, 0.22);
  if (tent) {
    const cx = x + w / 2;
    polygon(ctx, [[x - 4, bottom - 3], [cx - 3, roofY], [x + w + 4, bottom - 3]], '#75624c');
    polygon(ctx, [[x - 4, bottom - 3], [cx - 3, roofY], [cx - 1, bottom - 3]], seed > 0.55 ? '#d9bd8b' : '#b8ae8c');
    polygon(ctx, [[cx - 3, roofY], [x + w + 4, bottom - 3], [cx + 1, bottom - 3]], seed > 0.55 ? '#b69565' : '#8f957d');
    polygon(ctx, [[cx - 1, roofY + 11], [cx + 1, bottom - 3], [cx - 13, bottom - 3]], '#574f3d');
    for (let i = 1; i < 5; i++) {
      ctx.strokeStyle = i % 2 ? '#c4a776' : '#e4c998';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 3 + i, roofY + 3 + i * 3);
      ctx.lineTo(x + w - 3 - i * 5, bottom - 4);
      ctx.stroke();
    }
    pixel(ctx, cx - 3, roofY - 7, 2, 9, '#645538');
    for (const side of [-1, 1]) {
      const pegX = cx + side * (w / 2 + 9);
      ctx.strokeStyle = '#8a7959';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + side * w / 3, roofY + h * 0.58);
      ctx.lineTo(pegX, bottom + 4);
      ctx.stroke();
      pixel(ctx, pegX, bottom + 1, 2, 6, '#685b42');
    }
    pixel(ctx, x + w - 22, bottom - 6, 12, 9, '#8f6d49');
    pixel(ctx, x + w - 20, bottom - 9, 8, 4, '#b28a5c');
    pixel(ctx, x + w - 18, bottom - 9, 4, 1, '#5c503c');
    pixel(ctx, x + 7, bottom - 4, 18, 5, '#ad9871');
    pixel(ctx, x + 9, bottom - 6, 14, 3, '#ccba8a');
    pixel(ctx, x + 14, bottom - 6, 2, 7, '#827153');
    return;
  }
  const facadeY = bottom - Math.min(35, h + 8);
  pixel(ctx, x, facadeY, w, bottom - facadeY - 2, '#c7b28b');
  pixel(ctx, x + w - 8, facadeY, 8, bottom - facadeY - 2, '#ad9473');
  pixel(ctx, x + 2, facadeY + 3, w - 12, 3, '#dcc69d');
  for (let i = 0; i < w / 18; i++) {
    const by = bottom - 8 - Math.floor(random(i, b.x, b.y) * 3) * 7;
    pixel(ctx, x + i * 18 + 3, by, 8, 1, '#b19a75');
  }
  const doorW = Math.min(18, w * 0.35);
  const doorX = x + w * 0.56 - doorW / 2;
  pixel(ctx, doorX - 3, bottom - 25, doorW + 6, 24, '#b29a74');
  pixel(ctx, doorX, bottom - 23, doorW, 22, '#564c3a');
  pixel(ctx, doorX + 2, bottom - 21, doorW - 4, 20, '#695944');
  for (let k = 0; k < 3; k++) pixel(ctx, doorX + 3 + k * 4, bottom - 20, 1, 18, '#7d684b');
  pixel(ctx, doorX + doorW - 4, bottom - 11, 2, 2, '#d1af66');
  pixel(ctx, doorX - 4, bottom - 2, doorW + 8, 3, '#e1cba2');
  const roof = seed > 0.5 ? '#bc936a' : '#c6a277';
  const roofDepth = Math.max(15, facadeY - roofY);
  pixel(ctx, x - 3, roofY, w + 6, roofDepth, roof);
  pixel(ctx, x - 4, roofY, w + 8, 3, '#e0c49a');
  pixel(ctx, x - 4, facadeY - 1, w + 8, 5, '#a88864');
  pixel(ctx, x - 3, roofY + 3, 4, roofDepth - 3, '#dac198');
  pixel(ctx, x + w - 1, roofY + 3, 4, roofDepth - 3, '#9b7d59');
  for (let k = 0; k < w / 12; k++) {
    for (let row = 0; row < roofDepth / 13; row++) {
      pixel(ctx, x + k * 12 + 3, roofY + row * 13 + 5, 5 + random(k, row) * 3, 1, '#d0af84');
    }
  }
  if (w > 80 && roofDepth > 45) {
    // Reed mats and drying cloth on an accessible flat roof.
    pixel(ctx, x + 18, roofY + 18, 38, 24, '#92744d');
    pixel(ctx, x + 19, roofY + 19, 36, 21, '#d1b987');
    for (let line = 0; line < 8; line++) pixel(ctx, x + 20, roofY + 20 + line * 2, 34, 1, '#b39867');
    pixel(ctx, x + w - 51, facadeY - 26, 26, 17, '#bfa77b');
    pixel(ctx, x + w - 48, facadeY - 26, 3, 17, '#e2cd9c');
    pixel(ctx, x + w - 31, facadeY - 26, 3, 17, '#e2cd9c');
  }
  if (w > 47) {
    pixel(ctx, x + 9, bottom - 25, 13, 14, '#a38a67');
    pixel(ctx, x + 11, bottom - 23, 9, 10, '#4e5848');
    pixel(ctx, x + 15, bottom - 23, 1, 10, '#c1ac80');
    pixel(ctx, x + 9, bottom - 12, 14, 2, '#dfc69b');
    pixel(ctx, x + 7, roofY - 8, 14, 9, '#c8af83');
    pixel(ctx, x + 9, roofY - 9, 10, 2, '#e3cda6');
  }
  if (w >= 64) {
    const awningY = bottom - 28;
    polygon(ctx, [[x + 3, awningY], [x + 30, awningY], [x + 36, awningY + 10], [x - 2, awningY + 10]], '#9c7860');
    for (let i = 0; i < 4; i++) polygon(ctx, [[x + 3 + i * 7, awningY], [x + 6 + i * 7, awningY], [x + 4 + i * 9, awningY + 10], [x + i * 9, awningY + 10]], '#d3b88b');
    pixel(ctx, x - 1, awningY + 10, 2, 20, '#715e43');
    pixel(ctx, x + 33, awningY + 10, 2, 20, '#715e43');
  }
  // A pair of hand-thrown storage vessels beside the entrance.
  pixel(ctx, x + w - 13, bottom - 10, 8, 10, '#9c6a49');
  pixel(ctx, x + w - 11, bottom - 12, 4, 3, '#b8865b');
  pixel(ctx, x + w - 10, bottom - 11, 2, 1, '#544738');
  pixel(ctx, x + w - 12, bottom - 7, 2, 5, '#c19368');
}

function drawFurniture(ctx: CanvasRenderingContext2D, b: Structure): void {
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  shadow(ctx, x + w / 2 + 4, y + h + 3, w / 2 + 3, 6, 0.18);
  pixel(ctx, x + 2, y - 13, w - 4, h + 13, '#67543c');
  pixel(ctx, x + 3, y - 13, w - 6, 5, '#b08b5b');
  pixel(ctx, x + 4, y - 7, w - 8, h - 1, '#9a774e');
  pixel(ctx, x + 5, y + h - 7, w - 10, 5, '#c2a06a');
  for (let row = 0; row < Math.max(1, Math.floor(h / 24)); row++) {
    const shelfY = y + row * 26;
    for (let col = 0; col < Math.floor(w / 19); col++) {
      const jarX = x + 11 + col * 19;
      const jarColor = col % 2 ? '#b18a5d' : '#c5a77b';
      pixel(ctx, jarX - 5, shelfY - 5, 10, 14, jarColor);
      pixel(ctx, jarX - 3, shelfY - 8, 6, 5, '#9a714c');
      pixel(ctx, jarX - 2, shelfY - 9, 4, 2, '#d6b984');
      pixel(ctx, jarX - 4, shelfY - 3, 2, 8, '#d6b984');
    }
    pixel(ctx, x + 3, shelfY + 11, w - 6, 3, '#73583e');
    pixel(ctx, x + 3, shelfY + 10, w - 6, 1, '#c6a16e');
  }
  pixel(ctx, x + 2, y - 13, 3, h + 13, '#bd9a66');
  pixel(ctx, x + w - 5, y - 13, 3, h + 13, '#7b5f40');
}

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, facing: Facing, moving: boolean, palette: string, player: boolean, seed: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 2, 2, 8, 3, 0.25);
  const walk = moving ? Math.sin(time * 12) : 0;
  const bob = moving ? Math.round(Math.abs(walk)) : (Math.sin(time * 1.5 + seed) > 0.8 ? -1 : 0);
  const cloth = palette.startsWith('#') ? palette : ({ earth: '#a88d61', sage: '#7f9470', blue: '#668a97', clay: '#bd8067', gold: '#c1a364' }[palette] || '#b39468');
  const skin = seed > 0.55 ? '#b67c51' : '#c39061';
  const darkSkin = seed > 0.55 ? '#905e42' : '#a5704d';
  ctx.translate(0, bob);
  pixel(ctx, -5, -5 + walk * 1.5, 4, 6, '#554d3e');
  pixel(ctx, 1, -5 - walk * 1.5, 4, 6, '#554d3e');
  pixel(ctx, -6, -1 + walk * 1.5, 5, 2, '#b0976e');
  pixel(ctx, 1, -1 - walk * 1.5, 5, 2, '#b0976e');
  polygon(ctx, [[-5, -20], [5, -20], [7, -5], [5, -2], [-6, -2], [-7, -5]], cloth);
  pixel(ctx, -5, -18, 3, 13, 'rgba(255,235,186,0.15)');
  pixel(ctx, 4, -17, 2, 12, 'rgba(35,42,38,0.2)');
  pixel(ctx, -5, -11, 11, 2, player ? '#705b3b' : '#8c704d');
  pixel(ctx, -8, -18 + walk, 3, 8, cloth);
  pixel(ctx, 6, -18 - walk, 3, 8, cloth);
  pixel(ctx, -8, -11 + walk, 3, 4, skin);
  pixel(ctx, 6, -11 - walk, 3, 4, darkSkin);
  pixel(ctx, -2, -23, 5, 4, darkSkin);
  pixel(ctx, -5, -31, 11, 10, '#483d32');
  pixel(ctx, -5, -29, 11, 9, skin);
  pixel(ctx, -5, -31, 11, 3, '#4c4133');
  pixel(ctx, 4, -28, 2, 6, darkSkin);
  if (facing === 'up') {
    pixel(ctx, -5, -29, 11, 9, player ? '#e6d2a1' : '#9c8863');
    pixel(ctx, -5, -31, 11, 3, player ? '#f0ddaf' : '#c1a984');
    pixel(ctx, 3, -25, 4, 9, player ? '#d4bd8b' : '#8c7758');
  } else {
    const eyeX = facing === 'left' ? -4 : facing === 'right' ? 3 : -3;
    pixel(ctx, eyeX, -26, 1, 1, '#382f2a');
    if (facing === 'down') pixel(ctx, 2, -26, 1, 1, '#382f2a');
    pixel(ctx, facing === 'left' ? -6 : facing === 'right' ? 5 : -1, -25, 2, 2, skin);
    pixel(ctx, -2, -22, 5, 2, '#77503a');
    if (player) {
      pixel(ctx, -6, -32, 13, 4, '#eddbb2');
      pixel(ctx, -6, -28, 3, 9, '#d5bd8c');
      pixel(ctx, 4, -28, 3, 8, '#d5bd8c');
      pixel(ctx, -6, -29, 13, 2, '#84684a');
    } else if (seed > 0.5) {
      pixel(ctx, -6, -31, 13, 3, '#e2c89d');
      pixel(ctx, -6, -28, 3, 6, '#cbb082');
    }
  }
  if (player) {
    // Indigo shoulder mantle and a small traveller's satchel, never medieval armor.
    polygon(ctx, [[-6, -20], [-2, -19], [5, -5], [2, -3]], '#4f777d');
    pixel(ctx, -8, -11, 5, 7, '#8a6745');
    pixel(ctx, -7, -10, 3, 2, '#b9915d');
  }
  ctx.restore();
}

function drawObject(ctx: CanvasRenderingContext2D, actor: SceneActor, time: number): void {
  const x = Math.round(actor.x * TILE);
  const y = Math.round(actor.y * TILE);
  const label = `${actor.id} ${actor.name}`.toLocaleLowerCase('pt-BR');
  ctx.save();
  ctx.translate(x, y);
  if (/lost-seal|selo|folhas/.test(label)) {
    shadow(ctx, 2, 2, 7, 2, 0.12);
    pixel(ctx, -7, -2, 5, 2, '#6d8051');
    pixel(ctx, 3, 0, 6, 2, '#7d915b');
    pixel(ctx, -2, -5, 6, 5, '#ac7b50');
    pixel(ctx, -1, -5, 4, 1, '#d0ac73');
    pixel(ctx, 0, -3, 2, 1, '#795f41');
    if (Math.sin(time * 2.2) > 0.75) {
      pixel(ctx, 5, -9, 1, 5, '#e6d29a');
      pixel(ctx, 3, -7, 5, 1, '#e6d29a');
    }
  } else if (/sign|marco|orienta|estacas/.test(label)) {
    shadow(ctx, 4, 3, 10, 3, 0.14);
    pixel(ctx, -1, -26, 3, 29, '#735e3f');
    polygon(ctx, [[-13, -25], [8, -25], [14, -20], [8, -15], [-13, -15]], '#ac8c5d');
    pixel(ctx, -11, -24, 19, 2, '#d2b581');
    pixel(ctx, -9, -20, 11, 1, '#6b5d42');
    pixel(ctx, -9, -18, 7, 1, '#6b5d42');
    pixel(ctx, 4, -21, 4, 3, '#806f4d');
  } else if (/mirante|overlook/.test(label)) {
    shadow(ctx, 3, 3, 19, 5, 0.17);
    pixel(ctx, -17, -2, 34, 7, '#a99d7b');
    pixel(ctx, -14, -6, 28, 6, '#c9b991');
    pixel(ctx, -11, -10, 22, 5, '#dfd0aa');
    pixel(ctx, -9, -13, 3, 4, '#ac9e7b');
    pixel(ctx, 6, -13, 3, 4, '#ac9e7b');
  } else if (/mesa|cargo|prepara/.test(label)) {
    shadow(ctx, 3, 2, 20, 6, 0.17);
    pixel(ctx, -14, -11, 3, 13, '#70563b');
    pixel(ctx, 11, -11, 3, 13, '#70563b');
    pixel(ctx, -17, -17, 34, 8, '#9d7b4f');
    pixel(ctx, -16, -18, 32, 3, '#c29e68');
    pixel(ctx, -13, -25, 9, 8, '#a49a73');
    pixel(ctx, -11, -28, 5, 4, '#c1b28a');
    pixel(ctx, -10, -26, 3, 1, '#7e795a');
    pixel(ctx, 0, -22, 8, 4, '#d2ad71');
    pixel(ctx, 1, -23, 6, 2, '#e4c38a');
    pixel(ctx, 8, -24, 7, 6, '#e3d6a7');
    pixel(ctx, 9, -23, 5, 1, '#f3e7c0');
  } else if (/poço|poco|well|fonte/.test(label)) {
    shadow(ctx, 3, 4, 20, 6);
    pixel(ctx, -16, -10, 32, 13, '#a49476');
    pixel(ctx, -17, -12, 34, 6, '#dfcc9e');
    pixel(ctx, -12, -11, 24, 4, '#345b58');
    for (let i = 0; i < 4; i++) pixel(ctx, -14 + i * 8, -4, 1, 7, '#80765e');
    pixel(ctx, -18, -35, 3, 38, '#6d5a3e');
    pixel(ctx, 15, -35, 3, 38, '#6d5a3e');
    polygon(ctx, [[-23, -33], [0, -46], [23, -33]], '#9c7651');
    pixel(ctx, -22, -33, 44, 4, '#b78d60');
    pixel(ctx, 0, -30, 1, 18, '#bca577');
    pixel(ctx, -4, -16, 9, 7, '#97734c');
  } else if (/altar|pedra|stone|memorial|monumento/.test(label)) {
    shadow(ctx, 3, 3, 20, 7);
    pixel(ctx, -16, -7, 32, 10, '#9b9277');
    pixel(ctx, -12, -14, 24, 9, '#bdb08d');
    pixel(ctx, -14, -16, 28, 4, '#ded0ab');
    for (let i = 0; i < 3; i++) pixel(ctx, -9 + i * 8, -6, 1, 9, '#807c67');
    if (/altar/.test(label)) {
      const flame = 4 + Math.sin(time * 8) * 2;
      polygon(ctx, [[-5, -16], [-2, -20 - flame], [1, -18], [4, -24], [6, -16]], '#e8ad60');
      pixel(ctx, -2, -20, 5, 4, '#f8d994');
    }
  } else if (/lâmpada|lampada|lamp|fogo|fire/.test(label)) {
    shadow(ctx, 1, 2, 8, 3);
    pixel(ctx, -3, -18, 6, 20, '#7a684c');
    pixel(ctx, -7, -3, 14, 4, '#b39560');
    pixel(ctx, -6, -21, 12, 5, '#c7a66e');
    pixel(ctx, -3, -27 + Math.sin(time * 9), 5, 7, '#f4c171');
    pixel(ctx, -1, -25, 2, 4, '#fff0c0');
    const glow = ctx.createRadialGradient(0, -22, 1, 0, -22, 28);
    glow.addColorStop(0, 'rgba(255,206,112,0.23)');
    glow.addColorStop(1, 'rgba(255,206,112,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-28, -50, 56, 56);
  } else if (/baú|bau|chest|arca|depósito|deposito/.test(label)) {
    shadow(ctx, 2, 2, 14, 4);
    pixel(ctx, -12, -15, 24, 17, '#795c3d');
    pixel(ctx, -12, -18, 24, 7, '#ac8354');
    pixel(ctx, -10, -17, 20, 2, '#cfaa6f');
    pixel(ctx, -8, -18, 2, 20, '#c8ab71');
    pixel(ctx, 6, -18, 2, 20, '#c8ab71');
    pixel(ctx, -2, -8, 4, 4, '#dec18b');
  } else if (/porta|saída|saida|exit|entrada|gate/.test(label)) {
    // Unobtrusive doorway ornament; the tile map owns collision and exits.
    shadow(ctx, 0, 2, 12, 4, 0.12);
    pixel(ctx, -10, -1, 20, 3, '#e2cda5');
    pixel(ctx, -11, -3, 22, 2, '#c2a879');
    pixel(ctx, 8, -23, 3, 7, '#926c47');
    pixel(ctx, 9, -22, 1, 5, '#dfbd7b');
  } else if (/água|agua|jarro|vaso|jar|water/.test(label)) {
    shadow(ctx, 1, 2, 9, 3);
    pixel(ctx, -7, -13, 14, 12, '#ac7350');
    pixel(ctx, -5, -17, 10, 6, '#c38e60');
    pixel(ctx, -3, -20, 6, 4, '#a46d47');
    pixel(ctx, -2, -19, 4, 1, '#544b3a');
    pixel(ctx, -5, -11, 2, 7, '#d6a574');
  } else {
    shadow(ctx, 1, 2, 11, 3, 0.17);
    pixel(ctx, -9, -8, 18, 9, '#8b7753');
    pixel(ctx, -10, -10, 20, 3, '#b49a69');
    // Rolled linen or a parchment record; no modern floating collectible icon.
    polygon(ctx, [[-7, -13], [6, -15], [8, -10], [-6, -8]], '#eee0ba');
    pixel(ctx, -8, -14, 3, 7, '#d3bb89');
    pixel(ctx, 5, -16, 3, 7, '#d3bb89');
    pixel(ctx, -2, -12, 5, 1, '#b0996e');
  }
  ctx.restore();
}

/** Owns visual caches only. Simulation and saved game state remain outside the renderer. */
export class ChroniclesRenderer {
  private world: SceneWorld | null = null;
  private ground: HTMLCanvasElement | null = null;
  private structures: Structure[] = [];
  private interior = false;
  private desert = false;
  private camera = { x: 0, y: 0 };
  private lastPlayer = { x: 0, y: 0 };
  private movingUntil = 0;
  private transition = 0;

  reset(): void {
    this.world = null;
    this.ground = null;
    this.structures = [];
  }

  draw(ctx: CanvasRenderingContext2D, world: SceneWorld, player: ScenePlayer, width: number, height: number, time: number, dt: number, reducedMotion: boolean): void {
    if (this.world !== world) {
      const mapChanged = this.world?.id !== world.id;
      this.world = world;
      this.interior = /interior|casa|house|santu[aá]rio/.test(`${world.id} ${world.name}`.toLowerCase());
      this.desert = /camp|acamp|deserto|êxodo|exodo/.test(`${world.id} ${world.name}`.toLowerCase());
      this.structures = buildings(world);
      this.ground = document.createElement('canvas');
      this.ground.width = world.width * TILE;
      this.ground.height = world.height * TILE;
      const groundContext = this.ground.getContext('2d');
      if (groundContext) drawGround(groundContext, world, this.interior, this.desert);
      if (mapChanged) {
        this.camera = { x: player.x * TILE, y: player.y * TILE };
        this.lastPlayer = { x: player.x, y: player.y };
        this.transition = reducedMotion ? 0 : time + 0.35;
      }
    }
    if (Math.hypot(player.x - this.lastPlayer.x, player.y - this.lastPlayer.y) > 0.001) this.movingUntil = time + 0.09;
    this.lastPlayer = { x: player.x, y: player.y };
    const moving = time < this.movingUntil;
    const tileSize = clamp(width / (width < 560 ? 15 : 24), 25, 42);
    const scale = tileSize / TILE;
    const viewW = width / scale;
    const viewH = height / scale;
    const mapW = world.width * TILE;
    const mapH = world.height * TILE;
    const targetX = mapW < viewW ? mapW / 2 : clamp(player.x * TILE, viewW / 2, mapW - viewW / 2);
    const targetY = mapH < viewH ? mapH / 2 : clamp(player.y * TILE - 18, viewH / 2, mapH - viewH / 2);
    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    this.camera.x += (targetX - this.camera.x) * lerp;
    this.camera.y += (targetY - this.camera.y) * lerp;
    const left = this.camera.x - viewW / 2;
    const top = this.camera.y - viewH / 2;
    ctx.clearRect(0, 0, width, height);
    this.drawBackdrop(ctx, width, height, reducedMotion ? 0 : time);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-Math.round(left), -Math.round(top));
    ctx.imageSmoothingEnabled = false;
    if (this.ground) ctx.drawImage(this.ground, 0, 0);
    const minX = Math.max(0, Math.floor(left / TILE) - 2);
    const maxX = Math.min(world.width, Math.ceil((left + viewW) / TILE) + 2);
    const minY = Math.max(0, Math.floor(top / TILE) - 3);
    const maxY = Math.min(world.height, Math.ceil((top + viewH) / TILE) + 3);
    this.drawWater(ctx, world, minX, minY, maxX, maxY, reducedMotion ? 0 : time);
    this.drawDetails(ctx, world, minX, minY, maxX, maxY);
    const items: DrawItem[] = [];
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      const tile = tileAt(world, x, y);
      if (tile === 't') items.push({ depth: (y + 0.8) * TILE, draw: () => drawTree(ctx, (x + 0.5) * TILE, (y + 0.85) * TILE, reducedMotion ? 0 : time, random(x, y)) });
      if (tile === '#') items.push({ depth: (y + 0.9) * TILE, draw: () => drawWall(ctx, world, x, y, this.interior) });
    }
    for (const building of this.structures) {
      if (building.x + building.w < minX || building.x > maxX || building.y + building.h < minY || building.y > maxY) continue;
      items.push({ depth: (building.y + building.h) * TILE - 2, draw: () => this.interior
        ? drawFurniture(ctx, building)
        : drawBuilding(ctx, building, this.desert, random(building.x, building.y)) });
    }
    let nearby: SceneActor | undefined;
    let nearDistance = 1.65;
    for (const actor of world.actors) {
      if (actor.x < minX || actor.x > maxX || actor.y < minY || actor.y > maxY) continue;
      const distance = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (distance < nearDistance) {
        nearDistance = distance;
        nearby = actor;
      }
      const seed = random(actor.x, actor.y, 5);
      items.push({ depth: actor.y * TILE, draw: () => {
        if (actor.kind === 'npc') {
          const facing: Facing = distance < 2.5 ? (Math.abs(player.x - actor.x) > Math.abs(player.y - actor.y)
            ? player.x > actor.x ? 'right' : 'left'
            : player.y > actor.y ? 'down' : 'up') : (seed > 0.65 ? 'left' : seed > 0.35 ? 'down' : 'right');
          // Moradores alternam trabalho/caminhada curta e repouso perto da
          // própria posição. A âncora de interação e colisão não se move,
          // para preservar as missões e o salvamento do episódio.
          const routine = !reducedMotion && distance >= 2.5 && (Math.floor(time / 4 + seed * 7) % 4 === 1);
          const shift = routine ? Math.sin(time * 1.6 + seed * 10) * 2 : 0;
          drawPerson(ctx, actor.x * TILE + shift, actor.y * TILE, reducedMotion ? 0 : time, facing, routine, actor.palette || 'earth', false, seed);
        } else drawObject(ctx, actor, reducedMotion ? 0 : time);
      } });
    }
    items.push({ depth: player.y * TILE, draw: () => drawPerson(ctx, player.x * TILE, player.y * TILE, reducedMotion ? 0 : time, player.facing, moving && !reducedMotion, '#d7bb86', true, 0.85) });
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();
    this.drawExitMarkers(ctx, world, player, reducedMotion ? 0 : time);
    if (nearby) this.drawInteraction(ctx, nearby, reducedMotion ? 0 : time);
    if (this.interior) this.drawInteriorLight(ctx, world, left, top, viewW, viewH, reducedMotion ? 0 : time);
    ctx.restore();
    this.drawAtmosphere(ctx, width, height, time, reducedMotion);
    if (this.transition > time) {
      ctx.fillStyle = `rgba(24,35,30,${clamp((this.transition - time) / 0.35, 0, 1)})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void {
    if (this.interior) {
      ctx.fillStyle = '#1a2924';
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#718c8a');
    sky.addColorStop(0.58, '#c0c2a3');
    sky.addColorStop(1, '#9b9b73');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    for (let layer = 0; layer < 3; layer++) {
      const points: number[][] = [[0, height]];
      for (let x = -60; x <= width + 80; x += 70) {
        points.push([x, height * (0.2 + layer * 0.17) + random(x, layer) * height * 0.18]);
      }
      points.push([width, height]);
      polygon(ctx, points, ['#7f9690', '#718674', '#738364'][layer]);
    }
    // Thin, distant cloud wisps are visible around smaller, enclosed maps.
    pixel(ctx, ((time * 2) % (width + 140)) - 140, height * 0.1, 100, 2, 'rgba(240,229,194,.18)');
  }

  private drawWater(ctx: CanvasRenderingContext2D, world: SceneWorld, minX: number, minY: number, maxX: number, maxY: number, time: number): void {
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      if (tileAt(world, x, y) !== '~') continue;
      for (let i = 0; i < 3; i++) {
        const dx = (random(x, y, i + 4) * 23 + time * (1 + i * 0.3)) % 26;
        const dy = 5 + ((random(x, y, i + 18) * 22 + time * 3) % 22);
        const opacity = 0.11 + (Math.sin(time * 1.6 + random(x, y, i) * 7) + 1) * 0.08;
        pixel(ctx, x * TILE + 3 + dx, y * TILE + dy, 4 + i * 2, 1, `rgba(218,236,196,${opacity})`);
      }
      if (tileAt(world, x - 1, y) !== '~' && random(x, y) > 0.35) {
        const baseX = x * TILE + 1;
        const baseY = y * TILE + 20;
        pixel(ctx, baseX, baseY - 12, 1, 14, '#496f50');
        pixel(ctx, baseX - 2, baseY - 8, 1, 11, '#638251');
        pixel(ctx, baseX + 2, baseY - 10, 1, 12, '#8b995d');
        pixel(ctx, baseX, baseY - 15, 1, 5, '#8b7650');
      }
    }
  }

  private drawDetails(ctx: CanvasRenderingContext2D, world: SceneWorld, minX: number, minY: number, maxX: number, maxY: number): void {
    if (this.interior) {
      const cx = world.width * TILE * 0.5;
      const cy = world.height * TILE * 0.54;
      pixel(ctx, cx - 42, cy - 30, 84, 60, '#8f5948');
      pixel(ctx, cx - 39, cy - 27, 78, 54, '#bc9669');
      pixel(ctx, cx - 35, cy - 23, 70, 46, '#8b624d');
      for (let i = 0; i < 7; i++) {
        polygon(ctx, [[cx - 29 + i * 9, cy], [cx - 25 + i * 9, cy - 6], [cx - 21 + i * 9, cy], [cx - 25 + i * 9, cy + 6]], '#c3a273');
      }
      for (let i = -36; i <= 36; i += 6) {
        pixel(ctx, cx + i, cy - 33, 2, 4, '#d4ba8a');
        pixel(ctx, cx + i, cy + 30, 2, 4, '#d4ba8a');
      }
      return;
    }
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      const tile = tileAt(world, x, y);
      if (tile !== '.' && tile !== 's') continue;
      const seed = random(x, y, 81);
      if (seed > 0.96) {
        const px = x * TILE + 11;
        const py = y * TILE + 18;
        shadow(ctx, px + 4, py + 2, 8, 2, 0.1);
        polygon(ctx, [[px - 5, py], [px - 3, py - 5], [px + 4, py - 7], [px + 8, py - 2], [px + 6, py + 2]], '#8f967a');
        pixel(ctx, px - 2, py - 5, 7, 2, '#bdba91');
      } else if (seed > 0.91 && !this.desert) {
        const px = x * TILE + 16;
        const py = y * TILE + 17;
        pixel(ctx, px - 5, py - 3, 11, 5, '#657d4d');
        pixel(ctx, px - 3, py - 5, 7, 4, '#8c9c60');
        pixel(ctx, px - 1, py - 4, 2, 1, '#b3b77b');
      }
    }
  }

  private drawInteraction(ctx: CanvasRenderingContext2D, actor: SceneActor, time: number): void {
    const x = Math.round(actor.x * TILE);
    const y = Math.round(actor.y * TILE - (actor.kind === 'npc' ? 46 : 48) + Math.sin(time * 2.6) * 1.5);
    ctx.fillStyle = '#f0db9f';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3e5548';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y + 0.5);
    polygon(ctx, [[x - 3, y + 9], [x + 3, y + 9], [x, y + 12]], '#f0db9f');
  }

  private drawExitMarkers(ctx: CanvasRenderingContext2D, world: SceneWorld, player: ScenePlayer, time: number): void {
    for (const exit of world.exits ?? []) {
      const x = (exit.x + exit.width / 2) * TILE;
      const y = (exit.y + exit.height / 2) * TILE;
      const distance = Math.hypot(player.x * TILE - x, player.y * TILE - y);
      if (distance > 145) continue;
      ctx.save();
      ctx.globalAlpha = clamp((170 - distance) / 100, 0.25, 0.9);
      pixel(ctx, x - 12, y + 3, 24, 2, '#eddbac');
      const dy = Math.sin(time * 2) * 1;
      polygon(ctx, [[x - 3, y - 3 + dy], [x, y - 7 + dy], [x + 3, y - 3 + dy]], '#f3dc9d');
      if (distance < 90) {
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelWidth = ctx.measureText(exit.label).width + 12;
        pixel(ctx, x - labelWidth / 2, y - 24, labelWidth, 14, 'rgba(29,48,37,.88)');
        ctx.fillStyle = '#f0dfba';
        ctx.fillText(exit.label, x, y - 17);
      }
      ctx.restore();
    }
  }

  private drawInteriorLight(ctx: CanvasRenderingContext2D, world: SceneWorld, left: number, top: number, width: number, height: number, time: number): void {
    ctx.fillStyle = 'rgba(53,44,37,.12)';
    ctx.fillRect(left, top, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const x = world.width * TILE * 0.32;
    polygon(ctx, [[x - 13, 40], [x + 13, 40], [x + 125, height + top], [x + 35, height + top]], 'rgba(242,209,141,.07)');
    const glow = ctx.createRadialGradient(x, 64, 3, x, 64, 140 + Math.sin(time) * 2);
    glow.addColorStop(0, 'rgba(255,219,147,.2)');
    glow.addColorStop(1, 'rgba(255,219,147,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 150, -86, 300, 300);
    ctx.restore();
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, reducedMotion: boolean): void {
    // Warm sunlight and a cool edge shadow unify the original pixel palette.
    const light = ctx.createLinearGradient(0, 0, width, height);
    light.addColorStop(0, this.interior ? 'rgba(249,207,137,.08)' : 'rgba(255,224,164,.13)');
    light.addColorStop(0.6, 'rgba(254,224,168,0)');
    light.addColorStop(1, 'rgba(31,61,58,.12)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, height * 0.22, width / 2, height / 2, Math.max(width, height) * 0.7);
    vignette.addColorStop(0, 'rgba(24,44,36,0)');
    vignette.addColorStop(1, 'rgba(24,44,36,.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    if (!reducedMotion) {
      const count = width < 500 ? 13 : 24;
      for (let i = 0; i < count; i++) {
        const px = (random(i, 12) * width + time * (2 + random(i, 8) * 6)) % (width + 20) - 10;
        const py = (random(i, 23) * height + Math.sin(time * 0.35 + i) * 9 + time * 1.2) % height;
        pixel(ctx, px, py, i % 5 === 0 ? 2 : 1, 1, `rgba(250,231,182,${0.12 + random(i, 2) * 0.25})`);
      }
    }
  }
}
