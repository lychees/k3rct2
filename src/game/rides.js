// 游乐设施系统:定义/验证/放置/动画/队列/上下客/收益。商店视作"即时交易"设施。
import * as THREE from 'three';
import { TILE, H_UNIT, COL, WATER_H, PATH, MAP_W, MAP_H } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';
import { buildCoaster, coasterGhostGeometry } from './coaster.js';
import { mulberry32 } from '../core/random.js';
import { buildCustomCoaster, COASTER_PIECES, PIECE_BY_ID, MAX_LEVEL, MAX_PIECES, TRACK_STYLES, exitOf, canFinish } from './coasterEdit.js';

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
    id: 'mycoaster', name: '定制过山车', kind: 'coaster', cat: 'ride', custom: true,
    desc: '轨道编辑器:站台起逐段铺设,闭环即成你自己的过山车',
    w: 1, h: 1, cost: 0, upkeep: 110, capacity: 8, duration: 0,
    basePrice: 6, excitement: 55, intensity: 50, nausea: 32,
  },
  {
    id: 'train', name: '观光小火车', kind: 'coaster', cat: 'ride', custom: true, style: 'train',
    desc: '轨道编辑器:平轨与弯道绕园,慢速观光巡游',
    w: 1, h: 1, cost: 0, upkeep: 80, capacity: 8, duration: 0,
    basePrice: 3, excitement: 40, intensity: 18, nausea: 8,
  },
  {
    id: 'flume', name: '激流勇进', kind: 'coaster', cat: 'ride', custom: true, style: 'flume',
    desc: '轨道编辑器:水槽漂流 + 俯冲溅浪',
    w: 1, h: 1, cost: 0, upkeep: 90, capacity: 8, duration: 0,
    basePrice: 4.5, excitement: 55, intensity: 45, nausea: 20,
  },
  {
    id: 'monorail', name: '悬挂单轨', kind: 'coaster', cat: 'ride', custom: true, style: 'monorail',
    desc: '轨道编辑器:高架箱形梁,悬挂车厢巡游',
    w: 1, h: 1, cost: 0, upkeep: 85, capacity: 8, duration: 0,
    basePrice: 4, excitement: 48, intensity: 22, nausea: 10,
  },
  {
    id: 'burger', name: '汉堡店', kind: 'shop', cat: 'shop', desc: '游客饿了会来买', sells: 'food',
    w: 1, h: 1, cost: 350, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 4.5, excitement: 0, intensity: 0, nausea: 8, build: (r, m) => buildStall(r, m, '堡'),
  },
  {
    id: 'drinks', name: '饮料店', kind: 'shop', cat: 'shop', desc: '解渴饮料', sells: 'drink',
    w: 1, h: 1, cost: 320, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 3, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, '饮'),
  },
  {
    id: 'balloon', name: '纪念品店', kind: 'shop', cat: 'shop', desc: '气球与纪念品,提升开心度', sells: 'joy',
    w: 1, h: 1, cost: 300, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 4.5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, '念'),
  },
  {
    id: 'coffee', name: '咖啡店', kind: 'shop', cat: 'shop', desc: '提神又开心', sells: 'coffee',
    w: 1, h: 1, cost: 380, upkeep: 15, capacity: 3, duration: 2.5,
    basePrice: 4, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, '咖'),
  },
  {
    id: 'toilet', name: '厕所', kind: 'shop', cat: 'shop', desc: '游客内急必来', sells: 'toilet',
    w: 1, h: 1, cost: 320, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 1.5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, '厕'),
  },
  {
    id: 'umbrella', name: '伞具店', kind: 'shop', cat: 'shop', desc: '下雨天热卖', sells: 'umbrella',
    w: 1, h: 1, cost: 340, upkeep: 12, capacity: 3, duration: 2.5,
    basePrice: 5, excitement: 0, intensity: 0, nausea: 0, build: (r, m) => buildStall(r, m, '伞'),
  },
  {
    id: 'haunted', name: '鬼屋', kind: 'flat', cat: 'ride', desc: '阴森小屋,尖叫连连', indoor: true,
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
  {
    id: 'slide', name: '螺旋滑梯', kind: 'flat', cat: 'ride', desc: '爬上高塔,盘旋滑下',
    w: 3, h: 3, cost: 800, upkeep: 30, capacity: 10, duration: 9,
    basePrice: 2.5, excitement: 36, intensity: 26, nausea: 12, build: buildSlide,
  },
  {
    id: 'teacups', name: '旋转茶杯', kind: 'flat', cat: 'ride', desc: '公转自转,优雅眩晕',
    w: 3, h: 3, cost: 950, upkeep: 32, capacity: 12, duration: 12,
    basePrice: 3, excitement: 42, intensity: 32, nausea: 28, build: buildTeacups,
  },
  {
    id: 'chairs', name: '飞天秋千', kind: 'flat', cat: 'ride', desc: '吊椅飞旋,凌空兜风',
    w: 3, h: 3, cost: 1300, upkeep: 42, capacity: 16, duration: 14,
    basePrice: 3.5, excitement: 48, intensity: 42, nausea: 32, build: buildChairs,
  },
  {
    id: 'droptower', name: '跳楼机', kind: 'flat', cat: 'ride', desc: '一坠到底,心跳骤停',
    w: 2, h: 2, cost: 1800, upkeep: 60, capacity: 8, duration: 10,
    basePrice: 4.5, excitement: 60, intensity: 68, nausea: 26, build: buildDropTower,
  },
  {
    id: 'frisbee', name: '大摆锤', kind: 'flat', cat: 'ride', desc: '摆到天际还自转',
    w: 4, h: 2, cost: 1900, upkeep: 62, capacity: 16, duration: 15,
    basePrice: 4.5, excitement: 62, intensity: 66, nausea: 45, build: buildFrisbee,
  },
  {
    id: 'topspin', name: '太空梭', kind: 'flat', cat: 'ride', desc: '整排翻转,天旋地转',
    w: 4, h: 2, cost: 1700, upkeep: 58, capacity: 8, duration: 13,
    basePrice: 4, excitement: 58, intensity: 64, nausea: 48, build: buildTopspin,
  },
  {
    id: 'cablecar', name: '观光缆车', kind: 'cable', cat: 'ride', desc: '两点一线,吊舱往返',
    w: 1, h: 1, cost: 1200, upkeep: 50, capacity: 8, duration: 0,
    basePrice: 3, excitement: 35, intensity: 12, nausea: 5, build: buildCableCar,
  },
  {
    id: 'boats', name: '脚踏船', kind: 'boats', cat: 'ride', desc: '码头出发,湖上泛舟',
    w: 1, h: 1, cost: 900, upkeep: 35, capacity: 16, duration: 25,
    basePrice: 3, excitement: 38, intensity: 15, nausea: 6, build: buildBoats,
  },
  {
    id: 'maze', name: '迷宫', kind: 'flat', cat: 'ride', desc: '绿篱迷宫,进去转一圈',
    w: 4, h: 4, cost: 700, upkeep: 25, capacity: 12, duration: 20,
    basePrice: 2.5, excitement: 34, intensity: 12, nausea: 5, build: buildMaze,
  },
  {
    id: 'golf', name: '迷你高尔夫', kind: 'flat', cat: 'ride', desc: '三洞轻推,老少皆宜',
    w: 3, h: 3, cost: 1100, upkeep: 35, capacity: 9, duration: 16,
    basePrice: 3.5, excitement: 44, intensity: 16, nausea: 4, build: buildGolf,
  },
];
export const DEF_BY_ID = Object.fromEntries(RIDE_DEFS.map(d => [d.id, d]));

