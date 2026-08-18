// 各类建造/管理面板:整地、景观、路径、设施、商店、游客、财务、公园、存档。
import { PATH, ADDON, PRICE, MAP_W, MAP_H, MONTH_NAMES } from '../config.js';
import { SCENERY_TYPES } from '../game/scenery.js';
import { RIDE_DEFS, DEF_BY_ID } from '../game/rides.js';
import { RESEARCH_LEVELS, RESEARCH_QUEUE } from '../game/research.js';
import { SCENARIOS, maxUnlocked, getTrophies, MEDALS } from '../game/scenarios.js';
import { ACH_DEFS } from '../game/achievements.js';
import { peekSave, currentSlot, setCurrentSlot } from '../game/save.js';
import { COASTER_PIECES, TRACK_STYLES, canFinish, findClosure } from '../game/coasterEdit.js';
import { STAFF_ROLES } from '../game/staff.js';

const PANEL_POS = {
  land: [70, 60], scenery: [100, 70], path: [130, 80], rides: [160, 90], shops: [190, 100],
  peeps: [window.innerWidth - 300, 60], finance: [window.innerWidth - 340, 80],
  park: [window.innerWidth - 320, 100], save: [90, 90], mp: [window.innerWidth - 320, 130],
  research: [230, 120], staff: [window.innerWidth - 360, 60], map: [60, 50],
  cheat: [window.innerWidth - 360, 140], levels: [270, 140], coaster: [300, 100],
  settings: [window.innerWidth - 330, 170], gameover: [Math.max(80, window.innerWidth / 2 - 150), 200],
  notices: [window.innerWidth - 380, 110],
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
      staff: '员工', map: '园区地图', cheat: '开发者控制台', levels: '关卡', coaster: '轨道编辑器',
      settings: '设置', gameover: '剧本结算', notices: '通知中心',
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
    b.addEventListener('click', (ev) => { this.game.audio?.play('click'); onclick(ev); });
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
    this._row(el, this._btn('购地 $30/格(3×3)', e => this._selectTool({ type: 'buyland' }, e.target, el)));
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
        const locked = g.research && (!g.research.unlocked(d.id) || (d.id === 'mycoaster' && !g.research.unlocked('woodie')));
        const item = document.createElement('div');
        item.className = 'rct-item';
        if (locked) item.style.opacity = '0.45';
        item.innerHTML = `<span>${d.name}<div class="sub">${d.w}×${d.h} · ${d.desc}</div></span><span class="price">${locked ? '未研发' : (d.custom ? '编辑器' : '$' + d.cost)}</span>`;
        if (!locked) {
          item.addEventListener('click', () => {
            if (d.custom) { this.coasterDefId = d.id; this.open('coaster'); }   // 先开编辑器(open 内部会 clearTool)
            this._selectTool({ type: cat === 'ride' ? 'ride' : 'shop', id: d.id }, item, list);   // 再选工具,保证幽灵可用
          });
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
        ` <a href="#" data-ride="${r.id}" style="color:#9fd0ff">${r.customName || r.def.name}#${r.id}</a>`).join('') : '';
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
    this._row(el, this._btn('第一视角游览', () => {
      const ok = g.fp?.enterRandom();
      if (!ok) g.messages?.add('园里还没有游客,等他们进来再试');
    }), this._btn('换一位游客视角', () => { g.fp?.enterRandom(true); }));
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
      const groups = new Set(g.peeps.list.map(p => p.groupId).filter(Boolean)).size;
      const kids = g.peeps.list.filter(p => p.kid).length;
      d.innerHTML = `当前园内游客:<b>${n}</b>(家庭组 ${groups} · 儿童 ${kids})<br>累计游客:${g.economy.totalGuests}<br>平均开心度:${(avg * 100) | 0}%`;
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
    const chart = document.createElement('canvas');
    chart.width = 210; chart.height = 48;
    chart.style.cssText = 'width:210px;height:48px;background:rgba(20,24,34,0.8);border-radius:3px;margin-top:4px';
    chart.title = '公园评分走势(每月采样)';
    el.appendChild(chart);
    const c2d = chart.getContext('2d');
    const drawChart = () => {
      c2d.clearRect(0, 0, 210, 48);
      const hist = eco.ratingHistory || [];
      if (hist.length < 2) return;
      c2d.strokeStyle = '#7ec850';
      c2d.lineWidth = 1.5;
      c2d.beginPath();
      hist.forEach((v, i) => {
        const x = i / (hist.length - 1) * 204 + 3;
        const y = 45 - (Math.max(0, Math.min(999, v)) / 999) * 42;
        if (i === 0) c2d.moveTo(x, y); else c2d.lineTo(x, y);
      });
      c2d.stroke();
    };
    w.refresh = () => {
      const rating = Math.round(eco.parkRating);
      const stars = '★'.repeat(Math.max(1, Math.round(rating / 200))) + '☆'.repeat(5 - Math.max(1, Math.round(rating / 200)));
      const wName = { sun: '晴', cloud: '阴', rain: '雨' }[g.weather?.mode || 'sun'];
      const fName = { sun: '晴', cloud: '阴', rain: '雨' }[g.weather?.forecast?.() || 'sun'];
      const go = eco.goal;
      const goalText = go.won ? '<span class="pos">已达成!</span>' : go.lost ? '<span class="neg">未达成</span>' : '<span class="money">进行中</span>';
      openBtn.textContent = eco.parkOpen ? '暂停开放(暂停进新游客)' : '重新开放迎客';
      d.innerHTML = `<div>日期:${eco.dateStr()} · 天气:${wName}(下月:${fName})</div>
        <div>公园评分:<b class="${rating >= 500 ? 'pos' : 'neg'}">${rating}</b> <span class="money">${stars}</span></div>
        <div>开放设施:${g.rides.list.filter(r => r.status === 'open' && !r.broken).length} / ${g.rides.list.length}</div>
        <div>游客数:${g.peeps.list.length}</div>
        <div>门票:${eco.fmt(eco.entranceFee)} · 贷款:${eco.fmt(eco.loan)}</div>
        <div class="rct-sep"></div>
        <div>目标:${go.text}</div>
        <div>目标状态:${goalText}</div>
        <div class="rct-sep"></div>
        <div>成就 ${(g.achievements || new Set()).size}/${ACH_DEFS.length}</div>` +
        ACH_DEFS.map(a => `<div style="font-size:11px" class="${g.achievements?.has(a.id) ? 'pos' : 'hint'}">${g.achievements?.has(a.id) ? '✓' : '·'} ${a.name} — ${a.desc}</div>`).join('');
      drawChart();
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

  // ---------- 开发者控制台 ----------
  build_cheat(el, w) {
    const g = this.game, eco = g.economy;
    this._hint(el, '作弊工具(调试用,联机下同样生效并广播)');
    this._row(el, this._btn('印钱 +$10,000', () => {
      g.dispatchAction({ type: 'cheatMoney', amount: 10000 });
      w.refresh();
    }));
    this._row(el, this._btn('一键完成所有研究', () => {
      g.dispatchAction({ type: 'researchAll' });
      w.refresh();
    }));
    const d = document.createElement('div');
    d.className = 'hint';
    el.appendChild(d);
    w.refresh = () => {
      const R = g.research;
      const done = R ? R.done.length : 0;
      d.innerHTML = `现金:<b class="money">${eco.fmt(eco.cash)}</b><br>` +
        `研究:${done}/${RESEARCH_QUEUE.length} ${R && !R.current() ? '(全部完成)' : ''}`;
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
        const areaB = document.createElement('button');
        areaB.className = 'rct-btn small';
        areaB.textContent = s.area ? '全区' : '划区';
        areaB.title = s.area ? '清除巡逻区(全园巡逻)' : '划定巡逻区:地图上两次点击定矩形';
        areaB.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (s.area) g.dispatchAction({ type: 'staffArea', staffId: s.id, clear: true });
          else g.tools.setTool({ type: 'patrol', staffId: s.id });
          w.refresh();
        });
        const fire = document.createElement('button');
        fire.className = 'rct-btn small'; fire.textContent = '解雇';
        fire.addEventListener('click', (ev) => { ev.stopPropagation(); g.dispatchAction({ type: 'staffFire', id: s.id }); });
        ops.append(loc, areaB, fire);
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
    // 静态地形底图(购地后按 ownedRev 重绘)
    const base = document.createElement('canvas');
    base.width = base.height = 200;
    const bx = base.getContext('2d');
    const w2 = g.world;
    let baseRev = -1;
    const drawBase = () => {
      baseRev = w2._ownedRev || 0;
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
    };
    drawBase();
    const ctx = cv.getContext('2d');
    w.refresh = () => {
      if ((w2._ownedRev || 0) !== baseRev) drawBase();
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

  // ---------- 关卡 ----------
  build_levels(el, w) {
    const g = this.game;
    if (g.mp) { this._hint(el, '联机模式的公园由服务器决定,不含关卡目标。'); return; }
    const list = document.createElement('div');
    list.className = 'rct-list';
    el.appendChild(list);
    const render = () => {
      const max = maxUnlocked();
      list.innerHTML = '';
      SCENARIOS.forEach((sc, i) => {
        const locked = i > max;
        const cur = g.economy.goal?.scenarioId === sc.id;
        const item = document.createElement('div');
        item.className = 'rct-item';
        const tgt = `游客≥${sc.goal.guests} · 评分≥${sc.goal.rating}${sc.goal.cash ? ' · 现金≥$' + sc.goal.cash.toLocaleString('en-US') : ''}`;
        const tro = getTrophies()[sc.id];
        const medalTxt = tro
          ? ` <span style="color:${['#c8895a', '#c8c8d8', '#e8b830'][tro.medal]}">${MEDALS[tro.medal]}牌 · 第${Math.floor(tro.monthAbs / MONTH_NAMES.length) + 1}年${MONTH_NAMES[tro.monthAbs % MONTH_NAMES.length]}达成</span>`
          : '';
        item.innerHTML = `<span>${i + 1}. ${sc.name}${cur ? ' ✦进行中' : ''}${medalTxt}<div class="sub">${sc.desc} · ${tgt}</div></span><span class="price">${locked ? '未解锁' : (cur ? '' : '重开')}</span>`;
        if (locked) { item.style.opacity = '0.45'; item.style.cursor = 'default'; item.title = '完成前一关后解锁'; }
        else if (!cur) item.addEventListener('click', () => {
          if (confirm(`开始关卡「${sc.name}」?当前公园进度将被覆盖`)) {
            g.saves?.clear();
            location.href = '?new=1&lv=' + sc.id;
          }
        });
        list.appendChild(item);
      });
    };
    render();
    w.refresh = render;
  }

  // ---------- 过山车编辑器 ----------
  build_coaster(el, w) {
    const g = this.game;
    if (this.coasterDir === undefined) this.coasterDir = 1;
    const draft = () => g.rides.list.find(r => r.custom && !r.complete);
    const DIRNM = ['东', '北', '西', '南'];
    const status = document.createElement('div');
    status.className = 'hint';
    el.appendChild(status);
    // 站台朝向(未开工时显示)
    const dirRow = document.createElement('div');
    dirRow.className = 'rct-row';
    DIRNM.forEach((nm, i) => {
      const b = this._btn(nm, () => { this.coasterDir = i; w.refresh(); }, 'small');
      b.dataset.dir = i;
      dirRow.appendChild(b);
    });
    el.appendChild(dirRow);
    // 轨道件按钮(按在建设施的风格动态生成)
    const pieceBox = document.createElement('div');
    el.appendChild(pieceBox);
    const buildPieceBtns = (styleKey) => {
      pieceBox.innerHTML = '';
      const defs = COASTER_PIECES.filter(p => TRACK_STYLES[styleKey].pieces.includes(p.id));
      [defs.slice(0, 4), defs.slice(4)].forEach(rowDefs => {
        if (!rowDefs.length) return;
        const row = document.createElement('div');
        row.className = 'rct-row';
        for (const p of rowDefs) {
          const b = this._btn(`${p.name} $${p.cost}`, () => {
            const d = draft();
            if (!d) return;
            const r = g.dispatchAction({ type: 'coasterPiece', rideId: d.id, piece: p.id });
            if (!r?.ok && r?.reason) msg.textContent = r.reason;
            w.refresh();
          }, 'small');
          b.title = p.id;
          row.appendChild(b);
        }
        pieceBox.appendChild(row);
      });
      pieceBox._style = styleKey;
    };
    const msg = document.createElement('div');
    msg.className = 'hint';
    msg.style.color = '#ffb0a0';
    el.appendChild(msg);
    const opRow = document.createElement('div');
    opRow.className = 'rct-row';
    const undoBtn = this._btn('撤销上一段', () => {
      const d = draft();
      if (d) { const r = g.dispatchAction({ type: 'coasterUndo', rideId: d.id }); if (!r?.ok) msg.textContent = r?.reason || ''; w.refresh(); }
    }, 'small');
    const autoBtn = this._btn('自动闭环', () => {
      const d = draft();
      if (!d) return;
      const seq = findClosure(d, g.world);
      if (!seq) { msg.textContent = '找不到可行回路,撤销几段或调整后再试'; return; }
      if (!seq.length) { msg.textContent = '已经可以闭环了'; return; }
      if (!confirm(`自动铺设 ${seq.length} 段接回站台?(按段计费)`)) return;
      for (const t of seq) {
        const r = g.dispatchAction({ type: 'coasterPiece', rideId: d.id, piece: t });
        if (!r?.ok) { msg.textContent = r?.reason || '铺设失败'; break; }
      }
      w.refresh();
    }, 'small');
    const finBtn = this._btn('完成闭环', () => {
      const d = draft();
      if (d) { const r = g.dispatchAction({ type: 'coasterFinish', rideId: d.id }); if (!r?.ok) msg.textContent = r?.reason || ''; w.refresh(); }
    }, 'small');
    const delBtn = this._btn('放弃(拆除)', () => {
      const d = draft();
      if (d && confirm('拆除在建的过山车?返还 55% 造价')) { g.dispatchAction({ type: 'rideRemove', rideId: d.id }); w.refresh(); }
    }, 'small');
    opRow.append(undoBtn, autoBtn, finBtn, delBtn);
    el.appendChild(opRow);
    w.refresh = () => {
      const d = draft();
      dirRow.querySelectorAll('.rct-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.dir) === this.coasterDir));
      dirRow.style.display = d ? 'none' : '';
      pieceBox.style.display = d ? '' : 'none';
      opRow.style.display = d ? '' : 'none';
      if (!d) {
        const defId = this.coasterDefId || 'mycoaster';
        const need = defId === 'mycoaster' ? 'woodie' : defId;
        const researched = !g.research || g.research.unlocked(need);
        const defName = DEF_BY_ID[defId]?.name || '轨道设施';
        status.innerHTML = researched
          ? `「${defName}」1. 选好站台朝向(当前:${DIRNM[this.coasterDir]})<br>2. 在地图上点击放站台<br>3. 逐段铺轨,接回站台即闭环`
          : `需先在研发中解锁「${DEF_BY_ID[need]?.name || need}」`;
        msg.textContent = '';
        return;
      }
      const sk = d.def.style || 'coaster';
      if (pieceBox._style !== sk) buildPieceBtns(sk);
      const head = g.rides.headOf(d);
      const fin = canFinish(d);
      status.innerHTML = `${d.def.name} · 段数 ${d.pieces.length} · 高度 ${head.h} · 朝向 ${DIRNM[head.dir]}` +
        (fin ? ' · <b class="pos">可闭环!</b>' : ' · 未闭环');
      finBtn.style.opacity = fin ? '1' : '0.45';
    };
    w.refresh();
  }

  // ---------- 通知中心 ----------
  build_notices(el, w) {
    const g = this.game;
    const list = document.createElement('div');
    list.className = 'rct-list';
    list.style.maxHeight = '260px';
    list.style.minWidth = '280px';
    list.style.fontSize = '12px';
    el.appendChild(list);
    w.refresh = () => {
      list.innerHTML = '';
      const msgs = (g.messages?.list || []).slice(-22).reverse();
      if (!msgs.length) {
        list.innerHTML = '<div class="rct-item"><span class="sub">还没有通知</span></div>';
        return;
      }
      for (const m of msgs) {
        const item = document.createElement('div');
        item.className = 'rct-item';
        item.style.cursor = m.rideId != null ? 'pointer' : 'default';
        item.innerHTML = `<span>${m.text}</span>`;
        if (m.rideId != null) {
          item.title = '点击打开该设施窗口';
          item.addEventListener('click', () => g.ui.rideWindow(m.rideId));
        }
        list.appendChild(item);
      }
    };
    w.refresh();
  }

  // ---------- 设置 ----------
  build_settings(el, w) {
    const g = this.game;
    const volRow = document.createElement('div');
    volRow.className = 'rct-row';
    volRow.appendChild(document.createTextNode('音量:'));
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 100;
    vol.value = Math.round((g.audio?.volume ?? 0.8) * 100);
    vol.style.flex = '1';
    vol.addEventListener('input', () => g.audio?.setVolume(vol.value / 100));
    volRow.appendChild(vol);
    el.appendChild(volRow);
    // 游客上限(调低可省性能)
    const capRow = document.createElement('div');
    capRow.className = 'rct-row';
    capRow.appendChild(document.createTextNode('游客上限:'));
    const capSel = document.createElement('select');
    capSel.style.cssText = 'flex:1;background:rgba(20,24,34,0.8);color:#e8e6d0;border:1px solid rgba(255,255,255,0.25);border-radius:3px;padding:3px';
    for (const v of [120, 180, 260]) {
      const o = document.createElement('option');
      o.value = String(v); o.textContent = `${v} 人`;
      capSel.appendChild(o);
    }
    let capCur = 260;
    try { capCur = parseInt(localStorage.getItem('rct2js-peepcap') || '260', 10) || 260; } catch { /* 忽略 */ }
    capSel.value = String(capCur);
    capSel.addEventListener('change', () => {
      const v = parseInt(capSel.value, 10);
      try { localStorage.setItem('rct2js-peepcap', String(v)); } catch { /* 忽略 */ }
      if (g.peeps && g.peeps.cap !== undefined) g.peeps.cap = v;
      g.messages.add(`游客上限调整为 ${v}(只影响新游客入园)`);
    });
    capRow.appendChild(capSel);
    el.appendChild(capRow);
    // 画质
    const qRow = document.createElement('div');
    qRow.className = 'rct-row';
    qRow.appendChild(document.createTextNode('画质:'));
    const qSel = document.createElement('select');
    qSel.style.cssText = capSel.style.cssText;
    for (const [v, nm] of [['high', '高(设备像素)'], ['low', '低(1×,更流畅)']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = nm;
      qSel.appendChild(o);
    }
    let qCur = 'high';
    try { qCur = localStorage.getItem('rct2js-quality') || 'high'; } catch { /* 忽略 */ }
    qSel.value = qCur;
    qSel.addEventListener('change', () => {
      try { localStorage.setItem('rct2js-quality', qSel.value); } catch { /* 忽略 */ }
      g.renderer.setPixelRatio(qSel.value === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
      window.dispatchEvent(new Event('resize'));
    });
    qRow.appendChild(qSel);
    el.appendChild(qRow);
    this._row(el, this._btn('音效开/关(工具栏喇叭)', () => {
      g.audio?.toggleMute();
      g.ui.refreshToolbar();
    }));
    const keys = document.createElement('div');
    keys.className = 'hint';
    keys.style.fontSize = '11px';
    keys.innerHTML = '<div class="rct-sep"></div><b>按键</b><br>' +
      '平移:右键拖拽 / WASD / 方向键<br>旋转视角:Q / E · 缩放:滚轮<br>' +
      '取消工具:Esc · 第一视角环视:左键拖动<br>点游客/员工:查看状态';
    el.appendChild(keys);
  }

  // ---------- 剧本结算 ----------
  build_gameover(el, w) {
    const g = this.game, go = g.economy.goal;
    const d = document.createElement('div');
    d.style.minWidth = '250px';
    el.appendChild(d);
    const idx = SCENARIOS.findIndex(s => s.id === go.scenarioId);
    const next = idx >= 0 ? SCENARIOS[idx + 1] : null;
    this._row(el, this._btn('继续经营(沙盒)', () => g.ui.wm.close('panel-gameover')));
    if (go.won && next) {
      this._row(el, this._btn(`下一关:「${next.name}」`, () => {
        if (confirm(`开始关卡「${next.name}」?当前公园进度将被覆盖`)) { g.saves?.clear(); location.href = '?new=1&lv=' + next.id; }
      }));
    }
    if (go.scenarioId) {
      this._row(el, this._btn('重玩本关', () => {
        if (confirm('放弃当前进度,重开本关?')) { g.saves?.clear(); location.href = '?new=1&lv=' + go.scenarioId; }
      }));
    }
    w.refresh = () => {
      const tro = go.scenarioId ? getTrophies()[go.scenarioId] : null;
      const troLine = tro ? `<br>奖杯:<b style="color:${['#c8895a', '#c8c8d8', '#e8b830'][tro.medal]}">${MEDALS[tro.medal]}牌</b>` : '';
      d.innerHTML = go.won
        ? `<b class="pos">目标达成!</b><br>游客 ${g.peeps.list.length} · 评分 ${Math.round(g.economy.parkRating)}${troLine}<br>干得漂亮!可以继续经营,也可以挑战下一关。`
        : `<b class="neg">未能在期限内完成目标</b><br><span class="hint">${go.text}</span><br>公园仍可继续经营,或重开本关再试。`;
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
    const slotLabels = {};
    for (const n of [1, 2, 3]) {
      const row = document.createElement('div');
      row.className = 'rct-row';
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;font-size:11px;align-self:center';
      const saveB = this._btn('保存', () => {
        g.saves.slot = n; setCurrentSlot(n);
        g.saves.save();
        this.game.messages.add(`已保存到 ${n} 号位`);
        refreshInfo();
      }, 'small');
      const loadB = this._btn('读取', () => {
        if (!peekSave(n)) { info.textContent = `${n} 号位是空的`; return; }
        g.saves.slot = n; setCurrentSlot(n);
        g.saves.load();   // reload 后启动流程自动读当前档
      }, 'small');
      row.append(label, saveB, loadB);
      el.appendChild(row);
      slotLabels[n] = label;
    }
    const refreshInfo = () => {
      for (const n of [1, 2, 3]) {
        const d = peekSave(n);
        const cur = currentSlot() === n ? ' ✦当前' : '';
        slotLabels[n].textContent = d
          ? `${n}号位:第${d.economy?.year ?? 1}年 · ${(d.rides || []).length} 设施${cur}`
          : `${n}号位:空${cur}`;
      }
      info.textContent = '自动每 2 个游戏月保存到当前档位;切换档位后「读取」生效。';
    };
    refreshInfo();
    this._row(el, this._btn('新的公园', () => { if (confirm('放弃当前进度,生成新地图?')) { g.saves.clear(); location.reload(); } }));
  }
}
