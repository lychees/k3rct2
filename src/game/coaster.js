// 预制木制过山车:样条轨道、木支架、提升坡、列车按简化势能物理运行。
// 布局仿 RCT2 的 pre-designed 设施:固定足迹 18×11 tile,站台在南边缘。
import * as THREE from 'three';
import { TILE, H_UNIT, COL } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';

// 轨道关键点(相对足迹 anchor 的 tile 坐标,h 为相对站台的高度层级)
const WAYPOINTS = [
  [1, 1, 0], [3, 1, 0], [5, 1, 0.4],           // 站台(南排)→ 出站
  [8, 1, 1.2], [10, 1, 4], [12, 1, 7],          // 提升坡
  [13.2, 1.5, 7.6],                              // 顶点
  [14.8, 2.6, 4.2], [15.8, 4.2, 3],              // 俯冲+东转
  [16.2, 6, 2.6],
  [14.6, 8.6, 2.2],                              // 东北→西
  [11, 9.6, 3.4], [8, 9.6, 2.2],                 // 驼峰
  [5.6, 9.2, 2], [3.6, 7.6, 2.6], [2.4, 5, 2.6], // 西侧回旋
  [1.4, 3, 1.2],                                  // 回转
];

export function buildCoaster(game, ride) {
  const w = game.world;
  const ax = World.tileToWorldX(ride.x), az = World.tileToWorldZ(ride.y);
  const baseY = ride.baseY;
  const toWorld = ([tx, ty, h]) => new THREE.Vector3(ax + tx * TILE, baseY + h * H_UNIT, az + ty * TILE);
  const pts = WAYPOINTS.map(toWorld);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.12);
  const LEN = curve.getLength();

  const b = new GeomBuilder();
  const N = 420;
  const samples = [];
  for (let i = 0; i < N; i++) samples.push(curve.getPointAt(i / N));
  const up = new THREE.Vector3(0, 1, 0);
  // 轨道横断面:两条红轨 + 中央木脊梁 + 枕木
  const tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const p = samples[i], q = samples[(i + 1) % N];
    const tan = tmp.subVectors(q, p).normalize();
    const nx = -tan.z, nz = tan.x;
    const nl = Math.hypot(nx, nz) || 1;
    const ox = nx / nl * 0.34, oz = nz / nl * 0.34;
    // 左右钢轨
    b.bar([p.x - ox, p.y + 0.1, p.z - oz], [q.x - ox, q.y + 0.1, q.z - oz], 0.09, 0.09, COL.railTrack, 1);
    b.bar([p.x + ox, p.y + 0.1, p.z + oz], [q.x + ox, q.y + 0.1, q.z + oz], 0.09, 0.09, COL.railTrack, 1);
    // 木脊梁
    b.bar([p.x, p.y - 0.22, p.z], [q.x, q.y - 0.22, q.z], 0.34, 0.2, COL.woodDark, 1);
  }
  // 枕木 + 支架(每 ~1.3 单位)
  const stepT = 1.3 / LEN;
  for (let t = 0; t < 1; t += stepT) {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z, nz = tan.x;
    const nl = Math.hypot(nx, nz) || 1;
    const ox = nx / nl, oz = nz / nl;
    b.bar([p.x - ox * 0.55, p.y - 0.02, p.z - oz * 0.55], [p.x + ox * 0.55, p.y - 0.02, p.z + oz * 0.55],
      0.14, 0.07, COL.wood, 1);
  }
  // 支架:每 ~2.6 单位一根立柱到地面;高支架加侧撑
  const stepS = 2.6 / LEN;
  for (let t = 0; t < 1; t += stepS) {
    const p = curve.getPointAt(t);
    const tx = World.worldToTileX(p.x), ty = World.worldToTileY(p.z);
    if (!w.in(tx, ty)) continue;
    const ground = w.surfaceY(tx, ty);
    const hgt = p.y - 0.3 - ground;
    if (hgt < 0.3) continue;
    if (hgt > 1.6) {
      // A 形双柱 + 横梁
      b.post(p.x - 0.55, ground, p.z, 0.09, hgt, COL.wood, 1);
      b.post(p.x + 0.55, ground, p.z, 0.09, hgt, COL.wood, 1);
      b.bar([p.x - 0.62, ground + hgt - 0.15, p.z], [p.x + 0.62, ground + hgt - 0.15, p.z], 0.12, 0.1, COL.wood, 0.95);
      if (hgt > 2.8) {
        b.bar([p.x - 0.55, ground + hgt * 0.5, p.z], [p.x + 0.55, ground + hgt * 0.5, p.z], 0.1, 0.08, COL.wood, 0.9);
      }
    } else {
      b.post(p.x, ground, p.z, 0.1, hgt, COL.wood, 1);
    }
  }
  // 提升坡链条(t 范围约 0.06..0.16)
  for (let t = 0.05; t < 0.155; t += 0.006) {
    const p = curve.getPointAt(t), q = curve.getPointAt(t + 0.003);
    b.bar([p.x, p.y + 0.02, p.z], [q.x, q.y + 0.02, q.z], 0.07, 0.05, 0x3a3a3a, 1);
  }
  // 站台:南排 x 0.4..5.6 tile,地面高 baseY
  const platY = baseY + 0.02;
  b.box(ax + 3 * TILE, platY + 0.1, az + 1.0 * TILE, 5.6 * TILE - 1.2, 0.22, TILE * 0.9, 0xb0a890, 1);
  // 站台顶棚
  for (const px of [1, 2.6, 4.2, 5.4]) {
    b.post(ax + px * TILE, platY + 0.2, az + 0.75 * TILE, 0.08, 1.7, COL.wood, 1);
  }
  b.box(ax + 3 * TILE, platY + 2.0, az + 0.95 * TILE, 5.4 * TILE, 0.14, TILE * 1.1, 0x4273b8, 1);

  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const track = new THREE.Mesh(b.build(), mat);
  group.add(track);

  // 列车:4 节小车
  const cars = [];
  const carCols = [0xd84a3a, 0xe8b830, 0x3a7ad8, 0x48b050];
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 1.1),
      new THREE.MeshLambertMaterial({ color: carCols[i] }));
    body.position.y = 0.32;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222228 }));
    nose.position.set(0, 0.2, 0.62);
    car.add(body, nose);
    group.add(car);
    cars.push(car);
  }

  // ---- 列车物理状态 ----
  const state = { s: 0, v: 0, mode: 'load', timer: 0, running: false };
  let external = null;   // 联机客户端:由服务端快照驱动
  const CAR_GAP = 1.25;
  const S_LIFT_START = LEN * 0.045, S_LIFT_END = LEN * 0.16;
  const S_STATION = LEN * 0.005;   // 站台中点弧长
  const hTop = baseY + 7.6 * H_UNIT;
  const G = 10.5;

  function trainUpdate(dt) {
    if (external) {
      state.s = external.s; state.mode = external.mode;
    } else if (state.mode === 'load') {
      const riders = ride.riders.length;
      state.timer -= dt;
      if (state.timer <= 0 && (ride.status === 'open' || ride.status === 'test')) {
        if (riders > 0 || ride.status === 'test') { state.mode = 'run'; state.v = 1.6; }
        else state.timer = 0.5;
      }
    } else {
      const p = curve.getPointAt((state.s / LEN) % 1);
      const inLift = state.s > S_LIFT_START && state.s < S_LIFT_END;
      if (inLift) {
        state.v = 1.9;
        const now = game.time || 0;   // 链条咔嗒声
        if (game.audio && now - (ride._clackAt ?? -9) > 0.38) { ride._clackAt = now; game.audio.play('clack'); }
      } else {
        const target = Math.sqrt(Math.max(0, 2 * G * (hTop - p.y)));
        state.v += (Math.max(1.15, target) - state.v) * Math.min(1, dt * 5);
      }
      state.s += state.v * dt;
      // 俯冲尖叫:高速 + 前方明显下降(节流 4s)
      if (game.audio && state.v > 5) {
        const q2 = curve.getPointAt(((state.s + 2) / LEN) % 1);
        const now = game.time || 0;
        if (q2.y - p.y < -0.5 && now - (ride._screamAt ?? -9) > 4) {
          ride._screamAt = now;
          game.audio.play('scream');
          game.audio.play('rumble');
        }
      }
      const sMod = state.s % LEN;
      // 第一次越过站台中线 → 回站卸客
      if (state.s >= LEN + LEN * 0.011 && !state.lapDone) state.lapDone = true;
      if (state.lapDone && sMod >= LEN * 0.005 && sMod <= LEN * 0.03) {
        state.s = 0; state.lapDone = false;
        state.mode = 'load';
        state.timer = ride.status === 'open' ? 3.2 : 2.0;
        state.v = 0;
        game.rides.finishRide(ride);
      }
    }
    // 摆车
    cars.forEach((car, i) => {
      const t = (((state.s - i * CAR_GAP) / LEN) % 1 + 1) % 1;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      car.position.copy(p).y += 0.18;
      const yaw = Math.atan2(tan.x, tan.z);
      const pitch = Math.atan2(-tan.y, Math.hypot(tan.x, tan.z));
      // 简化离心倾斜
      const ahead = curve.getTangentAt((t + 0.006) % 1);
      const latAcc = (ahead.x * tan.z - ahead.z * tan.x) * state.v * state.v;
      const roll = THREE.MathUtils.clamp(latAcc * 2.2, -0.5, 0.5);
      car.rotation.set(0, 0, 0);
      car.rotateY(yaw);
      car.rotateX(pitch);
      car.rotateZ(roll);
    });
  }

  return {
    group,
    update: (dt) => trainUpdate(dt),
    state,
    setExternal: (s, mode) => { external = { s, mode }; },
    serialize: () => ({ s: state.s, mode: state.mode }),
    restore: (d) => { if (d) { state.s = d.s || 0; state.mode = d.mode || 'load'; } },
    // 游客落点:每节车厢 2 人(绝对世界坐标,与轨道同坐标系)
    riderPos(i, out) {
      const car = cars[Math.min(3, i >> 1)];
      out.x = car.position.x + (i & 1 ? 0.16 : -0.16); out.y = car.position.y + 0.42; out.z = car.position.z;
    },
  };
}

// 幽灵预览:只有轨道线,便宜
export function coasterGhostGeometry(game, baseY, ax, az) {
  const toWorld = ([tx, ty, h]) => new THREE.Vector3(ax + tx * TILE, baseY + h * H_UNIT + 0.02, az + ty * TILE);
  const pts = WAYPOINTS.map(toWorld);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.12);
  const b = new GeomBuilder();
  const N = 160;
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(i / N), q = curve.getPointAt((i + 1) / N);
    b.bar([p.x, p.y, p.z], [q.x, q.y, q.z], 0.5, 0.12, 0xffffff, 1);
  }
  return b.build();
}