// ---------------- 低多边形构建 ----------------
import { meshOf, SLOT_MAIN, SLOT_SUB, DEFAULT_PAINT, paintSlots } from '../render/paintSlots.js';

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
  stat.frustum(cx, 2.0, cz, 2.8, 0.12, 1.15, SLOT_MAIN, 1, 10);         // 顶篷(红)
  stat.frustum(cx, 1.95, cz, 2.9, 2.85, 0.14, 0xf0e0b0, 1, 10);        // 顶篷檐
  stat.post(cx, 3.0, cz, 0.14, 0.5, SLOT_SUB, 1);                       // 顶饰
  stat.blob(cx, 3.6, cz, 0.25, SLOT_SUB, 1.1);
  g.add(meshOf(stat, mat, ride));
  // 旋转部分(枢轴放在盘面中心转,几何绕原点构建,否则旋转会飞出基座)
  const spin = new THREE.Group();
  spin.position.set(cx, 0, cz);
  const dyn = new GeomBuilder();
  dyn.frustum(0, 0.28, 0, 2.3, 2.3, 0.14, 0xf0e8d8, 1, 10);           // 台面
  dyn.post(0, 0.28, 0, 0.2, 2.2, SLOT_SUB, 1);                        // 中柱
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const px = Math.cos(a) * 1.55, pz = Math.sin(a) * 1.55;
    dyn.post(px, 0.42, pz, 0.045, 1.5, 0xc8c8d0, 1);                    // 马杆
    const col = [0xffffff, 0xd84a3a, 0x3a7ad8, SLOT_SUB][i % 4];
    dyn.box(px, 0.72, pz, 0.5, 0.3, 0.26, col, 1);                      // 木马
    dyn.box(px, 0.92, pz + 0.16, 0.18, 0.2, 0.18, col, 1.05);
  }
  spin.add(meshOf(dyn, mat, ride));
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
  stat.bar([cx - 0.5, 0, cz - 0.6], [cx - 0.12, cy, cz], 0.14, 0.14, SLOT_SUB, 1);
  stat.bar([cx + 0.5, 0, cz - 0.6], [cx + 0.12, cy, cz], 0.14, 0.14, SLOT_SUB, 1);
  stat.bar([cx - 0.5, 0, cz + 0.6], [cx - 0.12, cy, cz], 0.14, 0.14, SLOT_SUB, 1);
  stat.bar([cx + 0.5, 0, cz + 0.6], [cx + 0.12, cy, cz], 0.14, 0.14, SLOT_SUB, 1);
  g.add(meshOf(stat, mat, ride));
  // 轮
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(cx, cy, cz);
  const wb = new GeomBuilder();
  const SEG = 10;
  for (let i = 0; i < SEG; i++) {
    const a0 = i / SEG * Math.PI * 2, a1 = (i + 1) / SEG * Math.PI * 2;
    wb.bar([Math.cos(a0) * R, Math.sin(a0) * R, 0], [Math.cos(a1) * R, Math.sin(a1) * R, 0], 0.12, 0.1, SLOT_MAIN, 1);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    wb.bar([0, 0, 0], [Math.cos(a) * R, Math.sin(a) * R, 0], 0.07, 0.07, SLOT_SUB, 0.9);
  }
  wb.post(0, -0.15, 0, 0.16, 0.3, 0x8a8d8f, 1);
  wheelGroup.add(meshOf(wb, mat, ride));
  // 座舱(Ref,每帧跟随)
  const cabins = [];
  const cabinCols = [0xd84a3a, SLOT_MAIN, 0x3a7ad8, 0x48b050, 0xc86ad8, 0xe87a30, 0xd84a3a, 0x3aa8a0];
  for (let i = 0; i < 8; i++) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42),
      new THREE.MeshLambertMaterial({ color: cabinCols[i] }));
    cm.userData.carBody = true; cm.userData.carCol = cabinCols[i];
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
  g.add(meshOf(stat, mat, ride));
  const spin = new THREE.Group();
  spin.position.set(cx, 0.22, cz);
  const db = new GeomBuilder();
  db.post(0, 0, 0, 0.28, 0.85, SLOT_MAIN, 1);
  db.blob(0, 1.05, 0, 0.4, 0xe8b830, 1.05);
  spin.add(meshOf(db, mat, ride));
  const arms = [];
  const armCols = [0x3a7ad8, 0xe8b830, 0x48b050, 0xc86ad8];
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const ab = new GeomBuilder();
    ab.box(1.1, 0.55, 0, 2.2, 0.16, 0.16, SLOT_SUB, 1);
    arm.add(meshOf(ab, mat, ride));
    const carM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshLambertMaterial({ color: armCols[i] }));
    carM.userData.carBody = true; carM.userData.carCol = armCols[i];
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

function buildStall(ride, mat) {

  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 0.5 * TILE, cz = 0.5 * TILE;
  b.box(cx, 0.55, cz, 1.5, 1.1, 1.3, SLOT_SUB, 1);
  b.box(cx, 0.85, cz + 0.66, 1.1, 0.45, 0.05, 0x2a3038, 1);        // 柜台窗口
  b.box(cx, 1.3, cz, 1.8, 0.28, 1.6, SLOT_MAIN, 1);                   // 平顶
  b.frustum(cx, 1.42, cz, 1.1, 0.12, 0.55, SLOT_MAIN, 1, 4);          // 尖顶
  b.post(cx, 1.95, cz, 0.04, 0.35, 0x50535a, 1);                    // 旗杆
  b.tri([cx, 2.28, cz], [cx + 0.34, 2.2, cz], [cx, 2.12, cz], [[0, 0], [0, 0], [0, 0]], 0xe8b830, 1.1); // 小旗
  g.add(meshOf(b, mat, ride));
  return { group: g, update: () => {} };
}


// 鬼屋:阴森立面 + 旋转幽灵
function buildHaunted(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  b.box(cx, 1.15, cz + 0.5, 4.6, 2.3, 3.2, SLOT_MAIN, 1);
  b.frustum(cx, 2.3, cz + 0.5, 3.1, 0.9, 1.5, 0x22201f, 1, 4);
  b.frustum(cx - 1.8, 2.3, cz + 0.9, 0.75, 0.15, 2.6, 0x22201f, 1, 4);
  b.frustum(cx + 1.8, 2.3, cz + 0.9, 0.75, 0.15, 2.6, 0x22201f, 1, 4);
  b.box(cx - 1.8, 5.0, cz + 0.9, 0.35, 0.35, 0.35, 0xc05050, 1.25);
  b.box(cx + 1.8, 5.0, cz + 0.9, 0.35, 0.35, 0.35, 0xc05050, 1.25);
  b.box(cx, 0.9, cz + 2.05, 1.1, 1.7, 0.2, 0x1a1418, 1);
  for (const wx of [-1.55, -0.6, 0.6, 1.55]) {
    b.box(cx + wx, 1.3, cz + 2.0, 0.45, 0.6, 0.08, SLOT_SUB, 1.2);
  }
  g.add(meshOf(b, mat, ride));
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
  b.box(cx, 0.12, cz, 6.4, 0.24, 6.4, SLOT_SUB, 1);
  for (let i = 0; i < 4; i++) {
    b.post(cx - 2.9 + i * 1.95, 0.3, cz - 2.9, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx - 2.9 + i * 1.95, 0.3, cz + 2.9, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx - 2.9, 0.3, cz - 2.9 + i * 1.95, 0.07, 2.3, 0xc8a830, 1);
    b.post(cx + 2.9, 0.3, cz - 2.9 + i * 1.95, 0.07, 2.3, 0xc8a830, 1);
  }
  b.box(cx, 2.65, cz, 6.9, 0.18, 6.9, SLOT_MAIN, 0.95);
  g.add(meshOf(b, mat, ride));
  const cars = [];
  const cols = [0xd84a3a, 0x3a7ad8, 0x48b050, 0xe8b830, 0xc86ad8, 0xe87a30];
  for (let i = 0; i < 6; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 1.0), new THREE.MeshLambertMaterial({ color: cols[i] }));
    car.userData.carBody = true; car.userData.carCol = cols[i];
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
  b.bar([cx - 2.4, 0, cz - 0.8], [cx - 0.25, topY, cz], 0.18, 0.18, SLOT_SUB, 1);
  b.bar([cx + 2.4, 0, cz - 0.8], [cx + 0.25, topY, cz], 0.18, 0.18, SLOT_SUB, 1);
  b.bar([cx - 2.4, 0, cz + 0.8], [cx - 0.25, topY, cz], 0.18, 0.18, SLOT_SUB, 1);
  b.bar([cx + 2.4, 0, cz + 0.8], [cx + 0.25, topY, cz], 0.18, 0.18, SLOT_SUB, 1);
  b.bar([cx - 0.5, topY, cz], [cx + 0.5, topY, cz], 0.2, 0.2, SLOT_SUB, 1);
  b.box(cx - 2.5, 0.15, cz, 0.5, 0.3, 2.2, 0xd8d0c0, 1);
  b.box(cx + 2.5, 0.15, cz, 0.5, 0.3, 2.2, 0xd8d0c0, 1);
  g.add(meshOf(b, mat, ride));
  const ship = new THREE.Group();
  const sb = new GeomBuilder();
  sb.box(0, -1.5, 0, 3.0, 0.6, 0.9, SLOT_MAIN, 1);
  sb.frustum(0, -1.05, 0, 1.85, 1.6, 0.35, 0xd8b830, 1, 4);
  sb.box(-1.65, -1.3, 0, 0.45, 0.85, 0.7, SLOT_MAIN, 1);
  sb.box(1.65, -1.3, 0, 0.45, 0.85, 0.7, SLOT_MAIN, 1);
  sb.post(0, -1.9, 0, 0.06, 2.5, 0xd8d0c0, 1);
  sb.tri([0, 0.6, 0], [0.7, 0.35, 0], [0, 0.12, 0], [[0, 0], [0, 0], [0, 0]], 0x303038, 1);
  ship.add(meshOf(sb, mat, ride));
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
  b.frustum(cx, 0.4, cz, 0.55, 0.24, 10.5, SLOT_MAIN, 1, 8);
  b.box(cx, 10.9, cz, 0.9, 0.7, 0.9, SLOT_SUB, 1);
  b.blob(cx, 11.5, cz, 0.3, 0xe8b830, 1.15);
  g.add(meshOf(b, mat, ride));
  const cabin = new THREE.Group();
  const cb = new GeomBuilder();
  cb.frustum(0, 0, 0, 1.05, 0.95, 0.55, SLOT_SUB, 1, 8);
  cb.frustum(0, 0.55, 0, 0.8, 0.75, 0.3, 0xe8e8f0, 1, 8);
  cabin.add(meshOf(cb, mat, ride));
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
// 螺旋滑梯:中心塔 + 螺旋滑道,游客盘旋滑下
function buildSlide(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  const TURNS = 1.5;
  b.frustum(cx, 0, cz, 0.9, 0.7, 5.2, SLOT_MAIN, 1, 8);           // 塔身
  b.blob(cx, 5.4, cz, 0.5, 0xd84a3a, 1.1);                        // 顶球
  const SEGS = 18;
  for (let i = 0; i < SEGS; i++) {                                 // 滑道(绕塔 1.5 圈)
    const a0 = i / SEGS * TURNS * Math.PI * 2, a1 = (i + 1) / SEGS * TURNS * Math.PI * 2;
    const y0 = 4.6 - i / SEGS * 4.2, y1 = 4.6 - (i + 1) / SEGS * 4.2;
    b.bar([cx + Math.cos(a0) * 1.3, y0, cz + Math.sin(a0) * 1.3],
      [cx + Math.cos(a1) * 1.3, y1, cz + Math.sin(a1) * 1.3], 0.5, 0.12, SLOT_SUB, 1);
  }
  g.add(meshOf(b, mat, ride));
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => { t += dt * (0.3 + rd.animSpeed * 0.7); },
    // 游客落点:各自相位沿滑道下滑
    riderPos(i, out) {
      const ph = (t * 0.28 + i * 0.13) % 1;
      const a = ph * TURNS * Math.PI * 2;
      out.x = cx + Math.cos(a) * 1.3; out.y = 4.6 - ph * 4.2 + 0.2; out.z = cz + Math.sin(a) * 1.3;
    },
  };
}

