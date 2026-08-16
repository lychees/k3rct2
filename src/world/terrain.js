// 分块地形渲染:每 CHUNK×CHUNK tile 一个 Mesh;RCT2 式角点坡面 + 错层悬崖 + 水面 + 边界栅栏 + 入口门。
import * as THREE from 'three';
import { MAP_W, MAP_H, TILE, CHUNK, WATER_H, H_UNIT, SURF, COL, MIN_H as MIN_H_DEFAULT } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { makeTerrainAtlas, makeWaterTexture, ATLAS_UV } from '../render/sprites.js';
import { World } from './world.js';

const SURF_UV = [ATLAS_UV.grass, ATLAS_UV.dirt, ATLAS_UV.sand, ATLAS_UV.rock];

// 确定性亮度抖动 + RCT 标志性棋盘格
function jitter(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const noise = 0.97 + (s - Math.floor(s)) * 0.06;
  return noise * ((x + y) % 2 === 0 ? 1.06 : 0.94);
}

export class Terrain {
  constructor(world, scene) {
    this.world = world;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.chunks = new Map();       // key -> {land, water}
    this.atlas = makeTerrainAtlas();
    this.waterTex = makeWaterTexture();
    this.waterTex.repeat.set(MAP_W / 8, MAP_H / 8);
    this.landMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: this.waterTex, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
      color: new THREE.Color(0.9, 1.0, 1.2),
    });
    // 悬崖侧面独立材质:不叠贴图(顶点色×贴图会双重变暗),纯色出 RCT 式挡土墙
    this.cliffMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.staticMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.buildAll();
    world.on('terrain', (x0, y0, x1, y1) => this.rebuild(x0, y0, x1, y1));
  }

  key(cx, cy) { return cx + ',' + cy; }

  buildAll() {
    const ncx = Math.ceil(MAP_W / CHUNK), ncy = Math.ceil(MAP_H / CHUNK);
    for (let cy = 0; cy < ncy; cy++) for (let cx = 0; cx < ncx; cx++) this.buildChunk(cx, cy);
    this.buildFences();
    this.buildEntrance();
  }

  rebuild(x0, y0, x1, y1) {
    // 含边界的邻边跨块刷新:向外扩 1 格
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
    x1 = Math.min(MAP_W - 1, x1 + 1); y1 = Math.min(MAP_H - 1, y1 + 1);
    const seen = new Set();
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      seen.add(this.key(Math.floor(x / CHUNK), Math.floor(y / CHUNK)));
    }
    for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++)
      for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++)
        seen.add(this.key(cx, cy));
    for (const k of seen) { const [cx, cy] = k.split(',').map(Number); this.buildChunk(cx, cy); }
  }

  buildChunk(cx, cy) {
    const k = this.key(cx, cy);
    const old = this.chunks.get(k);
    if (old) {
      for (const m of [old.land, old.water, old.side]) if (m) { this.group.remove(m); m.geometry.dispose(); }
    }
    const lb = new GeomBuilder(), wb = new GeomBuilder(), sb = new GeomBuilder();
    const xEnd = Math.min(MAP_W, (cx + 1) * CHUNK), yEnd = Math.min(MAP_H, (cy + 1) * CHUNK);
    for (let y = cy * CHUNK; y < yEnd; y++) {
      for (let x = cx * CHUNK; x < xEnd; x++) {
        this.buildTile(lb, wb, sb, x, y);
      }
    }
    const rec = { land: null, water: null, side: null };
    if (!lb.empty) {
      rec.land = new THREE.Mesh(lb.build(), this.landMat);
      this.group.add(rec.land);
    }
    if (!sb.empty) {
      rec.side = new THREE.Mesh(sb.build(), this.cliffMat);
      this.group.add(rec.side);
    }
    if (!wb.empty) {
      rec.water = new THREE.Mesh(wb.build(), this.waterMat);
      rec.water.renderOrder = 2;
      this.group.add(rec.water);
    }
    this.chunks.set(k, rec);
  }

  buildTile(lb, wb, sb, x, y) {
    const w = this.world;
    const i = w.idx(x, y);
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    const h = w.corners(x, y);                       // 层级高度 [SW,SE,NE,NW]
    const yw = h.map(v => v * H_UNIT);               // 世界高度
    const surf = w.surf[i];
    const uvR = SURF_UV[surf] || SURF_UV[0];
    const shade = jitter(x, y);
    // 角点世界坐标
    const P = [
      [X, yw[0], Z], [X + TILE, yw[1], Z], [X + TILE, yw[2], Z + TILE], [X, yw[3], Z + TILE],
    ];
    if (w.path[i] === 0) {
      // 顶面(有路径时由 path slab 覆盖,跳过)
      const [u0, v0, u1, v1] = uvR;
      const sh = h.map((_, ci) => shade);
      if (w.slope[i] === 0) {
        lb.quad(P[0], P[3], P[2], P[1], [u0, v0, u1, v1], 0xffffff, sh);
      } else {
        const hy = (yw[0] + yw[1] + yw[2] + yw[3]) / 4;
        const M = [X + TILE / 2, hy, Z + TILE / 2];
        const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
        const cuv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        for (let c = 0; c < 4; c++) {
          const n = (c + 1) % 4;
          // 顶点序保证法线朝上(中心点在第二位)
          lb.tri(P[c], M, P[n], [cuv[c], [um, vm], cuv[n]], 0xffffff, shade);
        }
      }
    }
    // 水面
    if (Math.min(...h) < WATER_H) {
      const wy = WATER_H * H_UNIT + 0.02;
      wb.quad([X, wy, Z], [X, wy, Z + TILE], [X + TILE, wy, Z + TILE], [X + TILE, wy, Z],
        [x / 8, y / 8, (x + 1) / 8, (y + 1) / 8], 0xffffff, 1);
    }
    // 侧面(悬崖/挡土墙):4 条边与邻居比较
    const EDGE = [ // [我的两个角, 邻居的两个角(同端点对齐), 边方向]
      [[1, 2], [0, 3], 1, 0], [[2, 3], [1, 0], 0, 1], [[3, 0], [2, 1], -1, 0], [[0, 1], [3, 2], 0, -1],
    ];
    for (const [[a, b], [na, nb], dx, dy] of EDGE) {
      const nx = x + dx, ny = y + dy;
      let gA = MIN_H_DEFAULT, gB = MIN_H_DEFAULT;
      if (w.in(nx, ny)) {
        gA = w.corner(nx, ny, na); gB = w.corner(nx, ny, nb);
      } else {
        gA = 0; gB = 0; // 地图边缘全封闭
      }
      const topA = h[a], topB = h[b];
      const botA = Math.min(topA, gA), botB = Math.min(topB, gB);
      if (topA <= botA && topB <= botB) continue;
      const isRock = surf === SURF.ROCK || topA >= 13 || topB >= 13;
      const colr = isRock ? COL.cliffRock : COL.cliff;
      const depth = Math.max(topA - botA, topB - botB);
      const s = Math.max(0.62, 0.9 - depth * 0.05) * jitter(y, x);
      // 边的两端世界坐标(按 a→b 方向);独立 cliffMat,纯色直接出终态色
      const A = P[a], B = P[b];
      const pts = [
        [A[0], botA * H_UNIT, A[2]], [B[0], botB * H_UNIT, B[2]],
        [B[0], B[1], B[2]], [A[0], A[1], A[2]],
      ];
      // 保证三角面绕向朝外(否则 DoubleSide 会取反我们的法线 → 纯黑)
      const e0 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
      const e1 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
      const fnx = e0[1] * e1[2] - e0[2] * e1[1], fnz = e0[0] * e1[1] - e0[1] * e1[0];
      if (fnx * dx + fnz * dy < 0) pts.reverse();
      sb.quad(pts[0], pts[1], pts[2], pts[3], [0, 0], colr, [s * 0.85, s * 0.85, s, s], [dx, 0.45, dy]);
    }
  }

  // 公园边界栅栏(静态,只建一次)
  buildFences() {
    const w = this.world;
    const b = new GeomBuilder();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!w.ownedAt(x, y)) continue;
        for (let d = 0; d < 4; d++) {
          const [nx, ny] = w.neighbor(x, y, d);
          if (w.ownedAt(nx, ny)) continue;
          this.buildFenceEdge(b, x, y, d);
        }
      }
    }
    // 入口缺口:擦掉南侧正中的栅栏段由 buildFenceEdge 里的 entrance 判断处理
    if (!b.empty) {
      const m = new THREE.Mesh(b.build(), this.staticMat);
      this.group.add(m);
    }
  }

  buildFenceEdge(b, x, y, d) {
    const w = this.world;
    // 入口处留门(南侧边)
    if (w.entrance && w.entrance.dir === 1 && d === 3 &&
        x === w.entrance.x && y === w.entrance.y) return;
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    // 边的两个端点(世界坐标 + 贴地高度用两角点)
    let c0, c1;
    if (d === 0) { c0 = w.cornerWorld(x, y, 1); c1 = w.cornerWorld(x, y, 2); }
    else if (d === 1) { c0 = w.cornerWorld(x, y, 2); c1 = w.cornerWorld(x, y, 3); }
    else if (d === 2) { c0 = w.cornerWorld(x, y, 3); c1 = w.cornerWorld(x, y, 0); }
    else { c0 = w.cornerWorld(x, y, 0); c1 = w.cornerWorld(x, y, 1); }
    const gy = (c0.y + c1.y) / 2;
    const mx = (c0.x + c1.x) / 2, mz = (c0.z + c1.z) / 2;
    const len = Math.hypot(c1.x - c0.x, c1.z - c0.z);
    const horiz = Math.abs(c1.x - c0.x) > Math.abs(c1.z - c0.z);
    const hgt = 0.62;
    // 两根横杆
    for (const ry of [0.3, 0.52]) {
      b.box(mx, gy + ry, mz, horiz ? len : 0.07, 0.055, horiz ? 0.07 : len, COL.fence, 1);
    }
    // 端点柱 + 中柱
    for (const t of [0, 0.5, 1]) {
      const px = c0.x + (c1.x - c0.x) * t, pz = c0.z + (c1.z - c0.z) * t;
      b.box(px, gy + hgt / 2, pz, 0.1, hgt, 0.1, COL.fence, 0.92);
    }
  }

  // 入口大门 + 售票亭(静态装饰)
  buildEntrance() {
    const w = this.world;
    if (!w.entrance) return;
    const { x, y } = w.entrance;
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    const g0 = Math.min(w.corner(x, y, 0), w.corner(x, y, 1)) * H_UNIT;
    const b = new GeomBuilder();
    const brick = 0xb0483a, gold = 0xe8b830, teal = 0x2f8a7a;
    // 两侧砖柱(门的南北向与入口 dir=1:门在 tile 的南边)
    const zGate = Z; // 南边缘
    b.box(X + 0.15, g0 + 1.5, zGate + 0.1, 0.5, 3.0, 0.5, brick, 1);
    b.box(X + TILE - 0.15, g0 + 1.5, zGate + 0.1, 0.5, 3.0, 0.5, brick, 1);
    b.box(X + 0.15, g0 + 3.15, zGate + 0.1, 0.62, 0.3, 0.62, gold, 1);
    b.box(X + TILE - 0.15, g0 + 3.15, zGate + 0.1, 0.62, 0.3, 0.62, gold, 1);
    // 门楣横匾
    b.box(X + TILE / 2, g0 + 3.0, zGate + 0.1, TILE + 0.5, 0.55, 0.35, teal, 1);
    b.box(X + TILE / 2, g0 + 3.0, zGate + 0.1, TILE + 0.62, 0.16, 0.45, gold, 1);
    // 售票亭(东侧一格)
    const bx = X + TILE * 1.6, bz = Z - TILE * 0.6;
    const bg = g0;
    b.box(bx, bg + 0.9, bz, 1.5, 1.8, 1.4, 0xd8d0b8, 1);
    b.box(bx, bg + 1.15, bz + 0.71, 0.9, 0.5, 0.06, 0x30404f, 1); // 窗口
    b.box(bx, bg + 2.0, bz, 1.8, 0.35, 1.7, 0xa03028, 1);          // 屋顶
    b.box(bx, bg + 2.25, bz, 0.9, 0.18, 0.8, gold, 1);
    const m = new THREE.Mesh(b.build(), this.staticMat);
    this.group.add(m);
  }
}

