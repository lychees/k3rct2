// 员工系统:清洁工/维修工/演艺人员。
// 配套系统:路径垃圾(含呕吐)、垃圾桶容量、设施可靠度/故障、范围振奋。
// 权威侧(单机/联机服务器)跑 AI;联机客户端走快照插值(setRemote)。
import { TILE, H_UNIT, PATH, MAP_W, MAP_H, PRICE } from '../config.js';
import { World } from '../world/world.js';
import { bfsPath } from './peeps.js';
import { PeepRenderer } from '../render/peepRenderer.js';
import { mulberry32 } from '../core/random.js';
import * as THREE from 'three';

const rand = mulberry32((Date.now() ^ 0x5f3759df) & 0x7fffffff || 7);
const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));

export const STAFF_ROLES = [
  { id: 'handyman', name: '清洁工', salary: 60, hire: 60, shirt: 0x3a6ad8, pants: 0x203050, desc: '清扫垃圾、清空垃圾桶、修理被破坏的设施' },
  { id: 'mechanic', name: '维修工', salary: 90, hire: 90, shirt: 0xd84030, pants: 0x402020, desc: '维修故障设施、定期检修提升可靠度' },
  { id: 'entertainer', name: '演艺人员', salary: 50, hire: 50, shirt: 0xb060d8, pants: 0x502870, desc: '让附近游客开心(队列里也会)' },
  { id: 'guard', name: '保安', salary: 70, hire: 70, shirt: 0x2a3a4a, pants: 0x1a2018, desc: '巡逻震慑,附近的游客不敢搞破坏' },
];
export const ROLE_BY_ID = Object.fromEntries(STAFF_ROLES.map(r => [r.id, r]));
const BIN_CAPACITY = 8;

