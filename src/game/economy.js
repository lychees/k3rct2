// 经济:现金、收支分类、日期推进(月结)、公园评分。
import { START_CASH, MONTH_SECONDS, MONTH_NAMES } from '../config.js';
import { unlockNext, recordTrophy, MEDALS } from './scenarios.js';

export class Economy {
  constructor(game) {
    this.game = game;
    this.cash = START_CASH;
    this.monthIdx = 0;          // MONTH_NAMES 索引(3月=0)
    this.year = 1;
    this.timer = 0;
    this.parkRating = 520;      // 0..999,初始中等
    this.entranceFee = 0;       // 门票
    this.totalGuests = 0;
    this.loan = 0;              // 贷款本金
    this.parkOpen = true;       // 园区开放状态
    this.goal = { won: false, lost: false, guests: 250, rating: 600, deadlineAbs: 15,
      text: '第2年10月结束前:游客 ≥ 250 且评分 ≥ 600' };
    this._cashSndAt = -999;     // 收银音效节流(时间戳,秒)
    // 当月收支分类
    this.cur = this.blankMonth();
    this.history = [];          // 已结算月份
    this.ratingHistory = [];    // 评分曲线(月采样,公园面板图表)
    this.guestHistory = [];     // 游客数曲线(同上采样节奏)
    this.listeners = { month: [], change: [] };
  }
  sampleRating() {
    this.ratingHistory.push(Math.round(this.parkRating));
    if (this.ratingHistory.length > 48) this.ratingHistory.shift();
    this.guestHistory.push(this.game.peeps ? this.game.peeps.list.length : 0);
    if (this.guestHistory.length > 48) this.guestHistory.shift();
  }
  blankMonth() {
    return { 建设: 0, 景观: 0, 门票: 0, 设施: 0, 商店: 0, 工资: 0, 研发: 0, 利息: 0 };
  }
  on(ev, fn) { this.listeners[ev].push(fn); }
  _emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }

  fmt(c) { return (c < 0 ? '-' : '') + '$' + Math.abs(Math.round(c)).toLocaleString('en-US'); }
  dateStr() { return `${MONTH_NAMES[this.monthIdx]}, 第${this.year}年`; }

  spend(amount, cat = '建设') {
    this.cash -= amount;
    if (this.cur[cat] === undefined) this.cur[cat] = 0;
    this.cur[cat] -= amount;
    this._emit('change');
  }
  earn(amount, cat) {
    this.cash += amount;
    if (this.cur[cat] === undefined) this.cur[cat] = 0;
    this.cur[cat] += amount;
    this._emit('change');
    // 收银声:游客消费类收入才响,节流避免密集叮叮
    if (amount > 0 && (cat === '设施' || cat === '商店' || cat === '门票')) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      if (now - this._cashSndAt > 0.3) { this._cashSndAt = now; this.game.audio?.play('cash'); }
    }
  }
  trySpend(amount, cat) {   // 建造类消费:返回 false 表示钱不够(不允许负债建)
    if (this.cash - amount < -5000) return false;
    this.spend(amount, cat);
    return true;
  }

  update(dt) {
    if (this.game.paused || this.game.mp) return;   // 联机客户端经济由服务端推送
    this.timer += dt;
    if (this.timer >= MONTH_SECONDS) {
      this.timer -= MONTH_SECONDS;
      this.settleMonth();
    }
    this.computeRating(dt);
    this.game.research?.update(dt);
  }
  settleMonth() {
    const g = this.game;
    // 设施月度维护
    let upkeep = 0;
    if (g.rides) for (const r of g.rides.list) { upkeep += r.def.upkeep; r.ageMonths = (r.ageMonths || 0) + 1; }   // 园龄+1月
    if (upkeep) this.spend(upkeep, '工资');
    // 员工工资
    if (g.staff) { const w2 = g.staff.monthlyWages(); if (w2) this.spend(w2, '工资'); }
    // 研发经费
    if (g.research) g.research.settleMonth(this);
    this.history.push({ ...this.cur, 月份: this.dateStr() });
    if (this.history.length > 16) this.history.shift();
    this.cur = this.blankMonth();
    this.sampleRating();
    this.monthIdx++;
    if (this.monthIdx >= MONTH_NAMES.length) { this.monthIdx = 0; this.year++; }
    // 贷款利息(1%/月)
    if (this.loan > 0) this.spend(Math.max(1, Math.round(this.loan * 0.01)), '利息');
    // 天气轮转
    if (g.weather) g.weather.updateMonthly();
    // 破产保护:现金跌破建造下限(-4900)即判负
    const go2 = this.goal;
    if (this.cash <= -4900 && !go2.won && !go2.lost) {
      go2.lost = true;
      g.messages?.add('资不抵债,公园破产了!');
      g.audio?.play('lose');
      g.ui?.panels?.open('gameover');
    }
    // 剧本目标判定
    this.checkGoal(g);
    this._emit('month');
    this._emit('change');
  }

  checkGoal(g) {
    const go = this.goal;
    if (go.won || go.lost) return;
    const monthAbs = (this.year - 1) * MONTH_NAMES.length + this.monthIdx;   // 当前月(已推进后)
    const guests = g.peeps ? g.peeps.list.length : 0;
    const cashOk = !go.cash || this.cash >= go.cash;   // 现金类关卡需额外达标
    if (guests >= go.guests && this.parkRating >= go.rating && cashOk) {
      go.won = true;
      const unlock = go.scenarioId ? unlockNext(go.scenarioId) : '';
      let trophyMsg = '';
      if (go.scenarioId) {
        const tr = recordTrophy(go.scenarioId, monthAbs, go.deadlineAbs);
        if (tr) trophyMsg = ` 获得${MEDALS[tr.medal]}奖杯!`;
      }
      g.messages?.add(`达成目标!游客 ${guests}、评分 ${Math.round(this.parkRating)}` +
        (go.cash ? `、现金 ${this.fmt(this.cash)}` : '') + trophyMsg + (unlock ? ' ' + unlock : '') + ' —— 干得漂亮!');
      g.audio?.play('win');
      g.ui?.panels?.open('gameover');
    } else if (monthAbs > go.deadlineAbs) {
      go.lost = true;
      g.messages?.add(`未能按期完成目标(${go.text}),园区继续经营,再接再厉`);
      g.audio?.play('lose');
      g.ui?.panels?.open('gameover');
    }
  }

  // 评分:基于游客开心度均值、设施数、垃圾/故障等(简化)
  computeRating(dt) {
    const g = this.game;
    let target = 320;
    if (g.peeps && g.peeps.list.length) {
      const n = g.peeps.list.length;
      let happy = 0;
      for (const p of g.peeps.list) happy += p.happiness;
      happy /= n;
      target = 140 + happy * 4.4 + Math.min(n, 150) * 1.8;
      if (g.rides) {
        target += Math.min(g.rides.list.filter(r => r.status === 'open' && !r.broken).length, 8) * 18;
        target -= g.rides.list.filter(r => r.broken).length * 12;
      }
      if (g.staff && g.staff.litterTiles) target -= Math.min(220, g.staff.litterTiles() * 3);
    }
    target = Math.max(0, Math.min(999, target));
    this.parkRating += (target - this.parkRating) * Math.min(1, dt * 0.12);
  }
}
