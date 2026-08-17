// 游乐设施系统:定义/验证/放置/动画/队列/上下客/收益。商店视作"即时交易"设施。
import * as THREE from 'three';
import { TILE, H_UNIT, COL, WATER_H, PATH, MAP_W, MAP_H } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';
import { buildCoaster, coasterGhostGeometry } from './coaster.js';

// ---------------- 设施定义 ----------------
export const RIDE_DEFS = [
  {
    id: 'carousel', name: '旋转木马', kind: 'flat', cat: 'ride', desc: '经典双层彩灯旋转木马',
    w: 3, h: 3, cost: 900, upkeep: 35, capacity: 12, duration: 11,
    basePrice: 3, excitement: 38, intensity: 22, nausea: 8, build: buildCarousel,
  },
  {
    id: 'ferris', name: '摩天轮', kind: 'flat', cat: 'ride', desc: '慢慢升高看风景',
    w: 4, h: 2, cost: 1600, upkeep: 50, capacity: 16, duration: 22,
    basePrice: 3.5, excitement: 42, intensity: 18, nausea: 10, build: buildFerris,
  },
  {
    id: 'twist', name: '旋转飞椅', kind: 'flat', cat: 'ride', desc: '公转加自转,晕乎乎',
    w: 4, h: 4, cost: 1400, upkeep: 45, capacity: 16, duration: 14,
    basePrice: 3.5, excitement: 47, intensity: 40, nausea: 30, build: buildTwist,
  },
  {
    id: 'woodie', name: '木制过山车', kind: 'coaster', cat: 'ride', desc: '预制布局:提升坡 + 俯冲 + 回旋',
    w: 18, h: 11, cost: 4200, upkeep: 140, capacity: 16, duration: 0,
    basePrice: 7, excitement: 66, intensity: 61, nausea: 36,
  },
  {
    id: 'burger', name: '汉堡店', kind: 'shop', cat: 'shop', desc: '游客饿了会来买', sells: 'food',
    w: 1, h: 1, cost: 350, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 4.5, excitement: 0, intensity: 0, nausea: 8, build: (r, m) => buildStall(r, m, 0xd8a038, 0xa03028, '堡'),
  },
  {
    id: 'drinks', name: '饮料店', kind: 'shop', cat: 'shop', desc: '解渴饮料', sells: 'drink',
    w: 1, h: 1, cost: 320, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 3, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, 0x3a7ad8, 0xd8e8f0, '饮'),
  },
  {
    id: 'balloon', name: '纪念品店', kind: 'shop', cat: 'shop', desc: '气球与纪念品,提升开心度', sells: 'joy',
    w: 1, h: 1, cost: 300, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 4.5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, 0xc86ad8, 0xf0e0f8, '念'),
  },
  {
    id: 'coffee', name: '咖啡店', kind: 'shop', cat: 'shop', desc: '提神又开心', sells: 'coffee',
    w: 1, h: 1, cost: 380, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 4, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, 0x8a5a30, 0xe8d8c0, '咖'),
  },
  {
    id: 'toilet', name: '厕所', kind: 'shop', cat: 'shop', desc: '游客内急必来', sells: 'toilet',
    w: 1, h: 1, cost: 320, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 1.5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, 0x7a8a9a, 0xd8dde0, '厕'),
  },
  {
    id: 'umbrella', name: '伞具店', kind: 'shop', cat: 'shop', desc: '下雨天热卖', sells: 'umbrella',
    w: 1, h: 1, cost: 340, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, 0x3a4a6a, 0xc8d4e8, '伞'),
  },
  {
    id: 'haunted', name: '鬼屋', kind: 'flat', cat: 'ride', desc: '阴森小屋,尖叫连连',
    w: 3, h: 3, cost: 1300, upkeep: 55, capacity: 10, duration: 14,
    basePrice: 3.5, excitement: 45, intensity: 28, nausea: 12, build: buildHaunted,
  },
  {
    id: 'bumper', name: '碰碰车', kind: 'flat', cat: 'ride', desc: '互相碰撞才好玩',
    w: 4, h: 4, cost: 1500, upkeep: 60, capacity: 12, duration: 16,
    basePrice: 4, excitement: 52, intensity: 38, nausea: 15, build: buildBumper,
  },
  {
    id: 'pirate', name: '海盗船', kind: 'flat', cat: 'ride', desc: '大摆船,荡到最高点',
    w: 4, h: 2, cost: 1700, upkeep: 60, capacity: 16, duration: 18,
    basePrice: 4, excitement: 50, intensity: 45, nausea: 30, build: buildPirate,
  },
  {
    id: 'tower', name: '观光塔', kind: 'flat', cat: 'ride', desc: '升上高空俯瞰全园',
    w: 2, h: 2, cost: 1500, upkeep: 55, capacity: 8, duration: 16,
    basePrice: 4, excitement: 40, intensity: 20, nausea: 10, build: buildTower,
  },
];
export const DEF_BY_ID = Object.fromEntries(RIDE_DEFS.map(d => [d.id, d]));

// ---------------- 低多边形构建 ----------------
function meshOf(builder, mat) { return new THREE.Mesh(builder.build(), mat); }

// 读档/无路兜底出入口(绝对 tile 坐标)
function fallbackGates(def, ax = 0, ay = 0) {
  const e = { inner: [ax, ay], outer: [ax - 1, ay], dir: 2 };
  const x = { inner: [ax + def.w - 1, ay + def.h - 1], outer: [ax + def.w, ay + def.h - 1], dir: 0 };
  return { entrance: e, exit: x };
}

