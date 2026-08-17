// 验证:游客乘坐设施时可见(骑上旋转木马)+ 点选小人弹状态窗。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 14, 1);
    g.rides.place('carousel', ex - 5, ey + 8);
    const car = g.rides.list[0];
    car.status = 'open';
    for (let i = 0; i < 24; i++) g.peeps.trySpawn();
    g.camera.centerOnTile(ex - 3, ey + 9);
    g.camera.setZoom(2);
  });
  await page.waitForTimeout(500);
  // 直接把 6 位游客塞进旋转木马队列
  await page.evaluate(() => {
    const g = window.game;
    const car = g.rides.list[0];
    let n = 0;
    for (const p of g.peeps.list) {
      if (n >= 6) break;
      if (p.state !== 'wander' && p.state !== 'enter') continue;
      g.rides.joinQueue(p, car);
      p.queueIndex = n; g.peeps.updateQueuePos(p);
      n++;
    }
  });
  await page.waitForTimeout(2500);
  const riders = await page.evaluate(() => {
    const r = window.game.rides.list[0];
    return { riders: r.riders.length, visible: r.riders.filter(p => p.hidden && r.api.riderPos).length, phase: r.phase };
  });
  console.error(`RIDERS ${JSON.stringify(riders)}`);
  if (!riders.riders) console.error('FAIL no riders boarded');
  await page.screenshot({ path: 'shots/71-riders-visible.png' });

  // 真实鼠标点选一位漫游中的游客 → 应弹出状态窗(取点与点击之间不停顿,游客会走动)
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    g.camera.centerOnTile(w.entrance.x, w.entrance.y + 4);   // 镜头切回入口人流
    g.camera.setZoom(2);
    g.camera.snap();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.__pt = (() => {
      const g = window.game;
      let best = null, bestD = 1e9;
      for (const p of g.peeps.list) {
        if ((p.state !== 'wander' && p.state !== 'enter') || p.hidden) continue;
        const v3 = g.camera.target.clone().set(p.x, g.world.surfaceY(p.tile[0], p.tile[1]) + 0.8, p.z);
        const s = g.camera.groundToScreen(v3);
        if (s.x < 60 || s.y < 80 || s.x > innerWidth - 60 || s.y > innerHeight - 80) continue;  // 视口边缘外不好点
        const d = Math.hypot(s.x - innerWidth / 2, s.y - innerHeight / 2);
        if (d < bestD) { bestD = d; best = { x: s.x, y: s.y }; }
      }
      return best;
    })();
  });
  const pt = await page.evaluate(() => window.__pt);
  if (pt) {
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(400);
    const win = await page.evaluate(() => [...document.querySelectorAll('.rct-win')].some(w => w.textContent.includes('开心')));
    if (!win) console.error('FAIL peep window not opened by click');
  } else console.error('FAIL no wander peep for click test');
  await page.screenshot({ path: 'shots/72-peep-click-window.png' });
}
