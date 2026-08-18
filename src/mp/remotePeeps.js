// 联机客户端的"远端游客":不参与 AI,位置/外观来自服务端快照,本地插值渲染。
import { PEEP } from '../config.js';
import { World } from '../world/world.js';
import { PeepRenderer, SHIRT_COLS, SKIN_COLS, PANTS_COLS } from '../render/peepRenderer.js';

export class RemotePeeps {
  constructor(game) {
    this.game = game;
    this.map = new Map();        // id → record
    this.list = [];              // 供 UI 计数
    this.renderer = new PeepRenderer(game);
  }

  // 快照 = 数组的数组:[id, x*100, z*100, flags, shirt, skin, pants, balloon]
  applySnapshot(arr) {
    const seen = new Set();
    for (const [id, xi, zi, flags, sh, sk, pa, ba, rid] of arr) {
      seen.add(id);
      let r = this.map.get(id);
      if (!r) {
        r = {
          id, x: xi / 100, z: zi / 100, tx: xi / 100, tz: zi / 100,
          tile: [0, 0], walkT: Math.random() * 10, yaw: 0,
          shirt: SHIRT_COLS[sh % SHIRT_COLS.length], skin: SKIN_COLS[sk % SKIN_COLS.length],
          pants: PANTS_COLS[pa % PANTS_COLS.length], balloonCol: SHIRT_COLS[ba % SHIRT_COLS.length],
          hidden: false, hasSouvenir: false, state: 'walk',
        };
        this.map.set(id, r);
      }
      r.tx = xi / 100; r.tz = zi / 100;
      r.hidden = (flags & 1) !== 0;
      r.hasSouvenir = (flags & 2) !== 0;
      r.hasUmbrella = (flags & 4) !== 0;
      r.scale = (flags & 8) !== 0 ? 0.72 : 1;   // 儿童体型
      r.queueRide = rid ? (this.game.rides?.findRide(rid) || null) : null;   // 乘坐中 → 画进设施
      if (r.queueRide) r.state = 'ride';
    }
    for (const id of [...this.map.keys()]) if (!seen.has(id)) this.map.delete(id);
  }

  update(dt) {
    const w = this.game.world;
    this.list.length = 0;
    for (const r of this.map.values()) {
      const dx = r.tx - r.x, dz = r.tz - r.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) { r.x = r.tx; r.z = r.tz; }          // 瞬移修正
      else if (d > 0.005) {
        const k = Math.min(1, dt * 8);
        r.x += dx * k; r.z += dz * k;
        r.yaw = Math.atan2(dx, dz) + Math.PI;
      }
      r.walkT += dt * (d > 0.02 ? 1 : 0.2);
      const tx = World.worldToTileX(r.x), ty = World.worldToTileY(r.z);
      if (w.in(tx, ty)) r.tile = [tx, ty];
      if (!r.queueRide) r.state = d > 0.02 ? 'walk' : 'idle';   // 乘坐中状态由快照维持
      this.list.push(r);
    }
    this.renderer.render(this.list, dt);
  }

  // 服务端管理接口在联机客户端用不到,但主循环/tools 可能探测 —— 保持安全空实现
  trySpawn() {}
  releaseFromQueue() {}
  count() { return this.list.length; }
}
