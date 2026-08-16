// 新功能浏览器验收:锁定列表、研发面板、设出入口、无门提示。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    g.camera.centerOnTile(ex, ey + 8);
    g.camera.zoomIdx = 2; g.camera.snap();
    g.ui.panels.open('research');
  });
  await page.waitForTimeout(600);
  // 研发拉满观察进度
  await page.evaluate(() => window.game.dispatchAction({ type: 'researchLevel', value: 3 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/40-research.png' });
  const researchState = await page.evaluate(() => {
    const R = window.game.research;
    return { level: R.levelName(), progress: +R.progress.toFixed(1), cur: R.current()?.name };
  });
  console.error('RESEARCH ' + JSON.stringify(researchState));
  await page.evaluate(() => window.game.ui.wm.close('panel-research'));
  // 设施列表:未研发应半透明
  await page.evaluate(() => window.game.ui.panels.open('rides'));
  await page.waitForTimeout(500);
  const lockInfo = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.rct-win .rct-item')];
    return items.map(it => ({ locked: it.style.opacity === '0.45', text: it.querySelector('.price')?.textContent }))
      .slice(0, 5);
  });
  console.error('LOCKS ' + JSON.stringify(lockInfo));
  // 放旋转木马,打开窗口,用"设入口"工具换一次入口
  const gateResult = await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    const r = g.rides.place('carousel', ex - 5, ey + 8);
    if (!r.ok) return { fail: r.reason };
    const ride = r.ride;
    g.rides.openWindow(ride.id);
    // 工具:设出口 → 点一个合法格(找出口候选)
    g.tools.setTool({ type: 'gate', rideId: ride.id, which: 'exit' });
    let target = null;
    for (let ty = ride.y; ty < ride.y + ride.def.h && !target; ty++)
      for (let tx = ride.x; tx < ride.x + ride.def.w && !target; tx++) {
        const c = g.rides.canSetGate(ride, tx, ty);
        if (c.ok && (c.inner[0] !== ride.exit.inner[0] || c.inner[1] !== ride.exit.inner[1])) target = [tx, ty];
      }
    if (!target) return { fail: '无候选' };
    const before = ride.exit.inner.slice();
    const sr = g.rides.setGate(ride.id, 'exit', target[0], target[1]);
    return { before, after: ride.exit.inner, ok: sr.ok };
  });
  console.error('GATE ' + JSON.stringify(gateResult));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/41-gate.png' });
}
