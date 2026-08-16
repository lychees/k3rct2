// 存档往返测试:建一些东西 → 保存 → 刷新 → 验证恢复。
async (page) => {
  const build = async () => page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    if (!g.rides.list.length) g.rides.place('carousel', ex - 5, ey + 8);
    for (const r of g.rides.list) r.status = 'open';
    g.saves.save();
    return { paths: w.path.reduce((s, v) => s + (v ? 1 : 0), 0), rides: g.rides.list.length, cash: Math.round(g.economy.cash) };
  });
  const before = await build();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const g = window.game, w = g.world;
    return { paths: w.path.reduce((s, v) => s + (v ? 1 : 0), 0), rides: g.rides.list.length, status: g.rides.list[0]?.status };
  });
  const ok = before.paths === after.paths && before.rides === after.rides && after.status === 'open';
  console.error(`SAVEROUNDTRIP before=${JSON.stringify(before)} after=${JSON.stringify(after)} → ${ok ? 'OK' : 'MISMATCH'}`);
  if (!ok) throw new Error('save roundtrip mismatch');
  await page.evaluate(() => {
    const g = window.game;
    const c = g.rides.list[0];
    g.camera.centerOnTile(c.x + 2, c.y + 2);
    g.camera.zoomIdx = 2;
  });
}