// 旋转茶杯:公转底盘 + 自转茶杯
function buildTeacups(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  b.frustum(cx, 0, cz, 2.6, 2.5, 0.22, SLOT_MAIN, 1, 10);          // 底盘
  g.add(meshOf(b, mat, ride));
  const spin = new THREE.Group();
  spin.position.set(cx, 0.22, cz);
  const db = new GeomBuilder();
  db.post(0, 0, 0, 0.3, 0.6, SLOT_SUB, 1);
  spin.add(meshOf(db, mat, ride));
  const cups = [];
  const cupCols = [0xd84a3a, 0x3a7ad8, 0x48b050, 0xc86ad8];
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Group();
    const cb = new GeomBuilder();
    cb.frustum(0, 0, 0, 0.42, 0.5, 0.5, cupCols[i], 1, 8);        // 杯体
    cup.add(meshOf(cb, mat, ride));
    cup.position.set(Math.cos(i / 4 * Math.PI * 2) * 1.4, 0, Math.sin(i / 4 * Math.PI * 2) * 1.4);
    spin.add(cup);
    cups.push(cup);
  }
  g.add(spin);
  return {
    group: g,
    update: (dt, rd) => {
      spin.rotation.y += dt * rd.animSpeed * 1.4;
      for (const cup of cups) cup.rotation.y -= dt * rd.animSpeed * 2.2;
    },
    // 游客落点:杯内,随公转
    riderPos(i, out) {
      const th = spin.rotation.y;
      const lx = Math.cos((i % 4) * Math.PI / 2) * 1.4, lz = Math.sin((i % 4) * Math.PI / 2) * 1.4;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + lx * ca + lz * sa + ((i >> 2) - 1) * 0.12; out.y = 0.57; out.z = cz - lx * sa + lz * ca;
    },
  };
}

// 飞天秋千:立柱 + 旋转顶盖 + 吊椅
function buildChairs(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  b.frustum(cx, 0, cz, 1.0, 0.8, 0.25, 0xd8d0c0, 1, 8);
  b.frustum(cx, 0.2, cz, 0.45, 0.3, 3.4, SLOT_SUB, 1, 8);         // 立柱
  g.add(meshOf(b, mat, ride));
  const top = new THREE.Group();
  top.position.set(cx, 3.6, cz);
  const tb = new GeomBuilder();
  tb.frustum(0, 0, 0, 1.5, 1.1, 0.3, SLOT_MAIN, 1, 10);            // 顶盖
  top.add(meshOf(tb, mat, ride));
  for (let i = 0; i < 8; i++) {
    const seat = new THREE.Group();
    const sb = new GeomBuilder();
    sb.post(0, -1.3, 0, 0.03, 1.3, 0x8a8d8f, 1);                   // 吊索
    sb.box(0, -1.55, 0, 0.4, 0.28, 0.4, [0xe8b830, 0x3a7ad8, 0x48b050, 0xc86ad8][i % 4], 1);
    seat.add(meshOf(sb, mat, ride));
    seat.position.set(Math.cos(i / 8 * Math.PI * 2) * 1.25, 0, Math.sin(i / 8 * Math.PI * 2) * 1.25);
    top.add(seat);
  }
  g.add(top);
  return {
    group: g,
    update: (dt, rd) => { top.rotation.y += dt * rd.animSpeed * 1.6; },
    // 游客落点:吊椅内,随顶盖转
    riderPos(i, out) {
      const th = top.rotation.y;
      const lx = Math.cos(i / 8 * Math.PI * 2) * 1.25, lz = Math.sin(i / 8 * Math.PI * 2) * 1.25;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + lx * ca + lz * sa; out.y = 2.1; out.z = cz - lx * sa + lz * ca;
    },
  };
}

// 跳楼机:高塔 + 速升速降环舱
function buildDropTower(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1 * TILE, cz = 1 * TILE;
  b.frustum(cx, 0, cz, 1.4, 1.2, 0.4, 0xc8c8d0, 1, 8);
  b.frustum(cx, 0.3, cz, 0.5, 0.22, 12, SLOT_MAIN, 1, 8);          // 塔身
  b.blob(cx, 12.5, cz, 0.35, 0xe8b830, 1.1);
  g.add(meshOf(b, mat, ride));
  const gon = new THREE.Group();
  const gb = new GeomBuilder();
  gb.frustum(0, 0, 0, 0.95, 0.85, 0.4, SLOT_SUB, 1, 8);           // 环形座舱
  gon.add(meshOf(gb, mat, ride));
  gon.position.set(cx, 1, cz);
  g.add(gon);
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      const ph = t % 7;
      let y;
      if (ph < 3.5) y = 1 + (ph / 3.5) * 9;                        // 慢升
      else if (ph < 4.0) { const k = (ph - 3.5) / 0.5; y = 10 - k * k * 9; }   // 速降
      else y = 1 + Math.abs(Math.sin((ph - 4) * 6)) * 0.4 * Math.max(0, 5 - ph); // 余震
      gon.position.y = y;
    },
    // 游客落点:环舱一圈,随舱升降
    riderPos(i, out) {
      const a = i / 8 * Math.PI * 2;
      out.x = cx + Math.cos(a) * 0.68; out.y = gon.position.y + 0.35; out.z = cz + Math.sin(a) * 0.68;
    },
  };
}

// 大摆锤:门架 + 摆动臂 + 自转圆盘
function buildFrisbee(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 2 * TILE, cz = 1 * TILE, topY = 4.4;
  b.bar([cx - 2.2, 0, cz], [cx - 0.2, topY, cz], 0.2, 0.2, SLOT_MAIN, 1);
  b.bar([cx + 2.2, 0, cz], [cx + 0.2, topY, cz], 0.2, 0.2, SLOT_MAIN, 1);
  b.box(cx - 2.3, 0.15, cz, 0.6, 0.3, 1.6, 0xd8d0c0, 1);
  b.box(cx + 2.3, 0.15, cz, 0.6, 0.3, 1.6, 0xd8d0c0, 1);
  g.add(meshOf(b, mat, ride));
  const arm = new THREE.Group();
  arm.position.set(cx, topY, cz);
  const ab = new GeomBuilder();
  ab.post(0, -3.4, 0, 0.14, 3.4, 0xe8b830, 1);                     // 摆臂
  arm.add(meshOf(ab, mat, ride));
  const disc = new THREE.Group();
  disc.position.set(0, -3.6, 0);
  const dbb = new GeomBuilder();
  dbb.frustum(0, 0, 0, 1.15, 1.05, 0.3, SLOT_SUB, 1, 10);         // 圆盘座舱
  disc.add(meshOf(dbb, mat, ride));
  arm.add(disc);
  g.add(arm);
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      const amp = Math.min(1.25, 0.2 + rd.animSpeed * 1.05);
      arm.rotation.z = Math.sin(t * 1.5) * amp;
      disc.rotation.y += dt * rd.animSpeed * 3;
    },
    // 游客落点:盘沿一圈,随摆臂摆动(绕 z 轴)
    riderPos(i, out) {
      const th = arm.rotation.z;
      const a = i / 8 * Math.PI * 2 + disc.rotation.y;
      const lx = Math.cos(a) * 0.85, ly = -3.6, lz = Math.sin(a) * 0.85;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + lx * ca - ly * sa; out.y = topY + lx * sa + ly * ca + 0.25; out.z = cz + lz;
    },
  };
}

