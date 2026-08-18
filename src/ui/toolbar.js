// 顶部工具栏 + canvas 像素图标(RCT2 布局:左建造类,右视图/系统类)。
function mkIcon(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 22;
  const g = c.getContext('2d');
  draw(g);
  return c;
}
const P = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const C = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const L = (g, x0, y0, x1, y1, col, w = 2) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };

const ICONS = {
  disk: () => mkIcon(g => {
    P(g, 3, 3, 16, 16, '#4a6ad8'); P(g, 5, 5, 12, 12, '#6a8af0');
    P(g, 7, 5, 8, 6, '#d8dee8'); P(g, 7, 13, 8, 4, '#2a3a6a');
  }),
  map: () => mkIcon(g => {
    P(g, 3, 4, 16, 15, '#3d9c34');
    L(g, 9, 4, 9, 19, '#dadde0', 1.2); L(g, 15, 4, 15, 19, '#dadde0', 1.2);
    L(g, 3, 4, 19, 4, '#dadde0', 1.2); L(g, 3, 19, 19, 19, '#dadde0', 1.2); L(g, 3, 4, 3, 19, '#dadde0', 1.2); L(g, 19, 4, 19, 19, '#dadde0', 1.2);
    C(g, 13, 11, 2.4, '#d84a3a');
  }),
  land: () => mkIcon(g => {
    P(g, 3, 14, 16, 5, '#7a5c40'); P(g, 6, 11, 10, 3, '#9a7350');
    L(g, 14, 4, 18, 12, '#c8b060', 2.5); P(g, 12, 2, 5, 3, '#8a5a30');
  }),
  tree: () => mkIcon(g => {
    P(g, 10, 13, 3, 7, '#7a5530');
    C(g, 11, 9, 7, '#429233'); C(g, 7, 11, 4, '#57b944'); C(g, 15, 11, 4, '#57b944');
  }),
  path: () => mkIcon(g => {
    P(g, 3, 9, 16, 8, '#9aa2a8'); P(g, 3, 9, 16, 1.6, '#dadde0'); P(g, 3, 15.4, 16, 1.6, '#dadde0');
    P(g, 9, 3, 8, 6, '#9aa2a8'); P(g, 9, 3, 1.6, 6, '#dadde0'); P(g, 15.4, 3, 1.6, 6, '#dadde0');
  }),
  ride: () => mkIcon(g => {
    L(g, 2, 19, 9, 6, '#a03028', 2.4); L(g, 9, 6, 14, 14, '#a03028', 2.4); L(g, 14, 14, 21, 9, '#a03028', 2.4);
    L(g, 9, 6, 9, 19, '#c8c8d0', 1.2); L(g, 14, 14, 14, 19, '#c8c8d0', 1.2);
  }),
  shop: () => mkIcon(g => {
    P(g, 4, 10, 14, 9, '#d8d0b8'); P(g, 3, 6, 16, 4, '#d84a3a');
    P(g, 6, 12, 4, 4, '#30404f');
  }),
  peep: () => mkIcon(g => {
    C(g, 11, 7, 4, '#f0c8a0'); P(g, 6, 12, 10, 8, '#3a7ad8'); P(g, 8, 15, 2, 2, '#0e2a5a');
  }),
  mp: () => mkIcon(g => {
    C(g, 8, 8, 3.4, '#f0c8a0'); P(g, 4, 13, 8, 7, '#d84a3a');
    C(g, 15, 8, 3.4, '#e0b088'); P(g, 11, 13, 8, 7, '#3a7ad8');
  }),
  coin: () => mkIcon(g => {
    C(g, 11, 11, 8, '#e8b830'); C(g, 11, 11, 6, '#f0d060');
    g.fillStyle = '#8a6010'; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.fillText('$', 11, 15);
  }),
  research: () => mkIcon(g => {
    P(g, 9, 3, 4, 3, '#c8c8d0');                      // 瓶颈
    L(g, 9.5, 6, 5, 18, '#88d8e8', 3); L(g, 12.5, 6, 17, 18, '#88d8e8', 3);
    L(g, 5, 18, 17, 18, '#88d8e8', 3);                 // 瓶身
    L(g, 7, 14, 15, 14, '#48b050', 2.4);               // 液面
    P(g, 8, 15.5, 6, 2, '#48b050'); C(g, 10, 12, 1.2, '#d8f0a0');
  }),
  staff: () => mkIcon(g => {
    L(g, 5, 18, 16, 7, '#c8ccd8', 3.2);                  // 扳手柄
    C(g, 17, 6, 4.2, '#c8ccd8'); C(g, 18.6, 4.4, 3.4, '#9aa2a8');   // 开口
    C(g, 5, 18, 2.2, '#8a8d8f');
  }),
  gate: () => mkIcon(g => {
    P(g, 4, 8, 3.4, 12, '#b0483a'); P(g, 14.6, 8, 3.4, 12, '#b0483a');
    P(g, 3, 4, 16, 3.4, '#2f8a7a'); P(g, 3, 3, 16, 1.4, '#e8b830');
  }),
  rotate: () => mkIcon(g => {
    g.strokeStyle = '#e8e6d0'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(11, 12, 6.5, Math.PI * 0.15, Math.PI * 1.35); g.stroke();
    L(g, 5, 6, 4.6, 12, '#e8e6d0', 2.4); L(g, 5, 6, 10, 8.2, '#e8e6d0', 2.4);
  }),
  zoomIn: () => mkIcon(g => {
    C(g, 9, 9, 6, '#88b0e8'); C(g, 9, 9, 4.4, '#0e1a2e');
    L(g, 13.5, 13.5, 20, 20, '#88b0e8', 2.6);
    L(g, 9, 6.4, 9, 11.6, '#fff', 1.8); L(g, 6.4, 9, 11.6, 9, '#fff', 1.8);
  }),
  zoomOut: () => mkIcon(g => {
    C(g, 9, 9, 6, '#88b0e8'); C(g, 9, 9, 4.4, '#0e1a2e');
    L(g, 13.5, 13.5, 20, 20, '#88b0e8', 2.6);
    L(g, 6.4, 9, 11.6, 9, '#fff', 1.8);
  }),
  pause: () => mkIcon(g => { P(g, 7, 4, 3.2, 14, '#e8e6d0'); P(g, 12.2, 4, 3.2, 14, '#e8e6d0'); }),
  ff: () => mkIcon(g => {
    g.fillStyle = '#e8e6d0';
    g.beginPath(); g.moveTo(3, 5); g.lineTo(11, 11); g.lineTo(3, 17); g.fill();
    g.beginPath(); g.moveTo(11, 5); g.lineTo(19, 11); g.lineTo(11, 17); g.fill();
  }),
  dev: () => mkIcon(g => {
    P(g, 2, 4, 18, 14, '#161a24');
    g.fillStyle = '#7ec850'; g.font = 'bold 10px monospace'; g.textAlign = 'left';
    g.fillText('>$_', 4, 15);
  }),
  trophy: () => mkIcon(g => {
    P(g, 7, 4, 8, 7, '#e8b830');                       // 杯身
    L(g, 7, 5, 3, 7, '#e8b830', 2); L(g, 15, 5, 19, 7, '#e8b830', 2);  // 双耳
    P(g, 10, 11, 2, 4, '#c09a28');                     // 杯柄
    P(g, 6, 15, 10, 3, '#e8b830');                     // 底座
  }),
  snd: () => mkIcon(g => {
    P(g, 4, 9, 3, 6, '#e8e6d0');                       // 喇叭
    g.fillStyle = '#e8e6d0'; g.beginPath(); g.moveTo(7, 9); g.lineTo(13, 4); g.lineTo(13, 19); g.lineTo(7, 15); g.fill();
    g.strokeStyle = '#7ec850'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(13, 12, 4, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(13, 12, 7, -0.8, 0.8); g.stroke();
  }),
  gear: () => mkIcon(g => {
    C(g, 11, 11, 5.5, '#c8ccd8'); C(g, 11, 11, 2.2, '#161a24');
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      P(g, 11 + Math.cos(a) * 6.4 - 1.2, 11 + Math.sin(a) * 6.4 - 1.2, 2.4, 2.4, '#c8ccd8');
    }
  }),
  bell: () => mkIcon(g => {
    g.fillStyle = '#e8b830';
    g.beginPath(); g.arc(11, 12, 6.5, Math.PI, 0); g.fill();      // 铃身
    P(g, 4.5, 12, 13, 3, '#e8b830');                              // 沿
    C(g, 11, 17, 2.2, '#c09a28');                                 // 锤
    P(g, 9.5, 3.5, 3, 2, '#c09a28');                              // 顶
  }),
};

