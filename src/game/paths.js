// 路径系统:主路(灰)/排队通道(蓝+栏杆),自动连接、附件(长椅/路灯/垃圾桶)。
// 视觉合并为每 chunk 一个 Mesh;逻辑只做数据校验,行走图由 peeps 直接读 world.path。
import * as THREE from 'three';
import { MAP_W, MAP_H, TILE, CHUNK, COL, PATH, ADDON, PRICE, WATER_H, H_UNIT } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';

export class Paths {
  constructor(world, scene) {
    this.world = world;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.chunks = new Map();
    this.buildAll();
    world.on('path', (x0, y0, x1, y1) => this.rebuild(x0, y0, x1, y1));
  }

  buildAll() {
    for (let cy = 0; cy < Math.ceil(MAP_H / CHUNK); cy++)
      for (let cx = 0; cx < Math.ceil(MAP_W / CHUNK); cx++) this.buildChunk(cx, cy);
  }
  rebuild(x0, y0, x1, y1) {
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
    x1 = Math.min(MAP_W - 1, x1 + 1); y1 = Math.min(MAP_H - 1, y1 + 1);
    const seen = new Set();
    for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++)
      for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++)
        seen.add(cx + ',' + cy);
    for (const k of seen) { const [cx, cy] = k.split(',').map(Number); this.buildChunk(cx, cy); }
  }

  buildChunk(cx, cy) {
    const k = cx + ',' + cy;
    const old = this.chunks.get(k);
    if (old) { this.group.remove(old); old.geometry.dispose(); this.chunks.delete(k); }
    const b = new GeomBuilder();
    const xEnd = Math.min(MAP_W, (cx + 1) * CHUNK), yEnd = Math.min(MAP_H, (cy + 1) * CHUNK);
    for (let y = cy * CHUNK; y < yEnd; y++)
      for (let x = cx * CHUNK; x < xEnd; x++)
        if (this.world.path[this.world.idx(x, y)] !== PATH.NONE) this.buildTile(b, x, y);
    if (b.empty) return;
    const m = new THREE.Mesh(b.build(), this.mat);
    this.group.add(m);
    this.chunks.set(k, m);
  }

  connections(x, y) { // 4 向是否有相邻路径(或骑乘出入口)
    const w = this.world, out = [false, false, false, false];
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = w.neighbor(x, y, d);
      if (w.in(nx, ny) && w.path[w.idx(nx, ny)] !== PATH.NONE) out[d] = true;
      else if (w.in(nx, ny) && w.rideTile[w.idx(nx, ny)] >= 0) out[d] = true; // 出入口归入
    }
    return out;
  }

  buildTile(b, x, y) {
    const w = this.world;
    const i = w.idx(x, y);
    const type = w.path[i];
    const conn = this.connections(x, y);
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    const gy = w.corners(x, y);
    const yTop = Math.max(...gy) * H_UNIT + 0.035;
    const isQueue = type === PATH.QUEUE;
    const slab = isQueue ? COL.queue : COL.tarmac;
    const edgeC = isQueue ? COL.queueEdge : COL.tarmacEdge;
    const m = 0.15;
    // 底:整格白边色(开放边保持可见;连通边会被主体色覆盖)
    baseQuad(b, X, Z, 0, TILE, yTop, edgeC, 0.95);
    // 主体
    baseQuad(b, X, Z, m, TILE - m, yTop + 0.008, slab, 1);
    // 连通边:用主体色延伸盖住白边
    for (let d = 0; d < 4; d++) {
      if (conn[d]) {
        const r = edgeBand(X, Z, d, m, yTop + 0.008);
        b.quad(r[0], r[1], r[2], r[3], [0, 0], slab, 0.99);
      } else if (isQueue) {
        this.buildRailing(b, X, Z, d, yTop);
      }
    }
    // 附件(仅主路)
    const addon = w.addon[i];
    if (addon !== ADDON.NONE) this.buildAddon(b, x, y, addon, conn, yTop);
  }

  buildRailing(b, X, Z, d, yTop) {
    // 沿边一排矮栏杆:顶杆 + 3 柱
    const inset = 0.09;
    let ax, az, bx, bz;
    if (d === 0) { ax = X + TILE - inset; az = Z; bx = X + TILE - inset; bz = Z + TILE; }
    else if (d === 1) { ax = X; az = Z + TILE - inset; bx = X + TILE; bz = Z + TILE - inset; }
    else if (d === 2) { ax = X + inset; az = Z + TILE; bx = X + inset; bz = Z; }
    else { ax = X; az = Z + inset; bx = X + TILE; bz = Z + inset; }
    b.box((ax + bx) / 2, yTop + 0.34, (az + bz) / 2,
      Math.max(0.05, Math.abs(bx - ax) + 0.05), 0.05, Math.max(0.05, Math.abs(bz - az) + 0.05), COL.rail, 1);
    for (const t of [0.12, 0.5, 0.88]) {
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      b.box(px, yTop + 0.17, pz, 0.06, 0.36, 0.06, COL.rail, 0.9);
    }
  }

  buildAddon(b, x, y, addon, conn, yTop) {
    // 选一条“开放边”放置附件,面朝路径
    const open = [0, 1, 2, 3].filter(d => !conn[d]);
    const d = open.length ? open[0] : 0;
    const w = this.world;
    const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
    const off = 0.42;
    let cx = X + TILE / 2, cz = Z + TILE / 2, rot = 0;
    if (d === 0) { cx = X + TILE - off; rot = Math.PI / 2; }
    else if (d === 1) { cz = Z + TILE - off; rot = 0; }
    else if (d === 2) { cx = X + off; rot = Math.PI / 2; }
    else { cz = Z + off; rot = 0; }
    if (addon === ADDON.BENCH) {
      // 长椅:坐板 + 靠背 + 两腿(rot 0 面向 +z)
      const c = 0x7a4a22;
      b.box(cx, yTop + 0.22, cz, rot ? 0.5 : 0.16, 0.05, rot ? 0.16 : 0.5, c, 1);
      b.box(cx + (rot ? -0.1 : 0), yTop + 0.36, cz + (rot ? 0 : -0.1), rot ? 0.5 : 0.05, 0.3, rot ? 0.05 : 0.5, c, 0.95);
      for (const t of [-0.15, 0.15]) {
        const lx = cx + (rot ? t : 0), lz = cz + (rot ? 0 : t);
        b.box(lx, yTop + 0.1, lz, 0.06, 0.2, 0.06, 0x333333, 1);
      }
    } else if (addon === ADDON.LAMP) {
      b.post(cx, yTop, cz, 0.05, 1.1, 0x2a2f38, 1);
      b.box(cx, yTop + 1.18, cz, 0.22, 0.22, 0.22, 0xfff2b8, 1.15);
      b.box(cx, yTop + 1.33, cz, 0.26, 0.06, 0.26, 0x2a2f38, 1);
    } else if (addon === ADDON.BIN) {
      b.box(cx, yTop + 0.2, cz, 0.3, 0.4, 0.3, 0x3a7a3a, 1);
      b.box(cx, yTop + 0.42, cz, 0.34, 0.05, 0.34, 0x2a5a2a, 1);
    } else if (addon === 11) {
      // 被砸的长椅:翻倒发黑
      const c = 0x3a322a;
      b.box(cx, yTop + 0.09, cz + (rot ? 0 : 0.12), rot ? 0.16 : 0.5, 0.14, rot ? 0.5 : 0.16, c, 0.85);
      b.box(cx + (rot ? 0.12 : 0), yTop + 0.05, cz, rot ? 0.5 : 0.05, 0.1, rot ? 0.05 : 0.5, c, 0.8);
    } else if (addon === 12) {
      // 被砸的路灯:歪倒的杆 + 落地的灯头
      b.post(cx + 0.12, yTop, cz, 0.05, 0.5, 0x2a2f38, 0.8);
      b.box(cx + 0.42, yTop + 0.58, cz, 0.22, 0.22, 0.22, 0x8a8348, 0.8);
      b.box(cx + 0.62, yTop + 0.46, cz, 0.18, 0.06, 0.18, 0x1a1f28, 0.8);
    }
  }

  // ---- 建造逻辑(被 tools 调用;返回 {ok, cost, reason}) ----
  canPlace(x, y, type) {
    const w = this.world;
    if (!w.ownedAt(x, y)) return { ok: false, reason: '不在公园范围内' };
    if (!w.isFlat(x, y)) return { ok: false, reason: '需要平整地面' };
    const i = w.idx(x, y);
    if (w.path[i] !== PATH.NONE) return { ok: false, reason: '已有路径' };
    if (w.obj[i] !== 0) return { ok: false, reason: '有景物' };
    if (w.rideTile[i] !== -1) return { ok: false, reason: '有游乐设施' };
    if (w.minH(x, y) < WATER_H) return { ok: false, reason: '水下不能铺路' };
    return { ok: true };
  }
  place(x, y, type) {
    const chk = this.canPlace(x, y, type);
    if (!chk.ok) return chk;
    const w = this.world;
    w.path[w.idx(x, y)] = type;
    w.emit('path', x, y, x, y);
    return { ok: true, cost: type === PATH.QUEUE ? PRICE.queue : PRICE.path };
  }
  canRemove(x, y) {
    const w = this.world;
    if (!w.in(x, y)) return { ok: false, reason: '' };
    if (w.path[w.idx(x, y)] === PATH.NONE) return { ok: false, reason: '没有路径' };
    // 初始入口路径允许拆(宽限)
    return { ok: true };
  }
  remove(x, y) {
    const chk = this.canRemove(x, y);
    if (!chk.ok) return chk;
    const w = this.world;
    w.path[w.idx(x, y)] = PATH.NONE;
    w.addon[w.idx(x, y)] = ADDON.NONE;
    w.emit('path', x, y, x, y);
    return { ok: true, cost: PRICE.removePath };
  }
  canPlaceAddon(x, y, addon) {
    const w = this.world, i = w.idx(x, y);
    if (w.path[i] !== PATH.TARMAC) return { ok: false, reason: '只能装在主路上' };
    if (w.addon[i] !== ADDON.NONE) return { ok: false, reason: '已有附件' };
    return { ok: true };
  }
  placeAddon(x, y, addon) {
    const chk = this.canPlaceAddon(x, y, addon);
    if (!chk.ok) return chk;
    const w = this.world;
    w.addon[w.idx(x, y)] = addon;
    w.emit('path', x, y, x, y);
    const cost = addon === ADDON.BENCH ? PRICE.bench : addon === ADDON.LAMP ? PRICE.lamp : PRICE.bin;
    return { ok: true, cost };
  }
}

export { PATH, ADDON };

// 水平条带 quad(法线朝上):铺满 [x0..x1]×[z0..z1] 于高度 y
function baseQuad(b, X, Z, o0, o1, y, color, shade) {
  b.quad(
    [X + o0, y, Z + o0], [X + o0, y, Z + o1], [X + o1, y, Z + o1], [X + o1, y, Z + o0],
    [0, 0], color, shade,
  );
}
// 边 d(0 E 1 N 2 W 3 S) 宽 w 的条带四点(y=0,调用方在 rails 里自行升高)
function edgeBand(X, Z, d, w, y = 0) {
  if (d === 0) return [[X + TILE - w, y, Z], [X + TILE - w, y, Z + TILE], [X + TILE, y, Z + TILE], [X + TILE, y, Z]];
  if (d === 1) return [[X, y, Z + TILE - w], [X, y, Z + TILE], [X + TILE, y, Z + TILE], [X + TILE, y, Z + TILE - w]];
  if (d === 2) return [[X, y, Z], [X, y, Z + TILE], [X + w, y, Z + TILE], [X + w, y, Z]];
  return [[X, y, Z], [X, y, Z + w], [X + TILE, y, Z + w], [X + TILE, y, Z]];
}