// 太空梭:双柱 + 整排翻转座舱
function buildTopspin(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 2 * TILE, cz = 1 * TILE, topY = 3.9;
  for (const sx of [-2.4, 2.4]) {
    b.post(cx + sx, 0, cz, 0.16, topY, SLOT_MAIN, 1);
    b.box(cx + sx, 0.15, cz, 0.5, 0.3, 1.4, 0xd8d0c0, 1);
  }
  b.bar([cx - 2.4, topY, cz], [cx + 2.4, topY, cz], 0.16, 0.16, SLOT_MAIN, 1);
  g.add(meshOf(b, mat, ride));
  const row = new THREE.Group();
  row.position.set(cx, topY, cz);
  const rb = new GeomBuilder();
  rb.box(0, -0.9, 0, 2.6, 0.5, 0.6, SLOT_SUB, 1);                  // 横排座舱
  rb.box(0, -0.55, -0.28, 2.6, 0.5, 0.08, 0x8a4ad8, 1);            // 靠背
  row.add(meshOf(rb, mat, ride));
  g.add(row);
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => {
      t += dt * rd.animSpeed;
      row.rotation.x = Math.sin(t * 0.9) * Math.PI * Math.min(1, rd.animSpeed + 0.2);   // 整排翻转
    },
    // 游客落点:横排座位,随排翻转(绕 x 轴)
    riderPos(i, out) {
      const th = row.rotation.x;
      const lx = -1.05 + (i % 8) * 0.3, ly = -0.7;
      const ca = Math.cos(th), sa = Math.sin(th);
      out.x = cx + lx; out.y = topY + ly * ca; out.z = cz + ly * sa;
    },
  };
}

// 迷宫:绿篱迷宫(Π 形内墙),游客沿蛇形路径穿行
function buildMaze(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const hedge = (x0, z0, x1, z1) => b.bar([x0, 0.45, z0], [x1, 0.45, z1], 0.34, 0.9, SLOT_MAIN, 1);
  // 外墙(南侧留入口)+ Π 形内墙
  hedge(0.4, 0.4, 7.6, 0.4); hedge(0.4, 7.6, 0.4, 0.4); hedge(7.6, 0.4, 7.6, 7.6);
  hedge(0.4, 7.6, 4.8, 7.6); hedge(6.0, 7.6, 7.6, 7.6);
  hedge(2.6, 2.2, 2.6, 6.0); hedge(5.2, 2.2, 5.2, 6.0); hedge(2.6, 2.2, 5.2, 2.2);
  g.add(meshOf(b, mat, ride));
  // 蛇形参观路径(绕内墙一圈,闭口回入口)
  const WP = [[5.9, 8.2], [5.9, 6.8], [1.3, 6.8], [1.3, 1.3], [6.7, 1.3], [6.7, 6.8], [5.9, 6.8]];
  const segs = [];
  let total = 0;
  for (let i = 0; i < WP.length - 1; i++) {
    const l = Math.hypot(WP[i + 1][0] - WP[i][0], WP[i + 1][1] - WP[i][1]);
    segs.push({ a: WP[i], b: WP[i + 1], l, acc: total });
    total += l;
  }
  let t = 0;
  const posAt = (u, out) => {
    u = ((u % total) + total) % total;
    for (const s of segs) {
      if (u <= s.acc + s.l) {
        const k = (u - s.acc) / s.l;
        out.x = s.a[0] + (s.b[0] - s.a[0]) * k; out.z = s.a[1] + (s.b[1] - s.a[1]) * k;
        return;
      }
    }
    out.x = WP[0][0]; out.z = WP[0][1];
  };
  return {
    group: g,
    update: (dt, rd) => { t += dt * (0.3 + rd.animSpeed * 0.7); },
    // 游客落点:沿迷宫路径缓行
    riderPos(i, out) {
      posAt(t * 1.1 + i * (total / 12), out);
      out.y = 0.05;
    },
  };
}

// 迷你高尔夫:果岭 + 三洞,游客轮流推杆
function buildGolf(ride, mat) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = 1.5 * TILE, cz = 1.5 * TILE;
  b.box(cx, 0.07, cz, 5.6, 0.14, 5.6, SLOT_MAIN, 1);                  // 果岭
  const holes = [[cx - 1.6, cz - 1.6], [cx + 1.6, cz - 1.4], [cx, cz + 1.8]];
  holes.forEach(([hx, hz], i) => {
    b.blob(hx, 0.15, hz, 0.14, 0x141810, 0.9);                        // 洞
    b.post(hx + 0.25, 0.14, hz, 0.02, 0.9, 0xd8d8d8, 1);              // 旗杆
    b.tri([hx + 0.25, 1.02, hz], [hx + 0.62, 0.88, hz], [hx + 0.25, 0.76, hz],
      [[0, 0], [1, 0], [0, 1]], [0xd84a3a, 0x3a7ad8, 0xe8b830][i], 1); // 旗面
  });
  g.add(meshOf(b, mat, ride));
  let t = 0;
  return {
    group: g,
    update: (dt, rd) => { t += dt * (0.3 + rd.animSpeed * 0.7); },
    // 游客落点:分布在洞口推杆,周期性换洞
    riderPos(i, out) {
      const h = holes[(i + Math.floor(t / 5)) % 3];
      out.x = h[0] + ((i % 3) - 1) * 0.3; out.y = 0.14; out.z = h[1] + 0.35;
    },
  };
}

// 观光缆车:两站台 + 索道 + 往返吊舱(连续运转;上下客复用 _updateCoaster/trainStop)
function buildCableCar(ride, mat, game) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const [bx, by] = ride.cableB;
  // 组内局部坐标(原点 = 站台 A 锚点)
  const cA = { x: TILE / 2, y: 0, z: TILE / 2 };
  const cB = { x: (bx - ride.x) * TILE + TILE / 2, y: ride.baseYB - ride.baseY, z: (by - ride.y) * TILE + TILE / 2 };
  const topA = cA.y + 3.6, topB = cB.y + 3.6;
  for (const c of [cA, cB]) {
    b.box(c.x, c.y + 0.06, c.z, TILE * 0.9, 0.14, TILE * 0.9, SLOT_SUB, 1);      // 站台铺面
    b.post(c.x, c.y, c.z, 0.16, 3.6, SLOT_MAIN, 1);                               // 主塔
    b.bar([c.x - 0.7, c.y + 3.5, c.z], [c.x + 0.7, c.y + 3.5, c.z], 0.12, 0.12, SLOT_MAIN, 1);  // 横臂
  }
  // 双缆
  b.bar([cA.x, topA, cA.z - 0.3], [cB.x, topB, cB.z - 0.3], 0.05, 0.05, 0x303038, 1);
  b.bar([cA.x, topA, cA.z + 0.3], [cB.x, topB, cB.z + 0.3], 0.05, 0.05, 0x303038, 1);
  g.add(meshOf(b, mat, ride));
  const cabins = [];
  const cabCols = [0xd84a3a, 0xe8b830, 0x48b050, 0x3a7ad8];
  for (let i = 0; i < 4; i++) {
    const cab = new THREE.Group();
    const cb = new GeomBuilder();
    cb.post(0, -0.8, 0, 0.04, 0.8, 0x8a8d8f, 1);                                 // 吊臂
    cb.box(0, -1.25, 0, 0.7, 0.6, 0.7, cabCols[i], 1);                           // 舱体
    cab.add(meshOf(cb, mat, ride));
    g.add(cab);
    cabins.push(cab);
  }
  const len = Math.hypot(cB.x - cA.x, cB.z - cA.z);
  const state = { s: 0, v: 0, mode: 'load', timer: 0, stationIdx: 0, dir: 1 };
  let external = null;
  let cabT = 0;
  const poseCabins = (u) => {
    cabins.forEach((cab, k) => {
      let t2 = (u + k / 4) % 2;
      if (t2 > 1) t2 = 2 - t2;   // 三角波往返
      cab.position.set(cA.x + (cB.x - cA.x) * t2, topA + (topB - topA) * t2, cA.z + (cB.z - cA.z) * t2);
    });
  };
  return {
    group: g,
    state,
    setExternal: (t, mode, dir, stationIdx) => { external = { t, mode, dir, stationIdx }; },
    serialize: () => ({ s: state.s, mode: state.mode, dir: state.dir, stationIdx: state.stationIdx }),
    restore: (d) => { if (d) { state.s = d.s || 0; state.mode = d.mode || 'load'; state.dir = d.dir || 1; state.stationIdx = d.stationIdx || 0; } },
    update: (dt, rd) => {
      cabT += dt * (0.3 + rd.animSpeed * 0.7) * 0.14;   // 吊舱连续往返
      poseCabins(cabT);
      if (external) {
        state.s = external.t; state.mode = external.mode; state.dir = external.dir; state.stationIdx = external.stationIdx;
        return;
      }
      if (state.mode === 'load') {
        state.timer -= dt;
        if (state.timer <= 0 && (rd.status === 'open' || rd.status === 'test')) {
          if (rd.riders.length > 0 || rd.status === 'test') state.mode = 'run';
          else state.timer = 0.5;
        }
      } else {
        state.s += dt * 2.2 / Math.max(1, len);          // 2.2 匀速
        if (state.s >= 1) {
          state.s = 0;
          state.stationIdx = state.dir > 0 ? 1 : 0;
          state.dir *= -1;
          state.mode = 'load';
          state.timer = rd.status === 'open' ? 3.2 : 2.0;
          game?.rides.trainStop(rd, state.stationIdx);   // 到站下车
        }
      }
    },
    // 游客落点:吊舱内(每舱 2 人)
    riderPos(i, out) {
      const cab = cabins[i % 4];
      out.x = cab.position.x + (i & 1 ? 0.14 : -0.14);
      out.y = cab.position.y - 1.05;
      out.z = cab.position.z;
    },
  };
}

