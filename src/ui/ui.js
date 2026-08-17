// UI 总装:工具栏、状态栏、窗口管理器、面板、设施窗口。
import { WindowMan } from './windows.js';
import { Toolbar } from './toolbar.js';
import { Statusbar } from './statusbar.js';
import { Panels } from './panels.js';
import { openRideWindow } from './ridewin.js';
import { openPeepWindow } from './peepwin.js';

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
  }
}
