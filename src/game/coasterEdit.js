// 轨道类设施编辑器:逐段铺设轨道件(站台/平直/提升坡/上下坡/左右弯/刹车),闭环验收后运行。
// 三种风格(TRACK_STYLES):过山车(重力物理)、观光小火车(匀速巡游)、激流勇进(水槽+提升坡+俯冲)。
// 轨道直接按件采样成折线(不经过样条),lift/刹车/站台区域与件一一对应,物理边界精确。
import * as THREE from 'three';
import { TILE, H_UNIT, COL, WATER_H } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';

// 轨道件定义;dir 约定与世界一致:0=+x(E) 1=+y(N) 2=-x(W) 3=-y(S)
export const COASTER_PIECES = [
  { id: 'station', name: '站台', cost: 300 },
  { id: 'flat', name: '平直轨', cost: 130 },
  { id: 'lift', name: '提升坡', cost: 280, dH: 1, lift: true },
  { id: 'down', name: '下坡', cost: 150, dH: -1 },
  { id: 'up', name: '上坡', cost: 150, dH: 1 },
  { id: 'left', name: '左弯', cost: 190, turn: 1 },
  { id: 'right', name: '右弯', cost: 190, turn: -1 },
  { id: 'brake', name: '刹车段', cost: 170 },
];
export const PIECE_BY_ID = Object.fromEntries(COASTER_PIECES.map(p => [p.id, p]));
export const MAX_LEVEL = 14;      // 轨道相对站台的最高层级
export const MAX_PIECES = 140;    // 单条轨道段数上限

// 风格参数:件集、轨道配色、车厢、物理档案
export const TRACK_STYLES = {
  coaster: {   // 木制过山车:重力势能物理
    pieces: ['flat', 'lift', 'down', 'up', 'left', 'right', 'brake'],
    kind: 'rails', railCol: COL.railTrack, spineCol: COL.woodDark, tieCol: COL.wood, supportCol: COL.wood,
    canopyCol: 0x4273b8,
    cars: 4, perCar: 2, carGap: 1.25, carBody: 'coaster',
    physics: 'gravity', liftV: 2.0, minV: 1.2, gravityScale: 0.95, screamV: 5,
    stationCost: 300,
  },
  train: {     // 观光小火车:匀速巡航(只允许平轨与弯道)
    pieces: ['flat', 'left', 'right'],
    kind: 'rails', railCol: 0x4a4a52, spineCol: 0, tieCol: 0x5a4632, supportCol: 0x5a4632,
    canopyCol: 0x48b050,
    cars: 4, perCar: 2, carGap: 1.45, carBody: 'train',
    physics: 'cruise', cruiseV: 2.6, screamV: 1e9,
    stationCost: 300,
  },
  flume: {     // 激流勇进:水槽漂流,提升坡 + 俯冲
    pieces: ['flat', 'lift', 'down', 'left', 'right'],
    kind: 'channel', wallCol: 0xb8b0a0, waterCol: 0x3a78c8, supportCol: 0xb8b0a0,
    canopyCol: 0x3aa8a0,
    cars: 2, perCar: 4, carGap: 3.4, carBody: 'boat',
    physics: 'flume', liftV: 1.6, minV: 1.0, gravityScale: 0.85, screamV: 4,
    stationCost: 350,
  },
};

export function outDirOf(pc) {
  const turn = PIECE_BY_ID[pc.t].turn || 0;
  return (pc.dir + turn + 4) % 4;
}
export function exitOf(pc) {   // 件的出口(下一件的入口):tile/方向/高度
  const d = outDirOf(pc);
  return { x: pc.x + World.DX[d], y: pc.y + World.DY[d], dir: d, h: pc.h + (PIECE_BY_ID[pc.t].dH || 0) };
}
export function canFinish(ride) {
  if (!ride.pieces || ride.pieces.length < 5) return false;   // 至少 5 段才算一圈
  const f = ride.pieces[0];
  const e = exitOf(ride.pieces[ride.pieces.length - 1]);
  return e.x === f.x && e.y === f.y && e.dir === f.dir && e.h === f.h;
}

