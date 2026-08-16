// 员工系统视觉验收:雇三种员工,撒垃圾,看清扫过程与员工面板。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 8; i++) { g.paths.place(ex - 8, ey + 6 + i, 1); g.paths.place(ex + 8, ey + 6 + i, 1); }
    for (let x = ex - 8; x <= ex + 8; x++) g.paths.place(x, ey + 14, 1);
    g.rides.place('carousel', ex - 5, ey + 8).ok;
    for (const r of g.rides.list) r.status = 'open';
    // 雇员工
    g.dispatchAction({ type: 'staffHire', role: 'handyman' });
    g.dispatchAction({ type: 'staffHire', role: 'mechanic' });
    g.dispatchAction({ type: 'staffHire', role: 'entertainer' });
    // 撒垃圾(靠外的主路一排)
    for (let i = 0; i < 6; i++) g.staff._dropLitter(ex - 6 + i, ey + 6, i % 3 === 0);
    g.ui.panels.open('staff');
    g.camera.centerOnTile(ex - 2, ey + 6);
    g.camera.zoomIdx = 2; g.camera.snap();
  });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const g = window.game;
    return {
      staff: g.staff.list.map(s => [s.role, s.state]),
      litterTotal: g.world.litter.reduce((a, b) => a + b, 0),
    };
  });
  console.error('STAFF ' + JSON.stringify(info));
}
