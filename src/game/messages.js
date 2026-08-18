// 滚动消息:进入列表,状态栏滚动显示。可带 rideId(点击跳到设施窗口)。
export class Messages {
  constructor() {
    this.list = [];
    this.onAdd = null;
  }
  add(text, rideId = null) {
    this.list.push({ text, rideId, t: Date.now(), read: false });
    if (this.list.length > 40) this.list.shift();
    this.onAdd?.(text, rideId);
  }
  latest() {
    return this.list.length ? this.list[this.list.length - 1].text : '';
  }
}

// 游客想法(最近 14 条,新→旧)
export class Thoughts {
  constructor() { this.list = []; }
  push(t) {
    this.list.unshift({ ...t, t: Date.now() });
    if (this.list.length > 14) this.list.pop();
  }
}
