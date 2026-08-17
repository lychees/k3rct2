// 验证:员工戴岗位色帽子,与游客一眼可区分。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let i = 0; i < 30; i++) g.peeps.trySpawn();
    g.staff.hire('handyman');
    g.staff.hire('mechanic');
    g.staff.hire('entertainer');
    g.staff.hire('guard');
    g.camera.centerOnTile(ex, ey + 4);
    g.camera.setZoom(2);
  });
  await page.waitForTimeout(6000);
}
