// 新系统视觉验收:全研发解锁 → 4 新设施 → 强制下雨 → 小地图。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    g.research.done = ['drinks', 'toilet', 'umbrella', 'ferris', 'haunted', 'balloon', 'coffee', 'bumper', 'pirate', 'twist', 'tower', 'woodie'];
    g.research.queueIdx = 12;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8 + i, ey + 14, 1); g.paths.place(ex + 8 - 0, ey + 14 + 0, 1); }
    // 新设施
    console.error('haunted', g.rides.place('haunted', ex - 5, ey + 8).reason || 'ok');
    console.error('bumper', g.rides.place('bumper', ex + 3, ey + 10).reason || 'ok');
    console.error('pirate', g.rides.place('pirate', ex + 1, ey + 7).reason || 'ok');
    console.error('tower', g.rides.place('tower', ex - 11, ey + 8).reason || 'ok');
    for (const r of g.rides.list) r.status = 'open';
    // 下雨 + 伞
    g.weather.mode = 'rain';
    for (let i = 0; i < 40; i++) g.peeps.trySpawn();
    window.__ready = false;
  });
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const g = window.game;
    // 给一半游客发伞看渲染
    g.peeps.list.forEach((p, i) => { if (i % 2 === 0) p.hasUmbrella = true; });
    const e = g.world.entrance;
    g.camera.centerOnTile(e.x, e.y + 9);
    g.camera.zoomIdx = 2; g.camera.snap();
    g.ui.panels.open('map');
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/50-newrides.png' });
  console.error('SHOT DONE');
}