// 把轨道件采样成折线点列(世界坐标)。返回 {pts:[Vector3], meta:[str|0]}
// meta: 'station' | 'lift' | 'brake' | 0;闭环时末点与首点重合(由 canFinish 保证)
export function sampleTrack(ride, w) {
  const pts = [], meta = [];
  const push = (x, y, z, m) => {
    const n = pts.length;
    if (n) {  // 与上一点重合则跳过(件间共享端点)
      const q = pts[n - 1];
      if (Math.abs(q.x - x) < 1e-6 && Math.abs(q.z - z) < 1e-6 && Math.abs(q.y - y) < 1e-6) return;
    }
    pts.push(new THREE.Vector3(x, y, z));
    meta.push(m);
  };
  for (const pc of ride.pieces) {
    const def = PIECE_BY_ID[pc.t];
    const m = pc.t === 'station' ? 'station' : def.lift ? 'lift' : def.brake ? 'brake' : 0;
    const c = w.tileCenter(pc.x, pc.y);
    const y0 = ride.baseY + pc.h * H_UNIT;
    const y1 = ride.baseY + (pc.h + (def.dH || 0)) * H_UNIT;
    const dx = World.DX[pc.dir], dy = World.DY[pc.dir];
    // 入口边中点(朝向反方向退半格)
    const ex = c.x - dx * TILE / 2, ez = c.z - dy * TILE / 2;
    if (!def.turn) {
      for (let k = 0; k <= 2; k++) {
        const t = k / 2;
        push(ex + dx * TILE * t, y0 + (y1 - y0) * t, ez + dy * TILE * t, m);
      }
    } else {
      const dOut = outDirOf(pc);
      const ox = World.DX[dOut], oy = World.DY[dOut];
      // 出口边中点
      const fx = c.x + ox * TILE / 2, fz = c.z + oy * TILE / 2;
      // 圆心 = 入口边与出口边共享的那个角点
      const ccx = c.x - dx * TILE / 2 + ox * TILE / 2;
      const ccz = c.z - dy * TILE / 2 + oy * TILE / 2;
      const a0 = Math.atan2(ez - ccz, ex - ccx);
      const a1 = Math.atan2(fz - ccz, fx - ccx);
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      for (let k = 0; k <= 4; k++) {
        const a = a0 + sweep * (k / 4);
        push(ccx + Math.cos(a) * TILE / 2, y0, ccz + Math.sin(a) * TILE / 2, m);
      }
    }
  }
  return { pts, meta };
}

// 车厢/船外观
function buildCarBody(style, i, mat) {
  const car = new THREE.Group();
  if (style.carBody === 'train') {
    const bodyCol = i === 0 ? 0x2a5a3a : 0x3a7a4a;   // 首节机车深绿
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 1.25),
      new THREE.MeshLambertMaterial({ color: bodyCol }));
    body.position.y = 0.42;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 1.35),
      new THREE.MeshLambertMaterial({ color: 0x303038 }));
    roof.position.y = 0.75;
    car.add(body, roof);
    if (i === 0) {
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18),
        new THREE.MeshLambertMaterial({ color: 0x222228 }));
      chim.position.set(0, 0.85, 0.45);
      car.add(chim);
    }
  } else if (style.carBody === 'boat') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.36, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x8a5a30 }));
    body.position.y = 0.24;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 1.78),
      new THREE.MeshLambertMaterial({ color: 0x6d4522 }));
    rim.position.y = 0.44;
    car.add(body, rim);
  } else {
    const carCols = [0xd84a3a, 0xe8b830, 0x3a7ad8, 0x48b050];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 1.1),
      new THREE.MeshLambertMaterial({ color: carCols[i % 4] }));
    body.position.y = 0.32;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222228 }));
    nose.position.set(0, 0.2, 0.62);
    car.add(body, nose);
  }
  car.visible = false;               // 闭环建成后才出场
  return car;
}

