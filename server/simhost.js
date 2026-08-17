// 服务端权威模拟:headless 跑完整游戏逻辑,接收动作、验证扣钱、广播快照。
// 与客户端共用同一份 src/game 模块 —— 这就是"还原"能保证一致的原因。
import * as THREE from 'three';
import fs from 'node:fs';
import { PATH } from '../src/config.js';
import { World } from '../src/world/world.js';
import { generateTerrain } from '../src/world/terraingen.js';
import { Paths } from '../src/game/paths.js';
import { Scenery } from '../src/game/scenery.js';
import { Rides } from '../src/game/rides.js';
import { Peeps } from '../src/game/peeps.js';
import { Economy } from '../src/game/economy.js';
import { Messages, Thoughts } from '../src/game/messages.js';
import { applyAction, ACTIONS } from '../src/game/actions.js';
import { Research } from '../src/game/research.js';
import { Staff } from '../src/game/staff.js';
import { Weather } from '../src/game/weather.js';
import { encU8, encI16, applyWorldData } from '../src/game/save.js';

const TICK_HZ = 15;          // 模拟频率
const SNAP_MS = 160;         // 快照广播间隔
const ECO_MS = 1200;         // 经济包最小间隔(有变更才发)

export class SimHost {
  constructor({ saveFile = 'park-save.json', seed = 20240815 } = {}) {
    this.saveFile = saveFile;
    this.players = new Map();   // ws → {name}
    this.userPaused = false;
    this.ecoDirty = true;

    const world = new World();
    const loaded = this._loadFile(world);
    if (!loaded) generateTerrain(world, seed);

    const scene = new THREE.Scene();
    const game = {
      world, scene, paused: false, time: 0,
      headless: true, mp: false, ui: null,
    };
    game.economy = new Economy(game);
    game.research = new Research(game);
    game.messages = new Messages();
    game.thoughts = new Thoughts();
    game.weather = new Weather(game);
    game.paths = new Paths(world, scene);
    game.scenery = new Scenery(world, scene);
    game.rides = new Rides(game);
    game.peeps = new Peeps(game);
    game.staff = new Staff(game);
    game.dispatchAction = (a) => applyAction(game, a, true);
    this.game = game;
    this._restoreState();   // 若读档成功,恢复景物/设施/经济

    game.messages.onAdd = (t) => this.broadcast({ type: 'msg', text: t });
    game.economy.on('change', () => { this.ecoDirty = true; });
    game.economy.on('month', () => { this._saveFile(); });

    this._simTimer = setInterval(() => this._tick(1 / TICK_HZ), 1000 / TICK_HZ);
    this._snapTimer = setInterval(() => this._broadcastSnapshot(), SNAP_MS);
    this._ecoTimer = setInterval(() => this._maybeEco(), ECO_MS);
    this._litterTimer = setInterval(() => {
      if (this.players.size === 0) return;
      const d = this.game.staff.drainDelta();
      if (d) this.broadcast({ type: 'litter', ch: d.ch, bins: d.bins });
    }, 700);
    console.log(`[simhost] 公园就绪(${loaded ? '读档' : '新图'} seed=${seed})`);
  }

