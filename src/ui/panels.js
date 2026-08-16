// 各类建造/管理面板:整地、景观、路径、设施、商店、游客、财务、公园、存档。
import { PATH, ADDON, PRICE, MAP_W, MAP_H } from '../config.js';
import { SCENERY_TYPES } from '../game/scenery.js';
import { RIDE_DEFS, DEF_BY_ID } from '../game/rides.js';
import { RESEARCH_LEVELS, RESEARCH_QUEUE } from '../game/research.js';
import { STAFF_ROLES } from '../game/staff.js';

const PANEL_POS = {
  land: [70, 60], scenery: [100, 70], path: [130, 80], rides: [160, 90], shops: [190, 100],
  peeps: [window.innerWidth - 300, 60], finance: [window.innerWidth - 340, 80],
  park: [window.innerWidth - 320, 100], save: [90, 90], mp: [window.innerWidth - 320, 130],
  research: [230, 120], staff: [window.innerWidth - 360, 60], map: [60, 50],
};

export class Panels {
  constructor(game, winman) {
    this.game = game;
    this.wm = winman;
  }

  open(name) {
    const [x, y] = PANEL_POS[name] || [80, 60];
    const builder = this['build_' + name];
    if (!builder) return;
    this.wm.toggle({
      id: 'panel-' + name, title: this.titleOf(name), x, y,
      build: (el, w) => builder.call(this, el, w),
      onClose: () => this.onClose(name),
    });
    this.game.tools.clearTool();
    this.game.ui.refreshToolbar();
  }

  titleOf(name) {
    return {
      land: '整地', scenery: '景观', path: '路径', rides: '游乐设施', shops: '商店',
      peeps: '游客', finance: '财务', park: '公园信息', save: '存档', mp: '联机', research: '研发',
      staff: '员工', map: '园区地图',
    }[name] || name;
  }

  onClose(name) {
    // 关闭对应面板时取消工具
    const t = this.game.tools.tool?.type;
    const map = { land: 'land', scenery: 'scenery', path: ['path', 'addon'], rides: 'ride', shops: 'shop' };
    const m = map[name];
    if (m && (m === t || (Array.isArray(m) && m.includes(t)))) {
      this.game.tools.clearTool();
      this.game.ui.refreshToolbar();
    }
  }

  _btn(text, onclick, cls = '') {
    const b = document.createElement('button');
    b.className = 'rct-btn ' + cls;
    b.textContent = text;
    b.addEventListener('click', onclick);
    return b;
  }
  _row(el, ...nodes) {
    const r = document.createElement('div');
    r.className = 'rct-row';
    r.append(...nodes);
    el.appendChild(r);
    return r;
  }
  _hint(el, text) {
    const d = document.createElement('div');
    d.className = 'hint';
    d.textContent = text;
    el.appendChild(d);
    return d;
  }
  _selectTool(tool, activeBtn, container) {
    for (const b of container.querySelectorAll('.rct-btn, .rct-item')) b.classList.remove('active', 'selected');
    if (activeBtn) activeBtn.classList.add(activeBtn.classList.contains('rct-item') ? 'selected' : 'active');
    this.game.tools.setTool(tool);
    this.game.ui.refreshToolbar();
  }

  // ---------- 整地 ----------
  build_land(el, w) {
    const g = this.game;
    let mode = 'raise', size = 2;
    const apply = () => g.tools.setTool({ type: 'land', mode, size });
    this._hint(el, '点击地面应用;按住拖动可连续整地');
    this._row(el,
      this._btn('抬升', e => { mode = 'raise'; sync(e.target); }),
      this._btn('压低', e => { mode = 'lower'; sync(e.target); }),
      this._btn('整平', e => { mode = 'level'; sync(e.target); }),
    );
    const sizeRow = [];
    for (let s = 1; s <= 5; s++) sizeRow.push(this._btn(`${s}×${s}`, e => { size = s; sync(null, e.target); }, 'small'));
    this._row(el, ...sizeRow);
    const sync = (modeBtn, sizeBtn) => {
      el.querySelectorAll('.rct-row')[0].querySelectorAll('.rct-btn').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.rct-row')[1].querySelectorAll('.rct-btn').forEach(b => b.classList.remove('active'));
      if (modeBtn) modeBtn.classList.add('active'); else el.querySelectorAll('.rct-row')[0].firstChild.classList.add('active');
      if (!sizeBtn) sizeBtn = el.querySelectorAll('.rct-row')[1].children[size - 1];
      sizeBtn?.classList.add('active');
      apply();
    };
    sync(null, null);
  }