function buildCarousel(ride, mat) {
  const g = new THREE.Group();
  const stat = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  stat.frustum(cx, 0, cz, 2.55, 2.45, 0.28, 0xd8d0c0, 1, 10);          // 基座
  stat.frustum(cx, 2.0, cz, 2.8, 0.12, 1.15, 0xe33d30, 1, 10);         // 顶篷(红)
  stat.frustum(cx, 1.95, cz, 2.9, 2.85, 0.14, 0xf0e0b0, 1, 10);        // 顶篷檐
  stat.post(cx, 3.0, cz, 0.14, 0.5, 0xe8b830, 1);                       // 顶饰
  stat.blob(cx, 3.6, cz, 0.25, 0xe8b830, 1.1);
  g.add(meshOf(stat, mat));
  // 旋转部分(枢轴放在盘面中心转,几何绕原点构建,否则旋转会飞出基座)
  const spin = new THREE.Group();
  spin.position.set(cx, 0, cz);
  const dyn = new GeomBuilder();
  dyn.frustum(0, 0.28, 0, 2.3, 2.3, 0.14, 0xf0e8d8, 1, 10);           // 台面
  dyn.post(0, 0.28, 0, 0.2, 2.2, 0xe8b830, 1);                        // 中柱
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const px = Math.cos(a) * 1.55, pz = Math.sin(a) * 1.55;
    dyn.post(px, 0.42, pz, 0.045, 1.5, 0xc8c8d0, 1);                    // 马杆
    const col = [0xffffff, 0xd84a3a, 0x3a7ad8, 0xe8b830][i % 4];
    dyn.box(px, 0.72, pz, 0.5, 0.3, 0.26, col, 1);                      // 木马
    dyn.box(px, 0.92, pz + 0.16, 0.18, 0.2, 0.18, col, 1.05);
  }
  spin.add(meshOf(dyn, mat));
  g.add(spin);
  return {
    group: g,
    update: (dt, r) => { spin.rotation.y += dt * r.animSpeed * 1.1; },
    // 游客落点:前 8 人骑木马,其余站台面(随台旋转)
    riderPos(i, out) {
      const th = spin.rotation.y;
      if (i < 8) {
        const a = i / 8 * Math.PI * 2 + th;
        out.x = cx + Math.cos(a) * 1.55; out.y = 0.78; out.z = cz + Math.sin(a) * 1.55;
      } else {
        const a = (i - 8) * 1.7 + th + 0.4;
        out.x = cx + Math.cos(a) * 0.85; out.y = 0.42; out.z = cz + Math.sin(a) * 0.85;
      }
    },
  };
}

function buildFerris(ride, mat) {
  const g = new THREE.Group();
  const stat = new GeomBuilder();
  const cx = 2 * TILE, cy = 2.2, cz = 1 * TILE;   // 轮心
  const R = 1.85;
  // A 字支架(两侧)
  stat.bar([cx - 0.5, 0, cz - 0.6], [cx - 0.12, cy, cz], 0.14, 0.14, 0xc8c8d0, 1);
  stat.bar([cx + 0.5, 0, cz - 0.6], [cx + 0.12, cy, cz], 0.14, 0.14, 0xc8c8d0, 1);
  stat.bar([cx - 0.5, 0, cz + 0.6], [cx - 0.12, cy, cz], 0.14, 0.14, 0xc8c8d0, 1);
  stat.bar([cx + 0.5, 0, cz + 0.6], [cx + 0.12, cy, cz], 0.14, 0.14, 0xc8c8d0, 1);
  g.add(meshOf(stat, mat));
  // 轮
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(cx, cy, cz);
  const wb = new GeomBuilder();
  const SEG = 10;
  for (let i = 0; i < SEG; i++) {
    const a0 = i / SEG * Math.PI * 2, a1 = (i + 1) / SEG * Math.PI * 2;
    wb.bar([Math.cos(a0) * R, Math.sin(a0) * R, 0], [Math.cos(a1) * R, Math.sin(a1) * R, 0], 0.12, 0.1, 0xe8b830, 1);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    wb.bar([0, 0, 0], [Math.cos(a) * R, Math.sin(a) * R, 0], 0.07, 0.07, 0xc8c8d0, 0.9);
  }
  wb.post(0, -0.15, 0, 0.16, 0.3, 0x8a8d8f, 1);
  wheelGroup.add(meshOf(wb, mat));
  // 座舱(Ref,每帧跟随)
  const cabins = [];
  const cabinCols = [0xd84a3a, 0xe8b830, 0x3a7ad8, 0x48b050, 0xc86ad8, 0xe87a30, 0xd84a3a, 0x3aa8a0];
  for (let i = 0; i < 8; i++) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42),
      new THREE.MeshLambertMaterial({ color: cabinCols[i] }));
    g.add(cm);
    cabins.push(cm);
  }
  g.add(wheelGroup);
  let ang = 0;
  return {
    group: g,
    update: (dt, r) => {
      ang += dt * r.animSpeed * 0.35;
      wheelGroup.rotation.z = ang;
      for (let i = 0; i < 8; i++) {
        const a = ang + i / 8 * Math.PI * 2;
        cabins[i].position.set(cx + Math.cos(a) * R, cy + Math.sin(a) * R - 0.32, cz);
      }
    },
    // 游客落点:每座舱 2 人
    riderPos(i, out) {
      const cab = cabins[i % 8];
      out.x = cab.position.x; out.y = cab.position.y - 0.06; out.z = cz + (i < 8 ? -0.1 : 0.1);
    },
  };
}

