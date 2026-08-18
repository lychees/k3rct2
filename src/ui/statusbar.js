// 底部状态栏:日期 / 现金 / 游客 / 评分 + 滚动消息。
export class Statusbar {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'statusbar';
    this.date = cell(); this.cash = cell(); this.guests = cell(); this.rating = cell();
    this.ticker = document.createElement('div');
    this.ticker.className = 'ticker';
    this.el.append(this.date, this.cash, this.guests, this.rating, this.ticker);
    root.appendChild(this.el);
    game.messages.onAdd = (t, rideId) => {
      this.ticker.textContent = '';
      if (rideId != null) {   // 可点击:跳到设施窗口
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = t;
        a.style.color = '#9fd0ff';
        a.addEventListener('click', ev => {
          ev.preventDefault();
          game.ui?.rideWindow?.(rideId);
        });
        this.ticker.appendChild(a);
      } else {
        this.ticker.textContent = t;
      }
    };
    function cell() { const d = document.createElement('div'); d.className = 'cell'; return d; }
  }
  update() {
    const g = this.game, eco = g.economy;
    this.date.textContent = eco.dateStr();
    this.cash.textContent = eco.fmt(eco.cash);
    this.cash.className = 'cell cash' + (eco.cash < 0 ? ' neg' : '');
    this.guests.textContent = `游客 ${g.peeps ? g.peeps.list.length : 0}`;
    const r = Math.round(eco.parkRating);
    this.rating.textContent = `评分 ${r}`;
    this.rating.style.color = r >= 500 ? 'var(--rct-green)' : 'var(--rct-yellow)';
  }
}
