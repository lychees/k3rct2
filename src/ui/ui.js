// UI 总装:工具栏、状态栏、窗口管理器、面板、设施窗口。
import { WindowMan } from './windows.js';
import { Toolbar } from './toolbar.js';
import { Statusbar } from './statusbar.js';
import { Panels } from './panels.js';
import { openRideWindow } from './ridewin.js';
import { openPeepWindow } from './peepwin.js';
import { checkAchievements, ACH_DEFS } from '../game/achievements.js';

export class UI {
  constructor(game) {
    this.game = game;
    const root = document.getElementById('ui');
    this.wm = new WindowMan(root);
    this.toolbar = new Toolbar(game, root);
    this.statusbar = new Statusbar(game, root);
    this.panels = new Panels(game, this.wm);
    this._acc = 0;
  }
  refreshToolbar() { this.toolbar.refresh(); }
  rideWindow(rideId) { return openRideWindow(this.game, this.wm, rideId); }
  peepWindow(kind, id) { return openPeepWindow(this.game, this.wm, kind, id); }
  closeRideWindow(rideId) { this.wm.close('ride-' + rideId); }
  openSave() { this.panels.open('save'); }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.25) return;
    this._acc = 0;
    this.statusbar.update();
    this.wm.refreshAll();
    this._ambientAudio();
    this._achAcc = (this._achAcc || 0) + 0.25;
    if (this._achAcc >= 1) { this._achAcc = 0; checkAchievements(this.game); }   // 成就每秒一查
    if (this.game.mp) {   // 联机客户端本地采样评分曲线(单机在月结时采样)
      this._rateAcc = (this._rateAcc || 0) + 0.25;
      if (this._rateAcc >= 4) { this._rateAcc = 0; this.game.economy.sampleRating?.(); }
    }
  }

  // 环境音驱动:雨声随天气,人群随游客数,八音盒随最近的开放中旋转木马距离
  _ambientAudio() {
    const g = this.game;
    if (!g.audio) return;
    let music = 0;
    if (g.rides && g.camera) {
      for (const r of g.rides.list) {
        if (r.def.id !== 'carousel' || r.status !== 'open' || r.broken) continue;
        const c = g.world.tileCenter(r.x + 1, r.y + 1);
        const d = Math.hypot(c.x - g.camera.target.x, c.z - g.camera.target.z);
        music = Math.max(music, Math.max(0, 1 - d / 45));
      }
    }
    const crowd = Math.min(1, (g.peeps?.list.length || 0) / 250);
    g.audio.ambient({ rain: g.weather?.mode === 'rain', crowd, music });
  }
}