  // ---------- 存档(文件) ----------
  _loadFile(world) {
    try {
      if (!fs.existsSync(this.saveFile)) return false;
      const d = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
      if (!d || d.v !== 1) return false;
      applyWorldData(world, d.world);
      this._pendingEco = d.economy;
      this._pendingResearch = d.research || null;
      this._pendingStaffArea = d.staffArea || null;
      this._pendingRides = d.rides || [];
      this._pendingRideNextId = d.rideNextId || 1;
      this._pendingScenery = d.scenery || {};
      return true;
    } catch { return false; }
  }
  _restoreState() {
    const g = this.game;
    if (this._pendingScenery) {
      for (const [id, items] of Object.entries(this._pendingScenery)) {
        const rec = g.scenery.types.get(id);
        if (!rec) continue;
        for (const [x, y, rot, scale, tint] of items) rec.items.push({ x, y, rot, scale, tint });
        g.scenery.reindex(rec);
        g.scenery._dirty.add(id);
      }
      g.scenery.rebuildDirty();
    }
    g.rides.nextId = this._pendingRideNextId || 1;
    for (const s of this._pendingRides || []) g.rides.restoreRide(s);
    if (this._pendingEco) {
      const e = this._pendingEco;
      Object.assign(g.economy, {
        cash: e.cash ?? g.economy.cash, monthIdx: e.monthIdx ?? 0, year: e.year ?? 1,
        parkRating: e.rating ?? 400, entranceFee: e.entranceFee ?? 0,
        totalGuests: e.totalGuests ?? 0, history: e.history ?? [],
        loan: e.loan ?? 0, parkOpen: e.parkOpen ?? true,
      });
      this.game.weather.mode = e.weatherMode || 'sun';
      this.game.economy.goal.won = !!e.goalWon;
      this.game.economy.goal.lost = !!e.goalLost;
    }
    if (this._pendingResearch) g.research.restore(this._pendingResearch);
    if (this._pendingStaffArea) g.staff.restoreArea(this._pendingStaffArea);
    this._pendingEco = this._pendingRides = this._pendingScenery = this._pendingResearch = this._pendingStaffArea = null;
  }
  _saveFile() {
    const g = this.game, w = g.world;
    const scenery = {};
    for (const [id, rec] of g.scenery.types) {
      if (rec.items.length) scenery[id] = rec.items.map(it => [it.x, it.y, it.rot, it.scale, it.tint]);
    }
    const data = {
      v: 1,
      world: {
        base: encU8(w.base), slope: encU8(w.slope), surf: encU8(w.surf),
        path: encU8(w.path), addon: encU8(w.addon), obj: encU8(w.obj),
        rideTile: encI16(w.rideTile), owned: encU8(w.owned),
        entrance: w.entrance, entrancePath: w.entrancePath,
      },
      scenery,
      rides: g.rides.list.map(r => ({
        id: r.id, defId: r.def.id, x: r.x, y: r.y, status: r.status, price: r.price,
        guestsServed: r.guestsServed, incomeTotal: r.incomeTotal,
        reliability: r.reliability, broken: r.broken,
        coaster: r.api?.serialize ? r.api.serialize() : null,
        ...(r.custom ? {
          custom: 1, complete: r.complete ? 1 : 0,
          pieces: r.pieces.map(p => [p.t, p.x, p.y, p.h, p.dir]),
          entrance: r.entrance, exit: r.exit,
          excitement: r.excitement, intensity: r.intensity, nausea: r.nausea,
        } : {}),
      })),
      rideNextId: g.rides.nextId,
      research: g.research ? g.research.serialize() : null,
      staffArea: g.staff ? g.staff.serializeArea() : null,
      economy: {
        cash: g.economy.cash, monthIdx: g.economy.monthIdx, year: g.economy.year,
        rating: g.economy.parkRating, entranceFee: g.economy.entranceFee,
        totalGuests: g.economy.totalGuests, history: g.economy.history,
        loan: g.economy.loan, parkOpen: g.economy.parkOpen,
        weatherMode: g.weather.mode, goalWon: g.economy.goal.won, goalLost: g.economy.goal.lost,
      },
    };
    try { fs.writeFileSync(this.saveFile, JSON.stringify(data)); } catch { /* 磁盘满放弃 */ }
  }

