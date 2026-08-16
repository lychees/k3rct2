// 存档:localStorage 序列化整个世界状态;启动时可自动载入。
import { MAP_W, MAP_H } from '../config.js';

const KEY = 'rct2js-save-v1';

export function encU8(a) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < a.length; i += CH) s += String.fromCharCode.apply(null, a.subarray(i, i + CH));
  return btoa(s);
}
export function decU8(s, n) {
  const bin = atob(s);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function encI16(a) { return encU8(new Uint8Array(a.buffer)); }
export function decI16(s, n) {
  const bin = atob(s);
  const out = new Int16Array(n);
  const b = new Uint8Array(out.buffer);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return out;
}

export function peekSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.v === 1 && d.world) return d;
  } catch { /* 损坏则忽略 */ }
  return null;
}

export class Saves {
  constructor(game) {
    this.game = game;
    game.economy.on('month', () => {
      this._monthCount = (this._monthCount || 0) + 1;
      if (this._monthCount % 2 === 0) this.save();
    });
  }

  hasSave() { return !!peekSave(); }
  clear() { localStorage.removeItem(KEY); }

  save() {
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
      })),
      rideNextId: g.rides.nextId,
      research: g.research ? g.research.serialize() : null,
      staffArea: g.staff ? g.staff.serializeArea() : null,
      economy: {
        cash: g.economy.cash, monthIdx: g.economy.monthIdx, year: g.economy.year,
        rating: g.economy.parkRating, entranceFee: g.economy.entranceFee,
        totalGuests: g.economy.totalGuests, history: g.economy.history,
        loan: g.economy.loan, parkOpen: g.economy.parkOpen,
        weatherMode: g.weather?.mode || 'sun', goalWon: g.economy.goal.won, goalLost: g.economy.goal.lost,
      },
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch { /* 容量满则放弃本次 */ }
  }

  // 启动时读档:world 已按存档数据初始化(见 applyWorldToSave),系统已构建后调用
  apply(data) {
    const g = this.game;
    // 景观
    for (const [id, items] of Object.entries(data.scenery || {})) {
      const rec = g.scenery.types.get(id);
      if (!rec) continue;
      for (const [x, y, rot, scale, tint] of items) {
        rec.items.push({ x, y, rot, scale, tint });
      }
      g.scenery.reindex(rec);
      g.scenery._dirty.add(id);
    }
    g.scenery.rebuildDirty();
    // 设施
    g.rides.nextId = data.rideNextId || 1;
    for (const s of data.rides || []) g.rides.restoreRide(s);
    // 经济
    const e = data.economy || {};
    Object.assign(g.economy, {
      cash: e.cash ?? g.economy.cash, monthIdx: e.monthIdx ?? 0, year: e.year ?? 1,
      parkRating: e.rating ?? 400, entranceFee: e.entranceFee ?? 0,
      totalGuests: e.totalGuests ?? 0, history: e.history ?? [],
      loan: e.loan ?? 0, parkOpen: e.parkOpen ?? true,
    });
    if (e.weatherMode && g.weather) g.weather.mode = e.weatherMode;
    if (g.economy.goal) { g.economy.goal.won = !!e.goalWon; g.economy.goal.lost = !!e.goalLost; }
    if (data.research) g.research?.restore(data.research);
    if (data.staffArea) g.staff?.restoreArea(data.staffArea);
  }

  load() { location.reload(); }   // 启动时 peekSave 存在即自动恢复
}

// 把存档的世界数组写入新生成的 world(main.js 在生成地形前调用)
export function applyWorldData(world, d) {
  const n = MAP_W * MAP_H;
  world.base.set(decU8(d.base, n));
  world.slope.set(decU8(d.slope, n));
  world.surf.set(decU8(d.surf, n));
  world.path.set(decU8(d.path, n));
  world.addon.set(decU8(d.addon, n));
  world.obj.set(decU8(d.obj, n));
  world.rideTile.set(decI16(d.rideTile, n));
  world.owned.set(decU8(d.owned, n));
  world.entrance = d.entrance;
  world.entrancePath = d.entrancePath;
}
