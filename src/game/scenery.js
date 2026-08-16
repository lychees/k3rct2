// 景观:程序化低多边形树木/灌木/花丛,InstancedMesh 批量渲染。
import * as THREE from 'three';
import { MAP_W, MAP_H, TILE, WATER_H, PRICE } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';

// 景物类型定义:id → {名称, 价格, objCode, 构建函数(GeomBuilder → 顶点色几何)}
export const SCENERY_TYPES = [
  { id: 'pine', name: '松树', price: PRICE.tree, obj: 1, leaf: 0x2e7a2e, build: buildPine },
  { id: 'oak', name: '阔叶树', price: PRICE.tree + 4, obj: 1, leaf: 0x4a9233, build: buildOak },
  { id: 'maple', name: '红枫', price: PRICE.tree + 6, obj: 1, leaf: 0xc05a28, build: buildOak },
  { id: 'birch', name: '白桦', price: PRICE.tree + 2, obj: 1, leaf: 0x86b83c, build: buildBirch },
  { id: 'bush', name: '灌木', price: PRICE.bush, obj: 2, leaf: 0x3d8a30, build: buildBush },
  { id: 'flower', name: '花丛', price: PRICE.flower, obj: 3, leaf: 0xffffff, build: buildFlower },
];
export const SCENERY_BY_ID = Object.fromEntries(SCENERY_TYPES.map(t => [t.id, t]));

function buildPine(b) {
  b.post(0, 0, 0, 0.13, 0.7, 0x6b4a2a, 1);
  b.frustum(0, 0.45, 0, 0.62, 0.02, 1.0, 0xffffff, 0.95, 7);
  b.frustum(0, 1.05, 0, 0.4, 0.02, 0.75, 0xffffff, 1.0, 7);
}
function buildOak(b) {
  b.post(0, 0, 0, 0.15, 0.85, 0x7a5530, 1);
  b.blob(0, 1.35, 0, 0.72, 0xffffff, 1);
  b.blob(0.4, 1.05, 0.2, 0.45, 0xffffff, 0.9);
  b.blob(-0.35, 1.1, -0.25, 0.5, 0xffffff, 0.85);
}
function buildBirch(b) {
  b.post(0, 0, 0, 0.09, 1.1, 0xd8d8d0, 1);
  b.blob(0, 1.5, 0, 0.5, 0xffffff, 1);
  b.blob(0.25, 1.2, -0.15, 0.32, 0xffffff, 0.9);
}
function buildBush(b) {
  b.blob(0, 0.32, 0, 0.42, 0xffffff, 1);
  b.blob(0.3, 0.22, 0.18, 0.28, 0xffffff, 0.9);
  b.blob(-0.28, 0.2, 0.12, 0.26, 0xffffff, 0.92);
}
const FLOWER_COLS = [0xd84a4a, 0xe8c838, 0xffffff, 0xc86ad8, 0xe87a30];
function buildFlower(b) {
  // 草丛底 + 几朵十字小花
  b.blob(0, 0.1, 0, 0.3, 0x3d8a30, 0.9);
  const spots = [[0, 0.28, 0], [0.3, 0.22, 0.2], [-0.28, 0.24, 0.15], [0.1, 0.2, -0.3], [-0.15, 0.2, -0.22], [0.35, 0.18, -0.12]];
  spots.forEach(([x, y, z], i) => {
    const c = new THREE.Color(FLOWER_COLS[i % FLOWER_COLS.length]);
    const s = 0.09;
    b.tri([x - s, y, z], [x + s, y, z], [x, y, z + s * 1.6], [[0, 0], [0, 0], [0, 0]], c.getHex(), 1.2);
    b.tri([x, y, z - s * 1.4], [x - s, y, z], [x + s, y, z], [[0, 0], [0, 0], [0, 0]], c.getHex(), 1.2);
  });
}