  // ---------- 连接 ----------
  attachWebSocket(ws) {
    let joined = null;
    ws.on('message', (buf) => {
      let m;
      try { m = JSON.parse(buf.toString()); } catch { return; }
      if (!joined) {
        if (m.type !== 'join') return;
        joined = this._sanitizeName(m.name);
        let unique = joined, n = 2;
        while ([...this.players.values()].some(p => p.name === unique)) unique = `${joined}#${n++}`;
        joined = unique;
        this.players.set(ws, { name: joined });
        ws.send(JSON.stringify(this._welcome(joined)));
        this.broadcastPlayers();
        console.log(`[simhost] ${joined} 加入 (${this.players.size} 人在线)`);
        return;
      }
      this._onClientMessage(ws, joined, m);
    });
    ws.on('close', () => {
      if (this.players.delete(ws)) {
        this.broadcastPlayers();
        console.log(`[simhost] 离开 (${this.players.size} 人在线)`);
      }
    });
  }
  _sanitizeName(s) {
    return String(s || '玩家').replace(/[<>&"']/g, '').slice(0, 12) || '玩家';
  }

  _welcome(name) {
    const g = this.game, w = g.world;
    const scenery = {};
    for (const [id, rec] of g.scenery.types) {
      if (rec.items.length) scenery[id] = rec.items.map(it => [it.x, it.y, it.rot, it.scale, it.tint]);
    }
    return {
      type: 'welcome',
      world: {
        base: encU8(w.base), slope: encU8(w.slope), surf: encU8(w.surf),
        path: encU8(w.path), addon: encU8(w.addon), obj: encU8(w.obj),
        rideTile: encI16(w.rideTile), owned: encU8(w.owned),
        entrance: w.entrance, entrancePath: w.entrancePath,
      },
      scenery,
      rides: g.rides.list.map(r => ({
        id: r.id, defId: r.def.id, x: r.x, y: r.y, status: r.status, price: r.price,
        guestsServed: r.guestsServed, incomeTotal: r.incomeTotal,
        reliability: r.reliability, broken: r.broken,
        coaster: r.api?.serialize ? r.api.serialize() : null,
        ...(r.custom ? {
          custom: 1, complete: r.complete ? 1 : 0,
          pieces: r.pieces.map(p => [p.t, p.x, p.y, p.h, p.dir]),
          entrance: r.entrance, exit: r.exit,
          excitement: r.excitement, intensity: r.intensity, nausea: r.nausea,
        } : {}),
      })),
      rideNextId: g.rides.nextId,
      research: g.research ? g.research.serialize() : null,
      staffArea: g.staff ? g.staff.serializeArea() : null,
      economy: {
        cash: g.economy.cash, monthIdx: g.economy.monthIdx, year: g.economy.year,
        rating: g.economy.parkRating, entranceFee: g.economy.entranceFee,
        totalGuests: g.economy.totalGuests, history: g.economy.history,
        loan: g.economy.loan, parkOpen: g.economy.parkOpen,
        weatherMode: g.weather.mode, goalWon: g.economy.goal.won, goalLost: g.economy.goal.lost,
      },
      players: [...this.players.values()].map(p => p.name),
      paused: this.userPaused,
    };
  }

  _onClientMessage(ws, name, m) {
    if (m.type === 'chat') {
      this.broadcast({ type: 'msg', text: `${name}: ${String(m.text || '').slice(0, 120)}` });
      return;
    }
    if (m.type !== 'act' || !m.action || !ACTIONS.includes(m.action.type)) return;
    const a = m.action;
    a.by = name;
    if (a.type === 'pause') a.value = !this.userPaused;   // 暂停状态由服务器仲裁
    // 数值走廊校验
    if (['x', 'y'].some(k => a[k] !== undefined && (!Number.isFinite(a[k]) || a[k] < -50 || a[k] > 250))) return;
    const r = applyAction(this.game, a, true);
    if (a.type === 'pause' && r.ok) this.userPaused = a.value;
    if (!r.ok) {
      ws.send(JSON.stringify({ type: 'reject', reason: r.reason, action: a }));
      return;
    }
    this.broadcast({ type: 'act', action: this._stripAction(a), by: name, actionCost: r.cost || 0 });
    this.ecoDirty = true;
  }

  // 广播前剥掉大对象引用(ride 等)
  _stripAction(a) {
    const c = {};
    for (const k of Object.keys(a)) if (k !== 'by') c[k] = a[k];
    return c;
  }
  // ridePlace 时 a.rideId 已由 applyAction 填好;scenery 的 rot/scale/tint 同理 ✓

  broadcast(m) {
    const s = JSON.stringify(m);
    for (const ws of this.players.keys()) {
      if (ws.readyState === 1) ws.send(s);
    }
  }
  broadcastPlayers() {
    this.broadcast({ type: 'players', players: [...this.players.values()].map(p => p.name) });
  }

  // ---------- 主循环 ----------
  _tick(dt) {
    if (this.players.size === 0) return;   // 无人在线,世界冻结
    this.game.paused = this.userPaused;
    if (this.game.paused) return;
    const g = this.game;
    g.economy.update(dt);
    g.rides.update(dt);
    g.peeps.update(dt);
  }

  _broadcastSnapshot() {
    if (this.players.size === 0) return;
    const g = this.game;
    const peeps = [];
    for (const p of g.peeps.list) {
      if (p.state === 'gone') continue;
      peeps.push([
        p.id, Math.round(p.x * 100), Math.round(p.z * 100),
        (p.hidden ? 1 : 0) | (p.hasSouvenir ? 2 : 0) | (p.hasUmbrella ? 4 : 0),
        p.shirtIdx ?? 0, p.skinIdx ?? 0, p.pantsIdx ?? 0, p.balloonIdx ?? 0,
      ]);
    }
    const coasters = [];
    for (const r of g.rides.list) {
      if (r.def.kind === 'coaster' && r.api?.state) {
        coasters.push([r.id, Math.round(r.api.state.s * 100) / 100, r.api.state.mode]);
      }
    }
    const rideStates = g.rides.list.map(r => [r.id, r.broken ? 1 : 0, Math.round(r.reliability ?? 95)]);
    this.broadcast({
      type: 'tick', peeps, coasters, paused: this.userPaused,
      staff: g.staff.snapshot(), rideStates,
    });
  }

  _maybeEco() {
    if (!this.ecoDirty || this.players.size === 0) return;
    this.ecoDirty = false;
    const e = this.game.economy;
    this.broadcast({
      type: 'eco',
      data: {
        cash: e.cash, rating: e.parkRating, monthIdx: e.monthIdx, year: e.year,
        totalGuests: e.totalGuests, entranceFee: e.entranceFee, history: e.history,
        research: this.game.research ? this.game.research.serialize() : null,
        weather: this.game.weather.mode, parkOpen: e.parkOpen, loan: e.loan,
        goal: { won: e.goal.won, lost: e.goal.lost, text: e.goal.text },
        thoughts: this.game.thoughts.list.slice(0, 10),
      },
    });
  }
}
