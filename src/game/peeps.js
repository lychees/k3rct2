// 游客(Peeps):入口生成、路径漫游、排队乘坐、饥渴累/开心度、离园。
// 渲染抽到 PeepRenderer(InstancedMesh),与联机快照游客共用。
import { PATH, PEEP, MAP_W, MAP_H } from '../config.js';
import { World } from '../world/world.js';
import { mulberry32 } from '../core/random.js';
import { PeepRenderer, SHIRT_COLS, SKIN_COLS, PANTS_COLS } from '../render/peepRenderer.js';

const rand = mulberry32(Date.now() & 0x7fffffff || 1);
const ridx = n => Math.floor(rand() * n);

export class Peeps {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.nextId = 1;
    this.nextGroupId = 1;   // 家庭组编号
    this.spawnTimer = 3;
    this.cap = PEEP.MAX;    // 游客上限(设置面板可调低)
    this.gateMap = new Map();   // "x,y" → ride(入口外邻格 → ride)
    this.renderer = game.headless ? null : new PeepRenderer(game);
  }

  // ---------- 生成 ----------
  spawnInterval() {
    const g = this.game;
    const ridesOpen = g.rides.list.filter(r => r.status === 'open' && !r.broken).length;
    const rating = g.economy.parkRating;
    let iv = PEEP.spawnBase - ridesOpen * 0.35 - rating * 0.004;
    const wf = g.weather?.spawnFactor?.() ?? 1;
    return Math.max(0.7, iv / wf);
  }
  trySpawn() {
    if (this.list.length >= this.cap) return;
    const g = this.game, w = g.world;
    if (!w.entrance) return;
    if (g.economy.parkOpen === false) return;   // 闭园不进新人
    const spawnTile = w.entrancePath[0];
    if (!spawnTile) return;
    const fee = g.economy.entranceFee;
    const cash0 = 40 + rand() * 55;
    if (fee > cash0) { g.messages?.add(`一批游客嫌门票太贵(${g.economy.fmt(fee)}),转身走了`); return; }
    // 家庭组:1~5 人一批入园(成人 1~2 人 + 儿童若干),同组跟随领队
    const roll = rand();
    const size = roll < 0.3 ? 1 : roll < 0.55 ? 2 : roll < 0.75 ? 3 : roll < 0.9 ? 4 : 5;
    const kids = size <= 1 ? 0 : size <= 3 ? 1 : 2;
    const gid = size > 1 ? this.nextGroupId++ : 0;
    for (let m = 0; m < size; m++) {
      this._spawnOne(gid, m === 0, m >= size - kids);
      if (this.list.length >= this.cap) break;
    }
  }

  _spawnOne(gid, isLeader, kid) {
    const w = this.game.world;
    const cash = kid ? 15 + rand() * 20 : 40 + rand() * 55;
    const peep = {
      id: this.nextId++,
      x: 0, z: 0, tile: null, prev: null,
      fx: 0.5, fy: 0.5,
      off: (rand() - 0.5) * 0.5,                    // 走路横向偏移(路径显得热闹)
      state: 'enter', stateT: 0,
      route: [],                                     // BFS 路线(用于 enter/leave)
      yaw: 0, walkT: rand() * 10,
      cash, hunger: rand() * 0.3, thirst: rand() * 0.3, energy: 1,
      bladder: rand() * 0.25, hasUmbrella: false,
      happiness: 0.7 + rand() * 0.25,
      nausea: 0, hasSouvenir: false,
      shirtIdx: ridx(SHIRT_COLS.length), skinIdx: ridx(SKIN_COLS.length),
      pantsIdx: ridx(PANTS_COLS.length), balloonIdx: ridx(SHIRT_COLS.length),
      speed: PEEP.walkSpeed * (0.85 + rand() * 0.3),
      thinkT: rand() * 2,
      queueRide: null, queueIndex: 0,
      hidden: false,
      groupId: gid, isLeader, kid,
      scale: kid ? 0.72 : 1,                         // 儿童个子小
      thrill: kid ? 0.1 + rand() * 0.35 : rand(),    // 刺激偏好(儿童偏低)
    };
    peep.shirt = SHIRT_COLS[peep.shirtIdx];
    peep.skin = SKIN_COLS[peep.skinIdx];
    peep.pants = PANTS_COLS[peep.pantsIdx];
    peep.balloonCol = SHIRT_COLS[peep.balloonIdx];
    this.list.push(peep);
    peep.route = w.entrancePath.filter(t => w.path[w.idx(t[0], t[1])] !== PATH.NONE);
    peep.routeIdx = 0;
    const [sx, sy] = peep.route[0];
    peep.tile = [sx, sy];
    const c = w.tileCenter(sx, sy);
    peep.x = c.x; peep.z = c.z;
    peep.targetTile = null;
  }

  // ---------- 主更新 ----------
  update(dt) {
    const g = this.game;
    if (!g.paused) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval();
        this.trySpawn();
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        this.updatePeep(p, dt);
        if (p.state === 'gone') this.list.splice(i, 1);
      }
    }
    this.render(dt);
  }

  updatePeep(p, dt) {
    p.stateT += dt;
    p.walkT += dt * (p.state === 'queue' || p.hidden ? 0 : 1);
    // 需求
    if (p.state !== 'ride' && !p.hidden) {
      p.hunger = Math.min(1, p.hunger + PEEP.hungerRate * dt);
      p.thirst = Math.min(1, p.thirst + PEEP.thirstRate * dt);
      p.energy = Math.max(0, p.energy - PEEP.energyRate * dt);
      p.bladder = Math.min(1, p.bladder + PEEP.bladderRate * dt);
      // 下雨且没伞:开心度双倍衰减
      const rainFactor = (this.game.weather?.mode === 'rain' && !p.hasUmbrella) ? 2.2 : 1;
      p.happiness = Math.max(0, p.happiness - PEEP.happyDecay * dt * (p.hunger > 0.7 ? 3 : 1) * rainFactor);
      this._peepThoughts(p, dt);
    }
    switch (p.state) {
      case 'enter': this._walkRoute(p, dt, () => {
        // 到达园内第一格:付门票
        const g = this.game;
        const inside = p.tile[1] >= g.world.entrance.y;
        if (inside) {
          if (g.economy.entranceFee > 0) g.economy.earn(Math.min(g.economy.entranceFee, p.cash), '门票');
          p.cash = Math.max(0, p.cash - g.economy.entranceFee);
          g.economy.totalGuests++;
          p.state = 'wander'; p.targetTile = null;
        }
      }); break;
      case 'wander': this._wander(p, dt); break;
      case 'queue': this._queue(p, dt); break;
      case 'leaving': this._walkRoute(p, dt, () => { p.state = 'gone'; }); break;
      case 'ride': case 'shopping': break;   // 隐藏中,由 rides 结算
    }
    // 决定离开
    if (p.state === 'wander' && p.stateT > 4) {
      if (p.happiness < 0.22 || p.cash < 3 || p.energy < 0.08) {
        this._planLeave(p);
        if (p.happiness < 0.2 && rand() < 0.3) this.game.messages?.add(`游客 #${p.id}:这个公园不好玩,我要回家了`);
      }
    }
  }

  // 因果想法流(节流:每人 ~8s 一测)
  _peepThoughts(p, dt) {
    p.thoughtT = (p.thoughtT ?? rand() * 8) - dt;
    if (p.thoughtT > 0) return;
    p.thoughtT = 8;
    if (!this.game.thoughts) return;
    const name = `游客 #${p.id}`;
    let t = null;
    if (p.nausea > 0.72 && rand() < 0.5) t = '我有点想吐…';
    else if (p.hunger > 0.85) t = '我快饿扁了';
    else if (p.thirst > 0.85) t = '好渴啊';
    else if (p.bladder > 0.85) t = '厕所在哪里…';
    else if (p.happiness < 0.3) t = '这公园有点无聊';
    else if (p.state === 'queue' && rand() < 0.25) t = '队伍好长…';
    else if (this.game.weather?.mode === 'rain' && !p.hasUmbrella && rand() < 0.3) t = '下雨了!我想要把伞';
    if (t && rand() < 0.5) this.game.thoughts.push({ name, text: t });
  }

  // 沿 route 行走,走完调 onArrive
  _walkRoute(p, dt, onArrive) {
    if (p.targetTile == null) {
      if (p.routeIdx >= p.route.length - 1) { onArrive(); return; }
      p.routeIdx++;
      p.targetTile = p.route[p.routeIdx];
    }
    this._stepToward(p, p.targetTile, dt, () => { p.targetTile = null; });
  }

  _stepToward(p, tile, dt, onArrive) {
    const w = this.game.world;
    const c = w.tileCenter(tile[0], tile[1]);
    // 横向偏移:垂直于行走方向
    const dx = c.x - p.x, dz = c.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) { p.prev = p.tile; p.tile = tile; onArrive(); return; }
    const vx = dx / d, vz = dz / d;
    p.yaw = Math.atan2(vx, vz) + Math.PI;
    // 目标点含横向偏移
    const ox = -vz * p.off, oz = vx * p.off;
    p.x += vx * p.speed * dt;
    p.z += vz * p.speed * dt;
  }

  _wander(p, dt) {
    const g = this.game, w = g.world;
    if (p.targetTile == null) {
      // 在当前 tile 选下一条边
      const [cx, cy] = p.tile;
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = w.neighbor(cx, cy, d);
        if (!w.in(nx, ny)) continue;
        if (w.path[w.idx(nx, ny)] === PATH.NONE) continue;
        if (p.prev && nx === p.prev[0] && ny === p.prev[1]) continue;
        opts.push([nx, ny]);
      }
      if (!opts.length) {
        if (p.prev) { p.targetTile = p.prev; return; }
        return;
      }
      // 尽量不走死胡同(只有一个路径邻居的格)
      if (opts.length > 1) {
        const open = opts.filter(([ox, oy]) => {
          let deg = 0;
          for (let d = 0; d < 4; d++) {
            const [ax, ay] = w.neighbor(ox, oy, d);
            if (w.in(ax, ay) && w.path[w.idx(ax, ay)] !== PATH.NONE) deg++;
          }
          return deg > 1;
        });
        if (open.length) { opts.length = 0; opts.push(...open); }
      }
      // 家庭组:非领队成员偏向选择离领队近的方向(拉开 10 格以上就各走各的)
      if (opts.length > 1 && p.groupId && !p.isLeader) {
        const L = this.list.find(q => q.groupId === p.groupId && q.isLeader && q.state !== 'gone');
        if (L && L.tile && Math.abs(L.tile[0] - cx) + Math.abs(L.tile[1] - cy) <= 10 && rand() < 0.7) {
          let best = opts[0], bestD = 1e9;
          for (const o of opts) {
            const d = Math.abs(o[0] - L.tile[0]) + Math.abs(o[1] - L.tile[1]);
            if (d < bestD) { bestD = d; best = o; }
          }
          p.targetTile = best;
        }
      }
      // 想上厕所/吃喝/没钱的判断 → 找店
      p.targetTile = p.targetTile || opts[ridx(opts.length)];
      p.thinkT -= 1;
    }
    this._stepToward(p, p.targetTile, dt, () => {
      p.targetTile = null;
      this._checkGatesAndNeeds(p);
    });
  }

  // 到达新 tile:垃圾/呕吐、看是否站在某设施入口外/想不想进店
  _checkGatesAndNeeds(p) {
    const g = this.game;
    // 产垃圾/呕吐,看到垃圾心情微降,暴怒时破坏长椅/路灯
    if (g.staff) {
      g.staff.peepLitter(p, p.tile[0], p.tile[1]);
      const lt = g.world.litter ? g.world.litter[g.world.idx(p.tile[0], p.tile[1])] : 0;
      if (lt > 1) p.happiness = Math.max(0, p.happiness - 0.01);
      if (p.happiness < 0.15 && rand() < 0.05) g.staff.tryVandalize(p.tile);
    }
    const key = p.tile[0] + ',' + p.tile[1];
    const ride = g.rides ? g.rides.gateRides?.get?.(key) : null;
    // gateRides 由 rides.place 维护:入口外邻 → ride
    const ride2 = ride || this._rideAtGate(p.tile);
    if (ride2 && g.rides.wantsRide(p, ride2)) {
      if (rand() < 0.75) {
        g.rides.joinQueue(p, ride2);
        p.queueIndex = ride2.queue.length - 1;
        this.updateQueuePos(p);
        return;
      }
    }
    // 又累又不开心 → 离开倾向
    if (p.energy < 0.12 || (p.happiness < 0.25 && p.stateT > 30)) {
      if (rand() < 0.4) this._planLeave(p);
    }
  }

  _rideAtGate(tile) {
    const g = this.game;
    const key = tile[0] + ',' + tile[1];
    for (const ride of g.rides.list) {
      if (ride.stationGateMap && ride.stationGateMap[key] !== undefined) return ride;   // 多站台设施的各站外邻
      if (ride.entrance.outer[0] === tile[0] && ride.entrance.outer[1] === tile[1]) return ride;
      if (ride.def.kind === 'shop' && ride.entrance.outer[0] === tile[0] && ride.entrance.outer[1] === tile[1]) return ride;
    }
    return null;
  }

  _planLeave(p) {
    const w = this.game.world;
    const goal = [w.entrance.x, w.entrance.y - 1];
    const path = bfsPath(w, p.tile, goal);
    if (path && path.length) {
      p.state = 'leaving';
      p.route = path;
      p.routeIdx = 0;
      p.targetTile = null;
    }
  }

  _queue(p, dt) {
    const ride = p.queueRide;
    if (!ride || !this.game.rides.list.includes(ride)) { this.releaseFromQueue(p); return; }
    // 站立位置由 updateQueuePos 写入 p.x/z;小碎步
  }

  updateQueuePos(p) {
    const ride = p.queueRide;
    if (!ride) return;
    const cell = this.game.rides.queueCellOf(ride, p.queueIndex, p.queueStation ?? 0);
    const w = this.game.world;
    const c = w.tileCenter(cell[0], cell[1]);
    p.x = c.x + Math.sin(p.id * 3.7) * 0.25;
    p.z = c.z + Math.cos(p.id * 2.9) * 0.25;
    p.tile = [cell[0], cell[1]];
  }

  // ---------- rides 回调 ----------
  boardRide(peep, ride) {
    this.game.rides.charge(ride, peep);
    peep.state = 'ride';
    peep.hidden = true;
    // 多站台设施:随机选一个后续站下车
    const N = ride.stations?.length || 1;
    const from = peep.queueStation ?? 0;
    peep._destStation = N > 1 ? (from + 1 + Math.floor(rand() * (N - 1))) % N : 0;
  }
  alightRide(peep, ride, cellOverride = null) {
    const w = this.game.world;
    const cell = cellOverride || ride.exit.outer;
    peep.queueRide = null;
    peep.hidden = false;
    peep.state = 'wander';
    peep.stateT = 0;
    peep.prev = null;
    peep.targetTile = null;
    if (w.in(cell[0], cell[1]) && w.path[w.idx(cell[0], cell[1])] !== PATH.NONE) {
      peep.tile = [cell[0], cell[1]];
      const c = w.tileCenter(cell[0], cell[1]);
      peep.x = c.x; peep.z = c.z;
    } else {
      // 出口路被拆了 → 从入口退出
      const ec = ride.entrance.outer;
      peep.tile = [ec[0], ec[1]];
      const c = w.tileCenter(ec[0], ec[1]);
      peep.x = c.x; peep.z = c.z;
    }
    // 效果:开心/晕/渴/饿/票价值不值
    const ex = (this.game.rides.effExcitement?.(ride) ?? ride.excitement) / 100, iv = ride.intensity / 100, na = ride.nausea / 100;
    // 偏好匹配:合口味的设施开心加成更高
    const match = 0.6 + (1 - Math.min(1, Math.abs((ride.intensity ?? 50) / 100 - (peep.thrill ?? 0.5)) * 1.6)) * 0.8;
    peep.happiness = Math.min(1, peep.happiness + ex * 0.28 * match - na * 0.06);
    peep.energy = Math.max(0, peep.energy - iv * 0.12);
    peep.nausea = Math.min(1, peep.nausea + na * 0.5);
    peep.hunger = Math.min(1, peep.hunger + 0.1);
    if (ride.price <= ex * 8) peep.happiness = Math.min(1, peep.happiness + 0.05);
    else peep.happiness = Math.max(0.1, peep.happiness - 0.08);
    if (rand() < 0.12) this.game.messages?.add(`游客 #${peep.id}:「${ride.def.name}太好玩了!」`, ride.id);
  }
  serveAtShop(peep, ride) {
    this.game.rides.charge(ride, peep);
    switch (ride.def.sells) {
      case 'food': peep.hunger = Math.max(0, peep.hunger - 0.75); peep.happiness += 0.04; break;
      case 'drink': peep.thirst = Math.max(0, peep.thirst - 0.8); peep.happiness += 0.04; break;
      case 'joy': peep.hasSouvenir = true; peep.happiness = Math.min(1, peep.happiness + 0.15); break;
      case 'coffee':
        peep.energy = Math.min(1, peep.energy + 0.45);
        peep.thirst = Math.max(0, peep.thirst - 0.2);
        peep.happiness += 0.06;
        break;
      case 'toilet':
        peep.bladder = 0;
        peep.happiness += 0.05;
        break;
      case 'umbrella':
        peep.hasUmbrella = true;
        peep.happiness += 0.03;
        this.game.thoughts?.push({ name: `游客 #${peep.id}`, text: '买到伞了,不怕雨了' });
        break;
    }
    peep.happiness = Math.min(1, Math.max(0, peep.happiness));
    // 原地继续逛
    peep.queueRide = null;
    peep.state = 'wander';
    peep.stateT = 0;
  }
  releaseFromQueue(peep) {
    const ride = peep.queueRide;
    if (ride) {
      const q = ride.queues?.[peep.queueStation ?? 0] || ride.queue;
      const i = q.indexOf(peep);
      if (i >= 0) q.splice(i, 1);
      this.game.rides._repositionQueue?.(ride);
    }
    peep.hidden = false;
    peep.queueRide = null;
    if (peep.state === 'queue' || peep.state === 'ride') peep.state = 'wander';
  }

  // ---------- 渲染(无头时跳过) ----------
  render(dt) {
    if (!this.renderer) return;
    this.renderer.render(this.list, dt);
  }

  count() { return this.list.filter(p => p.state !== 'gone').length; }
}

// BFS 最短路(只走路径 tile)
export function bfsPath(w, from, to) {
  if (!from || !to) return null;
  const key = (x, y) => y * MAP_W + x;
  const prev = new Map();
  const q = [from];
  prev.set(key(from[0], from[1]), null);
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === to[0] && cy === to[1]) {
      const out = [];
      let cur = [cx, cy];
      while (cur) { out.push(cur); cur = prev.get(key(cur[0], cur[1])); }
      return out.reverse();
    }
    for (let d = 0; d < 4; d++) {
      const nx = cx + World.DX[d], ny = cy + World.DY[d];
      if (!w.in(nx, ny)) continue;
      if (w.path[key(nx, ny)] === PATH.NONE) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, [cx, cy]);
      q.push([nx, ny]);
    }
  }
  return null;
}