export class Scenery {
  constructor(world, scene) {
    this.world = world;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.types = new Map();   // id -> {def, geom, mesh, items:[{x,y,rot,scale,tint}]}
    for (const def of SCENERY_TYPES) {
      const b = new GeomBuilder();
      def.build(b);
      this.types.set(def.id, { def, geom: b.build(), mesh: null, items: [] });
    }
    world.on('objects', (t) => { if (t === 'scenery') this.rebuildDirty(); });
    this._dirty = new Set();
  }

  canPlace(id, x, y) {
    const w = this.world;
    const def = SCENERY_BY_ID[id];
    if (!def) return { ok: false, reason: '未知景物' };
    if (!w.ownedAt(x, y)) return { ok: false, reason: '不在公园范围内' };
    const i = w.idx(x, y);
    if (w.path[i]) return { ok: false, reason: '路上不能种' };
    if (w.obj[i]) return { ok: false, reason: '已有景物' };
    if (w.rideTile[i] !== -1) return { ok: false, reason: '有游乐设施' };
    if (w.minH(x, y) < WATER_H) return { ok: false, reason: '水下' };
    if (def.obj === 1 && !w.isFlat(x, y)) return { ok: false, reason: '树需要平地' };
    return { ok: true };
  }
  place(id, x, y, preset = null) {
    const chk = this.canPlace(id, x, y);
    if (!chk.ok) return chk;
    const rec = this.types.get(id);
    const item = preset && preset.rot !== undefined
      ? { x, y, rot: preset.rot, scale: preset.scale, tint: preset.tint }
      : {
        x, y,
        rot: Math.random() * Math.PI * 2,
        scale: 0.75 + Math.random() * 0.5,
        tint: 0.85 + Math.random() * 0.3,
      };
    rec.items.push(item);
    item.typeId = id;
    const w = this.world, i = w.idx(x, y);
    w.obj[i] = rec.def.obj;
    w.objRef[i] = rec.items.length - 1;
    this._dirty.add(id);
    w.emit('objects', 'scenery');
    return { ok: true, cost: rec.def.price };
  }
  canRemove(x, y) {
    const w = this.world;
    if (!w.in(x, y) || w.obj[w.idx(x, y)] === 0) return { ok: false, reason: '' };
    return { ok: true };
  }
  removeAt(x, y) {
    const chk = this.canRemove(x, y);
    if (!chk.ok) return chk;
    const w = this.world, i = w.idx(x, y);
    const ref = w.objRef[i];
    // 找所属 type
    for (const [id, rec] of this.types) {
      const idx = rec.items.findIndex(it => it.x === x && it.y === y);
      if (idx >= 0) {
        rec.items.splice(idx, 1);
        w.obj[i] = 0; w.objRef[i] = -1;
        // objRef 重排:代价小,重建时统一修
        this.reindex(rec);
        this._dirty.add(id);
        w.emit('objects', 'scenery');
        return { ok: true, cost: -10 };
      }
    }
    return { ok: false, reason: '' };
  }
  reindex(rec) {
    const w = this.world;
    rec.items.forEach((it, i) => { w.objRef[w.idx(it.x, it.y)] = i; });
  }

  rebuildDirty() {
    for (const id of this._dirty) this.rebuildType(id);
    this._dirty.clear();
  }
  rebuildType(id) {
    const rec = this.types.get(id);
    if (!rec) return;
    if (rec.mesh) { this.group.remove(rec.mesh); rec.mesh.dispose(); rec.mesh = null; }
    if (!rec.items.length) return;
    const mesh = new THREE.InstancedMesh(rec.geom, this.mat, rec.items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const col = new THREE.Color(), leaf = new THREE.Color(rec.def.leaf);
    rec.items.forEach((it, i) => {
      const c = this.world.tileCenter(it.x, it.y);
      pos.set(c.x, this.world.surfaceY(it.x, it.y), c.z);
      q.setFromAxisAngle(up, it.rot);
      scl.setScalar(it.scale);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
      col.copy(leaf).multiplyScalar(it.tint);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    rec.mesh = mesh;
  }

  // 幽灵预览用:克隆几何
  getMeshForGhost(id) {
    const rec = this.types.get(id);
    const m = new THREE.Mesh(rec.geom, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    return m;
  }
}
