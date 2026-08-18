// 点选小人弹出的状态窗:游客=需求五维/状态/现金,员工=岗位/工作状态。250ms 自动刷新,离园自动关闭。
import { STAFF_ROLES } from '../game/staff.js';

const GUEST_STATES = {
  enter: '入园中', wander: '逛园中', queue: '排队中', ride: '乘坐中',
  shopping: '购物中', leaving: '正在出园', gone: '已离园',
};

export function openPeepWindow(game, wm, kind, id) {
  const wid = `peep-${kind}-${id}`;
  if (wm.get(wid)) { wm.close(wid); return null; }
  return wm.open({
    id: wid,
    title: kind === 'staff' ? `员工 #${id}` : `游客 #${id}`,
    x: Math.max(60, window.innerWidth / 2 - 300), y: 90, width: 230,
    build(el, w) {
      const d = document.createElement('div');
      d.style.minWidth = '200px';
      el.appendChild(d);
      const followBtn = document.createElement('button');
      followBtn.className = 'rct-btn small';
      followBtn.textContent = '跟随';
      followBtn.title = '镜头持续跟随(等距视角;Esc 或离园自动停止)';
      followBtn.addEventListener('click', () => {
        const rec = kind === 'staff'
          ? game.staff?.list.find(s => s.id === id)
          : game.peeps?.list.find(p => p.id === id);
        if (!rec) return;
        game.followPeep = game.followPeep === rec ? null : rec;
        game.audio?.play('click');
        w.refresh();
      });
      el.appendChild(followBtn);
      // 0..1 需求条;invert=true 时值高为红(饿/渴/内急/晕)
      const bar = (label, v, invert = false) => {
        const pct = Math.round(Math.max(0, Math.min(1, v ?? 0)) * 100);
        const bad = invert ? pct > 70 : pct < 30;
        return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="width:38px">${label}</span>
          <div style="flex:1;background:rgba(20,24,34,0.85);border-radius:3px;height:9px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${bad ? '#e86a50' : '#7ec850'}"></div>
          </div>
          <span style="width:30px;text-align:right;font-size:11px">${pct}%</span></div>`;
      };
      w.refresh = () => {
        const rec = kind === 'staff'
          ? game.staff?.list.find(s => s.id === id)
          : game.peeps?.list.find(p => p.id === id);
        if (!rec) { wm.close(wid); return; }   // 离园/解雇 → 自动关窗
        followBtn.textContent = game.followPeep === rec ? '停止跟随' : '跟随';
        if (kind === 'staff') {
          const def = STAFF_ROLES.find(r => r.id === rec.role);
          const stateText = rec.target ? '前往任务' : (rec.state === 'work' ? '作业中' : (rec.working ? '作业中' : '巡逻中'));
          d.innerHTML = `
            <div>岗位:<b class="money">${def?.name || rec.role}</b>(月薪 $${def?.salary ?? '?'})</div>
            <div>状态:${stateText}</div>
            <div class="hint" style="margin-top:4px">${def?.desc || ''}</div>`;
        } else {
          const ride = rec.queueRide;
          const st = GUEST_STATES[rec.state] || rec.state;
          d.innerHTML = `
            <div>状态:${st}${ride ? `「${ride.def.name}」` : ''}${rec.hasSouvenir ? ' · 有纪念品' : ''}${rec.hasUmbrella ? ' · 带伞' : ''}</div>
            <div class="hint">${rec.kid ? '儿童' : '成人'} · 刺激偏好 ${Math.round((rec.thrill ?? 0.5) * 100)}%${rec.groupId ? ' · 家庭组 #' + rec.groupId : ''}</div>
            <div style="margin:3px 0"></div>
            ${bar('开心', rec.happiness)}
            ${bar('饥饿', rec.hunger, true)}
            ${bar('口渴', rec.thirst, true)}
            ${bar('体力', rec.energy)}
            ${bar('内急', rec.bladder, true)}
            ${rec.nausea > 0.25 ? bar('晕眩', rec.nausea, true) : ''}
            <div class="hint" style="margin-top:4px">现金 ${game.economy.fmt(rec.cash ?? 0)}</div>`;
        }
      };
      w.refresh();
    },
  });
}
