// 关卡(剧本):目标与起始条件;顺序解锁,进度存 localStorage。
// deadlineAbs 语义与 economy.checkGoal 一致:(year-1)*8 + monthIdx > deadlineAbs 即判负。
import { MONTH_NAMES, START_CASH } from '../config.js';

export const SCENARIOS = [
  {
    id: 'meadow', name: '绿野新园', desc: '教学级小目标,轻松上手',
    seed: 20240815, startCash: 12000,
    goal: { guests: 80, rating: 400, deadlineAbs: 7 },      // 第1年10月末
  },
  {
    id: 'lakeside', name: '湖畔乐园', desc: '更宽的湖岸,经营第二年',
    seed: 70707, startCash: START_CASH,
    goal: { guests: 160, rating: 500, deadlineAbs: 15 },    // 第2年10月末
  },
  {
    id: 'goldcoast', name: '黄金海岸', desc: '经典标准(原默认目标)',
    seed: 20240815 ^ 0x51f15e, startCash: START_CASH,
    goal: { guests: 250, rating: 600, deadlineAbs: 15 },
  },
  {
    id: 'valley', name: '峡谷飞跃', desc: '更多游客、更高评分',
    seed: 424242, startCash: 13000,
    goal: { guests: 350, rating: 700, deadlineAbs: 23 },    // 第3年10月末
  },
  {
    id: 'tycoon', name: '大亨试炼', desc: '不赚钱就出局:期末现金大考',
    seed: 900913, startCash: 9000,
    goal: { guests: 300, rating: 600, cash: 30000, deadlineAbs: 23 },
  },
  {
    id: 'utopia', name: '终极乐园', desc: '集结一切所学,冲击顶级乐园',
    seed: 313371, startCash: 15000,
    goal: { guests: 500, rating: 800, deadlineAbs: 31 },    // 第4年10月末
  },
  {
    id: 'twinlakes', name: '双湖鏖战', desc: '湖面分割用地,资金紧凑',
    seed: 60606, startCash: 11000,
    goal: { guests: 420, rating: 720, deadlineAbs: 27 },
  },
  {
    id: 'legend', name: '传奇乐园', desc: '终极考验:游客与现金双高峰',
    seed: 888888, startCash: 16000,
    goal: { guests: 600, rating: 850, cash: 50000, deadlineAbs: 39 },   // 第5年10月末
  },
];
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

export function goalText(sc) {
  const year = Math.floor(sc.goal.deadlineAbs / MONTH_NAMES.length) + 1;
  const month = MONTH_NAMES[sc.goal.deadlineAbs % MONTH_NAMES.length];
  return `第${year}年${month}结束前:游客 ≥ ${sc.goal.guests} 且评分 ≥ ${sc.goal.rating}` +
    (sc.goal.cash ? ` 且现金 ≥ $${sc.goal.cash.toLocaleString('en-US')}` : '');
}

// 把关卡应用到经济系统(新开局时调用)
export function applyScenario(game, sc) {
  game.economy.goal = {
    won: false, lost: false,
    guests: sc.goal.guests, rating: sc.goal.rating, cash: sc.goal.cash || 0,
    deadlineAbs: sc.goal.deadlineAbs, scenarioId: sc.id,
    text: goalText(sc),
  };
  if (sc.startCash) game.economy.cash = sc.startCash;
  game.messages?.add(`关卡「${sc.name}」开始:${game.economy.goal.text}`);
  game.economy._emit('change');
}

// ---------- 解锁进度 ----------
const LKEY = 'rct2js-lv-max';
export function maxUnlocked() {
  try { return Math.max(0, Math.min(SCENARIOS.length - 1, parseInt(localStorage.getItem(LKEY), 10) || 0)); }
  catch { return 0; }
}
// 通关后解锁下一关;返回提示文本(无新解锁返回空串)
export function unlockNext(scenarioId) {
  const i = SCENARIOS.findIndex(s => s.id === scenarioId);
  if (i < 0 || i + 1 >= SCENARIOS.length) return '';
  if (maxUnlocked() >= i + 1) return '';
  try { localStorage.setItem(LKEY, String(i + 1)); } catch { /* 无存储环境则本次不持久化 */ }
  return `已解锁新关卡:「${SCENARIOS[i + 1].name}」(开始页或关卡面板可选)`;
}

// ---------- 奖杯(金银铜牌:按提前完成的程度) ----------
export const MEDALS = ['铜', '银', '金'];
const TKEY = 'rct2js-trophies';
export function getTrophies() {
  try { return JSON.parse(localStorage.getItem(TKEY) || '{}'); } catch { return {}; }
}
// 通关时记录;返回 {medal: 0|1|2, improved} 或 null(非关卡)
export function recordTrophy(scenarioId, monthAbs, deadlineAbs) {
  if (!scenarioId || deadlineAbs <= 0) return null;
  const ratio = monthAbs / deadlineAbs;                 // 完成得越早牌级越高
  const medal = ratio <= 0.55 ? 2 : ratio <= 0.8 ? 1 : 0;
  const all = getTrophies();
  const prev = all[scenarioId];
  const improved = !prev || medal > prev.medal || (medal === prev.medal && monthAbs < prev.monthAbs);
  if (improved) {
    all[scenarioId] = { medal, monthAbs };
    try { localStorage.setItem(TKEY, JSON.stringify(all)); } catch { /* 忽略 */ }
  }
  return { medal, improved };
}
