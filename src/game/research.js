// 研发:经费档位(月结扣款)→ 持续推进 → 逐个解锁设施。RCT2 的 research 玩法。
// 权威侧(单机/联机服务器)运行推进逻辑;联机客户端只保存状态(经经济包同步)。
import { RIDE_DEFS } from './rides.js';
import { MONTH_SECONDS } from '../config.js';

export const RESEARCH_LEVELS = [
  { name: '无', fee: 0, rate: 0 },
  { name: '最小', fee: 100, rate: 38 },    // 点数/每月
  { name: '普通', fee: 200, rate: 75 },
  { name: '最多', fee: 400, rate: 150 },
];

// 研究队列(顺序解锁);未列入的初始即可用
export const RESEARCH_QUEUE = [
  { id: 'drinks', cost: 80 },
  { id: 'toilet', cost: 70 },
  { id: 'umbrella', cost: 80 },
  { id: 'ferris', cost: 100 },
  { id: 'haunted', cost: 120 },
  { id: 'balloon', cost: 90 },
  { id: 'coffee', cost: 85 },
  { id: 'bumper', cost: 130 },
  { id: 'pirate', cost: 140 },
  { id: 'twist', cost: 110 },
  { id: 'tower', cost: 150 },
  { id: 'woodie', cost: 230 },
];

export class Research {
  constructor(game) {
    this.game = game;
    this.level = 0;          // 档位索引
    this.progress = 0;       // 当前条目的进度(点)
    this.done = [];          // 已完成 id 列表
    this.queueIdx = 0;
  }

  unlocked(defId) {
    if (!RESEARCH_QUEUE.some(q => q.id === defId)) return true;   // 不在队列 → 初始可用
    return this.done.includes(defId);
  }
  current() {
    const item = RESEARCH_QUEUE[this.queueIdx];
    if (!item) return null;
    const def = RIDE_DEFS.find(d => d.id === item.id);
    return def ? { ...item, name: def.name } : null;
  }
  levelName() { return RESEARCH_LEVELS[this.level].name; }
  setLevel(v) { this.level = Math.max(0, Math.min(RESEARCH_LEVELS.length - 1, Math.round(v || 0))); }

  // 仅单机/服务器调用(每秒)
  update(dt) {
    const lv = RESEARCH_LEVELS[this.level];
    if (!lv || lv.rate <= 0) return;
    const cur = this.current();
    if (!cur) return;
    this.progress += lv.rate * dt / MONTH_SECONDS;
    if (this.progress >= cur.cost) {
      this.progress = 0;
      this.done.push(cur.id);
      this.queueIdx++;
      this.game.messages?.add(`研发完成:「${cur.name}」现在可以建造了!`);
      const next = this.current();
      if (next) this.game.messages?.add(`开始研发:${next.name}`);
      this.game.economy?._emit?.('change');
    }
  }

  // 月结:扣经费
  settleMonth(eco) {
    const lv = RESEARCH_LEVELS[this.level];
    if (lv && lv.fee > 0 && this.current()) eco.spend(lv.fee, '研发');
  }

  serialize() { return { level: this.level, progress: this.progress, done: this.done, queueIdx: this.queueIdx }; }
  restore(d) {
    if (!d) return;
    this.level = d.level || 0;
    this.progress = d.progress || 0;
    this.done = d.done || [];
    this.queueIdx = d.queueIdx || 0;
  }
}
