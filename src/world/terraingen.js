// 程序化地图生成:起伏地形、湖泊、公园边界(栅栏)、入口与初始路径。
import { MAP_W, MAP_H, SURF, WATER_H, MIN_H, MAX_H, PATH } from '../config.js';
import { makeNoise2D, RNG } from '../core/random.js';
import { World } from './world.js';

export const OWNED_RECT = { x0: 14, y0: 14, x1: 86, y1: 86 };  // [x0,x1) × [y0,y1)
const CORNER_CUT = 10;  // 圆角半径

export function generateTerrain(world, seed = 20240815) {
  const rng = new RNG(seed);
  const noise = makeNoise2D(seed);
  const lakeNoise = makeNoise2D(seed ^ 0x9e3779b9);

  // 1. 在角点网格上生成高度(共享角点 → 天然连续坡面)
  const gw = MAP_W + 1, gh = MAP_H + 1;
  const corner = new Float32Array(gw * gh);
  const lakeX = rng.range(0.68, 0.8) * MAP_W;
  const lakeY = rng.range(0.2, 0.35) * MAP_H;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let h = 7.5 + noise.fbm(gx * 0.045 + 13.7, gy * 0.045 + 7.1, 4) * 9;   // 主体起伏 ~3..12
      h += noise.fbm(gx * 0.16, gy * 0.16, 2) * 1.2;                        // 细节
      // 湖盆:向指定中心压低
      const dl = Math.hypot(gx - lakeX, gy - lakeY);
      const basin = Math.max(0, 1 - dl / 22);
      h -= basin * basin * 9 + lakeNoise.noise(gx * 0.1, gy * 0.1) * basin * 1.5;
      // 地图边缘收拢(不可见区,压低即可)
      const edge = Math.min(gx, gy, MAP_W - gx, MAP_H - gy);
      if (edge < 6) h -= (6 - edge) * 0.6;
      corner[gy * gw + gx] = Math.max(2, h);
    }
  }

  // 1b. 平滑 + 整数化角点网格:消除“单格台阶”噪点,形成大片台地(RCT2 观感)
  let cur = corner, nxt = new Float32Array(gw * gh);
  for (let pass = 0; pass < 2; pass++) {
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const sx = gx + dx, sy = gy + dy;
          if (sx < 0 || sy < 0 || sx >= gw || sy >= gh) continue;
          sum += cur[sy * gw + sx]; cnt++;
        }
        nxt[gy * gw + gx] = sum / cnt;
      }
    }
    [cur, nxt] = [nxt, cur];
  }
  for (let i = 0; i < cur.length; i++) cur[i] = Math.round(Math.min(MAX_H - 1, Math.max(2, cur[i])));
  // 再强制每 tile 四角高度差 ≤ 1(slope 位掩码只能表达 base/base+1;>1 会在 tile 间留洞)
  relaxSlopes(cur, gw, gh);

  // 2. 从角点推导每 tile 的 base + slope
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const c = [
        corner[y * gw + x], corner[y * gw + x + 1],
        corner[(y + 1) * gw + x + 1], corner[(y + 1) * gw + x],
      ].map(Math.round);
      const b = Math.max(MIN_H, Math.min(...c));
      let s = 0;
      for (let i = 0; i < 4; i++) if (c[i] > b) s |= 1 << i;
      world.setBaseSlope(x, y, Math.min(b, MAX_H - 1), s);

      // 表面类型(园内以草为主,泥土斑块留给野地)
      let surf = SURF.GRASS;
      const hmWorld = (b + 0.5);
      const ownedSoon = x >= OWNED_RECT.x0 && x < OWNED_RECT.x1 && y >= OWNED_RECT.y0 && y < OWNED_RECT.y1;
      const dirtThresh = ownedSoon ? 0.42 : 0.22;
      if (hmWorld <= WATER_H + 0.6) surf = SURF.SAND;
      else if (b >= 12 && !ownedSoon) surf = SURF.ROCK;
      else if (noise.noise(x * 0.07 + 50, y * 0.07 + 50) > dirtThresh) surf = SURF.DIRT;
      else if (!ownedSoon && noise.noise(x * 0.23, y * 0.23) > 0.4) surf = SURF.DIRT;
      world.surf[world.idx(x, y)] = surf;
    }
  }

  // 3. 公园拥有区(圆角矩形)。栅栏由 terrain 渲染沿边界生成。
  const { x0, y0, x1, y1 } = OWNED_RECT;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cdx = Math.max(x0 + CORNER_CUT - x, 0, x - (x1 - CORNER_CUT - 1));
      const cdy = Math.max(y0 + CORNER_CUT - y, 0, y - (y1 - CORNER_CUT - 1));
      if (cdx * cdx + cdy * cdy <= CORNER_CUT * CORNER_CUT) {
        world.owned[world.idx(x, y)] = 1;
      }
    }
  }

  // 4. 入口:南边界中点。平整入口周边,铺初始路径。
  const ex = Math.floor((x0 + x1) / 2), ey = y0;
  flattenRect(world, ex - 9, ey - 4, ex + 9, ey + 14, 6);
  world.entrance = { x: ex, y: ey, dir: 1 };   // dir=1 → 园内是 +y(北)
  const pathTiles = [];
  for (let y = ey - 2; y <= ey + 6; y++) pathTiles.push([ex, y]);
  pathTiles.push([ex - 1, ey + 6], [ex + 1, ey + 6], [ex - 1, ey + 7], [ex + 1, ey + 7]); // 小广场
  for (const [x, y] of pathTiles) if (world.in(x, y)) world.path[world.idx(x, y)] = PATH.TARMAC;
  world.entrancePath = pathTiles;

  return world;
}

function flattenRect(world, x0, y0, x1, y1, h) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (world.in(x, y)) { world.setBaseSlope(x, y, h, 0); world.surf[world.idx(x, y)] = SURF.GRASS; }
}

// 逐 tile 把四角高差压到 ≤1:抬升最低角,迭代至收敛
function relaxSlopes(grid, gw, gh) {
  for (let sweep = 0; sweep < 60; sweep++) {
    let changed = false;
    for (let y = 0; y < gh - 1; y++) {
      for (let x = 0; x < gw - 1; x++) {
        const ids = [y * gw + x, y * gw + x + 1, (y + 1) * gw + x + 1, (y + 1) * gw + x];
        let mn = Infinity, mx = -Infinity;
        for (const id of ids) { mn = Math.min(mn, grid[id]); mx = Math.max(mx, grid[id]); }
        if (mx - mn > 1) {
          for (const id of ids) if (grid[id] === mn && grid[id] < MAX_H) grid[id]++;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}