// 由轨道件构建网格 + 列车物理(接口与 coaster.js 的预制版一致)
export function buildCustomCoaster(game, ride) {
  const w = game.world;
  const style = TRACK_STYLES[ride.def.style || 'coaster'];
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  let trackMesh = null;
  const cars = [];
  for (let i = 0; i < style.cars; i++) {
    const car = buildCarBody(style, i, mat);
    group.add(car);
    cars.push(car);
  }

  const state = { s: 0, v: 0, mode: 'load', timer: 0 };
  let external = null;
  let S = null;   // 采样缓存:{pts, meta, segLen[], total, station:[i0,i1], hMax}

  function rebuild() {
    if (trackMesh) { group.remove(trackMesh); trackMesh.geometry.dispose(); }
    const { pts, meta } = sampleTrack(ride, w);
    const closed = ride.complete && pts.length > 8;
    const M = pts.length;
    const b = new GeomBuilder();
    const N2 = closed ? M : M - 1;   // 闭环时最后点绕回起点
    const at = i => pts[((i % M) + M) % M];
    for (let i = 0; i < N2; i++) {
      const p = at(i), q = at(i + 1);
      const tx = q.x - p.x, tz = q.z - p.z;
      const tl = Math.hypot(tx, tz) || 1;
      const ox = -tz / tl, oz = tx / tl;   // 单位侧向
      if (style.kind === 'channel') {
        // 水槽:两侧壁 + 水面
        b.bar([p.x - ox * 0.5, p.y + 0.18, p.z - oz * 0.5], [q.x - ox * 0.5, q.y + 0.18, q.z - oz * 0.5], 0.1, 0.36, style.wallCol, 1);
        b.bar([p.x + ox * 0.5, p.y + 0.18, p.z + oz * 0.5], [q.x + ox * 0.5, q.y + 0.18, q.z + oz * 0.5], 0.1, 0.36, style.wallCol, 1);
        b.bar([p.x, p.y + 0.06, p.z], [q.x, q.y + 0.06, q.z], 0.86, 0.06, style.waterCol, 0.95);
      } else {
        // 双钢轨(+ 过山车中央木脊梁)
        b.bar([p.x - ox * 0.34, p.y + 0.1, p.z - oz * 0.34], [q.x - ox * 0.34, q.y + 0.1, q.z - oz * 0.34], 0.09, 0.09, style.railCol, 1);
        b.bar([p.x + ox * 0.34, p.y + 0.1, p.z + oz * 0.34], [q.x + ox * 0.34, q.y + 0.1, q.z + oz * 0.34], 0.09, 0.09, style.railCol, 1);
        if (style.spineCol) b.bar([p.x, p.y - 0.2, p.z], [q.x, p.y - 0.2, q.z], 0.34, 0.2, style.spineCol, 1);
        if (meta[i] === 'lift') b.bar([p.x, p.y + 0.02, p.z], [q.x, q.y + 0.02, q.z], 0.07, 0.05, 0x3a3a3a, 1);
        if (meta[i] === 'brake') b.bar([p.x, p.y + 0.05, p.z], [q.x, q.y + 0.05, q.z], 0.16, 0.08, 0x8a8d8f, 1);
      }
    }
    // 枕木 + 支架
    for (let i = 0; i < N2; i += 2) {
      const p = at(i), q = at(i + 1);
      const tx = q.x - p.x, tz = q.z - p.z;
      const tl = Math.hypot(tx, tz) || 1;
      const ox = -tz / tl, oz = tx / tl;
      if (style.tieCol) {
        b.bar([p.x - ox * 0.55, p.y - 0.02, p.z - oz * 0.55], [p.x + ox * 0.55, p.y - 0.02, p.z + oz * 0.55], 0.14, 0.07, style.tieCol, 1);
      }
      if (i % 6 === 0) {
        const gtx = World.worldToTileX(p.x), gty = World.worldToTileY(p.z);
        if (w.in(gtx, gty)) {
          const ground = w.surfaceY(gtx, gty);
          const hgt = p.y - 0.28 - ground;
          if (hgt > 0.3) {
            if (hgt > 1.6) {
              b.post(p.x - 0.5, ground, p.z, 0.09, hgt, style.supportCol, 1);
              b.post(p.x + 0.5, ground, p.z, 0.09, hgt, style.supportCol, 1);
              b.bar([p.x - 0.58, ground + hgt - 0.15, p.z], [p.x + 0.58, ground + hgt - 0.15, p.z], 0.12, 0.1, style.supportCol, 0.95);
            } else {
              b.post(p.x, ground, p.z, 0.1, hgt, style.supportCol, 1);
            }
          }
        }
      }
    }
    // 站台:铺面 + 雨棚(每个站台件一段)
    for (const pc of ride.pieces) {
      if (pc.t !== 'station') continue;
      const c = w.tileCenter(pc.x, pc.y);
      const py = ride.baseY + pc.h * H_UNIT;
      b.box(c.x, py - 0.04, c.z, TILE * 0.96, 0.12, TILE * 0.96, 0xb0a890, 1);
      const dx = World.DX[pc.dir], dy = World.DY[pc.dir];
      const sx = -dy, sz = dx;   // 站台侧面
      b.post(c.x + sx * 0.8, py, c.z + sz * 0.8, 0.08, 1.7, style.supportCol, 1);
      b.box(c.x + sx * 0.7, py + 1.85, c.z + sz * 0.7, Math.abs(dx) * TILE * 0.9 + 0.6, 0.12, Math.abs(dy) * TILE * 0.9 + 0.6, style.canopyCol, 1);
    }
    trackMesh = new THREE.Mesh(b.build(), mat);
    group.add(trackMesh);

    // 物理缓存
    if (closed) {
      const segLen = [];
      let total = 0, hMax = -1e9;
      let st0 = -1, st1 = -1;
      for (let i = 0; i < M; i++) {
        const d = at(i + 1).distanceTo(at(i));
        segLen.push(d);
        total += d;
        hMax = Math.max(hMax, pts[i].y);
        if (meta[i] === 'station') { if (st0 < 0) st0 = i; st1 = i; }
      }
      S = { pts, meta, segLen, total, station: [st0, st1], hMax };
      for (const car of cars) car.visible = true;
    } else {
      S = null;
      for (const car of cars) car.visible = false;
    }
  }

  const G = 10.5;
  let lapArmed = false;

  function poseCar(car, sArc) {
    const M = S.pts.length;
    // 弧长 → 采样索引(步长近似均匀,直接换算)
    const avg = S.total / M;
    let i = ((Math.round(sArc / avg) % M) + M) % M;
    const p = S.pts[i], q = S.pts[(i + 1) % M];
    car.position.set(p.x, p.y + 0.18, p.z);
    const tx = q.x - p.x, ty = q.y - p.y, tz = q.z - p.z;
    const yaw = Math.atan2(tx, tz);
    const pitch = Math.atan2(-ty, Math.hypot(tx, tz));
    const p2 = S.pts[(i + 2) % M];
    const latAcc = ((q.x - p.x) * (p2.z - q.z) - (q.z - p.z) * (p2.x - q.x)) * state.v * state.v * 0.5;
    const roll = THREE.MathUtils.clamp(latAcc * 2.0, -0.5, 0.5);
    car.rotation.set(0, 0, 0);
    car.rotateY(yaw); car.rotateX(pitch); car.rotateZ(roll);
  }

  function trainUpdate(dt) {
    if (!S) return;   // 未闭环:静止
    if (external) {
      state.s = external.s; state.mode = external.mode;
    } else if (state.mode === 'load') {
      state.timer -= dt;
      if (state.timer <= 0 && (ride.status === 'open' || ride.status === 'test')) {
        if (ride.riders.length > 0 || ride.status === 'test') { state.mode = 'run'; state.v = 1.6; lapArmed = false; }
        else state.timer = 0.5;
      }
    } else {
      const M = S.pts.length;
      const i = ((Math.floor(state.s) % M) + M) % M;
      const m = S.meta[i];
      const y = S.pts[i].y;
      if (style.physics === 'cruise') {
        state.v += (style.cruiseV - state.v) * Math.min(1, dt * 3);
      } else {
        if (m === 'lift') {
          state.v = style.liftV;
          const now = game.time || 0;   // 链条咔嗒声
          if (game.audio && now - (ride._clackAt ?? -9) > 0.38) { ride._clackAt = now; game.audio.play('clack'); }
        }
        else if (m === 'brake') state.v += (1.6 - state.v) * Math.min(1, dt * 3);
        else if (m === 'station') state.v = Math.max(state.v, 1.5);   // 站台链条推进
        else {
          const target = Math.max(style.minV, Math.sqrt(Math.max(0, 2 * G * (S.hMax - y))) * style.gravityScale);
          state.v += (target - state.v) * Math.min(1, dt * 2.2);
        }
      }
      // 推进(采样索引 → 弧长)
      state.s += state.v * dt / (S.segLen[i] || 0.3);
      // 俯冲尖叫:高速 + 前方明显下降(节流 4s)
      if (game.audio && state.v > style.screamV) {
        const i2 = ((Math.floor(state.s) % M) + M) % M;
        const now = game.time || 0;
        if (S.pts[(i2 + 3) % M].y - S.pts[i2].y < -0.4 && now - (ride._screamAt ?? -9) > 4) {
          ride._screamAt = now;
          game.audio.play('scream');
          game.audio.play('rumble');
        }
      }
      const sMod = ((state.s % M) + M) % M;
      const [st0, st1] = S.station;
      if (st0 >= 0) {
        if (!lapArmed && sMod > st1 + 2) lapArmed = true;          // 已驶离站台区
        if (lapArmed && sMod >= st0 && sMod <= st1) {              // 回到站台 → 卸客
          state.s = st0;
          state.mode = 'load';
          state.timer = ride.status === 'open' ? 3.2 : 2.0;
          state.v = 0;
          game.rides.finishRide(ride);
        }
      }
    }
    const avg = S.total / S.pts.length;
    cars.forEach((car, ci) => {
      const sArc = state.s * avg - ci * style.carGap;
      poseCar(car, ((sArc % S.total) + S.total) % S.total);
    });
  }

  rebuild();

  return {
    group,
    update: (dt) => trainUpdate(dt),
    rebuild,                       // 加段/撤销后重建
    state,
    setExternal: (s, mode) => { external = { s, mode }; },
    serialize: () => ({ s: state.s, mode: state.mode }),
    restore: (d) => { if (d) { state.s = d.s || 0; state.mode = d.mode || 'load'; } },
    // 游客落点:每节车厢/船 perCar 人(绝对世界坐标)
    riderPos(i, out) {
      const car = cars[Math.min(style.cars - 1, (i / style.perCar) | 0)];
      const k = i % style.perCar;
      out.x = car.position.x + (k & 1 ? 0.16 : -0.16);
      out.y = car.position.y + 0.42;
      out.z = car.position.z + (k > 1 ? 0.3 : 0);
    },
  };
}