  // ---------- 景观 ----------
  build_scenery(el, w) {
    const g = this.game;
    const list = document.createElement('div');
    list.className = 'rct-list';
    for (const t of SCENERY_TYPES) {
      const item = document.createElement('div');
      item.className = 'rct-item';
      item.innerHTML = `<span>${t.name}</span><span class="price">$${t.price}</span>`;
      item.addEventListener('click', () => this._selectTool({ type: 'scenery', id: t.id }, item, list));
      list.appendChild(item);
    }
    el.appendChild(list);
    this._hint(el, '点击列表选择,再点草地种植。右键取消(Esc)。');
  }

  // ---------- 路径 ----------
  build_path(el, w) {
    const g = this.game;
    this._row(el,
      this._btn('主路 $' + PRICE.path, e => this._selectTool({ type: 'path', kind: PATH.TARMAC }, e.target, el)),
      this._btn('排队通道 $' + PRICE.queue, e => this._selectTool({ type: 'path', kind: PATH.QUEUE }, e.target, el)),
    );
    this._row(el,
      this._btn('长椅 $' + PRICE.bench, e => this._selectTool({ type: 'addon', addon: ADDON.BENCH }, e.target, el)),
      this._btn('路灯 $' + PRICE.lamp, e => this._selectTool({ type: 'addon', addon: ADDON.LAMP }, e.target, el)),
      this._btn('垃圾桶 $' + PRICE.bin, e => this._selectTool({ type: 'addon', addon: ADDON.BIN }, e.target, el)),
    );
    this._row(el, this._btn('拆除模式', e => this._selectTool({ type: 'remove' }, e.target, el)));
    this._hint(el, '主路/排队按住拖动连续铺设;附件装在主路白边上。');
  }

  // ---------- 设施 ----------
  build_rides(el, w) { this._rideList(el, 'ride', w); }
  build_shops(el, w) { this._rideList(el, 'shop', w); }
  _rideList(el, cat, w) {
    const g = this.game;
    const list = document.createElement('div');
    list.className = 'rct-list';
    const rebuild = () => {
      list.innerHTML = '';
      for (const d of RIDE_DEFS.filter(d => d.cat === cat)) {
        const locked = g.research && !g.research.unlocked(d.id);
        const item = document.createElement('div');
        item.className = 'rct-item';
        if (locked) item.style.opacity = '0.45';
        item.innerHTML = `<span>${d.name}<div class="sub">${d.w}×${d.h} · ${d.desc}</div></span><span class="price">${locked ? '未研发' : '$' + d.cost}</span>`;
        if (!locked) {
          item.addEventListener('click', () => this._selectTool({ type: cat === 'ride' ? 'ride' : 'shop', id: d.id }, item, list));
        } else {
          item.title = '通过研发解锁';
          item.style.cursor = 'default';
        }
        list.appendChild(item);
      }
    };
    rebuild();
    el.appendChild(list);
    this._hint(el, '选择后移动到目标位置,绿=可放置;设施窗口里可设出入口。');
    // 已建列表
    const exist = document.createElement('div');
    exist.className = 'hint';
    el.appendChild(exist);
    const renderExisting = () => {
      const mine = g.rides.list.filter(r => r.def.cat === cat);
      exist.innerHTML = mine.length ? '<div class="rct-sep"></div>已建:' + mine.map(r =>
        ` <a href="#" data-ride="${r.id}" style="color:#9fd0ff">${r.def.name}#${r.id}</a>`).join('') : '';
      exist.querySelectorAll('a[data-ride]').forEach(a => a.addEventListener('click', ev => {
        ev.preventDefault();
        g.rides.openWindow(Number(a.dataset.ride));
      }));
    };
    renderExisting();
    w.refresh = () => { rebuild(); renderExisting(); };
  }

  // ---------- 游客 ----------
  build_peeps(el, w) {
    const g = this.game;
    const d = document.createElement('div');
    el.appendChild(d);
    const tl = document.createElement('div');
    tl.className = 'rct-list';
    tl.style.maxHeight = '150px';
    tl.style.fontSize = '11px';
    el.appendChild(tl);
    w.refresh = () => {
      const n = g.peeps.list.length;
      let happy = 0;
      for (const p of g.peeps.list) happy += p.happiness;
      const avg = n ? happy / n : 0;
      d.innerHTML = `当前园内游客:<b>${n}</b><br>累计游客:${g.economy.totalGuests}<br>平均开心度:${(avg * 100) | 0}%`;
      const th = g.thoughts ? g.thoughts.list : [];
      tl.innerHTML = '<div class="rct-item"><span class="sub"><b>游客想法</b></span></div>' +
        (th.length ? th : [{ name: '', text: '(还没有想法)' }])
          .map(t => `<div class="rct-item" style="cursor:default"><span>${t.name}</span><span class="sub">${t.text}</span></div>`).join('');
    };
    w.refresh();
  }