export class Staff {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.list = [];
    this.nextId = 1;
    this.renderer = game.headless ? null : new PeepRenderer(game);
    const n = MAP_W * MAP_H;
    this.world.litter = new Uint8Array(n);     // 垃圾/呕吐物数量 0..3
    this.world.binFill = new Uint8Array(n);    // 垃圾桶当前量
    this.litterMesh = null;
    this._dirtyLitter = true;
    this._litterDelta = new Set();             // 联机广播增量
    this._binDelta = new Set();
    this._vandalDelta = new Set();             // 被破坏的长椅/路灯 tile 增量
    this._snapshotMap = new Map();             // 联机客户端插值记录
    // 路径被拆时清掉上面的垃圾
    this.game.world.on('path', () => this._gcLitter());
  }

  count() { return this.list.length; }
  countBy(role) { return this.list.filter(s => s.role === role).length; }

  // ---------- 雇用与解雇(actions 调用) ----------
  hire(role) {
    const def = ROLE_BY_ID[role];
    if (!def) return { ok: false, reason: '未知岗位' };
    if (this.list.length >= 30) return { ok: false, reason: '员工上限30人' };
    const w = this.game.world;
    const e = w.entrance;
    const s = {
      id: this.nextId++, role,
      x: 0, z: 0, tile: [e.x, e.y], prev: null, yaw: 0, walkT: rand() * 9,
      state: 'wander', targetTile: null, target: null, workT: 0,
      speed: 2.6,
      hidden: false, hasSouvenir: false,
      shirt: def.shirt, skin: 0xf0c8a0, pants: def.pants, balloonCol: 0, capCol: 0xf0f0e8,
    };
    const c = w.tileCenter(e.x, e.y);
    s.x = c.x; s.z = c.z;
    this.list.push(s);
    if (!this.game.headless) this.game.messages?.add(`雇用了${def.name}(月薪 $${def.salary})`);
    return { ok: true, cost: def.hire, staff: s };
  }
  fire(id) {
    const i = this.list.findIndex(s => s.id === id);
    if (i < 0) return { ok: false, reason: '' };
    this.list.splice(i, 1);
    return { ok: true, cost: 0 };
  }

  monthlyWages() {
    let sum = 0;
    for (const s of this.list) sum += ROLE_BY_ID[s.role].salary;
    return sum;
  }

  // ---------- 垃圾系统 ----------
  tileLitter(x, y) { return this.world.litter[this.world.idx(x, y)]; }
  litterTiles() {
    let c = 0;
    for (let i = 0; i < this.world.litter.length; i++) if (this.world.litter[i] > 0) c++;
    return c;
  }
  // 游客产垃圾/呕吐(peeps 调用)
  peepLitter(p, x, y) {
    const w = this.world;
    if (w.path[w.idx(x, y)] === PATH.NONE) return;
    // 呕吐:眩晕值高
    if (p.nausea > 0.7 && rand() < 0.05) { this._dropLitter(x, y, true); p.nausea = Math.max(0.2, p.nausea - 0.4); return; }
    // 普通垃圾:附近有垃圾桶则大概率进桶
    if (rand() < 0.006) {
      const bin = this._findBinNear(x, y);
      if (bin && this.world.binFill[bin] < BIN_CAPACITY && rand() < 0.8) {
        this.world.binFill[bin]++;
        this._binDelta.add(bin);
        return;
      }
      this._dropLitter(x, y, false);
    }
  }
  _findBinNear(x, y) {
    const w = this.world;
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = w.neighbor(x, y, d);
      if (w.in(nx, ny) && w.addon[w.idx(nx, ny)] === 3) return w.idx(nx, ny);  // ADDON.BIN
    }
    if (w.addon[w.idx(x, y)] === 3) return w.idx(x, y);
    return -1;
  }
  _dropLitter(x, y, isVomit) {
    const i = this.world.idx(x, y);
    if (this.world.litter[i] >= 3) return;
    this.world.litter[i]++;
    this._dirtyLitter = true;
    this._litterDelta.add(i);
  }
  _gcLitter() {
    const w = this.world;
    for (let i = 0; i < w.litter.length; i++) {
      if (w.litter[i] > 0 && w.path[i] === PATH.NONE) { w.litter[i] = 0; this._dirtyLitter = true; this._litterDelta.add(i); }
    }
  }

  // 愤怒游客捣毁长椅/路灯(保安震慑可阻止)
  tryVandalize(tile) {
    const w = this.world;
    for (const s of this.list) {
      if (s.role === 'guard' && Math.abs(s.tile[0] - tile[0]) + Math.abs(s.tile[1] - tile[1]) <= 6) return false;
    }
    const spots = [tile];
    for (let d = 0; d < 4; d++) spots.push([tile[0] + World.DX[d], tile[1] + World.DY[d]]);
    for (const [x, y] of spots) {
      if (!w.in(x, y)) continue;
      const i = w.idx(x, y);
      if (w.addon[i] === 1) { this._vandalize(i, 11); return true; }
      if (w.addon[i] === 2) { this._vandalize(i, 12); return true; }
    }
    return false;
  }
  _vandalize(i, code) {
    const w = this.world;
    w.addon[i] = code;
    this._vandalDelta.add(i);
    const x = i % MAP_W, y = Math.floor(i / MAP_W);
    w.emit('path', x, y, x, y);
    this.game.messages?.add?.('有游客破坏了公园设施!需要清洁工修理');
  }

  // ---------- 主更新 ----------
  update(dt) {
    const g = this.game;
    if (g.mp) { this._updateRemote(dt); return; }   // 联机客户端
    if (g.paused) { this._renderFrame(dt); return; }
    for (const s of this.list) this._updateStaff(s, dt);
    this._entertainerPulse(dt);
    this._renderFrame(dt);
  }

  _updateStaff(s, dt) {
    s.walkT += dt;
    if (s.state === 'work') {
      s.workT -= dt;
      if (s.workT <= 0) this._finishWork(s);
      return;
    }
    if (s.route) {
      this._routeWalk(s, dt);
      s._stuck = (s._stuck || 0) + dt;
      if (s._stuck > 15) { s.route = null; s.routeIdx = 0; s.target = null; s._stuck = 0; }
      return;
    }
    // 漫游 + 找任务
    s.thinkT = (s.thinkT || 0) - dt;
    if (s.thinkT <= 0) { s.thinkT = 0.8; this._seekJob(s); }
    this._wander(s, dt);
  }

  _routeWalk(s, dt) {
    if (s.routeIdx >= s.route.length) { this._arriveTarget(s); return; }
    const hop = s.route[s.routeIdx];
    this._stepToward(s, hop, dt, () => { s.routeIdx++; });
  }

  _seekJob(s) {
    const g = this.game;
    let job = null, dest = null;
    if (s.role === 'handyman') {
      job = this._findNearestDirty(s.tile);
      if (job) dest = job.tile;
    } else if (s.role === 'mechanic') {
      const ride = g.rides.list.find(r => r.broken) || this._findNeedInspection();
      if (ride) { job = { kind: 'ride', ride }; dest = ride.entrance.outer; }
    } else if (s.role === 'entertainer' || s.role === 'guard') {
      // 演艺/保安:随机巡逻即可(光环自动生效)
      return;
    }
    if (!job || !dest) return;
    if (s.area && (dest[0] < s.area[0] || dest[1] < s.area[1] || dest[0] > s.area[2] || dest[1] > s.area[3])) return;   // 区外任务不去
    const path = bfsPath(this.game.world, s.tile, dest);
    if (!path || path.length < 1) return;
    s.target = job;
    s.route = path.slice(1);   // 第一个是自身 tile
    s.routeIdx = 0;
    s._stuck = 0;
  }

  _findNearestDirty(fromTile) {
    // BFS 沿路径扩张找最近工作点
    const w = this.world;
    const start = fromTile;
    const seen = new Set([start[0] + start[1] * MAP_W]);
    const q = [start];
    let steps = 0;
    while (q.length && steps < 2200) {
      steps++;
      const [cx, cy] = q.shift();
      const i = cx + cy * MAP_W;
      if (w.litter[i] > 0) return { kind: 'litter', tile: [cx, cy] };
      if (w.binFill[i] >= BIN_CAPACITY) return { kind: 'bin', tile: [cx, cy] };
      if (w.addon[i] === 11 || w.addon[i] === 12) return { kind: 'fix', tile: [cx, cy] };
      for (let d = 0; d < 4; d++) {
        const nx = cx + World.DX[d], ny = cy + World.DY[d];
        if (!w.in(nx, ny)) continue;
        const k = nx + ny * MAP_W;
        if (seen.has(k) || w.path[w.idx(nx, ny)] === PATH.NONE) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return null;
  }
  _findNeedInspection() {
    let best = null, worstRel = 92;
    for (const r of this.game.rides.list) {
      if (r.def.kind === 'shop' || r.status === 'closed' || r.broken) continue;
      if (r.reliability < worstRel) { worstRel = r.reliability; best = r; }
    }
    return best;
  }

  // 走到目的格后进入作业态
  _arriveTarget(s) {
    const t = s.target;
    s.route = null; s.routeIdx = 0; s.target = null; s.targetTile = null;
    if (!t) return;
    if (t.kind === 'litter') {
      s.state = 'work'; s.workT = 1.2; s.workKind = t;
    } else if (t.kind === 'bin') {
      s.state = 'work'; s.workT = 2.0; s.workKind = t;
    } else if (t.kind === 'fix') {
      s.state = 'work'; s.workT = 2.6; s.workKind = t;
    } else if (t.kind === 'ride') {
      s.state = 'work';
      s.workT = t.ride.broken ? 9 : 4;
      s.workKind = t;
    }
  }

  _finishWork(s) {
    const g = this.game, w = this.world;
    s.state = 'wander';
    const t = s.workKind;
    s.workKind = null;
    if (!t) return;
    if (t.kind === 'litter') {
      const i = t.tile[0] + t.tile[1] * MAP_W;
      if (w.litter[i] > 0) { w.litter[i]--; this._dirtyLitter = true; s.workT = 1.2; this._litterDelta.add(i); if (w.litter[i] > 0) { s.state = 'work'; s.workKind = t; } }
    } else if (t.kind === 'bin') {
      w.binFill[t.tile[0] + t.tile[1] * MAP_W] = 0;
      this._binDelta.add(t.tile[0] + t.tile[1] * MAP_W);
    } else if (t.kind === 'fix') {
      const i = t.tile[0] + t.tile[1] * MAP_W;
      const cur = w.addon[i];
      if (cur === 11 || cur === 12) {
        w.addon[i] = cur === 11 ? 1 : 2;
        this._vandalDelta.add(i);
        w.emit('path', t.tile[0], t.tile[1], t.tile[0], t.tile[1]);
      }
    } else if (t.kind === 'ride') {
      const ride = t.ride;
      if (!g.rides.list.includes(ride)) return;
      if (ride.broken) {
        ride.broken = false;
        ride.reliability = Math.min(96, ride.reliability + 18);
        g.messages?.add(`「${ride.def.name}」已修好,恢复运营`, ride.id);
        g.economy?._emit?.('change');
      } else {
        ride.reliability = Math.min(98, ride.reliability + 10);
        ride.inspectedAt = Date.now();
      }
    }
  }

  _wander(s, dt) {
    const w = this.game.world;
    if (s.targetTile == null) {
      const [cx, cy] = s.tile;
      // 巡逻区:在区外先回区
      if (s.area && (cx < s.area[0] || cy < s.area[1] || cx > s.area[2] || cy > s.area[3])) {
        const home = [Math.min(Math.max(cx, s.area[0]), s.area[2]), Math.min(Math.max(cy, s.area[1]), s.area[3])];
        const path = bfsPath(w, s.tile, home);
        if (path && path.length > 1) { s.targetTile = path[1]; return; }
      }
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = w.neighbor(cx, cy, d);
        if (w.in(nx, ny) && w.path[w.idx(nx, ny)] !== PATH.NONE) {
          if (s.prev && nx === s.prev[0] && ny === s.prev[1]) continue;
          if (s.area && (nx < s.area[0] || ny < s.area[1] || nx > s.area[2] || ny > s.area[3])) continue;   // 巡逻区约束
          opts.push([nx, ny]);
        }
      }
      if (!opts.length) { if (s.prev) s.targetTile = s.prev; return; }
      s.targetTile = opts[rint(0, opts.length - 1)];
      s._roamingTile = s.targetTile;  // 漫游节点击穿标记
      s._roam = true;
    }
    this._stepToward(s, s.targetTile, dt, () => {
      s.targetTile = null;
      if (s._roam) { s._roam = false; }
    });
  }

  _stepToward(s, tile, dt, onArrive) {
    const w = this.game.world;
    const c = w.tileCenter(tile[0], tile[1]);
    const dx = c.x - s.x, dz = c.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.09) { s.prev = s.tile; s.tile = tile; onArrive(); return; }
    s.yaw = Math.atan2(dx / d, dz / d) + Math.PI;
    s.x += dx / d * s.speed * dt;
    s.z += dz / d * s.speed * dt;
  }

  // 演艺人员:0.5s 一次的半径振奋
  _entertainerPulse(dt) {
    this._pulseT = (this._pulseT || 0) + dt;
    if (this._pulseT < 0.5) return;
    this._pulseT = 0;
    const g = this.game;
    if (!g.peeps || !g.peeps.list) return;
    for (const s of this.list) {
      if (s.role !== 'entertainer') continue;
      for (const p of g.peeps.list) {
        if (p.hidden) continue;
        const dx = p.x - s.x, dz = p.z - s.z;
        if (dx * dx + dz * dz < 36) {
          p.happiness = Math.min(1, p.happiness + 0.018);
        }
      }
    }
  }

  // ---------- 联机快照接口 ----------
  snapshot() {
    return this.list.map(s => [s.id, STAFF_ROLES.findIndex(r => r.id === s.role), Math.round(s.x * 100), Math.round(s.z * 100), s.state === 'work' ? 1 : 0]);
  }
  applySnapshot(arr) {
    const seen = new Set();
    for (const [id, roleIdx, xi, zi, working] of arr) {
      seen.add(id);
      let r = this._snapshotMap.get(id);
      if (!r) {
        const def = STAFF_ROLES[roleIdx % STAFF_ROLES.length];
        r = {
          id, role: def.id, x: xi / 100, z: zi / 100, tx: xi / 100, tz: zi / 100,
          yaw: 0, walkT: rand() * 9, hidden: false, hasSouvenir: false,
          shirt: def.shirt, skin: 0xf0c8a0, pants: def.pants, balloonCol: 0, capCol: 0xf0f0e8,
          state: 'walk', tile: [0, 0], working: !!working,
        };
        this._snapshotMap.set(id, r);
      }
      r.tx = xi / 100; r.tz = zi / 100;
      r.working = !!working;
    }
    for (const id of [...this._snapshotMap.keys()]) if (!seen.has(id)) this._snapshotMap.delete(id);
  }
  _updateRemote(dt) {
    const w = this.game.world;
    this.list.length = 0;
    for (const r of this._snapshotMap.values()) {
      const dx = r.tx - r.x, dz = r.tz - r.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) { r.x = r.tx; r.z = r.tz; }
      else if (d > 0.005) {
        const k = Math.min(1, dt * 8);
        r.x += dx * k; r.z += dz * k;
        r.yaw = Math.atan2(dx, dz) + Math.PI;
      }
      r.walkT += dt * (d > 0.02 ? 1 : 0.2);
      r.state = 'walk';
      const tx = World.worldToTileX(r.x), ty = World.worldToTileY(r.z);
      if (w.in(tx, ty)) r.tile = [tx, ty];
      this.list.push(r);
    }
    this._renderFrame(dt);
  }

  // ---------- 渲染 ----------
  _renderFrame(dt) {
    if (this.renderer) this.renderer.render(this.list, dt);
    if (this._dirtyLitter) this._buildLitterMesh();
  }
  _buildLitterMesh() {
    this._dirtyLitter = false;
    if (this.litterMesh) { this.game.scene.remove(this.litterMesh); this.litterMesh.geometry.dispose(); this.litterMesh = null; }
    const w = this.world;
    const pos = [], col = [];
    const trashCols = [[0.85, 0.82, 0.75], [0.6, 0.55, 0.4], [0.75, 0.5, 0.3]];
    const pukeCol = [0.55, 0.62, 0.3];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = w.idx(x, y);
        const n = w.litter[i];
        if (!n) continue;
        const c = this.world.tileCenter(x, y);
        const gy = Math.max(...w.corners(x, y)) * H_UNIT + 0.05;
        for (let k = 0; k < n; k++) {
          const ox = Math.sin(i * 7.3 + k * 2.1) * 0.45, oz = Math.cos(i * 5.1 + k * 1.7) * 0.45;
          const s = 0.09 + ((i * 13 + k * 7) % 10) / 60;
          const cc = ((i + k * 3) % 5 === 0) ? pukeCol : trashCols[(i + k) % 3];
          // 一个小方块(6 面退化为上/前/侧 3 面即可)
          pushQuad(pos, col, c.x + ox, gy, c.z + oz, s, cc);
        }
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.litterMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.game.scene.add(this.litterMesh);
  }

  // 联机增量拉取(服务端 0.5s 调一次)
  drainDelta() {
    if (!this._litterDelta.size && !this._vandalDelta.size && !this._binDelta.size) return null;
    const ch = [...this._litterDelta].map(i => [i, this.world.litter[i]]);
    const bins = [...this._binDelta].map(i => [i, this.world.binFill[i]]);
    const vandal = [...this._vandalDelta].map(i => [i, this.world.addon[i]]);
    this._litterDelta.clear();
    this._binDelta.clear();
    this._vandalDelta.clear();
    return { ch, bins, vandal };
  }
  applyDelta(d) {
    const w = this.world;
    for (const [i, v] of d.ch || []) w.litter[i] = v;
    for (const [i, v] of d.bins || []) w.binFill[i] = v;
    if ((d.ch && d.ch.length) || (d.bins && d.bins.length)) this._dirtyLitter = true;
    for (const [i, v] of d.vandal || []) {
      w.addon[i] = v;
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      w.emit('path', x, y, x, y);
    }
  }

  // ---------- 存档 ----------
  serializeArea() {
    return {
      litter: encArr(this.world.litter), binFill: encArr(this.world.binFill),
      staff: this.list.map(s => ({ id: s.id, role: s.role, x: Math.round(s.x * 100), z: Math.round(s.z * 100), tile: s.tile, area: s.area || null })),
      nextId: this.nextId,
    };
  }
  restoreArea(d) {
    if (!d) return;
    const w = this.world;
    if (d.litter) decodeArr(d.litter, w.litter);
    if (d.binFill) decodeArr(d.binFill, w.binFill);
    this._dirtyLitter = true;
    for (const s of d.staff || []) {
      const def = ROLE_BY_ID[s.role];
      if (!def) continue;
      const c = w.tileCenter(s.tile[0], s.tile[1]);
      this.list.push({
        id: s.id, role: s.role, x: s.x / 100, z: s.z / 100, tile: s.tile, prev: null,
        yaw: 0, walkT: rand() * 9, state: 'wander', targetTile: null, target: null, workT: 0,
        speed: 2.6, hidden: false, hasSouvenir: false,
        shirt: def.shirt, skin: 0xf0c8a0, pants: def.pants, balloonCol: 0, capCol: 0xf0f0e8,
        area: s.area || null,
      });
      this.nextId = Math.max(this.nextId, s.id + 1);
    }
  }
}

// 小垃圾块四棱锥
function pushQuad(pos, col, x, y, z, s, c) {
  const top = [x, y + s, z];
  const base = [[x - s, y, z - s], [x + s, y, z - s], [x + s, y, z + s], [x - s, y, z + s]];
  for (let i = 0; i < 4; i++) {
    const a = base[i], b = base[(i + 1) % 4];
    pos.push(...top, ...b, ...a);
    for (let v = 0; v < 3; v++) col.push(...c);
  }
}
function encArr(a) {
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
}
function decodeArr(s, out) {
  const bin = atob(s);
  for (let i = 0; i < Math.min(bin.length, out.length); i++) out[i] = bin.charCodeAt(i);
}