export class Toolbar {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'toolbar';
    root.appendChild(this.el);
    this.buttons = new Map();
    this._build();
  }
  _add(id, icon, tip, onclick, right = false) {
    const b = document.createElement('button');
    b.className = 'tb-btn';
    b.title = tip;
    b.dataset.tb = id;
    if (icon) b.appendChild(icon);
    b.addEventListener('click', (ev) => { this.game.audio?.play('click'); onclick(ev); });
    this.buttons.set(id, b);
    this.el.appendChild(b);
    return b;
  }
  _build() {
    const g = this.game;
    this._add('save', ICONS.disk(), '存档', () => this._saveMenu());
    this._add('map', ICONS.map(), '园区地图', () => g.ui.panels.open('map'));
    this._add('land', ICONS.land(), '整地工具', () => g.ui.panels.open('land'));
    this._add('scenery', ICONS.tree(), '景观', () => g.ui.panels.open('scenery'));
    this._add('path', ICONS.path(), '路径', () => g.ui.panels.open('path'));
    this._add('rides', ICONS.ride(), '游乐设施', () => g.ui.panels.open('rides'));
    this._add('shops', ICONS.shop(), '商店', () => g.ui.panels.open('shops'));
    this._add('peeps', ICONS.peep(), '游客', () => g.ui.panels.open('peeps'));
    if (g.mp) this._add('mp', ICONS.mp(), '联机(在线名单/聊天)', () => g.ui.panels.open('mp'));
    this._add('coin', ICONS.coin(), '财务', () => g.ui.panels.open('finance'));
    this._add('staff', ICONS.staff(), '员工(清洁工/维修工/演艺)', () => g.ui.panels.open('staff'));
    this._add('research', ICONS.research(), '研发', () => g.ui.panels.open('research'));
    this._add('park', ICONS.gate(), '公园信息', () => g.ui.panels.open('park'));
    this._add('levels', ICONS.trophy(), '关卡', () => g.ui.panels.open('levels'));
    this._add('cheat', ICONS.dev(), '开发者控制台', () => g.ui.panels.open('cheat'));
    const sp = document.createElement('div');
    sp.className = 'spacer';
    this.el.appendChild(sp);
    this._add('snd', ICONS.snd(), '音效开/关', () => {
      if (g.audio) g.audio.toggleMute();
      this.refresh();
    });
    this._add('settings', ICONS.gear(), '设置', () => g.ui.panels.open('settings'));
    this._add('notices', ICONS.bell(), '通知中心', () => g.ui.panels.open('notices'));
    this._add('pause', ICONS.pause(), '暂停', () => {
      g.dispatchAction({ type: 'pause', value: !g.paused });
      this.refresh();
    });
    this._add('speed', ICONS.ff(), '游戏速度 1×(点击切换)', () => {
      if (g.mp) { g.messages.add('联机模式速度由服务器控制'); return; }
      g.speedMul = g.speedMul === 1 ? 2 : g.speedMul === 2 ? 4 : 1;
      this.buttons.get('speed').title = `游戏速度 ${g.speedMul}×(点击切换)`;
      g.messages.add(`游戏速度 ${g.speedMul}×`);
      this.refresh();
    });
    this._add('zoomOut', ICONS.zoomOut(), '缩小', () => g.camera.setZoom(g.camera.zoomIdx - 1));
    this._add('zoomIn', ICONS.zoomIn(), '放大', () => g.camera.setZoom(g.camera.zoomIdx + 1));
    this._add('rotate', ICONS.rotate(), '旋转视角 (E)', () => g.camera.rotate(1));
  }
  _saveMenu() {
    this.game.ui.panels.open('save');
  }
  refresh() {
    // 高亮当前工具对应按钮 / 暂停态
    const t = this.game.tools.tool?.type;
    const map = { land: 'land', scenery: 'scenery', path: 'path', addon: 'path', ride: 'rides', shop: 'shops', remove: null, inspect: null };
    for (const [id, b] of this.buttons) b.classList.remove('active');
    if (t && map[t]) this.buttons.get(map[t])?.classList.add('active');
    if (this.game.paused) this.buttons.get('pause').classList.add('active');
    const spb = this.buttons.get('speed');
    if (spb) spb.classList.toggle('active', (this.game.speedMul || 1) > 1);
    const sb = this.buttons.get('snd');
    if (sb && this.game.audio) sb.style.opacity = this.game.audio.muted ? '0.35' : '1';
  }
}
