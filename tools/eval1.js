// UI 演练:建公园 + 打开几个窗口 + 截图。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    const say = (k, r) => { if (!r || !r.ok) console.error('FAIL ' + k + ' ' + (r && r.reason)); };
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 14, 1);
    say('carousel', g.rides.place('carousel', ex - 5, ey + 8));
    say('ferris', g.rides.place('ferris', ex + 4, ey + 8));
    say('twist', g.rides.place('twist', ex + 6, ey + 11));
    say('burger', g.rides.place('burger', ex - 9, ey + 8));
    say('drinks', g.rides.place('drinks', ex + 9, ey + 8));
    outer:
    for (let ay = ey + 20; ay < ey + 55; ay += 1)
      for (let ax = ex - 25; ax < ex + 25; ax += 1)
        if (g.rides.place('woodie', ax, ay).ok) break outer;
    const trees = ['pine', 'oak', 'maple', 'birch'];
    for (let i = 0; i < 70; i++) g.scenery.place(trees[i % 4], ex - 24 + Math.floor(Math.random() * 48), ey + 2 + Math.floor(Math.random() * 34));
    for (let i = 0; i < 14; i++) g.scenery.place('flower', ex - 10 + Math.floor(Math.random() * 20), ey + 3 + Math.floor(Math.random() * 14));
    for (const r of g.rides.list) r.status = 'open';
    // 打开 UI:设施面板 + 公园信息 + 一个设施窗口
    g.ui.panels.open('rides');
    const c = g.rides.list[0];
    g.rides.openWindow(c.id);
    g.camera.centerOnTile(ex, ey + 12);
    g.camera.zoomIdx = 1;
  });
  await page.waitForTimeout(10000);
  await page.evaluate(() => {
    const g = window.game;
    console.error('PEEPS ' + g.peeps.list.length + ' rating=' + Math.round(g.economy.parkRating) + ' cash=' + Math.round(g.economy.cash) +
      ' riders=' + g.rides.list.reduce((s, r) => s + r.guestsServed, 0));
  });
  await page.waitForTimeout(400);
}