  // ---------- 财务 ----------
  build_finance(el, w) {
    const g = this.game, eco = g.economy;
    const d = document.createElement('div');
    d.style.minWidth = '230px';
    el.appendChild(d);
    // 门票调整
    this._row(el,
      document.createTextNode('门票:'),
      this._btn('−', () => { g.dispatchAction({ type: 'entranceFee', value: Math.max(0, eco.entranceFee - 1) }); w.refresh(); }, 'small'),
      this._btn('+', () => { g.dispatchAction({ type: 'entranceFee', value: Math.min(60, eco.entranceFee + 1) }); w.refresh(); }, 'small'),
    );
    // 贷款
    this._row(el,
      document.createTextNode('贷款:'),
      this._btn('借 $2,000', () => { g.dispatchAction({ type: 'loanBorrow' }); }, 'small'),
      this._btn('还 $2,000', () => { g.dispatchAction({ type: 'loanRepay' }); }, 'small'),
    );
    const hist = document.createElement('div');
    hist.className = 'hint';
    el.appendChild(hist);
    w.refresh = () => {
      const c = eco.cur;
      d.innerHTML = `<div>现金:<b class="${eco.cash < 0 ? 'neg' : 'money'}">${eco.fmt(eco.cash)}</b>
        &nbsp;&nbsp;贷款:<span class="${eco.loan > 0 ? 'neg' : 'pos'}">${eco.fmt(eco.loan)}</span></div>
        <div class="rct-sep"></div>
        <div>本月收支:</div>
        ${Object.entries(c).map(([k, v]) => `<div class="rct-row"><span style="flex:1">${k}</span><span class="${v >= 0 ? 'pos' : 'neg'}">${eco.fmt(v)}</span></div>`).join('')}`;
      hist.innerHTML = '<div class="rct-sep"></div><div>历史:' + eco.history.map(h =>
        `<div>${h.月份} ${Object.entries(h).filter(([k]) => k !== '月份').map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${Math.round(v)}`).join(' / ')}</div>`
      ).join('').slice(0, 4000) + '</div>';
      hist.previousSibling; // noop
    };
    w.refresh();
  }

  // ---------- 公园 ----------
  build_park(el, w) {
    const g = this.game, eco = g.economy;
    const d = document.createElement('div');
    d.style.minWidth = '210px';
    el.appendChild(d);
    const openBtn = this._btn('', () => {
      g.dispatchAction({ type: 'parkOpen', value: !eco.parkOpen });
    });
    this._row(el, openBtn);
    w.refresh = () => {
      const rating = Math.round(eco.parkRating);
      const stars = '★'.repeat(Math.max(1, Math.round(rating / 200))) + '☆'.repeat(5 - Math.max(1, Math.round(rating / 200)));
      const wName = { sun: '晴', cloud: '阴', rain: '雨' }[g.weather?.mode || 'sun'];
      const go = eco.goal;
      const goalText = go.won ? '<span class="pos">已达成!</span>' : go.lost ? '<span class="neg">未达成</span>' : '<span class="money">进行中</span>';
      openBtn.textContent = eco.parkOpen ? '暂停开放(暂停进新游客)' : '重新开放迎客';
      d.innerHTML = `<div>日期:${eco.dateStr()} · 天气:${wName}</div>
        <div>公园评分:<b class="${rating >= 500 ? 'pos' : 'neg'}">${rating}</b> <span class="money">${stars}</span></div>
        <div>开放设施:${g.rides.list.filter(r => r.status === 'open' && !r.broken).length} / ${g.rides.list.length}</div>
        <div>游客数:${g.peeps.list.length}</div>
        <div>门票:${eco.fmt(eco.entranceFee)} · 贷款:${eco.fmt(eco.loan)}</div>
        <div class="rct-sep"></div>
        <div>目标:${go.text}</div>
        <div>目标状态:${goalText}</div>`;
    };
    w.refresh();
  }

  // ---------- 联机 ----------
  build_mp(el, w) {
    const g = this.game;
    const plist = document.createElement('div');
    plist.className = 'hint';
    el.appendChild(plist);
    const log = document.createElement('div');
    log.className = 'rct-list';
    log.style.height = '130px';
    log.style.fontSize = '11px';
    el.appendChild(log);
    const input = document.createElement('input');
    input.placeholder = '按回车发送聊天…';
    input.maxLength = 120;
    input.style.cssText = 'width:100%;margin-top:5px;background:rgba(20,24,34,0.8);border:1px solid rgba(255,255,255,0.25);color:#e8e6d0;padding:5px 7px;border-radius:3px;font-size:12px;outline:none';
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && input.value.trim()) {
        g.net.sendChat(input.value.trim());
        input.value = '';
      }
    });
    el.appendChild(input);
    w.refresh = () => {
      const players = g.net?.players || [];
      plist.innerHTML = `在线玩家(${players.length}):<br>` + players.map(p => `· ${p}${p === g.net?.myName ? '(我)' : ''}`).join('<br>');
      const recent = g.messages.list.slice(-14).reverse();
      log.innerHTML = recent.map(m => `<div style="padding:2px 5px">${m.text}</div>`).join('');
    };
    w.refresh();
  }

  // ---------- 研发 ----------
  build_research(el, w) {
    const g = this.game;
    const lvRow = document.createElement('div');
    lvRow.className = 'rct-row';
    for (let i = 0; i < RESEARCH_LEVELS.length; i++) {
      const lv = RESEARCH_LEVELS[i];
      const b = this._btn(`${lv.name} $${lv.fee}/月`, () => {
        g.dispatchAction({ type: 'researchLevel', value: i });
      }, 'small');
      b.dataset.lv = i;
      lvRow.appendChild(b);
    }
    el.appendChild(lvRow);
    const d = document.createElement('div');
    d.style.minWidth = '230px';
    el.appendChild(d);
    const list = document.createElement('div');
    list.className = 'hint';
    el.appendChild(list);
    w.refresh = () => {
      const R = g.research;
      lvRow.querySelectorAll('.rct-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.lv) === R.level));
      const cur = R.current();
      if (cur) {
        const pct = Math.min(100, Math.round(R.progress / cur.cost * 100));
        d.innerHTML = `<div>正在研发:<b class="money">${cur.name}</b></div>
          <div style="margin:4px 0;background:rgba(20,24,34,0.8);border:1px solid rgba(0,0,0,0.6);border-radius:3px;height:12px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:#7ec850"></div>
          </div>
          <div class="hint">${pct}% · 经费:${RESEARCH_LEVELS[R.level].name}</div>`;
      } else {
        d.innerHTML = '<div>全部研发完成!</div>';
      }
      list.innerHTML = '<div class="rct-sep"></div>队列:' +
        RESEARCH_QUEUE.map((q, i) => {
          const def = DEF_BY_ID[q.id];
          const status = R.done.includes(q.id) ? '<span class="pos">✓</span>' : (i === R.queueIdx ? '<b>←研发中</b>' : '');
          return `<div>${def ? def.name : q.id} ${status}</div>`;
        }).join('');
    };
    w.refresh();
  }

  // ---------- 员工 ----------
  build_staff(el, w) {
    const g = this.game;
    const hireRow = document.createElement('div');
    hireRow.className = 'rct-row';
    el.appendChild(hireRow);
    for (const role of STAFF_ROLES) {
      const b = this._btn(`+${role.name} $${role.hire}`, () => {
        g.dispatchAction({ type: 'staffHire', role: role.id });
      }, 'small');
      b.title = `${role.desc}(月薪 $${role.salary})`;
      hireRow.appendChild(b);
    }
    const counts = document.createElement('div');
    counts.className = 'hint';
    el.appendChild(counts);
    const list = document.createElement('div');
    list.className = 'rct-list';
    list.style.maxHeight = '150px';
    el.appendChild(list);
    w.refresh = () => {
      counts.textContent = STAFF_ROLES.map(r => `${r.name}×${g.staff.countBy(r.id)}`).join('  ·  ') +
        `  | 月总工资 ${g.economy.fmt(g.staff.monthlyWages())}`;
      list.innerHTML = '';
      for (const s of g.staff.list) {
        const def = STAFF_ROLES.find(r => r.id === s.role);
        const item = document.createElement('div');
        item.className = 'rct-item';
        const stateText = s.target ? '前往任务' : (s.state === 'work' ? '作业中' : '巡逻');
        item.innerHTML = `<span>${def.name} #${s.id}<div class="sub">${stateText}</div></span>`;
        const ops = document.createElement('span');
        const loc = document.createElement('button');
        loc.className = 'rct-btn small'; loc.textContent = '定位';
        loc.addEventListener('click', (ev) => { ev.stopPropagation(); g.camera.centerOnTile(s.tile[0], s.tile[1]); });
        const fire = document.createElement('button');
        fire.className = 'rct-btn small'; fire.textContent = '解雇';
        fire.addEventListener('click', (ev) => { ev.stopPropagation(); g.dispatchAction({ type: 'staffFire', id: s.id }); });
        ops.append(loc, fire);
        item.appendChild(ops);
        list.appendChild(item);
      }
      if (!g.staff.list.length) list.innerHTML = '<div class="rct-item"><span class="sub">还没有员工</span></div>';
    };
    w.refresh();
  }

  // ---------- 小地图 ----------
  build_map(el, w) {
    const g = this.game;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 200;
    cv.style.cssText = 'width:200px;height:200px;image-rendering:pixelated;display:block;cursor:crosshair';
    el.appendChild(cv);
    el.style.padding = '3px';
    cv.addEventListener('pointerdown', (e) => {
      const rect = cv.getBoundingClientRect();
      const tx = Math.floor((e.clientX - rect.left) / rect.width * 100);
      const ty = Math.floor((e.clientY - rect.top) / rect.height * 100);
      g.camera.centerOnTile(tx, ty);
    });
    // 静态地形底图
    const base = document.createElement('canvas');
    base.width = base.height = 200;
    const bx = base.getContext('2d');
    const w2 = g.world;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = w2.idx(x, y);
        let c;
        if (w2.base[i] < 4.5) c = '#2a5ab8';                  // 水
        else if (w2.surf[i] === 1) c = '#8a6238';             // 泥
        else if (w2.surf[i] === 2) c = '#d8c47c';             // 沙
        else if (w2.surf[i] === 3) c = '#8a8d8f';             // 岩
        else c = w2.owned[i] ? '#3d9c34' : '#2a6a26';         // 园内/外草
        bx.fillStyle = c;
        bx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    const ctx = cv.getContext('2d');
    w.refresh = () => {
      ctx.drawImage(base, 0, 0);
      // 路径
      ctx.fillStyle = '#e8e8e8';
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        const i = w2.idx(x, y);
        if (w2.path[i]) ctx.fillRect(x * 2, y * 2, 2, 2);
      }
      // 设施矩形
      ctx.fillStyle = '#e83a30';
      for (const r of g.rides.list) ctx.fillRect(r.x * 2 - 1, r.y * 2 - 1, r.def.w * 2 + 2, r.def.h * 2 + 2);
      // 视口标记
      const cx = (g.camera.target.x / 2 + 50) * 2, cy = (g.camera.target.z / 2 + 50) * 2;
      ctx.strokeStyle = '#ffe870';
      ctx.lineWidth = 2;
      const vw = (g.camera.half * g.camera.aspect) / 1.4, vh = g.camera.half / 1.4;
      ctx.strokeRect(cx - vw, cy - vh, vw * 2, vh * 2);
    };
    w.refresh();
  }

  // ---------- 存档 ----------
  build_save(el, w) {
    const g = this.game;
    if (g.mp) {
      this._hint(el, '联机模式:公园由服务器自动保存(每个游戏月)。');
      this._row(el, this._btn('新的公园需重启服务器', () => {
        info.textContent = '联机公园重置:服务器设置 RESET=1 重启即可全员开新图';
      }));
      const info = document.createElement('div');
      info.className = 'hint';
      el.appendChild(info);
      return;
    }
    const info = document.createElement('div');
    info.className = 'hint';
    el.appendChild(info);
    const refreshInfo = () => {
      const has = g.saves?.hasSave?.();
      info.textContent = has ? '检测到一个存档' : '暂无存档';
    };
    refreshInfo();
    this._row(el,
      this._btn('保存', () => { g.saves.save(); refreshInfo(); this.game.messages.add('已保存'); }),
      this._btn('读取', () => { if (g.saves.hasSave()) g.saves.load(); else info.textContent = '暂无存档可读取'; }),
      this._btn('新的公园', () => { if (confirm('放弃当前进度,生成新地图?')) { g.saves.clear(); location.reload(); } }),
    );
    this._hint(el, '自动每 2 个月(游戏内)保存一次。');
  }
}
