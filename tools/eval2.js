// 长时仿真:直接注入 100 游客,跑 50 秒,观察队列/乘坐/收入。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 14, 1);
    g.rides.place('carousel', ex - 5, ey + 8);
    g.rides.place('ferris', ex + 4, ey + 8);
    g.rides.place('twist', ex + 6, ey + 11);
    g.rides.place('burger', ex - 9, ey + 8);
    g.rides.place('drinks', ex + 9, ey + 8);
    outer:
    for (let ay = ey + 20; ay < ey + 55; ay += 1)
      for (let ax = ex - 25; ax < ex + 25; ax += 1)
        if (g.rides.place('woodie', ax, ay).ok) break outer;
    for (const r of g.rides.list) r.status = 'open';
    // 注入游客:直接把 spawn 定时器踩死
    for (let i = 0; i < 110; i++) { g.peeps.trySpawn(); g.peeps.spawnTimer = 0; }
    g.camera.centerOnTile(ex, ey + 12);
    g.camera.zoomIdx = 1;
  });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(10000);
    await page.evaluate(() => {
      const g = window.game;
      const R = g.rides.list.map(r => `${r.def.name}:乘${r.guestsServed}队${r.queue.length}收${Math.round(r.incomeTotal)}`).join(' ');
      console.error(`T${Date.now() % 100000} peeps=${g.peeps.list.length} 状态=${g.peeps.list.slice(0, 60).map(p => p.state[0]).join('')} | ${R}`);
    });
  }
}