// 脚踏船:木码头 + 小船湖上漫游(到点返航下客)
function buildBoats(ride, mat, game) {
  const g = new THREE.Group();
  const b = new GeomBuilder();
  const cx = TILE / 2, cz = TILE / 2;
  b.box(cx, 0.08, cz, TILE * 0.9, 0.16, TILE * 0.9, SLOT_SUB, 1);      // 木码头
  b.post(cx - 0.7, 0.1, cz - 0.7, 0.08, 1.0, 0x6d4522, 1);
  b.post(cx + 0.7, 0.1, cz - 0.7, 0.08, 1.0, 0x6d4522, 1);
  b.box(cx, 1.1, cz - 0.7, 1.7, 0.1, 0.5, SLOT_MAIN, 1);                // 小棚
  g.add(meshOf(b, mat, ride));
  const w = game.world;
  const WATER_Y = WATER_H * H_UNIT + 0.05;
  // 船(真实网格,4 艘)
  const boats = [];
  const boatCols = [0xd84a3a, 0x3a7ad8, 0x48b050, 0xe8b830];
  for (let i = 0; i < 4; i++) {
    const bb = new GeomBuilder();
    bb.box(0, 0.12, 0, 0.7, 0.24, 1.3, boatCols[i], 1);   // 船身
    bb.box(0, 0.3, -0.2, 0.6, 0.12, 0.5, 0xd8d0c0, 1);    // 座位
    const mesh = meshOf(bb, mat, ride);
    g.add(mesh);
    boats.push({ mesh, tile: null, prev: null, target: null, state: 'dock', riders: [], tripT: 0 });
  }
  // 泊船位:码头邻接的第一个水格
  let home = null;
  for (let d = 0; d < 4 && !home; d++) {
    const [nx, ny] = w.neighbor(ride.x, ride.y, d);
    if (w.in(nx, ny) && w.minH(nx, ny) < WATER_H) home = [nx, ny];
  }
  if (!home) home = [ride.x, ride.y];   // 兜底(校验已保证邻水)
  const groupAbs = { x: World.tileToWorldX(ride.x), z: World.tileToWorldZ(ride.y) };   // group 位于锚点
  for (const bt of boats) {
    bt.tile = home.slice();
    const c = w.tileCenter(home[0], home[1]);
    bt.x = c.x + (Math.random() - 0.5) * 0.5; bt.z = c.z + (Math.random() - 0.5) * 0.5;
    bt.mesh.position.set(bt.x - groupAbs.x, WATER_Y - ride.baseY, bt.z - groupAbs.z);   // 组内局部坐标
  }
  const waterNbs = (t) => {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = w.neighbor(t[0], t[1], d);
      if (w.in(nx, ny) && w.minH(nx, ny) < WATER_H) out.push([nx, ny]);
    }
    return out;
  };
  return {
    group: g,
    boats,
    update: (dt, rd) => {
      for (const bt of boats) {
        if (bt.state !== 'roam') continue;
        bt.tripT += dt;
        if (!bt.target) {
          const nbs = waterNbs(bt.tile).filter(t => !(bt.prev && t[0] === bt.prev[0] && t[1] === bt.prev[1]));
          const pool = nbs.length ? nbs : waterNbs(bt.tile);
          if (!pool.length) continue;
          if (bt.tripT > rd.def.duration) {
            // 返航:选离泊船位最近的水格
            let best = pool[0], bestD = 1e9;
            for (const t of pool) {
              const d = Math.abs(t[0] - home[0]) + Math.abs(t[1] - home[1]);
              if (d < bestD) { bestD = d; best = t; }
            }
            bt.target = best;
            if (bt.tripT > rd.def.duration * 2.5) { bt.target = home.slice(); }   // 兜底直线回
          } else {
            bt.target = pool[(Math.random() * pool.length) | 0];
          }
        }
        const c = w.tileCenter(bt.target[0], bt.target[1]);
        const dx2 = c.x - bt.x, dz2 = c.z - bt.z;
        const d = Math.hypot(dx2, dz2);
        if (d < 0.08) {
          bt.prev = bt.tile; bt.tile = bt.target; bt.target = null;
          // 到家 → 靠岸下客
          if (bt.tripT > rd.def.duration && bt.tile[0] === home[0] && bt.tile[1] === home[1]) {
            game.rides.boatDocked(rd, bt);
          }
          continue;
        }
        bt.x += dx2 / d * 1.4 * dt; bt.z += dz2 / d * 1.4 * dt;
        bt.mesh.position.set(bt.x - groupAbs.x, WATER_Y - ride.baseY + Math.sin(bt.tripT * 2) * 0.03, bt.z - groupAbs.z);
        bt.mesh.rotation.y = Math.atan2(dx2, dz2);
      }
    },
    // 游客落点:各自船内(每船 4 人;组内局部坐标)
    riderPos(i, out) {
      const peep = ride.riders[i];
      const bt = boats[peep?._boatIdx ?? 0] || boats[0];
      const k = i % 4;
      out.x = bt.mesh.position.x + (k & 1 ? 0.13 : -0.13);
      out.y = WATER_Y - ride.baseY + 0.2;
      out.z = bt.mesh.position.z + (k > 1 ? 0.28 : -0.28);
    },
  };
}

