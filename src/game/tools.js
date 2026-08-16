// 工具管理器:整地/路径/景观/设施放置/拆除/查询,光标高亮、幽灵预览、成本提示。
import * as THREE from 'three';
import { TILE, H_UNIT, PATH, ADDON, PRICE } from '../config.js';
import { GeomBuilder } from '../render/geom.js';
import { World } from '../world/world.js';

export class Tools {
  constructor(game) {
    this.game = game;
    this.tool = null;
    this.hover = null;        // {x,y}
    this.mouse = { x: 0, y: 0, down: false };
    this.cursorGroup = new THREE.Group();
    game.scene.add(this.cursorGroup);
    this.ghost = null;        // ride 幽灵
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false });
    this.badFillMat = new THREE.MeshBasicMaterial({ color: 0xff5030, transparent: true, opacity: 0.3, depthWrite: false });
    this.bracketMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.badBracketMat = new THREE.MeshBasicMaterial({ color: 0xff5030 });
    this.tip = document.createElement('div');
    this.tip.className = 'tooltip';
    this.tip.style.display = 'none';
    document.getElementById('ui').appendChild(this.tip);
    this._bind();
  }

  setTool(tool) {
    this.tool = tool;
    this._clearGhost();
    if (!tool) this._clearCursor();
  }
  clearTool() { this.setTool(null); }

  _bind() {
    const el = this.game.renderer.domElement;
    el.addEventListener('pointermove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      this._onMove(e);
    });
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target !== el) return;
      this.mouse.down = true;
      this._onApply(e);
    });
    window.addEventListener('pointerup', () => { this.mouse.down = false; this._applied = false; });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') { this.clearTool(); this.game.ui?.refreshToolbar?.(); }
    });
  }

  _pick(e) {
    return this.game.picker.pickTile(e.clientX, e.clientY);
  }

  _onMove(e) {
    const p = this._pick(e);
    this.hover = p;
    this._updateCursor(e);
    // 按住左键拖动:路径/整地/景观连续作业
    if (this.mouse.down && p && this.tool) {
      const t = this.tool.type;
      if (t === 'path' || t === 'scenery') this._applyAt(p, e, true);
      else if (t === 'land') this._applyLand(p, e, true);
      else if (t === 'remove') this._applyAt(p, e, true);
    }
  }

  _onApply(e) {
    const p = this._pick(e);
    if (!p) return;
    // 无工具时:左键点击设施 → 打开设施窗口
    if (!this.tool) {
      const w = this.game.world, i = w.idx(p.x, p.y);
      if (w.rideTile[i] !== -1) this.game.rides.openWindow(w.rideTile[i]);
      return;
    }
    if (this.tool.type === 'land') this._applyLand(p, e, false);
    else this._applyAt(p, e, false);
  }

  // ---------- 执行:全部经 dispatchAction(单机=本地扣费;联机=发给服务端) ----------
  _applyAt(p, e, drag) {
    const g = this.game, t = this.tool;
    if (!t) return;
    if (t.type === 'path') {
      this._do({ type: 'path', kind: t.kind, x: p.x, y: p.y }, e, drag);
    } else if (t.type === 'addon') {
      this._do({ type: 'addon', addon: t.addon, x: p.x, y: p.y }, e, drag);
    } else if (t.type === 'scenery') {
      this._do({ type: 'scenery', id: t.id, x: p.x, y: p.y }, e, drag);
    } else if (t.type === 'ride' || t.type === 'shop') {
      if (drag) return;  // 设施不支持拖动
      this._do({ type: 'ridePlace', id: t.id, x: p.x, y: p.y }, e, false, true);
    } else if (t.type === 'gate') {
      this._do({ type: 'rideGate', rideId: t.rideId, which: t.which, x: p.x, y: p.y }, e, false);
    } else if (t.type === 'remove') {
      const w = g.world, i = w.idx(p.x, p.y);
      if (w.obj[i] !== 0) this._do({ type: 'sceneryRemove', x: p.x, y: p.y }, e, drag);
      else if (w.rideTile[i] !== -1) this._do({ type: 'rideRemove', rideId: w.rideTile[i] }, e, drag);
      else if (w.addon[i] !== ADDON.NONE) this._do({ type: 'addonRemove', x: p.x, y: p.y }, e, drag);
      else if (w.path[i] !== PATH.NONE) this._do({ type: 'pathRemove', x: p.x, y: p.y }, e, drag);
    } else if (t.type === 'inspect') {
      const w = g.world, i = w.idx(p.x, p.y);
      if (w.rideTile[i] !== -1) g.rides.openWindow(w.rideTile[i]);
    }
  }

  _do(a, e, drag, isRide = false) {
    const r = this.game.dispatchAction(a);
    this.notifyResult(a, r, e, drag);
  }

  // 动作结果反馈(本地立即返回或服务端回执都会走这里)
  notifyResult(a, r, e, drag) {
    const g = this.game;
    if (!r || !r.ok) {
      if (!drag && r && r.reason) this._flash(r.reason, e || this.mouse, true);
      return;
    }
    if (r.pending) return;   // 联机:等服务端回执
    if (r.cost > 0 && !drag) this._flash('-' + g.economy.fmt(r.cost), e || this.mouse);
    else if (r.cost < 0 && !drag) this._flash('+' + g.economy.fmt(-r.cost), e || this.mouse);
    if (a.type === 'ridePlace' || a.type === 'rideGate') { this.clearTool(); this._clearCursor(); g.ui?.refreshToolbar?.(); }
  }

  _applyLand(p, e, drag) {
    const t = this.tool, g = this.game, w = g.world;
    const size = t.size || 1;
    const x0 = p.x - Math.floor(size / 2), y0 = p.y - Math.floor(size / 2);
    if (this._lastLandKey === `${x0},${y0}` && drag) return;  // 拖动去重
    this._lastLandKey = `${x0},${y0}`;
    this._do({ type: 'land', mode: t.mode, size, x: p.x, y: p.y }, e, drag);
  }

  _flash(text, e, isErr = false) {
    if (!text) return;
    this.tip.textContent = text;
    this.tip.style.color = isErr ? '#ff8060' : '#fff';
    this.tip.style.display = 'block';
    this.tip.style.left = (e.clientX ?? e.x ?? 0) + 'px';
    this.tip.style.top = (e.clientY ?? e.y ?? 0) + 'px';
    clearTimeout(this._tipT);
    this._tipT = setTimeout(() => { this.tip.style.display = 'none'; }, 1100);
  }

  // ---------- 光标 ----------
  _updateCursor(e) {
    this._clearCursor();
    const p = this.hover, t = this.tool;
    if (!p || !t) { this.tip.style.display = 'none'; return; }
    const g = this.game, w = g.world;
    let tiles = [], valid = true, text = '';
    if (t.type === 'land') {
      const size = t.size || 1;
      const x0 = p.x - Math.floor(size / 2), y0 = p.y - Math.floor(size / 2);
      for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++)
        if (w.in(x, y) && w.ownedAt(x, y)) tiles.push([x, y]);
      const price = t.mode === 'lower' ? PRICE.landLower : PRICE.landRaise;
      text = (t.mode === 'raise' ? '抬升' : t.mode === 'lower' ? '压低' : '整平') + ` ~${g.economy.fmt(price * tiles.length)}`;
    } else if (t.type === 'path') {
      tiles = [[p.x, p.y]];
      const chk = g.paths.canPlace(p.x, p.y, t.kind);
      valid = chk.ok; if (!valid) text = chk.reason;
    } else if (t.type === 'addon') {
      tiles = [[p.x, p.y]];
      const chk = g.paths.canPlaceAddon(p.x, p.y, t.addon);
      valid = chk.ok; if (!valid) text = chk.reason;
    } else if (t.type === 'scenery') {
      tiles = [[p.x, p.y]];
      const chk = g.scenery.canPlace(t.id, p.x, p.y);
      valid = chk.ok; if (!valid) text = chk.reason;
    } else if (t.type === 'ride' || t.type === 'shop') {
      const chk = g.rides.validate(t.id, p.x, p.y);
      valid = chk.ok;
      if (valid && g.research && !g.research.unlocked(t.id)) { valid = false; text = '尚未研发该设施'; }
      tiles = chk.tiles || [];
      if (!valid && !text) text = chk.reason || '';
      if (valid && chk.needGate) text = '可放置;放好后用设施窗口"设入口/设出口"接路径';
      this._updateGhost(t.id, p, valid);
    } else if (t.type === 'gate') {
      const ride = g.rides.findRide(t.rideId);
      if (ride) {
        const chk = g.rides.canSetGate(ride, p.x, p.y);
        tiles = [[p.x, p.y]];
        valid = chk.ok;
        text = valid ? `设${t.which === 'entrance' ? '入口' : '出口'}在这里` : (chk.reason || '移到设施边缘且外侧紧邻路径的格子');
      } else { tiles = []; valid = false; }
    } else if (t.type === 'remove') {
      tiles = [[p.x, p.y]];
      const i = w.idx(p.x, p.y);
      const has = w.obj[i] || w.path[i] || w.rideTile[i] !== -1 || w.addon[i];
      valid = !!has;
    } else if (t.type === 'inspect') {
      const i = w.idx(p.x, p.y);
      if (w.rideTile[i] !== -1) { tiles = [[]].length ? [] : g.rides.tilesOf(w.rideTile[i]); }
    }
    this._drawCursor(tiles, valid);
    if (text) {
      this.tip.textContent = text;
      this.tip.style.color = valid ? '#fff' : '#ffb0a0';
      this.tip.style.display = 'block';
      this.tip.style.left = e.clientX + 'px';
      this.tip.style.top = e.clientY + 'px';
    } else this.tip.style.display = 'none';
  }

  _drawCursor(tiles, valid) {
    if (!tiles.length) return;
    const b = new GeomBuilder(), bf = new GeomBuilder();
    for (const [x, y] of tiles) {
      if (x === undefined) continue;
      const yTop = this.game.world.surfaceY(x, y) + 0.06;
      const X = World.tileToWorldX(x), Z = World.tileToWorldZ(y);
      // 四角支架
      const L = 0.34, th = 0.055;
      const corners = [
        [X, Z, 1, 1], [X + TILE, Z, -1, 1], [X + TILE, Z + TILE, -1, -1], [X, Z + TILE, 1, -1],
      ];
      for (const [cx, cz, sx, sz] of corners) {
        b.box(cx + sx * L / 2, yTop, cz, L, th, th, 0xffffff, 1);
        b.box(cx, yTop, cz + sz * L / 2, th, th, L, 0xffffff, 1);
      }
      // 半透明填充
      bf.quad([X, yTop - 0.02, Z], [X, yTop - 0.02, Z + TILE], [X + TILE, yTop - 0.02, Z + TILE], [X + TILE, yTop - 0.02, Z], [0, 0], 0xffffff, 1);
    }
    const m1 = new THREE.Mesh(bf.build(), valid ? this.fillMat : this.badFillMat);
    m1.renderOrder = 5;
    const m2 = new THREE.Mesh(b.build(), valid ? this.bracketMat : this.badBracketMat);
    m2.renderOrder = 6;
    this.cursorGroup.add(m1, m2);
  }

  _updateGhost(defId, p, valid) {
    const g = this.game;
    if (!this.ghost || this.ghost._defId !== defId) {
      this._clearGhost();
      this.ghost = g.rides.makeGhost(defId);
      if (!this.ghost) return;
      this.ghost._defId = defId;
      g.scene.add(this.ghost);
    }
    g.rides.poseGhost(this.ghost, defId, p.x, p.y, valid);
  }
  _clearGhost() {
    if (this.ghost) { this.game.scene.remove(this.ghost); this.ghost = null; }
  }
  _clearCursor() {
    for (const c of [...this.cursorGroup.children]) {
      this.cursorGroup.remove(c);
      c.geometry.dispose();
    }
  }
}
