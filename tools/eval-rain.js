// 雨伞+雨幕特写
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    g.weather.mode = 'rain';
    for (let i = 0; i < 60; i++) g.peeps.trySpawn();
    g.camera.centerOnTile(ex, ey + 4);
    g.camera.zoomIdx = 2; g.camera.snap();
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const g = window.game;
    g.peeps.list.forEach((p, i) => { if (i % 2 === 0) p.hasUmbrella = true; });
  });
  await page.waitForTimeout(800);
}