function buildTwist(ride, mat) {
  const g = new THREE.Group();
  const stat = new GeomBuilder();
  const cx = 2 * TILE, cz = 2 * TILE;
  stat.frustum(cx, 0, cz, 2.75, 2.65, 0.22, 0x9aa2a8, 1, 10);
  g.add(meshOf(stat, mat));
  const spin = new THREE.Group();
  spin.position.set(cx, 0.22, cz);
  const db = new GeomBuilder();
  db.post(0, 0, 0, 0.28, 0.85, 0xd84a3a, 1);
  db.blob(0, 1.05, 0, 0.4, 0xe8b830, 1.05);
  spin.add(meshOf(db, mat));
  const arms = [];
  const armCols = [0x3a7ad8, 0xe8b830, 0x48b050, 0xc86ad8];
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const ab = new GeomBuilder();
    ab.box(1.1, 0.55, 0, 2.2, 0.16, 0.16, 0xc8c8d0, 1);
    arm.add(meshOf(ab, mat));
    const carM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshLambertMaterial({ color: armCols[i] }));
    carM.position.set(2.1, 0.5, 0);
    arm.add(carM);
    arm.rotation.y = i / 4 * Math.PI * 2;
    spin.add(arm);
    arms.push({ arm, carM });
  }
  g.add(spin);
  let ang = 0;
  return {
    group: g,
    update: (dt, r) => {
      ang += dt * r.animSpeed * 1.5;
      spin.rotation.y = ang;
      for (const { carM } of arms) carM.rotation.y = -ang * 2.4;
    },
    // 游客落点:每臂 4 人(随车绕中心公转)
    riderPos(i, out) {
      const ai = i % 4, slot = (i / 4) | 0;
      const th = spin.rotation.y + ai * Math.PI / 2;
      const tx = 2.1 + (slot === 1 ? 0.16 : slot === 2 ? -0.16 : 0);
      const tz = (slot === 3 ? 0.14 : 0) - 0.02;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + tx * ca + tz * sa; out.y = 0.6; out.z = cz - tx * sa + tz * ca;
    },
  };
}

function buildStall(ride, mat, colRoof, colBody, glyph) {

  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 0.5 * TILE, cz = 0.5 * TILE;
  b.box(cx, 0.55, cz, 1.5, 1.1, 1.3, colBody, 1);
  b.box(cx, 0.85, cz + 0.66, 1.1, 0.45, 0.05, 0x2a3038, 1);        // 柜台窗口
  b.box(cx, 1.3, cz, 1.8, 0.28, 1.6, colRoof, 1);                   // 平顶
  b.frustum(cx, 1.42, cz, 1.1, 0.12, 0.55, colRoof, 1, 4);          // 尖顶
  b.post(cx, 1.95, cz, 0.04, 0.35, 0x50535a, 1);                    // 旗杆
  b.tri([cx, 2.28, cz], [cx + 0.34, 2.2, cz], [cx, 2.12, cz], [[0, 0], [0, 0], [0, 0]], 0xe8b830, 1.1); // 小旗
  g.add(meshOf(b, mat));
  return { group: g, update: () => {} };
}


// 鬼屋:阴森立面 + 旋转幽灵
function buildHaunted(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  b.box(cx, 1.15, cz + 0.5, 4.6, 2.3, 3.2, 0x4a4048, 1);
  b.frustum(cx, 2.3, cz + 0.5, 3.1, 0.9, 1.5, 0x22201f, 1, 4);
  b.frustum(cx - 1.8, 2.3, cz + 0.9, 0.75, 0.15, 2.6, 0x22201f, 1, 4);
  b.frustum(cx + 1.8, 2.3, cz + 0.9, 0.75, 0.15, 2.6, 0x22201f, 1, 4);
  b.box(cx - 1.8, 5.0, cz + 0.9, 0.35, 0.35, 0.35, 0xc05050, 1.25);
  b.box(cx + 1.8, 5.0, cz + 0.9, 0.35, 0.35, 0.35, 0xc05050, 1.25);
  b.box(cx, 0.9, cz + 2.05, 1.1, 1.7, 0.2, 0x1a1418, 1);
  for (const wx of [-1.55, -0.6, 0.6, 1.55]) {
    b.box(cx + wx, 1.3, cz + 2.0, 0.45, 0.6, 0.08, 0x7a50c8, 1.2);
  }
  g.add(meshOf(b, mat));
  const ghost = new THREE.Group();
  const gm = new THREE.MeshLambertMaterial({ color: 0xe8f0e8, transparent: true, opacity: 0.85 });
  const gb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), gm);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 7), gm);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.6;
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshBasicMaterial({ color: 0x101018 }));
  e1.position.set(-0.14, 0.1, 0.36);
  const e2 = e1.clone(); e2.position.x = 0.14;
  ghost.add(gb, tail, e1, e2);
  ghost.position.set(cx, 4.6, cz + 1.2);
  g.add(ghost);
  let t = 0;
  return {
    group: g,
    update: (dt, r) => { t += dt * (0.4 + r.animSpeed); ghost.rotation.y = t * 2.1; ghost.position.y = 4.6 + Math.sin(t * 1.7) * 0.5; },
    // 游客落点:屋内脏黑走一圈(本身就难看清,只保证"人进去了")
    riderPos(i, out) {
      out.x = cx - 0.6 + (i % 4) * 0.4; out.y = 0.05; out.z = cz - 0.6 + ((i / 4) | 0) * 0.5;
    },
  };
}

