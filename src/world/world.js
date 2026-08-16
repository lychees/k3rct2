// 世界数据模型:100×100 tile,每 tile base 高度 + 4bit 坡面(RCT2 模型)。
// 纯数据,无渲染依赖;地形/路径/游客/存档全部围绕它。
import { MAP_W, MAP_H, TILE, H_UNIT, SURF, PATH, ADDON, slopeCornerH, MIN_H, MAX_H } from '../config.js';

export { MIN_H, MAX_H };

export class World {
  constructor() {
    const n = MAP_W * MAP_H;
    this.base = new Uint8Array(n);       // 高度层级(层级×H_UNIT = 世界高度)
    this.slope = new Uint8Array(n);      // 4bit:哪个角抬高 1 层级
    this.surf = new Uint8Array(n);       // SURF.*
    this.path = new Uint8Array(n);       // PATH.*
    this.addon = new Uint8Array(n);      // ADDON.*
    this.obj = new Uint8Array(n);        // 0 无 1 树 2 灌木 3 花 (游乐设施用 rideTile)
    this.objRef = new Int32Array(n).fill(-1);   // scenery instance id
    this.rideTile = new Int16Array(n).fill(-1); // 游乐设施 id
    this.owned = new Uint8Array(n);      // 公园范围内可建造

    this._listeners = {};
    this.entrance = null;                // {x,y,dir} 由 terraingen 设置
    this.entrancePath = [];              // 入口到园区的初始路径 tiles
  }

  on(ev, fn) { (this._listeners[ev] ??= []).push(fn); }
  emit(ev, ...a) { for (const fn of this._listeners[ev] ?? []) fn(...a); }

  idx(x, y) { return y * MAP_W + x; }
  in(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }

  corner(x, y, i) { const k = this.idx(x, y); return slopeCornerH(this.base[k], this.slope[k], i); }
  corners(x, y) { const k = this.idx(x, y); const b = this.base[k], s = this.slope[k];
    return [slopeCornerH(b, s, 0), slopeCornerH(b, s, 1), slopeCornerH(b, s, 2), slopeCornerH(b, s, 3)]; }
  minH(x, y) { const c = this.corners(x, y); return Math.min(...c); }
  maxH(x, y) { const c = this.corners(x, y); return Math.max(...c); }
  isFlat(x, y) { return this.slope[this.idx(x, y)] === 0; }

  // ---- 地形编辑(返回是否有改动) ----
  raiseTile(x, y, d) { // d=+1 抬升 / -1 压低,保持坡形
    if (!this.in(x, y)) return false;
    const k = this.idx(x, y);
    const nb = this.base[k] + d;
    if (nb > MAX_H || nb < MIN_H) return false;
    if (this.path[k] !== PATH.NONE || this.obj[k] !== 0 || this.rideTile[k] !== -1) return false;
    this.base[k] = nb;
    return true;
  }
  levelTile(x, y, h) { // 整平到指定高度
    if (!this.in(x, y)) return false;
    const k = this.idx(x, y);
    if (h > MAX_H || h < MIN_H) return false;
    if (this.path[k] !== PATH.NONE || this.obj[k] !== 0 || this.rideTile[k] !== -1) return false;
    if (this.base[k] === h && this.slope[k] === 0) return false;
    this.base[k] = h; this.slope[k] = 0;
    return true;
  }
  setBaseSlope(x, y, base, slope) {
    const k = this.idx(x, y);
    this.base[k] = base; this.slope[k] = slope;
  }

  // tile 上是否有玩家建造物(决定整地是否可行)
  isClear(x, y) {
    const k = this.idx(x, y);
    return this.path[k] === PATH.NONE && this.obj[k] === 0 && this.rideTile[k] === -1;
  }
  ownedAt(x, y) { return this.in(x, y) && this.owned[this.idx(x, y)] === 1; }

  // ---- 坐标变换 ----
  // 世界坐标原点:地图中心。tile (x,y) 占 [(x-W/2)*TILE, (x-W/2+1)*TILE] × [..]
  static tileToWorldX(x) { return (x - MAP_W / 2) * TILE; }
  static tileToWorldZ(y) { return (y - MAP_H / 2) * TILE; }
  static worldToTileX(wx) { return Math.floor(wx / TILE + MAP_W / 2); }
  static worldToTileY(wz) { return Math.floor(wz / TILE + MAP_H / 2); }
  static hToWorldY(h) { return h * H_UNIT; }
  tileCenter(x, y) {
    return { x: World.tileToWorldX(x) + TILE / 2, z: World.tileToWorldZ(y) + TILE / 2 };
  }
  // tile 表面中心的世界 Y(4 角平均)
  surfaceY(x, y) {
    const c = this.corners(x, y);
    return (c[0] + c[1] + c[2] + c[3]) / 4 * H_UNIT;
  }
  // 角点世界坐标(i:0 SW,1 SE,2 NE,3 NW;北=+z 方向是 tile y+1)
  cornerWorld(x, y, i) {
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    const px = (i === 1 || i === 2) ? X + TILE : X;
    const pz = (i === 2 || i === 3) ? Z + TILE : Z;
    return { x: px, y: this.corner(x, y, i) * H_UNIT, z: pz };
  }

  // 邻接(4 向):0=+x(E) 1=+y(N) 2=-x(W) 3=-y(S)
  static DX = [1, 0, -1, 0];
  static DY = [0, 1, 0, -1];
  neighbor(x, y, dir) { return [x + World.DX[dir], y + World.DY[dir]]; }
}
