// 统一动作层:所有改世界操作收敛到这里。
// - 单机:tools/UI 直接调用(charge=true,本地扣钱)
// - 联机服务端:客户端发来动作 → 校验 + 从共享资金扣钱(charge=true)→ 广播
// - 联机客户端:收到广播 → 复现世界变更(charge=false,经济由服务端包覆写)
import { PATH, ADDON, PRICE, MIN_H, MAX_H } from '../config.js';
import { SCENERY_BY_ID } from './scenery.js';
import { RESEARCH_QUEUE } from './research.js';
import { DEF_BY_ID } from './rides.js';

export const ACTIONS = [
  'land', 'path', 'pathRemove', 'addon', 'addonRemove',
  'scenery', 'sceneryRemove', 'ridePlace', 'rideRemove', 'rideStatus', 'ridePrice', 'rideGate',
  'entranceFee', 'researchLevel', 'staffHire', 'staffFire', 'loanBorrow', 'loanRepay', 'parkOpen', 'pause', 'chat',
  'cheatMoney', 'researchAll', 'coasterBegin', 'coasterPiece', 'coasterUndo', 'coasterFinish',
];

export function applyAction(g, a, charge = true) {
  const w = g.world, eco = g.economy;
  switch (a.type) {
    case 'land': {
      const size = clampInt(a.size, 1, 5);
      const mode = ['raise', 'lower', 'level'].includes(a.mode) ? a.mode : 'raise';
      const x0 = a.x - Math.floor(size / 2), y0 = a.y - Math.floor(size / 2);
      if (!w.in(a.x, a.y)) return fail('位置无效');
      const target = w.base[w.idx(a.x, a.y)];
      let changed = 0;
      for (let y = y0; y < y0 + size; y++) {
        for (let x = x0; x < x0 + size; x++) {
          if (!w.ownedAt(x, y)) continue;
          let ok = false;
          if (mode === 'raise') ok = w.raiseTile(x, y, 1);
          else if (mode === 'lower') ok = w.raiseTile(x, y, -1);
          else ok = w.levelTile(x, y, target);
          if (ok) changed++;
        }
      }
      if (!changed) return fail(mode === 'lower' ? '不能再低了' : '无法再抬升');
      w.emit('terrain', x0, y0, x0 + size - 1, y0 + size - 1);
      const price = mode === 'lower' ? PRICE.landLower : PRICE.landRaise;
      const cost = price * changed;
      if (charge) { if (!eco.trySpend(cost, '建设')) { /* 允许小幅负债 */ } }
      return { ok: true, cost };
    }
    case 'path': {
      const r = g.paths.place(a.x, a.y, a.kind === PATH.QUEUE ? PATH.QUEUE : PATH.TARMAC);
      if (!r.ok) return fail(r.reason);
      if (charge) eco.trySpend(r.cost, '建设');
      return { ok: true, cost: r.cost };
    }
    case 'pathRemove': {
      const r = g.paths.remove(a.x, a.y);
      if (!r.ok) return fail(r.reason);
      if (charge) eco.earn(-r.cost, '建设');
      return { ok: true, cost: r.cost };
    }
    case 'addon': {
      const r = g.paths.placeAddon(a.x, a.y, a.addon);
      if (!r.ok) return fail(r.reason);
      if (charge) eco.trySpend(r.cost, '建设');
      return { ok: true, cost: r.cost };
    }
    case 'addonRemove': {
      const i = w.idx(a.x, a.y);
      if (!w.in(a.x, a.y) || w.addon[i] === ADDON.NONE) return fail('没有附件');
      w.addon[i] = ADDON.NONE;
      w.emit('path', a.x, a.y, a.x, a.y);
      if (charge) eco.earn(2, '建设');
      return { ok: true, cost: -2 };
    }
    case 'scenery': {
      const preset = (a.rot !== undefined) ? { rot: a.rot, scale: a.scale, tint: a.tint } : null;
      const r = g.scenery.place(a.id, a.x, a.y, preset);
      if (!r.ok) return fail(r.reason);
      if (!preset) { // 单机或服务端生成权威随机参数
        const rec = g.scenery.types.get(a.id);
        const it = rec.items[rec.items.length - 1];
        a.rot = it.rot; a.scale = it.scale; a.tint = it.tint;
      }
      if (charge) eco.trySpend(r.cost, '景观');
      return { ok: true, cost: r.cost };
    }
    case 'sceneryRemove': {
      const r = g.scenery.removeAt(a.x, a.y);
      if (!r.ok) return fail(r.reason || '没有景物');
      if (charge) eco.earn(-r.cost, '景观');
      return { ok: true, cost: r.cost };
    }
    case 'ridePlace': {
      const def = DEF_BY_ID[a.id];
      if (def?.custom) return fail('定制过山车请使用轨道编辑器建造');
      if (charge && g.research && !g.research.unlocked(a.id)) return fail('尚未研发该设施');
      const r = g.rides.place(a.id, a.x, a.y, a.rideId);
      if (!r.ok) return fail(r.reason);
      a.rideId = r.ride.id;
      if (charge) eco.trySpend(r.cost, '建设');
      return { ok: true, cost: r.cost, ride: r.ride };
    }
    case 'rideGate': {
      const r = g.rides.setGate(a.rideId, a.which, a.x, a.y);
      if (!r.ok) return fail(r.reason);
      const ride = g.rides.findRide(a.rideId);
      if (charge) g.messages?.add(`${a.by ? a.by + ' ' : ''}调整了「${ride.def.name}」的${a.which === 'entrance' ? '入口' : '出口'}`);
      return { ok: true, cost: 0 };
    }
    case 'rideStatus': {
      const ride = g.rides.findRide(a.rideId);
      if (!ride) return fail('设施不存在');
      if (!['closed', 'test', 'open'].includes(a.status)) return fail('状态无效');
      if (a.status === 'open' && charge && !g.rides.gateConnected(ride, 'entrance')) {
        return fail('入口未接通路径:先用"设入口"接入路径');
      }
      if (a.status === 'open' && ride.def.custom && !ride.complete) return fail('轨道尚未闭环,不能开放');
      ride.status = a.status;
      if (charge) g.messages?.add(`「${ride.def.name}」已${{ closed: '关闭', test: '测试', open: '开放' }[a.status]}${a.by ? '(' + a.by + ')' : ''}`);
      return { ok: true, cost: 0 };
    }
    case 'rideRemove': {
      const ride = g.rides.findRide(a.rideId);
      if (!ride) return fail('设施不存在');
      const r = g.rides.remove(a.rideId);
      if (!r.ok) return fail(r.reason || '');
      if (charge) {
        eco.earn(-r.cost, '建设');
        g.messages?.add(`${a.by ? a.by + ' ' : ''}拆除了「${ride.def.name}」,返还 ${eco.fmt(-r.cost)}`);
      }
      return { ok: true, cost: r.cost };
    }
    case 'ridePrice': {
      const ride = g.rides.findRide(a.rideId);
      if (!ride) return fail('设施不存在');
      ride.price = Math.max(0, Math.min(20, Math.round(a.price * 2) / 2));
      return { ok: true, cost: 0 };
    }
    case 'entranceFee': {
      g.economy.entranceFee = Math.max(0, Math.min(60, Math.round(a.value)));
      return { ok: true, cost: 0 };
    }
    case 'researchLevel': {
      if (g.research) {
        g.research.setLevel(a.value);
        if (charge && g.research.current()) {
          g.messages?.add(`研发经费调整:${g.research.levelName()}${g.research.current() ? ',研发中:' + g.research.current().name : ''}`);
        }
      }
      return { ok: true, cost: 0 };
    }
    case 'loanBorrow': {
      if (charge) {
        if (eco.loan + 2000 > 20000) return fail('贷款已达上限 $20,000');
        eco.loan += 2000;
        eco.cash += 2000;
        a.total = eco.loan; a.cash = eco.cash;
        eco._emit('change');
      } else { eco.loan = a.total ?? eco.loan; eco.cash = a.cash ?? eco.cash; }
      return { ok: true, cost: 0 };
    }
    case 'loanRepay': {
      if (charge) {
        if (eco.loan < 2000) return fail('没有可还贷款');
        if (eco.cash < 2000) return fail('现金不足');
        eco.loan -= 2000;
        eco.cash -= 2000;
        a.total = eco.loan; a.cash = eco.cash;
        eco._emit('change');
      } else { eco.loan = a.total ?? eco.loan; eco.cash = a.cash ?? eco.cash; }
      return { ok: true, cost: 0 };
    }
    case 'parkOpen': {
      eco.parkOpen = !!a.value;
      if (charge) g.messages?.add(eco.parkOpen ? '公园已重新开放迎客' : '公园暂停开放(不再进新游客)');
      return { ok: true, cost: 0 };
    }
    case 'pause': {
      g.paused = !!a.value;
      return { ok: true, cost: 0 };
    }
    case 'staffHire': {
      if (!g.staff) return fail('无员工系统');
      const r = g.staff.hire(a.role);
      if (!r.ok) return fail(r.reason);
      if (charge) eco.trySpend(r.cost, '工资');
      return { ok: true, cost: r.cost };
    }
    case 'staffFire': {
      if (!g.staff) return fail('无员工系统');
      const r = g.staff.fire(a.id);
      if (!r.ok) return fail(r.reason || '员工不存在');
      return { ok: true, cost: 0 };
    }
    case 'cheatMoney': {   // 开发者控制台:印钱(直接进现金,不计收支流水)
      const amount = Math.max(1, Math.min(1000000, Math.round(a.amount || 10000)));
      if (charge) {
        eco.cash += amount;
        a.amount = amount;
        a.cash = eco.cash;
        eco._emit('change');
        g.messages?.add(`${a.by ? a.by + ' ' : ''}开发者控制台:印钞 ${eco.fmt(amount)}`);
      } else {
        eco.cash = a.cash ?? eco.cash;
        eco._emit('change');
      }
      return { ok: true, cost: 0 };
    }
    case 'researchAll': {  // 开发者控制台:一键完成所有研究
      if (!g.research) return fail('无研发系统');
      if (charge) {
        g.research.done = RESEARCH_QUEUE.map(q => q.id);
        g.research.queueIdx = RESEARCH_QUEUE.length;
        g.research.progress = 0;
        a.done = g.research.done.slice();
        a.queueIdx = g.research.queueIdx;
        eco._emit('change');
        g.messages?.add(`${a.by ? a.by + ' ' : ''}开发者控制台:全部研究已完成`);
      } else {
        g.research.done = a.done || RESEARCH_QUEUE.map(q => q.id);
        g.research.queueIdx = a.queueIdx ?? g.research.done.length;
        g.research.progress = 0;
        eco._emit('change');
      }
      return { ok: true, cost: 0 };
    }
    case 'coasterBegin': {   // 定制过山车:放站台段,进入建造
      if (charge && g.research && !g.research.unlocked('woodie')) return fail('尚未研发过山车');
      const r = g.rides.beginCustom(a.x, a.y, Math.max(0, Math.min(3, Math.round(a.dir ?? 1))), a.rideId);
      if (!r.ok) return fail(r.reason);
      a.rideId = r.ride.id;
      if (charge) eco.trySpend(r.cost, '建设');
      return { ok: true, cost: r.cost, ride: r.ride };
    }
    case 'coasterPiece': {
      const r = g.rides.addPiece(a.rideId, a.piece);
      if (!r.ok) return fail(r.reason);
      if (charge) eco.trySpend(r.cost, '建设');
      return { ok: true, cost: r.cost };
    }
    case 'coasterUndo': {
      const r = g.rides.undoPiece(a.rideId);
      if (!r.ok) return fail(r.reason);
      if (charge && r.cost < 0) eco.earn(-r.cost, '建设');
      return { ok: true, cost: r.cost };
    }
    case 'coasterFinish': {
      const r = g.rides.finishCustom(a.rideId);
      if (!r.ok) return fail(r.reason);
      if (charge) {
        const ride = g.rides.findRide(a.rideId);
        g.messages?.add(`过山车闭环建成!兴奋 ${ride.excitement}/强度 ${ride.intensity} —— 设好出入口即可开放`);
      }
      return { ok: true, cost: 0 };
    }
  }
  return fail('未知动作');
}

function fail(reason) { return { ok: false, reason: reason || '失败' }; }
function clampInt(v, lo, hi) { v = Math.round(v || 1); return Math.max(lo, Math.min(hi, v)); }