// 碰碰车:平台 + 游走碰撞的车
function buildBumper(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 2 * TILE, cz = 2 * TILE;
  b.box(cx, 0.12, cz, 6.4, 0.24, 6.4, 0x6a7078, 1);
  for (let i = 0; i < 4; i++) {
    b.post(cx - 2.9 + i * 1.95, 0.3, cz - 2.9, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx - 2.9 + i * 1.95, 0.3, cz + 2.9, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx - 2.9, 0.3, cz - 2.9 + i * 1.95, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx + 2.9, 0.3, cz - 2.9 + i * 1.95, 0.07, 2.3, 0xc8a830, 1);
  }
  b.box(cx, 2.65, cz, 6.9, 0.18, 6.9, 0xd8a030, 0.95);
  g.add(meshOf(b, mat));
  const cars = [];
  const cols = [0xd84a3a, 0x3a7ad8, 0x48b050, 0xe8b830, 0xc86ad8, 0xe87a30];
  for (let i = 0; i < 6; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 1.0), new THREE.MeshLambertMaterial({ color: cols[i] }));
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    pole.position.y = 1.15;
    car.add(pole);
    g.add(car);
    cars.push({ car, a: i / 6 * Math.PI * 2, r: 1 + (i % 3) * 0.7, sp: 0.4 + (i % 3) * 0.25, dir: i % 2 ? 1 : -1 });
  }
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      for (const c of cars) {
        c.a += dt * c.sp * c.dir * rd.animSpeed;
        c.r += Math.sin(t * 0.9 + c.a * 3) * dt * 0.5;
        c.r = Math.max(0.7, Math.min(2.5, c.r));
        c.car.position.set(cx + Math.cos(c.a) * c.r, 0.5, cz + Math.sin(c.a) * c.r);
        c.car.rotation.y = -c.a + (c.dir > 0 ? 0 : Math.PI);
      }
    },
    // 游客落点:每车 2 人,随车游走
    riderPos(i, out) {
      const c = cars[i % 6];
      out.x = c.car.position.x + (i < 6 ? -0.16 : 0.16); out.y = 0.52; out.z = c.car.position.z;
    },
  };
}

// 海盗船:门架 + 摇摆船
function buildPirate(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 2 * TILE, cz = 1 * TILE, topY = 3.4;
  b.bar([cx - 2.4, 0, cz - 0.8], [cx - 0.25, topY, cz], 0.18, 0.18, 0x8a4a2a, 1);
  b.bar([cx + 2.4, 0, cz - 0.8], [cx + 0.25, topY, cz], 0.18, 0.18, 0x8a4a2a, 1);
  b.bar([cx - 2.4, 0, cz + 0.8], [cx - 0.25, topY, cz], 0.18, 0.18, 0x8a4a2a, 1);
  b.bar([cx + 2.4, 0, cz + 0.8], [cx + 0.25, topY, cz], 0.18, 0.18, 0x8a4a2a, 1);
  b.bar([cx - 0.5, topY, cz], [cx + 0.5, topY, cz], 0.2, 0.2, 0x8a4a2a, 1);
  b.box(cx - 2.5, 0.15, cz, 0.5, 0.3, 2.2, 0xd8d0c0, 1);
  b.box(cx + 2.5, 0.15, cz, 0.5, 0.3, 2.2, 0xd8d0c0, 1);
  g.add(meshOf(b, mat));
  const ship = new THREE.Group();
  const sb = new GeomBuilder();
  sb.box(0, -1.5, 0, 3.0, 0.6, 0.9, 0x8a3020, 1);
  sb.frustum(0, -1.05, 0, 1.85, 1.6, 0.35, 0xd8b830, 1, 4);
  sb.box(-1.65, -1.3, 0, 0.45, 0.85, 0.7, 0x8a3020, 1);
  sb.box(1.65, -1.3, 0, 0.45, 0.85, 0.7, 0x8a3020, 1);
  sb.post(0, -1.9, 0, 0.06, 2.5, 0xd8d0c0, 1);
  sb.tri([0, 0.6, 0], [0.7, 0.35, 0], [0, 0.12, 0], [[0, 0], [0, 0], [0, 0]], 0x303038, 1);
  ship.add(meshOf(sb, mat));
  ship.position.set(cx, topY, cz);
  g.add(ship);
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      const amp = Math.min(1.15, 0.25 + rd.animSpeed * 0.9);
      ship.rotation.z = Math.sin(t * 1.7) * amp;
    },
    // 游客落点:两排座位,随船摆动(绕挂点 z 轴旋转)
    riderPos(i, out) {
      const th = ship.rotation.z;
      const x0 = -1.15 + (i % 8) * (2.3 / 7);
      const y0 = -1.12;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + x0 * ca - y0 * sa; out.y = topY + x0 * sa + y0 * ca; out.z = cz + (i < 8 ? -0.22 : 0.22);
    },
  };
}

// 观光塔:高塔 + 升降环舱
function buildTower(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1 * TILE, cz = 1 * TILE;
  b.frustum(cx, 0, cz, 1.5, 1.3, 0.5, 0xc8c8d0, 1, 8);
  b.frustum(cx, 0.4, cz, 0.55, 0.24, 10.5, 0xd8d8e0, 1, 8);
  b.box(cx, 10.9, cz, 0.9, 0.7, 0.9, 0xd84a3a, 1);
  b.blob(cx, 11.5, cz, 0.3, 0xe8b830, 1.15);
  g.add(meshOf(b, mat));
  const cabin = new THREE.Group();
  const cb = new GeomBuilder();
  cb.frustum(0, 0, 0, 1.05, 0.95, 0.55, 0x3a7ad8, 1, 8);
  cb.frustum(0, 0.55, 0, 0.8, 0.75, 0.3, 0xe8e8f0, 1, 8);
  cabin.add(meshOf(cb, mat));
  cabin.position.set(cx, 1.2, cz);
  g.add(cabin);
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      const cycle = (Math.sin(t * 0.55 - Math.PI / 2) + 1) / 2;
      cabin.position.y = 1.2 + cycle * 8.4;
      cabin.rotation.y = t * 0.35;
    },
    // 游客落点:环舱一圈,随舱升降旋转
    riderPos(i, out) {
      const a = i / 8 * Math.PI * 2 + cabin.rotation.y;
      out.x = cx + Math.cos(a) * 0.72; out.y = cabin.position.y + 0.32; out.z = cz + Math.sin(a) * 0.72;
    },
  };
}
// 入口/出口小屋(几何以原点为中心,由 mesh.position 放到局部 tile 坐标)
function buildHut(mat, colorHex) {
  const b = new GeomBuilder();
  b.box(0, 0.6, 0, 1.3, 1.2, 1.1, 0xc8b890, 1);
  b.frustum(0, 1.2, 0, 1.05, 0.1, 0.5, colorHex, 1, 4);
  b.box(0, 0.5, 0.56, 0.6, 0.8, 0.04, 0x3a3026, 1);  // 门
  return meshOf(b, mat);
}

