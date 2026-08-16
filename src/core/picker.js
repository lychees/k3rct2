// 射线拾取:屏幕坐标 → 地形 tile / 角点 / 世界点。
import * as THREE from 'three';
import { TILE } from '../config.js';
import { World } from '../world/world.js';

export class Picker {
  constructor(world, terrain, isoCam) {
    this.world = world;
    this.terrain = terrain;
    this.isoCam = isoCam;
    this.ray = new THREE.Raycaster();
  }

  _landMeshes() {
    const out = [];
    for (const rec of this.terrain.chunks.values()) if (rec.land) out.push(rec.land);
    return out;
  }

  // 返回 {x,y,world,hx,hy} 或 null。hx/hy:角点化用的子 tile 位置
  pickTile(clientX, clientY) {
    const cam = this.isoCam;
    const rect = cam.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, cam.camera);
    const hits = this.ray.intersectObjects(this._landMeshes(), false);
    let wx, wz;
    if (hits.length) {
      wx = hits[0].point.x; wz = hits[0].point.z;
    } else {
      const g = cam.screenToGround(clientX, clientY);
      if (!g) return null;
      wx = g.x; wz = g.z;
    }
    const x = World.worldToTileX(wx), y = World.worldToTileY(wz);
    if (!this.world.in(x, y)) return null;
    // 子象限(0..1)
    const fx = (wx - World.tileToWorldX(x)) / TILE, fy = (wz - World.tileToWorldZ(y)) / TILE;
    return { x, y, world: { x: wx, z: wz }, fx, fy };
  }
}
