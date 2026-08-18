// 成就:本地 localStorage 持久化,达成时消息 + 号角;由 UI 周期检查。
export const ACH_DEFS = [
  { id: 'ride1', name: '开门迎客', desc: '开放第一个游乐设施', test: g => g.rides?.list.some(r => r.status === 'open') },
  { id: 'guests100', name: '小有名气', desc: '园内游客达到 100 人', test: g => (g.peeps?.list.length || 0) >= 100 },
  { id: 'guests300', name: '人山人海', desc: '园内游客达到 300 人', test: g => (g.peeps?.list.length || 0) >= 300 },
  { id: 'total1k', name: '门庭若市', desc: '累计接待 1000 名游客', test: g => (g.economy?.totalGuests || 0) >= 1000 },
  { id: 'rich50k', name: '日进斗金', desc: '现金达到 $50,000', test: g => (g.economy?.cash || 0) >= 50000 },
  { id: 'researchAll', name: '科技前沿', desc: '完成全部研发', test: g => g.research && g.research.done.length > 0 && !g.research.current() },
  { id: 'builder', name: '轨道工程师', desc: '建成一条定制轨道设施', test: g => g.rides?.list.some(r => r.custom && r.complete) },
  { id: 'goalWin', name: '剧本赢家', desc: '达成一次剧本目标', test: g => !!g.economy?.goal?.won },
];

const KEY = 'rct2js-ach';

export function loadAchievements() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}
function saveAchievements(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* 无存储环境 */ }
}

// 每 ~0.5s 由 UI 调用一次;返回本轮新达成的成就数
export function checkAchievements(game) {
  if (!game.achievements) game.achievements = loadAchievements();
  let fresh = 0;
  for (const def of ACH_DEFS) {
    if (game.achievements.has(def.id)) continue;
    let ok = false;
    try { ok = def.test(game); } catch { ok = false; }
    if (ok) {
      game.achievements.add(def.id);
      saveAchievements(game.achievements);
      game.messages?.add(`达成成就:「${def.name}」—— ${def.desc}`);
      game.audio?.play('fanfare');
      fresh++;
    }
  }
  return fresh;
}