// ---------------- 系统类 ----------------
export class Rides {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.list = [];          // placed rides
    this.nextId = 1;
  }

  defs() { return RIDE_DEFS; }

  // anchor: 足迹左下角 tile。返回 {ok, reason, tiles, anchor:{x,y}}
  validateAt(defId, x, y) {
    const def = DEF_BY_ID[defId];
    if (!def) return { ok: false, reason: '未知设施' };
    const w = this.game.world;
    const tiles = [];
    const xs = x, ys = y;
    for (let ty = 0; ty < def.h; ty++) {
      for (let tx = 0; tx < def.w; tx++) {
        const px = xs + tx, py = ys + ty;
        if (!w.in(px, py)) return { ok: false, reason: '超出地图' };
        if (!w.ownedAt(px, py)) return { ok: false, reason: '不在公园范围内' };
        if (!w.isClear(px, py)) return { ok: false, reason: '位置被占用' };
        if (w.minH(px, py) < WATER_H) return { ok: false, reason: '水下不能建造' };
        tiles.push([px, py]);
      }
    }
    // 站台类区域平整度:整足迹同高即可(对所有平地设施 & 商店;过山车只查站台排,允许自动打地基)
    const ref = [];
    if (def.kind === 'coaster') {
      for (let tx = 1; tx <= 5; tx++) ref.push([xs + tx, ys + 1]);
    } else {
      ref.push(...tiles);
    }
    let h0 = w.base[w.idx(ref[0][0], ref[0][1])];
    let flattenTiles = null;
    for (const [tx, ty] of ref) {
      if (w.slope[w.idx(tx, ty)] !== 0 || w.base[w.idx(tx, ty)] !== h0) {
        if (def.kind === 'coaster') {
          // 打地基:站台排差得不多就自动整平
          const hs = ref.map(([rx, ry]) => w.base[w.idx(rx, ry)] + (w.slope[w.idx(rx, ry)] ? 0.9 : 0));
          const mx = Math.max(...hs), mn = Math.min(...hs);
          if (mx - mn <= 3) {
            h0 = Math.round(hs.reduce((s, v) => s + v, 0) / hs.length);
            flattenTiles = ref.map(([rx, ry]) => [rx, ry, h0]);
            break;
          }
        }
        return { ok: false, reason: def.kind === 'coaster' ? '站台排需要平整地面' : '需要平整地面', tiles };
      }
    }
    // 出入口:有临路就自动选,没有也能放(之后用"设出入口"工具接入路径)
    const found = this._findGates(def, xs, ys);
    const spots = found || fallbackGates(def, xs, ys);
    return { ok: true, tiles, gates: spots, flattenTiles, needGate: !found };
  }

  // 设/移出入口:目标 tile 必须属于该设施且在边缘,且外侧邻居是路径
  canSetGate(ride, x, y) {
    const w = this.game.world;
    if (!w.in(x, y)) return { ok: false, reason: '' };
    if (w.rideTile[w.idx(x, y)] !== ride.id) return { ok: false, reason: '不属于该设施' };
    // 边缘:至少一个邻居不在设施内
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = w.neighbor(x, y, d);
      const outside = !w.in(nx, ny) || w.rideTile[w.idx(nx, ny)] !== ride.id;
      if (!outside) continue;
      if (w.in(nx, ny) && w.path[w.idx(nx, ny)] !== PATH.NONE && w.rideTile[w.idx(nx, ny)] === -1) {
        return { ok: true, inner: [x, y], outer: [nx, ny], dir: d };
      }
    }
    return { ok: false, reason: '出入口需设在设施边缘,且外侧紧邻路径' };
  }
  setGate(rideId, which, x, y) {
    const ride = this.findRide(rideId);
    if (!ride) return { ok: false, reason: '设施不存在' };
    if (which !== 'entrance' && which !== 'exit') return { ok: false, reason: '' };
    const chk = this.canSetGate(ride, x, y);
    if (!chk.ok) return chk;
    ride[which] = { inner: chk.inner, outer: chk.outer, dir: chk.dir };
    ride.needGate = false;
    // 移动小屋 mesh
    const hut = ride.huts?.[which];
    if (hut) {
      const a = { x: ride.x, y: ride.y };
      hut.position.set((chk.inner[0] - a.x) * TILE + TILE / 2, 0, (chk.inner[1] - a.y) * TILE + TILE / 2);
    }
    this.computeQueueCells(ride);
    this._repositionQueue(ride);
    return { ok: true };
  }
  // 入口是否已接通路径(开放前置条件)
  gateConnected(ride, which = 'entrance') {
    const w = this.game.world;
    const g = ride[which];
    return g && w.in(g.outer[0], g.outer[1]) && w.path[w.idx(g.outer[0], g.outer[1])] !== PATH.NONE;
  }

  _findGates(def, xs, ys) {
    // 候选门位:足迹边界 tile + 其外侧邻居;需要外邻是 path 或 queue
    const w = this.game.world;
    const cands = [];
    const push = (tx, ty, dir) => {
      const [ox, oy] = [tx + World.DX[dir], ty + World.DY[dir]];
      if (w.in(ox, oy) && w.path[w.idx(ox, oy)] !== PATH.NONE && w.rideTile[w.idx(ox, oy)] === -1) {
        cands.push({ inner: [tx, ty], outer: [ox, oy], dir });
      }
    };
    for (let tx = 0; tx < def.w; tx++) { push(xs + tx, ys, 3); push(xs + tx, ys + def.h - 1, 1); }
    for (let ty = 0; ty < def.h; ty++) { push(xs, ys + ty, 2); push(xs + def.w - 1, ys + ty, 0); }
    if (!cands.length) return null;
    // 入口选第一个,出口尽量选远离的
    const entrance = cands[0];
    let exit = cands[cands.length - 1];
    let bestD = -1;
    for (const c of cands) {
      const d = Math.abs(c.inner[0] - entrance.inner[0]) + Math.abs(c.inner[1] - entrance.inner[1]);
      if (d > bestD) { bestD = d; exit = c; }
    }
    return { entrance, exit };
  }

  // 供工具:以光标为中心的 anchor
  anchorFor(defId, x, y) {
    const def = DEF_BY_ID[defId];
    return { x: x - Math.floor(def.w / 2), y: y - Math.floor(def.h / 2) };
  }
  validate(defId, x, y) {
    const a = this.anchorFor(defId, x, y);
    const v = this.validateAt(defId, a.x, a.y);
    v.anchor = a;
    return v;
  }

  makeGhost(defId) {
    const def = DEF_BY_ID[defId];
    const g = new THREE.Group();
    const gm = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    let geoMesh;
    if (def.kind === 'coaster') {
      // 定位时再算几何(依赖 baseY) → 先放空容器,poseGhost 里构建
      g.userData.coaster = true;
      g.userData.mat = gm;
    } else {
      const built = def.build(null, gm);
      g.add(built.group);
    }
    return g;
  }
  poseGhost(ghost, defId, x, y, valid) {
    const def = DEF_BY_ID[defId];
    const w = this.game.world;
    const a = this.anchorFor(defId, x, y);
    let baseY = 0, ok = true;
    if (w.in(a.x, a.y)) {
      baseY = Math.max(0, ...this._footprintHeights(def, a.x, a.y)) * H_UNIT;
    }
    ghost.position.set(World.tileToWorldX(a.x), baseY, World.tileToWorldZ(a.y));
    if (ghost.userData.coaster) {
      if (!ghost.userData.mesh || ghost.userData.ax !== a.x || ghost.userData.ay !== a.y || ghost.userData.baseY !== baseY) {
        if (ghost.userData.mesh) { ghost.remove(ghost.userData.mesh); }
        const m = new THREE.Mesh(coasterGhostGeometry(this.game, baseY, World.tileToWorldX(a.x), World.tileToWorldZ(a.y)), ghost.userData.mat);
        ghost.userData.mesh = m;
        ghost.userData.ax = a.x; ghost.userData.ay = a.y; ghost.userData.baseY = baseY;
        ghost.position.set(0, 0, 0); // 几何内已含世界偏移
        m.position.set(0, 0, 0);
      }
      ghost.userData.mesh.material.emissive?.setHex(valid ? 0x0a3a0a : 0x4a0a0a);
    } else {
      ghost.traverse(o => { if (o.material) o.material.emissive?.setHex(valid ? 0x0a3a0a : 0x4a0a0a); });
    }
  }
  _footprintHeights(def, xs, ys) {
    const w = this.game.world, hs = [];
    for (let ty = 0; ty < def.h; ty++)
      for (let tx = 0; tx < def.w; tx++)
        if (w.in(xs + tx, ys + ty)) hs.push(w.maxH(xs + tx, ys + ty));
    return hs.length ? hs : [0];
  }

  place(defId, x, y, forcedId = null) {
    const v = this.validate(defId, x, y);
    if (!v.ok) return v;
    const def = DEF_BY_ID[defId];
    const w = this.game.world;
    const a = v.anchor;
    // 过山车打地基:先整平站台排
    if (v.flattenTiles) {
      for (const [fx, fy, fh] of v.flattenTiles) w.setBaseSlope(fx, fy, fh, 0);
      w.emit('terrain', a.x, a.y, a.x + def.w, a.y + def.h);
    }
    const ride = {
      id: forcedId ?? this.nextId++, def, x: a.x, y: a.y,
      baseY: Math.max(0, ...this._footprintHeights(def, a.x, a.y)) * H_UNIT,
      status: 'closed',
      price: def.basePrice,
      guestsServed: 0, incomeTotal: 0,
      queue: [], riders: [],
      animSpeed: 0, cycleT: 0, phase: 'idle',
      entrance: v.gates.entrance, exit: v.gates.exit,
      needGate: !!v.needGate,
      reliability: 94 + (a.x * 7 + a.y * 13) % 5,   // 初始可靠度(确定性,避免联机分歧)
      broken: false, breakdownT: 0,
      excitement: def.excitement, intensity: def.intensity, nausea: def.nausea,
    };
    // 标记 tile
    if (forcedId != null) this.nextId = Math.max(this.nextId, forcedId + 1);
    for (const [tx, ty] of v.tiles) w.rideTile[w.idx(tx, ty)] = ride.id;
    w.emit('path', a.x, a.y, a.x + def.w, a.y + def.h);   // 相邻路径连通性可能变化(出入口)
    this._buildVisuals(ride);
    this.list.push(ride);
    // 计算队列格(从入口外邻出发沿 QUEUE 走)
    this.computeQueueCells(ride);
    if (def.kind === 'shop') ride.status = 'open'; // 商店直接营业
    return { ok: true, cost: def.cost, ride, needGate: !!v.needGate };
  }

  // 构建 ride 的网格/动画(放置与读档共用)
  _buildVisuals(ride) {
    const w = this.game.world;
    const a = { x: ride.x, y: ride.y };
    const def = ride.def;
    const group = new THREE.Group();
    group.position.set(World.tileToWorldX(a.x), ride.baseY, World.tileToWorldZ(a.y));
    let api;
    if (def.kind === 'coaster') {
      api = buildCoaster(this.game, ride);
      group.position.set(0, 0, 0);   // 过山车构建用绝对世界坐标
    } else {
      api = def.build(ride, this.mat);
      // 入口/出口小屋(可移动,记录引用)
      ride.huts = {};
      for (const [which, col] of [['entrance', 0x3a7ad8], ['exit', 0x8a5a30]]) {
        const hut = buildHut(this.mat, col);
        const gpos = ride[which];
        hut.position.set((gpos.inner[0] - a.x) * TILE + TILE / 2, 0, (gpos.inner[1] - a.y) * TILE + TILE / 2);
        group.add(hut);
        ride.huts[which] = hut;
      }
    }
    group.add(api.group);
    this.group.add(group);
    ride.group = group;
    ride.api = api;
  }

  // 读档恢复(不做校验/不改 world 数组——数组来自存档)
  restoreRide(s) {
    const def = DEF_BY_ID[s.defId];
    if (!def) return;
    const w = this.game.world;
    // 找入口/出口:重新扫描(与放置时同算法 → 确定性一致)
    const spots = this._findGates(def, s.x, s.y) || fallbackGates(def, s.x, s.y);
    const ride = {
      id: s.id, def, x: s.x, y: s.y,
      baseY: Math.max(0, ...this._footprintHeights(def, s.x, s.y)) * H_UNIT,
      status: s.status || 'closed',
      price: s.price ?? def.basePrice,
      guestsServed: s.guestsServed || 0, incomeTotal: s.incomeTotal || 0,
      reliability: s.reliability ?? 95, broken: !!s.broken, breakdownT: 0,
      queue: [], riders: [], animSpeed: 0, cycleT: 0, phase: 'idle',
      entrance: spots.entrance, exit: spots.exit,
      excitement: def.excitement, intensity: def.intensity, nausea: def.nausea,
    };
    this._buildVisuals(ride);
    this.list.push(ride);
    this.computeQueueCells(ride);
    if (ride.api?.restore) ride.api.restore(s.coaster);
    return ride;
  }

  remove(rideId) {
    const idx = this.list.findIndex(r => r.id === rideId);
    if (idx < 0) return { ok: false, reason: '' };
    const ride = this.list[idx];
    const w = this.game.world;
    // 排队/乘坐的游客释放
    if (this.game.peeps) {
      for (const p of [...ride.queue, ...ride.riders]) this.game.peeps.releaseFromQueue(p);
    }
    for (let ty = 0; ty < ride.def.h; ty++)
      for (let tx = 0; tx < ride.def.w; tx++)
        if (w.rideTile[w.idx(ride.x + tx, ride.y + ty)] === rideId) w.rideTile[w.idx(ride.x + tx, ride.y + ty)] = -1;
    this.group.remove(ride.group);
    ride.group.traverse(o => { o.geometry?.dispose?.(); });
    this.list.splice(idx, 1);
    w.emit('path', ride.x, ride.y, ride.x + ride.def.w, ride.y + ride.def.h);
    this.game.ui?.closeRideWindow?.(rideId);
    return { ok: true, cost: -Math.round(ride.def.cost * 0.55) };
  }

  tilesOf(rideId) {
    const r = this.list.find(q => q.id === rideId);
    if (!r) return [];
    const out = [];
    for (let ty = 0; ty < r.def.h; ty++)
      for (let tx = 0; tx < r.def.w; tx++) out.push([r.x + tx, r.y + ty]);
    return out;
  }

  findRide(id) { return this.list.find(r => r.id === id); }

  // 队列格链:入口外邻 tile 往外沿 QUEUE 走到头/分叉;QUEUE 用完后沿路径继续延伸(溢出)
  computeQueueCells(ride) {
    const w = this.game.world;
    const cells = [];
    let [cx, cy] = ride.entrance.outer;
    let prev = [-1, -1];
    let queueMode = true;   // true:只沿 QUEUE;false:QUEUE 用尽后沿任意路径单向前伸
    for (let i = 0; i < 10; i++) {
      cells.push([cx, cy]);
      const nexts = [];
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = w.neighbor(cx, cy, d);
        if (nx === prev[0] && ny === prev[1]) continue;
        if (!w.in(nx, ny)) continue;
        const p = w.path[w.idx(nx, ny)];
        if (queueMode ? p === PATH.QUEUE : p !== PATH.NONE) nexts.push([nx, ny]);
      }
      // 岔路太多时优先直行
      let pick = null;
      if (nexts.length === 1) pick = nexts[0];
      else if (nexts.length > 1) {
        const dd = [cx - prev[0], cy - prev[1]];
        pick = nexts.find(([nx, ny]) => nx - cx === dd[0] && ny - cy === dd[1]) || null;
      }
      if (!pick) {
        if (queueMode) { queueMode = false; continue; }  // QUEUE 到头,换任意路径延伸
        break;
      }
      prev = [cx, cy];
      [cx, cy] = pick;
      if (queueMode && w.path[w.idx(cx, cy)] !== PATH.QUEUE) queueMode = false;
    }
    ride.queueCells = cells;
  }

  // ---- 游客接口(peeps 调用) ----
  openWindow(rideId) { this.game.ui?.rideWindow?.(rideId); }
  wantsRide(peep, ride) {
    if (ride.status !== 'open' || ride.broken) return false;
    if (ride.def.kind === 'shop') {
      if (ride.queue.length >= 3) return false;               // 商店即买即走,不排长队
      switch (ride.def.sells) {
        case 'food': return peep.hunger > 0.55;
        case 'drink': return peep.thirst > 0.55;
        case 'joy': return peep.happiness < 0.75 && !peep.hasSouvenir;
        case 'coffee': return peep.energy < 0.5 || (peep.hunger > 0.6 && peep.thirst > 0.6);
        case 'toilet': return peep.bladder > 0.62;
        case 'umbrella': return this.game.weather?.mode === 'rain' && !peep.hasUmbrella;
        default: return false;
      }
    }
    return peep.cash >= ride.price && ride.queue.length < ride.queueCells.length + 8 && peep.energy > 0.15;
  }
  joinQueue(peep, ride) {
    peep.state = 'queue';
    peep.queueRide = ride;
    ride.queue.push(peep);
  }
  queueCellOf(ride, index) {
    const cells = ride.queueCells;
    if (!cells.length) return ride.entrance.outer;
    return cells[Math.min(index, cells.length - 1)];
  }

  // 设施主循环:动画 + 装载(联机客户端:只播动画,上下客以服务端为准)
  update(dt) {
    for (const ride of this.list) {
      // 动画速度趋向状态(故障停摆)
      const targetSpeed = (ride.status === 'closed' || ride.broken) ? 0 : 1;
      ride.animSpeed += (targetSpeed - ride.animSpeed) * Math.min(1, dt * 2);
      if (ride.animSpeed > 0.01 || ride.def.kind === 'coaster') ride.api.update(dt, ride);
      if (this.game.mp) continue;
      // 可靠度衰变 + 故障判定(权威侧)
      if (ride.def.kind !== 'shop' && ride.status === 'open' && !ride.broken) {
        ride.reliability = Math.max(40, ride.reliability - dt * 2 / 45);   // ~2点/月
        ride.breakdownT += dt;
        const rel = ride.reliability / 100;
        const p = (1 - rel) * (1 - rel) * 0.12 * dt * (ride.def.intensity > 30 ? 1.5 : 1);
        if (Math.random() < p) this.breakdown(ride);
      }
      if (ride.broken) continue;
      if (ride.def.kind === 'coaster') { this._updateCoaster(ride); continue; }
      if (ride.def.kind === 'shop') { this._updateShop(ride, dt); continue; }
      this._updateFlat(ride, dt);
    }
  }

  // 故障:甩客(不开心)、停摆、等维修工
  breakdown(ride) {
    if (ride.broken) return;
    ride.broken = true;
    for (const peep of ride.riders) {
      peep.happiness = Math.max(0.05, peep.happiness - 0.15);
      this.game.peeps.alightRide(peep, ride);
    }
    ride.riders.length = 0;
    for (const p of [...ride.queue]) this.game.peeps.releaseFromQueue(p);   // 故障清队
    this.game.messages?.add(`「${ride.def.name}」故障了!需要维修工`);
    this.game.economy?._emit?.('change');
  }

  // 过山车:列车在站台装客(mode=='load')时批量上车
  _updateCoaster(ride) {
    if (ride.status !== 'open') return;
    const st = ride.api.state;
    if (!st || st.mode !== 'load' || st.timer > 0.6) return;
    if (!ride.queue.length) return;
    const n = Math.min(ride.def.capacity, ride.queue.length);
    for (let i = 0; i < n; i++) {
      const peep = ride.queue.shift();
      ride.riders.push(peep);
      this.game.peeps.boardRide(peep, ride);
    }
    this._repositionQueue(ride);
  }
  _updateFlat(ride, dt) {
    const g = this.game;
    if (ride.status !== 'open') { ride.phase = 'idle'; return; }
    ride.cycleT += dt;
    if (ride.phase === 'idle') {
      if (ride.queue.length > 0) {
        ride.phase = 'running';
        ride.cycleT = 0;
        const n = Math.min(ride.def.capacity, ride.queue.length);
        for (let i = 0; i < n; i++) {
          const peep = ride.queue.shift();
          ride.riders.push(peep);
          g.peeps.boardRide(peep, ride);
        }
        // 队列前移
        this._repositionQueue(ride);
      }
    } else if (ride.phase === 'running') {
      if (ride.cycleT >= ride.def.duration) {
        ride.phase = 'idle';
        this.finishRide(ride);
      }
    }
  }
  _updateShop(ride, dt) {
    ride.cycleT += dt;
    if (ride.cycleT < ride.def.duration) return;
    ride.cycleT = 0;
    if (ride.queue.length > 0) {
      const peep = ride.queue.shift();
      this.game.peeps.serveAtShop(peep, ride);
      this._repositionQueue(ride);
    }
  }
  _repositionQueue(ride) {
    ride.queue.forEach((p, i) => { p.queueIndex = i; this.game.peeps.updateQueuePos(p); });
  }

  // 一批游客乘坐结束:结算、放到出口
  finishRide(ride) {
    const g = this.game;
    if (ride.def.kind !== 'shop' && ride.riders.length) {
      ride.guestsServed += ride.riders.length;
    }
    for (const peep of ride.riders) g.peeps.alightRide(peep, ride);
    ride.riders.length = 0;
  }

  charge(ride, peep) {
    const amt = Math.min(ride.price, peep.cash);
    peep.cash -= amt;
    ride.incomeTotal += amt;
    ride.guestsServed += ride.def.kind === 'shop' ? 1 : 0;
    this.game.economy.earn(amt, ride.def.kind === 'shop' ? '商店' : '设施');
  }
}
