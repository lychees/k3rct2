// 音效:WebAudio 程序合成,零音频资源(静态托管友好)。
// 首次调用需处于用户手势之后(浏览器 autoplay 策略);静音状态持久化到 localStorage。
// 无 window/AudioContext 的环境(node 测试、服务端)下所有方法安全空转。
export class Sfx {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('rct2js-muted') === '1'; } catch { this.muted = false; }
  }
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('rct2js-muted', this.muted ? '1' : '0'); } catch { /* 隐身模式等忽略 */ }
    return this.muted;
  }
  _ensure() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }
  play(name) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const fn = this['_' + name];
    if (fn) { try { fn.call(this, ctx); } catch { /* 播放失败不致命 */ } }
  }

  _tone(ctx, { f = 440, f2 = 0, t = 0.08, type = 'square', g = 0.1, at = 0 }) {
    const o = ctx.createOscillator(), ga = ctx.createGain();
    const t0 = ctx.currentTime + at;
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + t);
    ga.gain.setValueAtTime(g, t0);
    ga.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(ga).connect(ctx.destination);
    o.start(t0); o.stop(t0 + t + 0.02);
  }
  _noise(ctx, { t = 0.15, g = 0.12, f = 800, at = 0 }) {
    const len = Math.max(1, (ctx.sampleRate * t) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = f;
    const ga = ctx.createGain(); ga.gain.value = g;
    src.connect(fl); fl.connect(ga); ga.connect(ctx.destination);
    src.start(ctx.currentTime + at);
  }

  _click(ctx) { this._tone(ctx, { f: 900, t: 0.03, g: 0.05 }); }
  _place(ctx) { this._tone(ctx, { f: 190, f2: 90, t: 0.12, type: 'triangle', g: 0.16 }); }
  _remove(ctx) { this._noise(ctx, { t: 0.18, g: 0.13, f: 550 }); }
  _error(ctx) {
    this._tone(ctx, { f: 220, t: 0.07, type: 'sawtooth', g: 0.09 });
    this._tone(ctx, { f: 170, t: 0.11, type: 'sawtooth', g: 0.09, at: 0.08 });
  }
  _cash(ctx) {
    this._tone(ctx, { f: 1320, t: 0.05, type: 'sine', g: 0.07 });
    this._tone(ctx, { f: 1760, t: 0.1, type: 'sine', g: 0.07, at: 0.05 });
  }
  _fanfare(ctx) { [523, 659, 784].forEach((f, i) => this._tone(ctx, { f, t: 0.09, type: 'triangle', g: 0.1, at: i * 0.07 })); }
  _win(ctx) { [523, 659, 784, 1046].forEach((f, i) => this._tone(ctx, { f, t: 0.13, type: 'triangle', g: 0.12, at: i * 0.1 })); }
  _lose(ctx) { [392, 330, 262].forEach((f, i) => this._tone(ctx, { f, t: 0.15, type: 'triangle', g: 0.1, at: i * 0.12 })); }
}
