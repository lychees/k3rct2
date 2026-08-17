// 游客的 InstancedMesh 渲染器:从 peeps.js 抽出,供 AI 游客(单机/服务端)与联机快照游客共用。
import * as THREE from 'three';
import { TILE, H_UNIT, PATH, PEEP } from '../config.js';

export const SHIRT_COLS = [0xd84a3a, 0x3a7ad8, 0x48b050, 0xe8b830, 0xc86ad8, 0xe87a30, 0x3aa8a0, 0x88c848, 0xd8d8d8, 0x8a5ad8];
export const SKIN_COLS = [0xf0c8a0, 0xe0b088, 0xc89070, 0xa06848];
export const PANTS_COLS = [0x30405f, 0x503828, 0x405060, 0x603030, 0x2a4a2a];

// 乘坐中游客落点的 scratch 对象(riderPos 输出,设施组局部坐标)
const _rpOut = { x: 0, y: 0, z: 0 };

export class PeepRenderer {
  constructor(game) {
    this.game = game;
    const cap = PEEP.MAX;
    this.cap = cap;
    const g = this.group = new THREE.Group();
    game.scene.add(g);
    const lam = (extra = {}) => new THREE.MeshLambertMaterial(extra);
    this.mBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.44, 0.22), lam(), cap);
    this.mHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), lam(), cap);
    this.mHair = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.1, 0.26), lam({ color: 0x3a2a18 }), cap);
    this.mLegL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), lam(), cap);
    this.mLegR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), lam(), cap);
    this.mBalloon = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5),
      new THREE.MeshLambertMaterial({ emissive: 0x331111 }), cap);
    this.mUmbrella = new THREE.InstancedMesh(new THREE.ConeGeometry(0.46, 0.24, 6), lam(), cap);
    this.mCap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.11, 0.3), lam(), cap);   // 员工帽(按岗位色)
    this.parts = [this.mBody, this.mHead, this.mHair, this.mLegL, this.mLegR, this.mBalloon, this.mUmbrella, this.mCap];
    for (const m of this.parts) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      g.add(m);
    }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of this.parts) {
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, zero);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  groundY(tx, ty, w) {
    let y = w.surfaceY(tx, ty);
    if (w.path[w.idx(tx, ty)] !== PATH.NONE) y = Math.max(...w.corners(tx, ty)) * H_UNIT + 0.035;
    return y;
  }

  // list: [{x,z,tile,hidden,yaw,walkT,shirt,skin,pants,capCol,hasSouvenir,balloonCol,hasUmbrella,id,state}]
  render(list, dt) {
    const w = this.game.world;
    const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    const n = Math.min(list.length, this.cap);
    for (let i = 0; i < this.cap; i++) {
      if (i >= n) {
        for (const m of this.parts) m.setMatrixAt(i, zeroM);
        continue;
      }
      const p = list[i];
      // 乘坐中的游客:设施提供了 riderPos 就把人画进设施里(木马座舱/过山车车厢…),否则照例隐藏
      const ride = p.state === 'ride' ? p.queueRide : null;
      const riderPos = ride?.api?.riderPos;
      if (p.hidden && !riderPos) {
        for (const m of this.parts) m.setMatrixAt(i, zeroM);
        continue;
      }
      let px = p.x, pz = p.z, gy;
      if (riderPos) {
        const idx = Math.max(0, ride.riders.indexOf(p));
        riderPos.call(ride.api, idx, _rpOut);
        const gp = ride.group.position;           // 组内局部坐标 → 世界坐标
        px = gp.x + _rpOut.x; pz = gp.z + _rpOut.z; gy = gp.y + _rpOut.y;
      } else {
        gy = this.groundY(p.tile[0], p.tile[1], w);
      }
      const moving = p.state === 'wander' || p.state === 'enter' || p.state === 'leaving' || p.state === 'walk';
      const bob = moving ? Math.abs(Math.sin(p.walkT * 9)) * 0.05 : Math.sin(p.walkT * 2 + p.id) * 0.01;
      const swing = moving ? Math.sin(p.walkT * 9) * 0.09 : 0;
      q.setFromAxisAngle(up, p.yaw);
      const fx = Math.sin(p.yaw + Math.PI), fz = Math.cos(p.yaw + Math.PI);
      const sx = Math.cos(p.yaw + Math.PI), szz = -Math.sin(p.yaw + Math.PI);
      pos.set(px, gy + 0.58 + bob, pz); m4.compose(pos, q, scl);
      this.mBody.setMatrixAt(i, m4);
      col.setHex(p.shirt); this.mBody.setColorAt(i, col);
      pos.set(px, gy + 1.02 + bob, pz); m4.compose(pos, q, scl);
      this.mHead.setMatrixAt(i, m4);
      col.setHex(p.skin); this.mHead.setColorAt(i, col);
      pos.set(px, gy + 1.17 + bob, pz); m4.compose(pos, q, scl);
      this.mHair.setMatrixAt(i, m4);
      pos.set(px + fx * swing + sx * 0.09, gy + 0.16 + (swing > 0 ? swing * 0.4 : 0), pz + fz * swing + szz * 0.09);
      m4.compose(pos, q, scl); this.mLegL.setMatrixAt(i, m4);
      col.setHex(p.pants); this.mLegL.setColorAt(i, col);
      pos.set(px - fx * swing - sx * 0.09, gy + 0.16 + (-swing > 0 ? -swing * 0.4 : 0), pz - fz * swing - szz * 0.09);
      m4.compose(pos, q, scl); this.mLegR.setMatrixAt(i, m4);
      this.mLegR.setColorAt(i, col);
      // 员工帽(只有员工记录带 capCol,游客永不戴帽 → 一眼区分;乘坐中不渲染帽)
      if (!riderPos && p.capCol) {
        pos.set(px, gy + 1.26 + bob, pz); m4.compose(pos, q, scl);
        this.mCap.setMatrixAt(i, m4);
        col.setHex(p.capCol); this.mCap.setColorAt(i, col);
      } else {
        this.mCap.setMatrixAt(i, zeroM);
      }
      if (!riderPos && p.hasSouvenir) {
        const bt = performance.now() / 1000;
        pos.set(px + sx * 0.3, gy + 1.55 + Math.sin(bt * 2 + p.id) * 0.08, pz + szz * 0.3);
        m4.compose(pos, q, scl);
        this.mBalloon.setMatrixAt(i, m4);
        col.setHex(p.balloonCol); this.mBalloon.setColorAt(i, col);
      } else {
        this.mBalloon.setMatrixAt(i, zeroM);
      }
      // 雨伞(下雨时撑起;乘坐中不收伞——直接收起)
      if (!riderPos && p.hasUmbrella && this.game.weather?.mode === 'rain') {
        pos.set(px, gy + 1.62 + bob * 0.5, pz);
        m4.compose(pos, q, scl);
        this.mUmbrella.setMatrixAt(i, m4);
        col.setHex(p.shirt).multiplyScalar(1.1); this.mUmbrella.setColorAt(i, col);
      } else {
        this.mUmbrella.setMatrixAt(i, zeroM);
      }
    }
    for (const m of this.parts) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
