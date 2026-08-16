// 联机客户端协议层:连接、入房、应用权威快照与动作、发送本地动作。
import { applyAction } from '../game/actions.js';
import { applyWorldData } from '../game/save.js';

export class NetClient {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.myName = '';
    this.players = [];
    this.connected = false;
    this.onWelcome = null;   // resolve 钩子(main.js 等待完整状态后建世界)
  }

  connect(name) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    this.myName = name;
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify({ type: 'join', name }));
    });
    this.ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this._onMessage(m);
    });
    this.ws.addEventListener('close', () => {
      this.connected = false;
      this.game.messages.add('与服务器断开连接。刷新页面重连。');
    });
    this.ws.addEventListener('error', () => {
      if (!this.connected) this.onWelcome?.(null, new Error('无法连接到服务器'));
    });
  }

  _onMessage(m) {
    const g = this.game;
    switch (m.type) {
      case 'welcome':
        this.connected = true;
        this.players = m.players || [];
        this.onWelcome?.(m);
        break;
      case 'act': {
        const r = applyAction(g, m.action, false);
        if (!r.ok) console.warn('动作应用失败', m.action, r.reason);
        // 本人发起的动作:回执反馈(成本/清空工具等)
        if (m.by === this.myName && g.tools) {
          g.tools.notifyResult(m.action, r.ok ? r : { ok: true, cost: m.actionCost ?? 0 }, null, false);
        }
        break;
      }
      case 'reject':
        if (g.tools) g.tools.notifyResult(m.action || {}, { ok: false, reason: m.reason }, null, false);
        break;
      case 'tick':
        if (g.peeps.applySnapshot) g.peeps.applySnapshot(m.peeps || []);
        if (m.staff && g.staff) g.staff.applySnapshot(m.staff);
        if (m.rideStates && g.rides) {
          for (const [rid, broken, rel] of m.rideStates) {
            const ride = g.rides.findRide(rid);
            if (ride) { ride.broken = !!broken; ride.reliability = rel; }
          }
        }
        for (const [rid, s, mode] of m.coasters || []) {
          const ride = g.rides.findRide(rid);
          if (ride && ride.api?.setExternal) ride.api.setExternal(s, mode);
        }
        if (m.paused !== undefined) g.paused = !!m.paused;
        break;
      case 'litter':
        g.staff?.applyDelta({ ch: m.ch, bins: m.bins });
        break;
      case 'eco': {
        const e = m.data, eco = g.economy;
        Object.assign(eco, {
          cash: e.cash, parkRating: e.rating, monthIdx: e.monthIdx, year: e.year,
          totalGuests: e.totalGuests, entranceFee: e.entranceFee, history: e.history || eco.history,
        });
        if (e.research && g.research) {
          g.research.level = e.research.level;
          g.research.progress = e.research.progress;
          g.research.done = e.research.done;
          g.research.queueIdx = e.research.queueIdx;
        }
        if (e.weather && g.weather) g.weather.mode = e.weather;
        if (e.parkOpen !== undefined) eco.parkOpen = e.parkOpen;
        if (e.loan !== undefined) eco.loan = e.loan;
        if (e.goal) { eco.goal.won = !!e.goal.won; eco.goal.lost = !!e.goal.lost; if (e.goal.text) eco.goal.text = e.goal.text; }
        if (e.thoughts && g.thoughts) g.thoughts.list = e.thoughts;
        eco._emit('change');
        break;
      }
      case 'msg':
        g.messages.add(m.text);
        break;
      case 'players': {
        const before = new Set(this.players);
        this.players = m.players || [];
        const after = new Set(this.players);
        for (const p of after) if (!before.has(p)) g.messages.add(`${p} 进入了公园`);
        for (const p of before) if (!after.has(p)) g.messages.add(`${p} 离开了公园`);
        break;
      }
    }
  }

  sendAction(a) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return { ok: false, reason: '未连接' };
    this.ws.send(JSON.stringify({ type: 'act', action: a }));
    return { ok: true, pending: true };
  }
  sendChat(text) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'chat', text: String(text).slice(0, 120) }));
  }
}
