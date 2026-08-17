// 验证:开发者控制台(印钱/一键研究)+ 旋转木马旋转轴在两相位下的截图。
async (page) => {
  const r = await page.evaluate(() => {
    const g = window.game;
    const cash0 = g.economy.cash;
    g.ui.panels.open('cheat');
    const win = [...document.querySelectorAll('.rct-win')].find(w => w.textContent.includes('开发者控制台'));
    if (!win) return { err: 'cheat panel not found' };
    const btns = [...win.querySelectorAll('.rct-btn')];
    btns[0].click();                       // 印钱 +$10,000
    const cash1 = g.economy.cash;
    btns[1].click();                       // 一键完成所有研究
    const done = g.research.done.length;
    const w = g.world, ex = w.entrance.x, ey = w.entrance.y;
    const rc = g.rides.place('carousel', ex - 5, ey + 8);
    if (rc.ok) g.rides.list.find(r => r.id === rc.ride.id).status = 'open';
    g.camera.centerOnTile(ex - 4, ey + 9);
    g.camera.setZoom(2);
    return { cash0, cash1, done, rideOk: !!(rc && rc.ok) };
  });
  if (r.err) console.error('FAIL ' + r.err);
  else {
    if (r.cash1 - r.cash0 !== 10000) console.error('FAIL cheatMoney ' + r.cash0 + ' -> ' + r.cash1);
    if (r.done !== 12) console.error('FAIL researchAll done=' + r.done);
    if (!r.rideOk) console.error('FAIL place carousel');
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/61-cheat-carousel-t0.png' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/62-carousel-t1.png' });
}