// 入口/出口小屋(几何以原点为中心,由 mesh.position 放到局部 tile 坐标)
function buildHut(mat, colorHex) {  const b = new GeomBuilder();
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
    this._rng = mulberry32(20240815);   // 故障/尖叫随机(函数):固定种子,联机服务端权威,仿真测试可复现
  }

  defs() { return RIDE_DEFS; }

  // 设施涂装:按部件槽位重写顶点色(主色/副色),车厢跟主色(未涂色保持各自原色)
  applyPaint(ride) {
    if (!ride.group) return;
    ride.group.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.slotMain || o.userData.slotSub) paintSlots(o, ride);
      else if (o.userData.carBody) o.material.color.setHex(ride.paintMain ?? o.userData.carCol);
    });
  }

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
    // 脚踏船:足迹须紧邻水面
    if (def.kind === 'boats') {
      let nearWater = false;
      outer3: for (const [tx, ty] of tiles) {
        for (let d = 0; d < 4; d++) {
          const [nx, ny] = w.neighbor(tx, ty, d);
          if (w.in(nx, ny) && w.minH(nx, ny) < WATER_H) { nearWater = true; break outer3; }
        }
      }
      if (!nearWater) return { ok: false, reason: '码头必须紧邻水面', tiles };
    }
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
    if (ride.cableB) {   // 缆车:站台外邻同步
      ride.stations[which === 'entrance' ? 0 : 1].outer = chk.outer;
      this._syncCableGates(ride);
    }
    // 移动小屋 mesh
    const hut = ride.huts?.[which];
    if (hut) {
      if (ride.custom) {
        hut.position.set(World.tileToWorldX(chk.inner[0]) + TILE / 2, ride.baseY, World.tileToWorldZ(chk.inner[1]) + TILE / 2);
      } else {
        const a = { x: ride.x, y: ride.y };
        hut.position.set((chk.inner[0] - a.x) * TILE + TILE / 2, 0, (chk.inner[1] - a.y) * TILE + TILE / 2);
      }
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

  // ---------- 观光缆车(两点一线) ----------
  canCableStation(x, y) {
    const w = this.game.world;
    if (!w.in(x, y)) return { ok: false, reason: '超出地图' };
    if (!w.ownedAt(x, y)) return { ok: false, reason: '不在公园范围内' };
    if (!w.isClear(x, y)) return { ok: false, reason: '站台位置被占用' };
    if (w.minH(x, y) < WATER_H) return { ok: false, reason: '水下不能建站台' };
    return { ok: true };
  }
  placeCable(x1, y1, x2, y2, forcedId = null, restore = false) {
    const w = this.game.world;
    const def = DEF_BY_ID.cablecar;
    if (!restore) {
      if (!(x1 === x2 || y1 === y2)) return { ok: false, reason: '索道必须是直线(同一行/列)' };
      const dist = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      if (dist < 3 || dist > 26) return { ok: false, reason: '站台间距需在 3~26 格' };
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        const c = this.canCableStation(x, y);
        if (!c.ok) return c;
      }
    }
    const ride = {
      id: forcedId ?? this.nextId++, def, x: x1, y: y1,
      cableB: [x2, y2],
      baseY: w.maxH(x1, y1) * H_UNIT,
      baseYB: w.maxH(x2, y2) * H_UNIT,
      status: 'closed', price: def.basePrice,
      guestsServed: 0, incomeTotal: 0,
      queue: [], riders: [], animSpeed: 0, cycleT: 0, phase: 'idle',
      entrance: { inner: [x1, y1], outer: [x1 - 1, y1], dir: 2 },
      exit: { inner: [x2, y2], outer: [x2 + 1, y2], dir: 0 },
      needGate: true,
      reliability: 94 + (x1 * 7 + y1 * 13) % 5,
      broken: false, breakdownT: 0,
      excitement: def.excitement, intensity: def.intensity, nausea: def.nausea,
      stations: [{ tiles: [[x1, y1]], outer: null }, { tiles: [[x2, y2]], outer: null }],
      queues: null,
    };
    // 站点外邻自动识别(临路格)
    ride.stations.forEach((st, i) => {
      const [tx, ty] = st.tiles[0];
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = w.neighbor(tx, ty, d);
        if (w.in(nx, ny) && w.path[w.idx(nx, ny)] !== PATH.NONE && w.rideTile[w.idx(nx, ny)] === -1) { st.outer = [nx, ny]; break; }
      }
    });
    ride.stations[0].outer = ride.stations[0].outer || ride.entrance.outer;
    ride.stations[1].outer = ride.stations[1].outer || ride.exit.outer;
    this._syncCableGates(ride);
    ride.queues = [ride.queue, []];
    if (forcedId != null) this.nextId = Math.max(this.nextId, forcedId + 1);
    if (!restore) {
      w.rideTile[w.idx(x1, y1)] = ride.id;
      w.rideTile[w.idx(x2, y2)] = ride.id;
    }
    this._buildVisuals(ride);
    this.list.push(ride);
    this.computeQueueCells(ride);
    if (restore) return ride;
    return { ok: true, cost: def.cost, ride };
  }
  _syncCableGates(ride) {   // stations[].outer ↔ entrance/exit ↔ stationGateMap
    ride.entrance.outer = ride.stations[0].outer;
    ride.exit.outer = ride.stations[1].outer;
    ride.stationGateMap = {};
    ride.stations.forEach((st, i) => { if (st.outer) ride.stationGateMap[st.outer.join(',')] = i; });
  }

  // ---------- 定制轨道设施(轨道编辑器) ----------
  canBeginCustom(x, y) {
    const w = this.game.world;
    if (this.list.some(r => r.custom && !r.complete)) return { ok: false, reason: '先完成或拆除在建的过山车' };
    if (!w.in(x, y)) return { ok: false, reason: '超出地图' };
    if (!w.ownedAt(x, y)) return { ok: false, reason: '不在公园范围内' };
    if (!w.isClear(x, y)) return { ok: false, reason: '位置被占用' };
    if (w.minH(x, y) < WATER_H) return { ok: false, reason: '水下不能建造' };
    return { ok: true };
  }
  beginCustom(defId, x, y, dir = 1, forcedId = null) {
    const def = DEF_BY_ID[defId];
    if (!def || !def.custom) return { ok: false, reason: '未知设施' };
    const chk = this.canBeginCustom(x, y);
    if (!chk.ok) return chk;
    const style = TRACK_STYLES[def.style || 'coaster'];
    const w = this.game.world;
    const ride = {
      id: forcedId ?? this.nextId++, def, x, y,
      custom: true, complete: false,
      pieces: [{ t: 'station', x, y, h: 0, dir }],
      baseY: w.maxH(x, y) * H_UNIT,
      status: 'closed', price: def.basePrice,
      guestsServed: 0, incomeTotal: 0,
      queue: [], riders: [], animSpeed: 0, cycleT: 0, phase: 'idle',
      entrance: { inner: [x, y], outer: [x - 1, y], dir: 2 },
      exit: { inner: [x, y], outer: [x + 1, y], dir: 0 },
      needGate: true,
      reliability: 94 + (x * 7 + y * 13) % 5,
      broken: false, breakdownT: 0,
      excitement: def.excitement, intensity: def.intensity, nausea: def.nausea,
    };
    if (forcedId != null) this.nextId = Math.max(this.nextId, forcedId + 1);
    w.rideTile[w.idx(x, y)] = ride.id;
    this._buildVisuals(ride);
    this.list.push(ride);
    this.computeQueueCells(ride);
    this.computeStations(ride);
    return { ok: true, cost: style.stationCost, ride };
  }
  // 定制轨道设施的站点扫描:连续 station 件为一站;为每站找临路的外邻格
  computeStations(ride) {
    if (!ride.custom) return;
    const w = this.game.world;
    const runs = [];
    ride.pieces.forEach((pc, i) => {
      if (pc.t !== 'station') return;
      const last = runs[runs.length - 1];
      if (last && last.end === i - 1) { last.end = i; last.tiles.push([pc.x, pc.y]); }
      else runs.push({ end: i, tiles: [[pc.x, pc.y]] });
    });
    for (const run of runs) {
      run.outer = null;
      outer: for (const [tx, ty] of run.tiles) {
        for (let d = 0; d < 4; d++) {
          const [nx, ny] = w.neighbor(tx, ty, d);
          if (w.in(nx, ny) && w.path[w.idx(nx, ny)] !== PATH.NONE && w.rideTile[w.idx(nx, ny)] === -1) {
            run.outer = [nx, ny];
            break outer;
          }
        }
      }
    }
    ride.stations = runs;
    ride.stationGateMap = {};
    runs.forEach((run, i) => { if (run.outer) ride.stationGateMap[run.outer.join(',')] = i; });
    // 队列数组与站点对齐(保留已有排队游客)
    if (!ride.queues) ride.queues = [ride.queue];
    const n = Math.max(1, runs.length);
    while (ride.queues.length < n) ride.queues.push([]);
    ride.queues.length = n;
    ride.queues[0] = ride.queue;   // 主站队列 = 旧字段,兼容所有既有逻辑
  }
  // 轨道头 = 最后一段的出口(下一段的入口 tile/方向/高度)
  headOf(ride) { return exitOf(ride.pieces[ride.pieces.length - 1]); }
  canAddPiece(ride, type) {
    const w = this.game.world;
    const def = PIECE_BY_ID[type];
    if (!def) return { ok: false, reason: '未知轨道件' };
    if (!ride.custom || ride.complete) return { ok: false, reason: '已建成,不能再加段' };
    const style = TRACK_STYLES[ride.def.style || 'coaster'];
    if (!style.pieces.includes(type)) return { ok: false, reason: '该设施不支持这种轨道件' };
    if (ride.pieces.length >= MAX_PIECES) return { ok: false, reason: '轨道已达长度上限' };
    const e = this.headOf(ride);
    const h = e.h;                                   // 新段入口高度
    const dH = def.dH || 0;
    const hi = Math.max(h, h + dH), lo = Math.min(h, h + dH);
    if (hi > MAX_LEVEL) return { ok: false, reason: '已达最高高度' };
    if (lo < 0) return { ok: false, reason: '不能低于站台层' };
    const x = e.x, y = e.y;
    if (!w.in(x, y)) return { ok: false, reason: '超出地图' };
    if (!w.ownedAt(x, y)) return { ok: false, reason: '不在公园范围内' };
    const trackLoY = ride.baseY + lo * H_UNIT;
    if (trackLoY < w.maxH(x, y) * H_UNIT - 0.05) return { ok: false, reason: '轨道被地形阻挡' };
    for (const pc of ride.pieces) {   // 自交:同 tile 需 2 层净空
      if (pc.x === x && pc.y === y && Math.abs(pc.h - h) < 2) return { ok: false, reason: '与已有轨道冲突' };
    }
    const k = w.idx(x, y);
    if (w.rideTile[k] !== -1) return { ok: false, reason: '位置被占用' };
    if (w.obj[k] !== 0) return { ok: false, reason: '有景物阻挡' };
    if (w.path[k] !== PATH.NONE) {
      const pathTop = Math.max(...w.corners(x, y)) * H_UNIT + 0.05;
      if (trackLoY < pathTop + 1.7) return { ok: false, reason: '净空不足,不能跨越路径' };
    }
    return { ok: true, x, y, h, dir: e.dir };
  }
  addPiece(rideId, type) {
    const ride = this.findRide(rideId);
    if (!ride || !ride.custom) return { ok: false, reason: '设施不存在' };
    const chk = this.canAddPiece(ride, type);
    if (!chk.ok) return chk;
    ride.pieces.push({ t: type, x: chk.x, y: chk.y, h: chk.h, dir: chk.dir });
    const w = this.game.world;
    if (w.rideTile[w.idx(chk.x, chk.y)] === -1) w.rideTile[w.idx(chk.x, chk.y)] = ride.id;
    ride.api?.rebuild?.();
    this.computeStations(ride);
    if (ride.paintMain != null || ride.paintSub != null) this.applyPaint(ride);
    return { ok: true, cost: PIECE_BY_ID[type].cost };
  }
  undoPiece(rideId) {
    const ride = this.findRide(rideId);
    if (!ride || !ride.custom) return { ok: false, reason: '设施不存在' };
    if (ride.complete) return { ok: false, reason: '已建成,不能撤销' };
    if (ride.pieces.length <= 1) return { ok: false, reason: '只剩站台了,放弃请用拆除' };
    const pc = ride.pieces.pop();
    const w = this.game.world;
    if (w.rideTile[w.idx(pc.x, pc.y)] === ride.id) w.rideTile[w.idx(pc.x, pc.y)] = -1;
    ride.api?.rebuild?.();
    this.computeStations(ride);
    if (ride.paintMain != null || ride.paintSub != null) this.applyPaint(ride);
    return { ok: true, cost: -Math.round(PIECE_BY_ID[pc.t].cost * 0.55) };
  }
  finishCustom(rideId) {
    const ride = this.findRide(rideId);
    if (!ride || !ride.custom) return { ok: false, reason: '设施不存在' };
    if (ride.complete) return { ok: false, reason: '已建成' };
    if (!canFinish(ride)) return { ok: false, reason: '轨道还没接回站台,无法闭环' };
    ride.complete = true;
    // 由轨道形态估算属性:落差/弯数/长度(按风格定公式)
    let drops = 0, turns = 0;
    for (const pc of ride.pieces) {
      const d = PIECE_BY_ID[pc.t].dH || 0;
      if (d < 0) drops += -d;
      if (PIECE_BY_ID[pc.t].turn) turns++;
    }
    const len = ride.pieces.length;
    const st = ride.def.style || 'coaster';
    if (st === 'train' || st === 'monorail') {
      ride.excitement = Math.min(66, (st === 'monorail' ? 36 : 30) + turns + Math.floor(len / 6));
      ride.intensity = Math.min(30, (st === 'monorail' ? 20 : 14) + Math.floor(len / 20));
      ride.nausea = st === 'monorail' ? 12 : 8;
    } else if (st === 'flume') {
      ride.excitement = Math.min(82, 45 + drops * 6 + Math.floor(len / 8));
      ride.intensity = Math.min(78, 38 + drops * 7);
      ride.nausea = Math.min(50, 18 + turns);
    } else {
      ride.excitement = Math.min(90, 42 + drops * 5 + turns * 2 + Math.floor(len / 8));
      ride.intensity = Math.min(92, 45 + drops * 6 + Math.floor(len / 10));
      ride.nausea = Math.min(70, 30 + turns * 2);
    }
    ride.api?.rebuild?.();
    this.computeQueueCells(ride);
    this.computeStations(ride);
    if (ride.paintMain != null || ride.paintSub != null) this.applyPaint(ride);
    return { ok: true, cost: 0 };
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
      if (ride.custom) {
        api = buildCustomCoaster(this.game, ride);
        group.position.set(0, 0, 0);   // 采样/小屋均用绝对世界坐标
        ride.huts = {};
        for (const [which, col] of [['entrance', 0x3a7ad8], ['exit', 0x8a5a30]]) {
          const hut = buildHut(this.mat, col);
          const gpos = ride[which];
          hut.position.set(World.tileToWorldX(gpos.inner[0]) + TILE / 2, ride.baseY, World.tileToWorldZ(gpos.inner[1]) + TILE / 2);
          group.add(hut);
          ride.huts[which] = hut;
        }
      } else {
        api = buildCoaster(this.game, ride);
        group.position.set(0, 0, 0);   // 过山车构建用绝对世界坐标
      }
    } else {
      api = def.build(ride, this.mat, this.game);
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
    if (ride.paintMain != null || ride.paintSub != null) this.applyPaint(ride);
  }

  // 读档恢复(不做校验/不改 world 数组——数组来自存档)
  restoreRide(s) {
    const def = DEF_BY_ID[s.defId];
    if (!def) return;
    const w = this.game.world;
    let ride;
    if (s.cableB) {   // 缆车:两站台记录(含出入口)
      ride = this.placeCable(s.x, s.y, s.cableB[0], s.cableB[1], s.id, true);
      Object.assign(ride, {
        status: s.status || 'closed', price: s.price ?? ride.def.basePrice,
        guestsServed: s.guestsServed || 0, incomeTotal: s.incomeTotal || 0,
        reliability: s.reliability ?? 95, broken: !!s.broken,
      });
      if (s.entrance) ride.entrance = s.entrance;
      if (s.exit) ride.exit = s.exit;
      if (s.entrance?.outer) ride.stations[0].outer = s.entrance.outer;
      if (s.exit?.outer) ride.stations[1].outer = s.exit.outer;
      this._syncCableGates(ride);
      for (const which of ['entrance', 'exit']) {   // 小屋对位
        const hut = ride.huts?.[which];
        if (hut) hut.position.set((ride[which].inner[0] - ride.x) * TILE + TILE / 2, 0, (ride[which].inner[1] - ride.y) * TILE + TILE / 2);
      }
      ride.customName = s.name || null;
      ride.paintMain = s.paintMain ?? (s.paint && s.paint !== 0xffffff ? s.paint : null);
      ride.paintSub = s.paintSub ?? null;
      ride.ageMonths = s.age || 0;
      if (ride.paintMain != null || ride.paintSub != null) this.applyPaint(ride);
      return ride;
    }
    if (s.custom) {   // 定制过山车:轨道件与出入口来自存档
      ride = {
        id: s.id, def, x: s.x, y: s.y,
        custom: true, complete: !!s.complete,
        pieces: (s.pieces || []).map(([t, x, y, h, dir]) => ({ t, x, y, h, dir })),
        baseY: w.maxH(s.x, s.y) * H_UNIT,
        status: s.status || 'closed',
        price: s.price ?? def.basePrice,
        guestsServed: s.guestsServed || 0, incomeTotal: s.incomeTotal || 0,
        reliability: s.reliability ?? 95, broken: !!s.broken, breakdownT: 0,
        queue: [], riders: [], animSpeed: 0, cycleT: 0, phase: 'idle',
        entrance: s.entrance || { inner: [s.x, s.y], outer: [s.x - 1, s.y], dir: 2 },
        exit: s.exit || { inner: [s.x, s.y], outer: [s.x + 1, s.y], dir: 0 },
        needGate: true,
        excitement: s.excitement ?? def.excitement, intensity: s.intensity ?? def.intensity, nausea: s.nausea ?? def.nausea,
      };
      if (!ride.pieces.length) ride.pieces.push({ t: 'station', x: s.x, y: s.y, h: 0, dir: 1 });
    } else {
      // 找入口/出口:重新扫描(与放置时同算法 → 确定性一致)
      const spots = this._findGates(def, s.x, s.y) || fallbackGates(def, s.x, s.y);
      ride = {
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
    }
    ride.customName = s.name || null;
    ride.paintMain = s.paintMain ?? (s.paint && s.paint !== 0xffffff ? s.paint : null);   // 旧版整体色并入主色
    ride.paintSub = s.paintSub ?? null;
    ride.ageMonths = s.age || 0;
    this._buildVisuals(ride);
    this.list.push(ride);
    this.computeQueueCells(ride);
    this.computeStations(ride);
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
      for (const q of (ride.queues || [ride.queue])) for (const p of [...q]) this.game.peeps.releaseFromQueue(p);
      for (const p of [...ride.riders]) this.game.peeps.releaseFromQueue(p);
    }
    let refund;
    if (ride.custom) {   // 定制过山车:按轨道件清理与退款
      for (const pc of ride.pieces) {
        if (w.in(pc.x, pc.y) && w.rideTile[w.idx(pc.x, pc.y)] === rideId) w.rideTile[w.idx(pc.x, pc.y)] = -1;
      }
      refund = Math.round(ride.pieces.reduce((s, pc) => s + PIECE_BY_ID[pc.t].cost, 0) * 0.55);
    } else {
      for (let ty = 0; ty < ride.def.h; ty++)
        for (let tx = 0; tx < ride.def.w; tx++)
          if (w.rideTile[w.idx(ride.x + tx, ride.y + ty)] === rideId) w.rideTile[w.idx(ride.x + tx, ride.y + ty)] = -1;
      if (ride.cableB) {   // 缆车:第二个站台
        const [bx, by] = ride.cableB;
        if (w.in(bx, by) && w.rideTile[w.idx(bx, by)] === rideId) w.rideTile[w.idx(bx, by)] = -1;
      }
      refund = Math.round(ride.def.cost * 0.55);
    }
    this.group.remove(ride.group);
    ride.group.traverse(o => { o.geometry?.dispose?.(); });
    this.list.splice(idx, 1);
    w.emit('path', ride.x, ride.y, ride.x + ride.def.w, ride.y + ride.def.h);
    this.game.ui?.closeRideWindow?.(rideId);
    return { ok: true, cost: -refund };
  }

  tilesOf(rideId) {
    const r = this.list.find(q => q.id === rideId);
    if (!r) return [];
    if (r.custom) return [...new Map(r.pieces.map(pc => [pc.x + ',' + pc.y, [pc.x, pc.y]])).values()];
    if (r.cableB) return [[r.x, r.y], r.cableB];
    const out = [];
    for (let ty = 0; ty < r.def.h; ty++)
      for (let tx = 0; tx < r.def.w; tx++) out.push([r.x + tx, r.y + ty]);
    return out;
  }

  findRide(id) { return this.list.find(r => r.id === id); }

  // 有效兴奋度:随园龄衰减(约 22 个月降到 55% 下限)
  effExcitement(ride) {
    return ride.excitement * Math.max(0.55, 1 - (ride.ageMonths || 0) * 0.02);
  }
  renovateCost(ride) {
    const base = ride.custom ? ride.pieces.reduce((s, pc) => s + PIECE_BY_ID[pc.t].cost, 0) : ride.def.cost;
    return Math.round(base * 0.35);
  }
  renovate(rideId) {   // 翻新:园龄归零、可靠度回 95、顺手修好故障
    const ride = this.findRide(rideId);
    if (!ride) return { ok: false, reason: '设施不存在' };
    ride.ageMonths = 0;
    ride.reliability = 95;
    ride.broken = false;
    return { ok: true, cost: this.renovateCost(ride) };
  }

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
    // 偏好:儿童不玩高强度;成人按"刺激偏好 × 设施强度"匹配,且对同一设施决定固定(不在门口反复横跳)
    const inten = ride.intensity ?? ride.def.intensity ?? 50;
    if (peep.kid && inten > 55) return false;
    const match = 1 - Math.min(1, Math.abs(inten / 100 - (peep.thrill ?? 0.5)) * 1.6);
    const h = ((peep.id * 31 + ride.id * 17) % 100) / 100;
    let want = 0.25 + match * 0.75;
    if (this.game.weather?.mode === 'rain') want += ride.def.indoor ? 0.25 : -0.1;   // 雨天室内设施吃香
    if (h > want) return false;
    return peep.cash >= ride.price && ride.queue.length < ride.queueCells.length + 8 && peep.energy > 0.15;
  }
  joinQueue(peep, ride) {
    peep.state = 'queue';
    peep.queueRide = ride;
    const key = peep.tile ? peep.tile[0] + ',' + peep.tile[1] : '';
    peep.queueStation = ride.stationGateMap?.[key] ?? 0;   // 多站台设施:按所站位置进对应站的队
    (ride.queues?.[peep.queueStation] || ride.queue).push(peep);
  }
  queueCellOf(ride, index, stationIdx = 0) {
    if (stationIdx > 0 && ride.stations?.[stationIdx]) {   // 支线站台:站台上站位
      const tiles = ride.stations[stationIdx].tiles;
      return tiles[Math.min(index, tiles.length - 1)];
    }
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
      // 高强度设施满载运转时游客尖叫(合成音效,节流 5s)
      if (this.game.audio && (ride.def.intensity ?? 0) >= 40 && ride.animSpeed > 0.8 && ride.status === 'open' &&
        (ride.riders.length || this.game.mp)) {
        const now = this.game.time || 0;
        if (now - (ride._screamAt ?? -9) > 5 && this._rng() < dt * 0.45) {
          ride._screamAt = now;
          this.game.audio.play('scream');
        }
      }
      if (this.game.mp) continue;
      // 可靠度衰变 + 故障判定(权威侧)
      if (ride.def.kind !== 'shop' && ride.status === 'open' && !ride.broken) {
        ride.reliability = Math.max(40, ride.reliability - dt * 2 / 45);   // ~2点/月
        ride.breakdownT += dt;
        const rel = ride.reliability / 100;
        const p = (1 - rel) * (1 - rel) * 0.12 * dt * (ride.def.intensity > 30 ? 1.5 : 1) * (1 + (ride.ageMonths || 0) * 0.06);
        if (this._rng() < p) this.breakdown(ride);
      }
      if (ride.broken) continue;
      if (ride.def.kind === 'coaster' || ride.def.kind === 'cable') { this._updateCoaster(ride); continue; }
      if (ride.def.kind === 'boats') { this._updateBoats(ride); continue; }
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
    if (ride.api?.boats) for (const bt of ride.api.boats) { bt.riders.length = 0; bt.state = 'dock'; }   // 脚踏船清船
    for (const q of (ride.queues || [ride.queue])) for (const p of [...q]) this.game.peeps.releaseFromQueue(p);   // 故障清队
    this.game.messages?.add(`「${ride.def.name}」故障了!需要维修工`, ride.id);
    this.game.economy?._emit?.('change');
  }

  // 轨道列车(过山车/小火车/激流勇进):load 时在当前停靠站装客
  _updateCoaster(ride) {
    if (ride.status !== 'open') return;
    const api = ride.api;
    const st = api?.trains ? api.trains.find(t => t.mode === 'load' && t.timer <= 0.6) : api?.state;
    if (!st || st.mode !== 'load' || st.timer > 0.6) return;
    const ti = api.trains ? api.trains.indexOf(st) : 0;
    const q = ride.queues?.[st.stationIdx ?? 0] || ride.queue;
    if (!q.length) return;
    const onTrain = ride.riders.filter(p => (p._trainIdx ?? 0) === ti).length;   // 该列车剩余座位
    const n = Math.min(ride.def.capacity - onTrain, q.length);
    for (let i = 0; i < n; i++) {
      const peep = q.shift();
      peep._trainIdx = ti;
      ride.riders.push(peep);
      this.game.peeps.boardRide(peep, ride);
    }
    this._repositionQueue(ride);
  }

  // 定制列车停靠一站:到站下车(结算效果),过站乘客与其他列车乘客留在车上
  trainStop(ride, stopIdx, trainIdx = null) {
    const g = this.game;
    const stay = [];
    for (const peep of ride.riders) {
      const matchTrain = trainIdx == null || (peep._trainIdx ?? 0) === trainIdx;
      if (matchTrain && (peep._destStation ?? 0) === stopIdx) {
        ride.guestsServed++;
        g.peeps.alightRide(peep, ride, ride.stations?.[stopIdx]?.outer || ride.exit.outer);
      } else stay.push(peep);
    }
    ride.riders = stay;
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
  // 脚踏船:有空船在码头且有人排队 → 装 4 人出发
  _updateBoats(ride) {
    if (ride.status !== 'open') return;
    const boats = ride.api?.boats;
    if (!boats) return;
    for (const bt of boats) {
      if (bt.state !== 'dock' || bt.riders.length || !ride.queue.length) continue;
      const n = Math.min(4, ride.queue.length);
      for (let i = 0; i < n; i++) {
        const peep = ride.queue.shift();
        peep._boatIdx = boats.indexOf(bt);
        bt.riders.push(peep);
        ride.riders.push(peep);
        this.game.peeps.boardRide(peep, ride);
      }
      bt.state = 'roam';
      bt.tripT = 0;
      this._repositionQueue(ride);
    }
  }
  // 船回码头:下客结算(api 回调)
  boatDocked(ride, bt) {
    bt.state = 'dock';
    const leaving = new Set(bt.riders);
    ride.riders = ride.riders.filter(p => !leaving.has(p));
    for (const peep of bt.riders) {
      ride.guestsServed++;
      this.game.peeps.alightRide(peep, ride, ride.exit.outer);
    }
    bt.riders.length = 0;
  }
  _repositionQueue(ride) {
    const qs = ride.queues || [ride.queue];
    qs.forEach((q, si) => q.forEach((p, i) => { p.queueIndex = i; p.queueStation = si; this.game.peeps.updateQueuePos(p); }));
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
