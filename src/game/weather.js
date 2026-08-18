// 天气:晴/阴/雨月度轮转(权威侧掷骰),客户端做雨幕粒子 + 光照平滑过渡。
// 游玩影响:Peeps.spawnInterval 乘 spawnFactor;下雨没伞的游客开心度双倍衰减(peeps.js)。
import * as THREE from 'three';

export class Weather {
  constructor(game) {
    this.game = game;
    this.mode = 'sun';              // 'sun' | 'cloud' | 'rain'
    this.rain = null;
    this.overlay = null;
    this._l = 1;                    // 光照插值系数
  }

  // 权威侧(单机/服务器),每次月结调用
  updateMonthly() {
    if (this._next) {   // 应用上月预告
      const next = this._next;
      if (next !== this.mode) {
        this.mode = next;
        const msg = next === 'rain' ? '开始下雨了!游客会被淋湿,伞具店要生意了' : next === 'sun' ? '天晴了' : '天阴下来了';
        this.game.messages?.add(msg);
        this.game.economy?._emit?.('change');
      }
    }
    this._next = this._rollNext();   // 预掷下月(供预告)
  }
  _rollNext() {
    const r = Math.random();
    const cur = this.mode;
    if (cur === 'sun') return r < 0.62 ? 'sun' : r < 0.87 ? 'cloud' : 'rain';
    if (cur === 'cloud') return r < 0.42 ? 'sun' : r < 0.80 ? 'cloud' : 'rain';
    return r < 0.30 ? 'cloud' : r < 0.42 ? 'sun' : 'rain';
  }
  forecast() { return this._next || this.mode; }

  spawnFactor() { return this.mode === 'rain' ? 0.6 : this.mode === 'cloud' ? 0.85 : 1; }

  // ===== 客户端视觉 =====
  initVisuals() {
    const g = this.game;
    const N = 700;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = Math.random() * 24;
      p[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xbcd8f0, size: 0.17, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    g.scene.add(this.rain);
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;transition:background 1.2s;z-index:5';
    document.getElementById('ui').appendChild(ov);
    this.overlay = ov;
  }

  // 每帧(main 循环在非 paused 时调用)
  updateVisual(dt, sunLight, hemiLight) {
    const target = this.mode === 'sun' ? 1 : this.mode === 'cloud' ? 0.72 : 0.45;
    this._l += (target - this._l) * Math.min(1, dt * 1.5);
    if (sunLight) sunLight.intensity = 1.15 * this._l;
    if (hemiLight) hemiLight.intensity = 0.95 * (0.75 + 0.25 * this._l);
    if (this.overlay) {
      this.overlay.style.background =
        this.mode === 'rain' ? 'rgba(40,52,80,0.20)' :
        this.mode === 'cloud' ? 'rgba(60,70,92,0.10)' : 'transparent';
    }
    if (this.rain) {
      const on = this.mode === 'rain';
      this.rain.visible = on;
      if (on) {
        const attr = this.rain.geometry.attributes.position;
        for (let i = 0; i < attr.count; i++) {
          let y = attr.getY(i) - dt * 14;
          if (y < 0) y = 24;
          attr.setY(i, y);
        }
        attr.needsUpdate = true;
        const tgt = this.game.camera.target;
        this.rain.position.set(tgt.x, 0, tgt.z);
      }
    }
  }
}
