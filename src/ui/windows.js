// RCT2 风格窗口管理器:标题栏拖拽、关闭按钮、去重打开。
export class WindowMan {
  constructor(rootEl) {
    this.root = rootEl;
    this.wins = new Map();  // id → {el, opts, contentEl}
    this._z = 10;
  }

  open(opts) {
    // opts: {id, title, x, y, width, build(el, win), onClose, noFocus}
    let w = this.wins.get(opts.id);
    if (w) { this.focus(opts.id); return w; }
    const el = document.createElement('div');
    el.className = 'rct-win';
    if (opts.width) el.style.width = opts.width + 'px';
    el.style.left = (opts.x ?? 80) + 'px';
    el.style.top = (opts.y ?? 60) + 'px';
    el.style.zIndex = ++this._z;
    const tb = document.createElement('div');
    tb.className = 'titlebar';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = opts.title || '';
    tb.appendChild(titleSpan);
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.addEventListener('click', (e) => { e.stopPropagation(); this.close(opts.id); });
    tb.appendChild(close);
    const content = document.createElement('div');
    content.className = 'content';
    el.appendChild(tb);
    el.appendChild(content);
    this.root.appendChild(el);
    w = { id: opts.id, el, contentEl: content, titleEl: titleSpan, opts, refresh: null };
    this.wins.set(opts.id, w);
    opts.build?.(content, w);
    // 拖拽
    tb.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
      const mv = (ev) => {
        el.style.left = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - sx)) + 'px';
        el.style.top = Math.max(34, Math.min(window.innerHeight - 60, ev.clientY - sy)) + 'px';
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      this.focus(opts.id);
    });
    el.addEventListener('pointerdown', () => this.focus(opts.id));
    return w;
  }

  focus(id) {
    const w = this.wins.get(id);
    if (w) w.el.style.zIndex = ++this._z;
  }
  close(id) {
    const w = this.wins.get(id);
    if (!w) return;
    w.opts.onClose?.();
    w.el.remove();
    this.wins.delete(id);
  }
  toggle(opts) {
    if (this.wins.has(opts.id)) { this.close(opts.id); return null; }
    return this.open(opts);
  }
  get(id) { return this.wins.get(id); }
  setTitle(id, t) { const w = this.wins.get(id); if (w) w.titleEl.textContent = t; }
  has(id) { return this.wins.has(id); }
  refreshAll() { for (const w of this.wins.values()) w.refresh?.(); }
}
