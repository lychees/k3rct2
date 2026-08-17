// 游客第一视角:透视相机挂在游客眼位,跟随行走;左键拖动环视,Esc 退出。
// 主循环在 active 时改用它渲染(main.js);游客上车/离园自动换下一位。
import * as THREE from 'three';
import { H_UNIT, PATH } from '../config.js';

export class FirstPersonView {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 800);
    this.active = false;
    this.peep = null;
    this.yawOff = 0;
    this.pitch = 0;
    this._drag = null;
    this._hint = null;
    this._bind();
  }

  _bind() {
    const el = this.game.renderer.domElement;
    el.addEventListener('pointerdown', e => {
      if (!this.active || e.button !== 0) return;
      this._drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.active || !this._drag) return;
      this.yawOff += (e.clientX - this._drag.x) * 0.005;
      this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - (e.clientY - this._drag.y) * 0.005));
      this._drag = { x: e.clientX, y: e.clientY };
    });
    const up = () => { this._drag = null; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => {
      if (this.active && e.code === 'Escape') this.exit();
    });
  }

  enterRandom(forceNew = false) {
    const g = this.game;
    const list = (g.peeps?.list || []).filter(p => !p.hidden && p.tile);
    if (!list.length) return false;
    let pool = list;
    if (forceNew && this.peep && list.length > 1) pool = list.filter(p => p !== this.peep);
    this.peep = pool[Math.floor(Math.random() * pool.length)];
    this.active = true;
    this.yawOff = 0;
    this.pitch = 0;
    this._showHint(true);
    g.audio?.play('click');
    return true;
  }
  exit() {
    this.active = false;
    this.peep = null;
    this._showHint(false);
    this.game.messages?.add('退出第一视角');
  }

  _showHint(on) {
    if (on && !this._hint) {
      const d = document.createElement('div');
      d.textContent = '第一视角:跟随游客游览 · 左键拖动环视 · Esc 退出';
      d.style.cssText = 'position:absolute;left:50%;bottom:44px;transform:translateX(-50%);' +
        'background:rgba(10,16,28,0.75);color:#e8e6d0;padding:6px 14px;border-radius:4px;font-size:12px;pointer-events:none;z-index:60';
      document.getElementById('ui').appendChild(d);
      this._hint = d;
    }
    if (this._hint) this._hint.style.display = on ? 'block' : 'none';
  }

  _groundY(p) {   // 与 PeepRenderer.groundY 同一约定
    const w = this.game.world;
    let y = w.surfaceY(p.tile[0], p.tile[1]);
    if (w.path[w.idx(p.tile[0], p.tile[1])] !== PATH.NONE) y = Math.max(...w.corners(p.tile[0], p.tile[1])) * H_UNIT + 0.035;
    return y;
  }

  update() {
    if (!this.active) return;
    const g = this.game, cam = this.camera;
    let p = this.peep;
    const list = g.peeps?.list || [];
    if (!p || p.hidden || !list.includes(p)) {          // 跟随的游客上车/离园 → 换一位
      this.peep = null;
      if (!this.enterRandom()) { this.exit(); return; }
      p = this.peep;
    }
    const el = g.renderer.domElement;
    const asp = el.clientWidth / Math.max(1, el.clientHeight);
    if (Math.abs(asp - cam.aspect) > 1e-3) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    const yaw = (p.yaw || 0) + this.yawOff;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);      // peep 面朝方向(yaw 约定与渲染器一致)
    const y = this._groundY(p) + 1.45;                   // 眼高
    cam.position.set(p.x + fx * 0.25, y, p.z + fz * 0.25);   // 略前移,避免看到自己的帽子
    const cp = Math.cos(this.pitch);
    cam.lookAt(cam.position.x + fx * cp, y + Math.sin(this.pitch), cam.position.z + fz * cp);
  }
}
