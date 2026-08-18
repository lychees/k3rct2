// 音效:WebAudio 程序合成,零音频资源(静态托管友好)。
// 首次调用需处于用户手势之后(浏览器 autoplay 策略);静音状态持久化到 localStorage。
// 无 window/AudioContext 的环境(node 测试、服务端)下所有方法安全空转。
export class Sfx {
  constructor() {
    this.ctx = null;
    this._loops = {};      // 环境循环音(name → {gain, nodes...})
    try { this.muted = localStorage.getItem('rct2js-muted') === '1'; } catch { this.muted = false; }
    try { this.volume = parseFloat(localStorage.getItem('rct2js-vol') ?? '0.8'); } catch { this.volume = 0.8; }
    if (!Number.isFinite(this.volume)) this.volume = 0.8;
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('rct2js-vol', String(this.volume)); } catch { /* 忽略 */ }
    if (this._masterGain) this._masterGain.gain.value = this.muted ? 0 : this.volume;
  }
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('rct2js-muted', this.muted ? '1' : '0'); } catch { /* 隐身模式等忽略 */ }
    if (this._masterGain) this._masterGain.gain.value = this.muted ? 0 : this.volume;
    if (this.muted) for (const k in this._loops) {   // 静音即停所有环境音
      try { this._loops[k].gain.gain.value = 0; } catch { /* 忽略 */ }
    }
    return this.muted;
  }
  // 主音量总线(所有音效/环境音都经它)
  _master(ctx) {
    if (!this._masterGain) {
      this._masterGain = ctx.createGain();
      this._masterGain.gain.value = this.muted ? 0 : this.volume;
      this._masterGain.connect(ctx.destination);
    }
    return this._masterGain;
  }
  _ensure() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!this.ctx) {
        this.ctx = new AC();
        // autoplay 策略:上下文可能在首次用户手势前被挂起 → 手势一到即恢复
        if (typeof document !== 'undefined') {
          const resume = () => { try { this.ctx?.resume?.(); } catch { /* 忽略 */ } };
          document.addEventListener('pointerdown', resume);
          document.addEventListener('keydown', resume);
        }
      }
      if (this.ctx.state === 'suspended') {   // 节流 resume,避免控制台刷屏
        const now = Date.now();
        if (now - (this._resumeTried || 0) > 1500) { this._resumeTried = now; this.ctx.resume(); }
      }
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

  _tone(ctx, { f = 440, f2 = 0, t = 0.08, type = 'square', g = 0.1, at = 0, dest = null }) {
    const o = ctx.createOscillator(), ga = ctx.createGain();
    const t0 = ctx.currentTime + at;
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + t);
    ga.gain.setValueAtTime(g, t0);
    ga.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(ga).connect(dest || this._master(ctx));
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
    src.connect(fl); fl.connect(ga); ga.connect(this._master(ctx));
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
  // 人群尖叫:4 个去谐"人声"(锯齿 + 快颤音 + 共振峰带通),先扬后落
  _scream(ctx) {
    for (let v = 0; v < 4; v++) {
      const t0 = ctx.currentTime + Math.random() * 0.09;
      const dur = 0.45 + Math.random() * 0.35;
      const f0 = 480 + Math.random() * 420;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f0 * (1.25 + Math.random() * 0.4), t0 + dur * 0.35);
      o.frequency.linearRampToValueAtTime(f0 * 0.72, t0 + dur);
      const lfo = ctx.createOscillator();          // 颤音
      lfo.frequency.value = 20 + Math.random() * 12;
      const lg = ctx.createGain();
      lg.gain.value = f0 * 0.09;
      lfo.connect(lg); lg.connect(o.frequency);
      const bp = ctx.createBiquadFilter();          // 共振峰
      bp.type = 'bandpass';
      bp.frequency.value = 1000 + Math.random() * 500;
      bp.Q.value = 1.1;
      const ga = ctx.createGain();
      ga.gain.setValueAtTime(0.0001, t0);
      ga.gain.exponentialRampToValueAtTime(0.032, t0 + 0.06);
      ga.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(bp); bp.connect(ga); ga.connect(this._master(ctx));
      o.start(t0); o.stop(t0 + dur + 0.05);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
  }
  // 轨道轰鸣:低通噪声短促
  _rumble(ctx) { this._noise(ctx, { t: 0.5, g: 0.11, f: 150 }); }
  // 提升坡链条咔嗒
  _clack(ctx) { this._tone(ctx, { f: 1400, t: 0.02, type: 'square', g: 0.03 }); }

  // ---------- 环境循环音:雨声 / 人群嘈杂 / 旋转木马八音盒 ----------
  // 每 ~0.25s 由 UI 调用;音量平滑趋近目标,静音时全部关停
  ambient({ rain = false, crowd = 0, music = 0 } = {}) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    this._noiseLoop(ctx, 'rain', rain ? 0.045 : 0, 900);
    this._noiseLoop(ctx, 'crowd', Math.min(1, crowd) * 0.035, 380);
    this._musicLoop(ctx, music);
  }
  _noiseLoop(ctx, name, targetGain, cutoff) {
    let L = this._loops[name];
    if (!L && targetGain > 0) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {   // 棕噪(雨/人群底噪)
        const w2 = Math.random() * 2 - 1;
        last = (last + 0.02 * w2) / 1.02;
        d[i] = last * 3;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = cutoff;
      const ga = ctx.createGain(); ga.gain.value = 0;
      src.connect(fl); fl.connect(ga); ga.connect(this._master(ctx));
      src.start();
      L = this._loops[name] = { gain: ga, nodes: [src] };
    }
    if (L) L.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.5);
  }
  // 八音盒:3/4 圆舞曲音型(自作曲,不复制原版旋律),lookahead 调度
  _musicLoop(ctx, amt) {
    let L = this._loops.music;
    if (!L && amt > 0.02) {
      const ga = ctx.createGain();
      ga.gain.value = 0;
      ga.connect(this._master(ctx));
      L = this._loops.music = { gain: ga, step: 0, nextT: ctx.currentTime + 0.1 };
      L.timer = setInterval(() => this._musicStep(ctx), 120);
    }
    if (L) L.gain.gain.setTargetAtTime(Math.min(1, amt) * 0.10, ctx.currentTime, 0.4);
  }
  _musicStep(ctx) {
    const L = this._loops.music;
    if (!L) return;
    // C - Dm - F - G 走向的分解和弦,每小节 3 拍
    const PROG = [
      [261.6, 329.6, 392.0], [261.6, 329.6, 392.0],
      [293.7, 349.2, 440.0], [261.6, 329.6, 392.0],
      [349.2, 440.0, 523.3], [349.2, 440.0, 523.3],
      [246.9, 293.7, 392.0], [261.6, 329.6, 392.0],
    ];
    while (L.nextT < ctx.currentTime + 0.35) {
      const chord = PROG[((L.step / 3) | 0) % PROG.length];
      const beat = L.step % 3;
      const at = Math.max(0, L.nextT - ctx.currentTime);
      if (beat === 0) this._tone(ctx, { f: chord[0] / 2, t: 0.5, type: 'triangle', g: 0.5, at, dest: L.gain });
      else {
        this._tone(ctx, { f: chord[1], t: 0.3, type: 'sine', g: 0.4, at, dest: L.gain });
        this._tone(ctx, { f: chord[2], t: 0.3, type: 'sine', g: 0.32, at, dest: L.gain });
      }
      L.step++;
      L.nextT += 0.36;
    }
  }
  _fanfare(ctx) { [523, 659, 784].forEach((f, i) => this._tone(ctx, { f, t: 0.09, type: 'triangle', g: 0.1, at: i * 0.07 })); }
  _win(ctx) { [523, 659, 784, 1046].forEach((f, i) => this._tone(ctx, { f, t: 0.13, type: 'triangle', g: 0.12, at: i * 0.1 })); }
  _lose(ctx) { [392, 330, 262].forEach((f, i) => this._tone(ctx, { f, t: 0.15, type: 'triangle', g: 0.1, at: i * 0.12 })); }
}