// 幽灵预览:当前段列表 + 候选下一段的线框(编辑器用)
export function customGhostGeometry(game, ride, candType) {
  const w = game.world;
  const { pts } = sampleTrack(ride, w);
  const b = new GeomBuilder();
  const push = (p, q) => b.bar([p.x, p.y, p.z], [q.x, q.y, q.z], 0.5, 0.12, 0xffffff, 1);
  for (let i = 0; i < pts.length - 1; i++) push(pts[i], pts[i + 1]);
  if (candType && ride.pieces.length) {
    const e = exitOf(ride.pieces[ride.pieces.length - 1]);
    const cand = { t: candType, x: e.x, y: e.y, h: e.h, dir: e.dir };
    const sub = { pieces: [cand], baseY: ride.baseY, complete: false };
    const { pts: cp } = sampleTrack(sub, w);
    const tail = pts[pts.length - 1];
    if (cp.length) {
      b.bar([tail.x, tail.y, tail.z], [cp[0].x, cp[0].y, cp[0].z], 0.3, 0.1, 0xffe870, 1);
      for (let i = 0; i < cp.length - 1; i++) {
        b.bar([cp[i].x, cp[i].y, cp[i].z], [cp[i + 1].x, cp[i + 1].y, cp[i + 1].z], 0.3, 0.1, 0xffe870, 1);
      }
    }
  }
  return b.build();
}
